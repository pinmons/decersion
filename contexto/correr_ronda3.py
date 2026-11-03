"""Ronda 3: corre v2 y v3 sobre los 35 casos (20 anteriores + 15 nuevos) y explica cada resultado.

Uso:
    python correr_ronda3.py            # muestra los casos nuevos (T) y cualquier caso viejo que falle
    python correr_ronda3.py --todos    # muestra los 35 casos
    python correr_ronda3.py --pausa    # se detiene entre casos (se puede combinar con --todos)
"""
import json
import sys
from dataset import REALES, SIMULADOS, ORACULO
from dataset_r3 import NUEVOS, ORACULO_R3
from correr_rondas import correr
import sistema_v2, sistema_v3

TODOS = "--todos" in sys.argv
ORA = {**ORACULO, **ORACULO_R3}
GRUPOS = (("real", REALES), ("simulado", SIMULADOS), ("nuevo", NUEVOS))


def mostrar(fila):
    return TODOS or fila["origen"] == "nuevo" or fila["resultado"] == "FALLA"


def por_origen(filas):
    return {o: sum(1 for f in filas if f["origen"] == o and f["resultado"] == "PASA") for o, _ in GRUPOS}


if __name__ == "__main__":
    if not TODOS:
        print("Nota: se muestran los 15 casos nuevos y cualquier caso anterior que falle. "
              "Si un caso anterior no aparece, es porque sigue pasando (no hay regresión). "
              "Usa --todos para ver los 35.")
    a, na = correr(sistema_v2, "Ronda 3a (v2)", GRUPOS, ORA, mostrar)
    print(f"Por grupo: {por_origen(a)}")
    b, nb = correr(sistema_v3, "Ronda 3b (v3)", GRUPOS, ORA, mostrar)
    print(f"Por grupo: {por_origen(b)}")
    json.dump({"ronda3a_v2": {"pasan": na, "por_origen": por_origen(a), "filas": a},
               "ronda3b_v3": {"pasan": nb, "por_origen": por_origen(b), "filas": b}},
              open("resultados_ronda3.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2, default=str)
