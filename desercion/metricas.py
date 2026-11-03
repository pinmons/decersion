"""Métricas implementadas desde cero en NumPy (se verifican contra scikit-learn en pruebas)."""
import numpy as np

EPS = 1e-12


def sigmoide(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -40, 40)))


def pesos_por_clase(y):
    """Pesos para que las dos clases pesen lo mismo en la pérdida: n / (2·n_clase)."""
    n, n1 = len(y), y.sum()
    return {"positivo": n / (2 * n1), "negativo": n / (2 * (n - n1))}


def pesos_muestra(y, pesos_clase):
    return np.where(y == 1, pesos_clase["positivo"], pesos_clase["negativo"])


def entropia_cruzada(y, p, pesos=None):
    """Log-loss (entropía cruzada binaria), opcionalmente ponderada por muestra."""
    p = np.clip(p, EPS, 1 - EPS)
    perdidas = -(y * np.log(p) + (1 - y) * np.log(1 - p))
    if pesos is None:
        return float(perdidas.mean())
    return float((pesos * perdidas).sum() / pesos.sum())


def brier(y, p):
    return float(np.mean((p - y) ** 2))


def _rangos_promedio(x):
    """Rangos 1..n; los empates reciben el rango promedio."""
    orden = np.argsort(x, kind="mergesort")
    xs = x[orden]
    rangos = np.empty(len(x))
    i = 0
    while i < len(x):
        j = i
        while j + 1 < len(x) and xs[j + 1] == xs[i]:
            j += 1
        rangos[orden[i:j + 1]] = (i + j) / 2 + 1
        i = j + 1
    return rangos


def auc(y, puntaje):
    """AUC-ROC por la fórmula de Mann-Whitney: P(puntaje desertor > puntaje no desertor)."""
    y = np.asarray(y)
    n1 = y.sum()
    n0 = len(y) - n1
    if n1 == 0 or n0 == 0:
        return float("nan")
    r = _rangos_promedio(np.asarray(puntaje, float))
    return float((r[y == 1].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


def clasificacion(y, positivo):
    """Accuracy, recall y precisión con una predicción binaria (`positivo` = marcado en riesgo)."""
    y = np.asarray(y).astype(bool)
    positivo = np.asarray(positivo).astype(bool)
    vp = int((y & positivo).sum()); fp = int((~y & positivo).sum())
    fn = int((y & ~positivo).sum()); vn = int((~y & ~positivo).sum())
    return {
        "accuracy": (vp + vn) / len(y),
        "recall": vp / (vp + fn) if vp + fn else float("nan"),
        "precision": vp / (vp + fp) if vp + fp else float("nan"),
        "vp": vp, "fp": fp, "fn": fn, "vn": vn,
    }


def pearson(X):
    return np.corrcoef(X, rowvar=False)


def spearman(X):
    return pearson(np.column_stack([_rangos_promedio(X[:, j]) for j in range(X.shape[1])]))


def curva_calibracion(y, p, n_bins=10):
    """Agrupa por deciles de probabilidad predicha: (prob. media predicha, tasa real, n)."""
    orden = np.argsort(p)
    grupos = np.array_split(orden, n_bins)
    return [(float(p[g].mean()), float(y[g].mean()), int(len(g))) for g in grupos if len(g)]
