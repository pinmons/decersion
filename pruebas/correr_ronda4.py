"""Ronda 4: pruebas de estrés del modo aprendido.

Uso:
    python pruebas/correr_ronda4.py            # muestra U01–U15, las propiedades y cualquier falla
    python pruebas/correr_ronda4.py --todos    # muestra también los 23 casos del contrato
    python pruebas/correr_ronda4.py --pausa    # se detiene entre casos

Tres grupos, para cada versión del sistema:
  1. contrato     – los 23 casos cuya respuesta esperada es error o abstener: deben coincidir
                    EXACTAMENTE con el oráculo de las rondas 1–3 (el modelo nunca los ve).
  2. propiedades  – P01–P07 sobre los 12 casos con resultado (orden, monotonía, R3.4, deuda).
  3. nuevos       – U01–U15 (casos_r4.py) contra su oráculo borrador (oraculo_r4.py).

Versiones: modo reglas (referencia), aprendido con logística (modelo principal) y aprendido
con red neuronal. Al final verifica que el modo reglas sigue en 35/35 (sin regresión).
"""
import sys

import numpy as np

import rutas  # noqa: F401
from rutas import RESULTADOS
from dataset import REALES, SIMULADOS, ORACULO
from dataset_r3 import NUEVOS, ORACULO_R3
from correr_rondas import comparar, corto, guardar, ejecutar
from explicaciones import ANCHO, QUE_PRUEBA, POR_QUE_ESPERADO, lectura, _bloque
from casos_r4 import NUEVOS_R4
from oraculo_r4 import CASOS_CON_RESULTADO, PROPIEDADES_CONTRATO, ORACULO_R4, UMBRAL_CONTINUIDAD
from desercion.sistema import evaluar_con_traza

TODOS = "--todos" in sys.argv
PAUSA = "--pausa" in sys.argv
ORA = {**ORACULO, **ORACULO_R3}
CASOS = {c["id"]: c for c in REALES + SIMULADOS + NUEVOS}
CASOS_CONTRATO = [i for i in CASOS if ORA[i][0]["decision"] != "resultado"]
ORDEN_NIVEL = {"bajo": 0, "medio": 1, "alto": 2}

VERSIONES = [
    ("Ronda 4 – modo reglas (referencia)", {"modo": "reglas"}),
    ("Ronda 4 – modo aprendido, logística", {"modo": "aprendido", "modelo": "logistica"}),
    ("Ronda 4 – modo aprendido, red neuronal", {"modo": "aprendido", "modelo": "red_neuronal"}),
]


def pausar():
    if PAUSA:
        input("  (Enter para continuar)")


def riesgo_no_menor(a, b):
    """riesgo(a) ≥ riesgo(b): puntaje y nivel no bajan."""
    return (a.get("decision") == b.get("decision") == "resultado" and a["puntaje"] >= b["puntaje"]
            and ORDEN_NIVEL[a["nivel"]] >= ORDEN_NIVEL[b["nivel"]])


def resumen(s):
    if s.get("decision") == "resultado":
        return f"{s['nivel']} ({s['puntaje']})"
    return corto(s)


# ---------------------------------------------------------------- barridos de monotonía
def barrido(f, entrada, campo):
    e = dict(entrada)
    if campo == "promedio_acumulado":
        valores = [round(v, 2) for v in np.arange(e[campo], -0.001, -0.1)] + [0.0]
    elif campo == "materias_reprobadas":
        valores = list(range(e[campo], e["materias_cursadas_periodo_anterior"] + 1))
    else:
        valores = [round(v, 1) for v in np.arange(e[campo], 1.999, -2.5)] + [2.0]
    anterior, v_ant = None, None
    for v in valores:
        e[campo] = v
        s = f(e)
        if anterior is not None and not riesgo_no_menor(s, anterior):
            return False, f"{campo} {v_ant} → {v}: {resumen(anterior)} → {resumen(s)}"
        anterior, v_ant = s, v
    return True, f"{len(valores)} valores, de {valores[0]} a {valores[-1]}"


def propiedades(f):
    s = {i: f(CASOS[i]["entrada"]) for i in CASOS_CON_RESULTADO}
    filas = []
    ok = s["R03"]["puntaje"] > s["R02"]["puntaje"] > s["R01"]["puntaje"]
    filas.append(("P01", ok, f"R03 {resumen(s['R03'])} > R02 {resumen(s['R02'])} > R01 {resumen(s['R01'])}"))
    for pid, campo in (("P02", "promedio_acumulado"), ("P03", "materias_reprobadas"), ("P04", "porcentaje_asistencia")):
        fallas = []
        for i in CASOS_CON_RESULTADO:
            bien, det = barrido(f, CASOS[i]["entrada"], campo)
            if not bien:
                fallas.append(f"{i}: {det}")
        filas.append((pid, not fallas, "sin violaciones en los 12 casos" if not fallas else "; ".join(fallas[:3])
                      + (f" (y {len(fallas) - 3} más)" if len(fallas) > 3 else "")))
    filas.append(("P05", s["S14"].get("nivel") == "alto", f"S14 → {resumen(s['S14'])}"))
    filas.append(("P06", "deuda_matricula" in s["R04"].get("datos_no_informados", []),
                  f"R04 datos_no_informados = {s['R04'].get('datos_no_informados')}"))
    validos = [i for i in CASOS_CON_RESULTADO if s[i].get("decision") == "resultado"
               and isinstance(s[i].get("puntaje"), int) and 0 <= s[i]["puntaje"] <= 100]
    filas.append(("P07", len(validos) == len(CASOS_CON_RESULTADO), f"{len(validos)}/{len(CASOS_CON_RESULTADO)} con resultado válido"))
    return filas


# ---------------------------------------------------------------- casos U
def comprobar_u(f, caso):
    s = f(caso["entrada"])
    pareja = f(caso["pareja"]) if "pareja" in caso else None
    detalles, ok = [], True
    for tipo, ref in ORACULO_R4[caso["id"]]["comprobaciones"]:
        if s.get("decision") != "resultado":
            return False, s, pareja, [f"se esperaba un resultado y salió {corto(s)}"]
        if tipo == "riesgo_mayor_o_igual":
            r = pareja if ref == "pareja" else f(CASOS[ref]["entrada"])
            bien = riesgo_no_menor(s, r)
            detalles.append(f"riesgo ≥ {('pareja' if ref == 'pareja' else ref)} {resumen(r)}: {'sí' if bien else 'NO'}")
        elif tipo == "nivel_no_bajo":
            bien = s["nivel"] != "bajo"
            detalles.append(f"nivel no bajo: {'sí' if bien else 'NO'}")
        elif tipo == "nivel_alto":
            bien = s["nivel"] == "alto"
            detalles.append(f"nivel alto: {'sí' if bien else 'NO'}")
        elif tipo == "puntaje_en_rango":
            bien = isinstance(s["puntaje"], int) and 0 <= s["puntaje"] <= 100
            detalles.append(f"puntaje entre 0 y 100: {'sí' if bien else 'NO'}")
        elif tipo == "continuidad":
            dif = abs(s["puntaje"] - pareja["puntaje"])
            bien = dif <= UMBRAL_CONTINUIDAD
            detalles.append(f"|Δ puntaje| con la pareja = {dif} (≤ {UMBRAL_CONTINUIDAD}): {'sí' if bien else 'NO'}")
        elif tipo == "no_informado":
            bien = ref in s.get("datos_no_informados", [])
            detalles.append(f"{ref} en datos_no_informados: {'sí' if bien else 'NO'}")
        else:
            bien = False
        ok = ok and bien
    return ok, s, pareja, detalles


def imprimir(id_, grupo, que, esperado, obtenido, significado, pasa):
    print("-" * ANCHO)
    print(f"[{'PASA ' if pasa else 'FALLA'}] {id_}  ({grupo})")
    print(_bloque("Qué prueba:  ", que))
    print(_bloque("Esperado:    ", esperado))
    print(_bloque("Obtenido:    ", obtenido))
    print(_bloque("Significado: ", ("Correcto. " if pasa else "Incorrecto. ") + significado))
    pausar()


def correr_version(nombre, opciones, imprimir_salida=True):
    def f(e):
        return ejecutar(lambda x: evaluar_con_traza(x, **opciones), e)[0]

    if imprimir_salida:
        print("\n" + "#" * ANCHO + f"\n# {nombre}\n" + "#" * ANCHO)
    filas = []
    for i in CASOS_CONTRATO:
        esp, obt = ORA[i][0], f(CASOS[i]["entrada"])
        pasa = comparar(esp, obt)
        filas.append({"id": i, "grupo": "contrato", "esperado": corto(esp), "obtenido": corto(obt), "resultado": "PASA" if pasa else "FALLA"})
        if imprimir_salida and (TODOS or not pasa):
            imprimir(i, "contrato", QUE_PRUEBA.get(i, ""), corto(esp), corto(obt) + " – " + lectura(obt),
                     POR_QUE_ESPERADO.get(i, "") + " El Paso 1 es el mismo en los dos modos.", pasa)
    props = {p["id"]: p for p in PROPIEDADES_CONTRATO}
    for pid, pasa, detalle in propiedades(f):
        filas.append({"id": pid, "grupo": "propiedades", "esperado": props[pid]["esperado"], "obtenido": detalle,
                      "resultado": "PASA" if pasa else "FALLA"})
        if imprimir_salida:
            imprimir(pid, "propiedad", props[pid]["nombre"], props[pid]["esperado"], detalle, props[pid]["regla"], pasa)
    for caso in NUEVOS_R4:
        pasa, s, pareja, detalles = comprobar_u(f, caso)
        obtenido = resumen(s) + (f" | pareja: {resumen(pareja)}" if pareja else "") + " | " + "; ".join(detalles)
        filas.append({"id": caso["id"], "grupo": "nuevos", "esperado": ORACULO_R4[caso["id"]]["regla"],
                      "obtenido": obtenido, "resultado": "PASA" if pasa else "FALLA", "ataca": caso["ataca"]})
        if imprimir_salida:
            imprimir(caso["id"], "nuevo – " + caso["categoria"], caso["por_que"], ORACULO_R4[caso["id"]]["regla"],
                     obtenido, "Cumple la propiedad." if pasa else "Viola la propiedad del oráculo; ver análisis.", pasa)
    por_grupo = {g: (sum(1 for x in filas if x["grupo"] == g and x["resultado"] == "PASA"),
                     sum(1 for x in filas if x["grupo"] == g)) for g in ("contrato", "propiedades", "nuevos")}
    pasan = sum(1 for x in filas if x["resultado"] == "PASA")
    if imprimir_salida:
        print("=" * ANCHO)
        print(f"RESULTADO {nombre}: {pasan}/{len(filas)} pasan | " +
              " · ".join(f"{g} {a}/{b}" for g, (a, b) in por_grupo.items()))
        fallan = [x["id"] for x in filas if x["resultado"] == "FALLA"]
        if fallan:
            print("Fallan: " + ", ".join(fallan))
        print("=" * ANCHO)
    return {"nombre": nombre, "opciones": opciones, "pasan": pasan, "total": len(filas), "por_grupo": por_grupo, "filas": filas}


def correr_todo(imprimir_salida=False):
    return [correr_version(n, o, imprimir_salida) for n, o in VERSIONES]


LECTURA = (
    "Historial: en la versión 1 la red neuronal fallaba P04 (en T11, bajar la asistencia de 89.5 a 87 bajaba el "
    "puntaje de 32 a 31): una MLP sin restricciones no garantiza monotonía en combinaciones raras. La versión 2 "
    "restringe los signos (W1 con signo fijo en promedio, tasa de reprobación y asistencia; W2 y W3 ≥ 0), así que es "
    "monótona por construcción y pasa 45/45. La logística (modelo principal) pasa 45/45 desde la primera versión: su "
    "tarjeta es lineal y cada peso aprendido tiene el signo esperado; no se le impuso ninguna restricción. "
    "El modo reglas se corre como referencia y falla U06, U07, U12 y U13: sus puntos van por escalones (una "
    "centésima de promedio cambia 15 puntos) y deja en bajo una asistencia de 0 % o perder todas las materias con "
    "promedio alto. Es un hallazgo sobre las reglas del contrato, no un error de código; las reglas no se cambian. "
    "El oráculo de la ronda 4 es un BORRADOR escrito por el modelo y debe firmarlo el equipo.")


def historial_v1():
    ruta = RESULTADOS / "resultados_ronda4_v1.json"
    if not ruta.exists():
        return None
    import json
    v1 = json.loads(ruta.read_text(encoding="utf-8"))
    return [{"nombre": v["nombre"] + " (v1)", "pasan": v["pasan"], "total": v["total"], "por_grupo": v["por_grupo"],
             "fallan": [f["id"] for f in v["filas"] if f["resultado"] == "FALLA"]} for v in v1["versiones"]]


if __name__ == "__main__":
    if not TODOS:
        print("Nota: los 23 casos del contrato solo se muestran si fallan (usa --todos para verlos).")
    versiones = correr_todo(imprimir_salida=True)
    from correr_ronda3 import correr_reglas, TOTAL
    _, n3 = correr_reglas(imprimir=False)
    print(f"\nRegresión: rondas 1–3 con modo reglas = {n3}/{TOTAL}" + ("" if n3 == TOTAL else "  ← REGRESIÓN"))
    print("\nResumen ronda 4:")
    for v in versiones:
        print(f"  {v['nombre']:45s} {v['pasan']:2d}/{v['total']} | " +
              " · ".join(f"{g} {a}/{b}" for g, (a, b) in v["por_grupo"].items()))
    guardar("resultados_ronda4.json", {"versiones": versiones, "regresion_rondas_1_3": n3, "lectura": LECTURA,
                                       "version_1": historial_v1()})
    try:
        from desercion.reporte import generar_reportes
        from desercion.publicar import publicar_para_web
        generar_reportes()
        publicar_para_web()
    except Exception as ex:  # el reporte es secundario: no debe tumbar las pruebas
        print(f"(No se regeneró el reporte: {type(ex).__name__})")
    principal = versiones[1]
    sys.exit(0 if n3 == TOTAL and principal["por_grupo"]["contrato"][0] == principal["por_grupo"]["contrato"][1] else 1)
