"""Convierte los pesos de la regresión logística en una tarjeta de puntaje 0–100.

1. Los pesos se aprendieron sobre variables estandarizadas: z = b + Σ w_j·(x_j - μ_j)/σ_j.
   Se pasan a unidades originales: β_j = w_j / σ_j  y  β_0 = b - Σ w_j·μ_j/σ_j.
2. Para cada variable se busca su aporte mínimo y máximo posible dentro del rango del
   contrato: m_j = min(β_j·lo_j, β_j·hi_j), M_j = max(...).
3. Puntos de la variable j:  puntos_j(x) = (β_j·x_j - m_j) · 100 / Σ_k (M_k - m_k).
   Cada variable aporta 0 en su valor de menor riesgo; la suma va de 0 a 100 para cualquier
   entrada válida.
4. El puntaje es una transformación lineal del logit: z = z_base + puntaje / escala. Por eso
   ordena a los estudiantes exactamente igual que la probabilidad del modelo.

Los cortes bajo/medio/alto no se fijan a mano: se eligen en VALIDACIÓN con un objetivo
explícito (ver `elegir_cortes`).
"""
import numpy as np

from .variables import CANDIDATAS

OBJETIVO_CORTES = {
    "recall_alto_min": 0.70,          # el nivel alto debe capturar ≥ 70 % de los desertores
    "fraccion_alto_max": 0.25,        # sin que más del 25 % de los estudiantes quede en alto
    "desertores_en_bajo_max": 0.10,   # en bajo queda como máximo el 10 % de los desertores
}


def construir(w, b, media, desviacion, nombres):
    w = np.asarray(w, float); mu = np.asarray(media, float); sd = np.asarray(desviacion, float)
    beta = w / sd
    beta0 = float(b - np.sum(w * mu / sd))
    lo = np.array([CANDIDATAS[n][0][0] for n in nombres], float)
    hi = np.array([CANDIDATAS[n][0][1] for n in nombres], float)
    minimo = np.minimum(beta * lo, beta * hi)
    maximo = np.maximum(beta * lo, beta * hi)
    rango = float(np.sum(maximo - minimo))
    escala = 100.0 / rango
    return {
        "variables": list(nombres),
        "beta": beta.tolist(),
        "intercepto": beta0,
        "aporte_minimo": minimo.tolist(),
        "aporte_maximo": maximo.tolist(),
        "escala": escala,
        "logit_base": beta0 + float(np.sum(minimo)),
        "puntos_maximos": ((maximo - minimo) * escala).tolist(),
        "valor_menor_riesgo": np.where(beta >= 0, lo, hi).tolist(),
    }


def puntos(tarjeta, X):
    """Puntos por variable (X en unidades originales, una fila por estudiante)."""
    X = np.atleast_2d(X)
    return (X * np.asarray(tarjeta["beta"]) - np.asarray(tarjeta["aporte_minimo"])) * tarjeta["escala"]


def puntaje(tarjeta, X):
    """Puntaje entero 0–100."""
    return np.clip(np.rint(puntos(tarjeta, X).sum(axis=1)), 0, 100).astype(int)


def logit_desde_puntos(tarjeta, total_puntos):
    return tarjeta["logit_base"] + np.asarray(total_puntos) / tarjeta["escala"]


def elegir_cortes(puntajes, y, objetivo=OBJETIVO_CORTES):
    """Elige corte_alto y corte_medio sobre puntajes enteros de VALIDACIÓN.

    alto  = el corte más alto que todavía captura ≥ recall_alto_min de los desertores
            (así se marca a la menor cantidad posible de estudiantes); luego se comprueba que
            no deje más de fraccion_alto_max de los estudiantes en alto.
    medio = el corte más alto (< alto) que deja en bajo como máximo desertores_en_bajo_max
            de los desertores.
    """
    puntajes = np.asarray(puntajes); y = np.asarray(y)
    n1 = y.sum()
    candidatos = []
    for c in range(0, 101):
        marcados = puntajes >= c
        recall = (marcados & (y == 1)).sum() / n1
        candidatos.append((c, float(recall), float(marcados.mean())))
    cumplen_recall = [t for t in candidatos if t[1] >= objetivo["recall_alto_min"]]
    corte_alto, recall_alto, frac_alto = max(cumplen_recall, key=lambda t: t[0])
    factible = frac_alto <= objetivo["fraccion_alto_max"]

    corte_medio = 0
    for c in range(corte_alto - 1, -1, -1):
        desertores_bajo = ((puntajes < c) & (y == 1)).sum() / n1
        if desertores_bajo <= objetivo["desertores_en_bajo_max"]:
            corte_medio = c
            break
    desertores_bajo = float(((puntajes < corte_medio) & (y == 1)).sum() / n1)
    return {
        "corte_medio": int(corte_medio), "corte_alto": int(corte_alto),
        "objetivo": dict(objetivo),
        "en_validacion": {
            "recall_alto": recall_alto, "fraccion_alto": frac_alto,
            "fraccion_medio": float(((puntajes >= corte_medio) & (puntajes < corte_alto)).mean()),
            "fraccion_bajo": float((puntajes < corte_medio).mean()),
            "desertores_en_bajo": desertores_bajo,
        },
        "objetivo_cumplido": bool(factible),
        "nota": ("Se cumplen las dos condiciones del nivel alto." if factible else
                 "No se pueden cumplir las dos condiciones a la vez: se priorizó el recall (≥ 70 %)."),
    }


def nivel(puntaje_, cortes):
    if puntaje_ >= cortes["corte_alto"]:
        return "alto"
    if puntaje_ >= cortes["corte_medio"]:
        return "medio"
    return "bajo"
