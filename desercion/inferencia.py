"""Modo aprendido: califica una entrada YA VALIDADA con los pesos guardados en JSON.

Solo depende de NumPy (es lo que corre en Vercel). Lo llama `sistema.evaluar(modo="aprendido")`
después del Paso 1, así que las garantías del contrato se cumplen igual que en modo reglas.

- logistica    → tarjeta de puntaje 0–100; factores = variables que suman puntos.
- red_neuronal → puntaje = round(100 × probabilidad); factores = cuánto baja el puntaje si la
                 variable se reemplaza por su media de entrenamiento.
- En los dos: R3.4 fuerza el nivel alto; la deuda ausente se reporta en
  `datos_no_informados` y se imputa el valor que NO reduce el riesgo.
- Contrato ampliado (pesos de la base real con la clave "ampliado" en el JSON): antes de calificar se
  validan los campos ampliados (`contrato_ampliado.validar`: error o abstención controlados) y los que
  faltan se imputan con la mediana de entrenamiento guardada en el JSON (con su indicadora) y se listan
  en `datos_no_informados`. Los pesos sintéticos no tienen esa clave: no cambia nada para ellos.
"""
import json

import numpy as np

from . import RAIZ
from .contrato import ACCION_POR_NIVEL, aplica_r34
from .variables import vector

DIR_MODELOS = RAIZ / "modelos_entrenados"
_CACHE = {}


ORIGENES = (None, "real")  # None = corrida principal (datos sintéticos); "real" = base real


def cargar(nombre, origen=None):
    clave = (origen, nombre)
    if clave not in _CACHE:
        ruta = (DIR_MODELOS / origen if origen else DIR_MODELOS) / f"{nombre}.json"
        _CACHE[clave] = json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else None
    return _CACHE[clave]


def _sigmoide(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -40, 40)))


def _nivel(puntaje, cortes, e):
    if aplica_r34(e):
        return "alto", True
    if puntaje >= cortes["corte_alto"]:
        return "alto", False
    if puntaje >= cortes["corte_medio"]:
        return "medio", False
    return "bajo", False


def _logit_red(m, X):
    a = (X - np.asarray(m["escalador"]["media"])) / np.asarray(m["escalador"]["desviacion"])
    for k in range(len(m["W"]) - 1):
        a = np.maximum(a @ np.asarray(m["W"][k]) + np.asarray(m["b"][k]), 0)
    return (a @ np.asarray(m["W"][-1]) + np.asarray(m["b"][-1]))[:, 0]


def _calificar_logistica(e, m):
    t = m["tarjeta"]
    x = vector(e, m["variables"], deuda_si_falta=m["deuda_si_falta"], aux=m.get("ampliado"))
    pts = (x * np.asarray(t["beta"]) - np.asarray(t["aporte_minimo"])) * t["escala"]
    total = float(pts.sum())
    puntaje = int(np.clip(np.rint(total), 0, 100))
    prob = float(_sigmoide(t["logit_base"] + total / t["escala"] - m["ajuste_prior"]))
    detalle = {v: round(float(p), 1) for v, p in zip(m["variables"], pts)}
    return puntaje, prob, detalle


def _calificar_red(e, m):
    nombres = m["variables"]
    aux = m.get("ampliado")
    if e.get("deuda_matricula") is None and "deuda_matricula" in nombres:
        X = np.array([vector(e, nombres, 0, aux), vector(e, nombres, 1, aux)])
    else:
        X = np.array([vector(e, nombres, aux=aux)])
    probs = _sigmoide(_logit_red(m, X) - m["ajuste_prior"])
    i = int(np.argmax(probs))  # deuda ausente: la imputación que da más riesgo
    prob = float(probs[i])
    puntaje = int(np.clip(np.rint(100 * prob), 0, 100))
    # influencia: cuánto cambia el puntaje si la variable toma el valor medio de train
    base = X[i]
    alternativas = np.repeat(base[None, :], len(nombres), axis=0)
    alternativas[np.arange(len(nombres)), np.arange(len(nombres))] = m["medias_train"]
    p_alt = _sigmoide(_logit_red(m, alternativas) - m["ajuste_prior"])
    detalle = {v: round(float(100 * (prob - pa)), 1) for v, pa in zip(nombres, p_alt)}
    return puntaje, prob, detalle


def calificar(e, modelo="logistica", origen=None):
    """Pasos 2 y 3 del modo aprendido. Devuelve (salida, traza).

    `origen` elige con qué datos se entrenaron los pesos: None (sintéticos) o "real".
    """
    if modelo not in ("logistica", "red_neuronal") or origen not in ORIGENES:
        return ({"decision": "error", "motivo": "modelo_no_valido", "detalle": str(modelo)},
                {"S1": "valido", "S2": "-", "S3": "-"})
    m = cargar(modelo, origen)
    if m is None:
        return ({"decision": "error", "motivo": "modelo_no_disponible",
                 "detalle": "Falta modelos_entrenados/. Ejecute: python -m desercion.entrenamiento"},
                {"S1": "valido", "S2": "-", "S3": "-"})
    if m.get("ampliado") is not None:
        from .contrato_ampliado import validar
        s = validar(e)
        if s is not None:
            return s, {"S1": f"{s['decision']}({s['motivo']}, ampliado)", "S2": "-", "S3": "-"}
    if modelo == "logistica":
        puntaje, prob, detalle = _calificar_logistica(e, m)
    else:
        puntaje, prob, detalle = _calificar_red(e, m)
    nivel, por_r34 = _nivel(puntaje, m["cortes"], e)
    factores = [f"{v}: {'+' if p >= 0 else ''}{round(p)}" for v, p in
                sorted(detalle.items(), key=lambda kv: -kv[1]) if round(p) >= 1]
    no_inf = ["deuda_matricula"] if e.get("deuda_matricula") is None else []
    if m.get("ampliado") is not None:
        from .contrato_ampliado import faltantes
        no_inf += faltantes(e, m["variables"])
    salida = {"decision": "resultado", "nivel": nivel, "puntaje": puntaje, "accion": ACCION_POR_NIVEL[nivel],
              "factores": factores, "datos_no_informados": no_inf,
              "modo": "aprendido", "modelo": modelo, "probabilidad": round(prob, 4),
              "puntos_por_variable": detalle, "cortes": dict(m["cortes"]), "regla_r34": por_r34}
    return salida, {"S1": "valido", "S2": puntaje, "S3": nivel + (" (R3.4)" if por_r34 else "")}
