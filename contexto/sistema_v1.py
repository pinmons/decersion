"""Versión 1 – solo camino feliz (como suele quedar una primera versión).
No valida la entrada, no revisa población ni contradicciones y omite la regla de excepción R3.4."""


def paso2_puntaje(e):
    p = 0
    prom = e["promedio_acumulado"]
    if prom < 3.0:
        p += 30
    elif prom < 3.5:
        p += 15
    rep = e["materias_reprobadas"]
    if rep >= 2:
        p += 25
    elif rep == 1:
        p += 10
    asis = e["porcentaje_asistencia"]
    if asis < 70:
        p += 20
    elif asis < 85:
        p += 10
    if e["estrato"] <= 2:
        p += 10
    if e["trabaja"]:
        p += 5
    if e["deuda_matricula"]:
        p += 10
    return p


def paso3_decidir(p):
    if p >= 60:
        return "alto", "remision_bienestar_y_tutoria"
    if p >= 30:
        return "medio", "tutoria_academica"
    return "bajo", "seguimiento_rutinario"


def evaluar(e):
    traza = {"S1": "valido (sin validar)"}
    p = paso2_puntaje(e)
    traza["S2"] = p
    nivel, accion = paso3_decidir(p)
    traza["S3"] = nivel
    return {"decision": "resultado", "nivel": nivel, "puntaje": p, "accion": accion,
            "datos_no_informados": []}, traza
