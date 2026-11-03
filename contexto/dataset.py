"""Dataset (R01-R05, S01-S15) y oráculo BORRADOR. El oráculo se escribe aparte de los casos."""
import json, copy

BASE = {
    "id_estudiante": "EST-000",
    "nivel_formacion": "pregrado",
    "estado_matricula": "activo",
    "semestre": 3,
    "promedio_acumulado": 3.8,
    "creditos_inscritos": 16,
    "materias_cursadas_periodo_anterior": 6,
    "materias_reprobadas": 0,
    "porcentaje_asistencia": 92.0,
    "estrato": 3,
    "trabaja": False,
    "deuda_matricula": False,
}

def caso(id_, **cambios):
    e = copy.deepcopy(BASE)
    e["id_estudiante"] = id_
    for k, v in cambios.items():
        if v == "__QUITAR__":
            e.pop(k, None)
        else:
            e[k] = v
    return e

Q = "__QUITAR__"

REALES = [
    {"id": "R01", "categoria": "típico – riesgo bajo", "entrada": caso("EST-101")},
    {"id": "R02", "categoria": "típico – riesgo medio", "entrada": caso("EST-102", semestre=2, promedio_acumulado=3.2, materias_reprobadas=1, porcentaje_asistencia=80.0, estrato=2, trabaja=True, creditos_inscritos=15)},
    {"id": "R03", "categoria": "típico – riesgo alto", "entrada": caso("EST-103", semestre=4, promedio_acumulado=2.7, materias_cursadas_periodo_anterior=5, materias_reprobadas=3, porcentaje_asistencia=65.0, estrato=1, trabaja=True, deuda_matricula=True, creditos_inscritos=12)},
    {"id": "R04", "categoria": "típico – opcional no informado", "entrada": caso("EST-104", promedio_acumulado=4.1, porcentaje_asistencia=88.0, estrato=2, trabaja=True, deuda_matricula=Q)},
    {"id": "R05", "categoria": "típico – riesgo medio", "entrada": caso("EST-105", semestre=2, promedio_acumulado=3.6, materias_reprobadas=2, porcentaje_asistencia=78.0, estrato=4, deuda_matricula=True, creditos_inscritos=18)},
]

SIMULADOS = [
    {"id": "S01", "categoria": "campo faltante", "entrada": caso("EST-201", promedio_acumulado=Q),
     "por_que": "Falta un dato obligatorio; una v1 suele hacer e['promedio'] y lanzar KeyError, o asumir 0 y marcar riesgo alto inventado."},
    {"id": "S02", "categoria": "campo faltante (null)", "entrada": caso("EST-202", porcentaje_asistencia=None),
     "por_que": "La clave existe pero vale null; pasa un chequeo 'in' y revienta al comparar None < 70, o se trata como 0%."},
    {"id": "S03", "categoria": "contradictorio", "entrada": caso("EST-203", materias_cursadas_periodo_anterior=4, materias_reprobadas=5),
     "por_que": "Cada campo está en rango por separado; solo la relación entre ellos es imposible."},
    {"id": "S04", "categoria": "contradictorio", "entrada": caso("EST-204", creditos_inscritos=0),
     "por_que": "Matrícula 'activo' sin créditos: 0 está dentro del rango, la contradicción es semántica."},
    {"id": "S05", "categoria": "otra población", "entrada": caso("EST-205", nivel_formacion="posgrado"),
     "por_que": "Datos perfectos de alguien a quien el sistema no debe calificar; el camino feliz le daría un nivel de riesgo."},
    {"id": "S06", "categoria": "otra población", "entrada": caso("EST-206", semestre=7),
     "por_que": "Semestre válido (1–12) pero fuera del foco de deserción temprana (2–4)."},
    {"id": "S07", "categoria": "otra población + faltante", "entrada": caso("EST-207", estado_matricula="graduado", promedio_acumulado=Q),
     "por_que": "Dos motivos de abstención a la vez: prueba el orden de las reglas (población antes que faltantes)."},
    {"id": "S08", "categoria": "otra escala / fuera de rango", "entrada": caso("EST-208", promedio_acumulado=38.0),
     "por_que": "Promedio en escala 0–100 en vez de 0–5; sin validación suma 0 puntos y el estudiante sale 'bajo' por error."},
    {"id": "S09", "categoria": "otro tipo", "entrada": caso("EST-209", semestre="3"),
     "por_que": "Número como texto (típico de CSV/formularios); comparar '3' con enteros falla o pasa silenciosamente."},
    {"id": "S10", "categoria": "otro tipo", "entrada": caso("EST-210", trabaja="no"),
     "por_que": "El texto 'no' es truthy en Python: una v1 suma +5 como si trabajara."},
    {"id": "S11", "categoria": "valor no permitido", "entrada": caso("EST-211", nivel_formacion="Pregrado"),
     "por_que": "Diferencia solo de mayúsculas; ¿normalizar o rechazar? El contrato dice rechazar."},
    {"id": "S12", "categoria": "frontera", "entrada": caso("EST-212", promedio_acumulado=3.0, materias_reprobadas=1, porcentaje_asistencia=70.0),
     "por_que": "Promedio y asistencia justo en el umbral inclusivo; un < en vez de ≤ cambia el puntaje."},
    {"id": "S13", "categoria": "frontera", "entrada": caso("EST-213", promedio_acumulado=2.9, materias_reprobadas=1, porcentaje_asistencia=85.0, estrato=2, deuda_matricula=True),
     "por_que": "Puntaje exactamente 60 (corte alto/medio) y asistencia exactamente 85."},
    {"id": "S14", "categoria": "frontera + regla de excepción", "entrada": caso("EST-214", promedio_acumulado=2.99, porcentaje_asistencia=69.9, estrato=5),
     "por_que": "Puntaje 50 (medio) pero activa la regla de anulación promedio<3.0 Y asistencia<70 → alto."},
    {"id": "S15", "categoria": "otro tipo (trampa de lenguaje)", "entrada": caso("EST-215", semestre=True),
     "por_que": "En Python bool es subclase de int: isinstance(True, int) es True y True vale 1, así que pasa un chequeo de tipo ingenuo."},
]

# ---------------- ORÁCULO – BORRADOR (escrito a mano, regla por regla) ----------------
def res(nivel, puntaje, accion, no_inf=None):
    return {"decision": "resultado", "nivel": nivel, "puntaje": puntaje, "accion": accion,
            "datos_no_informados": no_inf or []}

ORACULO = {
    "R01": (res("bajo", 0, "seguimiento_rutinario"), "R2.1–R2.6 suman 0 → R3.3"),
    "R02": (res("medio", 50, "tutoria_academica"), "15+10+10+10+5=50 → R3.2"),
    "R03": (res("alto", 100, "remision_bienestar_y_tutoria"), "30+25+20+10+5+10=100 → R3.1 (también R3.4)"),
    "R04": (res("bajo", 15, "seguimiento_rutinario", ["deuda_matricula"]), "estrato 10 + trabaja 5 = 15 → R3.3; R2.6 no aplica y se reporta"),
    "R05": (res("medio", 45, "tutoria_academica"), "0+25+10+0+0+10=45 → R3.2"),
    "S01": ({"decision": "abstener", "motivo": "campo_faltante", "campos": ["promedio_acumulado"]}, "R1.3"),
    "S02": ({"decision": "abstener", "motivo": "campo_faltante", "campos": ["porcentaje_asistencia"]}, "R1.3 (null = faltante)"),
    "S03": ({"decision": "abstener", "motivo": "datos_contradictorios"}, "R1.4-C1"),
    "S04": ({"decision": "abstener", "motivo": "datos_contradictorios"}, "R1.4-C2"),
    "S05": ({"decision": "abstener", "motivo": "fuera_de_poblacion"}, "R1.2-P1"),
    "S06": ({"decision": "abstener", "motivo": "fuera_de_poblacion"}, "R1.2-P3"),
    "S07": ({"decision": "abstener", "motivo": "fuera_de_poblacion"}, "R1.2-P2 (población se evalúa antes que faltantes)"),
    "S08": ({"decision": "error", "motivo": "fuera_de_rango", "campo": "promedio_acumulado"}, "R1.1 rango 0.0–5.0"),
    "S09": ({"decision": "error", "motivo": "tipo_invalido", "campo": "semestre"}, "R1.1 tipo int"),
    "S10": ({"decision": "error", "motivo": "tipo_invalido", "campo": "trabaja"}, "R1.1 tipo bool"),
    "S11": ({"decision": "error", "motivo": "valor_no_permitido", "campo": "nivel_formacion"}, "R1.1 enumerado exacto"),
    "S12": (res("medio", 35, "tutoria_academica"), "3.0 → +15 (3.0≤p<3.5); 70 → +10 (70≤a<85); 1 reprobada +10 = 35 → R3.2; R3.4 no aplica (3.0 no es <3.0)"),
    "S13": (res("alto", 60, "remision_bienestar_y_tutoria"), "30+10+0+10+0+10=60 → R3.1 (≥60 inclusivo)"),
    "S14": (res("alto", 50, "remision_bienestar_y_tutoria"), "puntaje 50 pero R3.4 (p<3.0 y a<70) fuerza alto"),
    "S15": ({"decision": "error", "motivo": "tipo_invalido", "campo": "semestre"}, "R1.1: bool no es int válido"),
}

if __name__ == "__main__":
    casos = [dict(c, origen="real") for c in REALES] + [dict(c, origen="simulado") for c in SIMULADOS]
    with open("dataset_20_casos.json", "w", encoding="utf-8") as f:
        json.dump({"nota": "Casos R01-R05 son [DATOS TÍPICOS INVENTADOS: reemplazar por reales]. Sin respuesta esperada.",
                   "casos": casos}, f, ensure_ascii=False, indent=2)
    with open("oraculo_borrador.json", "w", encoding="utf-8") as f:
        json.dump({"nota": "BORRADOR – lo valida y firma el equipo, no el modelo.",
                   "oraculo": [{"id": k, "esperado": v[0], "regla": v[1]} for k, v in ORACULO.items()]},
                  f, ensure_ascii=False, indent=2)
    print("ok")
