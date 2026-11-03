"""App local en Streamlit (Vercel no puede ejecutarla; allí está la web de public/).

    streamlit run app.py

Secciones: Inicio · Evaluar estudiante · Datos · Entrenamiento · Variables · Pruebas.
Todos los números salen de reportes/resultados.json (generado por el entrenamiento).
"""
import json
from pathlib import Path

import pandas as pd
import streamlit as st

from desercion.contrato import ESQUEMA
from desercion.web import responder_evaluar, responder_rondas

RAIZ = Path(__file__).resolve().parent
REPORTES = RAIZ / "reportes"
AVISO = "**Datos sintéticos.** Todo se entrenó y midió con estudiantes simulados: no representa el desempeño real."
ETIQUETAS = {
    "id_estudiante": "Identificador", "nivel_formacion": "Nivel de formación", "estado_matricula": "Estado de matrícula",
    "semestre": "Semestre", "promedio_acumulado": "Promedio acumulado", "creditos_inscritos": "Créditos inscritos",
    "materias_cursadas_periodo_anterior": "Materias cursadas (periodo anterior)", "materias_reprobadas": "Materias reprobadas",
    "porcentaje_asistencia": "Asistencia (%)", "estrato": "Estrato", "trabaja": "¿Trabaja?", "deuda_matricula": "¿Deuda de matrícula?",
}
EJEMPLO = {"id_estudiante": "EJEMPLO-001", "nivel_formacion": "pregrado", "estado_matricula": "activo", "semestre": 3,
           "promedio_acumulado": 3.1, "creditos_inscritos": 15, "materias_cursadas_periodo_anterior": 6,
           "materias_reprobadas": 2, "porcentaje_asistencia": 76.5, "estrato": 2, "trabaja": True, "deuda_matricula": False}
MOTIVOS = {"campo_faltante": "falta un dato obligatorio", "datos_contradictorios": "los datos se contradicen",
           "fuera_de_poblacion": "el estudiante no pertenece a la población (pregrado, activo, semestres 2–4)",
           "tipo_invalido": "un dato tiene el tipo equivocado", "fuera_de_rango": "un dato está fuera del rango permitido",
           "valor_no_permitido": "un dato no está en la lista de valores permitidos", "error_interno": "imprevisto interno"}

st.set_page_config(page_title="Alerta temprana de deserción", layout="wide")


@st.cache_data
def resultados():
    ruta = REPORTES / "resultados.json"
    return json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else None


def imagen(nombre, pie):
    ruta = REPORTES / nombre
    if ruta.exists():
        st.image(str(ruta), caption=pie, width="stretch")


def pct(x):
    return f"{100 * x:.1f} %"


# ====================================================================== secciones
def inicio(r):
    st.title("Alerta temprana de deserción universitaria")
    st.write("Recibe el registro de un estudiante de pregrado activo (semestres 2 a 4) y devuelve su **nivel de riesgo** "
             "(bajo, medio o alto) con una acción recomendada, un **error controlado** si los datos están mal, o una "
             "**abstención** que remite el caso a una persona. Dos modos: `reglas` (pesos fijos, línea base) y "
             "`aprendido` (pesos entrenados desde cero en NumPy).")
    st.warning(AVISO)
    if r:
        m = r["evaluacion"]["modelos"]["regresión logística"]
        c = st.columns(4)
        c[0].metric("Estudiantes simulados", f"{r['datos']['n_validos']:,}".replace(",", "."))
        c[1].metric("Tasa de deserción simulada", pct(r["datos"]["tasa_desercion"]))
        c[2].metric("AUC logística (test)", f"{m['auc']:.3f}")
        c[3].metric("Recall desertores (alto)", pct(m["recall"]))


def evaluar_estudiante():
    st.header("Evaluar estudiante")
    modo = st.radio("Modo", ["reglas", "aprendido – logística", "aprendido – red neuronal"], horizontal=True, index=1)
    if st.button("Cargar ejemplo"):
        for k, v in EJEMPLO.items():
            st.session_state[f"f_{k}"] = v if not isinstance(v, bool) else ("sí" if v else "no")
    entrada = {}
    cols = st.columns(3)
    for i, (campo, (tipo, regla, oblig)) in enumerate(ESQUEMA.items()):
        with cols[i % 3]:
            clave, et = f"f_{campo}", ETIQUETAS[campo] + ("" if oblig else " (opcional)")
            if tipo == "str":
                v = st.text_input(et, key=clave) or None
            elif tipo == "enum":
                v = st.selectbox(et, [None, *sorted(regla)], key=clave, format_func=lambda x: "— sin dato —" if x is None else x)
            elif tipo == "bool":
                v = {"sí": True, "no": False}.get(st.selectbox(et, ["— sin dato —" if oblig else "no informado", "sí", "no"], key=clave))
            else:
                paso = 0.01 if campo == "promedio_acumulado" else 0.1 if tipo == "num" else 1
                v = st.number_input(f"{et} [{regla[0]}–{regla[1]}]", value=None, step=paso, key=clave,
                                    format="%.2f" if tipo == "num" else "%d")
                if v is not None and tipo == "int":
                    v = int(v)
            if v is not None:
                entrada[campo] = v
    with st.expander("Enviar una entrada JSON libre (para probar tipos raros, como \"3\" en vez de 3)"):
        texto = st.text_area("JSON", value="")
        if texto.strip():
            try:
                entrada = json.loads(texto)
            except ValueError:
                st.error("JSON inválido.")
    opciones = {"modo": "reglas"} if modo == "reglas" else {
        "modo": "aprendido", "modelo": "logistica" if "logística" in modo else "red_neuronal"}
    _, s = responder_evaluar({"entrada": entrada, **opciones})
    st.divider()
    if s["decision"] == "resultado":
        (st.error if s["en_riesgo"] else st.success)(
            f"**{'Se considera en riesgo de desertar' if s['en_riesgo'] else 'No se considera en riesgo'}** · "
            f"nivel **{s['nivel']}** · puntaje **{s['puntaje']}**/100 · acción: {s['accion']}")
        if s.get("probabilidad") is not None:
            st.write(f"Probabilidad estimada: {pct(s['probabilidad'])}")
        if s.get("regla_r34"):
            st.info("R3.4: promedio < 3.0 y asistencia < 70 → el nivel se fuerza a alto.")
        if s["datos_no_informados"]:
            st.info(f"No informado: {', '.join(s['datos_no_informados'])} (no se inventa; se usa el valor que no baja el riesgo).")
        st.subheader("Factores y puntos")
        st.write(", ".join(s["factores"]) or "ninguno")
        st.bar_chart(pd.Series(s["puntos_por_variable"], name="puntos").sort_values())
    elif s["decision"] == "abstener":
        st.info(f"**Remitido a revisión humana:** {MOTIVOS.get(s['motivo'], s['motivo'])}"
                + (f" ({', '.join(s['campos'])})" if s.get("campos") else ""))
    else:
        st.error(f"**Error:** {MOTIVOS.get(s['motivo'], s['motivo'])}" + (f" (campo: {s['campo']})" if s.get("campo") else ""))
    with st.expander("Salida completa"):
        st.json(s)


def datos(r):
    st.header("Datos (sintéticos)")
    st.warning(AVISO)
    d = r["datos"]
    c = st.columns(4)
    c[0].metric("Generados", d["n_generados"]); c[1].metric("Válidos", d["n_validos"])
    c[2].metric("Descartados por el Paso 1", d["n_descartados"]); c[3].metric("Tasa de deserción", pct(d["tasa_desercion"]))
    st.subheader("Registros descartados por el Paso 1")
    st.dataframe(pd.DataFrame(d["descartes_por_tipo_de_defecto"]), width="stretch")
    st.subheader("Fórmula de la etiqueta [SUPUESTO]")
    st.code(d["formula_latente"])
    imagen("distribuciones.png", "Distribuciones por si el estudiante desertó")
    with st.expander("Resumen completo (datos_resumen.md)"):
        st.markdown((REPORTES / "datos_resumen.md").read_text(encoding="utf-8").replace("![Distribuciones](distribuciones.png)", ""))


def entrenamiento(r):
    st.header("Entrenamiento")
    e = r["entrenamiento"]
    st.write(f"Logística: {e['info_logistica']['epocas_corridas']} épocas, mejor la {e['info_logistica']['mejor_epoca']}. "
             f"Red neuronal: {e['info_red']['epocas_corridas']} épocas, mejor la {e['info_red']['mejor_epoca']}.")
    hist = pd.DataFrame(e["historial_logistica"]).set_index("epoca")
    st.line_chart(hist[["perdida_train", "perdida_val"]])
    imagen("curvas_perdida.png", "Pérdida por época")
    imagen("curvas_auc.png", "AUC y recall en validación por época")
    imagen("evolucion_pesos.png", "Evolución de los pesos de la logística (antes del tope de dominancia)")
    st.subheader("Tarjeta de puntaje")
    t = e["tarjeta"]
    st.dataframe(pd.DataFrame({"variable": t["variables"], "β": t["beta"], "puntos máximos": t["puntos_maximos"],
                               "0 puntos cuando vale": t["valor_menor_riesgo"]}), width="stretch")
    st.write(f"Cortes (validación): medio ≥ {e['cortes']['corte_medio']}, alto ≥ {e['cortes']['corte_alto']}. {e['cortes']['nota']}")
    st.subheader("Evaluación final en test")
    st.dataframe(pd.DataFrame({k: {m: v[m] for m in ("log_loss", "brier", "auc", "accuracy", "recall", "precision", "fraccion_alto")}
                               for k, v in r["evaluacion"]["modelos"].items()}), width="stretch")
    st.write(r["evaluacion"]["conclusion"])
    imagen("calibracion.png", "Curva de calibración")


def variables(r):
    st.header("Variables")
    dep, co = r["dependencia"], r["control"]
    st.dataframe(pd.DataFrame({"VIF antes": dep["antes"]["vif"], "VIF después": dep["despues"]["vif"]}), width="stretch")
    for x in dep["decisiones"]:
        st.write(f"- Se quitó **{x['se_quita']}**: {x['motivo']}")
    imagen("correlacion_antes.png", "Correlaciones antes")
    imagen("vif.png", "VIF antes y después")
    imagen("importancia_permutacion.png", "Importancia por permutación (línea del tope del 35 %)")
    if co["pasos_tope"]:
        st.dataframe(pd.DataFrame(co["pasos_tope"]), width="stretch")
    st.subheader("Ablación")
    st.dataframe(pd.DataFrame(co["ablacion"]), width="stretch")
    imagen("ablacion.png", "Ablación")
    imagen("estabilidad.png", "Estabilidad")
    if co.get("estrato"):
        st.subheader("Estrato (variable sensible)")
        st.dataframe(pd.DataFrame(co["estrato"]["con_estrato"]).set_index("estrato").add_suffix(" (con)")
                     .join(pd.DataFrame(co["estrato"]["sin_estrato"]).set_index("estrato").add_suffix(" (sin)")), width="stretch")
        imagen("estrato.png", "Análisis por estrato")


def pruebas():
    st.header("Pruebas")
    st.write("Corre las rondas 1–3 (35 casos, modo reglas) y la ronda 4 (modo aprendido) y muestra PASA/FALLA.")
    if st.button("Correr las rondas"):
        with st.spinner("Corriendo…"):
            _, d = responder_rondas()
        if "error" in d:
            st.error(d["detalle"]); return
        import sys
        sys.path.insert(0, str(RAIZ / "pruebas"))
        from explicaciones import QUE_PRUEBA, POR_QUE_ESPERADO
        r3 = d["ronda3"]
        st.subheader(f"{r3['nombre']}: {r3['pasan']}/{r3['total']}")
        st.dataframe(pd.DataFrame([{"caso": f["id"], "resultado": f["resultado"], "qué prueba": QUE_PRUEBA.get(f["id"], ""),
                                    "esperado": f["esperado"], "obtenido": f["obtenido"],
                                    "explicación": POR_QUE_ESPERADO.get(f["id"], "")} for f in r3["filas"]]),
                     width="stretch")
        for v in d["ronda4"]:
            st.subheader(f"{v['nombre']}: {v['pasan']}/{v['total']}")
            st.dataframe(pd.DataFrame(v["filas"]), width="stretch")


r = resultados()
seccion = st.sidebar.radio("Sección", ["Inicio", "Evaluar estudiante", "Datos", "Entrenamiento", "Variables", "Pruebas"])
st.sidebar.caption(AVISO)
if seccion == "Inicio":
    inicio(r)
elif seccion == "Evaluar estudiante":
    evaluar_estudiante()
elif r is None and seccion in ("Datos", "Entrenamiento", "Variables"):
    st.error("No hay resultados. Ejecute: python -m desercion.entrenamiento")
elif seccion == "Datos":
    datos(r)
elif seccion == "Entrenamiento":
    entrenamiento(r)
elif seccion == "Variables":
    variables(r)
else:
    pruebas()
