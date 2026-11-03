"""Función de Vercel: GET /api/rondas – corre las rondas 1–3 (modo reglas) y la ronda 4."""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from desercion.web import responder_rondas  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        codigo, datos = responder_rondas()
        cuerpo = json.dumps(datos, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(cuerpo)
