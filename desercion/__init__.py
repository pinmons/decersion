"""Sistema de alerta temprana de deserción universitaria (prototipo).

Módulos principales:
- contrato: esquema de entrada, Paso 1 (validación) y regla de anulación R3.4.
- reglas: Pasos 2 y 3 con pesos fijos (línea base, equivale a sistema_v3).
- sistema: punto de entrada único `evaluar(entrada, modo="reglas"|"aprendido")`.
"""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
