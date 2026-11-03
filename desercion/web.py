"""Lógica de la API web, compartida por las funciones de Vercel (api/) y el servidor local.

    POST /api/evaluar   {"entrada": {...12 campos...}, "modo": "reglas"|"aprendido",
                         "modelo": "logistica"|"red_neuronal"}
                        → la salida de sistema.evaluar() + `puntos_por_variable` + `en_riesgo`
    GET  /api/rondas    → corre la ronda 3c (modo reglas) y la ronda 4 y devuelve PASA/FALLA

La página nunca recalcula el modelo en JavaScript: siempre pregunta aquí, así no puede
contradecir al paquete (Paso 1, R3.4 y garantías incluidas).
"""
from .sistema import evaluar, MODOS, MODELOS

# Puntos de cada regla del Paso 2 (contrato, R2.1–R2.6), agrupados por variable para dibujar
# las barras de influencia en modo reglas. La salida de reglas.py no se modifica (debe seguir
# idéntica a sistema_v3).
PUNTOS_REGLAS = {
    "promedio<3.0": ("promedio_acumulado", 30), "3.0<=promedio<3.5": ("promedio_acumulado", 15),
    "reprobadas>=2": ("materias_reprobadas", 25), "reprobadas=1": ("materias_reprobadas", 10),
    "asistencia<70": ("porcentaje_asistencia", 20), "70<=asistencia<85": ("porcentaje_asistencia", 10),
    "estrato<=2": ("estrato", 10), "trabaja": ("trabaja", 5), "deuda_matricula": ("deuda_matricula", 10),
}
VARIABLES_REGLAS = ["promedio_acumulado", "materias_reprobadas", "porcentaje_asistencia", "estrato", "trabaja",
                    "deuda_matricula"]
LIMITE_CUERPO = 20_000  # bytes


def responder_evaluar(cuerpo):
    """Devuelve (código HTTP, diccionario). Nunca lanza excepción."""
    try:
        if not isinstance(cuerpo, dict):
            return 400, {"decision": "error", "motivo": "cuerpo_invalido", "detalle": "Se esperaba un objeto JSON."}
        modo = cuerpo.get("modo", "reglas")
        modelo = cuerpo.get("modelo", "logistica")
        if modo not in MODOS or modelo not in MODELOS:
            return 400, {"decision": "error", "motivo": "modo_no_valido", "detalle": f"{modo}/{modelo}"}
        salida = evaluar(cuerpo.get("entrada"), modo=modo, modelo=modelo)
        salida = dict(salida)
        if salida.get("decision") == "resultado":
            if modo == "reglas":
                puntos = {v: 0 for v in VARIABLES_REGLAS}
                for f in salida["factores"]:
                    v, p = PUNTOS_REGLAS[f]
                    puntos[v] += p
                salida["puntos_por_variable"] = puntos
                salida["modo"] = "reglas"
                salida["cortes"] = {"corte_medio": 30, "corte_alto": 60}
            # [SUPUESTO] "se considera en riesgo de desertar" = nivel alto (el nivel se muestra siempre)
            salida["en_riesgo"] = salida["nivel"] == "alto"
        return 200, salida
    except Exception as ex:  # garantía: nunca propagar excepción
        return 500, {"decision": "error", "motivo": "error_interno", "detalle": type(ex).__name__}


def responder_rondas():
    """Corre las pruebas en el servidor. Devuelve (código HTTP, diccionario)."""
    try:
        import sys
        from . import RAIZ
        ruta = str(RAIZ / "pruebas")
        if ruta not in sys.path:
            sys.path.insert(0, ruta)
        import rutas  # noqa: F401  (agrega contexto/ al final de sys.path)
        from correr_ronda3 import correr_reglas, por_origen, TOTAL
        from correr_ronda4 import correr_todo
        filas3, n3 = correr_reglas(imprimir=False)
        for f in filas3:
            f.pop("salida", None)
        versiones = correr_todo(imprimir_salida=False)
        return 200, {"ronda3": {"nombre": "Rondas 1–3 (35 casos) – modo reglas", "pasan": n3, "total": TOTAL,
                                "por_origen": por_origen(filas3), "filas": filas3},
                     "ronda4": versiones}
    except Exception as ex:
        return 500, {"error": "No se pudieron correr las pruebas", "detalle": f"{type(ex).__name__}: {ex}"}
