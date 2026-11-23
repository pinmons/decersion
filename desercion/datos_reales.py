"""Base de datos REAL: de la fuente pública al esquema del contrato.

    python -m desercion.datos_reales              # extracto (si falta) → CSV del contrato
    python -m desercion.datos_reales --extraer    # rehace el extracto desde la fuente (descarga ~270 MB de Zenodo)

Fuente: «StudentDropoutDataset», Universitat Politècnica de València (España). Registros reales
y anonimizados de los cursos 2018-19, 2021-22 y 2022-23: una fila por estudiante, asignatura y
curso, con la matrícula, las notas, la actividad en el aula virtual y los días conectado al wifi
del campus, y la etiqueta de abandono. Igualde-Sáez, Garcia-Sabater, Benlloch-Dualde, Soriano
Jiménez y Maheut (2025), Zenodo, https://doi.org/10.5281/zenodo.17239943, CC BY 4.0. Artículo
descriptor: Data 10(10):162, https://doi.org/10.3390/data10100162.

La fuente pesa ~270 MB y no va al repositorio. `extraer()` la reduce a un extracto con una fila
por estudiante (`datos/reales/upv_extracto.csv`, < 1 MB) que sí se guarda; con él se arma todo lo
demás. Para reproducirlo desde cero: `--extraer` descarga los ZIP de Zenodo.

Población y corte [SUPUESTO]:
- Estudiantes de PRIMER AÑO de GRADO (empezaron sus estudios ese curso, no tienen asignaturas de
  cursos superiores y su titulación tiene 180 créditos o más) de las cohortes 2021 y 2022.
  2018 no entra: no trae días de wifi, días en el aula virtual ni rendimiento por cuatrimestre.
- El corte es el final del PRIMER CUATRIMESTRE (cuatrimestre A, septiembre a enero): el estudiante
  va a entrar al segundo y su «periodo anterior» es el primero. Nada posterior entra al modelo: ni
  el cuatrimestre B, ni la actividad de febrero en adelante, ni las asignaturas anuales (su nota
  llega en junio), ni `baja_fecha`, `matricula_activa` o el rendimiento total.
- La etiqueta: `abandono_hash` vale «A» o «B» y la fuente no publica cuál es abandono. Los datos
  lo muestran sin ambigüedad (ver `EVIDENCIA_ETIQUETA`): «A» es abandono.
- Los estudiantes con un IMPAGO en la matrícula no entran (`leer_fuente`). Ninguno de los 334 figura
  como abandono aunque el 69 % no aprobó ninguna asignatura y casi ninguno tiene nota de acceso ni vía
  de ingreso: la etiqueta los trata aparte, así que no se sabe si abandonaron. Con ellos dentro, el
  modelo aprendería que «no tener nota de acceso» protege, y que suspenderlo todo no es tan grave.

Además de los 12 campos, cada registro lleva los campos del contrato ampliado
(`contrato_ampliado.CAMPOS`: notas, actividad, admisión y titulación), que solo usa el modelo real.

La fuente no tiene las 12 columnas del contrato con esos nombres. Cada columna se arma así, y
cada decisión es un [SUPUESTO] que se muestra en la web (`SUPUESTOS_MAPEO`).
"""
import argparse
import collections
import csv
import io
import re
import urllib.request
import zipfile

from . import RAIZ
from .contrato import CAMPOS
from .contrato_ampliado import CAMPOS as CAMPOS_AMPLIADOS

DIR_REALES = RAIZ / "datos" / "reales"
DIR_FUENTE = DIR_REALES / "fuente_upv"          # aquí se descargan los CSV originales (no van a git)
RUTA_EXTRACTO = DIR_REALES / "upv_extracto.csv"
RUTA_CONTRATO = DIR_REALES / "estudiantes_reales.csv"
COHORTES = ("2021", "2022")
URL_FUENTE = "https://zenodo.org/records/17239943/files/dataset_{anio}_hash.zip?download=1"

FUENTE = {
    "nombre": "StudentDropoutDataset",
    "institucion": "Universitat Politècnica de València (España)",
    "autores": "Igualde-Sáez, Garcia-Sabater, Benlloch-Dualde, Soriano Jiménez y Maheut (2025)",
    "repositorio": "Zenodo",
    "doi": "https://doi.org/10.5281/zenodo.17239943",
    "licencia": "CC BY 4.0",
    "descripcion": "Registros reales y anonimizados de estudiantes de la UPV (cursos 2021-22 y 2022-23 en esta "
                   "corrida): matrícula, notas por asignatura, días conectados al wifi del campus, actividad en el "
                   "aula virtual y si abandonó la titulación (dos cursos seguidos sin matricularse).",
    "poblacion": "Primer año de grado, cohortes 2021 y 2022, con lo que se sabía al terminar el primer cuatrimestre. "
                 "Sin los 334 estudiantes con impago de matrícula: la fuente no marca a ninguno como abandono.",
}

# Lo que la web dice siempre junto a esta base (página Modelo, inicio y pie).
LIMITE_HONESTO = ("Son estudiantes reales de primer año de la Universitat Politècnica de València (España), no de la "
                  "universidad que use el sistema. La base no registra asistencia ni si el estudiante trabaja: la asistencia "
                  "se aproxima con la presencia en el campus (wifi) y en el aula virtual, y el trabajo con la matrícula a "
                  "tiempo parcial. El estrato no se pudo construir y qué letra marca el abandono se dedujo de los datos. "
                  "Sirve para ver el modelo operar con personas reales, no para decidir sobre estudiantes.")

# Lo que se comprobó con los datos para decidir que «A» es abandono (primer año de grado, 2021 y 2022).
# Lo recalcula `evidencia_etiqueta()` desde el extracto.
EVIDENCIA_ETIQUETA = ("«A» es la letra minoritaria (12 % en primer año de grado, sin los impagos). Los «A» aprueban el 51 % "
                      "de sus asignaturas del primer cuatrimestre frente al 83 % de los «B», tienen menos presencia (35 "
                      "frente a 49 de 100), son seis veces más a menudo de tiempo parcial (4,9 % frente a 0,8 %) y, al "
                      "extraer los datos, solo el 13–18 % seguía con matrícula activa, frente al 77 % de los «B» (esto "
                      "último se midió en la fuente completa, antes de quitar los impagos).")

# Referencias del 100 % en la asistencia: lo que alcanza el 5 % más presente de la población (sept.–enero).
DIAS_LECTIVOS_A = 78   # días conectado al wifi del campus
DIAS_AULA_A = 65.5     # días con entrada al aula virtual, por asignatura del primer cuatrimestre
ENTREGAS_A = 16        # tareas y cuestionarios entregados en el aula virtual, por asignatura
MESES_A = ("09", "10", "11", "12", "01")
CREDITOS_POR_ECTS = 2 / 3
NOTA_APROBADO = 5.0

# campo del contrato → (de dónde sale, qué tan directo es)
SUPUESTOS_MAPEO = [
    ("id_estudiante", "Código propio por cohorte (UPV21-0001…). La fuente solo trae un identificador cifrado.", "directo"),
    ("nivel_formacion", "Siempre pregrado: solo entran titulaciones de grado (180 créditos o más).", "directo"),
    ("estado_matricula", "Siempre activo: quien ya había anulado toda su matrícula antes de febrero no entra (ya se "
     "fue; no hay nada que predecir).", "directo"),
    ("semestre", "Siempre 2: se usa solo lo que se sabía al terminar el primer cuatrimestre, para avisar temprano.", "supuesto"),
    ("promedio_acumulado", "Nota media de las asignaturas APROBADAS del primer cuatrimestre, como la nota media del "
     "expediente en España. La escala española (0 a 10, se aprueba con 5) se pasa a la del contrato (0 a 5, se aprueba "
     "con 3,0) alineando el aprobado. Quien no aprobó ninguna queda en 0,0; quien no tiene ninguna nota, sin dato.",
     "aproximado"),
    ("materias_cursadas_periodo_anterior", "Asignaturas del primer cuatrimestre en las que estaba matriculado. La fuente no "
     "dice de qué cuatrimestre es cada asignatura: se deduce de cuándo tiene actividad el aula virtual de esa "
     "asignatura (80 % o más entre septiembre y enero = primer cuatrimestre). Las anuales no cuentan.", "aproximado"),
    ("materias_reprobadas", "De esas, las suspendidas o sin nota (no presentarse cuenta como reprobar).", "directo"),
    ("creditos_inscritos", "Créditos ECTS del primer cuatrimestre (las anuales cuentan la mitad) × 2/3, para que la carga "
     "habitual (30 ECTS) quede en 20 y la máxima del contrato (25) en 37,5 ECTS. No se usan los del segundo "
     "cuatrimestre: se pueden cambiar en febrero, después del corte.", "aproximado"),
    ("porcentaje_asistencia", "La fuente no registra asistencia. Se usa la presencia de septiembre a enero como el "
     "promedio de tres porcentajes: días conectado al wifi del campus (sobre "
     f"{DIAS_LECTIVOS_A}), días que entró al aula virtual de cada asignatura (sobre {DIAS_AULA_A:g}) y tareas o "
     f"cuestionarios entregados por asignatura (sobre {ENTREGAS_A}). Cada referencia es lo que alcanza el 5 % más "
     "presente; tope de 100. Quien no tiene registro de wifi (la fuente no dice si no fue o si no se registró) se mide "
     "solo con el aula virtual.", "aproximado"),
    ("estrato", "Sin dato: la fuente trae los estudios del padre y de la madre como letras anonimizadas sin significado "
     "publicado, así que no se pueden ordenar. Se pone 3 a todos; al no variar, el modelo no lo usa.", "supuesto"),
    ("trabaja", "Se marca «sí» a quien está matriculado a tiempo parcial. La fuente no dice si trabaja.", "aproximado"),
    ("deuda_matricula", "Sin informar (es opcional en el contrato). La fuente marca impagos, pero ninguno de los 334 "
     "estudiantes con impago figura como abandono: la etiqueta los trata aparte. Por eso esos estudiantes no entran en "
     "la base (no se sabe si abandonaron) y el dato no se usa.", "supuesto"),
    # contrato ampliado (solo el modelo real; ver CONTRATO_AMPLIADO.md)
    ("nota_media_cuatrimestre", "Media de TODAS las notas del primer cuatrimestre (también las suspendidas), en la escala "
     "original 0 a 10. Sin dato si no se presentó a ninguna.", "directo"),
    ("nota_minima_cuatrimestre", "La nota más baja entre las presentadas del primer cuatrimestre (0 a 10).", "directo"),
    ("asignaturas_no_presentadas", "Asignaturas del primer cuatrimestre sin nota.", "directo"),
    ("dias_campus_sep_nov", "Días conectado al wifi del campus en septiembre, octubre y noviembre. Sin dato si la fuente "
     "no tiene ningún registro de wifi del estudiante (no dice si no fue o si no se registró).", "directo"),
    ("dias_campus_dic_ene", "Lo mismo, en diciembre y enero (la época de exámenes).", "directo"),
    ("dias_aula_virtual", "Días que entró al aula virtual, promedio por asignatura del primer cuatrimestre (sept.–enero).",
     "directo"),
    ("entregas_por_asignatura", "Tareas y cuestionarios entregados en el aula virtual, promedio por asignatura "
     "(sept.–enero).", "directo"),
    ("nota_acceso", "Nota de acceso a la universidad, sobre 14.", "directo"),
    ("nota_bachillerato", "Nota media del bachillerato, sobre 10.", "directo"),
    ("opcion_titulacion", "En qué opción pidió la titulación (1 = primera).", "directo"),
    ("tipo_ingreso", "Vía de ingreso tal como la codifica la fuente («NAP» = acceso ordinario, 9 de cada 10).", "directo"),
    ("titulacion", "Titulación, renombrada T01…T45 de la más grande a la más chica (la fuente la trae cifrada). El "
     "modelo no usa el código: usa la tasa de abandono de esa titulación entre los estudiantes de entrenamiento.",
     "directo"),
    ("deserto", "1 si la fuente lo marca como abandono («A»: dos cursos seguidos sin matricularse en la titulación); 0 "
     "si no. La letra no está documentada: se dedujo de los datos.", "supuesto"),
]


# ====================================================================== fuente → extracto
def descargar(anios=COHORTES, destino=DIR_FUENTE):
    """Baja los ZIP de Zenodo y deja los CSV originales en datos/reales/fuente_upv/ (fuera de git)."""
    destino.mkdir(parents=True, exist_ok=True)
    rutas = []
    for anio in anios:
        ruta = destino / f"dataset_{anio}_hash.csv"
        if not ruta.exists():
            with urllib.request.urlopen(URL_FUENTE.format(anio=anio), timeout=600) as r:
                z = zipfile.ZipFile(io.BytesIO(r.read()))
            nombre = next(n for n in z.namelist() if n.endswith(".csv"))
            ruta.write_bytes(z.read(nombre))
        rutas.append(ruta)
    return rutas


def _num(v):
    return None if v is None or v.strip() == "" else float(v.replace(",", "."))


def _mes(ym, caca):
    """'2021_10' → 'A' (sept.–enero del curso), 'B' (feb.–jun.) u otro."""
    anio, mes = ym.split("_")
    mes = f"{int(mes):02d}"
    if (anio == caca and mes in MESES_A[:4]) or (int(anio) == int(caca) + 1 and mes == "01"):
        return "A"
    if int(anio) == int(caca) + 1 and mes in ("02", "03", "04", "05", "06"):
        return "B"
    return None


def _leer_anio(ruta):
    """Una pasada por el CSV de un curso: datos por estudiante y actividad por asignatura."""
    estudiantes = collections.OrderedDict()
    actividad = collections.defaultdict(lambda: [0.0, 0.0])   # asignatura → días en el aula virtual en A y en B
    with open(ruta, newline="", encoding="utf-8-sig") as f:
        lector = csv.DictReader(f, delimiter=";")
        meses = [(c, *re.match(r"(.*)_(\d{4}_\d{1,2})$", c).groups()) for c in lector.fieldnames
                 if re.search(r"_\d{4}_\d{1,2}$", c)]
        for fila in lector:
            caca = fila["caca"]
            e = estudiantes.get(fila["dni_hash"])
            if e is None:
                e = estudiantes[fila["dni_hash"]] = {"fila": fila, "asignaturas": [], "wifi": {}, "bajas": []}
            aula = {}
            e["asignaturas"].append((fila["asi_hash"], _num(fila["nota_asig_hash"]), aula))
            e["bajas"].append(fila["baja_fecha"])
            for columna, variable, ym in meses:
                v = fila[columna]
                if v == "":
                    continue
                if variable == "n_wifi_days":
                    e["wifi"][ym] = float(v.replace(",", "."))
                elif variable in ("pft_days_logged", "pft_assignment_submissions", "pft_test_submissions"):
                    parte = _mes(ym, caca)
                    if parte is None:
                        continue
                    valor = float(v.replace(",", "."))
                    if variable == "pft_days_logged":
                        actividad[fila["asi_hash"]][parte == "B"] += valor
                    if parte == "A":   # lo del propio estudiante en esa asignatura, solo de septiembre a enero
                        clave = "dias" if variable == "pft_days_logged" else "entregas"
                        aula[clave] = aula.get(clave, 0.0) + valor
    return estudiantes, actividad


def _cuatrimestre(actividad, asignatura):
    a, b = actividad.get(asignatura, (0.0, 0.0))
    if a + b < 20:
        return None
    return "A" if a / (a + b) >= 0.8 else "B" if a / (a + b) <= 0.2 else "anual"


def _primer_anio_de_grado(fila):
    total_titulacion = (_num(fila["cred_sup_tit"]) or 0) + (_num(fila["cred_pend_sup_tit"]) or 0)
    return (fila["anyo_inicio_estudios"] == fila["caca"] and fila["curso_mas_alto"] == "1"
            and total_titulacion >= 180)


COLUMNAS_EXTRACTO = ["id", "cohorte", "titulacion", "abandono", "tipo_ingreso", "nota_acceso", "nota_bachillerato",
                     "preferencia", "tiempo_parcial", "impagado", "ects_a", "ects_anual", "asignaturas_a", "notas_a",
                     "aula_dias_a", "entregas_a", "wifi_registrado"] + [f"wifi_{m}" for m in MESES_A]


def extraer(rutas=None):
    """Fuente (CSV por curso) → datos/reales/upv_extracto.csv, una fila por estudiante de la población."""
    rutas = rutas or [DIR_FUENTE / f"dataset_{a}_hash.csv" for a in COHORTES]
    if not all(r.exists() for r in rutas):
        rutas = descargar()
    filas, titulaciones, fuera = [], collections.Counter(), collections.Counter()
    for ruta in rutas:
        estudiantes, actividad = _leer_anio(ruta)
        n = 0
        for e in estudiantes.values():
            f = e["fila"]
            if not _primer_anio_de_grado(f):
                continue
            caca = f["caca"]
            corte = f"{int(caca) + 1}-02-01"
            if all(b and b < corte for b in e["bajas"]):
                fuera["baja_antes_del_corte"] += 1
                continue
            n += 1
            de_a = [(nota, aula) for asig, nota, aula in e["asignaturas"] if _cuatrimestre(actividad, asig) == "A"]
            notas_a = [nota for nota, _ in de_a]
            wifi = {}
            for ym, dias in e["wifi"].items():
                anio, mes = ym.split("_")
                if _mes(ym, caca) == "A":
                    wifi[f"{int(mes):02d}"] = dias
            titulaciones[f["tit_hash"]] += 1
            filas.append({
                "id": f"UPV{caca[2:]}-{n:04d}", "cohorte": caca, "titulacion": f["tit_hash"],
                "abandono": f["abandono_hash"], "tipo_ingreso": f["tipo_ingreso"],
                "nota_acceso": f["nota14_hash"].replace(",", "."), "nota_bachillerato": f["nota10_hash"].replace(",", "."),
                "preferencia": f["preferencia_seleccion"].replace(",0", ""),
                "tiempo_parcial": int(f["dedicacion"] == "TP"), "impagado": int(f["impagado_curso_mat"] != ""),
                "ects_a": _num(f["cred_mat_sem_a"]) or 0, "ects_anual": _num(f["cred_mat_anu"]) or 0,
                "asignaturas_a": len(notas_a),
                "notas_a": ";".join("NP" if nota is None else f"{nota:g}" for nota in notas_a),
                "aula_dias_a": round(sum(a.get("dias", 0) for _, a in de_a) / len(de_a), 2) if de_a else "",
                "entregas_a": round(sum(a.get("entregas", 0) for _, a in de_a) / len(de_a), 2) if de_a else "",
                "wifi_registrado": int(bool(e["wifi"])),
                **{f"wifi_{m}": (wifi.get(m, 0) if e["wifi"] else "") for m in MESES_A},
            })
    # Las titulaciones vienen cifradas: se numeran de la más grande a la más chica (T01, T02…).
    codigo = {t: f"T{i:02d}" for i, (t, _) in enumerate(titulaciones.most_common(), 1)}
    for fila in filas:
        fila["titulacion"] = codigo[fila["titulacion"]]
    DIR_REALES.mkdir(parents=True, exist_ok=True)
    with open(RUTA_EXTRACTO, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNAS_EXTRACTO, lineterminator="\n")
        w.writeheader()
        w.writerows(filas)
    print(f"Extracto: {len(filas)} estudiantes de primer año de grado → {RUTA_EXTRACTO.relative_to(RAIZ)} "
          f"(fuera por haber anulado la matrícula antes del corte: {fuera['baja_antes_del_corte']})")
    return RUTA_EXTRACTO


# ====================================================================== extracto → contrato
def nota_a_escala_contrato(nota):
    """0–10 (aprueba con 5) → 0–5 (aprueba con 3,0), lineal a tramos."""
    v = nota * 0.6 if nota <= NOTA_APROBADO else 3.0 + (nota - NOTA_APROBADO) * 0.4
    return round(min(5.0, max(0.0, v)), 2)


def _notas(texto):
    return [None if n == "NP" else float(n) for n in texto.split(";")] if texto else []


def presencia(fila):
    """Porcentaje 0–100 de presencia de septiembre a enero (campus y aula virtual). None si no hay ningún dato."""
    partes = []
    if fila["wifi_registrado"] == "1":
        partes.append(sum(float(fila[f"wifi_{m}"] or 0) for m in MESES_A) / DIAS_LECTIVOS_A)
    if fila["aula_dias_a"] != "":
        partes += [float(fila["aula_dias_a"]) / DIAS_AULA_A, float(fila["entregas_a"]) / ENTREGAS_A]
    if not partes:
        return None
    return round(sum(min(1.0, p) for p in partes) / len(partes) * 100, 1)


def mapear(fila):
    """Una fila del extracto → (registro del contrato, datos extra para mostrar y para el modelo de ingreso)."""
    notas = _notas(fila["notas_a"])
    con_nota = [n for n in notas if n is not None]
    aprobadas = [n for n in con_nota if n >= NOTA_APROBADO]
    if not con_nota:
        promedio = None                                   # sin ninguna nota: no se inventa
    else:
        promedio = nota_a_escala_contrato(sum(aprobadas) / len(aprobadas)) if aprobadas else 0.0
    asistencia = presencia(fila)
    ects = float(fila["ects_a"]) + float(fila["ects_anual"]) / 2
    registro = {
        "id_estudiante": fila["id"], "nivel_formacion": "pregrado", "estado_matricula": "activo", "semestre": 2,
        "promedio_acumulado": promedio, "creditos_inscritos": min(25, int(round(ects * CREDITOS_POR_ECTS))),
        "materias_cursadas_periodo_anterior": len(notas), "materias_reprobadas": len(notas) - len(aprobadas),
        "porcentaje_asistencia": asistencia, "estrato": 3, "trabaja": fila["tiempo_parcial"] == "1",
        "deuda_matricula": None,
    }
    num = lambda v: float(v) if v not in ("", None) else None
    wifi = fila["wifi_registrado"] == "1"
    dias = lambda meses: round(sum(float(fila[f"wifi_{m}"] or 0) for m in meses), 1) if wifi else None
    registro.update({                                    # contrato ampliado (todos opcionales)
        "nota_media_cuatrimestre": round(sum(con_nota) / len(con_nota), 2) if con_nota else None,
        "nota_minima_cuatrimestre": min(con_nota) if con_nota else None,
        "asignaturas_no_presentadas": len(notas) - len(con_nota),
        "dias_campus_sep_nov": dias(MESES_A[:3]), "dias_campus_dic_ene": dias(MESES_A[3:]),
        "dias_aula_virtual": num(fila["aula_dias_a"]), "entregas_por_asignatura": num(fila["entregas_a"]),
        "nota_acceso": num(fila["nota_acceso"]), "nota_bachillerato": num(fila["nota_bachillerato"]),
        "opcion_titulacion": int(float(fila["preferencia"])) if fila["preferencia"] else None,
        "tipo_ingreso": fila["tipo_ingreso"] or None, "titulacion": fila["titulacion"],
    })
    deserto = int(fila["abandono"] == "A")
    extra = {"deserto": deserto, "desenlace": "abandono" if deserto else "sigue", "cohorte": int(fila["cohorte"]),
             "tiempo_parcial": int(fila["tiempo_parcial"]), "ects": round(ects, 1),
             "wifi_dias": (sum(float(fila[f"wifi_{m}"] or 0) for m in MESES_A) if wifi else None)}
    return registro, extra


EXTRAS = ["deserto", "desenlace", "cohorte", "tiempo_parcial", "ects", "wifi_dias"]


def leer_fuente(ruta=RUTA_EXTRACTO, con_impagos=False):
    """Extracto → [(registro, extra)]. Los estudiantes con impago no entran (ver la cabecera)."""
    with open(ruta, newline="", encoding="utf-8") as f:
        return [mapear(fila) for fila in csv.DictReader(f) if con_impagos or fila["impagado"] != "1"]


def evidencia_etiqueta(filas=None):
    """Compara a los «A» con los «B» en lo que se sabe hasta el corte (para documentar la decisión)."""
    filas = filas or leer_fuente()
    salida = {}
    for letra, d in (("A", 1), ("B", 0)):
        g = [(r, e) for r, e in filas if e["deserto"] == d]
        cursadas = [r for r, _ in g if r["materias_cursadas_periodo_anterior"]]
        asist = [r["porcentaje_asistencia"] for r, _ in g if r["porcentaje_asistencia"] is not None]
        salida[letra] = {"n": len(g), "fraccion": len(g) / len(filas),
                         "aprobadas_a": sum(1 - r["materias_reprobadas"] / r["materias_cursadas_periodo_anterior"]
                                            for r in cursadas) / len(cursadas),
                         "asistencia_media": sum(asist) / len(asist),
                         "tiempo_parcial": sum(e["tiempo_parcial"] for _, e in g) / len(g)}
    return salida


def preparar(rehacer_extracto=False):
    """Escribe datos/reales/estudiantes_reales.csv (12 columnas del contrato + deserto + extras)."""
    if rehacer_extracto or not RUTA_EXTRACTO.exists():
        extraer()
    filas = leer_fuente()
    with open(RUTA_CONTRATO, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS + list(CAMPOS_AMPLIADOS) + EXTRAS, lineterminator="\n")
        w.writeheader()
        for registro, extra in filas:
            w.writerow({**{k: ("" if v is None else str(v).lower() if isinstance(v, bool) else v)
                           for k, v in registro.items()},
                        **{k: ("" if v is None else v) for k, v in extra.items()}})
    desertores = sum(e["deserto"] for _, e in filas)
    print(f"Base real (UPV): {len(filas)} estudiantes ({desertores} abandonaron, {desertores / len(filas):.1%}; "
          f"sin los {len(leer_fuente(con_impagos=True)) - len(filas)} con impago) → {RUTA_CONTRATO.relative_to(RAIZ)}")
    ev = evidencia_etiqueta(filas)
    print("Etiqueta: " + " | ".join(f"«{k}» {v['n']} ({v['fraccion']:.1%}), aprobó {v['aprobadas_a']:.0%} de sus "
                                     f"asignaturas del 1.er cuatrimestre, asistencia media {v['asistencia_media']:.0f}, "
                                     f"tiempo parcial {v['tiempo_parcial']:.1%}" for k, v in ev.items()))
    return RUTA_CONTRATO


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Base real de la UPV → CSV del contrato")
    p.add_argument("--extraer", action="store_true", help="rehace el extracto desde la fuente (descarga si falta)")
    preparar(p.parse_args().extraer)
