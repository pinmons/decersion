"""Copia a public/ lo que necesita la web estática de Vercel (gráficas, reportes y resultados).

    python -m desercion.publicar
"""
import json
import shutil

from . import RAIZ
from .contrato import ESQUEMA, SEMESTRES_POBLACION

ORIGEN = RAIZ / "reportes"
DESTINO = RAIZ / "public" / "reportes"


def publicar_corrida(nombre):
    """Copia a public/reportes/<nombre>/ los resultados y los pesos de una corrida aparte."""
    origen, destino = ORIGEN / nombre, DESTINO / nombre
    (destino / "modelos").mkdir(parents=True, exist_ok=True)
    n = 0
    for archivo in list(origen.glob("*.png")) + [origen / "resultados.json"]:
        shutil.copy2(archivo, destino / archivo.name)
        n += 1
    for archivo in (RAIZ / "modelos_entrenados" / nombre).glob("*.json"):
        shutil.copy2(archivo, destino / "modelos" / archivo.name)
        n += 1
    print(f"Web: {n} archivos copiados a public/reportes/{nombre}/")


def publicar_para_web(nombre=None):
    if nombre:
        return publicar_corrida(nombre)
    DESTINO.mkdir(parents=True, exist_ok=True)
    n = 0
    for patron in ("*.png", "*.md", "resultados.json"):
        for archivo in ORIGEN.glob(patron):
            shutil.copy2(archivo, DESTINO / archivo.name)
            n += 1
    for archivo in (RAIZ / "pruebas" / "resultados").glob("resultados_ronda*.json"):
        shutil.copy2(archivo, DESTINO / archivo.name)
        n += 1
    # pesos de los modelos: la web dibuja la neurona y la red con los pesos reales
    (DESTINO / "modelos").mkdir(exist_ok=True)
    for archivo in (RAIZ / "modelos_entrenados").glob("*.json"):
        shutil.copy2(archivo, DESTINO / "modelos" / archivo.name)
        n += 1
    esquema = {campo: {"tipo": tipo, "obligatorio": ob,
                       "valores": sorted(regla) if tipo == "enum" else None,
                       "rango": list(regla) if tipo in ("int", "num") else None}
               for campo, (tipo, regla, ob) in ESQUEMA.items()}
    # Campos del contrato ampliado (todos opcionales): «Probar un caso» los pide para el modelo de la base real.
    from .contrato_ampliado import CAMPOS as CAMPOS_AMPLIADOS
    ampliado = {campo: {"tipo": tipo, "obligatorio": False, "rango": list(r) if r else None, "fuente": f, "descripcion": d}
                for campo, (tipo, r, f, d) in CAMPOS_AMPLIADOS.items()}
    (DESTINO / "esquema.json").write_text(json.dumps(
        {"campos": esquema, "ampliado": ampliado, "semestres_poblacion": list(SEMESTRES_POBLACION)},
        ensure_ascii=False, indent=1),
        encoding="utf-8")
    print(f"Web: {n + 1} archivos copiados a public/reportes/ (incluye esquema.json del contrato)")
    from .reporte import SUPUESTOS
    (DESTINO / "supuestos.json").write_text(json.dumps(SUPUESTOS, ensure_ascii=False, indent=1), encoding="utf-8")
    from .paginas_web import generar
    generar()


if __name__ == "__main__":
    publicar_para_web()
