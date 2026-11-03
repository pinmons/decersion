"""Copia a public/ lo que necesita la web estática de Vercel (gráficas, reportes y resultados).

    python -m desercion.publicar
"""
import json
import shutil

from . import RAIZ
from .contrato import ESQUEMA, SEMESTRES_POBLACION

ORIGEN = RAIZ / "reportes"
DESTINO = RAIZ / "public" / "reportes"


def publicar_para_web():
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
    (DESTINO / "esquema.json").write_text(json.dumps(
        {"campos": esquema, "semestres_poblacion": list(SEMESTRES_POBLACION)}, ensure_ascii=False, indent=1),
        encoding="utf-8")
    print(f"Web: {n + 1} archivos copiados a public/reportes/ (incluye esquema.json del contrato)")
    from .paginas_web import generar
    generar()


if __name__ == "__main__":
    publicar_para_web()
