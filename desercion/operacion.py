"""Operación automática: la base de datos real → Paso 1 → modelo → un resultado por estudiante.

    python -m desercion.operacion     # arma la base (SQLite) y deja una copia de la última corrida en la web

La base `base_datos/registro_academico.sqlite` hace de «registro académico» de la institución.
Tiene a los 4 424 estudiantes reales (ver datos_reales.py) en dos conjuntos:

- `historico`: cohortes pasadas con desenlace conocido. Con ellos se entrenó y se validó.
- `operacion`: los que el modelo nunca vio (el conjunto de prueba) y los registros que el
  Paso 1 no deja pasar. Son los que califica la operación.

`procesar()` lee la base y pasa cada registro por el sistema completo (validación, R3.4,
modelo). No recalcula nada por fuera de `sistema.evaluar`. Solo usa la biblioteca estándar y
NumPy: corre igual en Vercel (GET /api/estudiantes) y en local.
"""
import json
import sqlite3
import time
from datetime import datetime, timezone

from . import RAIZ
from .contrato import CAMPOS, paso1_validar
from .web import responder_evaluar

RUTA_BD = RAIZ / "base_datos" / "registro_academico.sqlite"
DIR_WEB = RAIZ / "public" / "reportes" / "real"
MODELOS_OPERACION = ("logistica", "red_neuronal", "reglas")
BOOLEANOS = ("trabaja", "deuda_matricula")
EXTRAS = ("deserto", "desenlace", "programa", "edad_ingreso", "becado")

ESQUEMA_SQL = """
CREATE TABLE estudiantes (
    id_estudiante TEXT PRIMARY KEY,
    nivel_formacion TEXT, estado_matricula TEXT, semestre INTEGER, promedio_acumulado REAL,
    creditos_inscritos INTEGER, materias_cursadas_periodo_anterior INTEGER, materias_reprobadas INTEGER,
    porcentaje_asistencia REAL, estrato INTEGER, trabaja INTEGER, deuda_matricula INTEGER,
    deserto INTEGER, desenlace TEXT, programa TEXT, edad_ingreso INTEGER, becado INTEGER,
    conjunto TEXT NOT NULL CHECK (conjunto IN ('historico', 'operacion'))
);
CREATE INDEX por_conjunto ON estudiantes (conjunto);
CREATE TABLE fuente (clave TEXT PRIMARY KEY, valor TEXT);
"""


# ------------------------------------------------------------------ armar la base
def construir_bd():
    """Crea la base desde la fuente real y la división del entrenamiento (reportes/real/)."""
    from .datos_reales import FUENTE, leer_fuente  # solo al armar: en Vercel la base ya viene hecha
    resultados = json.loads((RAIZ / "reportes" / "real" / "resultados.json").read_text(encoding="utf-8"))
    ids_prueba = set(resultados["datos"]["ids_prueba"])
    RUTA_BD.parent.mkdir(parents=True, exist_ok=True)
    if RUTA_BD.exists():
        RUTA_BD.unlink()
    bd = sqlite3.connect(RUTA_BD)
    bd.executescript(ESQUEMA_SQL)
    columnas = CAMPOS + list(EXTRAS) + ["conjunto"]
    cuenta = {"historico": 0, "operacion": 0}
    for registro, extra in leer_fuente():
        en_operacion = registro["id_estudiante"] in ids_prueba or paso1_validar(registro) is not None
        fila = {**registro, **extra, "conjunto": "operacion" if en_operacion else "historico"}
        cuenta[fila["conjunto"]] += 1
        bd.execute(f"INSERT INTO estudiantes ({', '.join(columnas)}) VALUES ({', '.join('?' * len(columnas))})",
                   [int(fila[c]) if isinstance(fila[c], bool) else fila[c] for c in columnas])
    bd.executemany("INSERT INTO fuente VALUES (?, ?)", list(FUENTE.items()))
    bd.commit()
    bd.execute("VACUUM")
    bd.close()
    print(f"Base de datos: {RUTA_BD.relative_to(RAIZ)} con {sum(cuenta.values())} estudiantes "
          f"({cuenta['historico']} históricos, {cuenta['operacion']} en operación)")
    return cuenta


# ------------------------------------------------------------------ leer la base
def _conectar():
    # Solo lectura: en Vercel el disco no se puede escribir.
    return sqlite3.connect(f"file:{RUTA_BD.as_posix()}?mode=ro&immutable=1", uri=True)


def leer_cohorte(conjunto="operacion"):
    """Devuelve [(registro del contrato, extras)] tal como están en la base."""
    bd = _conectar()
    bd.row_factory = sqlite3.Row
    filas = bd.execute("SELECT * FROM estudiantes WHERE conjunto = ? ORDER BY id_estudiante", (conjunto,)).fetchall()
    bd.close()
    salida = []
    for f in filas:
        registro = {c: f[c] for c in CAMPOS if f[c] is not None}
        for c in BOOLEANOS:
            if c in registro:
                registro[c] = bool(registro[c])
        salida.append((registro, {c: f[c] for c in EXTRAS}))
    return salida


def resumen_bd():
    bd = _conectar()
    conteo = dict(bd.execute("SELECT conjunto, COUNT(*) FROM estudiantes GROUP BY conjunto").fetchall())
    fuente = dict(bd.execute("SELECT clave, valor FROM fuente").fetchall())
    bd.close()
    return {"archivo": RUTA_BD.name, "motor": "SQLite", "total": sum(conteo.values()),
            "historico": conteo.get("historico", 0), "operacion": conteo.get("operacion", 0), "fuente": fuente}


# ------------------------------------------------------------------ explicar un resultado
def _coma(x, d=1):
    return f"{x:.{d}f}".replace(".", ",")


def _por_que(variable, r):
    """Frase corta con el dato del registro que explica los puntos de una variable."""
    if variable == "promedio_acumulado":
        if r["promedio_acumulado"] == 0:
            return "No aprobó ninguna materia en el año"
        return f"Promedio de {_coma(r['promedio_acumulado'], 2)} (se aprueba con 3,0)"
    if variable in ("tasa_reprobacion", "materias_reprobadas"):
        return f"Reprobó {r['materias_reprobadas']} de {r['materias_cursadas_periodo_anterior']} materias"
    if variable == "porcentaje_asistencia":
        return f"Se presentó al {_coma(r['porcentaje_asistencia'], 0)} % de sus materias"
    if variable == "deuda_matricula":
        return "Tiene deuda de matrícula" if r.get("deuda_matricula") else "No se sabe si tiene deuda"
    if variable == "trabaja":
        return "Estudia de noche (se asume que trabaja)"
    if variable == "estrato":
        return f"Hogar con escolaridad en la banda {r['estrato']} de 6"
    if variable == "creditos_inscritos":
        return f"Carga de {r['creditos_inscritos']} créditos"
    return variable


# Lo que bienestar puede hacer frente a cada factor. Estrato, trabajo y carga no se «mejoran».
MEJORAS = {
    "promedio_acumulado": "Tutoría en las materias con la nota más baja.",
    "tasa_reprobacion": "Acompañamiento para recuperar las materias reprobadas.",
    "materias_reprobadas": "Acompañamiento para recuperar las materias reprobadas.",
    "porcentaje_asistencia": "Llamarlo para saber por qué no se está presentando.",
    "deuda_matricula": "Remitir a apoyo financiero para un acuerdo de pago.",
}


def _nivel_con(puntaje, cortes):
    return "alto" if puntaje >= cortes["corte_alto"] else "medio" if puntaje >= cortes["corte_medio"] else "bajo"


def _explicar(salida, registro, modelo):
    puntos = sorted(salida["puntos_por_variable"].items(), key=lambda kv: -kv[1])
    porque = [{"variable": v, "puntos": round(p, 1), "texto": _por_que(v, registro)} for v, p in puntos if p >= 1]
    mejorar = []
    for v, p in puntos:
        if p < 1 or v not in MEJORAS:
            continue
        item = {"variable": v, "puntos": round(p, 1), "texto": MEJORAS[v]}
        # En la tarjeta de puntos (logística y reglas) los puntos se suman: quitar un factor resta exactamente eso.
        if modelo != "red_neuronal" and not salida.get("regla_r34"):
            item["nivel_si_mejora"] = _nivel_con(salida["puntaje"] - p, salida["cortes"])
        mejorar.append(item)
    return porque, mejorar


# ------------------------------------------------------------------ la corrida
def procesar(modelo="logistica"):
    """Lee la cohorte en operación y devuelve un resultado por estudiante + el resumen de la corrida."""
    if modelo not in MODELOS_OPERACION:
        modelo = "logistica"
    t0 = time.perf_counter()
    cohorte = leer_cohorte("operacion")
    t_lectura = time.perf_counter()
    modo = "reglas" if modelo == "reglas" else "aprendido"
    estudiantes, cortes = [], None
    conteo = {"resultado": 0, "abstener": 0, "error": 0}
    niveles = {n: {"n": 0, "desertaron": 0} for n in ("bajo", "medio", "alto")}
    matriz = {"vp": 0, "fp": 0, "fn": 0, "vn": 0}
    for registro, extra in cohorte:
        _, salida = responder_evaluar({"entrada": registro, "modo": modo, "origen": "real",
                                       "modelo": "logistica" if modelo == "reglas" else modelo})
        conteo[salida["decision"]] = conteo.get(salida["decision"], 0) + 1
        fila = {"id": registro.get("id_estudiante"), "programa": extra["programa"], "edad": extra["edad_ingreso"],
                "becado": bool(extra["becado"]), "desenlace": extra["desenlace"], "decision": salida["decision"],
                "registro": {c: registro.get(c) for c in CAMPOS[3:]}}
        if salida["decision"] == "resultado":
            cortes = salida["cortes"]
            porque, mejorar = _explicar(salida, registro, modelo)
            fila.update(nivel=salida["nivel"], puntaje=salida["puntaje"], accion=salida["accion"],
                        probabilidad=salida.get("probabilidad"), r34=bool(salida.get("regla_r34")),
                        puntos=salida["puntos_por_variable"], porque=porque, mejorar=mejorar)
            niveles[salida["nivel"]]["n"] += 1
            niveles[salida["nivel"]]["desertaron"] += extra["deserto"]
            clave = ("v" if (salida["nivel"] == "alto") == bool(extra["deserto"]) else "f") + \
                    ("p" if salida["nivel"] == "alto" else "n")
            matriz[clave] += 1
        else:
            fila.update(motivo=salida.get("motivo"), campo=salida.get("campo") or ", ".join(salida.get("campos", [])))
        estudiantes.append(fila)
    orden = {"alto": 0, "medio": 1, "bajo": 2}
    estudiantes.sort(key=lambda f: (orden.get(f.get("nivel"), 3), -(f.get("puntaje") or 0), f["id"]))
    t_fin = time.perf_counter()
    return {
        "ejecucion": {"fecha": datetime.now(timezone.utc).isoformat(timespec="seconds"), "modelo": modelo,
                      "ms_lectura": round(1000 * (t_lectura - t0), 1), "ms_modelo": round(1000 * (t_fin - t_lectura), 1),
                      "leidos": len(cohorte), "calificados": conteo["resultado"], "a_revision": conteo["abstener"],
                      "con_error": conteo["error"]},
        "base": resumen_bd(), "cortes": cortes, "niveles": niveles, "matriz": matriz,
        "programas": sorted({f["programa"] for f in estudiantes}), "estudiantes": estudiantes,
    }


def publicar_copia():
    """Deja en la web una copia de la última corrida (por si la API no responde) y la ficha de la base."""
    from .datos_reales import SUPUESTOS_MAPEO
    DIR_WEB.mkdir(parents=True, exist_ok=True)
    corrida = procesar("logistica")
    (DIR_WEB / "estudiantes.json").write_text(json.dumps(corrida, ensure_ascii=False), encoding="utf-8")
    base = {**resumen_bd(), "mapeo": [{"campo": c, "origen": o, "tipo": t} for c, o, t in SUPUESTOS_MAPEO]}
    (DIR_WEB / "base.json").write_text(json.dumps(base, ensure_ascii=False, indent=1), encoding="utf-8")
    e = corrida["ejecucion"]
    print(f"Operación: {e['leidos']} leídos → {e['calificados']} calificados, {e['a_revision']} a revisión, "
          f"{e['con_error']} con error ({e['ms_lectura'] + e['ms_modelo']:.0f} ms). Copia en public/reportes/real/")


if __name__ == "__main__":
    construir_bd()
    publicar_copia()
