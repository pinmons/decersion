"""Diagnóstico del modelo real en prueba: por qué cada número es el que es.

    python -m desercion.diagnostico

Califica a los estudiantes de prueba de la base real con los tres modos (reglas, logística, red) a través de
la misma API que usa la web (`operacion.procesar`) y guarda en reportes/real/diagnostico.json:

- la distribución del puntaje de la logística en quienes desertaron y quienes no (por qué el AUC no sube más);
- la curva de ganancia: qué parte de los desertores se encuentra revisando primero a los de más riesgo;
- el barrido de cortes: detección, precisión y F1 en cada corte del puntaje (por qué el F1 no sube más);
- el mejor F1 posible de cada modo con cualquier corte, y el que da el corte elegido.

Solo describe lo que ya existe: no entrena nada y no toca los modelos ni las rondas.
"""
import json

import numpy as np

from . import RAIZ
from .operacion import procesar

DESTINO = RAIZ / "reportes" / "real" / "diagnostico.json"
MODOS = {"reglas": "reglas (línea base)", "logistica": "regresión logística", "red_neuronal": "red neuronal (MLP)"}


def _calificados(modelo):
    r = procesar(modelo)
    filas = [e for e in r["estudiantes"] if e["decision"] == "resultado" and e["desenlace"] in ("abandono", "sigue")]
    y = np.array([e["desenlace"] == "abandono" for e in filas], dtype=int)
    puntaje = np.array([e["puntaje"] for e in filas], dtype=float)
    prob = np.array([e["probabilidad"] if e.get("probabilidad") is not None else e["puntaje"] / 100 for e in filas], dtype=float)
    return y, puntaje, prob, r.get("cortes")


def _auc(y, s):
    orden = np.argsort(s, kind="mergesort")
    rangos = np.empty(len(s))
    rangos[orden] = np.arange(1, len(s) + 1)
    for v in np.unique(s):          # empates: rango promedio
        m = s == v
        rangos[m] = rangos[m].mean()
    n1, n0 = y.sum(), len(y) - y.sum()
    return float((rangos[y == 1].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


def _barrido(y, puntaje):
    filas = []
    for c in range(0, 101):
        m = puntaje >= c
        vp = int((m & (y == 1)).sum())
        prec = vp / m.sum() if m.sum() else None
        rec = vp / y.sum()
        f1 = 2 * prec * rec / (prec + rec) if prec else 0.0
        filas.append({"corte": c, "deteccion": rec, "precision": prec, "f1": f1, "fraccion_marcada": float(m.mean())})
    return filas


def generar():
    salida = {"modelos": {}, "n": None, "desertores": None}
    for modelo, nombre in MODOS.items():
        y, puntaje, prob, cortes = _calificados(modelo)
        barr = _barrido(y, puntaje)
        mejor = max(barr, key=lambda f: f["f1"])
        en_corte = next((f for f in barr if cortes and f["corte"] == cortes["corte_alto"]), None)
        salida["modelos"][nombre] = {"auc": _auc(y, prob), "cortes": cortes, "f1_maximo": mejor, "en_corte_alto": en_corte}
        salida["n"], salida["desertores"] = int(len(y)), int(y.sum())
        if modelo == "logistica":
            lo, hi = int(np.floor(puntaje.min() / 2) * 2), int(np.ceil(puntaje.max() / 2) * 2) + 2
            bordes = np.arange(lo, hi + 1, 2)
            salida["distribucion"] = {
                "modelo": nombre, "bordes": bordes.tolist(),
                "desertaron": (np.histogram(puntaje[y == 1], bordes)[0] / max(1, (y == 1).sum())).tolist(),
                "siguieron": (np.histogram(puntaje[y == 0], bordes)[0] / max(1, (y == 0).sum())).tolist(),
                "n_desertaron": int((y == 1).sum()), "n_siguieron": int((y == 0).sum())}
            orden = np.argsort(-prob, kind="mergesort")
            acumulado = np.cumsum(y[orden]) / y.sum()
            n = len(y)
            salida["ganancia"] = {"modelo": nombre, "puntos": [[0.0, 0.0]] + [
                [k / 100, float(acumulado[max(0, int(round(k / 100 * n)) - 1)])] for k in range(1, 101)]}
            salida["barrido"] = {"modelo": nombre, "filas": [f for f in barr if lo <= f["corte"] <= hi]}
    DESTINO.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    return salida


if __name__ == "__main__":
    s = generar()
    for nombre, m in s["modelos"].items():
        print(f"{nombre:22s} AUC {m['auc']:.3f} | F1 máximo {m['f1_maximo']['f1']:.3f} (corte {m['f1_maximo']['corte']})"
              + (f" | en su corte alto {m['en_corte_alto']['f1']:.3f}, detecta {m['en_corte_alto']['deteccion']:.0%}" if m["en_corte_alto"] else ""))
    g = dict((round(x, 2), v) for x, v in s["ganancia"]["puntos"])
    print(f"Ganancia: revisando el 20 % se encuentra el {g[0.2]:.0%} de los desertores")
    print(f"Guardado en {DESTINO.relative_to(RAIZ)}")
