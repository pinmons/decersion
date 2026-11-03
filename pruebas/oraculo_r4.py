"""Oráculo de la ronda 4 – BORRADOR para que el equipo lo revise y firme.

Se escribió APARTE de los casos (casos_r4.py) y antes de correrlos. Con pesos aprendidos el
puntaje exacto no se puede fijar de antemano, así que cada respuesta esperada es una
PROPIEDAD que cualquier modelo razonable debe cumplir. Los oráculos de las rondas 1 a 3 NO se
modifican: los casos con resultado se verifican con propiedades en `PROPIEDADES_CONTRATO`.

Vocabulario:
  "riesgo de A ≥ riesgo de B" = puntaje(A) ≥ puntaje(B) y nivel(A) ≥ nivel(B)
                                 (orden de niveles: bajo < medio < alto).
"""

# Propiedades sobre los casos del contrato con resultado (R01–R05, S12–S14, T11, T13–T15)
CASOS_CON_RESULTADO = ["R01", "R02", "R03", "R04", "R05", "S12", "S13", "S14", "T11", "T13", "T14", "T15"]

PROPIEDADES_CONTRATO = [
    {"id": "P01", "nombre": "Orden de los casos reales",
     "esperado": "riesgo(R03) > riesgo(R02) > riesgo(R01) (puntaje estrictamente mayor)",
     "regla": "R03 tiene todos los factores de riesgo, R02 varios moderados, R01 ninguno."},
    {"id": "P02", "nombre": "Monotonía del promedio",
     "esperado": "en los 12 casos con resultado, bajar el promedio paso a paso (hasta 0.0) nunca reduce el riesgo",
     "regla": "Prompt Fase 7: bajar el promedio nunca reduce el riesgo si lo demás se mantiene."},
    {"id": "P03", "nombre": "Monotonía de las materias perdidas",
     "esperado": "en los 12 casos, subir las materias perdidas de una en una (hasta las cursadas) nunca reduce el riesgo",
     "regla": "Prompt Fase 7."},
    {"id": "P04", "nombre": "Monotonía de la asistencia",
     "esperado": "en los 12 casos, bajar la asistencia paso a paso (hasta 2 %, para no entrar en C3) nunca reduce el riesgo",
     "regla": "Prompt Fase 7."},
    {"id": "P05", "nombre": "R3.4 se mantiene", "esperado": "S14 sale en nivel alto",
     "regla": "R3.4: promedio < 3.0 y asistencia < 70 → alto, en ambos modos."},
    {"id": "P06", "nombre": "Deuda ausente informada", "esperado": "R04 reporta deuda_matricula en datos_no_informados",
     "regla": "R2.6 / garantía 2: no se inventan datos."},
    {"id": "P07", "nombre": "Siempre un resultado válido",
     "esperado": "los 12 casos con resultado devuelven decision = resultado y un puntaje entero entre 0 y 100",
     "regla": "Garantías del contrato."},
]

# Oráculo de los casos nuevos U01–U15
ORACULO_R4 = {
    "U01": {"comprobaciones": [("riesgo_mayor_o_igual", "R02")], "regla": "Monotonía del promedio respecto a R02."},
    "U02": {"comprobaciones": [("riesgo_mayor_o_igual", "R05")], "regla": "Monotonía de materias perdidas respecto a R05."},
    "U03": {"comprobaciones": [("riesgo_mayor_o_igual", "R02")], "regla": "Monotonía de la asistencia respecto a R02."},
    "U04": {"comprobaciones": [("riesgo_mayor_o_igual", "pareja")],
            "regla": "Asistencia 20 % no puede dar menos riesgo que 30 %, aunque ninguna de las dos se vio al entrenar."},
    "U05": {"comprobaciones": [("nivel_no_bajo", None)],
            "regla": "[SUPUESTO del oráculo] Un promedio de 0.0 no puede quedar en riesgo bajo aunque lo demás sea normal."},
    "U06": {"comprobaciones": [("nivel_no_bajo", None)],
            "regla": "[SUPUESTO del oráculo] Una asistencia de 0 % no puede quedar en riesgo bajo."},
    "U07": {"comprobaciones": [("nivel_no_bajo", None)],
            "regla": "[SUPUESTO del oráculo] Perder todas las materias no puede quedar en bajo, aunque el promedio sea alto."},
    "U08": {"comprobaciones": [("riesgo_mayor_o_igual", "pareja"), ("nivel_no_bajo", None)],
            "regla": "Promedio 1.5 da al menos el riesgo del mismo estudiante con 3.8, y no queda en bajo."},
    "U09": {"comprobaciones": [("riesgo_mayor_o_igual", "pareja")],
            "regla": "Sumar dos factores de riesgo (trabaja, deuda) no reduce el riesgo, aunque la combinación sea rara."},
    "U10": {"comprobaciones": [("puntaje_en_rango", None)], "regla": "Garantías: resultado con puntaje entre 0 y 100."},
    "U11": {"comprobaciones": [("puntaje_en_rango", None), ("nivel_alto", None)],
            "regla": "Garantías + R3.4 (promedio 0 y asistencia 0)."},
    "U12": {"comprobaciones": [("continuidad", "pareja"), ("riesgo_mayor_o_igual", "pareja")],
            "regla": "[SUPUESTO del oráculo] Una centésima de promedio cambia el puntaje en 2 puntos o menos, y no lo baja."},
    "U13": {"comprobaciones": [("continuidad", "pareja"), ("riesgo_mayor_o_igual", "pareja")],
            "regla": "[SUPUESTO del oráculo] Una décima de asistencia cambia el puntaje en 2 puntos o menos, y no lo baja."},
    "U14": {"comprobaciones": [("riesgo_mayor_o_igual", "pareja"), ("no_informado", "deuda_matricula")],
            "regla": "Garantía 2: la deuda ausente se reporta y no puede dar menos riesgo que 'sin deuda'."},
    "U15": {"comprobaciones": [("riesgo_mayor_o_igual", "pareja")], "regla": "Monotonía de trabaja."},
}

UMBRAL_CONTINUIDAD = 2  # puntos
