/* Script clásico (sin módulos). Vista Modelo (base de datos real).
   - Estudiantes: la base se lee sola y cada estudiante recibe su resultado, con el porqué y en qué mejorar.
   - Modelo: sus notas (AUC, F1, detección…) con un símbolo que dice qué significan, y cómo se entrenó.
   La página nunca recalcula el modelo: todo viene de /api/estudiantes y de reportes/real/. */
(function () {
  "use strict";
  const { $, esc, pct, num, miles, json, nombre, ACCIONES, MOTIVOS, conGlobo, s, lienzo, escala, figura, leyenda,
    grafLineas, grafBarras, aparecer, secuencia, reducido } = window.SAT;

  const NOMBRE_MODELO = { logistica: "regresión logística", red_neuronal: "red neuronal", reglas: "reglas del contrato" };
  const CLAVE_MODELO = { logistica: "regresión logística", red_neuronal: "red neuronal (MLP)", reglas: "reglas (línea base)" };
  const html = (texto) => { const d = document.createElement("div"); d.innerHTML = texto; return d; };
  const entero = (x) => num(x, 0);
  const modeloElegido = () => (document.querySelector('input[name="modelo-operacion"]:checked') || {}).value || "logistica";

  /* ================================================================== MODELO */
  /* Qué tan bueno es un valor [SUPUESTO: umbrales de uso común, se muestran en la página]. */
  const NOTAS = { excelente: ["★", "Excelente"], bueno: ["✓", "Bueno"], aceptable: ["◐", "Aceptable"], debil: ["▲", "Débil"] };
  function nota(v, [a, b, c], menorEsMejor) {
    const mejor = (x, limite) => (menorEsMejor ? x <= limite : x >= limite);
    return mejor(v, a) ? "excelente" : mejor(v, b) ? "bueno" : mejor(v, c) ? "aceptable" : "debil";
  }
  const marca = (n) => `<span class="marca marca-${n}"><i aria-hidden="true">${NOTAS[n][0]}</i>${NOTAS[n][1]}</span>`;

  function tejas(m, ev) {
    const base = 1 - ev.tasa_test, por100 = (x) => entero(100 * x);
    return [
      { clave: "auc", titulo: "AUC", sub: "qué tan bien ordena", valor: num(m.auc, 3), n: nota(m.auc, [0.9, 0.8, 0.7]), llenado: (m.auc - 0.5) / 0.5, marcas: [0.4, 0.6, 0.8],
        frase: `Entre un estudiante que desertó y uno que no, le pone más riesgo al que desertó ${por100(m.auc)} de cada 100 veces. 0,5 sería adivinar.` },
      { clave: "f1", titulo: "F1", sub: "equilibrio entre avisar y acertar", valor: num(m.f1, 2), n: nota(m.f1, [0.8, 0.65, 0.5]), llenado: m.f1, marcas: [0.5, 0.65, 0.8],
        frase: "Junta en una sola nota la detección y la precisión de abajo. Solo sube si las dos son buenas. Va de 0 a 1." },
      { clave: "recall", titulo: "Detección", sub: "recall", valor: pct(m.recall, 0), n: nota(m.recall, [0.85, 0.7, 0.5]), llenado: m.recall, marcas: [0.5, 0.7, 0.85],
        frase: `De cada 100 estudiantes que desertaron, avisó de ${por100(m.recall)}. Los otros ${por100(1 - m.recall)} se le escaparon.` },
      { clave: "precision", titulo: "Precisión", sub: "cuántos avisos eran ciertos", valor: pct(m.precision, 0), n: nota(m.precision, [0.85, 0.7, 0.5]), llenado: m.precision, marcas: [0.5, 0.7, 0.85],
        frase: `De cada 100 estudiantes que marcó en alto, ${por100(m.precision)} sí desertaron. Los otros ${por100(1 - m.precision)} fueron falsas alarmas.` },
      { clave: "accuracy", titulo: "Exactitud", sub: "accuracy", valor: pct(m.accuracy, 0), n: nota(m.accuracy - base, [0.15, 0.1, 0.05]), llenado: m.accuracy, marcas: [base],
        frase: `Acertó con ${por100(m.accuracy)} de cada 100 estudiantes. Ojo: diciendo «nadie deserta» ya acertaría ${por100(base)} (la raya).` },
      { clave: "brier", titulo: "Brier", sub: "error de la probabilidad · menor es mejor", valor: num(m.brier, 3), n: nota(m.brier, [0.1, 0.15, 0.2], true), llenado: 1 - m.brier / 0.25, marcas: [0.2, 0.4, 0.6],
        frase: "Qué tan lejos quedan sus probabilidades de lo que pasó. 0 es perfecto; 0,25 es no saber nada." },
    ];
  }

  function nodoTejas(m, ev) {
    const d = document.createElement("div");
    d.className = "tejas";
    d.innerHTML = tejas(m, ev).map((t) => `<article class="teja"><header><h3>${t.titulo}</h3><span class="teja-sub">${t.sub}</span></header>
      <div class="teja-fila"><b class="teja-valor num">${t.valor}</b>${marca(t.n)}</div>
      <div class="medidor" aria-hidden="true"><i class="medidor-${t.n}" style="width:${Math.max(0, Math.min(1, t.llenado)) * 100}%"></i>${t.marcas.map((x) => `<u style="left:${x * 100}%"></u>`).join("")}</div>
      <p>${t.frase}</p></article>`).join("");
    return d;
  }

  /* Cada cuadrito es un estudiante de prueba: así se ve cuántos aciertos y errores hubo y de qué tipo. */
  function gofre(mz) {
    const grupos = [["vp", "Avisó y sí desertó", "var(--acento)"], ["fn", "Se le escapó: no avisó y desertó", "var(--alto)"],
      ["fp", "Falsa alarma: avisó y no desertó", "var(--medio)"], ["vn", "No avisó y no desertó", "var(--renglon)"]];
    const total = grupos.reduce((a, [k]) => a + mz[k], 0), cols = 36, lado = 13, paso = lado + 3;
    const svg = lienzo(cols * paso, Math.ceil(total / cols) * paso, `De ${total} estudiantes de prueba: ${grupos.map(([k, t]) => `${mz[k]} ${t}`).join("; ")}.`);
    let i = 0;
    for (const [k, t, color] of grupos) {
      const g = s("g", {});
      for (let j = 0; j < mz[k]; j++, i++) g.appendChild(s("rect", { x: (i % cols) * paso, y: Math.floor(i / cols) * paso, width: lado, height: lado, rx: 2.5, fill: color }));
      conGlobo(g, `<b>${esc(t)}</b><br>${miles(mz[k])} estudiantes (${pct(mz[k] / total, 0)})`);
      svg.appendChild(g);
    }
    const cuenta = document.createElement("dl");
    cuenta.className = "gofre-cuenta";
    cuenta.innerHTML = grupos.map(([k, t, color]) => `<div><dt><i style="background:${color}"></i>${t}</dt><dd class="num">${miles(mz[k])}</dd></div>`).join("");
    const caja = document.createElement("div");
    caja.className = "gofre";
    caja.append(figura(svg, null), cuenta);
    return caja;
  }

  function curvaRoc(ev, elegida) {
    const nombres = Object.keys(ev.roc);
    return figura(grafLineas({
      series: [{ nombre: "adivinar", color: "var(--tenue)", punteado: true, valores: [[0, 0], [1, 1]] },
        ...nombres.map((n, i) => ({ nombre: n, color: `var(--serie-${i + 1})`, grosor: n === elegida ? 3.5 : 1.5, valores: ev.roc[n] }))],
      alto: 320, xMin: 0, xMax: 1, yMin: 0, yMax: 1, xEtiqueta: "falsas alarmas", yEtiqueta: "desertores detectados",
      formatoX: (v) => pct(v, 0), formatoY: (v) => pct(v, 0), etiqueta: "Curva ROC en prueba de los tres modelos" }),
      "Al bajar la vara para avisar se detectan más desertores, pero suben las falsas alarmas. Entre más se pegue la curva a la esquina de arriba a la izquierda, mejor. El AUC es el área bajo esa curva.",
      leyenda([...nombres.map((n, i) => [`var(--serie-${i + 1})`, n]), ["var(--tenue)", "adivinar"]]));
  }

  function comparacion(ev) {
    const M = ev.modelos, nombres = Object.keys(M);
    const metricas = [["auc", "AUC"], ["f1", "F1"], ["recall", "Detección"], ["precision", "Precisión"]];
    return figura(grafBarras({ filas: metricas.map(([k, t]) => Object.assign({ etiqueta: t }, ...nombres.map((n, i) => ({ [`m${i}`]: M[n][k] })))),
      grupos: nombres.map((n, i) => ({ clave: `m${i}`, color: `var(--serie-${i + 1})`, nombre: n })), min: 0, max: 1, formato: (v) => num(v, 2), anchoEtiqueta: 90,
      etiqueta: "AUC, F1, detección y precisión de los tres modelos" }), "Las cuatro notas van de 0 a 1 y más es mejor.",
      leyenda(nombres.map((n, i) => [`var(--serie-${i + 1})`, n])));
  }

  function reparto(d) {
    const v = d.division, total = d.n_generados, partes = [["Entrenar", v.train, "var(--acento)", "con estos aprende los pesos"],
      ["Validar", v.val, "var(--serie-3)", "con estos decide cuándo parar y dónde poner los cortes"],
      ["Probar", v.test, "var(--serie-2)", "nunca los ve: con estos se sacan las notas"], ["Descartados", d.n_descartados, "var(--renglon)", "el contrato no los deja pasar"]];
    const W = 720, H = 74, X = escala(0, total, 0, W);
    const svg = lienzo(W, H, `De ${total} estudiantes: ${partes.map(([t, n]) => `${n} para ${t.toLowerCase()}`).join(", ")}.`);
    let x = 0;
    for (const [t, n, color, para] of partes) {
      const w = X(n), g = s("g", {}, [s("rect", { x: X(x), y: 0, width: Math.max(1, w - 2), height: 34, rx: 4, fill: color })]);
      if (w > 60) { g.appendChild(s("text", { x: X(x) + 2, y: 52, class: "texto-svg-fuerte", texto: t })); g.appendChild(s("text", { x: X(x) + 2, y: 68, class: "etiqueta-svg", texto: miles(n) })); }
      conGlobo(g, `<b>${t}</b>: ${miles(n)} estudiantes<br>${para}`);
      svg.appendChild(g); x += n;
    }
    return figura(svg, `De ${miles(total)} estudiantes de la base, ${miles(d.n_descartados)} no pasan la validación del contrato. Los demás se reparten al azar, cuidando que en cada parte deserte la misma proporción (${pct(d.tasa_desercion, 0)}).`);
  }

  function curvasEntrenamiento(R, cual) {
    const en = R.entrenamiento, h = cual === "red_neuronal" ? en.historial_red : en.historial_logistica, info = cual === "red_neuronal" ? en.info_red : en.info_logistica;
    const cfg = cual === "red_neuronal" ? en.config_red : en.config_logistica;
    const tope = Math.max(...h.slice(1).map((f) => Math.max(f.perdida_train, f.perdida_val)), h[h.length - 1].perdida_val) * 1.05;
    return [figura(grafLineas({
      series: [{ nombre: "entrenamiento", color: "var(--acento)", valores: h.map((f) => [f.epoca, Math.min(f.perdida_train, tope)]) },
        { nombre: "validación", color: "var(--serie-2)", valores: h.map((f) => [f.epoca, Math.min(f.perdida_val, tope)]) }],
      marcas: [{ x: info.mejor_epoca, etiqueta: `mejor: vuelta ${info.mejor_epoca}` }], xEtiqueta: "vuelta a los datos (época)", yEtiqueta: "error (pérdida)", etiqueta: "Pérdida por época" }),
      `En cada vuelta el modelo se equivoca menos. ${info.epocas_corridas >= cfg.max_epocas
        ? `Llegó al máximo de ${cfg.max_epocas} vueltas: seguía mejorando, pero ya muy poco.`
        : `Paró solo en la vuelta ${info.epocas_corridas}, cuando llevaba ${cfg.paciencia} sin mejorar con los estudiantes de validación.`} Se quedó con los pesos de la vuelta ${info.mejor_epoca}. Tardó ${num(info.segundos, 1)} s.`,
      leyenda([["var(--acento)", "entrenamiento"], ["var(--serie-2)", "validación"]])),
    figura(grafLineas({ series: [{ nombre: "AUC en validación", color: "var(--serie-3)", valores: h.map((f) => [f.epoca, f.auc_val]) }],
      marcas: [{ x: info.mejor_epoca, etiqueta: "mejor" }], xEtiqueta: "vuelta a los datos (época)", yEtiqueta: "AUC en validación", formatoY: (v) => num(v, 3), alto: 200, etiqueta: "AUC de validación por época" }),
      "La misma historia vista con la nota AUC: sube rápido al principio y luego se aplana.")];
  }

  function ajustes(R, cual) {
    const c = cual === "red_neuronal" ? R.entrenamiento.config_red : R.entrenamiento.config_logistica;
    const items = [
      cual === "red_neuronal" ? ["Forma", `${R.dependencia.finales.length} → ${c.capas.join(" → ")} → 1`, "Entradas, dos capas ocultas de neuronas y una salida."]
        : ["Forma", `${R.dependencia.finales.length} → 1`, "Una sola neurona: un peso por variable."],
      ["Paso de aprendizaje", String(c.tasa_aprendizaje).replace(".", ","), "Qué tanto corrige los pesos en cada intento."],
      ["Lote", `${c.tam_lote} estudiantes`, "Cuántos mira antes de corregir."],
      ["Freno a los pesos (L2)", String(c.l2).replace(".", ","), "Evita que un peso crezca demasiado."],
      ...(c.dropout ? [["Dropout", pct(c.dropout, 0), "Apaga neuronas al azar para que no memorice."]] : []),
      ["Parada temprana", `${c.paciencia} vueltas`, "Si no mejora en validación, se detiene."],
    ];
    return html(`<div class="fichas">${items.map(([t, v, d]) => `<div class="ficha-metodo"><h3>${t}</h3><span class="valor-metodo">${v}</span><p>${d}</p></div>`).join("")}</div>`).firstChild;
  }

  function pesos(R, cual) {
    const imp = R.control.importancia_test, valores = cual === "red_neuronal" ? imp.red_pct : imp.logistica_pct;
    const filas = imp.variables.map((v, i) => ({ etiqueta: nombre(v), valor: valores[i] })).sort((a, b) => b.valor - a.valor);
    return figura(grafBarras({ filas, formato: (v) => pct(v, 0), grupos: [{ clave: "valor", color: "var(--acento)" }], etiqueta: "Cuánto depende el modelo de cada variable" }),
      "Se mide desordenando una variable a la vez y viendo cuánto empeora el modelo. La que más lo daña es de la que más depende.");
  }

  function nodoBase(B) {
    const f = B.fuente, etiqueta = { directo: "dato directo", aproximado: "aproximación", supuesto: "supuesto" };
    return [html(`<dl class="cifras"><div><dt>Estudiantes reales</dt><dd>${miles(B.total)}</dd></div><div><dt>Para entrenar y validar</dt><dd>${miles(B.historico)}</dd></div>
        <div><dt>En operación</dt><dd>${miles(B.operacion)}</dd></div></dl>`).firstChild,
      `<strong>${esc(f.nombre)}</strong>, ${esc(f.institucion)}. ${esc(f.descripcion)} ${esc(f.autores)}, ${esc(f.repositorio)}, <a href="${esc(f.doi)}" rel="noopener">${esc(f.doi.replace("https://", ""))}</a>, licencia ${esc(f.licencia)}.`,
      `Está montada en el servidor como una base ${esc(B.motor)} (<code>${esc(B.archivo)}</code>) que hace de registro académico. La página de <a href="estudiantes.html">estudiantes</a> la lee cada vez que se abre.`,
      html(`<details><summary>Cómo se llevó cada columna de la base al contrato</summary><div class="tabla-envoltura"><table><thead><tr><th>Dato del contrato</th><th>De dónde sale</th><th>Qué tan directo</th></tr></thead>
        <tbody>${B.mapeo.map((m) => `<tr><td>${esc(nombre(m.campo))}</td><td>${esc(m.origen)}</td><td><span class="etiqueta-mapeo ${m.tipo}">${etiqueta[m.tipo]}</span></td></tr>`).join("")}</tbody></table></div></details>`).firstChild,
      html(`<p class="aviso"><strong>Límite honesto.</strong> La base no trae asistencia, estrato ni si el estudiante trabaja: esos tres datos son aproximaciones. Y son estudiantes de Portugal, no de la universidad que use el sistema. Sirve para ver el modelo operar con personas reales, no para decidir todavía sobre sus estudiantes.</p>`).firstChild];
  }

  function pintarModelo(R, B) {
    const cual = modeloElegido(), ev = R.evaluacion, m = ev.modelos[CLAVE_MODELO[cual]], c = $("#contenido");
    c.replaceChildren();
    const nf1 = nota(m.f1, [0.8, 0.65, 0.5]);
    const entrenamiento = cual === "reglas"
      ? ["Las reglas no se entrenan: sus puntos los escribió una persona en el contrato. Por eso sirven de punto de comparación para los dos modelos que sí aprenden."]
      : [reparto(R.datos), ...curvasEntrenamiento(R, cual), ajustes(R, cual)];
    secuencia(c, "M", [
      { id: "m-veredicto", titulo: "El resultado, en una frase", nodos: [
        html(`<div class="veredicto"><b class="veredicto-cifra num">${entero(100 * m.recall)}</b><p>de cada 100 estudiantes que desertaron fueron marcados a tiempo en riesgo alto por ${cual === "reglas" ? "las" : "la"} <strong>${NOMBRE_MODELO[cual]}</strong>.
          De cada 100 avisos, ${entero(100 * m.precision)} eran ciertos. ${marca(nf1)}</p></div>`).firstChild,
        `Se midió con <strong>${miles(ev.n_test)} estudiantes reales</strong> que el modelo nunca vio al entrenar. De ellos desertó el ${pct(ev.tasa_test, 0)}.`] },
      { id: "m-notas", titulo: "Las notas del modelo", nodos: [nodoTejas(m, ev),
        html(`<p class="nota leyenda-notas">${Object.keys(NOTAS).map(marca).join(" ")} Umbrales de uso común [SUPUESTO]: AUC 0,9 / 0,8 / 0,7 · F1 0,8 / 0,65 / 0,5 · detección y precisión 85 / 70 / 50 % · exactitud 15 / 10 / 5 puntos sobre «nadie deserta» · Brier 0,10 / 0,15 / 0,20. Las rayas del medidor son esos umbrales.</p>`).firstChild] },
      { id: "m-aciertos", titulo: "Aciertos y errores, estudiante por estudiante", nodos: [
        "Cada cuadro es un estudiante de prueba. «Avisar» es ponerlo en riesgo alto.", gofre(m.matriz)] },
      { id: "m-roc", titulo: "Curva ROC", nodos: [curvaRoc(ev, CLAVE_MODELO[cual])] },
      { id: "m-comparacion", titulo: "Frente a los otros modelos", nodos: [comparacion(ev), html(`<p class="hallazgo">${esc(ev.conclusion)}</p>`).firstChild] },
      { id: "m-entrenamiento", titulo: "Cómo se entrenó", nodos: entrenamiento },
      ...(cual === "reglas" ? [] : [{ id: "m-pesos", titulo: "De qué variables depende", nodos: [pesos(R, cual)] }]),
      ...(B ? [{ id: "m-base", titulo: "La base de datos real", nodos: nodoBase(B) }] : []),
    ]);
  }

  async function iniciarModelo() {
    let R, B = null;
    try { R = await json("reportes/real/resultados.json"); } catch (e) { $("#contenido").textContent = "No se encontraron los resultados del entrenamiento con datos reales (reportes/real/resultados.json)."; return; }
    try { B = await json("reportes/real/base.json"); } catch (e) { /* la ficha de la base es opcional */ }
    document.querySelectorAll('input[name="modelo-operacion"]').forEach((r) => r.addEventListener("change", () => pintarModelo(R, B)));
    pintarModelo(R, B);
  }

  window.SAT = Object.assign(window.SAT || {}, { iniciarModelo });
})();
