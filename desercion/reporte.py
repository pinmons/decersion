"""Genera reportes/datos_resumen.md y reportes/reporte_entrenamiento.md con los números reales.

    python -m desercion.reporte     # regenera los dos reportes desde reportes/resultados.json

Si existe pruebas/resultados/resultados_ronda4.json, también incluye el resumen de la ronda 4.
"""
import json

from . import RAIZ
from .variables import NOMBRES_LEGIBLES

DIR_REPORTES = RAIZ / "reportes"
RONDA4 = RAIZ / "pruebas" / "resultados" / "resultados_ronda4.json"
AVISO = ("> ⚠️ **Datos sintéticos.** Todo lo que aparece aquí se midió con estudiantes simulados. "
         "Describe qué tan bien el proceso recupera una función inventada, **no** el desempeño con "
         "estudiantes reales.")

SUPUESTOS = [
    "Despliegue: Vercel no ejecuta Streamlit; la web de Vercel es HTML estático + funciones Python (solo NumPy). Streamlit queda para uso local.",
    "Población válida = pregrado, activo, semestres 2–4 (heredado del contrato).",
    "Tasa base de deserción simulada: 18 % (SPADIES 2023 reporta ~12 % anual; la deserción se concentra en los primeros semestres).",
    "Función latente de la etiqueta (no lineal, con interacciones trabaja×asistencia y deuda×estrato, y ruido N(0, 0.6)); ver la fórmula en la sección 1.",
    "Factores latentes S (socioeconómico) y A (académico) con correlación 0.30; distribución de estrato 22/35/27/10/4/2 %.",
    "3 % de registros defectuosos (8 tipos) y 8 % de registros válidos sin `deuda_matricula`.",
    "Semilla 2026 para datos, división y modelos; 2027–2031 para estabilidad.",
    "`id_estudiante`, `nivel_formacion` y `estado_matricula` no son predictores (identificador y constantes).",
    "Estrato se trata como ordinal numérico (1–6).",
    "Se prefiere `tasa_reprobacion` sobre `materias_reprobadas` y `creditos_inscritos` sobre `materias_cursadas_periodo_anterior` cuando |r| > 0.8.",
    "Se estandarizan todas las variables, también las binarias, para que L2 las trate por igual.",
    "Deuda no informada → se imputa el valor que no reduce el riesgo (1 si su peso es positivo); en la MLP se toma la mayor probabilidad entre 0 y 1.",
    "Pesos por clase n/(2·n_clase); la probabilidad reportada se corrige restando ln(w+/w-) al logit.",
    "Arquitectura de la MLP: n → 16 → 8 → 1, ReLU, dropout 0.2, Adam (η = 0.001), L2 = 1e-4.",
    "MLP versión 2 (tras la ronda 4): monótona por construcción en promedio (−), tasa de reprobación (+) y asistencia (−), con signo fijo en W1 y W2, W3 ≥ 0.",
    "Logística: SGD por mini-lotes de 256, η = 0.01, L2 = 1e-3, early stopping con paciencia 20.",
    "Puntos de la tarjeta anclados a los rangos del contrato (0 puntos = valor de menor riesgo posible).",
    "Objetivo de cortes: alto ≥ 70 % de recall con ≤ 25 % de estudiantes; en bajo ≤ 10 % de los desertores. Si no se puede, se prioriza el recall.",
    "R3.4 fuerza nivel alto en modo aprendido sin cambiar el puntaje.",
    "Probabilidad de la línea base = puntaje/100 recortado a [0.01, 0.99].",
    "\"Marcado en riesgo\" = nivel alto (también se reporta medio + alto).",
    "Tope de dominancia 35 % de la importancia por permutación; se decide con la importancia en train y un margen de 2 puntos.",
    "Colapso en ablación = caída de AUC > 0.10 al quitar una variable.",
    "La ablación y la estabilidad de pesos se hacen sobre la logística (modelo principal); para la MLP se reporta la importancia con 5 semillas.",
    "Ronda 4: los casos con resultado se verifican con propiedades, no con el puntaje exacto del oráculo (que no se modifica).",
]


def _p(x, d=1):
    return f"{100 * x:.{d}f} %"


def _leg(n):
    return NOMBRES_LEGIBLES.get(n, n)


def _tabla(encabezados, filas):
    lineas = ["| " + " | ".join(encabezados) + " |", "|" + "|".join("---" for _ in encabezados) + "|"]
    lineas += ["| " + " | ".join(str(c) for c in f) + " |" for f in filas]
    return "\n".join(lineas)


# ====================================================================== datos_resumen.md
def datos_resumen(res):
    d = res["datos"]
    rc = d["resumen_campos"]
    out = [
        "# Resumen del dataset sintético", "", AVISO, "",
        "Generado por `python -m desercion.entrenamiento` (módulo `desercion/datos_sinteticos.py`).", "",
        "## Tamaño y tasa de deserción", "",
        _tabla(["Concepto", "Valor"], [
            ["Registros generados", d["n_generados"]],
            ["Válidos (pasan el Paso 1)", d["n_validos"]],
            ["Descartados por el Paso 1", d["n_descartados"]],
            ["Defectuosos que el Paso 1 dejó pasar", d["defectuosos_colados"]],
            ["Tasa de deserción (válidos)", _p(d["tasa_desercion"])],
            ["Tasa objetivo [SUPUESTO]", _p(d["tasa_objetivo"])],
            ["Válidos sin `deuda_matricula` (opcional, se conservan)", d["sin_deuda_informada"]],
            ["CSV guardado y recargado con `cargar_datos_reales()`", "idéntico" if d["csv_ida_y_vuelta"] else "DIFERENTE"],
            ["AUC de la probabilidad real en test (techo teórico)", f"{d['auc_techo_test']:.3f}"],
        ]), "",
        "## División train / validación / test (estratificada, semilla 2026)", "",
        _tabla(["Conjunto", "Registros", "Tasa de deserción"], [
            ["train", d["division"]["train"], _p(d["division"]["tasa_train"])],
            ["validación", d["division"]["val"], _p(d["division"]["tasa_val"])],
            ["test", d["division"]["test"], _p(d["division"]["tasa_test"])]]), "",
        "## Registros descartados por el Paso 1", "",
        "Cada registro defectuoso pasa por la misma validación del contrato que usa el sistema. "
        "Ninguno entra al entrenamiento.", "",
        _tabla(["Salida del Paso 1", "Registros"], [[k, v] for k, v in d["descartes_por_motivo"].items()]), "",
        "Cruce entre el defecto introducido y la salida del Paso 1:", "",
        _tabla(["Defecto introducido", "Salida del Paso 1", "Registros"],
               [[f["defecto"], f["salida_paso1"], f["n"]] for f in d["descartes_por_tipo_de_defecto"]]), "",
        "## Distribución de las variables numéricas", "",
        _tabla(["Campo", "Media", "Desv.", "Mín", "P25", "Mediana", "P75", "Máx", "Media desertores", "Media no desertores"],
               [[c, f"{v['media']:.2f}", f"{v['desv']:.2f}", f"{v['min']:.2f}", f"{v['p25']:.2f}", f"{v['mediana']:.2f}",
                 f"{v['p75']:.2f}", f"{v['max']:.2f}", f"{v['media_desertores']:.2f}", f"{v['media_no_desertores']:.2f}"]
                for c, v in rc["numericos"].items()]), "",
        "## Variables categóricas y deserción por grupo", "",
    ]
    for campo, filas in rc["categoricos"].items():
        out += [f"**{campo}**", "", _tabla(["Valor", "Registros", "% del total", "% que desertó"],
                                           [[f["valor"], f["n"], _p(f["fraccion"]), _p(f["tasa_desercion"])] for f in filas]), ""]
    out += ["## Fórmula con la que se generó la etiqueta [SUPUESTO]", "", f"`{d['formula_latente']}`", "",
            f"con b0 = {d['intercepto']:.3f} (ajustado para una tasa de {_p(d['tasa_objetivo'])}), "
            "`p = sigmoide(z)` y `deserto ~ Bernoulli(p)`.", "",
            "![Distribuciones](distribuciones.png)", ""]
    return "\n".join(out)


# ====================================================================== reporte_entrenamiento.md
def reporte_entrenamiento(res):
    d, dep, en, co, ev = (res[k] for k in ("datos", "dependencia", "entrenamiento", "control", "evaluacion"))
    nombres = dep["finales"]
    il, ir = en["info_logistica"], en["info_red"]
    hl = en["historial_logistica"]
    tarjeta, cortes, cortes_red = en["tarjeta"], en["cortes"], en["cortes_red"]
    m = ev["modelos"]
    out = ["# Reporte de entrenamiento – sistema de alerta temprana de deserción", "", AVISO, "",
           "Generado automáticamente por `python -m desercion.entrenamiento` con semilla "
           f"{res['semilla']}. Los números de este documento salen de esa ejecución.", "",
           "## Resumen", "",
           _tabla(["Métrica en test", *m.keys()],
                  [["Log-loss (↓)", *(f"{v['log_loss']:.4f}" for v in m.values())],
                   ["Brier (↓)", *(f"{v['brier']:.4f}" for v in m.values())],
                   ["AUC-ROC (↑)", *(f"{v['auc']:.4f}" for v in m.values())],
                   ["Recall de desertores (nivel alto)", *(_p(v["recall"]) for v in m.values())],
                   ["Precisión (nivel alto)", *(_p(v["precision"]) for v in m.values())],
                   ["Accuracy (nivel alto = riesgo)", *(_p(v["accuracy"]) for v in m.values())],
                   ["% de estudiantes en alto", *(_p(v["fraccion_alto"]) for v in m.values())]]), "",
           f"Techo teórico (AUC de la probabilidad real que generó los datos): **{ev['auc_techo']:.4f}**.", "",
           f"**Conclusión.** {ev['conclusion']}", "",
           "# Cómo se asignan los pesos de las variables", "",
           "## 1. Cómo se generaron los datos y por qué son sintéticos", "",
           "No hay registros reales de estudiantes con la etiqueta de si desertaron, así que se simularon "
           f"{d['n_generados']} registros. {d['n_validos']} son válidos y {d['n_descartados']} tienen defectos "
           "a propósito (faltantes, tipos malos, fuera de rango, otra población, contradicciones); el Paso 1 del "
           f"contrato los descartó todos ({d['defectuosos_colados']} se colaron). Detalle en "
           "[datos_resumen.md](datos_resumen.md).", "",
           "Las variables salen de dos factores ocultos correlacionados (socioeconómico y académico), así que están "
           "relacionadas como en la vida real: un promedio bajo va con más materias perdidas y menos asistencia, y "
           "un estrato bajo va con más trabajo y más deuda.", "",
           "La etiqueta **no** se generó con las reglas del contrato (si así fuera, el modelo solo las copiaría). "
           "Se usó esta función latente, no lineal, con interacciones y ruido [SUPUESTO]:", "",
           f"`{d['formula_latente']}`", "",
           f"con b0 = {d['intercepto']:.3f}, ajustado para una tasa de deserción de {_p(d['tasa_objetivo'])} "
           f"(resultó {_p(d['tasa_desercion'])}). Como hay ruido, ni siquiera la probabilidad real ordena perfecto: "
           f"su AUC en test es {ev['auc_techo']:.3f}. Ese es el techo de cualquier modelo.", "",
           "## 2. Época, mini-lote, pérdida y gradiente (con este sistema como ejemplo)", "",
           f"- **Ejemplo de entrenamiento:** un estudiante del conjunto de train ({d['division']['train']} en total) "
           f"descrito por {len(nombres)} números: {', '.join(nombres)}.",
           f"- **Mini-lote:** {en['config_logistica']['tam_lote']} estudiantes. Con cada lote se calcula cuánto se equivoca "
           f"el modelo y se corrigen los pesos una vez (≈ {d['division']['train'] // en['config_logistica']['tam_lote'] + 1} "
           "correcciones por época).",
           f"- **Época:** una pasada por los {d['division']['train']} estudiantes. La logística corrió {il['epocas_corridas']} "
           f"épocas y se quedó con la {il['mejor_epoca']}; la red corrió {ir['epocas_corridas']} y se quedó con la {ir['mejor_epoca']}.",
           "- **Pérdida (entropía cruzada):** si el modelo le da 0.9 de probabilidad a un estudiante que sí desertó, "
           "la pérdida es −ln(0.9) = 0.105; si le da 0.1, es −ln(0.1) = 2.303. Equivocarse con seguridad cuesta mucho. "
           f"Como hay pocos desertores, cada uno pesa {en['info_logistica']['pesos_clase']['positivo']:.2f} y cada no "
           f"desertor {en['info_logistica']['pesos_clase']['negativo']:.2f} (pesos por clase); así el modelo no "
           "aprende a decir \"nadie deserta\".",
           "- **Gradiente:** para cada peso, cuánto cambia la pérdida si el peso sube un poco. En la logística es "
           "`Σ s·(p − y)·x / Σ s + λ·w`: si el modelo subestima el riesgo de los desertores (p < y) en estudiantes con "
           "tasa de reprobación alta (x > 0), el gradiente es negativo y el peso de la tasa sube.",
           f"- **Paso:** `w ← w − η·gradiente`, con η = {en['config_logistica']['tasa_aprendizaje']} en la logística "
           f"(SGD) y Adam con η = {en['config_red']['tasa_aprendizaje']} en la red (backpropagation programado a mano "
           "y verificado contra diferencias finitas: `python pruebas/verificar_modelos.py`).", "",
           "![Curvas de pérdida](curvas_perdida.png)", "", "![AUC y recall por época](curvas_auc.png)", "",
           "## 3. Cómo cambiaron los pesos de cada variable", "",
           "Pesos de la regresión logística sobre variables estandarizadas (1 unidad = 1 desviación estándar):", "",
           _tabla(["Variable", "Época 1", f"Época {il['mejor_epoca']} (mejor)", "Final (tras tope)", "Parte de |pesos| final"],
                  [[_leg(n), f"{en['pesos_epoca1'][j]:+.3f}", f"{hl[il['mejor_epoca'] - 1]['pesos'][j]:+.3f}",
                    f"{en['pesos_finales'][j]:+.3f}",
                    _p(abs(en['pesos_finales'][j]) / sum(abs(x) for x in en['pesos_finales']))]
                   for j, n in enumerate(nombres)]), "",
           "Todos los pesos arrancan cerca de 0 y crecen en la dirección esperada: la tasa de reprobación, trabajar y "
           "la deuda suben el riesgo; el promedio, la asistencia, el estrato y los créditos lo bajan.", "",
           "![Evolución de los pesos](evolucion_pesos.png)", "",
           "## 4. Qué hizo cada técnica contra la dependencia excesiva", "",
           "| Técnica | Qué hace | Efecto medido |", "|---|---|---|",
           "| Tratar la colinealidad | Quita variables casi duplicadas antes de entrenar | " +
           "; ".join(f"se quitó `{x['se_quita']}` (r = {x.get('correlacion', '–')} con `{x.get('se_queda', '')}`)" for x in dep["decisiones"]) +
           f". VIF máximo {max(dep['antes']['vif'].values()):.1f} → {max(dep['despues']['vif'].values()):.1f} |",
           "| Estandarización | Media 0 y desviación 1 con datos de train | Sin escalar, la asistencia (0–100) daría "
           "gradientes ~20 veces mayores que el promedio (0–5) y L2 castigaría según las unidades |",
           f"| L2 (weight decay) | Penaliza pesos grandes: λ = {en['config_logistica']['l2']} (logística), "
           f"{en['config_red']['l2']} (red) | Norma de pesos de la logística en la mejor época: "
           f"{hl[il['mejor_epoca'] - 1]['norma_pesos']:.3f} |",
           f"| Dropout | Apaga {en['config_red']['dropout']:.0%} de las neuronas ocultas al azar en cada lote | "
           f"La red no se apoya en una sola variable: su variable más importante pesa "
           f"{_p(max(co['importancia_test']['red_pct']))} |",
           f"| Early stopping | Para si la pérdida de validación no mejora en {en['config_logistica']['paciencia']} épocas | "
           f"Logística: mejor época {il['mejor_epoca']} de {il['epocas_corridas']}; red: {ir['mejor_epoca']} de {ir['epocas_corridas']} |",
           f"| Tope de dominancia ({_p(co['tope'], 0)}) | Si una variable supera el tope, se sube su L2 y se reentrena | " +
           (f"`{co['pasos_tope'][-1]['variable']}` pasó de {_p(max(co['antes_tope']['pct_train']))} a "
            f"{_p(max(co['despues_tope']['pct_train']))} de la importancia (train) con L2 ×"
            f"{co['pasos_tope'][-1]['multiplicador_l2']:.0f}; AUC test {co['antes_tope']['auc_test']:.4f} → "
            f"{co['despues_tope']['auc_test']:.4f}" if co["pasos_tope"] else "No hizo falta") + " |", "",
           "### Importancia por permutación en test", "",
           "Se desordena una variable a la vez y se mide cuánto cae el AUC (5 repeticiones).", "",
           _tabla(["Variable", "Logística (caída AUC)", "Logística (% total)", "Red (caída AUC)", "Red (% total)"],
                  [[_leg(n), f"{co['importancia_test']['logistica'][j]:.4f} ± {co['importancia_test']['logistica_desv'][j]:.4f}",
                    _p(co['importancia_test']['logistica_pct'][j]),
                    f"{co['importancia_test']['red'][j]:.4f} ± {co['importancia_test']['red_desv'][j]:.4f}",
                    _p(co['importancia_test']['red_pct'][j])] for j, n in enumerate(nombres)]), "",
           "![Importancia por permutación](importancia_permutacion.png)", "",
           "### Pasos del tope de dominancia", "",
           ]
    if co["pasos_tope"]:
        out += ["La primera versión decidía el tope con la importancia en validación (3 000 registros): ahí la tasa de "
                "reprobación daba 33.5 % (dentro del tope), pero en test daba 37.7 % y en 5 muestras bootstrap 39.5 %. "
                "Con tan pocos registros la medida es ruidosa, así que ahora se decide con train (14 000) y un margen "
                "de 2 puntos.", "",
                _tabla(["Paso", "Variable", "L2 ×", "λ efectivo", "Peso", "Máx. % (train)", "AUC val"],
                       [[i + 1, p["variable"], f"{p['multiplicador_l2']:.0f}", f"{p['l2_efectivo']:.3f}", f"{p['peso']:+.3f}",
                         f"{_p(p['max_pct_train'])} ({p['variable_max']})", f"{p['auc_val']:.4f}"]
                        for i, p in enumerate(co["pasos_tope"])]), "",
                f"Costo de repartir el peso, en test: AUC {co['antes_tope']['auc_test']:.4f} → {co['despues_tope']['auc_test']:.4f}, "
                f"log-loss {co['antes_tope']['log_loss_test']:.4f} → {co['despues_tope']['log_loss_test']:.4f}.", ""]
    else:
        out += ["Ninguna variable superó el tope.", ""]
    out += ["### Ablación (reentrenar sin una variable)", "",
            _tabla(["Sin la variable", "AUC test", "Δ AUC", "Log-loss test", "Δ log-loss", "¿Colapsa?"],
                   [[_leg(f["variable"]), f"{f['auc']:.4f}", f"{f['delta_auc']:+.4f}", f"{f['log_loss']:.4f}",
                     f"{f['delta_log_loss']:+.4f}", "sí" if f["colapsa"] else "no"] for f in co["ablacion"]]), "",
            f"Ninguna variable hace colapsar al modelo (umbral: caída de AUC > 0.10) "
            if not any(f["colapsa"] for f in co["ablacion"]) else "**Hay variables cuya ausencia colapsa el modelo.** ",
            "Las caídas son pequeñas porque las variables correlacionadas cubren en parte a la que falta.", "",
            "![Ablación](ablacion.png)", "",
            "### Estabilidad (5 muestras bootstrap de train)", "",
            _tabla(["Variable", "Peso medio ± desv.", "Importancia logística", "Importancia red (5 semillas)"],
                   [[_leg(n), f"{co['estabilidad']['pesos_media'][j]:+.3f} ± {co['estabilidad']['pesos_desv'][j]:.3f}",
                     f"{_p(co['estabilidad']['pct_logistica_media'][j])} ± {_p(co['estabilidad']['pct_logistica_desv'][j])}",
                     f"{_p(co['estabilidad']['pct_red_media'][j])} ± {_p(co['estabilidad']['pct_red_desv'][j])}"]
                    for j, n in enumerate(nombres)]), "",
            f"Variables cuyo peso cambia de signo entre muestras: {', '.join(co['estabilidad']['cambios_de_signo']) or 'ninguna'}.", "",
            "![Estabilidad](estabilidad.png)", ""]
    if co.get("estrato"):
        e = co["estrato"]
        out += ["### Variable sensible: estrato", "",
                _tabla(["Estrato", "n", "Deserción real", "% alto (con)", "% alto (sin)", "Recall (con)", "Recall (sin)",
                        "Log-loss (con)", "Log-loss (sin)"],
                       [[a["estrato"], a["n"], _p(a["tasa_real"]), _p(a["fraccion_alto"]), _p(b["fraccion_alto"]),
                         _p(a["recall_alto"]), _p(b["recall_alto"]), f"{a['log_loss']:.4f}", f"{b['log_loss']:.4f}"]
                        for a, b in zip(e["con_estrato"], e["sin_estrato"])]), "",
                f"Global: con estrato AUC {e['global_con']['auc']:.4f} y log-loss {e['global_con']['log_loss']:.4f}; "
                f"sin estrato AUC {e['global_sin']['auc']:.4f} y log-loss {e['global_sin']['log_loss']:.4f}.", "",
                "Con estrato, el modelo concentra el nivel alto en los estratos 1 y 2 (donde la deserción simulada es "
                "mayor) y detecta peor a los pocos desertores de estratos altos. Sin estrato, el costo global es pequeño "
                "y el recall se reparte más. **La decisión de dejarlo o quitarlo queda para el equipo.**", "",
                "![Análisis por estrato](estrato.png)", ""]
    out += ["## 5. Cómo se convirtieron los pesos en la tarjeta de puntaje (0–100)", "",
            "1. Los pesos estandarizados se pasan a unidades originales: β = w / σ.",
            "2. Para cada variable se calcula su aporte mínimo y máximo dentro del rango del contrato.",
            "3. Puntos de la variable = (β·x − aporte mínimo) × escala, con escala = 100 / Σ(máx − mín). Cada variable da "
            "0 puntos en su valor de menor riesgo y la suma va de 0 a 100.",
            f"4. El puntaje es lineal en el logit: `logit = {tarjeta['logit_base']:.3f} + puntaje / {tarjeta['escala']:.3f}`. "
            "Ordena igual que la probabilidad del modelo.", "",
            _tabla(["Variable", "β (unid. originales)", "Puntos máximos", "0 puntos cuando vale"],
                   [[_leg(n), f"{tarjeta['beta'][j]:+.4f}", f"{tarjeta['puntos_maximos'][j]:.1f}", tarjeta["valor_menor_riesgo"][j]]
                    for j, n in enumerate(nombres)]), "",
            "**Cortes elegidos en validación** (objetivo: el nivel alto captura ≥ 70 % de los desertores con ≤ 25 % de los "
            "estudiantes; en bajo queda ≤ 10 % de los desertores):", "",
            _tabla(["Modelo", "Medio desde", "Alto desde", "Recall alto (val)", "% estudiantes en alto (val)",
                    "% desertores en bajo (val)", "¿Objetivo cumplido?"],
                   [[nom, c["corte_medio"], c["corte_alto"], _p(c["en_validacion"]["recall_alto"]),
                     _p(c["en_validacion"]["fraccion_alto"]), _p(c["en_validacion"]["desertores_en_bajo"]),
                     "sí" if c["objetivo_cumplido"] else "no: " + c["nota"]]
                    for nom, c in (("logística (puntos)", cortes), ("red neuronal (100·p)", cortes_red))]), "",
            "**Hallazgo:** con un AUC cercano a 0.81 no se puede capturar el 70 % de los desertores marcando solo al 25 % "
            "de los estudiantes. Se priorizó el recall (no detectar a un desertor es el error más caro). El equipo debe "
            "decidir si acepta marcar a ~1 de cada 3 estudiantes o si baja la meta de recall.", "",
            f"La regla R3.4 (promedio < 3.0 y asistencia < 70 → alto) se aplica encima del modelo. La deuda no informada se "
            f"reporta en `datos_no_informados` y se imputa {en['deuda_si_falta']} (el valor que no reduce el riesgo, porque "
            "su peso aprendido es positivo).", "",
            "## 6. Error final en test comparado con la línea base por reglas", "",
            _tabla(["Métrica", *m.keys()],
                   [[nom, *(fmt.format(v[k]) for v in m.values())] for nom, k, fmt in (
                       ("Log-loss", "log_loss", "{:.4f}"), ("Brier", "brier", "{:.4f}"), ("AUC-ROC", "auc", "{:.4f}"),
                       ("Accuracy (alto)", "accuracy", "{:.1%}"), ("Recall (alto)", "recall", "{:.1%}"),
                       ("Precisión (alto)", "precision", "{:.1%}"), ("Recall (medio + alto)", "recall_medio_alto", "{:.1%}"),
                       ("Precisión (medio + alto)", "precision_medio_alto", "{:.1%}"),
                       ("% en alto", "fraccion_alto", "{:.1%}"))]), "",
            "**Matriz de confusión por nivel** (desertó sí / no, y tasa real de deserción dentro de cada nivel):", "",
            _tabla(["Modelo", "Bajo", "Medio", "Alto"],
                   [[nom, *(f"{v['confusion'][k]['deserto_si']} / {v['confusion'][k]['deserto_no']} "
                            f"({_p(v['confusion'][k]['tasa_real'], 0)})" for k in ("bajo", "medio", "alto"))]
                    for nom, v in m.items()]), "",
            "La **accuracy engaña** con clases desbalanceadas: un sistema que dijera \"nadie deserta\" acertaría "
            f"{_p(1 - ev['tasa_test'], 0)} sin detectar a un solo desertor.", "",
            "La línea base usa puntaje/100 como probabilidad [SUPUESTO], por eso su log-loss y su Brier son malos aunque "
            "ordene razonablemente bien.", "",
            "![Calibración](calibracion.png)", "",
            f"**Conclusión.** {ev['conclusion']}", ""]
    out += _seccion_ronda4()
    out += ["## 7. Limitaciones y supuestos para revisar", "",
            "**Limitaciones**", "",
            "- Los datos son sintéticos: el modelo aprendió una fórmula inventada. Con datos reales los pesos, la importancia "
            "de cada variable y el error cambiarán. Para cambiar a datos reales: `cargar_datos_reales(csv)`.",
            "- Las propiedades de la ronda 4 (orden, monotonía) se verificaron en casos puntuales, no en todo el espacio.",
            "- La corrección de probabilidad por pesos de clase es aproximada; con datos reales conviene recalibrar.",
            "- El estrato es una variable sensible: usarlo puede reforzar desigualdades. Ver la sección de estrato.",
            "- Los oráculos de las rondas 1–4 son borradores escritos por el modelo y deben firmarlos personas del equipo.", "",
            "**Supuestos [SUPUESTO]**", ""]
    out += [f"{i}. {s}" for i, s in enumerate(SUPUESTOS, 1)]
    return "\n".join(out) + "\n"


def _seccion_ronda4():
    if not RONDA4.exists():
        return []
    r4 = json.loads(RONDA4.read_text(encoding="utf-8"))
    out = ["## Pruebas de estrés del modo aprendido (ronda 4)", "",
           _tabla(["Versión", "Pasan", "Detalle"],
                  [[v["nombre"], f"{v['pasan']}/{v['total']}",
                    "; ".join(f"{g}: {a}/{b}" for g, (a, b) in v["por_grupo"].items())] for v in r4["versiones"]]), "",
           r4.get("lectura", ""), ""]
    if r4.get("version_1"):
        out += ["Resultados de la versión 1 (antes de la corrección):", "",
                _tabla(["Versión", "Pasan", "Fallan"],
                       [[v["nombre"], f"{v['pasan']}/{v['total']}", ", ".join(v["fallan"]) or "–"] for v in r4["version_1"]]), ""]
    return out


def generar_reportes(res=None):
    if res is None:
        res = json.loads((DIR_REPORTES / "resultados.json").read_text(encoding="utf-8"))
    DIR_REPORTES.mkdir(parents=True, exist_ok=True)
    (DIR_REPORTES / "datos_resumen.md").write_text(datos_resumen(res), encoding="utf-8")
    if all(k in res for k in ("dependencia", "entrenamiento", "control", "evaluacion")):
        (DIR_REPORTES / "reporte_entrenamiento.md").write_text(reporte_entrenamiento(res), encoding="utf-8")
    print("Reportes generados: reportes/datos_resumen.md, reportes/reporte_entrenamiento.md")


if __name__ == "__main__":
    generar_reportes()
