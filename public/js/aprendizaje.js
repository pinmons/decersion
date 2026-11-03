/* Script clásico. Pasos 4 y 5 de "Cómo se construyó": cómo aprende una neurona y la red neuronal.
   Todo se explica siguiendo a un estudiante real del contrato (R01, R02 o R03) con los pesos guardados del
   modelo (public/reportes/modelos/*.json). Los cálculos aquí son ilustrativos: la decisión del sistema siempre
   sale de la API (desercion/inferencia.py), y estos números coinciden con ella. */
(function () {
  "use strict";
  const { $, esc, pct, num, miles, nombre, s, lienzo, escala, figura, leyenda, conGlobo, grafLineas, grafBarras,
    reducido, alVerUnaVez, aparecer, secuencia, CASOS } = window.SAT;

  const sig = (z) => 1 / (1 + Math.exp(-z));
  const signoColor = (w) => (w >= 0 ? "var(--div-pos)" : "var(--div-neg)");
  const el = (tag, clase, html) => { const e = document.createElement(tag); if (clase) e.className = clase; if (html !== undefined) e.innerHTML = html; return e; };
  const formula = (html, nota) => el("div", "formula", html + (nota ? `<small>${nota}</small>` : ""));
  const DESCRIPCION = {
    semestre: (e) => `semestre ${e.semestre}`,
    promedio_acumulado: (e) => `promedio ${num(e.promedio_acumulado, 1)}`,
    creditos_inscritos: (e) => `${e.creditos_inscritos} créditos`,
    tasa_reprobacion: (e) => `${e.materias_reprobadas} de ${e.materias_cursadas_periodo_anterior} perdidas`,
    porcentaje_asistencia: (e) => `asistencia ${num(e.porcentaje_asistencia, 0)} %`,
    estrato: (e) => `estrato ${e.estrato}`,
    trabaja: (e) => (e.trabaja ? "trabaja" : "no trabaja"),
    deuda_matricula: (e) => (e.deuda_matricula ? "debe matrícula" : "no debe matrícula"),
  };

  /* ---------------------------------------------------------------- cálculos con los pesos guardados */
  function rasgos(e, variables) {
    return variables.map((v) => {
      if (v === "tasa_reprobacion") return e.materias_reprobadas / e.materias_cursadas_periodo_anterior;
      if (v === "trabaja" || v === "deuda_matricula") return e[v] === undefined || e[v] === null ? 1 : Number(e[v]);
      return Number(e[v]);
    });
  }
  function logistica(e, L) {
    const x = rasgos(e, L.variables);
    const z = x.map((v, j) => (v - L.escalador.media[j]) / L.escalador.desviacion[j]);
    const contrib = z.map((v, j) => v * L.pesos[j]);
    const logit = L.sesgo + contrib.reduce((a, b) => a + b, 0);
    return { x, z, contrib, logit, pBruta: sig(logit), p: sig(logit - L.ajuste_prior) };
  }
  function red(e, M) {
    const x = rasgos(e, M.variables);
    const a0 = x.map((v, j) => (v - M.escalador.media[j]) / M.escalador.desviacion[j]);
    const capas = [a0];
    let a = a0;
    for (let k = 0; k < M.W.length; k++) {
      const W = M.W[k], b = M.b[k];
      const zk = b.map((bj, j) => bj + a.reduce((acc, ai, i) => acc + ai * W[i][j], 0));
      a = k < M.W.length - 1 ? zk.map((v) => Math.max(0, v)) : zk;
      capas.push(a);
    }
    const logit = capas[capas.length - 1][0];
    return { capas, logit, pBruta: sig(logit), p: sig(logit - M.ajuste_prior) };
  }

  /* ---------------------------------------------------------------- estudiante elegido (compartido en la página) */
  let indiceCaso = 2;
  const oyentes = [];
  /* Los datos del caso elegido, con su código (R01, R02, R03) en `id`. */
  const estudiante = () => ({ ...CASOS[indiceCaso].entrada, id: CASOS[indiceCaso].id });
  function alCambiarEstudiante(fn) { oyentes.push(fn); fn(estudiante()); }
  function selectorEstudiante() {
    const barra = el("div", "selector-estudiante");
    barra.innerHTML = `<p>Siga a un estudiante por todo el proceso:</p><div class="segmentado" role="radiogroup" aria-label="Estudiante de ejemplo">
      ${CASOS.map((c, i) => `<label><input type="radio" name="estudiante" value="${i}" ${i === indiceCaso ? "checked" : ""}><span>Caso ${c.id}</span></label>`).join("")}</div>`;
    barra.addEventListener("change", (ev) => { indiceCaso = +ev.target.value; oyentes.forEach((f) => f(estudiante())); });
    return barra;
  }

  /* Controles de una animación por etapas: anterior, siguiente y reproducir. */
  function controlEtapas(textos, alMostrar) {
    const caja = el("div", "control-etapas");
    caja.innerHTML = `<button type="button" class="boton boton-chico" data-acc="ant" aria-label="Etapa anterior">Anterior</button>
      <button type="button" class="boton boton-chico" data-acc="sig" aria-label="Etapa siguiente">Siguiente</button>
      <button type="button" class="boton boton-chico boton-tinta" data-acc="rep">Ver animado</button>
      <span class="etapa-texto" aria-live="polite"></span>`;
    let k = textos.length - 1, temporizador = null;
    const ir = (n) => { k = Math.max(0, Math.min(textos.length - 1, n)); caja.querySelector(".etapa-texto").textContent = `${k + 1} de ${textos.length}: ${textos[k]}`; alMostrar(k); };
    const parar = () => { clearInterval(temporizador); temporizador = null; caja.querySelector('[data-acc="rep"]').textContent = "Ver animado"; };
    const reproducir = () => {
      parar();
      if (reducido()) { ir(textos.length - 1); return; }
      ir(0);
      caja.querySelector('[data-acc="rep"]').textContent = "Detener";
      temporizador = setInterval(() => { if (k >= textos.length - 1) parar(); else ir(k + 1); }, 1500);
    };
    caja.addEventListener("click", (ev) => {
      const acc = ev.target.closest("button")?.dataset.acc;
      if (acc === "ant") { parar(); ir(k - 1); }
      if (acc === "sig") { parar(); ir(k + 1); }
      if (acc === "rep") { temporizador ? parar() : reproducir(); }
    });
    ir(k);
    return { caja, reproducir, ir };
  }

  /* ================================================================ PASO 4: la neurona */
  function tablaRasgos(L) {
    const envoltura = el("div", "tabla-envoltura");
    const pintar = (e) => {
      const r = logistica(e, L);
      envoltura.innerHTML = `<table class="tabla-paso"><thead><tr><th>Variable</th><th>Dato del estudiante</th><th class="n">x</th>
        <th class="n">media μ</th><th class="n">desviación σ</th><th class="n">estandarizado z</th></tr></thead><tbody>
        ${L.variables.map((v, j) => `<tr><td>${esc(nombre(v))}</td><td>${esc(DESCRIPCION[v](e))}</td><td class="n">${num(r.x[j], v === "tasa_reprobacion" ? 2 : 1)}</td>
          <td class="n">${num(L.escalador.media[j], 2)}</td><td class="n">${num(L.escalador.desviacion[j], 2)}</td><td class="n"><strong>${num(r.z[j], 2)}</strong></td></tr>`).join("")}
        </tbody></table>`;
      aparecer(envoltura.querySelectorAll("tbody tr"), { pausa: 35, desde: "translateX(-6px)" });
    };
    alCambiarEstudiante(pintar);
    return envoltura;
  }

  function neuronaPorEtapas(L) {
    const W = 680, H = 370, xIn = 196, xN = 440, yN = 185, rN = 46;
    const nV = L.variables.length;
    const yIn = (i) => 26 + i * ((H - 70) / (nV - 1));
    const svg = lienzo(W, H, "Una neurona: las variables estandarizadas se multiplican por sus pesos, se suman con el sesgo y la sigmoide da la probabilidad.");
    const g = (n) => s("g", { class: "etapa", "data-etapa": n });
    const capa = [g(0), g(1), g(2), g(3), g(4)];
    const aristas = [], valoresZ = [], productos = [];
    for (let i = 0; i < nV; i++) {
      const d = `M${xIn + 6},${yIn(i)} L${xN - rN},${yN}`;
      aristas.push(s("path", { d, fill: "none", "stroke-linecap": "round" }));
      capa[1].appendChild(aristas[i]);
      productos.push(s("text", { x: xIn + 18, y: yIn(i) - 7, class: "etiqueta-svg" }));
      capa[1].appendChild(productos[i]);
      capa[0].appendChild(s("text", { x: xIn - 66, y: yIn(i) + 4, "text-anchor": "end", class: "texto-svg", texto: nombre(L.variables[i]) }));
      valoresZ.push(s("text", { x: xIn - 12, y: yIn(i) + 4, "text-anchor": "end", class: "texto-svg-fuerte" }));
      capa[0].appendChild(valoresZ[i]);
      capa[0].appendChild(s("circle", { cx: xIn, cy: yIn(i), r: 6, fill: "var(--acento)" }));
    }
    capa[2].append(s("circle", { cx: xN, cy: yN, r: rN, fill: "var(--hoja)", stroke: "var(--tinta)", "stroke-width": 2 }));
    const textoSuma = s("text", { x: xN, y: yN + 2, "text-anchor": "middle", class: "texto-svg-fuerte" });
    capa[2].append(s("text", { x: xN, y: yN - 14, "text-anchor": "middle", class: "etiqueta-svg", texto: "Σ + sesgo" }), textoSuma);
    const textoSesgo = s("text", { x: xN, y: yN + rN + 18, "text-anchor": "middle", class: "etiqueta-svg" });
    capa[2].append(textoSesgo);
    // mini sigmoide
    const X = escala(-4, 3, 520, 660), Y = escala(0, 1, yN + 40, yN - 60);
    let d = "";
    for (let i = 0; i <= 70; i++) { const z = -4 + i * 0.1; d += `${i ? "L" : "M"}${X(z).toFixed(1)},${Y(sig(z)).toFixed(1)}`; }
    capa[3].append(s("line", { x1: xN + rN, x2: 516, y1: yN, y2: yN, stroke: "var(--tinta)", "stroke-width": 1.5 }),
      s("rect", { x: 516, y: yN - 66, width: 148, height: 112, rx: 8, fill: "var(--papel)", stroke: "var(--renglon)" }),
      s("path", { d, fill: "none", stroke: "var(--acento)", "stroke-width": 2 }),
      s("text", { x: 590, y: yN + 62, "text-anchor": "middle", class: "etiqueta-svg", texto: "sigmoide" }));
    const puntoSig = s("circle", { r: 5.5, fill: "var(--alto)", stroke: "var(--hoja)", "stroke-width": 2 });
    capa[3].append(puntoSig);
    const textoBruta = s("text", { x: 590, y: yN - 72, "text-anchor": "middle", class: "etiqueta-svg" });
    capa[3].append(textoBruta);
    const textoFinal = s("text", { x: 590, y: H - 18, "text-anchor": "middle", class: "texto-svg-fuerte" });
    const textoFinal2 = s("text", { x: 590, y: H - 4, "text-anchor": "middle", class: "etiqueta-svg", texto: "tras corregir los pesos de clase" });
    capa[4].append(s("line", { x1: 590, x2: 590, y1: yN + 70, y2: H - 34, stroke: "var(--tinta)", "stroke-dasharray": "3 3" }), textoFinal, textoFinal2);
    svg.append(...capa);
    const pulsos = s("g");
    svg.append(pulsos);
    const mostrar = (k) => {
      capa.forEach((c, i) => c.classList.toggle("apagada", i > k));
      pulsos.replaceChildren();
      if (k === 1 && !reducido()) aristas.forEach((a, i) => {
        const c = s("circle", { r: 3.5, class: "pulso" });
        c.appendChild(s("animateMotion", { dur: "1.1s", repeatCount: "indefinite", begin: `${i * 0.08}s`, path: a.getAttribute("d") }));
        pulsos.appendChild(c);
      });
    };
    const pintar = (e) => {
      const r = logistica(e, L);
      const maxC = Math.max(...r.contrib.map(Math.abs), 0.3);
      r.z.forEach((z, i) => {
        valoresZ[i].textContent = num(z, 2);
        aristas[i].setAttribute("stroke-width", (1 + 10 * Math.abs(r.contrib[i]) / maxC).toFixed(2));
        aristas[i].style.stroke = signoColor(r.contrib[i]);
        productos[i].textContent = `${num(L.pesos[i], 2)} × ${num(z, 2)} = ${num(r.contrib[i], 2)}`;
      });
      textoSuma.textContent = num(r.logit, 2);
      textoSesgo.textContent = `sesgo ${num(L.sesgo, 2)}`;
      puntoSig.setAttribute("cx", X(Math.max(-4, Math.min(3, r.logit)))); puntoSig.setAttribute("cy", Y(r.pBruta));
      textoBruta.textContent = `σ(${num(r.logit, 2)}) = ${pct(r.pBruta)}`;
      textoFinal.textContent = `probabilidad ${pct(r.p)}`;
    };
    const etapas = controlEtapas(["entran las 8 variables estandarizadas", "cada una se multiplica por su peso",
      "se suman con el sesgo", "la sigmoide convierte la suma en un número entre 0 y 1", "se corrige por los pesos de clase"], mostrar);
    alCambiarEstudiante(pintar);
    alVerUnaVez(svg, () => etapas.reproducir(), "0px 0px -35% 0px");
    return [etapas.caja, el("div", "desplazable", "").appendChild(svg).parentNode];
  }

  function contribuciones(L) {
    const cont = el("div");
    alCambiarEstudiante((e) => {
      const r = logistica(e, L);
      const filas = L.variables.map((v, j) => ({ etiqueta: nombre(v), valor: r.contrib[j], color: signoColor(r.contrib[j]) })).sort((a, b) => b.valor - a.valor);
      cont.replaceChildren(figura(grafBarras({ filas, min: Math.min(-1, ...filas.map((f) => f.valor)), max: Math.max(1, ...filas.map((f) => f.valor)),
        formato: (v) => num(v, 2), anchoEtiqueta: 150, etiqueta: "Aporte de cada variable a la suma" }),
        `Peso × valor estandarizado para el caso ${e.id}. Rojo empuja hacia desertar; azul, en contra. Suma de aportes ${num(r.contrib.reduce((a, b) => a + b, 0), 2)}
        + sesgo ${num(L.sesgo, 2)} = ${num(r.logit, 2)}.`));
    });
    return cont;
  }

  function curvaPerdida(L, R) {
    const pc = R.entrenamiento.info_logistica.pesos_clase;
    const cont = el("div");
    alCambiarEstudiante((e) => {
      const r = logistica(e, L);
      const ps = Array.from({ length: 98 }, (_, i) => (i + 1) / 100);
      const svg = grafLineas({
        series: [{ nombre: "si desertó (y = 1)", color: "var(--serie-2)", valores: ps.map((p) => [p, -Math.log(p) * pc.positivo]) },
                 { nombre: "si no desertó (y = 0)", color: "var(--serie-1)", valores: ps.map((p) => [p, -Math.log(1 - p) * pc.negativo]) }],
        alto: 250, xMin: 0, xMax: 1, yMin: 0, yMax: 8, xEtiqueta: "probabilidad que dio el modelo", yEtiqueta: "pérdida", formatoX: (v) => pct(v, 0), formatoY: (v) => num(v, 2),
        marcas: [{ x: r.pBruta, etiqueta: `caso ${e.id}: ${pct(r.pBruta, 0)}` }], etiqueta: "Curvas de pérdida" });
      cont.replaceChildren(figura(svg, `Si el caso ${e.id} desertó, su pérdida sería ${num(-Math.log(r.pBruta) * pc.positivo, 2)}; si no desertó,
        ${num(-Math.log(1 - r.pBruta) * pc.negativo, 2)}. Equivocarse con seguridad cuesta mucho: la curva se dispara en los extremos.`,
        leyenda([["var(--serie-2)", "si desertó, ×" + num(pc.positivo, 2)], ["var(--serie-1)", "si no desertó, ×" + num(pc.negativo, 2)]])));
    });
    return cont;
  }

  function unPaso(L, R) {
    const cfg = R.entrenamiento.config_logistica;
    const cont = el("div");
    alCambiarEstudiante((e) => {
      const r = logistica(e, L);
      const grad = r.z.map((z, j) => (r.pBruta - 1) * z + cfg.l2 * L.l2_por_variable[j] * L.pesos[j]);
      const delta = grad.map((g) => -cfg.tasa_aprendizaje * g);
      cont.innerHTML = `<div class="tabla-envoltura"><table class="tabla-paso"><thead><tr><th>Variable</th><th class="n">peso actual</th>
        <th class="n">gradiente</th><th class="n">cambio −η·gradiente</th><th class="n">peso nuevo</th><th>hacia</th></tr></thead><tbody>
        ${L.variables.map((v, j) => `<tr><td>${esc(nombre(v))}</td><td class="n">${num(L.pesos[j], 4)}</td><td class="n">${num(grad[j], 4)}</td>
          <td class="n"><strong>${delta[j] >= 0 ? "+" : ""}${num(delta[j], 4)}</strong></td><td class="n">${num(L.pesos[j] + delta[j], 4)}</td>
          <td>${Math.abs(delta[j]) < 1e-4 ? "casi nada" : delta[j] > 0 ? "sube ↑" : "baja ↓"}</td></tr>`).join("")}</tbody></table></div>`;
      aparecer(cont.querySelectorAll("tbody tr"), { pausa: 35 });
    });
    return cont;
  }

  function animacionLotes(R) {
    const n = R.datos.division.train, tam = R.entrenamiento.config_logistica.tam_lote, lotes = Math.ceil(n / tam);
    const epocas = R.entrenamiento.info_logistica.epocas_corridas;
    const W = 680, H = 130, cols = Math.ceil(lotes / 2), celda = Math.floor((W - 20) / cols);
    const svg = lienzo(W, H, `Una época recorre ${lotes} mini-lotes de ${tam} estudiantes; con cada lote se corrigen los pesos una vez.`);
    const celdas = [];
    for (let i = 0; i < lotes; i++) {
      const r = s("rect", { x: 10 + (i % cols) * celda, y: 10 + Math.floor(i / cols) * 40, width: celda - 3, height: 34, rx: 3, fill: "var(--acento)", class: "lote", opacity: 0.16 });
      celdas.push(r); svg.appendChild(r);
    }
    const texto = s("text", { x: 10, y: H - 8, class: "texto-svg-fuerte" });
    svg.appendChild(texto);
    let lote = 0, epoca = 1, intervalo = null, visible = false;
    const pintar = () => {
      celdas.forEach((c, i) => c.setAttribute("opacity", i < lote ? 0.75 : i === lote ? 1 : 0.16));
      texto.textContent = `época ${epoca} de ${epocas} · lote ${Math.min(lote + 1, lotes)} de ${lotes} · ${miles((epoca - 1) * lotes + lote + 1)} correcciones de los pesos`;
    };
    const tic = () => { lote++; if (lote >= lotes) { lote = 0; epoca = epoca >= epocas ? 1 : epoca + 1; } pintar(); };
    if (reducido()) { lote = lotes - 1; epoca = epocas; pintar(); }
    else {
      pintar();
      if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && !intervalo) intervalo = setInterval(tic, 80);
        if (!visible && intervalo) { clearInterval(intervalo); intervalo = null; }
      }).observe(svg);
    }
    return el("div", "desplazable").appendChild(svg).parentNode;
  }

  function neuronaPorEpoca(nombres, hist, mejor) {
    const W = 640, H = 330, xIn = 214, xN = 420, yN = 160, rN = 40;
    const wmax = Math.max(...hist.flatMap((h) => h.pesos.map(Math.abs)));
    const yIn = (i) => 24 + i * ((H - 48) / (nombres.length - 1));
    const svg = lienzo(W, H, "La neurona en una época del entrenamiento: el grosor de cada línea es el tamaño del peso.");
    const aristas = nombres.map((_, i) => s("line", { x1: xIn + 6, y1: yIn(i), x2: xN - rN, y2: yN, "stroke-linecap": "round", style: "transition: stroke-width 120ms linear" }));
    const valores = nombres.map((_, i) => s("text", { x: xIn - 12, y: yIn(i) + 4, "text-anchor": "end", class: "texto-svg-fuerte" }));
    nombres.forEach((n, i) => {
      svg.append(aristas[i], s("circle", { cx: xIn, cy: yIn(i), r: 5, fill: "var(--tinta-2)" }),
        s("text", { x: xIn - 62, y: yIn(i) + 4, "text-anchor": "end", class: "texto-svg", texto: nombre(n) }), valores[i]);
    });
    svg.append(s("circle", { cx: xN, cy: yN, r: rN, fill: "var(--hoja)", stroke: "var(--tinta)", "stroke-width": 2 }),
      s("text", { x: xN, y: yN + 4, "text-anchor": "middle", class: "texto-svg-fuerte", texto: "Σ → σ" }),
      s("line", { x1: xN + rN, x2: 516, y1: yN, y2: yN, stroke: "var(--tinta)", "stroke-width": 2 }),
      s("text", { x: 524, y: yN + 4, class: "texto-svg-fuerte", texto: "probabilidad" }));
    const pie = s("text", { x: xN, y: H - 6, "text-anchor": "middle", class: "etiqueta-svg" });
    svg.appendChild(pie);
    svg.actualizar = (k) => {
      const h = hist[k];
      h.pesos.forEach((w, i) => { aristas[i].setAttribute("stroke-width", (1 + 11 * Math.abs(w) / wmax).toFixed(2)); aristas[i].style.stroke = signoColor(w); valores[i].textContent = num(w, 2); });
      pie.textContent = `época ${h.epoca}: pérdida de validación ${num(h.perdida_val, 3)}, AUC ${num(h.auc_val, 3)}${h.epoca === mejor ? " (la mejor)" : ""}`;
    };
    return svg;
  }

  function pasoNeurona(c, R, modelos) {
    const L = modelos.log, e = R.entrenamiento, hist = e.historial_logistica, mejor = e.info_logistica.mejor_epoca;
    const cfg = e.config_logistica, pc = e.info_logistica.pesos_clase, co = R.control;
    const n = R.datos.division.train, lotes = Math.ceil(n / cfg.tam_lote);
    c.append(el("p", "", `La regresión logística es la red neuronal más pequeña posible: <strong>una sola neurona con ${L.variables.length} pesos y un sesgo</strong>.
      Entender cómo aprende esa neurona es entender el aprendizaje profundo, porque la red del paso siguiente hace lo mismo con muchas neuronas a la vez.`),
      selectorEstudiante());

    // Paso 4.6: control de época
    const control = el("div", "control-epoca", `<button type="button" class="boton boton-chico" data-reproducir>Reproducir</button>
      <label for="epoca" class="nota">Época</label><input type="range" id="epoca" min="0" max="${hist.length - 1}" value="${mejor - 1}"><output id="salida-epoca" for="epoca"></output>`);
    const svgN = neuronaPorEpoca(L.variables, hist, mejor);
    const curva = el("div");
    const dibujarCurva = (k) => curva.replaceChildren(figura(grafLineas({
      series: [{ nombre: "entrenamiento", color: "var(--serie-1)", valores: hist.map((h) => [h.epoca, h.perdida_train]) },
               { nombre: "validación", color: "var(--serie-2)", valores: hist.map((h) => [h.epoca, h.perdida_val]) }],
      alto: 220, xEtiqueta: "época", yEtiqueta: "pérdida promedio", formatoY: (v) => num(v, 3), marcas: [{ x: hist[k].epoca, etiqueta: `época ${hist[k].epoca}` }],
      etiqueta: "Pérdida por época" }), null, leyenda([["var(--serie-1)", "entrenamiento"], ["var(--serie-2)", "validación"]])));
    const rango = control.querySelector("input"), salida = control.querySelector("output");
    const mover = (k) => { rango.value = k; salida.value = `${hist[k].epoca} de ${hist.length}`; svgN.actualizar(k); dibujarCurva(k); };
    rango.addEventListener("input", () => mover(+rango.value));
    let anim = null;
    const reproducir = (boton) => {
      if (anim) { clearInterval(anim); anim = null; boton.textContent = "Reproducir"; return; }
      if (reducido()) { mover(hist.length - 1); return; }
      let k = 0; boton.textContent = "Pausar";
      anim = setInterval(() => { mover(k++); if (k >= hist.length) { clearInterval(anim); anim = null; boton.textContent = "Reproducir"; } }, 110);
    };
    control.querySelector("[data-reproducir]").addEventListener("click", (ev) => reproducir(ev.target));
    mover(mejor - 1);

    // Paso 4.7: early stopping con la ventana de paciencia sombreada
    const svgES = grafLineas({ series: [{ nombre: "validación", color: "var(--serie-2)", valores: hist.map((h) => [h.epoca, h.perdida_val]) }],
      alto: 220, xEtiqueta: "época", yEtiqueta: "pérdida de validación", formatoY: (v) => num(v, 3), marcas: [{ x: mejor, etiqueta: `mejor: época ${mejor}` }], etiqueta: "Early stopping" });
    const { X, Y, m, alto } = svgES.ejes;
    svgES.insertBefore(s("rect", { x: X(mejor), y: m.arr, width: X(hist.length) - X(mejor), height: alto - m.arr - m.aba, fill: "var(--medio)", opacity: 0.14 }), svgES.firstChild.nextSibling);
    svgES.appendChild(s("text", { x: (X(mejor) + X(hist.length)) / 2, y: alto - m.aba - 10, "text-anchor": "middle", class: "etiqueta-svg", texto: `${cfg.paciencia} épocas sin mejorar` }));

    // Paso 4.8: peso de la tasa de reprobación a medida que sube su L2
    const pasosT = co.pasos_tope;
    const tope = pasosT.length ? figura(grafLineas({
      series: [{ nombre: "peso de la tasa de reprobación", color: "var(--div-pos)", puntos: true,
        valores: [[0, co.antes_tope ? hist[mejor - 1].pesos[L.variables.indexOf("tasa_reprobacion")] : 0], ...pasosT.map((p, i) => [i + 1, p.peso])] }],
      alto: 200, xEtiqueta: "reentrenamiento", yEtiqueta: "peso", formatoY: (v) => num(v, 2),
      formatoX: (v) => (v === 0 ? "L2 ×1" : pasosT[v - 1] ? `×${pasosT[v - 1].multiplicador_l2}` : ""), etiqueta: "Peso de la tasa de reprobación con más L2" }),
      `Con L2 ×${pasosT.at(-1).multiplicador_l2} solo sobre ella, su peso bajó y su parte de la importancia pasó de ${pct(Math.max(...co.antes_tope.pct_train))} a ${pct(Math.max(...co.despues_tope.pct_train))}.`) : null;

    secuencia(c, 4, [
      { id: "a-numeros", titulo: "Del registro a números", nodos: [
        `La neurona solo entiende números. De los 12 campos del contrato salen <strong>${L.variables.length} variables</strong>: la tasa de reprobación
        (perdidas ÷ cursadas), sí y no como 1 y 0, y el resto tal cual. Luego cada una se <strong>estandariza</strong> con la media y la desviación de los
        ${miles(n)} estudiantes de entrenamiento, para que todas queden en la misma escala.`,
        formula("z = (x − μ) / σ", "un valor 0 es un estudiante promedio; 1, una desviación por encima"),
        tablaRasgos(L)] },
      { id: "a-neurona", titulo: "La neurona: multiplicar, sumar y convertir en probabilidad", nodos: [
        `Cada variable entra con su <strong>peso</strong>. La neurona multiplica, suma todo con un <strong>sesgo</strong> y pasa el resultado por la
        <strong>sigmoide</strong>, que lo aplasta entre 0 y 1. Use los botones para ver cada etapa con el estudiante elegido.`,
        formula("logit = b + w₁·z₁ + w₂·z₂ + … + w₈·z₈ &nbsp;&nbsp; p = 1 / (1 + e<sup>−logit</sup>)"),
        ...neuronaPorEtapas(L), contribuciones(L),
        `Durante el entrenamiento los desertores pesan más (ver 4.3), y eso infla la probabilidad. Para reportarla se resta
        ln(${num(pc.positivo, 2)} / ${num(pc.negativo, 2)}) = ${num(L.ajuste_prior, 2)} al logit: es la última etapa de la animación.`] },
      { id: "a-perdida", titulo: "La pérdida: cuánto se equivocó", nodos: [
        `Para aprender, el modelo necesita un número que diga qué tan mal le fue. Es la <strong>entropía cruzada</strong>: si el estudiante desertó y el
        modelo le dio poca probabilidad, la pérdida es grande. Como solo el ${pct(R.datos.tasa_desercion, 0)} deserta, cada desertor pesa
        ${num(pc.positivo, 2)} y cada no desertor ${num(pc.negativo, 2)}; si no, el modelo aprendería a decir que nadie deserta.`,
        formula("L = −[ y · ln p + (1 − y) · ln (1 − p) ] × peso de su clase"), curvaPerdida(L, R)] },
      { id: "a-gradiente", titulo: "El gradiente y un paso de aprendizaje", nodos: [
        `El <strong>gradiente</strong> dice, para cada peso, hacia dónde moverlo para que la pérdida baje. En una neurona sigmoide con entropía cruzada
        sale una fórmula sencilla. El paso es pequeño: la <strong>tasa de aprendizaje</strong> es η = ${cfg.tasa_aprendizaje}.`,
        formula("∂L/∂wⱼ = (p − y) · zⱼ + λ · cⱼ · wⱼ &nbsp;&nbsp; wⱼ ← wⱼ − η · ∂L/∂wⱼ", `λ = ${cfg.l2}`),
        `Así cambiarían los pesos si el estudiante elegido <strong>hubiera desertado</strong> (y = 1) y fuera el único del lote. En el entrenamiento real
        el gradiente es el promedio de ${cfg.tam_lote} estudiantes.`, unPaso(L, R)] },
      { id: "a-lotes", titulo: "Mini-lotes y épocas", nodos: [
        `Corregir con un estudiante a la vez es ruidoso; con todos a la vez, lento. Se usan <strong>mini-lotes</strong> de ${cfg.tam_lote}: los ${miles(n)}
        estudiantes de entrenamiento se barajan y se parten en ${lotes} lotes. Recorrerlos todos es una <strong>época</strong>. La neurona corrió
        ${e.info_logistica.epocas_corridas} épocas: ${miles(lotes * e.info_logistica.epocas_corridas)} correcciones de los pesos.`,
        animacionLotes(R)] },
      { id: "a-epocas", titulo: "Así se repartieron los pesos, época por época", nodos: [
        `Los pesos arrancan cerca de cero y se van separando. Mueva la época o reprodúzcala: el grosor de cada línea es el tamaño del peso; rojo sube el
        riesgo y azul lo baja.`, control, el("div", "desplazable").appendChild(svgN).parentNode, curva] },
      { id: "a-parada", titulo: "Early stopping: saber cuándo parar", nodos: [
        `Si se entrena de más, el modelo memoriza el entrenamiento y empeora con estudiantes nuevos. Por eso se mira la pérdida en
        <strong>validación</strong> (estudiantes que no usa para aprender) y, si en ${cfg.paciencia} épocas no mejora, se detiene y se queda con la mejor.`,
        figura(svgES, `Se detuvo en la época ${hist.length} y recuperó los pesos de la ${mejor}.`)] },
      { id: "a-l2", titulo: "Regularización L2 y el tope de dominancia", nodos: [
        `La <strong>regularización L2</strong> suma a la pérdida un castigo por pesos grandes, para que ninguno crezca sin control. Con ella se aplicó el
        <strong>tope de dominancia</strong>: como la tasa de reprobación se llevaba más del 35 % de la importancia, su castigo se fue duplicando hasta repartir el peso.`,
        formula("L<sub>total</sub> = L + (λ / 2) · Σ cⱼ · wⱼ²", `cⱼ = 1 para todas, ${pasosT.length ? pasosT.at(-1).multiplicador_l2 : 1} para la tasa de reprobación`), tope] },
      { id: "a-final", titulo: "Lo que aprendió", nodos: [
        figura(grafBarras({ filas: L.variables.map((v, j) => ({ etiqueta: nombre(v), valor: L.pesos[j], color: signoColor(L.pesos[j]) })).sort((a, b) => b.valor - a.valor),
          min: -0.5, max: 0.5, formato: (v) => num(v, 3), anchoEtiqueta: 150, etiqueta: "Pesos finales de la neurona" }),
          `Pesos finales. Más tasa de reprobación, trabajar y deber matrícula suben el riesgo; mejor promedio, más asistencia, estrato más alto y más créditos lo bajan.
          El semestre casi no pesa. En el paso siguiente estos pesos se convierten en puntos.`)] },
    ]);
  }

  /* ================================================================ PASO 5: la red neuronal */
  function arquitectura(M) {
    const capas = [M.variables.length, ...M.capas, 1];
    const nombres = ["Entrada", "Capa oculta 1", "Capa oculta 2", "Salida"];
    const activ = ["8 variables estandarizadas", "ReLU", "ReLU", "sigmoide"];
    const params = capas.slice(1).map((n, k) => capas[k] * n + n);
    const W = 700, H = 210, ancho = 132, gap = (W - 4 * ancho) / 3;
    const svg = lienzo(W, H, `Arquitectura ${capas.join(", ")}: ${params.reduce((a, b) => a + b)} parámetros.`);
    capas.forEach((n, k) => {
      const x = k * (ancho + gap);
      const g = s("g", {}, [
        s("rect", { x, y: 20, width: ancho, height: 120, rx: 10, fill: k === 0 || k === 3 ? "var(--papel)" : "var(--acento-suave)", stroke: "var(--acento)", "stroke-width": 1.5 }),
        s("text", { x: x + ancho / 2, y: 46, "text-anchor": "middle", class: "texto-svg-fuerte", texto: nombres[k] }),
        s("text", { x: x + ancho / 2, y: 86, "text-anchor": "middle", class: "texto-svg-fuerte", texto: `${n} ${n === 1 ? "neurona" : k === 0 ? "entradas" : "neuronas"}`, style: "font-size:17px" }),
        s("text", { x: x + ancho / 2, y: 118, "text-anchor": "middle", class: "etiqueta-svg", texto: activ[k] }),
      ]);
      if (k > 0) {
        g.appendChild(s("line", { x1: x - gap + 4, x2: x - 6, y1: 80, y2: 80, stroke: "var(--tinta)", "stroke-width": 1.5 }));
        g.appendChild(s("path", { d: `M${x - 12},74 L${x - 4},80 L${x - 12},86 z`, fill: "var(--tinta)" }));
        g.appendChild(s("text", { x: x - gap / 2, y: 168, "text-anchor": "middle", class: "etiqueta-svg", texto: `${capas[k - 1]}×${n} pesos + ${n} sesgos` }));
        g.appendChild(s("text", { x: x - gap / 2, y: 184, "text-anchor": "middle", class: "texto-svg-fuerte", texto: `${params[k - 1]} parámetros` }));
      }
      svg.appendChild(g);
    });
    alVerUnaVez(svg, () => aparecer(svg.querySelectorAll(":scope > g"), { pausa: 120, desde: "translateX(-10px)" }));
    return { svg, params, total: params.reduce((a, b) => a + b) };
  }

  function graficaRelu() {
    const W = 300, H = 170;
    const X = escala(-3, 3, 30, W - 10), Y = escala(-0.5, 3, H - 24, 10);
    const svg = lienzo(W, H, "Función ReLU: cero para valores negativos y la identidad para los positivos.");
    svg.append(s("line", { x1: X(-3), x2: X(3), y1: Y(0), y2: Y(0), stroke: "var(--renglon)" }), s("line", { x1: X(0), x2: X(0), y1: Y(-0.5), y2: Y(3), stroke: "var(--renglon)" }),
      s("path", { d: `M${X(-3)},${Y(0)} L${X(0)},${Y(0)} L${X(3)},${Y(3)}`, fill: "none", stroke: "var(--acento)", "stroke-width": 3 }),
      s("text", { x: X(-1.6), y: Y(0) - 8, "text-anchor": "middle", class: "etiqueta-svg", texto: "apagada (0)" }),
      s("text", { x: X(1.4), y: Y(2.2), "text-anchor": "end", class: "etiqueta-svg", texto: "pasa igual" }));
    return svg;
  }

  function redAnimada(M) {
    const capas = [M.variables.length, ...M.capas, 1];
    const W = 700, H = 420, xs = [190, 360, 520, 640];
    const ys = capas.map((n) => Array.from({ length: n }, (_, i) => (n === 1 ? (H - 30) / 2 : 14 + i * ((H - 50) / (n - 1)))));
    const svg = lienzo(W, H, "La red neuronal recorrida por un estudiante: cada círculo se rellena según cuánto se activa.");
    const lineas = [];
    M.W.forEach((Wk, k) => {
      const max = Math.max(...Wk.flat().map(Math.abs));
      const g = s("g", { class: "etapa", "data-capa": k + 1 });
      Wk.forEach((fila, i) => fila.forEach((w, j) => {
        if (Math.abs(w) / max < 0.08) return;
        g.appendChild(s("line", { x1: xs[k], y1: ys[k][i], x2: xs[k + 1], y2: ys[k + 1][j], stroke: signoColor(w), "stroke-opacity": (0.1 + 0.6 * Math.abs(w) / max).toFixed(2), "stroke-width": 1 }));
      }));
      lineas.push(g); svg.appendChild(g);
    });
    const nodos = capas.map((n, k) => ys[k].map((y) => {
      const c = s("circle", { cx: xs[k], cy: y, r: k === 0 ? 6 : 8, fill: "var(--acento)", "fill-opacity": 0.1, stroke: "var(--tinta)", "stroke-width": 1.5, class: "neurona-act" });
      conGlobo(c, () => c.dataset.globo || "");
      svg.appendChild(c); return c;
    }));
    M.variables.forEach((v, i) => svg.appendChild(s("text", { x: xs[0] - 12, y: ys[0][i] + 4, "text-anchor": "end", class: "texto-svg", texto: nombre(v) })));
    const textos = ["entrada", "16 ReLU", "8 ReLU", "salida"].map((t, k) => s("text", { x: xs[k], y: H - 4, "text-anchor": "middle", class: "etiqueta-svg", texto: t }));
    svg.append(...textos);
    const salidaTxt = s("text", { x: xs[3], y: ys[3][0] - 18, "text-anchor": "middle", class: "texto-svg-fuerte" });
    svg.appendChild(salidaTxt);
    const resumen = el("p", "nota");
    let actual = null;
    const mostrar = (k) => {
      if (!actual) return;
      actual.capas.forEach((a, capa) => {
        const max = Math.max(...a.map(Math.abs), 1e-9);
        nodos[capa].forEach((c, i) => {
          const visible = capa <= k;
          const v = capa === 3 ? actual.p : a[i];
          const intensidad = capa === 3 ? actual.p : Math.abs(v) / max;
          c.setAttribute("fill-opacity", visible ? (0.12 + 0.88 * intensidad).toFixed(2) : 0.06);
          c.style.fill = capa === 0 ? (v >= 0 ? "var(--div-pos)" : "var(--div-neg)") : capa === 3 ? "var(--alto)" : "var(--acento)";
          c.setAttribute("stroke-dasharray", visible && capa > 0 && capa < 3 && v === 0 ? "2 2" : "");
          c.dataset.globo = `<b>${capa === 0 ? nombre(M.variables[i]) : capa === 3 ? "salida" : `capa ${capa}, neurona ${i + 1}`}</b><br>${capa === 3 ? `probabilidad ${pct(actual.p)}` : `valor ${num(v, 3)}${capa > 0 && v === 0 ? " (apagada por ReLU)" : ""}`}`;
        });
      });
      lineas.forEach((g, i) => g.classList.toggle("apagada", i >= k));
      salidaTxt.textContent = k >= 3 ? pct(actual.p) : "";
    };
    const etapas = controlEtapas(["entran las 8 variables estandarizadas", "la primera capa oculta: 16 neuronas con ReLU",
      "la segunda capa oculta: 8 neuronas con ReLU", "la neurona de salida y la sigmoide"], mostrar);
    alCambiarEstudiante((e) => {
      actual = red(e, M);
      const act1 = actual.capas[1].filter((v) => v > 0).length, act2 = actual.capas[2].filter((v) => v > 0).length;
      resumen.textContent = `Caso ${e.id}: se activaron ${act1} de ${M.capas[0]} neuronas en la primera capa y ${act2} de ${M.capas[1]} en la segunda
        (las demás quedaron en cero por ReLU). Probabilidad final ${pct(actual.p)}.`;
      etapas.ir(3);
    });
    alVerUnaVez(svg, () => etapas.reproducir(), "0px 0px -35% 0px");
    return [etapas.caja, el("div", "desplazable").appendChild(svg).parentNode, resumen];
  }

  function diagramaBackprop() {
    const W = 700, H = 230, xs = [20, 200, 380, 560], ancho = 120;
    const svg = lienzo(W, H, "Backpropagation: el error de la salida viaja hacia atrás, capa por capa, y en cada capa da el gradiente de sus pesos.");
    const etiquetas = ["entrada", "capa 1 (16)", "capa 2 (8)", "salida"];
    xs.forEach((x, k) => svg.append(s("rect", { x, y: 80, width: ancho, height: 60, rx: 8, fill: "var(--hoja)", stroke: "var(--tinta)", "stroke-width": 1.5 }),
      s("text", { x: x + ancho / 2, y: 115, "text-anchor": "middle", class: "texto-svg-fuerte", texto: etiquetas[k] })));
    const delta = ["δ₁", "δ₂", "δ₃"], grad = ["∂W₁ = a₀ᵀ·δ₁", "∂W₂ = a₁ᵀ·δ₂", "∂W₃ = a₂ᵀ·δ₃"];
    const caminos = [];
    for (let k = 0; k < 3; k++) {
      const a = xs[k] + ancho, b = xs[k + 1];
      const ida = `M${a + 4},96 L${b - 6},96`, vuelta = `M${b - 4},124 L${a + 6},124`;
      svg.append(s("path", { d: ida, stroke: "var(--acento)", "stroke-width": 2, fill: "none" }), s("path", { d: `M${b - 12},91 L${b - 4},96 L${b - 12},101 z`, fill: "var(--acento)" }),
        s("path", { d: vuelta, stroke: "var(--alto)", "stroke-width": 2, fill: "none" }), s("path", { d: `M${a + 12},119 L${a + 4},124 L${a + 12},129 z`, fill: "var(--alto)" }),
        s("text", { x: (a + b) / 2, y: 152, "text-anchor": "middle", class: "texto-svg-fuerte", fill: "var(--alto)", texto: delta[k] }),
        s("text", { x: (a + b) / 2, y: 182, "text-anchor": "middle", class: "etiqueta-svg", texto: grad[k] }));
      caminos.push([ida, vuelta]);
    }
    svg.append(s("text", { x: 20, y: 30, class: "texto-svg-fuerte", fill: "var(--acento)", texto: "hacia adelante: calcular la probabilidad" }),
      s("text", { x: 20, y: 215, class: "texto-svg-fuerte", fill: "var(--alto)", texto: "hacia atrás: repartir el error y calcular cada gradiente" }));
    if (!reducido()) {
      const ida = `M${xs[0] + ancho},96 L${xs[3]},96`, vuelta = `M${xs[3]},124 L${xs[0] + ancho},124`;
      const p1 = s("circle", { r: 6, class: "pulso" }); p1.appendChild(s("animateMotion", { dur: "4s", repeatCount: "indefinite", path: ida, keyPoints: "0;1;1", keyTimes: "0;0.45;1", calcMode: "linear" }));
      const p2 = s("circle", { r: 6, class: "pulso-atras" }); p2.appendChild(s("animateMotion", { dur: "4s", repeatCount: "indefinite", path: vuelta, keyPoints: "0;0;1", keyTimes: "0;0.5;1", calcMode: "linear" }));
      svg.append(p1, p2);
    }
    return el("div", "desplazable").appendChild(svg).parentNode;
  }

  function animacionDropout(M) {
    const W = 520, H = 360, xs = [140, 300], capas = M.capas;
    const svg = lienzo(W, H, `Dropout: en cada lote se apaga al azar el 20 % de las neuronas ocultas.`);
    const nodos = capas.map((n, k) => Array.from({ length: n }, (_, i) => {
      const y = 14 + i * ((H - 40) / (n - 1));
      const c = s("circle", { cx: xs[k], cy: y, r: 7, fill: "var(--acento)", stroke: "var(--tinta)", "stroke-width": 1.5, class: "neurona-act" });
      svg.appendChild(c); return c;
    }));
    svg.append(s("text", { x: xs[0], y: H - 4, "text-anchor": "middle", class: "etiqueta-svg", texto: "16 ocultas" }),
      s("text", { x: xs[1], y: H - 4, "text-anchor": "middle", class: "etiqueta-svg", texto: "8 ocultas" }));
    const texto = s("text", { x: 360, y: H / 2, class: "texto-svg-fuerte" });
    const texto2 = s("text", { x: 360, y: H / 2 + 18, class: "etiqueta-svg", texto: "cambian en cada lote" });
    svg.append(texto, texto2);
    let lote = 0;
    const sortear = () => {
      lote++;
      let apagadas = 0;
      nodos.flat().forEach((c) => { const off = Math.random() < 0.2; apagadas += off; c.classList.toggle("neurona-apagada", off); });
      texto.textContent = `lote ${lote}: ${apagadas} de 24 apagadas`;
    };
    sortear();
    if (!reducido() && "IntersectionObserver" in window) {
      let intervalo = null;
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !intervalo) intervalo = setInterval(sortear, 900);
        if (!e.isIntersecting && intervalo) { clearInterval(intervalo); intervalo = null; }
      }).observe(svg);
    }
    return svg;
  }

  function redPesos(M) {
    const capas = [M.variables.length, ...M.capas, 1];
    const W = 660, H = 400, xs = [190, 340, 480, 600];
    const ys = capas.map((n) => Array.from({ length: n }, (_, i) => (n === 1 ? (H - 24) / 2 : 14 + i * ((H - 52) / (n - 1)))));
    const svg = lienzo(W, H, "La red con sus pesos reales: después de la primera capa todos son positivos.");
    M.W.forEach((Wk, k) => {
      const max = Math.max(...Wk.flat().map(Math.abs));
      Wk.forEach((fila, i) => fila.forEach((w, j) => {
        if (Math.abs(w) / max < 0.06) return;
        svg.appendChild(s("line", { x1: xs[k], y1: ys[k][i], x2: xs[k + 1], y2: ys[k + 1][j], "stroke-width": 0.6 + 2.2 * Math.abs(w) / max, stroke: signoColor(w), "stroke-opacity": (0.15 + 0.85 * Math.abs(w) / max).toFixed(2) }));
      }));
    });
    capas.forEach((n, k) => ys[k].forEach((y) => svg.appendChild(s("circle", { cx: xs[k], cy: y, r: k === 0 ? 5 : 6, fill: "var(--hoja)", stroke: "var(--tinta)", "stroke-width": 1.5 }))));
    M.variables.forEach((v, i) => {
      const sg = M.signos_entrada?.[i];
      svg.appendChild(s("text", { x: xs[0] - 12, y: ys[0][i] + 4, "text-anchor": "end", class: sg ? "texto-svg-fuerte" : "texto-svg", texto: nombre(v) + (sg ? (sg > 0 ? " (+)" : " (−)") : "") }));
    });
    return el("div", "desplazable").appendChild(svg).parentNode;
  }

  function fichas(items) {
    const d = el("div", "fichas");
    d.innerHTML = items.map(([t, v, txt]) => `<div class="ficha-metodo"><h3>${esc(t)}</h3><span class="valor-metodo">${v}</span><p>${txt}</p></div>`).join("");
    return d;
  }

  function pasoRed(c, R, modelos) {
    const M = modelos.red, e = R.entrenamiento, cfg = e.config_red, hr = e.historial_red, hl = e.historial_logistica;
    const arq = arquitectura(M);
    const W = M.W;
    const ceros = W.slice(1).reduce((a, Wk) => a + Wk.flat().filter((w) => w === 0).length, 0);
    const negativosOcultos = W.slice(1).reduce((a, Wk) => a + Wk.flat().filter((w) => w < 0).length, 0);
    const he = [M.variables.length, ...M.capas].map((n) => Math.sqrt(2 / n));
    const ev = R.evaluacion.modelos;
    c.append(el("p", "", `El aprendizaje profundo apila neuronas en <strong>capas</strong>. Cada neurona hace lo mismo que la del paso anterior
      (multiplicar, sumar, activar), pero la salida de una capa es la entrada de la siguiente. Así la red puede aprender combinaciones, como que
      trabajar pesa más cuando la asistencia es baja.`), selectorEstudiante());
    secuencia(c, 5, [
      { id: "r-capas", titulo: "De una neurona a una red", nodos: [
        `La red tiene ${M.variables.length} entradas, dos capas ocultas de ${M.capas.join(" y ")} neuronas y una neurona de salida. En total tiene
        <strong>${arq.total} parámetros</strong>, frente a los ${M.variables.length + 1} de la neurona sola.`, el("div", "desplazable").appendChild(arq.svg).parentNode] },
      { id: "r-relu", titulo: "ReLU: neuronas que se apagan", nodos: [
        el("div", "dos-columnas", ""),
      ] },
      { id: "r-recorrido", titulo: "Un estudiante atraviesa la red", nodos: [
        `Estos son los valores reales que produce la red con el estudiante elegido. Cada círculo se rellena según cuánto se activa; los punteados quedaron
        en cero por ReLU. Pase el puntero por un círculo para ver su valor.`, ...redAnimada(M)] },
      { id: "r-backprop", titulo: "Backpropagation: el error viaja hacia atrás", nodos: [
        `Con muchas capas, ¿cómo saber cuánto cambiar un peso de la primera capa? Con la <strong>regla de la cadena</strong>: el error de la salida se
        reparte hacia atrás, capa por capa. Cada capa recibe su parte del error (δ) y con ella calcula el gradiente de sus pesos.`,
        diagramaBackprop(),
        formula("δ₃ = p − y &nbsp;&nbsp; δ₂ = (δ₃ · W₃ᵀ) ⊙ [z₂ > 0] &nbsp;&nbsp; δ₁ = (δ₂ · W₂ᵀ) ⊙ [z₁ > 0]", "[z > 0] es la derivada de ReLU"),
        `Todo esto se programó a mano en NumPy. Para estar seguros de que no hay errores, el gradiente se comparó con uno calculado moviendo cada peso
        un poquito (diferencias finitas): coinciden con un error relativo de 5·10⁻⁸.`] },
      { id: "r-adam", titulo: "Adam: pasos con memoria", nodos: [
        `La neurona sola usó descenso de gradiente simple. La red usa <strong>Adam</strong>, que recuerda los gradientes anteriores: avanza más rápido en
        direcciones consistentes y más despacio donde el gradiente salta.`,
        formula("m ← β₁·m + (1 − β₁)·g &nbsp;&nbsp; v ← β₂·v + (1 − β₂)·g² &nbsp;&nbsp; w ← w − η · m̂ / (√v̂ + ε)"),
        fichas([["Tasa de aprendizaje η", num(cfg.tasa_aprendizaje, 3), "Tamaño base de cada paso."], ["β₁", "0,9", "Memoria del gradiente (impulso)."],
          ["β₂", "0,999", "Memoria del gradiente al cuadrado (escala de cada peso)."], ["Lote", `${cfg.tam_lote}`, "Estudiantes por cada paso, igual que la neurona."]])] },
      { id: "r-he", titulo: "Inicialización He", nodos: [
        `Los pesos no pueden empezar en cero: todas las neuronas aprenderían lo mismo. Se sortean de una normal con desviación √(2 / entradas), que es la
        escala adecuada para ReLU y evita que las señales se apaguen o exploten al pasar por las capas.`,
        fichas(he.map((d, k) => [`Capa ${k + 1}`, num(d, 3), `√(2 / ${[M.variables.length, ...M.capas][k]}), desviación inicial de sus pesos.`]))] },
      { id: "r-dropout", titulo: "Dropout: apagar neuronas al azar", nodos: [
        `En cada lote de entrenamiento se apaga al azar el ${pct(cfg.dropout, 0)} de las neuronas ocultas. Así la red no puede depender de un solo
        camino ni de una sola variable. Al predecir, todas se encienden.`,
        el("div", "desplazable").appendChild(animacionDropout(M)).parentNode] },
      { id: "r-control", titulo: "L2, pesos por clase y early stopping", nodos: [
        fichas([["L2", num(cfg.l2, 4), "Castigo por pesos grandes, más suave que en la neurona."], ["Pesos por clase", `${num(e.info_red.pesos_clase.positivo, 2)} y ${num(e.info_red.pesos_clase.negativo, 2)}`, "Desertores y no desertores, igual que antes."],
          ["Paciencia", `${cfg.paciencia} épocas`, `Corrió ${e.info_red.epocas_corridas} épocas y se quedó con la ${e.info_red.mejor_epoca}.`]]),
        figura(grafLineas({ series: [{ nombre: "neurona sola", color: "var(--serie-1)", valores: hl.map((h) => [h.epoca, h.auc_val]) },
          { nombre: "red neuronal", color: "var(--serie-2)", valores: hr.map((h) => [h.epoca, h.auc_val]) }],
          alto: 220, xEtiqueta: "época", yEtiqueta: "AUC en validación", formatoY: (v) => num(v, 3), etiqueta: "AUC de validación por época" }),
          "La red tarda más en aprender (tiene muchos más parámetros), pero termina un poco por encima.", leyenda([["var(--serie-1)", "neurona sola"], ["var(--serie-2)", "red neuronal"]]))] },
      { id: "r-monotonia", titulo: "Monotonía por construcción", nodos: [
        `En la primera versión, la red bajaba el riesgo en un caso raro cuando la asistencia bajaba. Las pruebas lo detectaron y se corrigió: los pesos de
        entrada de promedio (−), tasa de reprobación (+) y asistencia (−) tienen el signo fijo, y todos los pesos después de la primera capa son ≥ 0.
        Como ReLU nunca baja, la salida no puede ir en contra del sentido común en esas tres variables.`,
        redPesos(M),
        `En la red entrenada hay ${negativosOcultos} pesos negativos después de la primera capa (deben ser 0) y ${ceros} quedaron exactamente en cero por la restricción.`] },
      { id: "r-resumen", titulo: "Resumen de métodos", nodos: [
        el("div", "tabla-envoltura", `<table><thead><tr><th>Método</th><th>Neurona sola (logística)</th><th>Red neuronal</th></tr></thead><tbody>
          <tr><td>Arquitectura</td><td>${M.variables.length} → 1</td><td>${[M.variables.length, ...M.capas, 1].join(" → ")}</td></tr>
          <tr><td>Parámetros</td><td class="n">${M.variables.length + 1}</td><td class="n">${arq.total}</td></tr>
          <tr><td>Activación</td><td>sigmoide</td><td>ReLU en las ocultas, sigmoide a la salida</td></tr>
          <tr><td>Pérdida</td><td colspan="2">entropía cruzada con pesos por clase (${num(e.info_logistica.pesos_clase.positivo, 2)} / ${num(e.info_logistica.pesos_clase.negativo, 2)})</td></tr>
          <tr><td>Optimizador</td><td>descenso de gradiente, η = ${e.config_logistica.tasa_aprendizaje}</td><td>Adam, η = ${cfg.tasa_aprendizaje}</td></tr>
          <tr><td>Mini-lote</td><td colspan="2">${cfg.tam_lote} estudiantes</td></tr>
          <tr><td>Inicialización</td><td>pesos pequeños al azar</td><td>He: √(2 / entradas)</td></tr>
          <tr><td>Regularización</td><td>L2 λ = ${e.config_logistica.l2}, tope de dominancia</td><td>L2 λ = ${cfg.l2}, dropout ${pct(cfg.dropout, 0)}</td></tr>
          <tr><td>Early stopping</td><td>paciencia ${e.config_logistica.paciencia}, mejor época ${e.info_logistica.mejor_epoca}</td><td>paciencia ${cfg.paciencia}, mejor época ${e.info_red.mejor_epoca}</td></tr>
          <tr><td>Restricciones</td><td>ninguna</td><td>monotonía en promedio, tasa de reprobación y asistencia</td></tr>
          <tr><td>AUC en prueba</td><td class="n">${num(ev["regresión logística"].auc, 3)}</td><td class="n">${num(ev["red neuronal (MLP)"].auc, 3)}</td></tr>
          <tr><td>Se puede explicar con puntos</td><td>sí (tarjeta de puntaje)</td><td>solo por aproximación</td></tr></tbody></table>`),
        `Todo se implementó desde cero en NumPy y se entrenó con datos sintéticos. La red ordena un poco mejor, pero la neurona sola es la que se puede
        convertir en una tarjeta de puntaje que un consejero entiende: por eso es el modelo principal.`] },
    ]);
    // contenido de ReLU en dos columnas
    const dos = $("#r-relu .dos-columnas");
    dos.append(el("div", "cuerpo", `<p>Cada neurona oculta suma sus entradas con sus pesos y luego aplica <strong>ReLU</strong>: si la suma es negativa,
      la neurona se apaga (da 0); si es positiva, la deja pasar. Esa pequeña no linealidad es lo que permite a la red aprender curvas y combinaciones
      que una sola neurona no puede.</p><div class="formula">ReLU(z) = max(0, z)</div>`), figura(graficaRelu(), "ReLU en el intervalo de −3 a 3."));
  }

  window.SAT = Object.assign(window.SAT || {}, { pasoNeurona, pasoRed });
})();
