"""Red neuronal multicapa (MLP) desde cero: n → 16 → 8 → 1.

Forward (capa por capa):
    a0 = x
    z1 = a0·W1 + b1,  a1 = ReLU(z1) · máscara_dropout1 / (1 - p)
    z2 = a1·W2 + b2,  a2 = ReLU(z2) · máscara_dropout2 / (1 - p)
    z3 = a2·W3 + b3,  ŷ  = sigmoide(z3)

Backpropagation (regla de la cadena, de la salida hacia la entrada):
    δ3 = s·(ŷ - y)/Σs                       (sigmoide + entropía cruzada se simplifican)
    ∂W3 = a2ᵀ·δ3 + λ·W3
    δ2 = (δ3·W3ᵀ) ⊙ máscara2/(1-p) ⊙ [z2 > 0]
    ∂W2 = a1ᵀ·δ2 + λ·W2
    δ1 = (δ2·W2ᵀ) ⊙ máscara1/(1-p) ⊙ [z1 > 0]
    ∂W1 = a0ᵀ·δ1 + λ·W1

Optimizador: Adam (promedios móviles del gradiente y de su cuadrado, con corrección de sesgo).
Inicialización He: W ~ N(0, 2/n_entrada), adecuada para ReLU.
Dropout (solo al entrenar, "invertido"): apaga neuronas al azar para que la red no dependa
de un solo camino ni de una sola variable.

Versión 2 – red monótona (corrección de la falla P04 de la ronda 4):
`signos_entrada[j]` = +1 si la variable j solo puede subir el riesgo, -1 si solo puede bajarlo
y 0 si es libre. Tras cada paso de Adam se proyectan los pesos:
    W1[j, :] con el signo indicado para las variables restringidas,
    W2 ≥ 0 y W3 ≥ 0.
Como ReLU es creciente, la composición de capas con pesos ≥ 0 es creciente, así que la salida
es monótona en las variables restringidas POR CONSTRUCCIÓN (no depende de los datos vistos).
Las variables libres conservan cualquier signo en W1.
"""
import numpy as np

from ..metricas import sigmoide


class RedNeuronal:
    def __init__(self, n_variables, capas=(16, 8), l2=1e-4, tasa_aprendizaje=1e-3,
                 dropout=0.2, signos_entrada=None, semilla=0):
        self.rng = np.random.default_rng(semilla)
        tamanos = [n_variables, *capas, 1]
        self.W = [self.rng.normal(0, np.sqrt(2.0 / tamanos[i]), (tamanos[i], tamanos[i + 1]))
                  for i in range(len(tamanos) - 1)]
        self.signos = None if signos_entrada is None else np.asarray(signos_entrada, float)
        if self.monotona:
            self.W = [self.W[0]] + [np.abs(W) for W in self.W[1:]]
            self._proyectar()
        self.b = [np.zeros(t) for t in tamanos[1:]]
        self.l2 = l2
        self.eta = tasa_aprendizaje
        self.dropout = dropout
        self.capas = list(capas)
        # estado de Adam
        self.m = [np.zeros_like(p) for p in self.W + self.b]
        self.v = [np.zeros_like(p) for p in self.W + self.b]
        self.t = 0

    # ---------------------------------------------------------------- forward
    def _forward(self, X, entrenando):
        cache = {"a": [X], "z": [], "mascaras": []}
        a = X
        for k in range(len(self.W) - 1):
            z = a @ self.W[k] + self.b[k]
            a = np.maximum(z, 0)
            if entrenando and self.dropout > 0:
                mascara = (self.rng.random(a.shape) >= self.dropout) / (1 - self.dropout)
            else:
                mascara = np.ones_like(a)
            a = a * mascara
            cache["z"].append(z); cache["mascaras"].append(mascara); cache["a"].append(a)
        z = a @ self.W[-1] + self.b[-1]
        cache["z"].append(z)
        return sigmoide(z[:, 0]), cache

    def logit(self, X):
        return self._forward(X, False)[1]["z"][-1][:, 0]

    def probabilidad(self, X, entrenando=False):
        return self._forward(X, entrenando)[0]

    # ---------------------------------------------------------------- backward
    def gradientes(self, X, y, s, entrenando=True):
        p, cache = self._forward(X, entrenando)
        delta = (s * (p - y) / s.sum())[:, None]
        gW, gb = [None] * len(self.W), [None] * len(self.b)
        for k in range(len(self.W) - 1, -1, -1):
            gW[k] = cache["a"][k].T @ delta + self.l2 * self.W[k]
            gb[k] = delta.sum(axis=0)
            if k > 0:
                delta = (delta @ self.W[k].T) * cache["mascaras"][k - 1] * (cache["z"][k - 1] > 0)
        return gW, gb

    def paso(self, X, y, s, rng=None, beta1=0.9, beta2=0.999, eps=1e-8):
        gW, gb = self.gradientes(X, y, s)
        self.t += 1
        params = self.W + self.b
        grads = gW + gb
        for i, (p, g) in enumerate(zip(params, grads)):
            self.m[i] = beta1 * self.m[i] + (1 - beta1) * g
            self.v[i] = beta2 * self.v[i] + (1 - beta2) * g ** 2
            m_hat = self.m[i] / (1 - beta1 ** self.t)
            v_hat = self.v[i] / (1 - beta2 ** self.t)
            p -= self.eta * m_hat / (np.sqrt(v_hat) + eps)
        self._proyectar()

    @property
    def monotona(self):
        return self.signos is not None and bool(np.any(self.signos != 0))

    def _proyectar(self):
        """Lleva a 0 los pesos que romperían la monotonía (gradiente proyectado)."""
        if not self.monotona:
            return
        s = self.signos[:, None]
        self.W[0][:] = np.where((s != 0) & (s * self.W[0] < 0), 0.0, self.W[0])
        for W in self.W[1:]:
            np.maximum(W, 0.0, out=W)

    def penalizacion(self):
        return 0.5 * self.l2 * float(sum(np.sum(W ** 2) for W in self.W))

    # ---------------------------------------------------------------- estado
    def copiar_estado(self):
        return {"W": [W.copy() for W in self.W], "b": [b.copy() for b in self.b]}

    def cargar_estado(self, estado):
        self.W = [np.array(W, float) for W in estado["W"]]
        self.b = [np.array(b, float) for b in estado["b"]]

    def norma_pesos(self):
        return float(np.sqrt(sum(np.sum(W ** 2) for W in self.W)))

    def a_dict(self):
        return {"capas": self.capas, "W": [W.tolist() for W in self.W], "b": [b.tolist() for b in self.b],
                "signos_entrada": None if self.signos is None else self.signos.tolist()}


def logit_desde_dict(d, X):
    """Forward sin dropout a partir de pesos guardados; devuelve el logit (lo usa la inferencia)."""
    a = X
    W, b = d["W"], d["b"]
    for k in range(len(W) - 1):
        a = np.maximum(a @ np.asarray(W[k]) + np.asarray(b[k]), 0)
    z = a @ np.asarray(W[-1]) + np.asarray(b[-1])
    return z[:, 0]
