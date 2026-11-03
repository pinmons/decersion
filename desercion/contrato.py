"""Contrato del sistema (contexto/practica_pruebas_estres.md, pasos 1 a 3 y paso 9).

Contiene lo que es igual en los dos modos (reglas y aprendido):
- el esquema E de los 12 campos,
- el Paso 1 (validación) con sus salidas `error` y `abstener`,
- la regla de anulación R3.4,
- las acciones asociadas a cada nivel.

Garantías: nunca lanza excepción; no inventa datos faltantes; no califica fuera de la
población; los umbrales se aplican tal como están escritos.
Copiado de sistema_v3.py sin cambiar la lógica.
"""
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

CAMPOS = list(ESQUEMA)
SEMESTRES_POBLACION = (2, 4)

ACCION_POR_NIVEL = {
    "alto": "remision_bienestar_y_tutoria",
    "medio": "tutoria_academica",
    "bajo": "seguimiento_rutinario",
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


def normalizar(e):
    """R1.3 ampliada: texto vacío o solo espacios cuenta como faltante (FIX T06)."""
    return {k: (None if isinstance(v, str) and v.strip() == "" else v) for k, v in e.items()}


def paso1_validar(e):
    """Devuelve None si la entrada es válida, o la salida terminal (error / abstener)."""
    if not isinstance(e, dict):
        return {"decision": "error", "motivo": "tipo_invalido", "campo": "<entrada>"}
    e = normalizar(e)
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
    s_min, s_max = SEMESTRES_POBLACION
    if e.get("semestre") is not None and not (s_min <= e["semestre"] <= s_max):
        return {"decision": "abstener", "motivo": "fuera_de_poblacion"}
    # R1.3 faltantes obligatorios
    faltan = [c for c, (_, _, ob) in ESQUEMA.items() if ob and e.get(c) is None]
    if faltan:
        return {"decision": "abstener", "motivo": "campo_faltante", "campos": faltan}
    # R1.4 contradicciones
    if e["materias_reprobadas"] > e["materias_cursadas_periodo_anterior"]:      # C1
        return {"decision": "abstener", "motivo": "datos_contradictorios"}
    if e["creditos_inscritos"] == 0:                                            # C2
        return {"decision": "abstener", "motivo": "datos_contradictorios"}
    if 0 < e["porcentaje_asistencia"] <= 1.0:          # C3 (FIX T01): probable escala 0–1
        return {"decision": "abstener", "motivo": "datos_contradictorios"}
    if e["semestre"] >= 2 and e["materias_cursadas_periodo_anterior"] == 0:     # C4 (FIX T12)
        return {"decision": "abstener", "motivo": "datos_contradictorios"}
    return None  # válido


def aplica_r34(e):
    """R3.4 (anulación): promedio < 3.0 y asistencia < 70 → nivel alto, en ambos modos."""
    return e["promedio_acumulado"] < 3.0 and e["porcentaje_asistencia"] < 70
