"use strict";
const el = id => document.getElementById(id);
let registro = false;

async function solicitar(ruta, datos) {
  const opciones = datos ? { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(datos) } : {};
  const respuesta = await fetch("/api/" + ruta, opciones);
  const resultado = await respuesta.json();
  if (!respuesta.ok) throw new Error(resultado.error || "Inténtalo de nuevo.");
  return resultado;
}

el("alternar").onclick = () => {
  registro = !registro;
  el("titulo").textContent = registro ? "Crear cuenta" : "Iniciar sesión";
  el("confirmar").textContent = registro ? "Registrarme" : "Entrar";
  el("alternar").textContent = registro ? "Ya tengo cuenta" : "Crear una cuenta";
  el("fila-nombre").hidden = !registro;
  el("nombre").required = registro;
  el("clave").autocomplete = registro ? "new-password" : "current-password";
  el("clave").minLength = registro ? 8 : 1;
  el("mensaje").textContent = "";
};

el("formulario").onsubmit = async evento => {
  evento.preventDefault();
  el("confirmar").disabled = true;
  try {
    await solicitar(registro ? "registro" : "entrar", {nombre: el("nombre").value, correo: el("correo").value, clave: el("clave").value});
    location.replace("/");
  } catch (error) {
    el("mensaje").textContent = error.message;
  } finally {
    el("confirmar").disabled = false;
  }
};

el("salir").onclick = async () => {
  try {
    await solicitar("salir", {});
    location.reload();
  } catch (error) {
    el("mensaje").textContent = error.message;
  }
};

solicitar("sesion").then(({usuario}) => {
  if (!usuario) return;
  el("formulario").hidden = el("alternar").hidden = true;
  el("cuenta").hidden = false;
  el("titulo").textContent = "Mi cuenta";
  el("perfil").textContent = usuario.nombre + " · " + usuario.correo;
}).catch(() => { el("mensaje").textContent = "No se pudo consultar la sesión."; });

el("mostrar").onclick = () => {
  const visible = el("clave").type === "password";
  el("clave").type = visible ? "text" : "password";
  el("mostrar").textContent = visible ? "Ocultar" : "Mostrar";
  el("mostrar").setAttribute("aria-label", visible ? "Ocultar contraseña" : "Mostrar contraseña");
};

document.querySelector(".ayuda").onclick = () => {
  el("guia").open = true;
};
