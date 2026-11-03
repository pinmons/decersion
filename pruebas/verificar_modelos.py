"""Verifica que la implementación desde cero es correcta.

1. Gradientes analíticos (backprop) contra gradientes numéricos por diferencias finitas,
   en la regresión logística y en la MLP (sin dropout para que sea determinista).
2. AUC, log-loss y Brier propios contra scikit-learn (solo se usa para verificar).

Uso: python pruebas/verificar_modelos.py      (termina con código 1 si algo no coincide)
"""
import sys

import numpy as np

import rutas  # noqa: F401
from desercion.metricas import auc, entropia_cruzada, brier, pesos_por_clase, pesos_muestra
from desercion.modelos.logistica import RegresionLogistica
from desercion.modelos.red_neuronal import RedNeuronal

TOLERANCIA = 1e-6


def perdida_total(modelo, X, y, s):
    return entropia_cruzada(y, modelo.probabilidad(X), s) + modelo.penalizacion()


def gradiente_numerico(modelo, params, X, y, s, h=1e-6):
    numericos = []
    for p in params:
        g = np.zeros_like(p)
        it = np.nditer(p, flags=["multi_index"])
        for _ in it:
            i = it.multi_index
            orig = p[i]
            p[i] = orig + h; arriba = perdida_total(modelo, X, y, s)
            p[i] = orig - h; abajo = perdida_total(modelo, X, y, s)
            p[i] = orig
            g[i] = (arriba - abajo) / (2 * h)
        numericos.append(g)
    return numericos


def error_relativo(a, b):
    return float(np.max(np.abs(a - b) / np.maximum(1e-8, np.abs(a) + np.abs(b))))


def main():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(40, 5))
    y = (rng.random(40) < 0.3).astype(float)
    s = pesos_muestra(y, pesos_por_clase(y))
    fallas = 0

    # Logística: w es un arreglo; b se envuelve para poder perturbarlo
    log = RegresionLogistica(5, l2=0.01, semilla=1)
    log.w = rng.normal(size=5)
    dw, db = log.gradientes(X, y, s)
    num_w = gradiente_numerico(log, [log.w], X, y, s)[0]
    caja_b = np.array([log.b])

    class Envoltura:
        def probabilidad(self, X_):
            log.b = caja_b[0]
            return log.probabilidad(X_)

        def penalizacion(self):
            return log.penalizacion()
    num_b = gradiente_numerico(Envoltura(), [caja_b], X, y, s)[0][0]
    e1 = max(error_relativo(dw, num_w), error_relativo(np.array([db]), np.array([num_b])))
    print(f"Logística   – error relativo máx. del gradiente: {e1:.2e}")
    fallas += e1 > TOLERANCIA

    red = RedNeuronal(5, capas=(4, 3), l2=0.01, dropout=0.0, semilla=2)
    # Sesgos aleatorios: con sesgos en 0, una muestra con toda la capa 1 apagada deja z2 = 0
    # exactamente, en el pliegue de ReLU, donde la diferencia finita no es válida.
    red.b = [rng.normal(0, 0.1, b.shape) for b in red.b]
    gW, gb = red.gradientes(X, y, s, entrenando=False)
    numericos = gradiente_numerico(red, red.W + red.b, X, y, s)
    e2 = max(error_relativo(a, b) for a, b in zip(gW + gb, numericos))
    print(f"Red neuronal – error relativo máx. del gradiente (backprop): {e2:.2e}")
    fallas += e2 > TOLERANCIA

    try:
        from sklearn.metrics import roc_auc_score, log_loss, brier_score_loss
        y2 = (rng.random(3000) < 0.2).astype(int)
        p2 = np.clip(0.2 + 0.3 * y2 + rng.normal(0, 0.2, 3000), 0.01, 0.99).round(2)  # con empates
        comparaciones = [("AUC", auc(y2, p2), roc_auc_score(y2, p2)),
                         ("Log-loss", entropia_cruzada(y2, p2), log_loss(y2, p2)),
                         ("Brier", brier(y2, p2), brier_score_loss(y2, p2))]
        for nombre, propio, sk in comparaciones:
            dif = abs(propio - sk)
            print(f"{nombre:9s} propio {propio:.6f} | scikit-learn {sk:.6f} | diferencia {dif:.1e}")
            fallas += dif > 1e-9
    except ImportError:
        print("scikit-learn no está instalado: se omite la comparación de métricas.")

    print("VERIFICACIÓN:", "OK" if not fallas else f"{fallas} FALLAS")
    return fallas


if __name__ == "__main__":
    sys.exit(1 if main() else 0)
