"""Modelo de ingreso: un resultado PROVISIONAL para quien no tiene historial académico en la base.

    python -m desercion.ingreso      # entrena y guarda modelos_entrenados/real/ingreso.json

Por qué existe. El contrato manda abstenerse cuando un estudiante de semestre 2 o más aparece sin
materias cursadas (regla C4): no se inventan notas. En la base real eso le pasa a 180 estudiantes,
todos de un mismo programa cuyo historial no está cargado. Mandar 180 casos a revisión manual no
es operar: la abstención del contrato se respeta (no hay resultado definitivo), y mientras llega
el historial este modelo da una alerta provisional con lo que SÍ se sabe desde la matrícula:
edad, notas de admisión, beca, deuda, jornada y escolaridad del hogar. Sirve igual para un
estudiante recién llegado.

Es la misma regresión logística desde cero (modelos/logistica.py), entrenada con los estudiantes
históricos y medida con los de operación que sí tienen resultado del contrato (nunca los vio).
Es más débil que el modelo principal, y la web lo dice. Solo NumPy en la inferencia.
"""
import json

import numpy as np

from . import RAIZ

RUTA_MODELO = RAIZ / "modelos_entrenados" / "real" / "ingreso.json"
VARIABLES = ["edad_ingreso", "nota_admision", "nota_previa", "becado", "deuda_matricula", "trabaja", "estrato"]
_CACHE = {}


def _vector(datos):
    return np.array([float(datos[v] or 0) for v in VARIABLES], dtype=float)


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
    X, y = np.array([_vector(f) for f in historico]), np.array([f["deserto"] for f in historico])
    itr, iva, _ = dividir_estratificado(y, fracciones=(0.85, 0.15, 0.0), semilla=SEMILLA)
    esc = Escalador().ajustar(X[itr])
    Xs = esc.transformar(X)
    modelo, historial, info = entrenar(crear_logistica(len(VARIABLES)), Xs[itr], y[itr], Xs[iva], y[iva], CONFIG_LOGISTICA)
    ajuste = ajuste_prior(info["pesos_clase"])

    def puntajes(M):
        return np.clip(np.rint(100 * _sigmoide(modelo.logit(esc.transformar(M)) - ajuste)), 0, 100).astype(int)

    cortes = tp.elegir_cortes(puntajes(X[iva]), y[iva])
    Xp, yp = np.array([_vector(f) for f in prueba]), np.array([f["deserto"] for f in prueba])
    pp = puntajes(Xp)
    alto = clasificacion(yp, pp >= cortes["corte_alto"])
    metricas = {"n_prueba": len(prueba), "auc": auc(yp, pp), "recall": alto["recall"], "precision": alto["precision"],
                "f1": alto["f1"], "accuracy": alto["accuracy"]}
    datos = {"tipo": "ingreso", "variables": VARIABLES, "escalador": esc.a_dict(), "pesos": modelo.w.tolist(),
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
    if variable == "deuda_matricula":
        return "Tiene deuda o mora de matrícula"
    if variable == "becado":
        return "No tiene beca"
    if variable == "edad_ingreso":
        return f"Entró a los {int(d['edad_ingreso'])} años"
    if variable == "nota_admision":
        return f"Nota de admisión de {d['nota_admision']:.0f} sobre 200"
    if variable == "nota_previa":
        return f"Nota del estudio anterior de {d['nota_previa']:.0f} sobre 200"
    if variable == "trabaja":
        return "Estudia de noche (se asume que trabaja)"
    return f"Hogar con escolaridad en la banda {int(d['estrato'])} de 6"


def calificar(datos):
    """datos: diccionario con VARIABLES. Devuelve el resultado provisional, o None si no hay modelo."""
    m = cargar()
    if m is None or any(datos.get(v) is None for v in VARIABLES):
        return None
    xs = (_vector(datos) - np.asarray(m["escalador"]["media"])) / np.asarray(m["escalador"]["desviacion"])
    aportes = xs * np.asarray(m["pesos"])
    prob = float(_sigmoide(aportes.sum() + m["sesgo"] - m["ajuste_prior"]))
    puntaje = int(np.clip(np.rint(100 * prob), 0, 100))
    c = m["cortes"]
    nivel = "alto" if puntaje >= c["corte_alto"] else "medio" if puntaje >= c["corte_medio"] else "bajo"
    orden = sorted(zip(m["variables"], aportes), key=lambda t: -t[1])
    porque = [{"variable": v, "peso": round(float(a), 2), "texto": _texto(v, datos)} for v, a in orden if a >= 0.05]
    return {"nivel": nivel, "puntaje": puntaje, "probabilidad": round(prob, 4), "cortes": dict(c), "porque": porque}


if __name__ == "__main__":
    entrenar_y_guardar()
