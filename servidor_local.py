"""Servidor local que imita a Vercel: sirve public/ y responde /api/evaluar y /api/rondas.

    python servidor_local.py          # http://localhost:8000
    python servidor_local.py 8080

Usa exactamente la misma lógica que las funciones de Vercel (desercion/web.py).
"""
import json
import sys
from http.cookies import SimpleCookie, CookieError
from desercion import cuentas
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from urllib.parse import parse_qs, urlparse

from desercion.web import responder_estudiantes, responder_evaluar, responder_rondas, LIMITE_CUERPO

PUBLICO = Path(__file__).resolve().parent / "public"


class Manejador(SimpleHTTPRequestHandler):
    def _token(self):
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
        except CookieError:
            return ""
        return cookies["sesion"].value if "sesion" in cookies else ""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, codigo, datos, token=None):
        cuerpo = json.dumps(datos, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(codigo)
        if token is not None:
            edad = cuentas.DURACION if token else 0
            self.send_header("Set-Cookie", f"sesion={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={edad}")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_POST(self):
        ruta = urlparse(self.path).path
        if ruta in ("/api/registro", "/api/entrar", "/api/salir"):
            if self.headers.get_content_type() != "application/json":
                return self._json(415, {"error": "Se requiere JSON."})
            try:
                largo = int(self.headers.get("Content-Length", "0"))
                if not 0 < largo <= 8192:
                    raise ValueError
                datos = json.loads(self.rfile.read(largo))
                if not isinstance(datos, dict) or not all(isinstance(v, str) for v in datos.values()):
                    raise ValueError
            except (ValueError, UnicodeError):
                return self._json(400, {"error": "Solicitud incorrecta."})
            return self._json(*cuentas.cambiar(ruta.split("/")[-1], datos, self._token()))
        if not cuentas.actual(self._token()):
            return self._json(401, {"error": "Inicia sesión."})
        if ruta != "/api/evaluar":
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
        usuario = cuentas.actual(self._token())
        if ruta == "/api/sesion":
            return self._json(200, {"usuario": usuario})
        if not usuario and ruta not in ("/acceso.html", "/js/acceso.js", "/acceso.css"):
            if ruta.startswith("/api/"):
                return self._json(401, {"error": "Inicia sesión."})
            self.send_response(302)
            self.send_header("Location", "/acceso.html")
            self.end_headers()
            return
        if ruta == "/api/rondas":
            return self._json(*responder_rondas())
        if ruta == "/api/estudiantes":
            modelo = (parse_qs(urlparse(self.path).query).get("modelo") or ["logistica"])[0]
            return self._json(*responder_estudiantes(modelo))
        if ruta == "/api/evaluar":
            return self._json(405, {"error": "Use POST"})
        return super().do_GET()

    def log_message(self, formato, *args):
        sys.stderr.write("[local] " + formato % args + "\n")


if __name__ == "__main__":
    cuentas.iniciar()
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    servidor = ThreadingHTTPServer(("127.0.0.1", puerto), partial(Manejador, directory=str(PUBLICO)))
    print(f"Prototipo en http://localhost:{puerto}  (Ctrl+C para salir)")
    servidor.serve_forever()
