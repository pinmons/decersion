"""Base de datos REAL: de la fuente pública al esquema del contrato.

    python -m desercion.datos_reales            # descarga (si falta) y escribe el CSV del contrato

Fuente: «Predict Students' Dropout and Academic Success», Instituto Politécnico de Portalegre
(Portugal). 4 424 estudiantes reales de pregrado, anonimizados, con su desenlace (desertó, sigue
matriculado o se graduó). Realinho, Vieira Martins, Machado y Baptista (2021), UCI Machine
Learning Repository, https://doi.org/10.24432/C5MC89. Licencia CC BY 4.0.

La fuente no tiene las 12 columnas del contrato con esos nombres. Cada columna se arma así, y
cada decisión es un [SUPUESTO] que se muestra en la web (`SUPUESTOS_MAPEO`):

El corte es el final del primer año: el estudiante va a entrar a tercer semestre y su «periodo
anterior» es el segundo semestre.
"""
import csv
import io
import urllib.request
import zipfile

from . import RAIZ
from .contrato import CAMPOS

DIR_REALES = RAIZ / "datos" / "reales"
RUTA_FUENTE = DIR_REALES / "fuente_uci.csv"
RUTA_CONTRATO = DIR_REALES / "estudiantes_reales.csv"
URL_FUENTE = "https://archive.ics.uci.edu/static/public/697/predict+students+dropout+and+academic+success.zip"

FUENTE = {
    "nombre": "Predict Students' Dropout and Academic Success",
    "institucion": "Instituto Politécnico de Portalegre (Portugal)",
    "autores": "Realinho, Vieira Martins, Machado y Baptista (2021)",
    "repositorio": "UCI Machine Learning Repository",
    "doi": "https://doi.org/10.24432/C5MC89",
    "licencia": "CC BY 4.0",
    "descripcion": "Registros reales y anonimizados de estudiantes de pregrado, con su matrícula, su rendimiento "
                   "en los dos primeros semestres y lo que pasó después: desertó, sigue matriculado o se graduó.",
}

PROGRAMAS = {
    33: "Tecnologías de biocombustibles", 171: "Animación y diseño multimedia", 8014: "Trabajo social (nocturno)",
    9003: "Agronomía", 9070: "Diseño de comunicación", 9085: "Enfermería veterinaria", 9119: "Ingeniería informática",
    9130: "Equinocultura", 9147: "Gestión", 9238: "Trabajo social", 9254: "Turismo", 9500: "Enfermería",
    9556: "Higiene oral", 9670: "Publicidad y mercadeo", 9773: "Periodismo y comunicación", 9853: "Educación básica",
    9991: "Gestión (nocturno)",
}

# Escolaridad de los padres (códigos de la fuente) → 6 bandas. 34 = desconocida.
_BANDAS = {1: (35, 36, 37), 2: (38, 11, 26, 29, 30), 3: (19, 9, 10, 12, 13, 14, 25, 27),
           4: (1, 18, 20, 22, 31, 33, 39), 5: (2, 3, 6, 40, 41, 42), 6: (4, 5, 43, 44)}
BANDA_ESCOLARIDAD = {codigo: banda for banda, codigos in _BANDAS.items() for codigo in codigos}
CREDITOS_POR_MATERIA = 2

# campo del contrato → (de dónde sale, qué tan directo es)
SUPUESTOS_MAPEO = [
    ("id_estudiante", "Número de fila de la fuente (IPP-0001…). La fuente es anónima.", "directo"),
    ("nivel_formacion", "Siempre pregrado: todos los programas de la fuente lo son.", "directo"),
    ("estado_matricula", "Siempre activo: en el corte (fin del primer año) todos estaban matriculados.", "directo"),
    ("semestre", "Siempre 3: la fuente describe los semestres 1 y 2, así que el estudiante va a entrar al tercero.", "supuesto"),
    ("promedio_acumulado", "Nota media de las materias aprobadas en los semestres 1 y 2. La escala portuguesa (0 a 20, "
     "se aprueba con 10) se pasa a la del contrato (0 a 5, se aprueba con 3,0) alineando la nota de aprobación. "
     "Quien no aprobó ninguna materia queda en 0,0.", "aproximado"),
    ("materias_cursadas_periodo_anterior", "Materias inscritas en el segundo semestre.", "directo"),
    ("materias_reprobadas", "Inscritas menos aprobadas en el segundo semestre (no presentarse cuenta como reprobar).", "directo"),
    ("creditos_inscritos", f"Materias del segundo semestre × {CREDITOS_POR_MATERIA}. La fuente no trae créditos; con esa "
     "equivalencia la carga máxima del contrato (12 materias) cabe en sus 25 créditos.", "aproximado"),
    ("porcentaje_asistencia", "La fuente no registra asistencia. Se usa el porcentaje de materias del segundo semestre "
     "en las que el estudiante se presentó a evaluación (0 si no se presentó a ninguna).", "aproximado"),
    ("estrato", "La fuente no tiene estrato. Se usa la escolaridad más alta de los padres en 6 bandas "
     "(1 = sin primaria completa … 6 = maestría o doctorado). Si no se conoce la de ninguno, 3.", "aproximado"),
    ("trabaja", "La fuente no dice si trabaja. Se marca «sí» a quien estudia en jornada nocturna.", "aproximado"),
    ("deuda_matricula", "Sí, cuando la fuente lo marca como deudor o con la matrícula sin pagar al día.", "directo"),
    ("deserto", "1 si el desenlace real fue «desertó»; 0 si se graduó o sigue matriculado.", "directo"),
]


def descargar(ruta=RUTA_FUENTE):
    """Baja el ZIP de UCI y deja el CSV original (separado por punto y coma) en datos/reales/."""
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(URL_FUENTE, timeout=60) as r:
        z = zipfile.ZipFile(io.BytesIO(r.read()))
    ruta.write_bytes(z.read("data.csv"))
    return ruta


def nota_a_escala_contrato(nota):
    """0–20 (aprueba con 10) → 0–5 (aprueba con 3,0), lineal a tramos."""
    v = nota * 0.3 if nota <= 10 else 3.0 + (nota - 10) * 0.2
    return round(min(5.0, max(0.0, v)), 2)


def _columna(fila, trozo):
    for k in fila:
        if trozo in k:
            return fila[k]
    raise KeyError(trozo)


def _estrato(fila):
    bandas = [BANDA_ESCOLARIDAD.get(int(_columna(fila, f"{quien}'s qualification"))) for quien in ("Mother", "Father")]
    bandas = [b for b in bandas if b]
    return max(bandas) if bandas else 3


def mapear(fila, n):
    """Una fila de la fuente → (registro del contrato, datos extra para mostrar)."""
    ins1, apr1, nota1 = (float(_columna(fila, f"1st sem ({c})")) for c in ("enrolled", "approved", "grade"))
    ins2, apr2, nota2 = (float(_columna(fila, f"2nd sem ({c})")) for c in ("enrolled", "approved", "grade"))
    eval2, sin_eval2 = float(_columna(fila, "2nd sem (evaluations)")), float(_columna(fila, "2nd sem (without"))
    aprobadas = apr1 + apr2
    promedio = nota_a_escala_contrato((nota1 * apr1 + nota2 * apr2) / aprobadas) if aprobadas else 0.0
    if ins2 == 0 or eval2 == 0:
        asistencia = 0.0
    else:
        asistencia = round(100 * max(0.0, ins2 - sin_eval2) / ins2, 1)
    registro = {
        "id_estudiante": f"IPP-{n:04d}", "nivel_formacion": "pregrado", "estado_matricula": "activo", "semestre": 3,
        "promedio_acumulado": promedio, "creditos_inscritos": int(ins2) * CREDITOS_POR_MATERIA,
        "materias_cursadas_periodo_anterior": int(ins2), "materias_reprobadas": int(ins2 - apr2),
        "porcentaje_asistencia": asistencia, "estrato": _estrato(fila),
        "trabaja": _columna(fila, "Daytime").strip() == "0",
        "deuda_matricula": fila["Debtor"].strip() == "1" or _columna(fila, "Tuition fees").strip() == "0",
    }
    desenlace = {"Dropout": "deserto", "Graduate": "se_graduo", "Enrolled": "sigue_matriculado"}[fila["Target"].strip()]
    extra = {"deserto": int(desenlace == "deserto"), "desenlace": desenlace,
             "programa": PROGRAMAS.get(int(fila["Course"]), f"Programa {fila['Course']}"),
             "edad_ingreso": int(_columna(fila, "Age at enrollment")), "becado": int(_columna(fila, "Scholarship"))}
    return registro, extra


EXTRAS = ["deserto", "desenlace", "programa", "edad_ingreso", "becado"]


def leer_fuente(ruta=RUTA_FUENTE):
    with open(ruta, newline="", encoding="utf-8-sig") as f:
        return [mapear(fila, i) for i, fila in enumerate(csv.DictReader(f, delimiter=";"), 1)]


def preparar(descargar_si_falta=True):
    """Escribe datos/reales/estudiantes_reales.csv (12 columnas del contrato + deserto + extras)."""
    if not RUTA_FUENTE.exists():
        if not descargar_si_falta:
            raise FileNotFoundError(RUTA_FUENTE)
        descargar()
    filas = leer_fuente()
    with open(RUTA_CONTRATO, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS + EXTRAS)
        w.writeheader()
        for registro, extra in filas:
            w.writerow({**{k: (str(v).lower() if isinstance(v, bool) else v) for k, v in registro.items()}, **extra})
    desertores = sum(e["deserto"] for _, e in filas)
    print(f"Base real: {len(filas)} estudiantes ({desertores} desertaron, {desertores / len(filas):.1%}) → "
          f"{RUTA_CONTRATO.relative_to(RAIZ)}")
    return RUTA_CONTRATO


if __name__ == "__main__":
    preparar()
