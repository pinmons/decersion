"""Ingeniería de variables: de un registro válido del contrato a un vector numérico.

Lo usan el entrenamiento y la inferencia (en Vercel), así que solo depende de NumPy.

Transformaciones y por qué:
- `tasa_reprobacion = materias_reprobadas / materias_cursadas_periodo_anterior`: perder 2
  de 3 materias no es lo mismo que perder 2 de 8. La tasa pone a todos en la misma escala
  (0 a 1). El Paso 1 (C4) garantiza que cursadas ≥ 1, así que nunca se divide por cero.
- Booleanos (`trabaja`, `deuda_matricula`) → 0/1.
- `estrato` se deja como número ordinal 1–6 [SUPUESTO]: el orden importa y una columna por
  estrato multiplicaría los parámetros sin necesidad.
- `id_estudiante`, `nivel_formacion` y `estado_matricula` NO entran: el primero es un
  identificador y los otros dos son constantes dentro de la población (pregrado, activo).
"""
import numpy as np

# nombre: (rango mínimo y máximo posibles según el contrato, signo esperado del riesgo)
# El signo esperado solo se usa para documentar y para las pruebas de monotonía.
CANDIDATAS = {
    "semestre": ((2, 4), 0),
    "promedio_acumulado": ((0.0, 5.0), -1),
    "creditos_inscritos": ((1, 25), 0),
    "materias_cursadas_periodo_anterior": ((1, 12), 0),
    "materias_reprobadas": ((0, 12), +1),
    "tasa_reprobacion": ((0.0, 1.0), +1),
    "porcentaje_asistencia": ((0.0, 100.0), -1),
    "estrato": ((1, 6), -1),
    "trabaja": ((0, 1), +1),
    "deuda_matricula": ((0, 1), +1),
}

NOMBRES_LEGIBLES = {
    "semestre": "semestre",
    "promedio_acumulado": "promedio acumulado",
    "creditos_inscritos": "créditos inscritos",
    "materias_cursadas_periodo_anterior": "materias cursadas",
    "materias_reprobadas": "materias reprobadas",
    "tasa_reprobacion": "tasa de reprobación",
    "porcentaje_asistencia": "asistencia",
    "estrato": "estrato",
    "trabaja": "trabaja",
    "deuda_matricula": "deuda de matrícula",
}


def valor(registro, nombre, deuda_si_falta=1):
    """Valor numérico de una variable. Si falta la deuda (opcional) se usa `deuda_si_falta`."""
    if nombre == "tasa_reprobacion":
        return registro["materias_reprobadas"] / registro["materias_cursadas_periodo_anterior"]
    if nombre == "deuda_matricula":
        d = registro.get("deuda_matricula")
        return float(deuda_si_falta) if d is None else float(d)
    return float(registro[nombre])


def vector(registro, nombres, deuda_si_falta=1):
    return np.array([valor(registro, n, deuda_si_falta) for n in nombres], dtype=float)


def matriz(registros, nombres, deuda_si_falta=1):
    return np.array([vector(r, nombres, deuda_si_falta) for r in registros], dtype=float)
