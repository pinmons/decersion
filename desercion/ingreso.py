"""Aviso antes de las notas: un resultado PROVISIONAL con lo que se sabe sin esperar las notas.

    python -m desercion.ingreso      # entrena y guarda modelos_entrenados/real/ingreso.json

Por qué existe. El contrato manda abstenerse cuando falta un dato obligatorio o el registro se
contradice: no se inventan notas. En la base de la UPV eso le pasa, sobre todo, a quien no tiene
ninguna nota del primer cuatrimestre. Mandar esos casos a revisión manual no es operar: la
abstención del contrato se respeta (no hay resultado definitivo), y mientras el registro completa
el dato este modelo da una alerta provisional con lo que SÍ se sabe sin las notas:
- matrícula y admisión: nota de acceso, en qué opción eligió la titulación, vía de ingreso,
  dedicación (tiempo parcial) y créditos;
- actividad: días en el campus (wifi) de septiembre a noviembre y de diciembre a enero, días en el
  aula virtual y entregas por asignatura;
- titulación: la tasa de abandono de su titulación entre los estudiantes de entrenamiento.
Es el aviso que se puede dar sin esperar las notas, y sirve igual para cualquier estudiante en
diciembre, antes de los exámenes.

Los datos que faltan no se inventan en silencio: se usan la mediana de entrenamiento y la indicadora
«sin dato» del contrato ampliado (`contrato_ampliado.valor`), y la ficha dice «sin dato».

Es la misma regresión logística desde cero (modelos/logistica.py), con el sentido de cada variable
ampliada restringido como en el modelo principal, entrenada con los estudiantes históricos y medida
con los de operación que sí tienen resultado del contrato (nunca los vio). Es más débil que el modelo
con notas, y la web lo dice. Solo NumPy en la inferencia.
"""
import json

import numpy as np

from . import RAIZ
from . import contrato_ampliado as ca

RUTA_MODELO = RAIZ / "modelos_entrenados" / "real" / "ingreso.json"
VARIABLES = ["nota_acceso", "sin_nota_acceso", "opcion_titulacion", "sin_opcion_titulacion", "ingreso_ordinario",
             "trabaja", "creditos_inscritos",
             "dias_campus_sep_nov", "dias_campus_dic_ene", "sin_registro_wifi", "dias_aula_virtual",
             "entregas_por_asignatura", "sin_aula_virtual",
             "abandono_titulacion"]
_CACHE = {}


def _valor(r, variable, aux):
    if variable == "trabaja":
        return float(bool(r.get("trabaja")))
    if variable == "creditos_inscritos":
        v = r.get("creditos_inscritos")
        return float(aux["medianas"]["creditos_inscritos"] if v is None else v)
    return ca.valor(r, variable, aux)


def _vector(r, aux):
    return np.array([_valor(r, v, aux) for v in VARIABLES], dtype=float)


def _sigmoide(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -40, 40)))


# ------------------------------------------------------------------ entrenamiento
def entrenar_y_guardar():
    from . import tarjeta_puntaje as tp
    from .contrato import paso1_validar
    from .entrenamiento import CONFIG_LOGISTICA, SEMILLA, ajuste_prior, crear_logistica, entrenar
    from .metricas import auc, clasificacion
    from .operacion import leer_cohorte
    from .preprocesamiento import Escalador, dividir_estratificado

    historico = leer_cohorte("historico")
    prueba = [(r, e) for r, e in leer_cohorte("operacion") if paso1_validar(r) is None and ca.validar(r) is None]
    y = np.array([e["deserto"] for _, e in historico])
    itr, iva, _ = dividir_estratificado(y, fracciones=(0.85, 0.15, 0.0), semilla=SEMILLA)
    aux, oof = ca.ajustar([historico[i][0] for i in itr], y[itr], semilla=SEMILLA)
    creditos = [r["creditos_inscritos"] for r, _ in historico if r.get("creditos_inscritos") is not None]
    aux["medianas"]["creditos_inscritos"] = float(np.median(creditos))
    X = np.array([_vector(r, aux) for r, _ in historico])
    X[itr, VARIABLES.index("abandono_titulacion")] = oof          # en train, la tasa sin el propio estudiante
    constantes = [v for j, v in enumerate(VARIABLES) if X[itr, j].std() == 0]
    esc = Escalador().ajustar(X[itr])
    Xs = esc.transformar(X)
    signos = [ca.VARIABLES[v][2] if v in ca.VARIABLES else 0 for v in VARIABLES]
    modelo, historial, info = entrenar(crear_logistica(len(VARIABLES), signos=signos), Xs[itr], y[itr], Xs[iva], y[iva],
                                       CONFIG_LOGISTICA)
    ajuste = ajuste_prior(info["pesos_clase"])

    def puntajes(M):
        return np.clip(np.rint(100 * _sigmoide(modelo.logit(esc.transformar(M)) - ajuste)), 0, 100).astype(int)

    cortes = tp.elegir_cortes(puntajes(X[iva]), y[iva], prioridad="fraccion")
    Xp, yp = np.array([_vector(r, aux) for r, _ in prueba]), np.array([e["deserto"] for _, e in prueba])
    pp = puntajes(Xp)
    alto = clasificacion(yp, pp >= cortes["corte_alto"])
    metricas = {"n_prueba": len(prueba), "auc": auc(yp, modelo.logit(esc.transformar(Xp))), "recall": alto["recall"],
                "precision": alto["precision"], "f1": alto["f1"], "accuracy": alto["accuracy"],
                "fraccion_alto": float((pp >= cortes["corte_alto"]).mean()), "tasa": float(yp.mean())}
    datos = {"tipo": "ingreso", "variables": VARIABLES, "ampliado": aux, "escalador": esc.a_dict(),
             "pesos": modelo.w.tolist(), "sesgo": float(modelo.b), "ajuste_prior": ajuste,
             "cortes": {"corte_medio": cortes["corte_medio"], "corte_alto": cortes["corte_alto"]},
             "n_entrenamiento": int(len(itr)), "n_validacion": int(len(iva)), "epocas": info["epocas_corridas"],
             "variables_constantes": constantes, "metricas_prueba": metricas, "semilla": SEMILLA,
             "aviso": "Aviso antes de las notas: usa matrícula, admisión, actividad y titulación, no las notas. "
                      "Es más débil que el modelo con notas."}
    RUTA_MODELO.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Aviso antes de las notas (modelo de ingreso): {len(itr)} para entrenar, {len(iva)} para validar, "
          f"{len(prueba)} de prueba | AUC {metricas['auc']:.3f} · F1 {metricas['f1']:.3f} · recall {metricas['recall']:.1%} · "
          f"precisión {metricas['precision']:.1%} · en alto {metricas['fraccion_alto']:.1%} | cortes {datos['cortes']}"
          + (f" | constantes: {constantes}" if constantes else ""))
    return datos


# ------------------------------------------------------------------ inferencia
def cargar():
    if "m" not in _CACHE:
        _CACHE["m"] = json.loads(RUTA_MODELO.read_text(encoding="utf-8")) if RUTA_MODELO.exists() else None
    return _CACHE["m"]


def calificar(registro):
    """registro: lo que la base tiene del estudiante (contrato + ampliado). Resultado provisional, o None sin modelo."""
    from .textos import MEJORAS, por_que
    m = cargar()
    if m is None or "ampliado" not in m:
        return None
    aux = m["ampliado"]
    xs = (_vector(registro, aux) - np.asarray(m["escalador"]["media"])) / np.asarray(m["escalador"]["desviacion"])
    aportes = xs * np.asarray(m["pesos"])
    prob = float(_sigmoide(aportes.sum() + m["sesgo"] - m["ajuste_prior"]))
    puntaje = int(np.clip(np.rint(100 * prob), 0, 100))
    c = m["cortes"]
    nivel = "alto" if puntaje >= c["corte_alto"] else "medio" if puntaje >= c["corte_medio"] else "bajo"
    porque, mejorar = [], []
    for v, a in sorted(zip(m["variables"], aportes), key=lambda t: -t[1]):
        if a < 0.05:
            continue
        texto = por_que(v, registro, aux)
        if texto is None:
            continue
        porque.append({"variable": v, "peso": round(float(a), 2), "texto": texto})
        if v in MEJORAS and nivel != "bajo":
            mejorar.append({"variable": v})
    return {"nivel": nivel, "puntaje": puntaje, "probabilidad": round(prob, 4), "cortes": dict(c),
            "porque": porque, "mejorar": mejorar, "faltan": ca.faltantes(registro, m["variables"])}


if __name__ == "__main__":
    entrenar_y_guardar()
