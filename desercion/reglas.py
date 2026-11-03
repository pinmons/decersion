"""Pasos 2 y 3 por reglas fijas: la línea base (equivale a contexto/sistema_v3.py)."""
from .contrato import ACCION_POR_NIVEL, aplica_r34

CORTE_ALTO = 60   # R3.1: puntaje >= 60
CORTE_MEDIO = 30  # R3.2: 30 <= puntaje < 60


def paso2_puntaje(e):
    """Devuelve (puntaje, factores, datos_no_informados) según R2.1 a R2.6."""
    p, factores, no_inf = 0, [], []
    prom = e["promedio_acumulado"]
    if prom < 3.0:
        p += 30; factores.append("promedio<3.0")
    elif prom < 3.5:
        p += 15; factores.append("3.0<=promedio<3.5")
    rep = e["materias_reprobadas"]
    if rep >= 2:
        p += 25; factores.append("reprobadas>=2")
    elif rep == 1:
        p += 10; factores.append("reprobadas=1")
    asis = e["porcentaje_asistencia"]
    if asis < 70:
        p += 20; factores.append("asistencia<70")
    elif asis < 85:
        p += 10; factores.append("70<=asistencia<85")
    if e["estrato"] <= 2:
        p += 10; factores.append("estrato<=2")
    if e["trabaja"] is True:
        p += 5; factores.append("trabaja")
    deuda = e.get("deuda_matricula")          # FIX R04: opcional, no se inventa
    if deuda is None:
        no_inf.append("deuda_matricula")
    elif deuda is True:
        p += 10; factores.append("deuda_matricula")
    return p, factores, no_inf


def paso3_decidir(e, p):
    """R3.4 se evalúa primero; luego los cortes R3.1 a R3.3."""
    if aplica_r34(e):                                  # FIX S14
        return "alto", ACCION_POR_NIVEL["alto"]
    if p >= CORTE_ALTO:
        return "alto", ACCION_POR_NIVEL["alto"]
    if p >= CORTE_MEDIO:
        return "medio", ACCION_POR_NIVEL["medio"]
    return "bajo", ACCION_POR_NIVEL["bajo"]


def calificar(e):
    """Pasos 2 y 3 sobre una entrada ya validada. Devuelve (salida, traza)."""
    p, factores, no_inf = paso2_puntaje(e)
    nivel, accion = paso3_decidir(e, p)
    salida = {"decision": "resultado", "nivel": nivel, "puntaje": p, "accion": accion,
              "factores": factores, "datos_no_informados": no_inf}
    return salida, {"S1": "valido", "S2": p, "S3": nivel}
