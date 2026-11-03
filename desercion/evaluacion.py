"""Fase 6 – Evaluación final en test: línea base por reglas, regresión logística y MLP.

Todas las métricas se miden contra datos SINTÉTICOS: describen qué tan bien cada modelo
recupera una función latente inventada, no su desempeño con estudiantes reales.

Decisiones [SUPUESTO]:
- Probabilidad de la línea base: puntaje / 100, recortado a [0.01, 0.99] (las reglas no
  producen probabilidades). AUC, recall y matriz de confusión no dependen de esa conversión.
- "Marcado en riesgo" para accuracy, recall y precisión = nivel alto. También se reporta
  medio + alto.
- Los niveles incluyen la regla de anulación R3.4, igual que en el sistema real.
- En la MLP, si la deuda no está informada se usa la mayor probabilidad entre deuda = 0 y 1.
"""
import numpy as np

from . import figuras
from . import tarjeta_puntaje as tp
from .contrato import aplica_r34
from .metricas import auc, brier, clasificacion, curva_calibracion, entropia_cruzada, sigmoide
from .reglas import calificar as calificar_reglas

NIVELES = ("bajo", "medio", "alto")


def _nivel(puntaje, cortes, registro):
    return "alto" if aplica_r34(registro) else tp.nivel(int(puntaje), cortes)


def _metricas(y, prob, niveles):
    niveles = np.asarray(niveles)
    alto = clasificacion(y, niveles == "alto")
    medio_alto = clasificacion(y, niveles != "bajo")
    confusion = {n: {"deserto_si": int(((niveles == n) & (y == 1)).sum()),
                     "deserto_no": int(((niveles == n) & (y == 0)).sum())} for n in NIVELES}
    for n in NIVELES:
        total = confusion[n]["deserto_si"] + confusion[n]["deserto_no"]
        confusion[n]["tasa_real"] = confusion[n]["deserto_si"] / total if total else float("nan")
        confusion[n]["fraccion_estudiantes"] = total / len(y)
    return {"log_loss": entropia_cruzada(y, prob), "brier": brier(y, prob), "auc": auc(y, prob),
            "accuracy": alto["accuracy"], "recall": alto["recall"], "precision": alto["precision"],
            "recall_medio_alto": medio_alto["recall"], "precision_medio_alto": medio_alto["precision"],
            "accuracy_medio_alto": medio_alto["accuracy"],
            "fraccion_alto": float((niveles == "alto").mean()), "confusion": confusion}


def evaluar_en_test(est, dir_reportes):
    ite = est["ite"]
    y = est["y"][ite]
    regs = [est["registros"][i] for i in ite]
    Xs, X_raw = est["Xs"][ite], est["X_raw"][ite]
    ajuste = est["ajuste"]

    # Línea base por reglas
    salidas = [calificar_reglas(r)[0] for r in regs]
    p_reglas = np.clip(np.array([s["puntaje"] for s in salidas]) / 100, 0.01, 0.99)
    n_reglas = [s["nivel"] for s in salidas]

    # Regresión logística (tarjeta de puntaje)
    punt_log = tp.puntaje(est["tarjeta"], X_raw)
    p_log = sigmoide(est["log"].logit(Xs) - ajuste)
    n_log = [_nivel(p, est["cortes"], r) for p, r in zip(punt_log, regs)]

    # Red neuronal: deuda ausente → la mayor de las dos probabilidades
    p_red = sigmoide(est["red"].logit(Xs) - ajuste)
    if "deuda_matricula" in est["nombres"]:
        j = est["nombres"].index("deuda_matricula")
        falta = np.array([r.get("deuda_matricula") is None for r in regs])
        if falta.any():
            alt = X_raw[falta].copy()
            alt[:, j] = 0
            p_alt = sigmoide(est["red"].logit(est["escalador"].transformar(alt)) - ajuste)
            p_red[falta] = np.maximum(p_red[falta], p_alt)
    punt_red = np.clip(np.rint(100 * p_red), 0, 100).astype(int)
    n_red = [_nivel(p, est["cortes_red"], r) for p, r in zip(punt_red, regs)]

    modelos = {
        "reglas (línea base)": _metricas(y, p_reglas, n_reglas),
        "regresión logística": _metricas(y, p_log, n_log),
        "red neuronal (MLP)": _metricas(y, p_red, n_red),
    }
    techo = auc(y, est["prob_real"][ite])
    _imprimir(modelos, techo, float(y.mean()))
    figuras.calibracion([(n, curva_calibracion(y, p)) for n, p in
                         zip(modelos, (p_reglas, p_log, p_red))], dir_reportes / "calibracion.png")
    return {"modelos": modelos, "auc_techo": techo, "n_test": int(len(y)), "tasa_test": float(y.mean()),
            "calibracion": {n: curva_calibracion(y, p) for n, p in zip(modelos, (p_reglas, p_log, p_red))},
            "conclusion": conclusion(modelos, techo)}


def _imprimir(modelos, techo, tasa):
    nombres = list(modelos)
    filas = [("Log-loss (↓)", "log_loss", "{:.4f}"), ("Brier (↓)", "brier", "{:.4f}"), ("AUC-ROC (↑)", "auc", "{:.4f}"),
             ("Accuracy (alto = riesgo)", "accuracy", "{:.1%}"), ("Recall desertores (alto)", "recall", "{:.1%}"),
             ("Precisión (alto)", "precision", "{:.1%}"), ("Recall (medio + alto)", "recall_medio_alto", "{:.1%}"),
             ("Precisión (medio + alto)", "precision_medio_alto", "{:.1%}"),
             ("% de estudiantes en alto", "fraccion_alto", "{:.1%}")]
    print(f"{'Métrica':28s}" + "".join(f"{n:>24s}" for n in nombres))
    for etiqueta, clave, fmt in filas:
        print(f"{etiqueta:28s}" + "".join(f"{fmt.format(modelos[n][clave]):>24s}" for n in nombres))
    print(f"\nTecho teórico (AUC de la probabilidad real que generó los datos): {techo:.4f}")
    print("\nMatriz de confusión por nivel (desertó sí / no) y tasa real de deserción en cada nivel:")
    for n in nombres:
        c = modelos[n]["confusion"]
        print(f"  {n:22s} " + " | ".join(
            f"{k}: {c[k]['deserto_si']:4d} sí / {c[k]['deserto_no']:4d} no ({c[k]['tasa_real']:.0%} desertan)"
            for k in NIVELES))
    print("\nAccuracy engaña con clases desbalanceadas: un modelo que dijera 'nadie deserta' acertaría "
          f"~{1 - tasa:.0%} sin detectar a ningún desertor.")
    print("\nConclusión:", conclusion(modelos, techo))


def conclusion(modelos, techo):
    r, l, m = (modelos[k] for k in ("reglas (línea base)", "regresión logística", "red neuronal (MLP)"))
    partes = []
    if m["auc"] > l["auc"] + 0.005:
        partes.append(f"La red neuronal ordena algo mejor que la logística (AUC {m['auc']:.3f} vs {l['auc']:.3f}), "
                      "a costa de perder la tarjeta de puntaje explicable.")
    else:
        partes.append(f"La red neuronal NO supera de forma relevante a la logística (AUC {m['auc']:.3f} vs "
                      f"{l['auc']:.3f}); la logística es preferible porque es explicable.")
    dif = l["auc"] - r["auc"]
    partes.append(f"La línea base por reglas queda {'cerca' if dif < 0.03 else 'por debajo'} "
                  f"(AUC {r['auc']:.3f}, {dif:+.3f} frente a la logística) y su probabilidad (puntaje/100) está mal "
                  f"calibrada (Brier {r['brier']:.3f} vs {l['brier']:.3f}).")
    partes.append(f"Ningún modelo puede pasar de ~{techo:.3f} de AUC porque el resto es ruido de la simulación.")
    partes.append("Todo se midió con datos SINTÉTICOS: no representa el desempeño con estudiantes reales.")
    return " ".join(partes)
