"""Operación automática: la base de datos real → Paso 1 → modelo → un resultado por estudiante.

    python -m desercion.operacion     # arma la base (SQLite) y deja una copia de la última corrida en la web

La base `base_datos/registro_academico.sqlite` hace de «registro académico» de la institución.
Tiene a los estudiantes reales de primer año de la UPV (ver datos_reales.py) en dos conjuntos:

- `historico`: con desenlace conocido, con los que se entrenó y se validó.
- `operacion`: los que el modelo nunca vio (el conjunto de prueba) y los registros que el
  Paso 1 no deja pasar. Son los que califica la operación. Si fueran más de `MAX_OPERACION`,
  se tomaría una muestra estratificada con semilla fija (el resto queda en `reserva`) para que la
  respuesta de la API no pese demasiado.

`procesar()` lee la base y pasa cada registro por el sistema completo (validación, R3.4,
modelo). No recalcula nada por fuera de `sistema.evaluar`. Solo usa la biblioteca estándar y
NumPy: corre igual en Vercel (GET /api/estudiantes) y en local.
"""
import json
import sqlite3
import time
from datetime import datetime, timezone

from . import RAIZ
from . import ingreso
from .contrato import ACCION_POR_NIVEL, CAMPOS, paso1_validar
from .variables import caso_evidente
from .web import responder_evaluar

RUTA_BD = RAIZ / "base_datos" / "registro_academico.sqlite"
DIR_WEB = RAIZ / "public" / "reportes" / "real"
MODELOS_OPERACION = ("logistica", "red_neuronal", "reglas")
BOOLEANOS = ("trabaja", "deuda_matricula")
EXTRAS = ("deserto", "desenlace", "cohorte", "titulacion", "nota_acceso", "nota_bachillerato", "preferencia",
          "tipo_ingreso", "tiempo_parcial", "ects", "impagado", "wifi_dias", "aula_dias", "entregas")
MAX_OPERACION = 1400   # [SUPUESTO] tope de estudiantes en operación: la API responde en ~1 MB

ESQUEMA_SQL = """
CREATE TABLE estudiantes (
    id_estudiante TEXT PRIMARY KEY,
    nivel_formacion TEXT, estado_matricula TEXT, semestre INTEGER, promedio_acumulado REAL,
    creditos_inscritos INTEGER, materias_cursadas_periodo_anterior INTEGER, materias_reprobadas INTEGER,
    porcentaje_asistencia REAL, estrato INTEGER, trabaja INTEGER, deuda_matricula INTEGER,
    deserto INTEGER, desenlace TEXT, cohorte INTEGER, titulacion TEXT, nota_acceso REAL, nota_bachillerato REAL,
    preferencia REAL, tipo_ingreso TEXT, tiempo_parcial INTEGER, ects REAL, impagado INTEGER,
    wifi_dias REAL, aula_dias REAL, entregas REAL,
    conjunto TEXT NOT NULL CHECK (conjunto IN ('historico', 'operacion', 'reserva'))
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
    import random
    columnas = CAMPOS + list(EXTRAS) + ["conjunto"]
    cuenta = {"historico": 0, "operacion": 0, "reserva": 0}
    filas = leer_fuente()
    en_operacion = [r["id_estudiante"] in ids_prueba or paso1_validar(r) is not None for r, _ in filas]
    elegidos = {i for i, op in enumerate(en_operacion) if op}
    if len(elegidos) > MAX_OPERACION:   # muestra estratificada por desenlace, semilla fija
        rng = random.Random(2026)
        nuevos = set()
        for d in (0, 1):
            grupo = sorted(i for i in elegidos if filas[i][1]["deserto"] == d)
            nuevos |= set(rng.sample(grupo, round(MAX_OPERACION * len(grupo) / len(elegidos))))
        elegidos = nuevos
    for i, (registro, extra) in enumerate(filas):
        conjunto = "operacion" if i in elegidos else "reserva" if en_operacion[i] else "historico"
        fila = {**registro, **extra, "conjunto": conjunto}
        cuenta[conjunto] += 1
        bd.execute(f"INSERT INTO estudiantes ({', '.join(columnas)}) VALUES ({', '.join('?' * len(columnas))})",
                   [int(fila[c]) if isinstance(fila[c], bool) else fila[c] for c in columnas])
    bd.executemany("INSERT INTO fuente VALUES (?, ?)", list(FUENTE.items()))
    bd.commit()
    bd.execute("VACUUM")
    bd.close()
    print(f"Base de datos: {RUTA_BD.relative_to(RAIZ)} con {sum(cuenta.values())} estudiantes "
          f"({cuenta['historico']} históricos, {cuenta['operacion']} en operación"
          + (f", {cuenta['reserva']} en reserva fuera de la muestra" if cuenta["reserva"] else "") + ")")
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
            "historico": conteo.get("historico", 0), "operacion": conteo.get("operacion", 0),
            "reserva": conteo.get("reserva", 0), "muestra": bool(conteo.get("reserva")), "fuente": fuente}


# ------------------------------------------------------------------ explicar un resultado
def _coma(x, d=1):
    return f"{x:.{d}f}".replace(".", ",")


def _por_que(variable, r):
    """Frase corta con el dato del registro que explica los puntos de una variable."""
    if variable == "promedio_acumulado":
        if r["promedio_acumulado"] == 0:
            return "No aprobó ninguna asignatura del primer cuatrimestre"
        return f"Nota media de {_coma(r['promedio_acumulado'], 2)} en lo aprobado (se aprueba con 3,0)"
    if variable in ("tasa_reprobacion", "materias_reprobadas"):
        return f"Suspendió {r['materias_reprobadas']} de {r['materias_cursadas_periodo_anterior']} asignaturas del primer cuatrimestre"
    if variable == "materias_cursadas_periodo_anterior":
        return f"Cursó {r['materias_cursadas_periodo_anterior']} asignaturas en el primer cuatrimestre"
    if variable == "porcentaje_asistencia":
        return f"Presencia del {_coma(r['porcentaje_asistencia'], 0)} % (campus y aula virtual)"
    if variable == "deuda_matricula":
        return "Tiene deuda de matrícula" if r.get("deuda_matricula") else "No se sabe si tiene deuda"
    if variable == "trabaja":
        return "Matriculado a tiempo parcial (se asume que trabaja)"
    if variable == "estrato":
        return f"Estrato {r['estrato']}"
    if variable == "creditos_inscritos":
        return f"Carga de {r['creditos_inscritos']} créditos"
    return variable


# Lo que bienestar puede hacer frente a cada factor. Estrato, trabajo y carga no se «mejoran».
MEJORAS = {
    "promedio_acumulado": "Tutoría en las asignaturas con la nota más baja.",
    "tasa_reprobacion": "Plan para recuperar las asignaturas suspendidas del primer cuatrimestre.",
    "materias_reprobadas": "Plan para recuperar las asignaturas suspendidas del primer cuatrimestre.",
    "porcentaje_asistencia": "Llamarlo para saber por qué dejó de ir al campus y de entrar al aula virtual.",
    "deuda_matricula": "Remitir a apoyo financiero para un acuerdo de pago.",
}

TEXTOS_MEJORA = {**MEJORAS, "ingreso": "Asignarle un tutor de primer año mientras el registro completa sus datos."}

# Por qué el contrato no califica un registro (para el aviso al registro, una vez por causa).
CAUSAS = {
    "promedio_acumulado": "no tienen ninguna nota del primer cuatrimestre",
    "porcentaje_asistencia": "no tienen ningún dato de presencia (ni wifi ni aula virtual)",
    "datos_contradictorios": "tienen una presencia de 1 % o menos, que el contrato lee como un posible error de escala",
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
        item = {"variable": v, "puntos": round(p, 1)}   # el texto va una sola vez en "textos_mejora"
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
    conteo = {"resultado": 0, "abstener": 0, "error": 0, "provisional": 0}
    niveles_provisional = {n: {"n": 0, "desertaron": 0} for n in ("bajo", "medio", "alto")}
    sin_historial = {}
    niveles = {n: {"n": 0, "desertaron": 0} for n in ("bajo", "medio", "alto")}
    matriz = {"vp": 0, "fp": 0, "fn": 0, "vn": 0}
    for registro, extra in cohorte:
        _, salida = responder_evaluar({"entrada": registro, "modo": modo, "origen": "real",
                                       "modelo": "logistica" if modelo == "reglas" else modelo})
        conteo[salida["decision"]] = conteo.get(salida["decision"], 0) + 1
        fila = {"id": registro.get("id_estudiante"), "titulacion": f"Titulación {extra['titulacion']}",
                "cohorte": extra["cohorte"], "desenlace": extra["desenlace"], "decision": salida["decision"],
                "registro": {c: registro.get(c) for c in CAMPOS[3:]},
                "matricula": {k: extra[k] for k in ("nota_acceso", "preferencia", "tipo_ingreso", "tiempo_parcial", "ects",
                                                    "wifi_dias", "aula_dias", "entregas")}}
        if salida["decision"] == "resultado":
            cortes = salida["cortes"]
            porque, mejorar = _explicar(salida, registro, modelo)
            fila.update(nivel=salida["nivel"], puntaje=salida["puntaje"], accion=salida["accion"],
                        probabilidad=None if salida.get("probabilidad") is None else round(salida["probabilidad"], 3), r34=bool(salida.get("regla_r34")),
                        porque=porque, mejorar=mejorar,
                        evidente=bool(caso_evidente(registro)))
            niveles[salida["nivel"]]["n"] += 1
            niveles[salida["nivel"]]["desertaron"] += extra["deserto"]
            clave = ("v" if (salida["nivel"] == "alto") == bool(extra["deserto"]) else "f") + \
                    ("p" if salida["nivel"] == "alto" else "n")
            matriz[clave] += 1
        else:
            fila.update(motivo=salida.get("motivo"), campo=salida.get("campo") or ", ".join(salida.get("campos", [])))
            # El contrato se abstiene (falta un dato o se contradice): se respeta, no hay resultado definitivo, y el
            # modelo de ingreso da una alerta provisional con los datos de la matrícula. Nadie queda a revisión manual.
            if salida["decision"] == "abstener" and salida.get("motivo") != "fuera_de_poblacion":
                prov = ingreso.calificar(extra)
                if prov:
                    conteo["abstener"] -= 1
                    conteo["provisional"] += 1
                    causa = (salida["campos"][0] if salida.get("motivo") == "campo_faltante" else salida.get("motivo"))
                    sin_historial[causa] = sin_historial.get(causa, 0) + 1
                    niveles_provisional[prov["nivel"]]["n"] += 1
                    niveles_provisional[prov["nivel"]]["desertaron"] += extra["deserto"]
                    mejorar = [{"variable": "ingreso"}] if prov["nivel"] != "bajo" else []
                    fila.update(decision="provisional", nivel=prov["nivel"], puntaje=prov["puntaje"],
                                probabilidad=prov["probabilidad"], porque=prov["porque"], mejorar=mejorar,
                                accion=ACCION_POR_NIVEL[prov["nivel"]])
        estudiantes.append(fila)
    orden = {"alto": 0, "medio": 1, "bajo": 2}
    for f in estudiantes:
        f.pop("accion", None) if f["decision"] == "error" else None
    estudiantes.sort(key=lambda f: (orden.get(f.get("nivel"), 3), -(f.get("puntaje") or 0), f["id"]))
    t_fin = time.perf_counter()
    return {
        "ejecucion": {"fecha": datetime.now(timezone.utc).isoformat(timespec="seconds"), "modelo": modelo,
                      "ms_lectura": round(1000 * (t_lectura - t0), 1), "ms_modelo": round(1000 * (t_fin - t_lectura), 1),
                      "leidos": len(cohorte), "calificados": conteo["resultado"], "provisionales": conteo["provisional"],
                      "a_revision": conteo["abstener"], "con_error": conteo["error"]},
        # Lo que el sistema le pide al registro académico, una sola vez por causa (no un caso por estudiante).
        "avisos": [{"tipo": "dato_faltante", "causa": c, "n": n,
                    "texto": f"{n} estudiantes {CAUSAS.get(c, 'tienen un dato que el contrato no acepta')}. Mientras el "
                             "registro lo completa, tienen un resultado provisional con los datos de su matrícula."}
                   for c, n in sorted(sin_historial.items(), key=lambda t: -t[1])]
                  + ([{"tipo": "fuera_de_rango", "n": conteo["error"],
                       "texto": f"{conteo['error']} registros traen un dato fuera del rango del contrato y se devolvieron "
                                "al registro para corregir."}] if conteo["error"] else []),
        "niveles_provisional": niveles_provisional, "cortes_provisional": (ingreso.cargar() or {}).get("cortes"),
        "ingreso": (ingreso.cargar() or {}).get("metricas_prueba"),
        "base": resumen_bd(), "cortes": cortes, "niveles": niveles, "matriz": matriz,
        "textos_mejora": TEXTOS_MEJORA, "titulaciones": sorted({f["titulacion"] for f in estudiantes}), "estudiantes": estudiantes,
    }


def publicar_copia():
    """Deja en la web una copia de la última corrida (por si la API no responde) y la ficha de la base."""
    from .datos_reales import SUPUESTOS_MAPEO
    import shutil
    DIR_WEB.mkdir(parents=True, exist_ok=True)
    if ingreso.RUTA_MODELO.exists():   # el modelo de ingreso se entrena aquí, después de publicar los otros dos
        (DIR_WEB / "modelos").mkdir(exist_ok=True)
        shutil.copy2(ingreso.RUTA_MODELO, DIR_WEB / "modelos" / ingreso.RUTA_MODELO.name)
    corrida = procesar("logistica")
    (DIR_WEB / "estudiantes.json").write_text(json.dumps(corrida, ensure_ascii=False), encoding="utf-8")
    base = {**resumen_bd(), "mapeo": [{"campo": c, "origen": o, "tipo": t} for c, o, t in SUPUESTOS_MAPEO]}
    (DIR_WEB / "base.json").write_text(json.dumps(base, ensure_ascii=False, indent=1), encoding="utf-8")
    e = corrida["ejecucion"]
    print(f"Operación: {e['leidos']} leídos → {e['calificados']} calificados, {e['provisionales']} provisionales, "
          f"{e['a_revision']} a revisión, "
          f"{e['con_error']} con error ({e['ms_lectura'] + e['ms_modelo']:.0f} ms). Copia en public/reportes/real/")


if __name__ == "__main__":
    construir_bd()
    ingreso.entrenar_y_guardar()
    ingreso._CACHE.clear()
    publicar_copia()
