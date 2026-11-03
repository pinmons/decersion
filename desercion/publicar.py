"""Copia a public/ lo que necesita la web estática de Vercel (gráficas, reportes y resultados).

    python -m desercion.publicar
"""
import shutil

from . import RAIZ

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
    print(f"Web: {n} archivos copiados a public/reportes/")


if __name__ == "__main__":
    publicar_para_web()
