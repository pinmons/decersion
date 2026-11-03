"""Función de Vercel: POST /api/evaluar (ver desercion/web.py)."""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from desercion.web import responder_evaluar, LIMITE_CUERPO  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def _responder(self, codigo, datos):
        cuerpo = json.dumps(datos, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_POST(self):
        largo = int(self.headers.get("Content-Length") or 0)
        if largo > LIMITE_CUERPO:
            return self._responder(413, {"decision": "error", "motivo": "cuerpo_demasiado_grande"})
        try:
            cuerpo = json.loads(self.rfile.read(largo) or b"{}")
        except (ValueError, UnicodeDecodeError):
            return self._responder(400, {"decision": "error", "motivo": "json_invalido"})
        self._responder(*responder_evaluar(cuerpo))

    def do_GET(self):
        self._responder(405, {"error": "Use POST con {\"entrada\": {...}, \"modo\": \"reglas\"|\"aprendido\"}"})
