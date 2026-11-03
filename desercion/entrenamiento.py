"""Entrenamiento completo, de los datos al reporte.

    python -m desercion.entrenamiento                 # todas las etapas
    python -m desercion.entrenamiento --hasta datos   # se detiene después de una etapa

Etapas (cada una corresponde a una fase del plan):
    datos         Fase 2  generar, pasar por el Paso 1, dividir, resumen
    dependencia   Fase 3  correlaciones, VIF, tratar la colinealidad, estandarizar
    entrenamiento Fase 4  logística y MLP desde cero, tarjeta de puntaje, cortes
    control       Fase 5  permutación, tope de dominancia, ablación, estabilidad, estrato
    evaluacion    Fase 6  métricas en test contra la línea base por reglas

Glosario con este sistema como ejemplo:
- Época: una pasada completa por los ~14 000 estudiantes de entrenamiento.
- Mini-lote: grupo de 256 estudiantes; con cada lote se calcula el gradiente y se actualizan
  los pesos una vez (≈ 55 actualizaciones por época).
- Pérdida: qué tan lejos están las probabilidades del modelo de lo que pasó (desertó o no).
- Gradiente: para cada peso, cuánto sube la pérdida si ese peso sube un poco. Se mueve cada
  peso en la dirección contraria.
- Early stopping: si la pérdida de validación no mejora en `paciencia` épocas, se para y se
  recuperan los pesos de la mejor época.
"""
import argparse
import json
import time
from collections import Counter

import numpy as np

from . import RAIZ
from . import datos_sinteticos as ds
from . import dependencia as dep
from . import tarjeta_puntaje as tp
from .metricas import (auc, entropia_cruzada, pesos_por_clase, pesos_muestra, sigmoide)
from .modelos.logistica import RegresionLogistica
from .modelos.red_neuronal import RedNeuronal
from .preprocesamiento import dividir_estratificado, Escalador
from .variables import CANDIDATAS, NOMBRES_LEGIBLES, matriz

DIR_REPORTES = RAIZ / "reportes"
DIR_MODELOS = RAIZ / "modelos_entrenados"
DIR_DATOS = RAIZ / "datos"
ETAPAS = ["datos", "dependencia", "entrenamiento", "control", "evaluacion"]
SEMILLA = 2026

CONFIG_LOGISTICA = {"l2": 1e-3, "tasa_aprendizaje": 0.01, "tam_lote": 256, "max_epocas": 300, "paciencia": 20}
CONFIG_RED = {"capas": [16, 8], "l2": 1e-4, "tasa_aprendizaje": 1e-3, "dropout": 0.2, "tam_lote": 256,
              "max_epocas": 300, "paciencia": 20}
# Si la pérdida de validación no baja al menos esto, no cuenta como mejora.
MEJORA_MINIMA = 1e-5
MARGEN_TOPE = 0.02  # [SUPUESTO] margen bajo el tope por ruido de muestreo
COLAPSO_AUC = 0.10  # [SUPUESTO] quitar una variable y perder > 0.10 de AUC = dependencia excesiva


def titulo(texto):
    print("\n" + "=" * 100)
    print(texto)
    print("=" * 100)


def ajuste_prior(pc):
    """Los pesos por clase inflan la probabilidad de desertar. Restar ln(w+/w-) al logit
    devuelve una probabilidad comparable con la tasa real [SUPUESTO: corrección de prior]."""
    return float(np.log(pc["positivo"] / pc["negativo"]))


def _pct(x):
    return f"{100 * x:.1f} %"


# ====================================================================== bucle de entrenamiento
def resumen_pesos(w, nombres, tope=dep.TOPE_DOMINANCIA):
    """Texto con los pesos y la parte del total que se lleva el más grande."""
    w = np.asarray(w)
    partes = np.abs(w) / np.abs(w).sum()
    orden = np.argsort(-np.abs(w))
    pesos = " · ".join(f"{nombres[i]} {w[i]:+.2f}" for i in orden)
    j = orden[0]
    estado = "dentro del tope" if partes[j] <= tope else "SUPERA el tope"
    return (f"Pesos: {pesos}\n"
            f"           Peso más grande: {nombres[j]} ({_pct(partes[j])} de la suma de |pesos|) → {estado} "
            f"({tope * 100:.0f} %; el tope oficial se mide con importancia por permutación)")


def entrenar(modelo, Xtr, ytr, Xva, yva, config, nombres=None, imprimir=False, cada=10, semilla=SEMILLA):
    """Bucle genérico: mini-lotes, registro por época y early stopping."""
    rng = np.random.default_rng(semilla)
    pc = pesos_por_clase(ytr)
    s_tr, s_va = pesos_muestra(ytr, pc), pesos_muestra(yva, pc)
    mejor, mejor_estado, mejor_epoca, sin_mejora = np.inf, modelo.copiar_estado(), 0, 0
    historial = []
    t0 = time.time()
    for epoca in range(1, config["max_epocas"] + 1):
        orden = rng.permutation(len(ytr))
        for inicio in range(0, len(orden), config["tam_lote"]):
            lote = orden[inicio:inicio + config["tam_lote"]]
            modelo.paso(Xtr[lote], ytr[lote], s_tr[lote])
        p_tr, p_va = modelo.probabilidad(Xtr), modelo.probabilidad(Xva)
        fila = {"epoca": epoca,
                "perdida_train": entropia_cruzada(ytr, p_tr, s_tr),
                "perdida_val": entropia_cruzada(yva, p_va, s_va),
                "auc_val": auc(yva, p_va),
                "recall_val": float(((p_va >= 0.5) & (yva == 1)).sum() / yva.sum()),
                "norma_pesos": modelo.norma_pesos()}
        if hasattr(modelo, "w"):
            fila["pesos"] = modelo.w.tolist()
        historial.append(fila)
        mejoro = fila["perdida_val"] < mejor - MEJORA_MINIMA
        if mejoro:
            mejor, mejor_estado, mejor_epoca, sin_mejora = fila["perdida_val"], modelo.copiar_estado(), epoca, 0
        else:
            sin_mejora += 1
        parar = sin_mejora >= config["paciencia"]
        if imprimir and (epoca == 1 or epoca % cada == 0 or parar):
            print(f"Época {epoca:3d} | pérdida train {fila['perdida_train']:.3f} | pérdida val "
                  f"{fila['perdida_val']:.3f} | AUC val {fila['auc_val']:.3f} | recall val "
                  f"{fila['recall_val']:.2f} | norma pesos {fila['norma_pesos']:.2f}")
            if nombres is not None and "pesos" in fila:
                print("           " + resumen_pesos(fila["pesos"], nombres))
        if parar:
            if imprimir:
                print(f"Early stopping: {config['paciencia']} épocas sin mejorar la pérdida de validación. "
                      f"Se recuperan los pesos de la época {mejor_epoca}.")
            break
    modelo.cargar_estado(mejor_estado)
    info = {"mejor_epoca": mejor_epoca, "epocas_corridas": len(historial), "perdida_val_mejor": mejor,
            "segundos": round(time.time() - t0, 1), "pesos_clase": pc}
    return modelo, historial, info


def crear_logistica(k, config=CONFIG_LOGISTICA, l2_por_variable=None, signos=None, semilla=SEMILLA):
    return RegresionLogistica(k, l2=config["l2"], tasa_aprendizaje=config["tasa_aprendizaje"],
                              l2_por_variable=l2_por_variable, signos=signos, semilla=semilla)


def crear_red(k, config=CONFIG_RED, semilla=SEMILLA):
    return RedNeuronal(k, capas=tuple(config["capas"]), l2=config["l2"], tasa_aprendizaje=config["tasa_aprendizaje"],
                       dropout=config["dropout"], semilla=semilla)


# ====================================================================== Fase 2 – datos
def etapa_datos(est, res, imprimir=True):
    from . import figuras
    titulo("FASE 2 – Datos sintéticos (NO son datos reales)")
    crudo = ds.generar(semilla=SEMILLA)
    defecto = np.array([d or "" for d in crudo["defecto"]], dtype=object)
    validos, y, motivos, detalle, extras = ds.filtrar_por_contrato(
        crudo["registros"], crudo["deserto"], {"prob_real": crudo["prob_real"], "defecto": defecto})
    defecto_por_id = {r["id_estudiante"]: d for r, d in zip(crudo["registros"], defecto)}
    cruce = Counter((defecto_por_id[d["id"]], f"{d['salida']['decision']}({d['salida']['motivo']})") for d in detalle)
    colados = int(sum(1 for d in extras["defecto"] if d))
    ruta_csv = DIR_DATOS / "estudiantes_sinteticos.csv"
    ds.guardar_csv(validos, y, ruta_csv)
    rec, y_rec, mot_rec = ds.cargar_datos_reales(ruta_csv)
    ida_y_vuelta = len(rec) == len(validos) and bool(np.array_equal(y_rec, y)) and rec == validos

    print(f"Registros generados: {len(crudo['registros'])} | válidos: {len(validos)} | "
          f"descartados por el Paso 1: {len(detalle)}")
    print(f"Tasa de deserción en los válidos: {_pct(y.mean())} (objetivo {_pct(ds.TASA_OBJETIVO)}); "
          f"intercepto b0 ajustado: {crudo['intercepto']:.3f}")
    print("Descartes por motivo:", dict(sorted(motivos.items())))
    print(f"Registros defectuosos que el Paso 1 dejó pasar: {colados}")
    print(f"Sin deuda informada (opcional, se conservan): {sum('deuda_matricula' not in r for r in validos)}")
    print(f"CSV guardado y recargado con cargar_datos_reales(): {'idéntico' if ida_y_vuelta else 'DIFERENTE'}")

    itr, iva, ite = dividir_estratificado(y, semilla=SEMILLA)
    print(f"División estratificada: train {len(itr)} ({_pct(y[itr].mean())} desertan) | val {len(iva)} "
          f"({_pct(y[iva].mean())}) | test {len(ite)} ({_pct(y[ite].mean())}). El test no se usa hasta la Fase 6.")
    auc_techo = auc(y[ite], extras["prob_real"][ite])
    print(f"Techo teórico: AUC de la probabilidad REAL en test = {auc_techo:.3f} (ningún modelo puede superarlo "
          f"en promedio, porque el resto es ruido).")

    figuras.distribuciones(validos, y, DIR_REPORTES / "distribuciones.png")
    est.update(registros=validos, y=y, prob_real=extras["prob_real"], itr=itr, iva=iva, ite=ite)
    res["datos"] = {
        "n_generados": len(crudo["registros"]), "n_validos": len(validos), "n_descartados": len(detalle),
        "tasa_desercion": float(y.mean()), "tasa_objetivo": ds.TASA_OBJETIVO, "intercepto": crudo["intercepto"],
        "descartes_por_motivo": dict(sorted(motivos.items())),
        "descartes_por_tipo_de_defecto": [{"defecto": a, "salida_paso1": b, "n": n} for (a, b), n in sorted(cruce.items())],
        "defectuosos_colados": colados, "sin_deuda_informada": sum("deuda_matricula" not in r for r in validos),
        "csv_ida_y_vuelta": ida_y_vuelta, "formula_latente": ds.FORMULA_LATENTE,
        "division": {"train": len(itr), "val": len(iva), "test": len(ite),
                     "tasa_train": float(y[itr].mean()), "tasa_val": float(y[iva].mean()), "tasa_test": float(y[ite].mean())},
        "auc_techo_test": auc_techo,
        "resumen_campos": resumen_campos(validos, y),
        "ejemplos_descartados": detalle[:12],
    }


def resumen_campos(registros, y):
    numericos = {}
    for campo in ["semestre", "promedio_acumulado", "creditos_inscritos", "materias_cursadas_periodo_anterior",
                  "materias_reprobadas", "porcentaje_asistencia", "estrato"]:
        v = np.array([r[campo] for r in registros], float)
        numericos[campo] = {"media": v.mean(), "desv": v.std(), "min": v.min(), "p25": np.percentile(v, 25),
                            "mediana": np.median(v), "p75": np.percentile(v, 75), "max": v.max(),
                            "media_desertores": v[y == 1].mean(), "media_no_desertores": v[y == 0].mean()}
    categoricos = {}
    for campo, f in [("estrato", lambda r: r["estrato"]), ("semestre", lambda r: r["semestre"]),
                     ("trabaja", lambda r: r["trabaja"]),
                     ("deuda_matricula", lambda r: r.get("deuda_matricula", "no_informado"))]:
        vals = [f(r) for r in registros]
        filas = []
        for valor in sorted(set(vals), key=str):
            m = np.array([v == valor for v in vals])
            filas.append({"valor": str(valor).lower(), "n": int(m.sum()), "fraccion": float(m.mean()),
                          "tasa_desercion": float(y[m].mean())})
        categoricos[campo] = filas
    return {"numericos": {k: {a: float(b) for a, b in v.items()} for k, v in numericos.items()}, "categoricos": categoricos}


# ====================================================================== Fase 3 – dependencia
def etapa_dependencia(est, res, imprimir=True):
    from . import figuras
    titulo("FASE 3 – Dependencia entre variables ANTES de entrenar (medida solo en train)")
    candidatas = list(CANDIDATAS)
    # [SUPUESTO] deuda ausente → 1 (valor prudente: no reduce el riesgo). Se confirma con el signo aprendido.
    X_todo = matriz(est["registros"], candidatas, deuda_si_falta=1)
    Xtr = X_todo[est["itr"]]
    antes = dep.diagnostico(Xtr, candidatas)
    print("Variables candidatas:", ", ".join(candidatas))
    print("Pares con |correlación de Pearson| > 0.8:")
    for a, b, r in antes["pares_altos"]:
        print(f"   {a} ~ {b}: r = {r:+.3f}")
    print("VIF antes:")
    for n, v in antes["vif"].items():
        print(f"   {n:38s} {v:7.2f}  {dep.clasificar_vif(v)}")
    finales, decisiones = dep.resolver_colinealidad(Xtr, candidatas)
    for d in decisiones:
        print(f"Decisión: se quita '{d['se_quita']}'" + (f", se queda '{d['se_queda']}'" if "se_queda" in d else "")
              + f". {d['motivo']}")
    cols = [candidatas.index(n) for n in finales]
    despues = dep.diagnostico(Xtr[:, cols], finales)
    print("VIF después:")
    for n, v in despues["vif"].items():
        print(f"   {n:38s} {v:7.2f}  {dep.clasificar_vif(v)}")
    print(f"Pares > 0.8 después: {len(despues['pares_altos'])}")
    esc = Escalador().ajustar(Xtr[:, cols])
    print("Estandarización con media y desviación de TRAIN:")
    for n, m, s in zip(finales, esc.media, esc.desviacion):
        print(f"   {n:38s} media {m:8.3f}  desv. {s:7.3f}")
    X_raw = X_todo[:, cols]
    Xs = esc.transformar(X_raw)
    figuras.mapa_calor([antes["pearson"], antes["spearman"]], ["Pearson", "Spearman"], candidatas,
                       DIR_REPORTES / "correlacion_antes.png", "Correlación entre variables candidatas (train)")
    figuras.mapa_calor([despues["pearson"], despues["spearman"]], ["Pearson", "Spearman"], finales,
                       DIR_REPORTES / "correlacion_despues.png", "Correlación entre variables finales (train)")
    figuras.vif_antes_despues(antes["vif"], despues["vif"], DIR_REPORTES / "vif.png")
    est.update(nombres=finales, escalador=esc, X_raw=X_raw, Xs=Xs, X_candidatas=X_todo, candidatas=candidatas)
    res["dependencia"] = {"candidatas": candidatas, "antes": antes, "decisiones": decisiones,
                          "finales": finales, "despues": despues, "escalador": esc.a_dict(),
                          "deuda_si_falta_entrenamiento": 1}


# ====================================================================== Fase 4 – entrenamiento
def partes(est, X=None):
    X = est["Xs"] if X is None else X
    return X[est["itr"]], est["y"][est["itr"]], X[est["iva"]], est["y"][est["iva"]], X[est["ite"]], est["y"][est["ite"]]


def tarjeta_y_cortes(modelo, escalador, nombres, X_raw_val, y_val):
    tarjeta = tp.construir(modelo.w, modelo.b, escalador.media, escalador.desviacion, nombres)
    cortes = tp.elegir_cortes(tp.puntaje(tarjeta, X_raw_val), y_val)
    return tarjeta, cortes


def puntaje_red(modelo, X, ajuste):
    return np.clip(np.rint(100 * sigmoide(modelo.logit(X) - ajuste)), 0, 100).astype(int)


def etapa_entrenamiento(est, res, imprimir=True):
    from . import figuras
    Xtr, ytr, Xva, yva, _, _ = partes(est)
    k, nombres = Xtr.shape[1], est["nombres"]
    titulo("FASE 4 – Modelo A: regresión logística (una neurona sigmoide), desde cero en NumPy")
    print(f"Configuración: {CONFIG_LOGISTICA} | pesos por clase: "
          f"{ {a: round(float(b), 3) for a, b in pesos_por_clase(ytr).items()} }")
    log, hist_log, info_log = entrenar(crear_logistica(k), Xtr, ytr, Xva, yva, CONFIG_LOGISTICA, nombres, imprimir)
    titulo(f"FASE 4 – Modelo B: red neuronal {k} → {' → '.join(map(str, CONFIG_RED['capas']))} → 1 "
           "(ReLU, dropout, Adam, He), desde cero en NumPy")
    print(f"Configuración: {CONFIG_RED}")
    red, hist_red, info_red = entrenar(crear_red(k), Xtr, ytr, Xva, yva, CONFIG_RED, None, imprimir)

    ajuste = ajuste_prior(info_log["pesos_clase"])
    tarjeta, cortes = tarjeta_y_cortes(log, est["escalador"], nombres, est["X_raw"][est["iva"]], yva)
    cortes_red = tp.elegir_cortes(puntaje_red(red, Xva, ajuste), yva)
    deuda_j = nombres.index("deuda_matricula") if "deuda_matricula" in nombres else None
    deuda_si_falta = 1 if deuda_j is None or tarjeta["beta"][deuda_j] >= 0 else 0

    titulo("FASE 4 – Tarjeta de puntaje (pesos de la logística → puntos 0–100)")
    print(f"{'variable':38s} {'peso estand.':>12s} {'β original':>11s} {'puntos máx.':>11s}  0 puntos en")
    for j, n in enumerate(nombres):
        print(f"{n:38s} {log.w[j]:12.3f} {tarjeta['beta'][j]:11.4f} {tarjeta['puntos_maximos'][j]:11.1f}  "
              f"{tarjeta['valor_menor_riesgo'][j]}")
    print(f"Escala: {tarjeta['escala']:.3f} puntos por unidad de logit | logit con 0 puntos: {tarjeta['logit_base']:.3f}")
    for nombre, c in (("logística", cortes), ("red neuronal", cortes_red)):
        v = c["en_validacion"]
        print(f"Cortes {nombre} (elegidos en validación): medio ≥ {c['corte_medio']}, alto ≥ {c['corte_alto']} | "
              f"alto captura {_pct(v['recall_alto'])} de los desertores con {_pct(v['fraccion_alto'])} de los "
              f"estudiantes | en bajo quedan {_pct(v['desertores_en_bajo'])} de los desertores. {c['nota']}")
    print(f"Deuda no informada: se imputa {deuda_si_falta} (el peso aprendido de la deuda es "
          f"{'positivo' if deuda_si_falta == 1 else 'negativo'}, así que {deuda_si_falta} es el valor que NO reduce el riesgo).")

    figuras.curvas([("logística", hist_log, info_log["mejor_epoca"]), ("red neuronal", hist_red, info_red["mejor_epoca"])],
                   DIR_REPORTES / "curvas_perdida.png", DIR_REPORTES / "curvas_auc.png")
    figuras.evolucion_pesos(hist_log, nombres, DIR_REPORTES / "evolucion_pesos.png")
    est.update(log=log, red=red, tarjeta=tarjeta, cortes=cortes, cortes_red=cortes_red, ajuste=ajuste,
               deuda_si_falta=deuda_si_falta, l2_por_variable=np.ones(k))
    res["entrenamiento"] = {
        "config_logistica": CONFIG_LOGISTICA, "config_red": CONFIG_RED,
        "info_logistica": info_log, "info_red": info_red, "ajuste_prior": ajuste,
        "historial_logistica": hist_log, "historial_red": hist_red,
        "pesos_epoca1": hist_log[0]["pesos"], "pesos_finales": log.w.tolist(), "sesgo_final": float(log.b),
        "tarjeta": tarjeta, "cortes": cortes, "cortes_red": cortes_red, "deuda_si_falta": deuda_si_falta,
    }


# ====================================================================== Fase 5 – control de dominancia
def reentrenar_logistica(est, columnas, l2_por_variable=None, idx_train=None, semilla=SEMILLA):
    """Logística silenciosa sobre un subconjunto de columnas (para ablación, tope y estabilidad)."""
    Xtr, ytr, Xva, yva, _, _ = partes(est)
    if idx_train is not None:
        Xtr, ytr = est["Xs"][idx_train], est["y"][idx_train]
    c = None if l2_por_variable is None else np.asarray(l2_por_variable)[columnas]
    modelo = crear_logistica(len(columnas), l2_por_variable=c, semilla=semilla)
    modelo, _, info = entrenar(modelo, Xtr[:, columnas], ytr, Xva[:, columnas], yva, CONFIG_LOGISTICA, semilla=semilla)
    return modelo, info


def metricas_test_logistica(est, modelo, columnas, ajuste):
    _, _, _, _, Xte, yte = partes(est)
    z = modelo.logit(Xte[:, columnas])
    return {"auc": auc(yte, z), "log_loss": entropia_cruzada(yte, sigmoide(z - ajuste))}


def etapa_control(est, res, imprimir=True):
    from . import figuras
    nombres = est["nombres"]; k = len(nombres); todas = list(range(k))
    _, _, Xva, yva, Xte, yte = partes(est)
    ajuste = est["ajuste"]
    titulo("FASE 5 – Controlar que ninguna variable domine")

    # 1-2. Importancia por permutación y tope de dominancia.
    # La decisión se toma con TRAIN (14 000 registros): en validación (3 000) la importancia es
    # demasiado ruidosa (en una primera versión dio 33.5 % en validación y 37.7 % en test).
    # Se exige quedar 2 puntos por debajo del tope como margen por ese ruido [SUPUESTO].
    tope = dep.TOPE_DOMINANCIA
    objetivo = tope - MARGEN_TOPE
    Xtr, ytr = est["Xs"][est["itr"]], est["y"][est["itr"]]
    log = est["log"]
    c = np.ones(k)

    def medir(modelo):
        pct = dep.porcentajes(dep.importancia_permutacion(modelo.logit, Xtr, ytr)[0])
        return pct, auc(yva, modelo.logit(Xva))

    pct_tr, auc_va = medir(log)
    antes = {"pct_train": pct_tr.tolist(), "auc_val": auc_va, "multiplicadores": c.tolist()}
    pasos_tope = []
    print(f"Tope de dominancia: {tope * 100:.0f} % de la importancia total [SUPUESTO]. Se decide con la importancia "
          f"en TRAIN y se exige ≤ {objetivo * 100:.0f} % (margen por ruido de muestreo).")
    print("Importancia por permutación en train (logística): " +
          " · ".join(f"{nombres[j]} {_pct(pct_tr[j])}" for j in np.argsort(-pct_tr)))
    while pct_tr.max() > objetivo and len(pasos_tope) < 15:
        j = int(pct_tr.argmax())
        c[j] *= 2
        log_nuevo, _ = reentrenar_logistica(est, todas, l2_por_variable=c)
        pct_tr, auc_va = medir(log_nuevo)
        pasos_tope.append({"variable": nombres[j], "multiplicador_l2": float(c[j]), "l2_efectivo": float(c[j] * CONFIG_LOGISTICA["l2"]),
                           "peso": float(log_nuevo.w[j]), "max_pct_train": float(pct_tr.max()),
                           "variable_max": nombres[int(pct_tr.argmax())], "auc_val": auc_va})
        print(f"   {nombres[j]} sobre el objetivo → L2 ×{c[j]:.0f} en esa variable (λ = {c[j] * CONFIG_LOGISTICA['l2']:.3f}) "
              f"→ peso {log_nuevo.w[j]:+.3f} | máx. ahora {nombres[int(pct_tr.argmax())]} {_pct(pct_tr.max())} | "
              f"AUC val {auc_va:.4f}")
        log = log_nuevo
    metr_antes = metricas_test_logistica(est, est["log"], todas, ajuste)
    if pasos_tope:
        est["log"] = log
        est["l2_por_variable"] = c
        est["tarjeta"], est["cortes"] = tarjeta_y_cortes(log, est["escalador"], nombres, est["X_raw"][est["iva"]], yva)
        j_deuda = nombres.index("deuda_matricula") if "deuda_matricula" in nombres else None
        if j_deuda is not None:
            est["deuda_si_falta"] = 1 if est["tarjeta"]["beta"][j_deuda] >= 0 else 0
        res["entrenamiento"].update(pesos_finales=log.w.tolist(), sesgo_final=float(log.b),
                                    tarjeta=est["tarjeta"], cortes=est["cortes"], deuda_si_falta=est["deuda_si_falta"])
        print("Se reemplaza la logística por la versión con el tope aplicado y se recalculan tarjeta y cortes "
              f"(nuevos cortes: medio ≥ {est['cortes']['corte_medio']}, alto ≥ {est['cortes']['corte_alto']}).")
    else:
        print("Ninguna variable supera el tope: no hace falta penalización extra.")
    metr_despues = metricas_test_logistica(est, log, todas, ajuste)
    antes.update({"auc_test": metr_antes["auc"], "log_loss_test": metr_antes["log_loss"]})
    despues = {"pct_train": pct_tr.tolist(), "auc_val": auc_va, "multiplicadores": c.tolist(),
               "auc_test": metr_despues["auc"], "log_loss_test": metr_despues["log_loss"]}
    if pasos_tope:
        print(f"Costo de repartir el peso (medido en test al final): AUC {metr_antes['auc']:.4f} → {metr_despues['auc']:.4f} "
              f"({metr_despues['auc'] - metr_antes['auc']:+.4f}) | log-loss {metr_antes['log_loss']:.4f} → "
              f"{metr_despues['log_loss']:.4f} ({metr_despues['log_loss'] - metr_antes['log_loss']:+.4f})")

    # Importancia final en TEST (lo que se reporta), para la logística y la red
    imp_te, imp_te_sd, auc_base = dep.importancia_permutacion(log.logit, Xte, yte)
    imp_red, imp_red_sd, auc_red = dep.importancia_permutacion(est["red"].logit, Xte, yte)
    pct_te, pct_red = dep.porcentajes(imp_te), dep.porcentajes(imp_red)
    print(f"\nImportancia por permutación en TEST (caída de AUC, 5 permutaciones; AUC base logística {auc_base:.4f}, "
          f"red {auc_red:.4f}):")
    print(f"{'variable':38s} {'logística':>16s} {'red neuronal':>16s}")
    for j in np.argsort(-pct_te):
        print(f"{nombres[j]:38s} {imp_te[j]:7.4f} ({_pct(pct_te[j]):>6s}) {imp_red[j]:7.4f} ({_pct(pct_red[j]):>6s})")
    for nombre, p in (("logística", pct_te), ("red neuronal", pct_red)):
        j = int(np.argmax(p))
        print(f"   {nombre}: variable más importante {nombres[j]} con {_pct(p[j])} → "
              f"{'dentro del tope' if p[j] <= tope else 'SUPERA el tope (se reporta)'}")
    figuras.importancias([("Logística", pct_te), ("Red neuronal", pct_red)], [nombres, nombres],
                         DIR_REPORTES / "importancia_permutacion.png", tope)

    # 3. Ablación
    print("\nAblación (se reentrena la logística sin una variable a la vez):")
    base = metricas_test_logistica(est, log, todas, ajuste)
    ablacion = []
    for j in todas:
        cols = [i for i in todas if i != j]
        m_abl, _ = reentrenar_logistica(est, cols, l2_por_variable=est["l2_por_variable"])
        m = metricas_test_logistica(est, m_abl, cols, ajuste)
        fila = {"variable": nombres[j], "auc": m["auc"], "log_loss": m["log_loss"],
                "delta_auc": m["auc"] - base["auc"], "delta_log_loss": m["log_loss"] - base["log_loss"],
                "colapsa": bool(base["auc"] - m["auc"] > COLAPSO_AUC)}
        ablacion.append(fila)
        print(f"   sin {nombres[j]:34s} AUC {m['auc']:.4f} (Δ {fila['delta_auc']:+.4f}) | log-loss "
              f"{m['log_loss']:.4f} (Δ {fila['delta_log_loss']:+.4f}){'  ← COLAPSA' if fila['colapsa'] else ''}")
    print(f"   Colapsos (Δ AUC < -{COLAPSO_AUC}): {sum(f['colapsa'] for f in ablacion)}")
    figuras.barras_simples([f["variable"] for f in ablacion], [f["delta_auc"] for f in ablacion],
                           "Ablación: cambio de AUC en test al quitar cada variable", "Δ AUC",
                           DIR_REPORTES / "ablacion.png", "{:+.4f}", -COLAPSO_AUC)

    # 4. Estabilidad: 5 muestras bootstrap de train (logística) y 5 semillas (red)
    print("\nEstabilidad (5 muestras bootstrap de train para la logística, 5 semillas para la red):")
    rng = np.random.default_rng(SEMILLA)
    pesos_b, pct_b, pct_r = [], [], []
    for b in range(5):
        idx = rng.choice(est["itr"], size=len(est["itr"]), replace=True)
        m_b, _ = reentrenar_logistica(est, todas, l2_por_variable=est["l2_por_variable"], idx_train=idx, semilla=SEMILLA + b + 1)
        pesos_b.append(m_b.w.copy())
        pct_b.append(dep.porcentajes(dep.importancia_permutacion(m_b.logit, Xte, yte, repeticiones=3)[0]))
        Xtr, ytr, Xva_, yva_, _, _ = partes(est)
        r_b, _, _ = entrenar(crear_red(k, semilla=SEMILLA + b + 1), Xtr, ytr, Xva_, yva_, CONFIG_RED, semilla=SEMILLA + b + 1)
        pct_r.append(dep.porcentajes(dep.importancia_permutacion(r_b.logit, Xte, yte, repeticiones=3)[0]))
    pesos_b, pct_b, pct_r = np.array(pesos_b), np.array(pct_b), np.array(pct_r)
    print(f"{'variable':38s} {'peso medio ± desv':>20s} {'import. logística':>20s} {'import. red':>18s}")
    for j in todas:
        print(f"{nombres[j]:38s} {pesos_b[:, j].mean():+9.3f} ± {pesos_b[:, j].std():.3f} "
              f"{_pct(pct_b[:, j].mean()):>11s} ± {_pct(pct_b[:, j].std()):>6s} "
              f"{_pct(pct_r[:, j].mean()):>9s} ± {_pct(pct_r[:, j].std()):>6s}")
    cambios_signo = [nombres[j] for j in todas if len(set(np.sign(pesos_b[:, j]))) > 1]
    print(f"   Variables cuyo peso cambia de signo entre muestras: {cambios_signo or 'ninguna'}")
    figuras.estabilidad(nombres, pesos_b.mean(0), pesos_b.std(0), DIR_REPORTES / "estabilidad.png")

    # 5. Variable sensible: estrato
    print("\nVariable sensible (estrato) – en test:")
    analisis_estrato = None
    if "estrato" in nombres:
        j_e = nombres.index("estrato")
        cols_sin = [i for i in todas if i != j_e]
        log_sin, _ = reentrenar_logistica(est, cols_sin, l2_por_variable=est["l2_por_variable"])
        esc_sin = Escalador(est["escalador"].media[cols_sin], est["escalador"].desviacion[cols_sin])
        nombres_sin = [nombres[i] for i in cols_sin]
        tarjeta_sin, cortes_sin = tarjeta_y_cortes(log_sin, esc_sin, nombres_sin, est["X_raw"][est["iva"]][:, cols_sin], yva)
        estrato_te = est["X_raw"][est["ite"]][:, j_e].astype(int)
        p_con = tp.puntaje(est["tarjeta"], est["X_raw"][est["ite"]])
        p_sin = tp.puntaje(tarjeta_sin, est["X_raw"][est["ite"]][:, cols_sin])
        z_con, z_sin = log.logit(Xte), log_sin.logit(Xte[:, cols_sin])

        def tabla(punt, z, cortes):
            filas = []
            for e in range(1, 7):
                m = estrato_te == e
                if not m.any():
                    continue
                alto = punt[m] >= cortes["corte_alto"]
                yy = yte[m]
                filas.append({"estrato": e, "n": int(m.sum()), "tasa_real": float(yy.mean()),
                              "fraccion_alto": float(alto.mean()),
                              "recall_alto": float((alto & (yy == 1)).sum() / max(1, yy.sum())),
                              "log_loss": entropia_cruzada(yy, sigmoide(z[m] - ajuste))})
            return filas
        t_con, t_sin = tabla(p_con, z_con, est["cortes"]), tabla(p_sin, z_sin, cortes_sin)
        print(f"{'estrato':>7s} {'n':>5s} {'deserción real':>15s} {'% alto con':>11s} {'% alto sin':>11s} "
              f"{'recall con':>11s} {'recall sin':>11s} {'log-loss con':>13s} {'log-loss sin':>13s}")
        for a, b in zip(t_con, t_sin):
            print(f"{a['estrato']:7d} {a['n']:5d} {_pct(a['tasa_real']):>15s} {_pct(a['fraccion_alto']):>11s} "
                  f"{_pct(b['fraccion_alto']):>11s} {_pct(a['recall_alto']):>11s} {_pct(b['recall_alto']):>11s} "
                  f"{a['log_loss']:13.4f} {b['log_loss']:13.4f}")
        global_con = {"auc": auc(yte, z_con), "log_loss": entropia_cruzada(yte, sigmoide(z_con - ajuste))}
        global_sin = {"auc": auc(yte, z_sin), "log_loss": entropia_cruzada(yte, sigmoide(z_sin - ajuste))}
        print(f"Global: con estrato AUC {global_con['auc']:.4f}, log-loss {global_con['log_loss']:.4f} | "
              f"sin estrato AUC {global_sin['auc']:.4f}, log-loss {global_sin['log_loss']:.4f}. "
              "La decisión de dejarlo o quitarlo es del equipo.")
        figuras.por_estrato(t_con, t_sin, DIR_REPORTES / "estrato.png")
        analisis_estrato = {"con_estrato": t_con, "sin_estrato": t_sin, "global_con": global_con,
                            "global_sin": global_sin, "cortes_sin": cortes_sin}

    res["control"] = {
        "tope": tope, "antes_tope": antes, "pasos_tope": pasos_tope, "despues_tope": despues,
        "l2_por_variable": est["l2_por_variable"].tolist(),
        "importancia_test": {"variables": nombres, "logistica": imp_te.tolist(), "logistica_desv": imp_te_sd.tolist(),
                             "logistica_pct": pct_te.tolist(), "red": imp_red.tolist(), "red_desv": imp_red_sd.tolist(),
                             "red_pct": pct_red.tolist(), "auc_base_logistica": auc_base, "auc_base_red": auc_red},
        "ablacion": ablacion, "ablacion_base": base,
        "estabilidad": {"pesos_media": pesos_b.mean(0).tolist(), "pesos_desv": pesos_b.std(0).tolist(),
                        "pct_logistica_media": pct_b.mean(0).tolist(), "pct_logistica_desv": pct_b.std(0).tolist(),
                        "pct_red_media": pct_r.mean(0).tolist(), "pct_red_desv": pct_r.std(0).tolist(),
                        "cambios_de_signo": cambios_signo},
        "estrato": analisis_estrato,
    }


# ====================================================================== Fase 6 – evaluación
def etapa_evaluacion(est, res, imprimir=True):
    from .evaluacion import evaluar_en_test
    titulo("FASE 6 – Evaluación final en TEST (primera vez que se usa el test). Datos SINTÉTICOS.")
    res["evaluacion"] = evaluar_en_test(est, DIR_REPORTES)


# ====================================================================== guardar
def guardar_modelos(est, res):
    DIR_MODELOS.mkdir(parents=True, exist_ok=True)
    comun = {"variables": est["nombres"], "escalador": est["escalador"].a_dict(), "ajuste_prior": est["ajuste"],
             "aviso": "Entrenado con datos SINTÉTICOS. No representa el desempeño con estudiantes reales.",
             "semilla": SEMILLA}
    log = {**comun, "tipo": "logistica", "pesos": est["log"].w.tolist(), "sesgo": float(est["log"].b),
           "l2_por_variable": est["l2_por_variable"].tolist(), "tarjeta": est["tarjeta"],
           "cortes": {"corte_medio": est["cortes"]["corte_medio"], "corte_alto": est["cortes"]["corte_alto"]},
           "deuda_si_falta": est["deuda_si_falta"]}
    medias_raw = est["X_raw"][est["itr"]].mean(axis=0).tolist()
    red = {**comun, "tipo": "red_neuronal", **est["red"].a_dict(), "medias_train": medias_raw,
           "cortes": {"corte_medio": est["cortes_red"]["corte_medio"], "corte_alto": est["cortes_red"]["corte_alto"]}}
    for nombre, datos in (("logistica", log), ("red_neuronal", red)):
        with open(DIR_MODELOS / f"{nombre}.json", "w", encoding="utf-8") as f:
            json.dump(datos, f, ensure_ascii=False, indent=1)
    print(f"\nModelos guardados en {DIR_MODELOS.relative_to(RAIZ)}/ (logistica.json, red_neuronal.json)")


def _a_json(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    if isinstance(o, (np.bool_,)):
        return bool(o)
    return str(o)


def guardar_resultados(res):
    DIR_REPORTES.mkdir(parents=True, exist_ok=True)
    with open(DIR_REPORTES / "resultados.json", "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1, default=_a_json)


def main(argv=None):
    import sys
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    p = argparse.ArgumentParser(description="Entrena los modelos del sistema de alerta temprana (datos sintéticos).")
    p.add_argument("--hasta", choices=ETAPAS, default=ETAPAS[-1], help="última etapa a ejecutar")
    args = p.parse_args(argv)
    est, res = {}, {"semilla": SEMILLA, "aviso": "Todas las métricas se midieron con datos SINTÉTICOS."}
    funciones = {"datos": etapa_datos, "dependencia": etapa_dependencia, "entrenamiento": etapa_entrenamiento,
                 "control": etapa_control, "evaluacion": etapa_evaluacion}
    t0 = time.time()
    for etapa in ETAPAS:
        funciones[etapa](est, res)
        if etapa == args.hasta:
            break
    if ETAPAS.index(args.hasta) >= ETAPAS.index("entrenamiento"):
        guardar_modelos(est, res)
    guardar_resultados(res)
    from .reporte import generar_reportes
    generar_reportes(json.loads((DIR_REPORTES / "resultados.json").read_text(encoding="utf-8")))
    if args.hasta == ETAPAS[-1]:
        from .publicar import publicar_para_web
        publicar_para_web()
    print(f"\nListo en {time.time() - t0:.0f} s. Resultados en reportes/resultados.json")


if __name__ == "__main__":
    main()
