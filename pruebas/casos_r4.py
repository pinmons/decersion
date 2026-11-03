"""Ronda 4: 15 casos nuevos (U01–U15) que atacan al MODELO APRENDIDO. Sin respuesta esperada.

Generados con el prompt P2 de contexto/ adaptado al modo aprendido: en vez de atacar la
validación (que es la misma del contrato), atacan lo que puede salir mal al aprender pesos:
- violaciones de monotonía (más factores de riesgo y menos riesgo),
- valores válidos por contrato pero fuera de lo visto en el entrenamiento (asistencia < 30,
  promedio < 0.5, créditos < 4),
- una variable extrema con las demás normales,
- dos variables muy correlacionadas que se contradicen (promedio alto y todo reprobado),
- saltos bruscos por un cambio mínimo (las reglas tienen escalones; un modelo no debería).

Cada caso parte de un caso real (R01–R05) y cambia lo mínimo. Varios traen una `pareja`:
la misma entrada con un solo cambio, para comparar las dos (prueba metamórfica).
El oráculo está APARTE, en oraculo_r4.py.
"""
import rutas  # noqa: F401
from dataset import caso, REALES, Q

R = {c["id"]: c["entrada"] for c in REALES}


def desde(id_real, id_est, **cambios):
    e = dict(R[id_real])
    e["id_estudiante"] = id_est
    for k, v in cambios.items():
        if v == Q:
            e.pop(k, None)
        else:
            e[k] = v
    return e


NUEVOS_R4 = [
    {"id": "U01", "ataca": "monotonía del promedio", "categoria": "monotonía",
     "entrada": desde("R02", "EST-401", promedio_acumulado=2.0),
     "por_que": "R02 con promedio 2.0 en vez de 3.2. Si el modelo aprendió un peso con el signo equivocado, "
                "bajar el promedio bajaría el riesgo."},
    {"id": "U02", "ataca": "monotonía de las materias perdidas", "categoria": "monotonía",
     "entrada": desde("R05", "EST-402", materias_reprobadas=6),
     "por_que": "R05 con 6 de 6 materias perdidas en vez de 2. Con variables colineales (conteo y tasa) un peso puede salir negativo."},
    {"id": "U03", "ataca": "monotonía de la asistencia", "categoria": "monotonía",
     "entrada": desde("R02", "EST-403", porcentaje_asistencia=50.0),
     "por_que": "R02 con 50 % de asistencia en vez de 80 %. Promedio 3.2, así que R3.4 no ayuda: depende solo del modelo."},
    {"id": "U04", "ataca": "monotonía fuera de lo visto en entrenamiento", "categoria": "extrapolación",
     "entrada": desde("R01", "EST-404", porcentaje_asistencia=20.0),
     "pareja": desde("R01", "EST-404", porcentaje_asistencia=30.0),
     "por_que": "En el entrenamiento la asistencia nunca bajó de 30. Una red con ReLU puede extrapolar en cualquier dirección."},
    {"id": "U05", "ataca": "una variable extrema, las demás normales", "categoria": "extrema",
     "entrada": desde("R01", "EST-405", promedio_acumulado=0.0),
     "por_que": "Promedio 0.0 (válido en el contrato, nunca visto: el mínimo simulado es 0.5) con asistencia 92 y nada más "
                "de riesgo. R3.4 no aplica. ¿El modelo lo deja en bajo?"},
    {"id": "U06", "ataca": "una variable extrema, las demás normales", "categoria": "extrema",
     "entrada": desde("R01", "EST-406", porcentaje_asistencia=0.0),
     "por_que": "Asistencia 0 % (C3 solo abstiene entre 0 y 1, el 0 es válido) con promedio 3.8. R3.4 no aplica."},
    {"id": "U07", "ataca": "correlacionadas que se contradicen", "categoria": "contradicción válida",
     "entrada": desde("R01", "EST-407", promedio_acumulado=4.9, materias_reprobadas=6),
     "por_que": "Promedio 4.9 pero perdió las 6 materias del periodo anterior. En los datos estas variables van juntas "
                "(r = -0.6); aquí se contradicen y el promedio alto podría tapar el resto."},
    {"id": "U08", "ataca": "correlacionadas que se contradicen", "categoria": "contradicción válida",
     "entrada": desde("R01", "EST-408", promedio_acumulado=1.5, porcentaje_asistencia=100.0),
     "pareja": desde("R01", "EST-408", promedio_acumulado=3.8, porcentaje_asistencia=100.0),
     "por_que": "Promedio 1.5 con asistencia perfecta y 0 materias perdidas: la asistencia alta podría compensar de más."},
    {"id": "U09", "ataca": "combinación rara", "categoria": "combinación rara",
     "entrada": desde("R01", "EST-409", estrato=6, trabaja=True, deuda_matricula=True, promedio_acumulado=4.8),
     "pareja": desde("R01", "EST-409", estrato=6, trabaja=False, deuda_matricula=False, promedio_acumulado=4.8),
     "por_que": "Estrato 6 que trabaja y debe matrícula: casi no aparece en el entrenamiento (estrato alto va con no trabajar)."},
    {"id": "U10", "ataca": "garantía de rango con todo en el máximo", "categoria": "frontera del contrato",
     "entrada": caso("EST-410", semestre=4, promedio_acumulado=5.0, creditos_inscritos=25,
                     materias_cursadas_periodo_anterior=12, materias_reprobadas=12, porcentaje_asistencia=100.0,
                     estrato=6, trabaja=True, deuda_matricula=True),
     "por_que": "Todos los campos en su máximo permitido. El puntaje debe seguir entre 0 y 100 y no debe haber excepción."},
    {"id": "U11", "ataca": "garantía de rango con todo en el peor valor", "categoria": "frontera del contrato",
     "entrada": caso("EST-411", semestre=2, promedio_acumulado=0.0, creditos_inscritos=1,
                     materias_cursadas_periodo_anterior=1, materias_reprobadas=1, porcentaje_asistencia=0.0,
                     estrato=1, trabaja=True, deuda_matricula=True),
     "por_que": "Todos los campos en el valor de más riesgo, varios fuera de lo visto (1 crédito, 1 materia, asistencia 0)."},
    {"id": "U12", "ataca": "salto por un cambio mínimo (promedio)", "categoria": "continuidad",
     "entrada": desde("R01", "EST-412", promedio_acumulado=3.49),
     "pareja": desde("R01", "EST-412", promedio_acumulado=3.50),
     "por_que": "Una centésima de promedio. En las reglas cruza el escalón de 3.5 (+15 puntos); un modelo aprendido no debería saltar."},
    {"id": "U13", "ataca": "salto por un cambio mínimo (asistencia)", "categoria": "continuidad",
     "entrada": desde("R01", "EST-413", porcentaje_asistencia=84.9),
     "pareja": desde("R01", "EST-413", porcentaje_asistencia=85.0),
     "por_que": "Una décima de asistencia que cruza el escalón de 85 en las reglas (+10 puntos)."},
    {"id": "U14", "ataca": "imputación prudente de la deuda", "categoria": "dato opcional ausente",
     "entrada": desde("R01", "EST-414", deuda_matricula=Q),
     "pareja": desde("R01", "EST-414", deuda_matricula=False),
     "por_que": "Si falta la deuda, el modelo no puede asumir que no hay deuda (eso bajaría el riesgo inventando un dato)."},
    {"id": "U15", "ataca": "monotonía de una variable binaria", "categoria": "monotonía",
     "entrada": desde("R01", "EST-415", trabaja=True),
     "pareja": desde("R01", "EST-415", trabaja=False),
     "por_que": "Trabajar, si lo demás es igual, no debería bajar el riesgo. Con la interacción trabaja × asistencia de "
                "los datos, una red podría aprender lo contrario para asistencias altas."},
]
