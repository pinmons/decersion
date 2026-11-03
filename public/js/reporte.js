/* Script clásico. Página "Reporte": el reporte completo del entrenamiento en HTML, construido con
   public/reportes/resultados.json (el mismo origen que reportes/reporte_entrenamiento.md). */
(function () {
  "use strict";
  const { $, esc, pct, num, miles, nombre, aparecer, alVerUnaVez } = window.SAT;

  const tabla = (enc, filas, numericas = []) => `<div class="tabla-envoltura"><table><thead><tr>${enc
    .map((e, i) => `<th${numericas.includes(i) ? ' class="n"' : ""}>${esc(e)}</th>`).join("")}</tr></thead><tbody>${filas
    .map((f) => `<tr>${f.map((c, i) => `<td${numericas.includes(i) ? ' class="n"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const ver = (href, texto) => `<p class="nota"><a href="${href}">${texto}</a></p>`;

  function secciones(R, supuestos, r4) {
    const d = R.datos, dep = R.dependencia, e = R.entrenamiento, co = R.control, ev = R.evaluacion, m = ev.modelos, nm = Object.keys(m);
    const nombres = dep.finales, hl = e.historial_logistica, mejor = e.info_logistica.mejor_epoca;
    const fila = (et, k, f) => [esc(et), ...nm.map((n) => f(m[n][k]))];
    return [
      ["resumen", "Resumen", `
        <p>Se construyó un sistema de alerta temprana de deserción para estudiantes de pregrado en los semestres 2 a 4. La línea base califica con
        reglas escritas a mano; el modo aprendido usa una regresión logística (una neurona) y una red neuronal, entrenadas desde cero en NumPy con
        ${miles(d.n_validos)} estudiantes <strong>sintéticos</strong>. Las métricas describen qué tan bien se recupera una función simulada, no el
        desempeño con estudiantes reales.</p>
        <dl class="cifras"><div><dt>AUC de la neurona</dt><dd>${num(m["regresión logística"].auc, 3)}</dd></div>
          <div><dt>AUC de la red</dt><dd>${num(m["red neuronal (MLP)"].auc, 3)}</dd></div>
          <div><dt>AUC de las reglas</dt><dd>${num(m["reglas (línea base)"].auc, 3)}</dd></div>
          <div><dt>Techo posible</dt><dd>${num(ev.auc_techo, 3)}</dd></div></dl>
        <p class="hallazgo"><strong>Conclusión.</strong> ${esc(ev.conclusion)}</p>`],
      ["datos", "1. Datos", `
        <p>Se generaron ${miles(d.n_generados)} registros: ${miles(d.n_validos)} válidos y ${d.n_descartados} con defectos a propósito, que el Paso 1
        del contrato descartó (se colaron ${d.defectuosos_colados}). Tasa de deserción simulada: ${pct(d.tasa_desercion)} (objetivo ${pct(d.tasa_objetivo, 0)}).
        ${d.sin_deuda_informada} estudiantes válidos no informan la deuda (es opcional).</p>
        ${tabla(["Salida del Paso 1", "Registros"], Object.entries(d.descartes_por_motivo).map(([k, v]) => [esc(k), v]), [1])}
        ${tabla(["Conjunto", "Estudiantes", "Tasa de deserción"], [["Entrenamiento", miles(d.division.train), pct(d.division.tasa_train)],
          ["Validación", miles(d.division.val), pct(d.division.tasa_val)], ["Prueba", miles(d.division.test), pct(d.division.tasa_test)]], [1, 2])}
        <p>Fórmula de la etiqueta [SUPUESTO]: <code>${esc(d.formula_latente)}</code></p>
        ${ver("datos.html", "Ver los datos explicados paso a paso")}`],
      ["variables", "2. Variables", `
        <p>Candidatas: ${dep.candidatas.map((n) => esc(nombre(n))).join(", ")}. ${dep.decisiones.map((x) => `Se quitó <strong>${esc(nombre(x.se_quita))}</strong>
        (r = ${num(x.correlacion, 2)} con ${esc(nombre(x.se_queda))}).`).join(" ")} Quedaron ${nombres.length} variables, estandarizadas con la media y la
        desviación de entrenamiento.</p>
        ${tabla(["Variable", "VIF antes", "VIF después"], dep.candidatas.map((n) => [esc(nombre(n)), num(dep.antes.vif[n], 2), dep.despues.vif[n] !== undefined ? num(dep.despues.vif[n], 2) : "quitada"]), [1, 2])}
        ${ver("variables.html", "Ver las variables explicadas paso a paso")}`],
      ["entrenamiento", "3. Entrenamiento", `
        ${tabla(["", "Neurona (logística)", "Red neuronal"], [
          ["Arquitectura", `${nombres.length} → 1`, `${[nombres.length, ...e.config_red.capas, 1].join(" → ")}`],
          ["Optimizador", `descenso de gradiente, η = ${e.config_logistica.tasa_aprendizaje}`, `Adam, η = ${e.config_red.tasa_aprendizaje}`],
          ["Mini-lote", e.config_logistica.tam_lote, e.config_red.tam_lote], ["L2", e.config_logistica.l2, e.config_red.l2], ["Dropout", "no", pct(e.config_red.dropout, 0)],
          ["Pesos por clase", `${num(e.info_logistica.pesos_clase.positivo, 2)} / ${num(e.info_logistica.pesos_clase.negativo, 2)}`, `${num(e.info_red.pesos_clase.positivo, 2)} / ${num(e.info_red.pesos_clase.negativo, 2)}`],
          ["Épocas corridas", e.info_logistica.epocas_corridas, e.info_red.epocas_corridas], ["Mejor época (early stopping)", mejor, e.info_red.mejor_epoca]])}
        <h3>Pesos de la neurona</h3>
        ${tabla(["Variable", "Época 1", `Época ${mejor}`, "Final (con tope)"], nombres.map((n, j) => [esc(nombre(n)), num(e.pesos_epoca1[j], 3), num(hl[mejor - 1].pesos[j], 3), num(e.pesos_finales[j], 3)]), [1, 2, 3])}
        ${ver("aprendizaje.html", "Ver cómo aprende la neurona paso a paso")} ${ver("red.html", "Ver la red neuronal paso a paso")}`],
      ["tarjeta", "4. Tarjeta de puntaje y cortes", `
        <p>Los pesos se convierten en puntos de 0 a 100: logit = ${num(e.tarjeta.logit_base, 3)} + puntaje / ${num(e.tarjeta.escala, 3)}.</p>
        ${tabla(["Variable", "β (unidades reales)", "Puntos máximos", "0 puntos cuando vale"], nombres.map((n, j) => [esc(nombre(n)), num(e.tarjeta.beta[j], 4), num(e.tarjeta.puntos_maximos[j], 1), e.tarjeta.valor_menor_riesgo[j]]), [1, 2, 3])}
        ${tabla(["Modelo", "Medio desde", "Alto desde", "Recall alto (val.)", "En alto (val.)", "¿Objetivo cumplido?"], [["Neurona", e.cortes], ["Red neuronal", e.cortes_red]].map(([n, c]) =>
          [n, c.corte_medio, c.corte_alto, pct(c.en_validacion.recall_alto), pct(c.en_validacion.fraccion_alto), c.objetivo_cumplido ? "sí" : esc(c.nota)]), [1, 2, 3, 4])}
        ${ver("puntaje.html", "Ver la tarjeta de puntaje paso a paso")}`],
      ["control", "5. Cuánto pesa cada variable", `
        ${tabla(["Variable", "Importancia neurona", "Importancia red", "Δ AUC sin ella", "Peso medio ± desv."], co.importancia_test.variables.map((n, j) => [esc(nombre(n)),
          pct(co.importancia_test.logistica_pct[j]), pct(co.importancia_test.red_pct[j]), num(co.ablacion[j].delta_auc, 4), `${num(co.estabilidad.pesos_media[j], 3)} ± ${num(co.estabilidad.pesos_desv[j], 3)}`]), [1, 2, 3, 4])}
        ${co.pasos_tope.length ? `<p>Tope de dominancia (35 %): la ${esc(nombre(co.pasos_tope[0].variable))} pasó de ${pct(Math.max(...co.antes_tope.pct_train))} a
          ${pct(Math.max(...co.despues_tope.pct_train))} con L2 ×${co.pasos_tope.at(-1).multiplicador_l2}; AUC en prueba ${num(co.antes_tope.auc_test, 4)} → ${num(co.despues_tope.auc_test, 4)}.</p>` : ""}
        ${co.estrato ? tabla(["Estrato", "n", "Deserción real", "En alto (con)", "En alto (sin)", "Recall (con)", "Recall (sin)"], co.estrato.con_estrato.map((a, i) => [a.estrato, a.n, pct(a.tasa_real),
          pct(a.fraccion_alto), pct(co.estrato.sin_estrato[i].fraccion_alto), pct(a.recall_alto), pct(co.estrato.sin_estrato[i].recall_alto)]), [1, 2, 3, 4, 5, 6]) : ""}
        ${ver("pesos.html", "Ver el control de dominancia paso a paso")}`],
      ["evaluacion", "6. Evaluación en prueba", `
        ${tabla(["Métrica", ...nm], [fila("Log-loss", "log_loss", (v) => num(v, 4)), fila("Brier", "brier", (v) => num(v, 4)), fila("AUC-ROC", "auc", (v) => num(v, 4)),
          fila("Recall (alto)", "recall", (v) => pct(v)), fila("Precisión (alto)", "precision", (v) => pct(v)), fila("Accuracy", "accuracy", (v) => pct(v)),
          fila("Recall (medio + alto)", "recall_medio_alto", (v) => pct(v)), fila("En alto", "fraccion_alto", (v) => pct(v))], [1, 2, 3])}
        <h3>Matriz de confusión por nivel</h3>
        ${tabla(["Modelo", "Bajo (desertan / no)", "Medio", "Alto"], nm.map((n) => [esc(n), ...["bajo", "medio", "alto"].map((k) => {
          const f = m[n].confusion[k]; return `${f.deserto_si} / ${f.deserto_no} (${pct(f.tasa_real, 0)})`; })]))}
        ${ver("resultados.html", "Ver la evaluación paso a paso")}`],
      ["pruebas", "7. Pruebas de estrés", `
        ${r4 ? tabla(["Versión", "Pasan", "Contrato", "Propiedades", "Casos nuevos"], [...(r4.version_1 || []).map((v) => [esc(v.nombre), `${v.pasan}/${v.total}`, ...["contrato", "propiedades", "nuevos"].map((g) => `${v.por_grupo[g][0]}/${v.por_grupo[g][1]}`)]),
          ...r4.versiones.map((v) => [esc(v.nombre) + " (final)", `${v.pasan}/${v.total}`, ...["contrato", "propiedades", "nuevos"].map((g) => `${v.por_grupo[g][0]}/${v.por_grupo[g][1]}`)])], [1, 2, 3, 4])
          + `<p>${esc(r4.lectura)}</p>` : "<p>No se encontraron los resultados de la ronda 4.</p>"}
        ${ver("pruebas.html", "Ver las pruebas caso por caso")}`],
      ["limitaciones", "8. Limitaciones", `<ul>
        <li>Los datos son sintéticos: el modelo aprendió una fórmula inventada. Con datos reales los pesos, la importancia y el error cambiarán
          (<code>python -m desercion.entrenamiento --csv archivo.csv</code>).</li>
        <li>Las propiedades de la ronda 4 se verificaron en casos y barridos concretos, no en todo el espacio posible.</li>
        <li>La corrección de probabilidad por pesos de clase es aproximada; con datos reales conviene recalibrar.</li>
        <li>El estrato es una variable sensible: usarlo puede reforzar desigualdades.</li>
        <li>Los oráculos de las rondas 1 a 4 son borradores escritos por el modelo y deben firmarlos personas del equipo.</li></ul>`],
      ["supuestos", "9. Supuestos para revisar", supuestos ? `<ol class="supuestos">${supuestos.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : "<p>No se encontró la lista de supuestos.</p>"],
    ];
  }

  async function montarReporte(R, supuestos, r4) {
    const destino = $("#contenido"), indice = $("#indice-reporte");
    if (!R) { destino.textContent = "No se encontraron los resultados del entrenamiento (reportes/resultados.json)."; return; }
    const lista = secciones(R, supuestos, r4);
    destino.innerHTML = lista.map(([id, titulo, html]) => `<section id="rep-${id}" aria-labelledby="t-${id}"><h2 id="t-${id}">${esc(titulo)}</h2>${html}</section>`).join("");
    indice.innerHTML = lista.map(([id, titulo], i) => `<li><a href="#rep-${id}"><b class="paso-n">${i}</b><span class="paso-texto"><strong>${esc(titulo.replace(/^\d+\. /, ""))}</strong></span></a></li>`).join("");
    destino.querySelectorAll("section").forEach((sec) => alVerUnaVez(sec, () => aparecer(sec.children, { pausa: 30 }), "0px 0px -5% 0px"));
    if ("IntersectionObserver" in window) {
      const enlaces = [...indice.querySelectorAll("a")];
      const obs = new IntersectionObserver((entradas) => {
        for (const e of entradas) if (e.isIntersecting) enlaces.forEach((a) => { if (a.getAttribute("href") === `#${e.target.id}`) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
      }, { rootMargin: "-25% 0px -65% 0px" });
      destino.querySelectorAll("section").forEach((s) => obs.observe(s));
    }
  }

  window.SAT = Object.assign(window.SAT || {}, { montarReporte });
})();
