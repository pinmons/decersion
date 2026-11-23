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
VIF_MAXIMO = 999.0
TOPE_DOMINANCIA = 0.35  # [SUPUESTO, ajustable]
# Dos variables con |r| ≥ 0.5 cuentan como un mismo grupo para el tope [SUPUESTO]: si dicen casi lo mismo,
# al desordenar una la otra la suple, y cada una por separado parece pesar poco aunque juntas lo decidan todo.
UMBRAL_GRUPO = 0.5

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
    frozenset({"nota_acceso", "nota_bachillerato"}): (
        "nota_acceso",
        "Contrato ampliado: la nota de acceso ya contiene la del bachillerato (es su media más la prueba de acceso) "
        "y sola ordena mejor a quien abandona."),
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
        # Tope 999: dos variables que son la misma (r = 1) darían infinito, que no cabe en JSON ni en una gráfica.
        resultado.append(VIF_MAXIMO if r2 >= 1 else min(VIF_MAXIMO, 1.0 / (1.0 - r2)))
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


def resolver_colinealidad(X, nombres, preferir=None):
    """Quita variables redundantes hasta que no haya |r| > 0.8 ni VIF > 10.

    `preferir` (contrato ampliado): en un par sin preferencia de dominio, si una variable está en ese conjunto
    (las del contrato original) y la otra no, se queda la del contrato: el contrato manda y la otra dice casi lo mismo.
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
            elif preferir is not None and (a in preferir) != (b in preferir):
                queda = a if a in preferir else b
                motivo = ("Contrato ampliado: dicen casi lo mismo y una es del contrato original. Se queda la del "
                          "contrato (es la que se valida en el Paso 1 y la que se explica en la ficha).")
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


def grupos_correlacionados(X, nombres, umbral=UMBRAL_GRUPO):
    """Grupos de variables unidas por |Pearson| ≥ umbral (componentes conexas). Lista de listas de índices."""
    r = pearson(X)
    k = len(nombres)
    grupo = list(range(k))

    def raiz(i):
        while grupo[i] != i:
            i = grupo[i]
        return i
    for i in range(k):
        for j in range(i + 1, k):
            if abs(r[i, j]) >= umbral:
                grupo[raiz(j)] = raiz(i)
    salida = {}
    for i in range(k):
        salida.setdefault(raiz(i), []).append(i)
    return sorted(salida.values(), key=lambda g: g[0])


def grupos_por_fuente(X, nombres, fuente_de, umbral=UMBRAL_GRUPO):
    """Grupos fijos por FUENTE del dato (notas, actividad, admisión, titulación), unidos además si una variable de
    una fuente tiene |r| ≥ umbral con una de otra (así ninguna fuente puede suplir a otra al desordenarla).
    Devuelve (grupos como listas de índices, fuente de cada grupo, pares entre fuentes que obligaron a unir)."""
    k = len(nombres)
    grupo = list(range(k))

    def raiz(i):
        while grupo[i] != i:
            i = grupo[i]
        return i
    r = pearson(X)
    cruzados = []
    for i in range(k):
        for j in range(i + 1, k):
            misma = fuente_de(nombres[i]) == fuente_de(nombres[j])
            if misma or abs(r[i, j]) >= umbral:
                grupo[raiz(j)] = raiz(i)
                if not misma:
                    cruzados.append((nombres[i], nombres[j], float(r[i, j])))
    salida = {}
    for i in range(k):
        salida.setdefault(raiz(i), []).append(i)
    grupos = sorted(salida.values(), key=lambda g: g[0])
    fuentes = [" + ".join(sorted({fuente_de(nombres[i]) for i in g})) for g in grupos]
    return grupos, fuentes, cruzados


def importancia_permutacion_grupos(funcion_puntaje, X, y, grupos, repeticiones=5, semilla=2026):
    """Como importancia_permutacion, pero desordena juntas (con la misma permutación) las columnas de cada grupo."""
    rng = np.random.default_rng(semilla)
    base = auc(y, funcion_puntaje(X))
    medias, desv = [], []
    for g in grupos:
        caidas = []
        for _ in range(repeticiones):
            Xp = X.copy()
            Xp[:, g] = Xp[rng.permutation(len(Xp))][:, g]
            caidas.append(base - auc(y, funcion_puntaje(Xp)))
        medias.append(float(np.mean(caidas)))
        desv.append(float(np.std(caidas)))
    return np.array(medias), np.array(desv), base


def una_variable(X, y, nombres, signos=None):
    """AUC de cada variable usada sola como puntaje. El sentido (sube o baja el riesgo) se fija con `signos`
    (calculados en train) o, si no se dan, con estos mismos datos. Devuelve (aucs, signos, nombre de la mejor)."""
    aucs, sentido = [], []
    for j in range(X.shape[1]):
        a = auc(y, X[:, j])
        s = (1 if a >= 0.5 else -1) if signos is None else signos[j]
        sentido.append(s)
        aucs.append(a if s == 1 else 1 - a)
    mejor = int(np.argmax(aucs))
    return np.array(aucs), sentido, nombres[mejor]


def porcentajes(importancias):
    """Importancia como fracción del total (las caídas negativas cuentan como 0)."""
    imp = np.clip(np.asarray(importancias, float), 0, None)
    total = imp.sum()
    return imp / total if total > 0 else imp
