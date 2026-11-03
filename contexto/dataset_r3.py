"""Ronda 3: 15 casos nuevos (T01-T15) generados con P2 + oráculo BORRADOR según contrato v2."""
import json
from dataset import caso, Q, res

NUEVOS = [
    {"id": "T01", "ataca": "S08 (escala) – ahora DENTRO de rango", "categoria": "otra escala",
     "entrada": caso("EST-301", porcentaje_asistencia=0.92),
     "por_que": "Asistencia como proporción 0–1: pasa la validación de rango y se lee como 0,92 %."},
    {"id": "T02", "ataca": "S09 (tipo) – formato local", "categoria": "otro tipo",
     "entrada": caso("EST-302", promedio_acumulado="3,8"),
     "por_que": "Decimal con coma (formato colombiano en Excel/formularios)."},
    {"id": "T03", "ataca": "S15 (tipo) – float entero", "categoria": "otro tipo",
     "entrada": caso("EST-303", semestre=3.0),
     "por_que": "3.0 == 3 en Python; un chequeo por valor lo deja pasar."},
    {"id": "T04", "ataca": "S10 (bool) – entero 1", "categoria": "otro tipo",
     "entrada": caso("EST-304", trabaja=1),
     "por_que": "1 es truthy y 1 == True en Python."},
    {"id": "T05", "ataca": "S11 (enum) – espacio final", "categoria": "valor no permitido",
     "entrada": caso("EST-305", nivel_formacion="pregrado "),
     "por_que": "Invisible al ojo; típico de copiar/pegar."},
    {"id": "T06", "ataca": "S01 (faltante) – disfrazado de texto", "categoria": "campo faltante",
     "entrada": caso("EST-306", id_estudiante="   "),
     "por_que": "La clave existe y es str, pero no trae información."},
    {"id": "T07", "ataca": "S01 (faltante) – clave mal escrita", "categoria": "campo faltante",
     "entrada": {**{k: v for k, v in caso("EST-307").items() if k != "promedio_acumulado"}, "Promedio_acumulado": 3.8},
     "por_que": "El dato está, pero con otra clave; un sistema 'amable' podría usarlo."},
    {"id": "T08", "ataca": "orden de errores", "categoria": "dos errores",
     "entrada": caso("EST-308", semestre="3", promedio_acumulado=38.0),
     "por_que": "Dos errores de formato a la vez: ¿cuál se reporta?"},
    {"id": "T09", "ataca": "orden error vs población", "categoria": "error + otra población",
     "entrada": caso("EST-309", nivel_formacion="posgrado", estrato=9),
     "por_que": "Fuera de población y con dato mal formado a la vez."},
    {"id": "T10", "ataca": "orden población vs contradicción", "categoria": "otra población + contradictorio",
     "entrada": caso("EST-310", estado_matricula="retirado", creditos_inscritos=0),
     "por_que": "Retirado con 0 créditos: es coherente para un retirado, contradictorio para un activo."},
    {"id": "T11", "ataca": "S03 (contradicción) – frontera", "categoria": "frontera",
     "entrada": caso("EST-311", materias_reprobadas=6),
     "por_que": "Reprobó todas (6 de 6): justo en el límite de C1 (> estricto)."},
    {"id": "T12", "ataca": "S04 (contradicción) – sin evidencia", "categoria": "contradictorio / abstenerse",
     "entrada": caso("EST-312", materias_cursadas_periodo_anterior=0, materias_reprobadas=0),
     "por_que": "Semestre 3 sin materias cursadas antes: 0 reprobadas parece 'bueno' pero no hay evidencia."},
    {"id": "T13", "ataca": "S12 (frontera) – lado opuesto", "categoria": "frontera",
     "entrada": caso("EST-313", semestre=4, promedio_acumulado=3.5, porcentaje_asistencia=84.99),
     "por_que": "Semestre en el borde de la población, promedio justo en 3.5 y asistencia una centésima bajo 85."},
    {"id": "T14", "ataca": "S14 (R3.4) – lado opuesto", "categoria": "frontera + excepción",
     "entrada": caso("EST-314", promedio_acumulado=2.99, porcentaje_asistencia=70.0),
     "por_que": "Cumple una condición de R3.4 pero la otra queda justo fuera (70 no es < 70)."},
    {"id": "T15", "ataca": "S13 (corte) – corte inferior", "categoria": "frontera",
     "entrada": caso("EST-315", promedio_acumulado=2.9),
     "por_que": "Puntaje exactamente 30: corte bajo/medio."},
]

# ---------- ORÁCULO R3 – BORRADOR (contrato v2, escrito a mano) ----------
ORACULO_R3 = {
    "T01": ({"decision": "abstener", "motivo": "datos_contradictorios"}, "R1.4-C3 (nuevo): 0 < asistencia ≤ 1.0"),
    "T02": ({"decision": "error", "motivo": "tipo_invalido", "campo": "promedio_acumulado"}, "R1.1a: texto no es número"),
    "T03": ({"decision": "error", "motivo": "tipo_invalido", "campo": "semestre"}, "R1.1a: float no es int"),
    "T04": ({"decision": "error", "motivo": "tipo_invalido", "campo": "trabaja"}, "R1.1a: int no es bool"),
    "T05": ({"decision": "error", "motivo": "valor_no_permitido", "campo": "nivel_formacion"}, "R1.1b: enum exacto"),
    "T06": ({"decision": "abstener", "motivo": "campo_faltante", "campos": ["id_estudiante"]}, "R1.3 (ampliada): texto vacío o solo espacios = faltante"),
    "T07": ({"decision": "abstener", "motivo": "campo_faltante", "campos": ["promedio_acumulado"]}, "R1.3; R1.0 (nuevo): claves desconocidas se ignoran"),
    "T08": ({"decision": "error", "motivo": "tipo_invalido", "campo": "semestre"}, "R1.1: se reporta el primer error en el orden de la tabla E"),
    "T09": ({"decision": "error", "motivo": "fuera_de_rango", "campo": "estrato"}, "Orden: formato antes que población"),
    "T10": ({"decision": "abstener", "motivo": "fuera_de_poblacion"}, "R1.2-P2 antes que R1.4"),
    "T11": (res("bajo", 25, "seguimiento_rutinario"), "C1 no aplica (6 no es > 6); R2.2 +25 → R3.3"),
    "T12": ({"decision": "abstener", "motivo": "datos_contradictorios"}, "R1.4-C4 (nuevo): semestre ≥ 2 y 0 materias cursadas"),
    "T13": (res("bajo", 10, "seguimiento_rutinario"), "P3 incluye 4; 3.5 → 0; 84.99 → +10 → R3.3"),
    "T14": (res("medio", 40, "tutoria_academica"), "30+10 = 40; R3.4 no aplica (70 no es < 70) → R3.2"),
    "T15": (res("medio", 30, "tutoria_academica"), "+30 → R3.2 (≥ 30 inclusivo)"),
}

if __name__ == "__main__":
    with open("dataset_ronda3.json", "w", encoding="utf-8") as f:
        json.dump({"nota": "Casos nuevos ronda 3 (P2). Sin respuesta esperada.",
                   "casos": [{k: v for k, v in c.items()} for c in NUEVOS]}, f, ensure_ascii=False, indent=2)
    with open("oraculo_ronda3_borrador.json", "w", encoding="utf-8") as f:
        json.dump({"nota": "BORRADOR según contrato v2 – lo valida y firma el equipo, no el modelo.",
                   "oraculo": [{"id": k, "esperado": v[0], "regla": v[1]} for k, v in ORACULO_R3.items()]},
                  f, ensure_ascii=False, indent=2)
    print("ok")
