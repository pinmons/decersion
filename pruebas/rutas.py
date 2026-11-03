"""Ajusta sys.path para que el arnés encuentre el paquete `desercion` y el trabajo previo.

`contexto/` se agrega al FINAL de la ruta: de ahí se importan, sin copiarlos ni editarlos,
los casos y oráculos (dataset.py, dataset_r3.py) y las versiones históricas v1, v2 y v3.
"""
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # no crear __pycache__ dentro de contexto/ (solo lectura)

RAIZ = Path(__file__).resolve().parent.parent
CONTEXTO = RAIZ / "contexto"
PRUEBAS = RAIZ / "pruebas"
RESULTADOS = PRUEBAS / "resultados"

for ruta in (str(RAIZ), str(PRUEBAS)):
    if ruta not in sys.path:
        sys.path.insert(0, ruta)
if str(CONTEXTO) not in sys.path:
    sys.path.append(str(CONTEXTO))

try:  # la terminal de Windows a veces no usa UTF-8 al redirigir la salida
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
