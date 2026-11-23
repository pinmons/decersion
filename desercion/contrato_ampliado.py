"""Contrato ampliado: lo que el modelo REAL recibe además de los 12 campos del contrato.

El contrato original (`contrato.py`) no cambia: su Paso 1 valida los 12 campos e ignora las claves que
no conoce, la regla R3.4 y las garantías siguen igual, y la corrida sintética, «Probar un caso» y las
rondas 1 a 4 no usan nada de este archivo. El modelo entrenado con la base real (`--nombre real`) sí
recibe, en el mismo registro, los campos de `CAMPOS` (todos opcionales). Detalle en CONTRATO_AMPLIADO.md.

Qué hace este módulo (solo NumPy: corre en Vercel):
- `validar(e)`: Paso 1 de los campos ampliados. Un campo presente con tipo o rango inválido es un error
  controlado (no se califica con un dato malo); dos datos que se contradicen, una abstención. Un campo
  ausente NO es un error: el modelo lo imputa y lo dice.
- `ajustar(registros, y)`: aprende SOLO con los estudiantes de entrenamiento lo que la imputación y la
  tasa de abandono por titulación necesitan, y lo devuelve como un diccionario que se guarda en el JSON
  del modelo. La inferencia usa ese mismo diccionario (`aux`), así hace exactamente lo mismo.
- `valor(e, variable, aux)`: el número que entra al modelo. Si el dato falta se usa la MEDIANA de
  entrenamiento y la variable indicadora correspondiente («sin_…») vale 1: no se inventa en silencio.

Tasa de abandono de la titulación [SUPUESTO]: la proporción de abandono de los estudiantes de
entrenamiento de esa titulación, suavizada hacia la tasa general con `SUAVIZADO` estudiantes ficticios
(una titulación con 8 estudiantes no da una tasa fiable). Para los estudiantes de entrenamiento se calcula
FUERA DE PLIEGUE (5 partes: la tasa de cada uno sale de las otras cuatro), porque si su propio desenlace
entrara en la tasa, el modelo aprendería de una respuesta filtrada. Validación, prueba y operación usan la
tasa de todo el entrenamiento. Una titulación desconocida recibe la tasa general.
"""
import math

import numpy as np

from .contrato import normalizar

# campo de entrada: (tipo, rango, fuente, de qué se trata)
CAMPOS = {
    "nota_media_cuatrimestre": ("num", (0.0, 10.0), "notas", "Nota media de todas las asignaturas presentadas del primer cuatrimestre (0 a 10)"),
    "nota_minima_cuatrimestre": ("num", (0.0, 10.0), "notas", "La nota más baja entre las presentadas (0 a 10)"),
    "asignaturas_no_presentadas": ("int", (0, 12), "notas", "Asignaturas del primer cuatrimestre sin nota (no se presentó)"),
    "dias_campus_sep_nov": ("num", (0.0, 91.0), "actividad", "Días conectado al wifi del campus, de septiembre a noviembre"),
    "dias_campus_dic_ene": ("num", (0.0, 62.0), "actividad", "Días conectado al wifi del campus, de diciembre a enero"),
    "dias_aula_virtual": ("num", (0.0, 153.0), "actividad", "Días que entró al aula virtual, promedio por asignatura (septiembre a enero)"),
    "entregas_por_asignatura": ("num", (0.0, 200.0), "actividad", "Tareas y cuestionarios entregados, promedio por asignatura (septiembre a enero)"),
    "nota_acceso": ("num", (0.0, 14.0), "admision", "Nota de acceso a la universidad (0 a 14)"),
    "nota_bachillerato": ("num", (0.0, 10.0), "admision", "Nota media del bachillerato (0 a 10)"),
    "opcion_titulacion": ("int", (1, 30), "admision", "En qué opción eligió la titulación (1 = primera)"),
    "tipo_ingreso": ("str", None, "admision", "Vía de ingreso (código de la universidad; «NAP» = acceso ordinario)"),
    "titulacion": ("str", None, "titulacion", "Código de la titulación"),
}

# variable del modelo: (rango posible, fuente, signo esperado del riesgo: +1 sube, -1 baja, 0 sin supuesto).
# El entrenamiento restringe el peso a ese signo [SUPUESTO]. Las indicadoras «sin dato» llevan +1: que falte un dato
# nunca baja el riesgo (el mismo principio que el contrato aplica a la deuda ausente).
VARIABLES = {
    "nota_media_cuatrimestre": ((0.0, 10.0), "notas", -1),
    "nota_minima_cuatrimestre": ((0.0, 10.0), "notas", -1),
    "asignaturas_no_presentadas": ((0, 12), "notas", +1),
    "dias_campus_sep_nov": ((0.0, 91.0), "actividad", -1),
    "dias_campus_dic_ene": ((0.0, 62.0), "actividad", -1),
    "sin_registro_wifi": ((0, 1), "actividad", +1),
    "dias_aula_virtual": ((0.0, 153.0), "actividad", -1),
    "entregas_por_asignatura": ((0.0, 200.0), "actividad", -1),
    "sin_aula_virtual": ((0, 1), "actividad", +1),
    "nota_acceso": ((0.0, 14.0), "admision", -1),
    "sin_nota_acceso": ((0, 1), "admision", +1),
    "nota_bachillerato": ((0.0, 10.0), "admision", -1),
    "sin_nota_bachillerato": ((0, 1), "admision", +1),
    "opcion_titulacion": ((1, 30), "admision", +1),
    "sin_opcion_titulacion": ((0, 1), "admision", +1),
    "ingreso_ordinario": ((0, 1), "admision", 0),
    "abandono_titulacion": ((0.0, 1.0), "titulacion", +1),
}

# indicadora «sin dato» → campos que la encienden (si falta cualquiera de ellos)
INDICADORAS = {
    "sin_registro_wifi": ("dias_campus_sep_nov", "dias_campus_dic_ene"),
    "sin_aula_virtual": ("dias_aula_virtual", "entregas_por_asignatura"),
    "sin_nota_acceso": ("nota_acceso",),
    "sin_nota_bachillerato": ("nota_bachillerato",),
    "sin_opcion_titulacion": ("opcion_titulacion",),
}
# [SUPUESTO] tipo de ingreso ausente = acceso ordinario (lo de 9 de cada 10), SIN indicadora: los 54 registros
# sin tipo de ingreso que quedan en la base no tienen ningún abandono, y una indicadora aprendería ese artefacto.
INGRESO_ORDINARIO = "NAP"

# Fuente de las variables del contrato original (para la importancia por fuente).
FUENTE_CONTRATO = {
    "promedio_acumulado": "notas", "tasa_reprobacion": "notas", "materias_reprobadas": "notas",
    "materias_cursadas_periodo_anterior": "notas", "porcentaje_asistencia": "actividad", "trabaja": "admision",
    "creditos_inscritos": "admision", "semestre": "admision", "estrato": "admision", "deuda_matricula": "admision",
}
FUENTES = {"notas": "Notas del primer cuatrimestre", "actividad": "Actividad (campus y aula virtual)",
           "admision": "Matrícula y admisión", "titulacion": "Titulación"}
# Lo que se puede saber antes de que lleguen las notas (el aviso provisional): todo menos las notas.
ANTES_DE_NOTAS = ("actividad", "admision", "titulacion")

SUAVIZADO = 20         # [SUPUESTO] estudiantes ficticios con la tasa general que se suman a cada titulación
PLIEGUES = 5
PERCENTIL_RECORTE = 99  # [SUPUESTO] en los campos continuos, lo que pasa del percentil 99 de entrenamiento cuenta como ese valor


def fuente(variable):
    if variable in VARIABLES:
        return VARIABLES[variable][1]
    return FUENTE_CONTRATO.get(variable, "admision")


def _tipo_ok(tipo, v):
    if tipo == "str":
        return isinstance(v, str) and v.strip() != ""
    if tipo == "int":
        return isinstance(v, int) and not isinstance(v, bool)
    return (isinstance(v, (int, float)) and not isinstance(v, bool) and not math.isnan(v) and not math.isinf(v))


def validar(e):
    """Paso 1 de los campos ampliados (después del Paso 1 del contrato). None si todo está bien."""
    e = normalizar(e)
    for campo, (tipo, rango, _, _) in CAMPOS.items():
        v = e.get(campo)
        if v is None:
            continue
        if not _tipo_ok(tipo, v):
            return {"decision": "error", "motivo": "tipo_invalido", "campo": campo}
        if rango is not None and not (rango[0] <= v <= rango[1]):
            return {"decision": "error", "motivo": "fuera_de_rango", "campo": campo}
    nop = e.get("asignaturas_no_presentadas")
    if nop is not None and e.get("materias_cursadas_periodo_anterior") is not None \
            and nop > e["materias_cursadas_periodo_anterior"]:
        return {"decision": "abstener", "motivo": "datos_contradictorios", "campos": ["asignaturas_no_presentadas"]}
    vmin, vmed = e.get("nota_minima_cuatrimestre"), e.get("nota_media_cuatrimestre")
    if vmin is not None and vmed is not None and vmin > vmed + 1e-9:
        return {"decision": "abstener", "motivo": "datos_contradictorios", "campos": ["nota_minima_cuatrimestre"]}
    return None


def faltantes(e, variables=None):
    """Campos ampliados que el registro no trae (los que el modelo usa, si se dan `variables`)."""
    usados = None
    if variables is not None:
        usados = set()
        for v in variables:
            usados |= set(INDICADORAS.get(v, ())) | ({v} if v in CAMPOS else set())
            if v == "abandono_titulacion":
                usados.add("titulacion")
            if v == "ingreso_ordinario":
                usados.add("tipo_ingreso")
    return [c for c in CAMPOS if (usados is None or c in usados) and normalizar(e).get(c) is None]


# ---------------------------------------------------------------- aprender la imputación (solo entrenamiento)
def _tasas(titulaciones, y, m=SUAVIZADO):
    g = float(np.mean(y))
    salida = {}
    for t in sorted(set(titulaciones)):
        s = [yy for tt, yy in zip(titulaciones, y) if tt == t]
        salida[t] = [round((sum(s) + m * g) / (len(s) + m), 4), len(s)]
    return salida, g


def ajustar(registros, y, semilla=2026):
    """Lo que la imputación y la titulación necesitan, aprendido con los registros de ENTRENAMIENTO.

    Devuelve (aux, tasa_fuera_de_pliegue): `aux` va al JSON del modelo; el arreglo trae, para cada registro
    de entrenamiento, la tasa de su titulación calculada sin él (ver la cabecera del módulo)."""
    y = np.asarray(y, int)
    medianas, recortes = {}, {}
    for campo, (tipo, rango, _, _) in CAMPOS.items():
        if tipo == "str":
            continue
        v = np.array([r[campo] for r in registros if r.get(campo) is not None], float)
        if len(v) == 0:
            continue
        medianas[campo] = float(np.median(v))
        alto = float(np.percentile(v, PERCENTIL_RECORTE))
        if tipo == "num" and alto > rango[0]:   # los conteos (int) y lo que es casi siempre 0 no se recortan
            recortes[campo] = [float(rango[0]), float(min(rango[1], alto))]
    tit = [r.get("titulacion") or "" for r in registros]
    tasas, g = _tasas(tit, y)
    oof = np.zeros(len(registros))
    rng = np.random.default_rng(semilla)
    pliegues = np.array_split(rng.permutation(len(registros)), PLIEGUES)
    for k in range(PLIEGUES):
        resto = np.concatenate([pliegues[i] for i in range(PLIEGUES) if i != k])
        t_k, g_k = _tasas([tit[i] for i in resto], y[resto])
        oof[pliegues[k]] = [t_k[tit[i]][0] if tit[i] in t_k else g_k for i in pliegues[k]]
    tasas.pop("", None)
    aux = {"medianas": medianas, "recortes": recortes, "titulaciones": tasas, "tasa_global": round(g, 4),
           "suavizado": SUAVIZADO, "percentil_recorte": PERCENTIL_RECORTE, "n_entrenamiento": len(registros)}
    return aux, oof


# ---------------------------------------------------------------- de registro a número
def tasa_titulacion(e, aux):
    t = e.get("titulacion")
    return aux["titulaciones"][t][0] if t in aux["titulaciones"] else aux["tasa_global"]


def valor(e, variable, aux):
    """Valor numérico de una variable ampliada (imputado y recortado con lo aprendido en entrenamiento)."""
    if variable in INDICADORAS:
        return float(any(e.get(c) is None for c in INDICADORAS[variable]))
    if variable == "abandono_titulacion":
        return float(tasa_titulacion(e, aux))
    if variable == "ingreso_ordinario":
        t = e.get("tipo_ingreso")
        return 1.0 if t is None or t == INGRESO_ORDINARIO else 0.0
    v = e.get(variable)
    if v is None:
        return float(aux["medianas"][variable])
    lo, hi = aux["recortes"].get(variable, VARIABLES[variable][0])
    return float(min(hi, max(lo, v)))


def rango(variable, aux):
    """Rango de la variable para la tarjeta de puntaje (el recorte aprendido, si lo hay)."""
    if aux and variable in aux.get("recortes", {}):
        return tuple(aux["recortes"][variable])
    if variable == "abandono_titulacion" and aux:
        tasas = [t for t, _ in aux["titulaciones"].values()] + [aux["tasa_global"]]
        return (min(tasas), max(tasas))
    return VARIABLES[variable][0]


def resumen_aux(aux):
    """Versión corta de `aux` para los reportes (sin la tabla de titulaciones)."""
    return {k: v for k, v in aux.items() if k != "titulaciones"} | {"n_titulaciones": len(aux["titulaciones"])}
