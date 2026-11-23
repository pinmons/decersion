"""Frases en lenguaje llano para explicar un resultado de la base real (lo usan operacion.py e ingreso.py).

`por_que(variable, registro, aux)` devuelve la frase con el dato del estudiante que explica los puntos de
una variable («Fue al campus 9 días de septiembre a noviembre; lo usual son 39»), o None si esa variable
no se puede contar como un motivo (por ejemplo, «tiene nota de acceso» nunca es un porqué: una indicadora
«sin dato» solo explica algo cuando el dato falta). «Lo usual» es la mediana de los estudiantes de
entrenamiento, guardada en el JSON del modelo (`aux["medianas"]`).

`MEJORAS` dice qué puede hacer bienestar frente a cada factor. Solo están los que se pueden trabajar
(presencia, entregas, notas); la nota de acceso, la titulación o la vía de ingreso no se «mejoran»: solo
aparecen en «por qué».
"""

# Indicadoras y variables de sí o no: el valor con el que SÍ explican el riesgo.
BINARIAS = {"sin_registro_wifi": 1, "sin_aula_virtual": 1, "sin_nota_acceso": 1, "sin_nota_bachillerato": 1,
            "sin_opcion_titulacion": 1, "trabaja": 1, "ingreso_ordinario": 0, "deuda_matricula": 1}


def coma(x, d=1):
    return f"{x:.{d}f}".replace(".", ",")


def _cifra(x):
    """Número corto: sin decimales si es entero o grande; con uno si es pequeño."""
    x = float(x)
    return coma(x, 0) if abs(x - round(x)) < 0.05 or x >= 20 else coma(x, 1)


def _n(x, uno, varios):
    """«1 día», «3 días»."""
    return f"{_cifra(x)} {uno if _cifra(x) == '1' else varios}"


def _usual(aux, campo):
    m = (aux or {}).get("medianas", {}).get(campo)
    return None if m is None else _cifra(m)


def por_que(variable, r, aux=None):
    """Frase corta con el dato del registro que explica los puntos de una variable (None si no aplica)."""
    if variable in BINARIAS:
        v = r.get(variable)
        if variable.startswith("sin_"):
            from .contrato_ampliado import INDICADORAS
            v = int(any(r.get(c) is None for c in INDICADORAS[variable]))
        elif variable == "ingreso_ordinario":
            v = int(r.get("tipo_ingreso") in (None, "NAP"))
        elif v is not None:
            v = int(bool(v))
        if v != BINARIAS[variable]:
            return None
    u = lambda campo: _usual(aux, campo)
    if variable == "promedio_acumulado":
        if r["promedio_acumulado"] == 0:
            return "No aprobó ninguna asignatura del primer cuatrimestre"
        return f"Nota media de {coma(r['promedio_acumulado'], 2)} en lo aprobado (se aprueba con 3,0)"
    if variable in ("tasa_reprobacion", "materias_reprobadas"):
        return f"Suspendió {r['materias_reprobadas']} de {r['materias_cursadas_periodo_anterior']} asignaturas del primer cuatrimestre"
    if variable == "materias_cursadas_periodo_anterior":
        return f"Cursó {r['materias_cursadas_periodo_anterior']} asignaturas en el primer cuatrimestre"
    if variable == "porcentaje_asistencia":
        return f"Presencia del {coma(r['porcentaje_asistencia'], 0)} % (campus y aula virtual)"
    if variable == "deuda_matricula":
        return "Tiene deuda de matrícula"
    if variable == "trabaja":
        return "Matriculado a tiempo parcial (se asume que trabaja)"
    if variable == "estrato":
        return f"Estrato {r['estrato']}"
    if variable == "creditos_inscritos":
        return f"Carga de {r['creditos_inscritos']} créditos (escala del contrato; lo habitual es 20)"
    # ---- contrato ampliado
    v = r.get(variable)
    if variable == "nota_media_cuatrimestre":
        return None if v is None else f"Nota media de {coma(v, 1)} sobre 10 en lo que presentó"
    if variable == "nota_minima_cuatrimestre":
        return None if v is None else f"Su nota más baja del cuatrimestre fue {coma(v, 1)} sobre 10"
    if variable == "asignaturas_no_presentadas":
        return None if not v else f"No se presentó a {v} asignatura{'s' if v != 1 else ''}"
    if variable == "dias_campus_sep_nov":
        return (None if v is None else
                f"Fue al campus {_n(v, 'día', 'días')} de septiembre a noviembre; lo usual son {u('dias_campus_sep_nov')}")
    if variable == "dias_campus_dic_ene":
        return (None if v is None else
                f"En diciembre y enero fue al campus {_n(v, 'día', 'días')}; lo usual son {u('dias_campus_dic_ene')}")
    if variable == "sin_registro_wifi":
        return "No hay registro de wifi del campus: no se sabe si fue"
    if variable == "dias_aula_virtual":
        return (None if v is None else
                f"Entró al aula virtual {_n(v, 'día', 'días')} por asignatura; lo usual son {u('dias_aula_virtual')}")
    if variable == "entregas_por_asignatura":
        return (None if v is None else
                f"Entregó {_n(v, 'tarea', 'tareas')} por asignatura; lo usual son {u('entregas_por_asignatura')}")
    if variable == "sin_aula_virtual":
        return "No hay datos de su aula virtual"
    if variable == "nota_acceso":
        return None if v is None else f"Entró con {coma(v, 1)} de nota de acceso (sobre 14; lo usual es {u('nota_acceso')})"
    if variable == "sin_nota_acceso":
        return "Sin nota de acceso registrada"
    if variable == "nota_bachillerato":
        return None if v is None else f"Bachillerato con {coma(v, 1)} de nota media"
    if variable == "sin_nota_bachillerato":
        return "Sin nota de bachillerato registrada"
    if variable == "opcion_titulacion":
        return None if v is None or v <= 1 else f"Pidió esta titulación como opción {v}, no como la primera"
    if variable == "sin_opcion_titulacion":
        return "No consta en qué opción pidió la titulación"
    if variable == "ingreso_ordinario":
        return f"Entró por una vía distinta del acceso ordinario (código {r.get('tipo_ingreso')})"
    if variable == "abandono_titulacion":
        from .contrato_ampliado import tasa_titulacion
        if not aux:
            return None
        return (f"En su titulación abandona el {coma(100 * tasa_titulacion(r, aux), 0)} % "
                f"(en toda la universidad, el {coma(100 * aux['tasa_global'], 0)} %)")
    return None


# Lo que bienestar puede hacer frente a cada factor. Lo que no se cambia (nota de acceso, titulación, vía de
# ingreso, estrato, trabajo, carga) no está: solo explica, en «por qué».
MEJORAS = {
    "promedio_acumulado": "Tutoría en las asignaturas con la nota más baja.",
    "tasa_reprobacion": "Plan para recuperar las asignaturas suspendidas del primer cuatrimestre.",
    "materias_reprobadas": "Plan para recuperar las asignaturas suspendidas del primer cuatrimestre.",
    "nota_media_cuatrimestre": "Tutoría en las asignaturas con la nota más baja.",
    "nota_minima_cuatrimestre": "Tutoría en la asignatura con la nota más baja.",
    "asignaturas_no_presentadas": "Hablar con el estudiante de las asignaturas a las que no se presentó, antes de la próxima convocatoria.",
    "porcentaje_asistencia": "Llamar al estudiante para saber por qué dejó de ir al campus y de entrar al aula virtual.",
    "dias_campus_sep_nov": "Llamar al estudiante para saber por qué casi no va al campus.",
    "dias_campus_dic_ene": "Acompañar al estudiante en la época de exámenes: en diciembre y enero casi no fue al campus.",
    "dias_aula_virtual": "Revisar con el estudiante el aula virtual de cada asignatura: entra mucho menos que sus compañeros.",
    "entregas_por_asignatura": "Plan de entregas con sus profesores: entrega menos tareas de lo usual.",
    "deuda_matricula": "Remitir a apoyo financiero para un acuerdo de pago.",
}
