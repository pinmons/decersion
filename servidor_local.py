"""Servidor local que imita a Vercel: sirve public/ y responde /api/evaluar y /api/rondas.

    python servidor_local.py          # http://localhost:8000
    python servidor_local.py 8080

Usa exactamente la misma lógica que las funciones de Vercel (desercion/web.py).
"""
import json
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from desercion.web import responder_evaluar, responder_rondas, LIMITE_CUERPO

PUBLICO = Path(__file__).resolve().parent / "public"


class Manejador(SimpleHTTPRequestHandler):
    def _json(self, codigo, datos):
        cuerpo = json.dumps(datos, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_POST(self):
        if self.path.split("?")[0] != "/api/evaluar":
            return self._json(404, {"error": "no existe"})
        largo = int(self.headers.get("Content-Length") or 0)
        if largo > LIMITE_CUERPO:
            return self._json(413, {"decision": "error", "motivo": "cuerpo_demasiado_grande"})
        try:
            cuerpo = json.loads(self.rfile.read(largo) or b"{}")
        except (ValueError, UnicodeDecodeError):
            return self._json(400, {"decision": "error", "motivo": "json_invalido"})
        self._json(*responder_evaluar(cuerpo))

    def do_GET(self):
        ruta = self.path.split("?")[0]
        if ruta == "/api/rondas":
            return self._json(*responder_rondas())
        if ruta == "/api/evaluar":
            return self._json(405, {"error": "Use POST"})
        return super().do_GET()

    def log_message(self, formato, *args):
        sys.stderr.write("[local] " + formato % args + "\n")


if __name__ == "__main__":
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    servidor = ThreadingHTTPServer(("127.0.0.1", puerto), partial(Manejador, directory=str(PUBLICO)))
    print(f"Prototipo en http://localhost:{puerto}  (Ctrl+C para salir)")
    servidor.serve_forever()
