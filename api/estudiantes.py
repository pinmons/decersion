"""Función de Vercel: GET /api/estudiantes?modelo=logistica|red_neuronal|reglas

Lee la base de datos real (base_datos/registro_academico.sqlite), pasa a cada estudiante en
operación por el sistema y devuelve un resultado por estudiante (ver desercion/operacion.py).
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from desercion.web import responder_estudiantes  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        modelo = (parse_qs(urlparse(self.path).query).get("modelo") or ["logistica"])[0]
        codigo, datos = responder_estudiantes(modelo)
        cuerpo = json.dumps(datos, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(cuerpo)
