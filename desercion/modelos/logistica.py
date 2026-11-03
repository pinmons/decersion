"""Regresión logística desde cero: la red neuronal más simple (una neurona sigmoide).

    z = b + Σ_j w_j · x_j          (x ya estandarizado)
    p = sigmoide(z) = 1 / (1 + e^(-z))

Pérdida (entropía cruzada binaria con pesos por clase + L2):

    L = Σ_i s_i · [-(y_i·log p_i + (1-y_i)·log(1-p_i))] / Σ_i s_i  +  (λ/2)·Σ_j c_j·w_j²

    s_i = peso de la clase de i (los desertores pesan más porque son menos).
    c_j = multiplicador de L2 por variable (1 por defecto; se sube para frenar a una variable
          que domine: es la "penalización extra" del tope de dominancia).

Gradiente (lo que dice hacia dónde mover cada peso para bajar la pérdida):

    ∂L/∂w_j = Σ_i s_i·(p_i - y_i)·x_ij / Σ_i s_i  +  λ·c_j·w_j
    ∂L/∂b   = Σ_i s_i·(p_i - y_i)       / Σ_i s_i

Actualización por mini-lote (descenso de gradiente estocástico):  w ← w - η·∂L/∂w

`signos` (opcional) restringe el signo de cada peso: tras cada paso, un peso con signo
prohibido se lleva a 0 (gradiente proyectado). Sirve para garantizar monotonía.
"""
import numpy as np

from ..metricas import sigmoide


class RegresionLogistica:
    def __init__(self, n_variables, l2=1e-3, tasa_aprendizaje=0.1, l2_por_variable=None,
                 signos=None, semilla=0):
        rng = np.random.default_rng(semilla)
        self.w = rng.normal(0, 0.01, n_variables)
        self.b = 0.0
        self.l2 = l2
        self.eta = tasa_aprendizaje
        self.c = np.ones(n_variables) if l2_por_variable is None else np.asarray(l2_por_variable, float)
        self.signos = None if signos is None else np.asarray(signos, float)
        self._proyectar()

    # ---------------------------------------------------------------- predicción
    def logit(self, X):
        return X @ self.w + self.b

    def probabilidad(self, X, entrenando=False):
        return sigmoide(self.logit(X))

    # ---------------------------------------------------------------- aprendizaje
    def gradientes(self, X, y, s):
        p = self.probabilidad(X)
        error = s * (p - y) / s.sum()
        dw = X.T @ error + self.l2 * self.c * self.w
        db = error.sum()
        return dw, db

    def paso(self, X, y, s, rng=None):
        dw, db = self.gradientes(X, y, s)
        self.w -= self.eta * dw
        self.b -= self.eta * db
        self._proyectar()

    def _proyectar(self):
        if self.signos is not None:
            self.w = np.where(self.signos * self.w < 0, 0.0, self.w)

    def penalizacion(self):
        return 0.5 * self.l2 * float(np.sum(self.c * self.w ** 2))

    # ---------------------------------------------------------------- estado
    def copiar_estado(self):
        return {"w": self.w.copy(), "b": float(self.b)}

    def cargar_estado(self, estado):
        self.w = np.array(estado["w"], float)
        self.b = float(estado["b"])

    def norma_pesos(self):
        return float(np.linalg.norm(self.w))
