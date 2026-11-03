"""Dependencia entre variables: antes de entrenar (Fase 3) y después (Fase 5).

Antes de entrenar:
- correlación de Pearson (lineal) y de Spearman (por rangos, capta relaciones monótonas),
- VIF (factor de inflación de varianza) calculado desde cero: para cada variable j se hace
  una regresión lineal de x_j contra las demás; VIF_j = 1 / (1 - R²_j).
  VIF > 5 = multicolinealidad moderada, VIF > 10 = grave.
- solución explícita para los pares con |r| > 0.8 o VIF > 10.

Después de entrenar:
- importancia por permutación: se desordena una variable y se mide cuánto cae el AUC.
"""
import numpy as np

from .metricas import auc, pearson, spearman

UMBRAL_CORRELACION = 0.8
VIF_MODERADO = 5
VIF_GRAVE = 10
TOPE_DOMINANCIA = 0.35  # [SUPUESTO, ajustable]

# Cuando dos variables son casi la misma información, cuál se queda y por qué.
PREFERENCIAS = {
    frozenset({"materias_reprobadas", "tasa_reprobacion"}): (
        "tasa_reprobacion",
        "La tasa ya contiene al conteo (es reprobadas / cursadas) y es comparable entre "
        "estudiantes con distinta carga. Con las dos, el modelo reparte el peso de forma "
        "inestable y puede dar a una de ellas un signo contrario al real."),
    frozenset({"creditos_inscritos", "materias_cursadas_periodo_anterior"}): (
        "creditos_inscritos",
        "Las dos miden la carga académica. Los créditos son del periodo actual (lo que se "
        "quiere predecir); las materias cursadas son del anterior y ya están dentro de la tasa "
        "de reprobación."),
}


def vif(X):
    """VIF de cada columna por mínimos cuadrados (con intercepto)."""
    n, k = X.shape
    resultado = []
    for j in range(k):
        y = X[:, j]
        otras = np.column_stack([np.ones(n), np.delete(X, j, axis=1)])
        coef, *_ = np.linalg.lstsq(otras, y, rcond=None)
        residuo = y - otras @ coef
        r2 = 1 - residuo.var() / y.var() if y.var() > 0 else 0.0
        resultado.append(float("inf") if r2 >= 1 else 1.0 / (1.0 - r2))
    return np.array(resultado)


def clasificar_vif(v):
    if v > VIF_GRAVE:
        return "grave"
    if v > VIF_MODERADO:
        return "moderada"
    return "ok"


def pares_altos(corr, nombres, umbral=UMBRAL_CORRELACION):
    pares = []
    for i in range(len(nombres)):
        for j in range(i + 1, len(nombres)):
            if abs(corr[i, j]) > umbral:
                pares.append((nombres[i], nombres[j], float(corr[i, j])))
    return sorted(pares, key=lambda t: -abs(t[2]))


def diagnostico(X, nombres):
    p = pearson(X)
    return {"nombres": list(nombres), "pearson": p.tolist(), "spearman": spearman(X).tolist(),
            "vif": dict(zip(nombres, vif(X).tolist())), "pares_altos": pares_altos(p, nombres)}


def resolver_colinealidad(X, nombres):
    """Quita variables redundantes hasta que no haya |r| > 0.8 ni VIF > 10.

    Devuelve (nombres_finales, decisiones). Cada decisión explica qué se quitó y por qué.
    """
    posicion = {n: i for i, n in enumerate(nombres)}
    nombres = list(nombres)
    decisiones = []
    while True:
        sub = X[:, [posicion[n] for n in nombres]]
        pares = pares_altos(pearson(sub), nombres)
        if pares:
            a, b, r = pares[0]
            if frozenset({a, b}) in PREFERENCIAS:
                queda, motivo = PREFERENCIAS[frozenset({a, b})]
            else:
                v = dict(zip(nombres, vif(sub)))
                queda = a if v[a] <= v[b] else b
                motivo = "Sin preferencia de dominio: se queda la de menor VIF."
            sale = b if queda == a else a
            decisiones.append({"par": [a, b], "correlacion": round(r, 3), "se_queda": queda,
                               "se_quita": sale, "motivo": motivo})
            nombres.remove(sale)
            continue
        v = vif(sub)
        if v.max() > VIF_GRAVE:
            sale = nombres[int(v.argmax())]
            decisiones.append({"par": [sale], "vif": round(float(v.max()), 2), "se_quita": sale,
                               "motivo": "VIF > 10 sin un par con |r| > 0.8: se quita la de mayor VIF."})
            nombres.remove(sale)
            continue
        return nombres, decisiones


# ---------------------------------------------------------------- después de entrenar
def importancia_permutacion(funcion_puntaje, X, y, repeticiones=5, semilla=2026):
    """Caída media del AUC al desordenar cada columna. Devuelve (media, desviación, auc_base)."""
    rng = np.random.default_rng(semilla)
    base = auc(y, funcion_puntaje(X))
    medias, desv = [], []
    for j in range(X.shape[1]):
        caidas = []
        for _ in range(repeticiones):
            Xp = X.copy()
            Xp[:, j] = rng.permutation(Xp[:, j])
            caidas.append(base - auc(y, funcion_puntaje(Xp)))
        medias.append(float(np.mean(caidas)))
        desv.append(float(np.std(caidas)))
    return np.array(medias), np.array(desv), base


def porcentajes(importancias):
    """Importancia como fracción del total (las caídas negativas cuentan como 0)."""
    imp = np.clip(np.asarray(importancias, float), 0, None)
    total = imp.sum()
    return imp / total if total > 0 else imp
