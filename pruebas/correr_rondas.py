"""Rondas 1 y 2: corre los 20 casos contra v1 y v2, compara con el oráculo y explica cada caso.

Uso:
    python pruebas/correr_rondas.py           # muestra todo seguido
    python pruebas/correr_rondas.py --pausa   # se detiene entre casos (ideal para presentar)

Los casos y el oráculo se importan sin cambios desde contexto/dataset.py.
Los resultados se guardan en pruebas/resultados/resultados_rondas.json.
"""
import json
import sys

import rutas  # noqa: F401  (ajusta sys.path)
from rutas import RESULTADOS
from dataset import REALES, SIMULADOS, ORACULO
from explicaciones import imprimir_caso, imprimir_resumen, ANCHO

PAUSA = "--pausa" in sys.argv


def comparar(esp, obt):
    if esp["decision"] != obt.get("decision"):
        return False
    if esp["decision"] == "resultado":
        return all(esp[k] == obt.get(k) for k in ("nivel", "puntaje", "accion", "datos_no_informados"))
    return esp["motivo"] == obt.get("motivo")


def corto(r):
    if r.get("decision") == "resultado":
        s = f"resultado: {r['nivel']} ({r['puntaje']})"
        if r.get("datos_no_informados"):
            s += f" [no inf: {', '.join(r['datos_no_informados'])}]"
        return s
    if r.get("decision") == "excepcion":
        return f"EXCEPCIÓN {r['detalle']}"
    return f"{r['decision']}({r['motivo']})"


def ejecutar(funcion, entrada):
    """`funcion(entrada)` devuelve (salida, traza). Si lanza, se registra como excepción."""
    try:
        return funcion(entrada)
    except Exception as ex:
        return {"decision": "excepcion", "detalle": type(ex).__name__}, {"S1": "-", "S2": "excepción", "S3": "-"}


def tipos_de_falla(filas):
    caidas = sum(1 for f in filas if f["resultado"] == "FALLA" and f["obt"].get("decision") == "excepcion")
    silenc = sum(1 for f in filas if f["resultado"] == "FALLA" and f["obt"].get("decision") == "resultado")
    otras = sum(1 for f in filas if f["resultado"] == "FALLA") - caidas - silenc
    return caidas, silenc, otras


def pausar():
    if PAUSA:
        input("  (Enter para continuar)")


def correr(funcion, nombre, grupos, oraculo, mostrar=lambda f: True, imprimir=True):
    """Corre todos los casos de `grupos` con `funcion` y los compara con `oraculo`."""
    if imprimir:
        print("\n" + "#" * ANCHO)
        print(f"# {nombre}")
        print("#" * ANCHO)
    filas, ok = [], 0
    for origen, lista in grupos:
        for c in lista:
            obt, traza = ejecutar(funcion, c["entrada"])
            esp = oraculo[c["id"]][0]
            pasa = comparar(esp, obt)
            ok += pasa
            fila = {"id": c["id"], "origen": origen, "categoria": c["categoria"],
                    "esperado": corto(esp), "obtenido": corto(obt), "traza": traza,
                    "resultado": "PASA" if pasa else "FALLA", "obt": obt}
            filas.append(fila)
            if imprimir and mostrar(fila):
                imprimir_caso(c["id"], origen, fila["esperado"], fila["obtenido"], obt, pasa)
                pausar()
    total = len(filas)
    caidas, silenc, otras = tipos_de_falla(filas)
    extra = ""
    if total - ok:
        extra = f"| fallas: {caidas} caídas, {silenc} silenciosas, {otras} mal clasificadas"
    if imprimir:
        imprimir_resumen(nombre, total, ok, extra)
        pausar()
    for f in filas:
        f["salida"] = f.pop("obt")
    return filas, ok


def guardar(nombre_archivo, datos):
    RESULTADOS.mkdir(parents=True, exist_ok=True)
    with open(RESULTADOS / nombre_archivo, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2, default=str)


if __name__ == "__main__":
    import sistema_v1, sistema_v2  # versiones históricas, desde contexto/
    grupos = (("real", REALES), ("simulado", SIMULADOS))
    r1, n1 = correr(sistema_v1.evaluar, "Ronda 1 (v1)", grupos, ORACULO)
    r2, n2 = correr(sistema_v2.evaluar, "Ronda 2 (v2)", grupos, ORACULO)
    guardar("resultados_rondas.json", {"ronda1": {"pasan": n1, "filas": r1},
                                       "ronda2": {"pasan": n2, "filas": r2}})
