"""Versión 2 – implementa el contrato completo (Pasos 1, 2 y 3). Sin librerías externas.
Garantías: nunca lanza excepción; no inventa datos faltantes; no califica fuera de población;
umbrales inclusivos tal como están escritos."""
import math

# campo: (tipo, rango_o_valores, obligatorio)
ESQUEMA = {
    "id_estudiante": ("str", None, True),
    "nivel_formacion": ("enum", {"pregrado", "posgrado", "educacion_continua"}, True),
    "estado_matricula": ("enum", {"activo", "retirado", "graduado"}, True),
    "semestre": ("int", (1, 12), True),
    "promedio_acumulado": ("num", (0.0, 5.0), True),
    "creditos_inscritos": ("int", (0, 25), True),
    "materias_cursadas_periodo_anterior": ("int", (0, 12), True),
    "materias_reprobadas": ("int", (0, 12), True),
    "porcentaje_asistencia": ("num", (0.0, 100.0), True),
    "estrato": ("int", (1, 6), True),
    "trabaja": ("bool", None, True),
    "deuda_matricula": ("bool", None, False),
}


def _tipo_ok(tipo, v):
    if tipo == "bool":
        return isinstance(v, bool)
    if tipo == "int":                      # FIX S15: bool es subclase de int
        return isinstance(v, int) and not isinstance(v, bool)
    if tipo == "num":
        return (isinstance(v, (int, float)) and not isinstance(v, bool)
                and not math.isnan(v) and not math.isinf(v))
    if tipo in ("str", "enum"):
        return isinstance(v, str) and (tipo == "enum" or v.strip() != "")
    return False


def paso1_validar(e):
    if not isinstance(e, dict):
        return {"decision": "error", "motivo": "tipo_invalido", "campo": "<entrada>"}
    # R1.1 formato de los campos presentes (null se trata como faltante, no como error)
    for campo, (tipo, regla, _) in ESQUEMA.items():
        if campo not in e or e[campo] is None:
            continue
        v = e[campo]
        if not _tipo_ok(tipo, v):
            return {"decision": "error", "motivo": "tipo_invalido", "campo": campo}
        if tipo == "enum" and v not in regla:
            return {"decision": "error", "motivo": "valor_no_permitido", "campo": campo}
        if tipo in ("int", "num") and not (regla[0] <= v <= regla[1]):
            return {"decision": "error", "motivo": "fuera_de_rango", "campo": campo}
    # R1.2 población (con los campos disponibles)
    if e.get("nivel_formacion") not in (None, "pregrado"):
        return {"decision": "abstener", "motivo": "fuera_de_poblacion"}
    if e.get("estado_matricula") not in (None, "activo"):
        return {"decision": "abstener", "motivo": "fuera_de_poblacion"}
    if e.get("semestre") is not None and not (2 <= e["semestre"] <= 4):
        return {"decision": "abstener", "motivo": "fuera_de_poblacion"}
    # R1.3 faltantes obligatorios
    faltan = [c for c, (_, _, ob) in ESQUEMA.items() if ob and e.get(c) is None]
    if faltan:
        return {"decision": "abstener", "motivo": "campo_faltante", "campos": faltan}
    # R1.4 contradicciones
    if e["materias_reprobadas"] > e["materias_cursadas_periodo_anterior"]:
        return {"decision": "abstener", "motivo": "datos_contradictorios"}
    if e["creditos_inscritos"] == 0:
        return {"decision": "abstener", "motivo": "datos_contradictorios"}
    return None  # válido


def paso2_puntaje(e):
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
    if e["promedio_acumulado"] < 3.0 and e["porcentaje_asistencia"] < 70:  # FIX S14: R3.4
        return "alto", "remision_bienestar_y_tutoria"
    if p >= 60:
        return "alto", "remision_bienestar_y_tutoria"
    if p >= 30:
        return "medio", "tutoria_academica"
    return "bajo", "seguimiento_rutinario"


def evaluar(e):
    try:
        s1 = paso1_validar(e)
        if s1 is not None:
            return s1, {"S1": f"{s1['decision']}({s1['motivo']})", "S2": "-", "S3": "-"}
        p, factores, no_inf = paso2_puntaje(e)
        nivel, accion = paso3_decidir(e, p)
        return ({"decision": "resultado", "nivel": nivel, "puntaje": p, "accion": accion,
                 "factores": factores, "datos_no_informados": no_inf},
                {"S1": "valido", "S2": p, "S3": nivel})
    except Exception as ex:  # red de seguridad: nunca propagar excepción
        return ({"decision": "error", "motivo": "error_interno", "detalle": type(ex).__name__},
                {"S1": "error_interno", "S2": "-", "S3": "-"})
