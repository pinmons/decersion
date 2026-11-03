"""División train/validación/test y estandarización.

Por qué se estandariza (media 0, desviación 1): el gradiente de cada peso es proporcional al
valor de su variable. Sin escalar, la asistencia (0–100) produciría gradientes ~20 veces más
grandes que el promedio (0–5), y la regularización L2 castigaría distinto a cada variable
según sus unidades. Escaladas, todas compiten en igualdad de condiciones.

La media y la desviación se calculan SOLO con el conjunto de entrenamiento; validación y test
se transforman con esos mismos números. Si se usaran todos los datos, información del test
se filtraría al entrenamiento.
"""
import numpy as np


def dividir_estratificado(y, fracciones=(0.70, 0.15, 0.15), semilla=2026):
    """Índices de train, validación y test, con la misma tasa de la etiqueta en cada uno."""
    rng = np.random.default_rng(semilla)
    partes = ([], [], [])
    for clase in np.unique(y):
        idx = rng.permutation(np.flatnonzero(y == clase))
        n = len(idx)
        n_tr = round(n * fracciones[0])
        n_va = round(n * fracciones[1])
        partes[0].extend(idx[:n_tr])
        partes[1].extend(idx[n_tr:n_tr + n_va])
        partes[2].extend(idx[n_tr + n_va:])
    return tuple(np.sort(np.array(p)) for p in partes)


class Escalador:
    """Estandarización con parámetros aprendidos solo en train."""

    def __init__(self, media=None, desviacion=None):
        self.media = None if media is None else np.asarray(media, float)
        self.desviacion = None if desviacion is None else np.asarray(desviacion, float)

    def ajustar(self, X):
        self.media = X.mean(axis=0)
        sd = X.std(axis=0)
        self.desviacion = np.where(sd > 0, sd, 1.0)
        return self

    def transformar(self, X):
        return (X - self.media) / self.desviacion

    def a_dict(self):
        return {"media": self.media.tolist(), "desviacion": self.desviacion.tolist()}

    @classmethod
    def desde_dict(cls, d):
        return cls(d["media"], d["desviacion"])
