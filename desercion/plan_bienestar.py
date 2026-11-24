"""Lo que Bienestar recibe ya organizado: señales, ruta de apoyo, consejera asignada y ficha de la titulación.

El modelo dice QUIÉN está en riesgo. Este módulo dice QUÉ LE PASA y QUIÉN LO ATIENDE, para que el humano solo
tenga que hacer lo que no se puede automatizar: hablar con el estudiante y registrar lo que pasó.

- `senales(registro, usual, titulacion)`: lo que se ve en los datos del estudiante comparado con lo usual (la
  mediana de entrenamiento), agrupado por fuente (notas, presencia, situación, admisión, titulación). Sale de los
  datos, no de los puntos del modelo: los puntos dicen cuánto mueve el riesgo una variable con el peso que el modelo
  le dio (con tope de dominancia y signo restringido), y por eso «tiempo parcial» salía como motivo principal de
  estudiantes que suspendieron todo. Para hablar con el estudiante sirve más lo que se ve en sus datos.
- `ruta(senales)`: a qué servicio conviene llevar el caso después del primer contacto, y por qué.
- `asignar(casos)`: reparte los casos de riesgo alto entre el equipo según la ruta, equilibrando la carga.
- `titulaciones(bd)`: la ficha de cada código de titulación (la UPV publica la carrera anonimizada: «T04» es un
  código, no se sabe a qué carrera corresponde).

[SUPUESTO] El equipo de Bienestar es ficticio (prototipo). [SUPUESTO] Los umbrales de cada señal (la mitad de lo
usual = señal alta; 70 % = media) son de trabajo, no salen de un estudio.
"""
from .textos import coma

EQUIPO = [   # [SUPUESTO] equipo ficticio del prototipo
    {"id": "ana", "nombre": "Ana Torres", "iniciales": "AT", "rol": "Orientadora académica",
     "rutas": ["Tutoría académica", "Orientación vocacional"]},
    {"id": "camilo", "nombre": "Camilo Ríos", "iniciales": "CR", "rol": "Coordinador de tutorías",
     "rutas": ["Tutoría académica"]},
    {"id": "marta", "nombre": "Marta Gil", "iniciales": "MG", "rol": "Trabajadora social", "rutas": ["Apoyo financiero"]},
    {"id": "jorge", "nombre": "Jorge Pérez", "iniciales": "JP", "rol": "Psicólogo", "rutas": ["Atención psicológica"]},
]
PREFERENCIA = 6   # [SUPUESTO] un caso va a quien atiende su ruta salvo que lleve 6 casos más que quien menos lleva
COORDINACION = {"nombre": "Sara Luna", "rol": "Coordinadora de Bienestar",
                "tarea": "Recibe los casos que no responden a dos intentos y los que un profesor marca como urgentes."}

FUENTES = {"notas": "Notas", "presencia": "Presencia", "situacion": "Situación", "admision": "Admisión",
           "titulacion": "Titulación"}

# Por qué cada ruta: lo que se le dice a la consejera en una línea.
RUTAS = {
    "Tutoría académica": "sus notas del primer cuatrimestre son el problema principal",
    "Apoyo financiero": "estudia a tiempo parcial: es probable que trabaje y le falte tiempo o dinero",
    "Orientación vocacional": "no eligió esta titulación como primera opción",
    "Atención psicológica": "dejó de ir al campus o de entrar al aula virtual sin que sus notas lo expliquen",
}


def _n(x):
    x = float(x)
    return coma(x, 0) if abs(x - round(x)) < 0.05 or x >= 20 else coma(x, 1)


def _baja(valor, usual, alta=0.5, media=0.7):
    """Gravedad de un valor que debería parecerse a lo usual: «alta» bajo la mitad, «media» bajo el 70 %."""
    if valor is None or not usual:
        return None
    return "alta" if valor < alta * usual else "media" if valor < media * usual else None


def senales(r, usual=None, tit=None, tasa_global=None):
    """Lista de señales [{fuente, gravedad, texto, trabajable}], de la más grave a la más leve."""
    u = usual or {}
    s = []

    def add(fuente, gravedad, texto, trabajable=True):
        if gravedad:
            s.append({"fuente": fuente, "gravedad": gravedad, "texto": texto, "trabajable": trabajable})

    cursadas, rep = r.get("materias_cursadas_periodo_anterior"), r.get("materias_reprobadas")
    if cursadas and rep is not None and r.get("promedio_acumulado") is not None:
        tasa = rep / cursadas
        add("notas", "alta" if tasa >= 0.5 else "media" if tasa > 0 else None,
            f"Suspendió {rep} de {cursadas} asignaturas del primer cuatrimestre")
    np_ = r.get("asignaturas_no_presentadas")
    if np_:
        add("notas", "alta" if np_ >= 2 else "media", f"No se presentó al examen de {_n(np_)} asignatura" + ("s" if np_ != 1 else ""))
    v = r.get("dias_aula_virtual")
    add("presencia", _baja(v, u.get("dias_aula_virtual")),
        f"Entró al aula virtual {_n(v)} días por asignatura; lo usual son {_n(u.get('dias_aula_virtual') or 0)}" if v is not None else "")
    v = r.get("entregas_por_asignatura")
    add("presencia", _baja(v, u.get("entregas_por_asignatura")),
        f"Entregó {_n(v)} tareas por asignatura; lo usual son {_n(u.get('entregas_por_asignatura') or 0)}" if v is not None else "")
    a, b = r.get("dias_campus_sep_nov"), r.get("dias_campus_dic_ene")
    if a is not None:
        add("presencia", _baja(a, u.get("dias_campus_sep_nov")),
            f"Fue al campus {_n(a)} días de septiembre a noviembre; lo usual son {_n(u.get('dias_campus_sep_nov') or 0)}")
    if b is not None and not (a is not None and _baja(a, u.get("dias_campus_sep_nov"))):
        add("presencia", _baja(b, u.get("dias_campus_dic_ene")),
            f"En diciembre y enero fue al campus {_n(b)} días; lo usual son {_n(u.get('dias_campus_dic_ene') or 0)}")
    if r.get("trabaja"):
        add("situacion", "media", "Matriculado a tiempo parcial (puede que trabaje)")
    op = r.get("opcion_titulacion")
    if op and op >= 2:
        add("admision", "media" if op >= 3 else "leve", f"Eligió esta titulación como opción {op}, no como la primera", trabajable=False)
    na = r.get("nota_acceso")
    if na is not None and u.get("nota_acceso"):
        add("admision", "media" if na < 0.8 * u["nota_acceso"] else None,
            f"Entró con {_n(na)} de nota de acceso (sobre 14); lo usual es {_n(u['nota_acceso'])}", trabajable=False)
    if tit and tasa_global and tit.get("tasa") is not None and tit["tasa"] >= 1.5 * tasa_global:
        add("titulacion", "media", f"En su titulación ({tit['codigo']}) abandona el {round(100 * tit['tasa'])} % en primer año; "
            f"en toda la universidad, el {round(100 * tasa_global)} %", trabajable=False)
    orden = {"alta": 0, "media": 1, "leve": 2}
    s.sort(key=lambda x: (orden[x["gravedad"]], list(FUENTES).index(x["fuente"])))
    return s


def ruta(sen):
    """A qué servicio llevar el caso después del primer contacto, y por qué (una línea)."""
    hay = lambda fuente, grav=("alta", "media"): any(x["fuente"] == fuente and x["gravedad"] in grav for x in sen)
    if hay("notas", ("alta",)):
        r = "Tutoría académica"
    elif hay("situacion"):
        r = "Apoyo financiero"
    elif hay("presencia", ("alta",)) and not hay("notas"):
        r = "Atención psicológica"
    elif any(x["fuente"] == "admision" and "opción" in x["texto"] and x["gravedad"] == "media" for x in sen):
        r = "Orientación vocacional"
    elif hay("notas"):
        r = "Tutoría académica"
    else:
        r = "Tutoría académica"
    return {"ruta": r, "porque": RUTAS[r]}


def asignar(casos):
    """Reparte los casos (dicts con 'id' y 'ruta') entre el equipo. La primera llamada la puede hacer cualquiera;
    se prefiere a quien atiende la ruta del caso, pero si ya lleva PREFERENCIA casos más que la persona con menos
    carga, el caso pasa a esa otra (y la remisión a la ruta se hace igual después). Determinista: mismo orden de casos
    → misma asignación. Devuelve {id_caso: id_consejera} y la carga de cada una."""
    carga = {p["id"]: 0 for p in EQUIPO}
    asignacion = {}
    for c in casos:
        costo = lambda p: carga[p["id"]] + (0 if c["ruta"] in p["rutas"] else PREFERENCIA)
        elegida = min(EQUIPO, key=lambda p: (costo(p), EQUIPO.index(p)))
        asignacion[c["id"]] = elegida["id"]
        carga[elegida["id"]] += 1
    return asignacion, carga


def titulaciones(bd):
    """Ficha de cada titulación con los estudiantes históricos (los que ya tienen desenlace)."""
    filas = bd.execute("SELECT titulacion, COUNT(*), SUM(deserto), AVG(nota_acceso), AVG(tiempo_parcial) "
                       "FROM estudiantes WHERE conjunto = 'historico' GROUP BY titulacion").fetchall()
    total = sum(f[1] for f in filas)
    tasa_global = sum(f[2] or 0 for f in filas) / total if total else None
    fichas = {}
    for codigo, n, des, acceso, parcial in filas:
        fichas[codigo] = {"codigo": codigo, "n_historico": n, "tasa": (des or 0) / n if n else None,
                          "nota_acceso_media": None if acceso is None else round(acceso, 1),
                          "tiempo_parcial": None if parcial is None else round(parcial, 3)}
    return fichas, tasa_global


EXPLICACION_TITULACION = ("La UPV publica la carrera de cada estudiante anonimizada: «T04» es un código, no se sabe a qué "
                          "carrera corresponde. Lo que sí se sabe de cada código sale de los estudiantes de años anteriores: "
                          "cuántos había, cuántos abandonaron en primer año y con qué nota de acceso entraron.")
