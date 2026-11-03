"""Generador de estudiantes sintéticos con etiqueta `deserto` (0/1).

NO HAY DATOS REALES. Todo lo que se entrena y se mide con estos datos describe un mundo
simulado; sirve para construir y probar el proceso, no para afirmar nada sobre estudiantes
reales.

Cómo se genera cada estudiante [SUPUESTO]:

1. Dos factores latentes correlacionados (r = 0.30):
   - S (socioeconómico) y A (desempeño académico).
2. Los 12 campos del contrato salen de esos factores, así quedan correlacionados como en la
   vida real:
   - estrato: cuantiles de S (+ruido) con la distribución 22/35/27/10/4/2 %.
   - trabaja ~ Bernoulli(sigmoide(-0.7 - 0.8·S)): estrato bajo → más trabajo.
   - deuda   ~ Bernoulli(sigmoide(-1.3 - 0.7·S + 0.4·trabaja)).
   - promedio = 3.55 + 0.45·A - 0.05·trabaja + N(0, 0.20), en [0.5, 5.0].
   - materias cursadas ∈ 3..8 (quien trabaja a veces cursa una menos).
   - reprobadas ~ Binomial(cursadas, sigmoide(-2.3 - 1.4·A + N(0, 0.4))).
   - asistencia = 86 + 6·A - 4·trabaja + N(0, 6), en [30, 100].
   - créditos = 2.6·cursadas + 0.8·A - 1.5·trabaja + N(0, 2), en [4, 25].
3. La probabilidad real de desertar sale de una función latente DISTINTA de las reglas del
   contrato (no tiene escalones en 3.0/3.5 ni en 70/85, y tiene interacciones):

       z = b0
         + 1.8 · bisagra_suave(3.3 - promedio)            (solo pesa por debajo de ~3.3)
         + 2.2 · tasa_reprobacion
         + 0.0009 · max(0, 92 - asistencia)²              (cuadrática)
         + 0.25 · trabaja
         + 1.10 · trabaja · sigmoide((78 - asistencia)/3) (INTERACCIÓN: trabajar pesa más
                                                           si la asistencia es baja)
         + 0.22 · max(0, 4 - estrato)
         + 0.35 · deuda + 0.45 · deuda · [estrato ≤ 2]    (INTERACCIÓN deuda × estrato)
         + 0.20 · [semestre = 2]
         - 0.05 · (créditos - 15)
         + N(0, 0.6)                                       (ruido: lo que no se observa)
       p = sigmoide(z),  deserto ~ Bernoulli(p)

   b0 se ajusta por bisección para que la tasa media sea 18 % [SUPUESTO: SPADIES 2023 da
   ~12 % anual y la deserción se concentra en los primeros semestres].
4. A ~8 % de los registros válidos se les quita `deuda_matricula` (es opcional).
5. Se agrega ~3 % de registros defectuosos (faltantes, tipos malos, fuera de rango, otra
   población, contradicciones). El Paso 1 del contrato los descarta antes de entrenar.
"""
import csv
import math
from collections import Counter

import numpy as np

from .contrato import ESQUEMA, CAMPOS, paso1_validar

SEMILLA = 2026
N_VALIDOS = 20_000
TASA_OBJETIVO = 0.18
FRACCION_DEFECTOS = 0.03
FRACCION_SIN_DEUDA = 0.08
DISTRIBUCION_ESTRATO = [0.22, 0.35, 0.27, 0.10, 0.04, 0.02]

FORMULA_LATENTE = (
    "z = b0 + 1.8·bisagra(3.3 - promedio) + 2.2·tasa_reprobacion + 0.0009·max(0, 92 - asistencia)² "
    "+ 0.25·trabaja + 1.10·trabaja·sigmoide((78 - asistencia)/3) + 0.22·max(0, 4 - estrato) "
    "+ 0.35·deuda + 0.45·deuda·[estrato ≤ 2] + 0.20·[semestre = 2] - 0.05·(créditos - 15) + N(0, 0.6)"
)


def _sigmoide(z):
    return 1.0 / (1.0 + np.exp(-z))


def _bisagra_suave(x, ancho=0.25):
    """softplus escalado: ≈ max(0, x) pero sin esquina (la etiqueta no tiene escalones)."""
    return ancho * np.log1p(np.exp(x / ancho))


def _generar_campos(n, rng):
    """Genera n estudiantes válidos de la población (como arreglos)."""
    s = rng.normal(size=n)
    a = 0.30 * s + math.sqrt(1 - 0.30 ** 2) * rng.normal(size=n)

    s_ruido = s + rng.normal(0, 0.3, n)
    cortes = np.quantile(s_ruido, np.cumsum(DISTRIBUCION_ESTRATO)[:-1])
    estrato = np.searchsorted(cortes, s_ruido) + 1

    trabaja = rng.random(n) < _sigmoide(-0.7 - 0.8 * s)
    deuda = rng.random(n) < _sigmoide(-1.3 - 0.7 * s + 0.4 * trabaja)
    semestre = rng.integers(2, 5, n)

    promedio = np.clip(3.55 + 0.45 * a - 0.05 * trabaja + rng.normal(0, 0.20, n), 0.5, 5.0).round(2)
    cursadas = rng.choice([3, 4, 5, 6, 7, 8], size=n, p=[0.04, 0.12, 0.30, 0.34, 0.15, 0.05])
    cursadas = np.where(trabaja & (rng.random(n) < 0.4), np.maximum(cursadas - 1, 3), cursadas)
    p_reprobar = _sigmoide(-2.3 - 1.4 * a + rng.normal(0, 0.4, n))
    reprobadas = rng.binomial(cursadas, p_reprobar)
    asistencia = np.clip(86 + 6 * a - 4 * trabaja + rng.normal(0, 6, n), 30, 100).round(1)
    creditos = np.clip(np.round(2.6 * cursadas + 0.8 * a - 1.5 * trabaja + rng.normal(0, 2, n)), 4, 25).astype(int)

    return {
        "semestre": semestre, "promedio_acumulado": promedio, "creditos_inscritos": creditos,
        "materias_cursadas_periodo_anterior": cursadas, "materias_reprobadas": reprobadas,
        "porcentaje_asistencia": asistencia, "estrato": estrato, "trabaja": trabaja,
        "deuda_matricula": deuda,
    }


def logit_latente_sin_intercepto(c, ruido):
    """Función latente de riesgo (ver docstring del módulo), sin b0."""
    prom, asis = c["promedio_acumulado"], c["porcentaje_asistencia"]
    tasa = c["materias_reprobadas"] / c["materias_cursadas_periodo_anterior"]
    trab = c["trabaja"].astype(float)
    deuda = c["deuda_matricula"].astype(float)
    return (1.8 * _bisagra_suave(3.3 - prom)
            + 2.2 * tasa
            + 0.0009 * np.maximum(0, 92 - asis) ** 2
            + 0.25 * trab
            + 1.10 * trab * _sigmoide((78 - asis) / 3)
            + 0.22 * np.maximum(0, 4 - c["estrato"])
            + 0.35 * deuda + 0.45 * deuda * (c["estrato"] <= 2)
            + 0.20 * (c["semestre"] == 2)
            - 0.05 * (c["creditos_inscritos"] - 15)
            + ruido)


def _ajustar_intercepto(z_sin_b0, objetivo):
    """Bisección: b0 tal que la probabilidad media sea `objetivo`."""
    bajo, alto = -15.0, 15.0
    for _ in range(80):
        medio = (bajo + alto) / 2
        if _sigmoide(z_sin_b0 + medio).mean() > objetivo:
            alto = medio
        else:
            bajo = medio
    return (bajo + alto) / 2


def _a_registros(c, n, prefijo, inicio=0):
    regs = []
    for i in range(n):
        r = {"id_estudiante": f"{prefijo}-{inicio + i + 1:06d}", "nivel_formacion": "pregrado",
             "estado_matricula": "activo"}
        for k, v in c.items():
            x = v[i]
            if ESQUEMA[k][0] == "bool":
                r[k] = bool(x)
            elif ESQUEMA[k][0] == "int":
                r[k] = int(x)
            else:
                r[k] = float(x)
        regs.append({k: r[k] for k in CAMPOS})
    return regs


TIPOS_DEFECTO = ["faltante", "nulo", "tipo_texto", "bool_texto", "fuera_de_rango",
                 "escala_asistencia", "otra_poblacion", "contradictorio"]


def _danar(r, tipo, rng):
    """Introduce un defecto realista en una copia del registro."""
    r = dict(r)
    if tipo == "faltante":
        r.pop(rng.choice(["promedio_acumulado", "porcentaje_asistencia", "estrato", "trabaja"]))
    elif tipo == "nulo":
        r[rng.choice(["materias_reprobadas", "creditos_inscritos", "semestre"])] = None
    elif tipo == "tipo_texto":
        r["semestre"] = str(r["semestre"])
    elif tipo == "bool_texto":
        r["trabaja"] = "si" if r["trabaja"] else "no"
    elif tipo == "fuera_de_rango":
        r["promedio_acumulado"] = round(r["promedio_acumulado"] * 10, 1)  # escala 0–50
    elif tipo == "escala_asistencia":
        r["porcentaje_asistencia"] = round(r["porcentaje_asistencia"] / 100, 3)
    elif tipo == "otra_poblacion":
        cambio = rng.integers(3)
        if cambio == 0:
            r["nivel_formacion"] = "posgrado"
        elif cambio == 1:
            r["semestre"] = int(rng.integers(5, 11))
        else:
            r["estado_matricula"] = "retirado"
    elif tipo == "contradictorio":
        r["materias_reprobadas"] = r["materias_cursadas_periodo_anterior"] + 1
    return r


def generar(n_validos=N_VALIDOS, semilla=SEMILLA):
    """Genera el dataset crudo (válidos + defectuosos), todavía sin pasar por el Paso 1.

    Devuelve un diccionario con:
      registros   lista de dicts con el esquema del contrato (algunos con defectos)
      deserto     arreglo 0/1 (para los defectuosos no se usa)
      prob_real   probabilidad latente real (solo existe porque los datos son sintéticos)
      defecto     tipo de defecto introducido o None
      intercepto  b0 ajustado
    """
    rng = np.random.default_rng(semilla)
    n_def = round(n_validos * FRACCION_DEFECTOS / (1 - FRACCION_DEFECTOS))
    n = n_validos + n_def
    c = _generar_campos(n, rng)
    ruido = rng.normal(0, 0.6, n)
    z0 = logit_latente_sin_intercepto(c, ruido)
    b0 = _ajustar_intercepto(z0[:n_validos], TASA_OBJETIVO)
    prob = _sigmoide(z0 + b0)
    deserto = (rng.random(n) < prob).astype(int)

    registros = _a_registros(c, n, "SIN")
    sin_deuda = rng.random(n_validos) < FRACCION_SIN_DEUDA
    for i in np.flatnonzero(sin_deuda):
        registros[i].pop("deuda_matricula")
    defecto = [None] * n
    for j, i in enumerate(range(n_validos, n)):
        tipo = TIPOS_DEFECTO[j % len(TIPOS_DEFECTO)]
        registros[i] = _danar(registros[i], tipo, rng)
        defecto[i] = tipo
    # se mezclan para que los defectuosos no queden todos al final
    orden = rng.permutation(n)
    return {"registros": [registros[i] for i in orden], "deserto": deserto[orden],
            "prob_real": prob[orden], "defecto": [defecto[i] for i in orden], "intercepto": b0}


def filtrar_por_contrato(registros, deserto, extras=None):
    """Pasa cada registro por el Paso 1. Devuelve los válidos y el conteo de descartes.

    `extras` es un diccionario opcional de arreglos alineados (ej. prob_real) que se filtra igual.
    """
    validos, y, idx = [], [], []
    por_motivo, detalle = Counter(), []
    for i, r in enumerate(registros):
        s1 = paso1_validar(r)
        if s1 is None:
            validos.append(r); y.append(int(deserto[i])); idx.append(i)
        else:
            clave = f"{s1['decision']}({s1['motivo']})"
            por_motivo[clave] += 1
            detalle.append({"id": r.get("id_estudiante"), "salida": s1})
    extras_f = {k: np.asarray(v)[idx] for k, v in (extras or {}).items()}
    return validos, np.array(y, dtype=int), dict(por_motivo), detalle, extras_f


# ------------------------------------------------------------------ CSV (datos reales)
def _convertir_celda(campo, texto):
    """Convierte una celda de CSV al tipo del contrato. Si no se puede, deja el texto
    original para que el Paso 1 lo rechace con `tipo_invalido` (no se adivina)."""
    if texto is None or texto.strip() == "":
        return None
    t = texto.strip()
    tipo = ESQUEMA[campo][0]
    if tipo == "bool":
        return {"true": True, "false": False}.get(t.lower(), texto)  # [SUPUESTO] solo true/false
    if tipo == "int":
        try:
            return int(t)
        except ValueError:
            return texto
    if tipo == "num":
        try:
            return float(t)
        except ValueError:
            return texto  # ej. "3,8" queda como texto → tipo_invalido (como T02)
    return texto


def leer_csv(ruta):
    """Lee un CSV con las columnas del contrato y `deserto`. Devuelve (registros, deserto)."""
    registros, deserto = [], []
    with open(ruta, newline="", encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            r = {}
            for campo in CAMPOS:
                if campo in fila:
                    v = _convertir_celda(campo, fila[campo])
                    if v is not None or campo != "deuda_matricula":
                        r[campo] = v
            registros.append(r)
            d = (fila.get("deserto") or "").strip()
            deserto.append(int(d) if d in ("0", "1") else -1)
    return registros, np.array(deserto)


def cargar_datos_reales(ruta_csv):
    """Carga datos reales con el mismo esquema + columna `deserto` (0/1).

    Cada fila pasa por el Paso 1 del contrato; solo los válidos con etiqueta 0/1 se usan.
    Devuelve (registros_validos, deserto, descartes_por_motivo).
    """
    registros, deserto = leer_csv(ruta_csv)
    sin_etiqueta = int((deserto < 0).sum())
    validos, y, por_motivo, _, _ = filtrar_por_contrato(registros, deserto)
    con_etiqueta = [i for i, v in enumerate(y) if v in (0, 1)]
    if sin_etiqueta:
        por_motivo["sin_etiqueta_deserto"] = sin_etiqueta
    return [validos[i] for i in con_etiqueta], y[con_etiqueta], por_motivo


def guardar_csv(registros, deserto, ruta):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with open(ruta, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS + ["deserto"])
        w.writeheader()
        for r, d in zip(registros, deserto):
            fila = {k: ("" if r.get(k) is None else (str(r[k]).lower() if isinstance(r[k], bool) else r[k]))
                    for k in CAMPOS}
            fila["deserto"] = int(d)
            w.writerow(fila)
