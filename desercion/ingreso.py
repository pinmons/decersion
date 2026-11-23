"""Modelo de ingreso: un resultado PROVISIONAL para quien no tiene historial académico en la base.

    python -m desercion.ingreso      # entrena y guarda modelos_entrenados/real/ingreso.json

Por qué existe. El contrato manda abstenerse cuando falta un dato obligatorio o el registro se
contradice: no se inventan notas. En la base de la UPV eso le pasa, sobre todo, a quien no tiene
ninguna nota del primer cuatrimestre. Mandar esos casos a revisión manual no es operar: la
abstención del contrato se respeta (no hay resultado definitivo), y mientras el registro completa
el dato este modelo da una alerta provisional con lo que SÍ se sabe desde la matrícula: nota de
acceso a la universidad, en qué opción eligió la titulación, dedicación (tiempo completo o parcial)
y créditos matriculados. Sirve igual para un estudiante recién llegado.

La nota de acceso falta en algunos registros (otras vías de acceso). No se inventa: se usa la media
de entrenamiento y una marca «sin nota de acceso», que el modelo aprende como un dato más.

Es la misma regresión logística desde cero (modelos/logistica.py), entrenada con los estudiantes
históricos y medida con los de operación que sí tienen resultado del contrato (nunca los vio).
Es más débil que el modelo principal, y la web lo dice. Solo NumPy en la inferencia.
"""
import json

import numpy as np

from . import RAIZ

RUTA_MODELO = RAIZ / "modelos_entrenados" / "real" / "ingreso.json"
VARIABLES = ["nota_acceso", "sin_nota_acceso", "preferencia", "tiempo_parcial", "ects"]
PREFERENCIA_SI_FALTA = 1   # [SUPUESTO] sin dato de preferencia = la eligió en primera opción (lo más común)
_CACHE = {}


def _datos(extra, media_nota):
    """Extras de la base → las variables del modelo (con la marca de nota faltante)."""
    nota = extra.get("nota_acceso")
    return {"nota_acceso": media_nota if nota is None else float(nota), "sin_nota_acceso": float(nota is None),
            "preferencia": float(extra.get("preferencia") or PREFERENCIA_SI_FALTA),
            "tiempo_parcial": float(extra.get("tiempo_parcial") or 0), "ects": float(extra.get("ects") or 0)}


def _vector(datos):
    return np.array([float(datos[v]) for v in VARIABLES], dtype=float)


def _sigmoide(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -40, 40)))


# ------------------------------------------------------------------ entrenamiento
def entrenar_y_guardar():
    import sqlite3

    from . import tarjeta_puntaje as tp
    from .contrato import CAMPOS, paso1_validar
    from .entrenamiento import CONFIG_LOGISTICA, SEMILLA, ajuste_prior, crear_logistica, entrenar
    from .metricas import auc, clasificacion
    from .operacion import RUTA_BD
    from .preprocesamiento import Escalador, dividir_estratificado

    bd = sqlite3.connect(RUTA_BD)
    bd.row_factory = sqlite3.Row
    filas = [dict(f) for f in bd.execute("SELECT * FROM estudiantes ORDER BY id_estudiante")]
    bd.close()

    def valido(f):
        registro = {c: (bool(f[c]) if c in ("trabaja", "deuda_matricula") else f[c]) for c in CAMPOS}
        return paso1_validar(registro) is None

    historico = [f for f in filas if f["conjunto"] == "historico"]
    prueba = [f for f in filas if f["conjunto"] == "operacion" and valido(f)]
    notas = [f["nota_acceso"] for f in historico if f["nota_acceso"] is not None]
    media_nota = float(np.mean(notas))
    X, y = np.array([_vector(_datos(f, media_nota)) for f in historico]), np.array([f["deserto"] for f in historico])
    itr, iva, _ = dividir_estratificado(y, fracciones=(0.85, 0.15, 0.0), semilla=SEMILLA)
    esc = Escalador().ajustar(X[itr])
    Xs = esc.transformar(X)
    modelo, historial, info = entrenar(crear_logistica(len(VARIABLES)), Xs[itr], y[itr], Xs[iva], y[iva], CONFIG_LOGISTICA)
    ajuste = ajuste_prior(info["pesos_clase"])

    def puntajes(M):
        return np.clip(np.rint(100 * _sigmoide(modelo.logit(esc.transformar(M)) - ajuste)), 0, 100).astype(int)

    cortes = tp.elegir_cortes(puntajes(X[iva]), y[iva], prioridad="fraccion")
    Xp, yp = np.array([_vector(_datos(f, media_nota)) for f in prueba]), np.array([f["deserto"] for f in prueba])
    pp = puntajes(Xp)
    alto = clasificacion(yp, pp >= cortes["corte_alto"])
    metricas = {"n_prueba": len(prueba), "auc": auc(yp, pp), "recall": alto["recall"], "precision": alto["precision"],
                "f1": alto["f1"], "accuracy": alto["accuracy"]}
    datos = {"tipo": "ingreso", "variables": VARIABLES, "media_nota_acceso": media_nota,
             "escalador": esc.a_dict(), "pesos": modelo.w.tolist(),
             "sesgo": float(modelo.b), "ajuste_prior": ajuste,
             "cortes": {"corte_medio": cortes["corte_medio"], "corte_alto": cortes["corte_alto"]},
             "n_entrenamiento": int(len(itr)), "n_validacion": int(len(iva)), "epocas": info["epocas_corridas"],
             "metricas_prueba": metricas, "semilla": SEMILLA,
             "aviso": "Resultado provisional: solo usa datos de la matrícula. Es más débil que el modelo principal."}
    RUTA_MODELO.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Modelo de ingreso: {len(itr)} para entrenar, {len(iva)} para validar, {len(prueba)} de prueba | "
          f"AUC {metricas['auc']:.3f} · F1 {metricas['f1']:.3f} · recall {metricas['recall']:.1%} · "
          f"precisión {metricas['precision']:.1%} | cortes {datos['cortes']}")
    return datos


# ------------------------------------------------------------------ inferencia
def cargar():
    if "m" not in _CACHE:
        _CACHE["m"] = json.loads(RUTA_MODELO.read_text(encoding="utf-8")) if RUTA_MODELO.exists() else None
    return _CACHE["m"]


def _texto(variable, d):
    coma = lambda x, n=1: f"{x:.{n}f}".replace(".", ",")
    if variable == "nota_acceso":
        return f"Nota de acceso de {coma(d['nota_acceso'], 2)} sobre 14"
    if variable == "sin_nota_acceso":
        return "Sin nota de acceso registrada (entró por otra vía)"
    if variable == "preferencia":
        return f"Eligió esta titulación como opción {int(d['preferencia'])}"
    if variable == "tiempo_parcial":
        return "Matriculado a tiempo parcial"
    return f"Matrícula de {coma(d['ects'])} créditos ECTS en el primer cuatrimestre"


def calificar(extra):
    """extra: los datos de matrícula de la base. Devuelve el resultado provisional, o None si no hay modelo."""
    m = cargar()
    if m is None:
        return None
    datos = _datos(extra, m["media_nota_acceso"])
    xs = (_vector(datos) - np.asarray(m["escalador"]["media"])) / np.asarray(m["escalador"]["desviacion"])
    aportes = xs * np.asarray(m["pesos"])
    prob = float(_sigmoide(aportes.sum() + m["sesgo"] - m["ajuste_prior"]))
    puntaje = int(np.clip(np.rint(100 * prob), 0, 100))
    c = m["cortes"]
    nivel = "alto" if puntaje >= c["corte_alto"] else "medio" if puntaje >= c["corte_medio"] else "bajo"
    orden = sorted(zip(m["variables"], aportes), key=lambda t: -t[1])
    # Las de sí o no solo explican el riesgo cuando valen 1 (con 0 su aporte positivo es solo «no tenerla»).
    porque = [{"variable": v, "peso": round(float(a), 2), "texto": _texto(v, datos)} for v, a in orden
              if a >= 0.05 and not (v == "nota_acceso" and datos["sin_nota_acceso"])
              and not (v in ("sin_nota_acceso", "tiempo_parcial") and not datos[v])]
    return {"nivel": nivel, "puntaje": puntaje, "probabilidad": round(prob, 4), "cortes": dict(c), "porque": porque}


if __name__ == "__main__":
    entrenar_y_guardar()
