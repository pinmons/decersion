/* Script clásico (sin módulos) para que la página funcione también abierta como archivo.
   Punto de entrada: según la página (body[data-pagina]) monta la portada, la evaluación o un paso. */
(function () {
  "use strict";
  const { json, miles, iniciarEvaluador, iniciarPortada, montarPaso, montarReporte } = window.SAT;

  async function opcional(ruta) {
    try { return await json(ruta); } catch (e) { return null; }
  }

  function avisoArchivo() {
    if (location.protocol !== "file:") return;
    const aviso = document.getElementById("aviso-archivo");
    aviso.hidden = false;
    aviso.innerHTML = `<div class="envoltura"><strong>Abrió la página como archivo.</strong> La planilla se puede llenar, pero para
      calificar y ver las gráficas hace falta el servidor: en la carpeta del proyecto ejecute <code>python servidor_local.py</code>
      y entre a <code>http://localhost:8000</code>, o use la versión publicada en Vercel.</div>`;
  }

  async function iniciar() {
    avisoArchivo();
    const pagina = document.body.dataset.pagina || "";
    const R = await opcional("reportes/resultados.json");
    if (R) document.querySelectorAll('[data-cifra="n_validos"]').forEach((e) => { e.textContent = miles(R.datos.n_validos); });

    if (pagina === "inicio") return iniciarPortada();
    if (pagina === "evaluar") return iniciarEvaluador(R);
    if (pagina === "reporte") {
      const [sup, r4] = await Promise.all([opcional("reportes/supuestos.json"), opcional("reportes/resultados_ronda4.json")]);
      return montarReporte(R, sup, r4);
    }
    if (pagina.startsWith("paso-")) {
      const clave = pagina.slice(5);
      if (!R && clave !== "contrato") {
        document.getElementById("contenido").textContent = "No se encontraron los resultados del entrenamiento (reportes/resultados.json).";
        return;
      }
      const necesita = (lista) => lista.includes(clave);
      const [r12, r3, r4, r4v1, red, log] = await Promise.all([
        necesita(["pruebas"]) ? opcional("reportes/resultados_rondas.json") : null,
        necesita(["pruebas"]) ? opcional("reportes/resultados_ronda3.json") : null,
        necesita(["pruebas"]) ? opcional("reportes/resultados_ronda4.json") : null,
        necesita(["pruebas"]) ? opcional("reportes/resultados_ronda4_v1.json") : null,
        necesita(["red"]) ? opcional("reportes/modelos/red_neuronal.json") : null,
        necesita(["aprendizaje"]) ? opcional("reportes/modelos/logistica.json") : null]);
      if ((clave === "red" && !red) || (clave === "aprendizaje" && !log)) {
        document.getElementById("contenido").textContent = "No se encontraron los pesos del modelo (reportes/modelos/).";
        return;
      }
      montarPaso(clave, { R, rondas: { r12, r3, r4, r4v1 }, modelos: { red, log } });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
