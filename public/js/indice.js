/* Script clásico (sin módulos). Índice de «Cómo se hizo»: dibuja una miniatura por grupo de pasos con los
   datos reales del entrenamiento (R = reportes/resultados.json). Si falta un dato, la miniatura lo dice. */
(function () {
  "use strict";
  const { $, esc, num, miles, json, conGlobo, s, lienzo, escala, aparecer } = window.SAT;

  function poner(id, nodos, pie) {
    const caja = $(id);
    if (!caja) return;
    const p = document.createElement("p");
    p.className = "mini-pie";
    p.innerHTML = pie;
    caja.replaceChildren(...[].concat(nodos), p);
    aparecer(caja.children, { pausa: 80, duracion: 300 });
  }

  /* Los datos: cuántos registros simulados pasan la validación y cuántas variables quedan. */
  function miniDatos(R) {
    const d = R.datos, dep = R.dependencia;
    const fila = (titulo, total, queda, que) => `<div class="mini-embudo"><span>${titulo}</span>
      <span class="mini-barra" aria-hidden="true"><i style="flex:${queda} 1 0"></i><u style="flex:${Math.max(total - queda, 0)} 1 0"></u></span>
      <b class="num">${miles(queda)}</b><small>de ${miles(total)} ${que}</small></div>`;
    const caja = document.createElement("div");
    caja.className = "mini-embudos";
    caja.innerHTML = fila("Registros", d.n_generados, d.n_validos, "pasan la validación")
      + fila("Variables", dep.candidatas.length, dep.finales.length, "quedan tras quitar las repetidas");
    poner("#mini-datos", caja, "La parte rayada es lo que se descartó.");
  }

  /* El aprendizaje: el error en validación baja vuelta a vuelta, en la neurona y en la red. */
  function miniAprendizaje(R) {
    const en = R.entrenamiento, W = 300, H = 84, m = 4;
    const series = [["neurona", en.historial_logistica, "var(--serie-1)"], ["red", en.historial_red, "var(--serie-2)"]];
    const fin = Math.max(...series.map(([, h]) => h[h.length - 1].perdida_val));
    const tope = fin * 1.35, piso = Math.min(...series.flatMap(([, h]) => h.map((f) => f.perdida_val)));
    const Y = escala(piso, tope, H - m, m);
    const svg = lienzo(W, H, "El error en validación baja con cada vuelta a los datos, en la neurona y en la red.");
    for (const [nombre, h, color] of series) {
      const X = escala(0, h.length - 1, m, W - m);
      const d = h.map((f, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(Math.min(f.perdida_val, tope)).toFixed(1)}`).join("");
      svg.appendChild(s("path", { d, fill: "none", stroke: color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      const u = h[h.length - 1];
      svg.appendChild(s("circle", { cx: X(h.length - 1), cy: Y(u.perdida_val), r: 3.5, fill: color, stroke: "var(--hoja)", "stroke-width": 1.5 }));
      void nombre;
    }
    conGlobo(svg, series.map(([n, h, c]) => `<span style="color:${c}">■</span> ${n}: ${h.length} vueltas, error final ${num(h[h.length - 1].perdida_val, 3)}`).join("<br>"));
    const leyenda = `<span class="mini-clave"><i style="background:var(--serie-1)"></i>neurona (${en.info_logistica.epocas_corridas} vueltas)</span>
      <span class="mini-clave"><i style="background:var(--serie-2)"></i>red (${en.info_red.epocas_corridas} vueltas)</span>`;
    poner("#mini-aprendizaje", svg, `El error baja con cada vuelta a los datos. ${leyenda}`);
  }

  /* La comprobación: los 45 casos de la ronda 4, uno por casilla. */
  async function miniComprobacion(R) {
    let r4 = null;
    try { r4 = await json("reportes/resultados_ronda4.json"); } catch (e) { /* se dibuja solo el AUC */ }
    const m = R.evaluacion.modelos, nodos = [];
    const v = r4 && r4.versiones.find((x) => x.nombre.includes("logística"));
    if (v && v.filas) {
      const cas = document.createElement("span");
      cas.className = "casillas mini-casillas";
      cas.setAttribute("role", "img");
      cas.setAttribute("aria-label", `${v.pasan} de ${v.total} pruebas de estrés pasan con el modelo aprendido`);
      for (const f of v.filas) {
        const i = document.createElement("i");
        if (f.resultado !== "PASA") i.className = "f";
        cas.appendChild(conGlobo(i, `<b>${esc(f.id)}</b>: ${f.resultado === "PASA" ? "pasa" : "falla"}`));
      }
      nodos.push(cas);
    }
    const auc = `AUC en prueba: reglas ${num(m["reglas (línea base)"].auc, 2)}, neurona ${num(m["regresión logística"].auc, 2)}, red ${num(m["red neuronal (MLP)"].auc, 2)}.`;
    poner("#mini-comprobacion", nodos, v ? `<strong class="num">${v.pasan} de ${v.total}</strong> pruebas de estrés pasan con el modelo aprendido. ${auc}` : auc);
  }

  function iniciarProceso(R) {
    if (!R) {
      for (const id of ["#mini-datos", "#mini-aprendizaje", "#mini-comprobacion"]) poner(id, [], "No se encontraron los resultados del entrenamiento.");
      return;
    }
    const intentar = (id, fn) => { try { fn(R); } catch (e) { console.error(id, e); poner(id, [], "No se pudo dibujar esta miniatura."); } };
    intentar("#mini-datos", miniDatos);
    intentar("#mini-aprendizaje", miniAprendizaje);
    miniComprobacion(R).catch((e) => { console.error(e); poner("#mini-comprobacion", [], "No se pudo dibujar esta miniatura."); });
  }

  window.SAT = Object.assign(window.SAT || {}, { iniciarProceso });
})();
