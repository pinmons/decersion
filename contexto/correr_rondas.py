"""Ejecuta los 20 casos contra v1 y v2, compara con el oráculo y explica cada resultado.

Uso:
    python correr_rondas.py           # muestra todo seguido
    python correr_rondas.py --pausa   # se detiene entre casos (ideal para presentar)
"""
import json
import sys
from dataset import REALES, SIMULADOS, ORACULO
from explicaciones import imprimir_caso, imprimir_resumen, ANCHO
import sistema_v1, sistema_v2

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


def ejecutar(modulo, entrada):
    try:
        return modulo.evaluar(entrada)
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


def correr(modulo, nombre, grupos, oraculo, mostrar=lambda f: True):
    print("\n" + "#" * ANCHO)
    print(f"# {nombre}")
    print("#" * ANCHO)
    filas, ok = [], 0
    for origen, lista in grupos:
        for c in lista:
            obt, traza = ejecutar(modulo, c["entrada"])
            esp = oraculo[c["id"]][0]
            pasa = comparar(esp, obt)
            ok += pasa
            fila = {"id": c["id"], "origen": origen, "categoria": c["categoria"],
                    "esperado": corto(esp), "obtenido": corto(obt), "traza": traza,
                    "resultado": "PASA" if pasa else "FALLA", "obt": obt}
            filas.append(fila)
            if mostrar(fila):
                imprimir_caso(c["id"], origen, fila["esperado"], fila["obtenido"], obt, pasa)
                pausar()
    total = len(filas)
    caidas, silenc, otras = tipos_de_falla(filas)
    extra = ""
    if total - ok:
        extra = f"| fallas: {caidas} caídas, {silenc} silenciosas, {otras} mal clasificadas"
    imprimir_resumen(nombre, total, ok, extra)
    pausar()
    for f in filas:
        f.pop("obt")
    return filas, ok


if __name__ == "__main__":
    grupos = (("real", REALES), ("simulado", SIMULADOS))
    r1, n1 = correr(sistema_v1, "Ronda 1 (v1)", grupos, ORACULO)
    r2, n2 = correr(sistema_v2, "Ronda 2 (v2)", grupos, ORACULO)
    with open("resultados_rondas.json", "w", encoding="utf-8") as f:
        json.dump({"ronda1": {"pasan": n1, "filas": r1}, "ronda2": {"pasan": n2, "filas": r2}},
                  f, ensure_ascii=False, indent=2, default=str)
