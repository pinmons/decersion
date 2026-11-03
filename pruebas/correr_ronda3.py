"""Ronda 3: corre v2, v3 y el sistema migrado (modo reglas) sobre los 35 casos.

Uso:
    python pruebas/correr_ronda3.py            # casos nuevos (T) y cualquier caso viejo que falle
    python pruebas/correr_ronda3.py --todos    # los 35 casos
    python pruebas/correr_ronda3.py --pausa    # se detiene entre casos (se combina con --todos)

Criterio de aceptación de la Fase 1: la ronda 3c (sistema, modo reglas) da 35/35 y su salida
es idéntica, caso por caso, a la de sistema_v3. Si no, el programa termina con código 1.
"""
import sys

import rutas  # noqa: F401
from dataset import REALES, SIMULADOS, ORACULO
from dataset_r3 import NUEVOS, ORACULO_R3
from correr_rondas import correr, guardar

ORA = {**ORACULO, **ORACULO_R3}
GRUPOS = (("real", REALES), ("simulado", SIMULADOS), ("nuevo", NUEVOS))
TOTAL = sum(len(lista) for _, lista in GRUPOS)


def por_origen(filas):
    return {o: sum(1 for f in filas if f["origen"] == o and f["resultado"] == "PASA") for o, _ in GRUPOS}


def evaluar_reglas(entrada):
    from desercion.sistema import evaluar_con_traza
    return evaluar_con_traza(entrada, modo="reglas")


def diferencias_con_v3():
    """Compara la salida completa (todas las claves y la traza) de v3 y del sistema migrado."""
    import sistema_v3
    distintos = []
    for _, lista in GRUPOS:
        for c in lista:
            if sistema_v3.evaluar(c["entrada"]) != evaluar_reglas(c["entrada"]):
                distintos.append(c["id"])
    return distintos


def correr_reglas(imprimir=False, mostrar=lambda f: True):
    """Ronda 3c sin imprimir: la usan la app y la API."""
    return correr(evaluar_reglas, "Ronda 3c (sistema, modo reglas)", GRUPOS, ORA, mostrar, imprimir)


if __name__ == "__main__":
    import sistema_v2, sistema_v3
    todos = "--todos" in sys.argv

    def mostrar(fila):
        return todos or fila["origen"] == "nuevo" or fila["resultado"] == "FALLA"

    if not todos:
        print("Nota: se muestran los 15 casos nuevos y cualquier caso anterior que falle. "
              "Si un caso anterior no aparece, es porque sigue pasando (no hay regresión). "
              "Usa --todos para ver los 35.")
    a, na = correr(sistema_v2.evaluar, "Ronda 3a (v2)", GRUPOS, ORA, mostrar)
    print(f"Por grupo: {por_origen(a)}")
    b, nb = correr(sistema_v3.evaluar, "Ronda 3b (v3)", GRUPOS, ORA, mostrar)
    print(f"Por grupo: {por_origen(b)}")
    c, nc = correr_reglas(imprimir=True, mostrar=mostrar)
    print(f"Por grupo: {por_origen(c)}")
    distintos = diferencias_con_v3()
    print(f"Equivalencia con sistema_v3 (salida y traza completas): "
          f"{TOTAL - len(distintos)}/{TOTAL} idénticos" + (f" | distintos: {distintos}" if distintos else ""))
    guardar("resultados_ronda3.json", {
        "ronda3a_v2": {"pasan": na, "por_origen": por_origen(a), "filas": a},
        "ronda3b_v3": {"pasan": nb, "por_origen": por_origen(b), "filas": b},
        "ronda3c_sistema_reglas": {"pasan": nc, "por_origen": por_origen(c), "filas": c,
                                   "distintos_de_v3": distintos}})
    if nc != TOTAL or distintos:
        print("REGRESIÓN: el modo reglas ya no cumple el contrato.")
        sys.exit(1)
