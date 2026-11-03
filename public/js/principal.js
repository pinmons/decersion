/* Punto de entrada: carga los resultados publicados y monta la ficha y el proceso. */
import { json, miles } from "./util.js";
import { iniciarEvaluador } from "./evaluador.js";
import { iniciarProceso } from "./proceso.js";

async function opcional(ruta) {
  try { return await json(ruta); } catch (e) { return null; }
}

async function iniciar() {
  const [R, r12, r3, r4, r4v1, red] = await Promise.all([
    opcional("reportes/resultados.json"), opcional("reportes/resultados_rondas.json"), opcional("reportes/resultados_ronda3.json"),
    opcional("reportes/resultados_ronda4.json"), opcional("reportes/resultados_ronda4_v1.json"), opcional("reportes/modelos/red_neuronal.json"),
  ]);
  if (R) document.querySelectorAll('[data-cifra="n_validos"]').forEach((e) => { e.textContent = miles(R.datos.n_validos); });
  iniciarEvaluador(R);
  if (R) iniciarProceso(R, { r12, r3, r4, r4v1 }, { red });
  else document.querySelectorAll(".paso .cuerpo").forEach((c) => { c.textContent = "No se encontraron los resultados del entrenamiento (reportes/resultados.json)."; });
}

iniciar();
