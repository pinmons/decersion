/* Script clásico (sin módulos). Formulario del profesor: reporta a un estudiante a Bienestar.
   Valida que el código exista en la base (y muestra el programa para confirmar), pero nunca muestra el nivel de
   riesgo: eso solo lo ve Bienestar. [SUPUESTO] En el prototipo el aviso se guarda en el navegador
   (localStorage, clave «avisos-docentes-v1») y la bandeja abierta en el mismo navegador lo recibe al instante. */
(function () {
  "use strict";
  const { esc, json } = window.SAT;
  const $ = (sel) => document.querySelector(sel);
  const CLAVE = "avisos-docentes-v1";
  const porCodigo = new Map();

  function leerAvisos() { try { return JSON.parse(localStorage.getItem(CLAVE) || "[]"); } catch (e) { return []; } }
  function guardarAvisos(lista) { localStorage.setItem(CLAVE, JSON.stringify(lista)); }
  const programa = (e) => e.titulacion.replace("Titulación", "Programa");

  async function cargarCodigos() {
    let d;
    try { d = await json("api/estudiantes?modelo=logistica"); if (d.error) throw new Error(d.error); }
    catch (e1) { try { d = await json("reportes/real/estudiantes.json"); } catch (e2) { return; } }
    d.estudiantes.forEach((e) => porCodigo.set(e.id, e));
    $("#doc-codigos").innerHTML = [...porCodigo.keys()].sort().map((c) => `<option value="${esc(c)}">`).join("");
  }

  function revisarCodigo() {
    const c = $("#doc-codigo").value.trim().toUpperCase(), e = porCodigo.get(c), quien = $("#doc-quien");
    if (!c) { quien.textContent = ""; quien.className = "doc-ayuda"; return null; }
    if (!porCodigo.size) { quien.textContent = ""; return c; }
    if (!e) { quien.textContent = "No encontramos ese código. Revíselo en su lista de clase."; quien.className = "doc-ayuda doc-mal"; return null; }
    quien.textContent = `${programa(e)}, cohorte ${e.cohorte}.`; quien.className = "doc-ayuda doc-bien";
    return c;
  }

  function error(texto, campo) {
    const p = $("#doc-error");
    p.textContent = texto; p.hidden = !texto;
    if (campo) $(campo).focus();
  }

  function enviar(ev) {
    ev.preventDefault();
    const codigo = revisarCodigo();
    const asignatura = $("#doc-asignatura").value.trim(), docente = $("#doc-nombre").value.trim();
    const motivos = [...document.querySelectorAll('input[name="motivo"]:checked')].map((i) => i.value);
    if (!codigo) return error("Escriba el código de un estudiante que esté en la base.", "#doc-codigo");
    if (!asignatura) return error("Escriba la asignatura.", "#doc-asignatura");
    if (!motivos.length) return error("Marque al menos una opción en «¿Qué está pasando?».", 'input[name="motivo"]');
    if (!docente) return error("Escriba su nombre, para que Bienestar sepa a quién preguntar.", "#doc-nombre");
    error("");
    const aviso = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, fecha: new Date().toISOString(), codigo, asignatura,
      docente, motivos, comentario: $("#doc-comentario").value.trim(), leido: false };
    try { guardarAvisos([...leerAvisos(), aviso]); }
    catch (e) { return error("No se pudo guardar el aviso en este navegador. Intente de nuevo."); }
    $("#doc-form").hidden = true;
    $("#doc-resumen").innerHTML = `Su aviso sobre <strong>${esc(codigo)}</strong> en <strong>${esc(asignatura)}</strong> llegó a la bandeja de Bienestar.`;
    $("#doc-enviado").hidden = false;
    $("#doc-enviado").focus();
  }

  function otro() {
    const nombre = $("#doc-nombre").value;
    $("#doc-form").reset(); $("#doc-nombre").value = nombre;  // el profesor suele reportar a varios: se guarda su nombre
    revisarCodigo();
    $("#doc-enviado").hidden = true; $("#doc-form").hidden = false;
    $("#doc-codigo").focus();
  }

  function iniciar() {
    cargarCodigos().then(revisarCodigo);
    $("#doc-codigo").addEventListener("change", revisarCodigo);
    $("#doc-codigo").addEventListener("blur", revisarCodigo);
    $("#doc-form").addEventListener("submit", enviar);
    $("#doc-otro").addEventListener("click", otro);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
