"""Punto de entrada único del sistema.

    evaluar(entrada, modo="reglas")       -> línea base por reglas (= sistema_v3)
    evaluar(entrada, modo="aprendido")    -> tarjeta de puntaje aprendida (regresión logística)
    evaluar(entrada, modo="aprendido", modelo="red_neuronal") -> MLP

En los dos modos se aplican igual el Paso 1 (validación), la regla R3.4 y las garantías.
La función nunca lanza excepción: todo termina en `resultado`, `abstener` o `error`.
"""
from .contrato import paso1_validar
from . import reglas

MODOS = ("reglas", "aprendido")
MODELOS = ("logistica", "red_neuronal")


def evaluar_con_traza(entrada, modo="reglas", modelo="logistica"):
    """Igual que `evaluar`, pero devuelve (salida, traza S1→S2→S3) como el arnés original."""
    try:
        if modo not in MODOS:
            return ({"decision": "error", "motivo": "modo_no_valido", "detalle": str(modo)},
                    {"S1": "-", "S2": "-", "S3": "-"})
        s1 = paso1_validar(entrada)
        if s1 is not None:
            return s1, {"S1": f"{s1['decision']}({s1['motivo']})", "S2": "-", "S3": "-"}
        if modo == "reglas":
            return reglas.calificar(entrada)
        from . import inferencia  # import diferido: el modo reglas no necesita NumPy
        return inferencia.calificar(entrada, modelo)
    except Exception as ex:  # red de seguridad: nunca propagar excepción
        return ({"decision": "error", "motivo": "error_interno", "detalle": type(ex).__name__},
                {"S1": "error_interno", "S2": "-", "S3": "-"})


def evaluar(entrada, modo="reglas", modelo="logistica"):
    """Evalúa un registro de estudiante. Devuelve solo la salida (diccionario)."""
    return evaluar_con_traza(entrada, modo, modelo)[0]
