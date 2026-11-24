import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import time
from contextlib import closing
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / "base_datos"
ARCHIVO = BASE / "cuentas_locales.sqlite"
DURACION = 8 * 3600


def derivar(clave, sal):
    return hashlib.scrypt(clave.encode(), salt=sal, n=2**14, r=8, p=1)


def crear(db, nombre, correo, rol, clave):
    sal = secrets.token_bytes(16)
    db.execute("INSERT INTO usuarios VALUES (?, ?, ?, ?, ?)",
               (correo, nombre, rol, sal, derivar(clave, sal)))


def iniciar():
    with closing(sqlite3.connect(ARCHIVO)) as db, db:
        db.execute("CREATE TABLE IF NOT EXISTS usuarios (correo TEXT PRIMARY KEY, nombre TEXT, rol TEXT, sal BLOB, hash BLOB)")
        db.execute("CREATE TABLE IF NOT EXISTS sesiones (token TEXT PRIMARY KEY, correo TEXT, vence INTEGER)")
        perfiles = json.loads((BASE / "usuarios_demo.json").read_text(encoding="utf-8-sig"))
        db.execute("BEGIN IMMEDIATE")
        for perfil in perfiles:
            correo = perfil["correo"]
            if not db.execute("SELECT 1 FROM usuarios WHERE correo=?", (correo,)).fetchone():
                crear(db, perfil["nombre"], correo, perfil["rol"], "ActividadDemo2026!")


def identificar(token):
    return hashlib.sha256(token.encode()).hexdigest()


def actual(token):
    if not token:
        return None
    with closing(sqlite3.connect(ARCHIVO)) as db:
        db.row_factory = sqlite3.Row
        fila = db.execute("SELECT nombre, usuarios.correo, rol FROM sesiones JOIN usuarios USING(correo) WHERE token=? AND vence>?",
                          (identificar(token), time.time())).fetchone()
        return dict(fila) if fila else None


def cambiar(accion, datos, token):
    with closing(sqlite3.connect(ARCHIVO)) as db, db:
        if accion == "salir":
            db.execute("DELETE FROM sesiones WHERE token=?", (identificar(token),))
            return 200, {}, ""
        correo = datos.get("correo", "").strip().lower()
        clave = datos.get("clave", "")
        if accion == "registro":
            nombre = datos.get("nombre", "").strip()
            if not (1 <= len(nombre) <= 100 and len(correo) <= 254 and re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", correo) and 8 <= len(clave) <= 128):
                return 400, {"error": "Revisa el nombre, el correo y la contraseña (8 a 128 caracteres)."}, None
            try:
                crear(db, nombre, correo, "Usuario", clave)
            except sqlite3.IntegrityError:
                return 409, {"error": "El correo ya está registrado."}, None
        else:
            fila = db.execute("SELECT sal, hash FROM usuarios WHERE correo=?", (correo,)).fetchone()
            if not fila or not hmac.compare_digest(derivar(clave, fila[0]), fila[1]):
                return 401, {"error": "Correo o contraseña incorrectos."}, None
        db.execute("DELETE FROM sesiones WHERE vence<=? OR token=?", (time.time(), identificar(token)))
        nuevo = secrets.token_urlsafe(32)
        db.execute("INSERT INTO sesiones VALUES (?, ?, ?)", (identificar(nuevo), correo, int(time.time()) + DURACION))
        return 200, {}, nuevo
