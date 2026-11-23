/* Script clásico (sin módulos). Vista Modelo (base de datos real): un tablero.
   Arriba, las notas del modelo (AUC, F1, detección, precisión) con un símbolo que dice qué significan;
   debajo, las gráficas que las explican y una simulación reproducible de cómo aprendió.
   La página nunca recalcula el modelo: todo viene de reportes/real/ y de /api/estudiantes. */
(function () {
  "use strict";
  const { $, esc, pct, num, miles, json, nombre, conGlobo, s, lienzo, escala, marcasBonitas, figura, leyenda,
    grafLineas, grafBarras, aparecer, reducido } = window.SAT;

  const NOMBRE_MODELO = { logistica: "regresión logística", red_neuronal: "red neuronal", reglas: "reglas del contrato" };
  const CLAVE_MODELO = { logistica: "regresión logística", red_neuronal: "red neuronal (MLP)", reglas: "reglas (línea base)" };
  /* El color sigue al modelo, no a su posición: siempre el mismo en todas las gráficas. */
  const COLOR_MODELO = { "reglas (línea base)": "var(--serie-1)", "regresión logística": "var(--serie-2)", "red neuronal (MLP)": "var(--serie-3)" };
  const CORTO = { "reglas (línea base)": "reglas", "regresión logística": "logística", "red neuronal (MLP)": "red neuronal" };
  const entero = (x) => num(x, 0);
  const modeloElegido = () => (document.querySelector('input[name="modelo-operacion"]:checked') || {}).value || "logistica";
  const nodo = (texto) => { const d = document.createElement("div"); d.innerHTML = texto; return d.firstElementChild; };

  /* Una celda del tablero: rótulo corto, título que dice la conclusión y su contenido. */
  function celda(clases, rotulo, titulo, nodos) {
    const a = document.createElement("article");
    a.className = `celda ${clases}`;
    a.innerHTML = `${rotulo ? `<span class="rotulo">${esc(rotulo)}</span>` : ""}${titulo ? `<h2>${titulo}</h2>` : ""}`;
    for (const n of [].concat(nodos).filter(Boolean)) a.appendChild(typeof n === "string" ? Object.assign(document.createElement("p"), { innerHTML: n }) : n);
    return a;
  }

  /* ------------------------------------------------------------------ notas */
  /* Qué tan bueno es un valor [SUPUESTO: umbrales de uso común, se muestran en la página]. */
  const NOTAS = { excelente: ["★", "Excelente"], bueno: ["✓", "Bueno"], aceptable: ["◐", "Aceptable"], debil: ["▲", "Débil"] };
  function nota(v, [a, b, c], menorEsMejor) {
    const mejor = (x, limite) => (menorEsMejor ? x <= limite : x >= limite);
    return mejor(v, a) ? "excelente" : mejor(v, b) ? "bueno" : mejor(v, c) ? "aceptable" : "debil";
  }
  const marca = (n) => `<span class="marca marca-${n}"><i aria-hidden="true">${NOTAS[n][0]}</i>${NOTAS[n][1]}</span>`;
  const FORMATO = { num3: (v) => num(v, 3), num2: (v) => num(v, 2), pct: (v) => pct(v, 0), ent: (v) => entero(v) };
  /* Cifra que cuenta hacia arriba al entrar (ver contar()). */
  const cifra = (valor, forma, clase = "") => `<b class="num ${clase}" data-cuenta="${valor}" data-forma="${forma}">${FORMATO[forma](valor)}</b>`;

  function contar(raiz) {
    if (reducido()) return;
    const cifras = [...raiz.querySelectorAll("[data-cuenta]")], t0 = performance.now(), dur = 700;
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / dur), suave = 1 - Math.pow(1 - k, 3);
      for (const el of cifras) el.textContent = FORMATO[el.dataset.forma](+el.dataset.cuenta * suave);
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  function tejas(m, ev) {
    const base = 1 - ev.tasa_test, por100 = (x) => entero(100 * x);
    return {
      auc: { titulo: "AUC", sub: "qué tan bien ordena", valor: m.auc, forma: "num3", n: nota(m.auc, [0.9, 0.8, 0.7]), llenado: (m.auc - 0.5) / 0.5, marcas: [0.4, 0.6, 0.8],
        frase: `Entre uno que desertó y uno que no, le pone más riesgo al que desertó ${por100(m.auc)} de cada 100 veces. 0,5 sería adivinar.` },
      f1: { titulo: "F1", sub: "equilibrio entre avisar y acertar", valor: m.f1, forma: "num2", n: nota(m.f1, [0.8, 0.65, 0.5]), llenado: m.f1, marcas: [0.5, 0.65, 0.8],
        frase: "Junta la detección y la precisión en una sola nota de 0 a 1. Solo sube si las dos son buenas." },
      recall: { titulo: "Detección", sub: "recall", valor: m.recall, forma: "pct", n: nota(m.recall, [0.85, 0.7, 0.5]), llenado: m.recall, marcas: [0.5, 0.7, 0.85],
        frase: `De cada 100 que desertaron, avisó de ${por100(m.recall)}. Los otros ${por100(1 - m.recall)} se le escaparon.` },
      precision: { titulo: "Precisión", sub: "avisos que eran ciertos", valor: m.precision, forma: "pct", n: nota(m.precision, [0.85, 0.7, 0.5]), llenado: m.precision, marcas: [0.5, 0.7, 0.85],
        frase: `De cada 100 que marcó en alto, ${por100(m.precision)} sí desertaron. Los otros ${por100(1 - m.precision)} fueron falsas alarmas.` },
      accuracy: { titulo: "Exactitud", sub: "accuracy", valor: m.accuracy, forma: "pct", n: nota(m.accuracy - base, [0.15, 0.1, 0.05]), llenado: m.accuracy, marcas: [base],
        frase: `Acertó con ${por100(m.accuracy)} de cada 100. Ojo: diciendo «nadie deserta» ya acertaría ${por100(base)} (la raya).` },
      brier: { titulo: "Brier", sub: "error de la probabilidad · menor es mejor", valor: m.brier, forma: "num3", n: nota(m.brier, [0.1, 0.15, 0.2], true), llenado: 1 - m.brier / 0.25, marcas: [0.2, 0.4, 0.6],
        frase: "Qué tan lejos quedan sus probabilidades de lo que pasó. 0 es perfecto; 0,25 es no saber nada." },
      especificidad: { titulo: "Especificidad", sub: "tranquilos bien dejados en paz", valor: m.especificidad, forma: "pct", n: nota(m.especificidad, [0.9, 0.8, 0.65]), llenado: m.especificidad, marcas: [0.65, 0.8, 0.9],
        frase: `De cada 100 que no desertaron, a ${por100(m.especificidad)} no los molestó con una alerta alta.` },
    };
  }
  const teja = (t) => `<article class="teja"><header><h3>${t.titulo}</h3><span class="teja-sub">${t.sub}</span></header>
    <div class="teja-fila">${cifra(t.valor, t.forma, "teja-valor")}${marca(t.n)}</div>
    <div class="medidor" aria-hidden="true"><i class="medidor-${t.n}" style="transform:scaleX(${Math.max(0, Math.min(1, t.llenado))})"></i>${t.marcas.map((x) => `<u style="left:${x * 100}%"></u>`).join("")}</div>
    <p>${t.frase}</p></article>`;

  /* ------------------------------------------------------------------ gofre de aciertos */
  /* Cada cuadrito es un estudiante de prueba. Los aciertos van en colores tranquilos; los errores resaltan. */
  function gofre(mz) {
    const grupos = [["vp", "Avisó y sí desertó", "var(--acento)"], ["fn", "Se le escapó: no avisó y desertó", "var(--alto)"],
      ["fp", "Falsa alarma: avisó y no desertó", "var(--medio)"], ["vn", "No avisó y no desertó", "var(--renglon)"]];
    const total = grupos.reduce((a, [k]) => a + mz[k], 0), cols = 36, lado = 13, paso = lado + 3;
    const svg = lienzo(cols * paso, Math.ceil(total / cols) * paso, `De ${total} estudiantes de prueba: ${grupos.map(([k, t]) => `${mz[k]} ${t}`).join("; ")}.`);
    let i = 0;
    grupos.forEach(([k, t, color], g) => {
      const grupo = s("g", { class: "gofre-grupo", style: `animation-delay:${g * 160}ms` });
      for (let j = 0; j < mz[k]; j++, i++) grupo.appendChild(s("rect", { x: (i % cols) * paso, y: Math.floor(i / cols) * paso, width: lado, height: lado, rx: 2.5, fill: color }));
      conGlobo(grupo, `<b>${esc(t)}</b><br>${miles(mz[k])} estudiantes (${pct(mz[k] / total, 0)})`);
      svg.appendChild(grupo);
    });
    const cuenta = nodo(`<dl class="gofre-cuenta">${grupos.map(([k, t, color]) => `<div><dt><i style="background:${color}"></i>${t}</dt><dd>${cifra(mz[k], "ent")}</dd></div>`).join("")}</dl>`);
    const caja = document.createElement("div");
    caja.className = "gofre";
    caja.append(figura(svg, null), cuenta);
    return caja;
  }

  /* ------------------------------------------------------------------ comparación: puntos en una misma escala */
  function comparacion(ev, elegida) {
    const M = ev.modelos, nombres = Object.keys(M);
    const filas = [["auc", "AUC"], ["f1", "F1"], ["recall", "Detección"], ["precision", "Precisión"]];
    const W = 400, altoF = 46, izq = 84, der = 50, arr = 8, H = arr + filas.length * altoF + 26;
    const X = escala(0, 1, izq, W - der);
    const svg = lienzo(W, H, `AUC, F1, detección y precisión de los tres modelos, de 0 a 1. ${filas.map(([k, t]) => `${t}: ${nombres.map((n) => `${CORTO[n]} ${num(M[n][k], 2)}`).join(", ")}`).join(". ")}.`);
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      svg.appendChild(s("line", { x1: X(v), x2: X(v), y1: arr, y2: H - 22, stroke: "var(--renglon)", "stroke-dasharray": v === 0 || v === 1 ? null : "2 3" }));
      svg.appendChild(s("text", { x: X(v), y: H - 6, "text-anchor": "middle", class: "etiqueta-svg", texto: num(v, v % 0.5 ? 2 : 1) }));
    }
    filas.forEach(([k, t], i) => {
      const y = arr + i * altoF + altoF / 2, valores = nombres.map((n) => M[n][k]);
      svg.appendChild(s("text", { x: izq - 12, y: y + 4, "text-anchor": "end", class: "texto-svg-fuerte", texto: t }));
      svg.appendChild(s("line", { x1: X(Math.min(...valores)), x2: X(Math.max(...valores)), y1: y, y2: y, stroke: "var(--tenue)", "stroke-width": 2 }));
      // el elegido se dibuja de último para que quede encima
      [...nombres].sort((a, b) => (a === elegida) - (b === elegida)).forEach((n) => {
        const punto = s("circle", { cx: X(M[n][k]), cy: y, r: n === elegida ? 8 : 6, fill: COLOR_MODELO[n], stroke: "var(--hoja)", "stroke-width": 2 });
        const zona = s("circle", { cx: X(M[n][k]), cy: y, r: 14, fill: "transparent" });
        conGlobo(zona, `<b>${esc(t)}</b><br><span style="color:${COLOR_MODELO[n]}">●</span> ${esc(n)}: <b>${num(M[n][k], 3)}</b>`);
        svg.append(punto, zona);
      });
      svg.appendChild(s("text", { x: W - 4, y: y + 4, "text-anchor": "end", class: "texto-svg-fuerte", texto: num(M[elegida][k], 2) }));
    });
    return figura(svg, `La cifra de la derecha es la de ${esc(CORTO[elegida])} (el punto grande). Más a la derecha es mejor.`,
      leyenda(nombres.map((n) => [COLOR_MODELO[n], n, "punto"])));
  }

  function curvaRoc(ev, elegida) {
    const nombres = Object.keys(ev.roc);
    return figura(grafLineas({
      series: [{ nombre: "adivinar", color: "var(--tenue)", punteado: true, valores: [[0, 0], [1, 1]] },
        ...nombres.map((n) => ({ nombre: n, color: COLOR_MODELO[n], grosor: n === elegida ? 3.5 : 1.5, valores: ev.roc[n] }))],
      ancho: 520, alto: 300, xMin: 0, xMax: 1, yMin: 0, yMax: 1, xEtiqueta: "falsas alarmas", yEtiqueta: "desertores detectados",
      formatoX: (v) => pct(v, 0), formatoY: (v) => pct(v, 0), etiqueta: "Curva ROC en prueba de los tres modelos" }),
      "Al bajar la vara para avisar se detectan más desertores, pero suben las falsas alarmas. Entre más se pegue la curva a la esquina de arriba a la izquierda, mejor.",
      leyenda([...nombres.map((n) => [COLOR_MODELO[n], n]), ["var(--tenue)", "adivinar"]]));
  }

  function calibracion(ev, elegida) {
    const nombres = Object.keys(ev.calibracion);
    return figura(grafLineas({
      series: [{ nombre: "probabilidad perfecta", color: "var(--tenue)", punteado: true, valores: [[0, 0], [1, 1]] },
        ...nombres.map((n) => ({ nombre: n, color: COLOR_MODELO[n], grosor: n === elegida ? 3.5 : 1.5, puntos: n === elegida, valores: ev.calibracion[n].map((x) => [x[0], x[1]]) }))],
      ancho: 520, alto: 300, xMin: 0, xMax: 1, yMin: 0, yMax: 1, xEtiqueta: "probabilidad que dio el modelo", yEtiqueta: "los que de verdad desertaron",
      formatoX: (v) => pct(v, 0), formatoY: (v) => pct(v, 0), etiqueta: "Curva de calibración en prueba" }),
      "Si el modelo dice 30 %, ¿desertan 3 de cada 10? Cada punto es una décima parte de los estudiantes. Sobre la diagonal, la probabilidad dice la verdad.",
      leyenda([...nombres.map((n) => [COLOR_MODELO[n], n]), ["var(--tenue)", "probabilidad perfecta"]]));
  }
  /* Distancia media (ponderada) entre lo que dijo el modelo y lo que pasó, en puntos porcentuales. */
  function desvioCalibracion(puntos) {
    const total = puntos.reduce((a, p) => a + p[2], 0);
    return 100 * puntos.reduce((a, p) => a + Math.abs(p[0] - p[1]) * p[2], 0) / total;
  }

  /* ------------------------------------------------------------------ simulación del entrenamiento */
  function simulacion(R, cual) {
    const en = R.entrenamiento, red = cual === "red_neuronal";
    const h = red ? en.historial_red : en.historial_logistica, info = red ? en.info_red : en.info_logistica, cfg = red ? en.config_red : en.config_logistica;
    const N = h.length, W = 640, H = 290, m = { izq: 50, der: 16, arr: 20, aba: 40 };
    const todas = h.flatMap((f) => [f.perdida_train, f.perdida_val]);
    // Las primeras vueltas pueden tener un error enorme: se recorta arriba para que se vea la parte que importa.
    const yMax = Math.min(Math.max(...todas), Math.max(h[N - 1].perdida_train, h[N - 1].perdida_val) * 1.7), yMin = Math.min(...todas) * 0.97;
    const X = escala(1, Math.max(2, N), m.izq, W - m.der), Y = escala(yMin, yMax, H - m.aba, m.arr);
    const yDe = (v) => Y(Math.min(v, yMax));
    const svg = lienzo(W, H, `Error del modelo en cada una de las ${N} vueltas a los datos, con estudiantes de entrenamiento y de validación.`);
    const cuad = s("g", { class: "cuadricula" }), eje = s("g", { class: "eje" });
    for (const v of marcasBonitas(yMin, yMax, 4)) {
      cuad.appendChild(s("line", { x1: m.izq, x2: W - m.der, y1: Y(v), y2: Y(v) }));
      eje.appendChild(s("text", { x: m.izq - 8, y: Y(v) + 4, "text-anchor": "end", texto: num(v, 2) }));
    }
    eje.appendChild(s("line", { x1: m.izq, x2: W - m.der, y1: H - m.aba, y2: H - m.aba }));
    for (const v of marcasBonitas(1, N, 6)) if (v >= 1) eje.appendChild(s("text", { x: X(v), y: H - m.aba + 16, "text-anchor": "middle", texto: v }));
    eje.appendChild(s("text", { x: (m.izq + W - m.der) / 2, y: H - 4, "text-anchor": "middle", texto: "vuelta a los datos (época)" }));
    eje.appendChild(s("text", { x: 4, y: 11, texto: "error (pérdida)" }));
    svg.append(cuad, eje);
    const SERIES = [["perdida_train", "var(--acento)", "entrenamiento"], ["perdida_val", "var(--serie-2)", "validación"]];
    const trazo = (clave, hasta) => h.slice(0, hasta).map((f, i) => `${i ? "L" : "M"}${X(f.epoca).toFixed(1)},${yDe(f[clave]).toFixed(1)}`).join("");
    // el camino completo, tenue, y encima lo recorrido hasta la vuelta actual
    for (const [clave, color] of SERIES) svg.appendChild(s("path", { d: trazo(clave, N), fill: "none", stroke: color, "stroke-width": 1.5, opacity: 0.16 }));
    const xMejor = X(info.mejor_epoca), alFinal = xMejor > W - m.der - 120;
    svg.appendChild(s("line", { x1: xMejor, x2: xMejor, y1: m.arr, y2: H - m.aba, stroke: "var(--bajo)", "stroke-dasharray": "4 4", "stroke-width": 1.5 }));
    svg.appendChild(s("text", { x: xMejor + (alFinal ? -6 : 6), y: m.arr + 2, "text-anchor": alFinal ? "end" : "start", class: "etiqueta-svg", texto: `mejor vuelta: ${info.mejor_epoca}` }));
    const vivos = SERIES.map(([, color]) => s("path", { fill: "none", stroke: color, "stroke-width": 2.5, "stroke-linejoin": "round" }));
    const cursor = s("line", { y1: m.arr, y2: H - m.aba, stroke: "var(--tinta-2)", "stroke-width": 1 });
    const puntos = SERIES.map(([, color]) => s("circle", { r: 5, fill: color, stroke: "var(--hoja)", "stroke-width": 2 }));
    svg.append(...vivos, cursor, ...puntos);

    const caja = nodo(`<div class="simulacion">
      <div class="sim-grafica"></div>
      <div class="sim-lado">
        <dl class="sim-lecturas">
          <div class="sim-vuelta"><dt>Vuelta</dt><dd><b class="num" data-l="epoca"></b><span> de ${N}</span></dd></div>
          <div><dt><i style="background:var(--acento)"></i>Error entrenando</dt><dd class="num" data-l="train"></dd></div>
          <div><dt><i style="background:var(--serie-2)"></i>Error validando</dt><dd class="num" data-l="val"></dd></div>
          <div><dt>AUC en validación</dt><dd class="num" data-l="auc"></dd></div>
        </dl>
        <p class="sim-estado" data-l="estado" aria-live="polite"></p>
        <div class="sim-controles">
          <button type="button" class="boton boton-tinta" data-l="play">Ver cómo aprendió</button>
          <label class="oculto" for="sim-epoca">Vuelta a los datos</label>
          <input type="range" id="sim-epoca" min="1" max="${N}" step="1" value="${N}">
        </div>
      </div></div>`);
    caja.querySelector(".sim-grafica").appendChild(figura(svg, null, leyenda(SERIES.map(([, color, t]) => [color, t]))));
    const L = (k) => caja.querySelector(`[data-l="${k}"]`), rango = caja.querySelector("input"), boton = L("play");

    function pintar(e) {
      const i = Math.max(1, Math.min(N, Math.round(e))), f = h[i - 1];
      vivos.forEach((p, j) => p.setAttribute("d", trazo(SERIES[j][0], i)));
      cursor.setAttribute("x1", X(f.epoca)); cursor.setAttribute("x2", X(f.epoca));
      puntos.forEach((p, j) => { p.setAttribute("cx", X(f.epoca)); p.setAttribute("cy", yDe(f[SERIES[j][0]])); });
      L("epoca").textContent = i; L("train").textContent = num(f.perdida_train, 3); L("val").textContent = num(f.perdida_val, 3); L("auc").textContent = num(f.auc_val, 3);
      const sinMejorar = i - info.mejor_epoca;
      L("estado").innerHTML = i < info.mejor_epoca ? "Sigue aprendiendo: el error con estudiantes de validación todavía baja."
        : i === info.mejor_epoca ? "<strong>La mejor vuelta.</strong> Con estos pesos se quedó el modelo."
          : i === N && N < cfg.max_epocas ? `Paró solo: llevaba ${sinMejorar} vueltas sin mejorar en validación (el límite es ${cfg.paciencia}) y volvió a los pesos de la vuelta ${info.mejor_epoca}.`
            : `Ya no mejora en validación: lleva ${sinMejorar} ${sinMejorar === 1 ? "vuelta" : "vueltas"} sin bajar el error.`;
      rango.value = i;
    }
    let cuadro = 0;
    const detener = () => { cancelAnimationFrame(cuadro); cuadro = 0; boton.textContent = "Ver cómo aprendió"; };
    boton.addEventListener("click", () => {
      if (cuadro) { detener(); return; }
      if (reducido()) { pintar(N); return; }
      const dur = Math.max(3500, Math.min(9000, N * 45)), t0 = performance.now();
      boton.textContent = "Pausar";
      const paso = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        pintar(1 + k * (N - 1));
        if (k < 1) cuadro = requestAnimationFrame(paso); else detener();
      };
      cuadro = requestAnimationFrame(paso);
    });
    rango.addEventListener("input", () => { if (cuadro) detener(); pintar(+rango.value); });
    pintar(N);
    return { caja, N, info, cfg };
  }

  function reparto(d) {
    const v = d.division, total = d.n_generados, partes = [["Entrenar", v.train, "var(--acento)", "con estos aprende los pesos"],
      ["Validar", v.val, "var(--serie-3)", "con estos decide cuándo parar y dónde poner los cortes"],
      ["Probar", v.test, "var(--serie-2)", "nunca los ve: con estos se sacan las notas"], ["Descartados", d.n_descartados, "var(--tenue)", "el contrato no los deja pasar"]];
    const W = 720, H = 74, X = escala(0, total, 0, W);
    const svg = lienzo(W, H, `De ${total} estudiantes: ${partes.map(([t, n]) => `${n} para ${t.toLowerCase()}`).join(", ")}.`);
    let x = 0;
    for (const [t, n, color, para] of partes) {
      const w = X(n), g = s("g", {}, [s("rect", { x: X(x), y: 0, width: Math.max(1, w - 2), height: 30, rx: 4, fill: color })]);
      if (w > 64) { g.appendChild(s("text", { x: X(x) + 2, y: 48, class: "texto-svg-fuerte", texto: t })); g.appendChild(s("text", { x: X(x) + 2, y: 64, class: "etiqueta-svg", texto: miles(n) })); }
      conGlobo(g, `<b>${t}</b>: ${miles(n)} estudiantes<br>${para}`);
      svg.appendChild(g); x += n;
    }
    return figura(svg, `De ${miles(total)} estudiantes de la base, ${miles(d.n_descartados)} no pasan la validación del contrato. Los demás se reparten al azar, cuidando que en cada parte deserte la misma proporción (${pct(d.tasa_desercion, 0)}). Con «probar» se sacan todas las notas de esta página.`);
  }

  function ajustes(R, cual) {
    const c = cual === "red_neuronal" ? R.entrenamiento.config_red : R.entrenamiento.config_logistica;
    const items = [
      cual === "red_neuronal" ? ["Forma", `${R.dependencia.finales.length} → ${c.capas.join(" → ")} → 1`, "Entradas, dos capas ocultas y una salida."]
        : ["Forma", `${R.dependencia.finales.length} → 1`, "Una sola neurona: un peso por variable."],
      ["Paso de aprendizaje", String(c.tasa_aprendizaje).replace(".", ","), "Cuánto corrige los pesos en cada intento."],
      ["Lote", `${c.tam_lote}`, "Estudiantes que mira antes de corregir."],
      ["Freno a los pesos (L2)", String(c.l2).replace(".", ","), "Evita que un peso crezca demasiado."],
      ...(c.dropout ? [["Dropout", pct(c.dropout, 0), "Apaga neuronas al azar para que no memorice."]] : []),
      ["Parada temprana", `${c.paciencia} vueltas`, "Si no mejora en validación, se detiene."],
    ];
    return nodo(`<div class="fichas">${items.map(([t, v, d]) => `<div class="ficha-metodo"><h3>${t}</h3><span class="valor-metodo">${v}</span><p>${d}</p></div>`).join("")}</div>`);
  }

  /* De qué depende: importancia por GRUPO de variables correlacionadas (lo que mide el tope), con la raya del tope. */
  function dependencia(R, cual) {
    const it = R.control.importancia_test, tope = R.control.tope, red = cual === "red_neuronal";
    const porVariable = it.variables.map((v, i) => ({ v, valor: (red ? it.red_pct : it.logistica_pct)[i] })).sort((a, b) => b.valor - a.valor);
    const grupos = (it.grupos || it.variables.map((v) => ({ variables: [v], logistica_pct: it.logistica_pct[it.variables.indexOf(v)], red_pct: it.red_pct[it.variables.indexOf(v)] })))
      .map((g) => ({ etiqueta: g.variables.map(nombre).join(" + "), valor: red ? g.red_pct : g.logistica_pct, juntas: g.variables.length > 1 }))
      .sort((a, b) => b.valor - a.valor);
    for (const g of grupos) { g.color = g.valor > tope ? "var(--tinta)" : "var(--acento)"; g.detalle = g.juntas ? "se miden juntas: dicen casi lo mismo" : ""; }
    const mayor = grupos[0], cumple = mayor.valor <= tope, juntas = grupos.filter((g) => g.juntas);
    const grafica = grafBarras({ filas: grupos, formato: (v) => pct(v, 0), grupos: [{ clave: "valor", color: "var(--acento)" }], ancho: 600, anchoEtiqueta: 230,
      max: Math.max(mayor.valor, tope) * 1.08, linea: { valor: tope, etiqueta: `tope ${pct(tope, 0)}`, color: "var(--tinta-2)" },
      etiqueta: `Cuánto depende el modelo de cada grupo de variables. ${grupos.map((g) => `${g.etiqueta} ${pct(g.valor, 0)}`).join(", ")}. Tope ${pct(tope, 0)}.` });
    const frases = [
      `Se desordena un grupo de variables a la vez y se mira cuánto empeora el modelo con los ${miles(R.evaluacion.n_test)} estudiantes de prueba.`
        + (juntas.length ? ` ${juntas.map((g) => esc(g.etiqueta)).join(" y ")} se miden juntas porque dicen casi lo mismo: por separado, cada una parecería pesar poco porque la otra la suple.` : ""),
      `Por variable, la que más pesa es ${esc(nombre(porVariable[0].v))} (${pct(porVariable[0].valor, 0)}).`
        + (cumple ? "" : ` El freno se detuvo antes del tope: bajarlo más hacía que el modelo adivinara peor que la ${esc(nombre((R.evaluacion.una_variable || {}).mejor || porVariable[0].v))} sola.`),
    ];
    const titulo = cumple ? `Ningún grupo pasa del tope de ${pct(tope, 0)}: el que más pesa es ${esc(mayor.etiqueta)} (${pct(mayor.valor, 0)})`
      : `No se cumple el tope: ${esc(mayor.etiqueta)} pesa ${pct(mayor.valor, 0)} (tope ${pct(tope, 0)})`;
    return { titulo, figura: figura(grafica, frases.join(" ")) };
  }

  /* La nota honesta: sin los casos evidentes (no aprobó nada) y frente a la mejor variable sola. */
  function honestas(R, clave) {
    const ev = R.evaluacion, se = ev.sin_evidentes, u = ev.una_variable, m = ev.modelos[clave];
    const ms = se ? se.modelos[clave] : null;
    const filas = [["AUC", m.auc, ms && ms.auc, (v) => num(v, 3)], ["F1", m.f1, ms && ms.f1, (v) => num(v, 2)],
      ["Detección", m.recall, ms && ms.recall, (v) => pct(v, 0)], ["Precisión", m.precision, ms && ms.precision, (v) => pct(v, 0)]];
    if (u) filas.push([`AUC de la ${nombre(u.mejor)} sola`, u.auc_mejor, u.sin_evidentes && u.sin_evidentes.auc_mejor, (v) => num(v, 3)]);
    const tabla = nodo(`<div class="tabla-envoltura"><table class="tabla-honesta"><thead><tr><th></th><th>Con todos</th>${ms ? "<th>Sin evidentes</th>" : ""}</tr></thead>
      <tbody>${filas.map(([t, a, b, f]) => `<tr><th scope="row">${esc(t)}</th><td class="num">${f(a)}</td>${ms ? `<td class="num">${b == null ? "–" : f(b)}</td>` : ""}</tr>`).join("")}</tbody></table></div>`);
    const gana = u ? m.auc - u.auc_mejor : null, ganaSin = u && ms && u.sin_evidentes ? ms.auc - u.sin_evidentes.auc_mejor : null;
    const ev_ = ev.evidentes;
    const texto = [
      ev_ ? `Casos evidentes: los ${miles(ev_.n)} de prueba que no aprobaron ninguna asignatura. Aquí no lo son tanto: de ellos abandonó el ${pct(ev_.tasa, 0)}. Sin ellos quedan ${miles(se.n)} y abandona el ${pct(se.tasa, 0)}; esa es la nota honesta.` : "",
      u ? `${gana > 0 ? "Le gana" : "No le gana"} a la ${esc(nombre(u.mejor))} sola por ${num(Math.abs(gana), 3)} de AUC${ganaSin != null ? ` (${num(Math.abs(ganaSin), 3)} sin los evidentes)` : ""}: es lo que aporta usar todas las variables.` : "",
    ].filter(Boolean).map((t) => `<p class="nota">${t}</p>`).join("");
    const titulo = ms ? `Sin los casos evidentes, AUC ${num(ms.auc, 3)} y F1 ${num(ms.f1, 2)}` : `AUC ${num(m.auc, 3)}`;
    return { titulo, nodos: [tabla, nodo(`<div>${texto}</div>`)] };
  }

  /* Cada variable sola contra el modelo, con todos y sin los casos evidentes (AUC desde 0,5 = adivinar). */
  function unaVariable(R, clave) {
    const ev = R.evaluacion, u = ev.una_variable;
    if (!u) return null;
    const se = ev.sin_evidentes, conSin = Boolean(se && u.sin_evidentes);
    const filas = [{ etiqueta: `el modelo (${CORTO[clave]})`, todos: ev.modelos[clave].auc, sin: conSin ? se.modelos[clave].auc : 0 },
      ...u.variables.map((v, i) => ({ etiqueta: `${nombre(v)} sola`, todos: u.auc[i], sin: conSin ? u.sin_evidentes.auc[i] : 0 }))
        .sort((a, b) => b.todos - a.todos)];
    const grupos = [{ clave: "todos", color: "var(--acento)", nombre: "con todos" }, ...(conSin ? [{ clave: "sin", color: "var(--serie-2)", nombre: "sin los evidentes" }] : [])];
    const g = grafBarras({ filas, grupos, min: 0.5, max: Math.max(...filas.map((f) => Math.max(f.todos, f.sin))) + 0.03, formato: (v) => num(v, 3), ancho: 600, anchoEtiqueta: 200,
      etiqueta: `AUC del modelo y de cada variable usada sola. ${filas.map((f) => `${f.etiqueta} ${num(f.todos, 3)}`).join(", ")}.` });
    return figura(g, "Cada variable se usa sola como puntaje (más alta, más riesgo, o al revés). La barra empieza en 0,5, que es adivinar.",
      leyenda(grupos.map((x) => [x.color, x.nombre])));
  }

  /* ------------------------------------------------------------------ modelo de ingreso y base */
  let ingresoCache;  // undefined = sin consultar; null = no respondió
  async function pintarIngreso(destino) {
    if (ingresoCache === undefined) {
      try { const d = await json("api/estudiantes?modelo=logistica"); ingresoCache = d.ingreso ? { m: d.ingreso, n: (d.ejecucion || {}).provisionales } : null; }
      catch (e) { ingresoCache = null; }
    }
    if (!destino.isConnected) return;
    if (!ingresoCache) { destino.innerHTML = `<p>Usa solo datos de la matrícula (nota de acceso, opción en que eligió la titulación, dedicación y créditos). No se pudieron consultar sus notas en este momento.</p>`; return; }
    const g = ingresoCache.m;
    destino.innerHTML = `<div class="ingreso-notas"><div><span class="rotulo">AUC</span>${cifra(g.auc, "num3")}${marca(nota(g.auc, [0.9, 0.8, 0.7]))}</div>
      <div><span class="rotulo">F1</span>${cifra(g.f1, "num2")}${marca(nota(g.f1, [0.8, 0.65, 0.5]))}</div></div>
      <p>${ingresoCache.n ? `Hoy califica a <strong>${miles(ingresoCache.n)} estudiantes</strong> que el contrato no puede calificar (sin notas del primer cuatrimestre o con un dato que no acepta). ` : "Hoy no hay ningún estudiante que lo necesite. "}Usa solo datos de la matrícula (nota de acceso, opción en que eligió la titulación, dedicación y créditos), así que es más débil que el modelo principal: su resultado se marca como provisional. Medido con ${miles(g.n_prueba)} estudiantes que no vio.</p>`;
    contar(destino);
  }

  function nodoBase(B) {
    const f = B.fuente, etiqueta = { directo: "dato directo", aproximado: "aproximación", supuesto: "supuesto" };
    return [nodo(`<p class="aviso"><strong>Límite honesto.</strong> ${esc(B.limite || "")}</p>`),
      nodo(`<details class="base-detalle"><summary>De dónde salen los datos y cómo se llevó cada columna al contrato</summary>
        <dl class="cifras"><div><dt>Estudiantes reales</dt><dd>${miles(B.total)}</dd></div><div><dt>Para entrenar y validar</dt><dd>${miles(B.historico)}</dd></div><div><dt>En operación</dt><dd>${miles(B.operacion)}</dd></div></dl>
        <p><strong>${esc(f.nombre)}</strong>, ${esc(f.institucion)}. ${esc(f.descripcion)} ${esc(f.autores)}, ${esc(f.repositorio)}, <a href="${esc(f.doi)}" rel="noopener">${esc(f.doi.replace("https://", ""))}</a>, licencia ${esc(f.licencia)}.${f.poblacion ? ` ${esc(f.poblacion)}` : ""}</p>
        ${B.etiqueta ? `<p><strong>Qué letra es abandono.</strong> La fuente marca el abandono con «A» o «B» sin decir cuál es cuál. ${esc(B.etiqueta)}</p>` : ""}
        ${B.muestra ? `<p>En operación se muestra una muestra estratificada (semilla fija) de ${miles(B.operacion)}; los otros ${miles(B.reserva)} quedan en reserva para que la respuesta no pese demasiado.</p>` : ""}
        <p>Está montada en el servidor como una base ${esc(B.motor)} (<code>${esc(B.archivo)}</code>) que hace de registro académico. La página de <a href="estudiantes.html">estudiantes</a> la lee cada vez que se abre.</p>
        <div class="tabla-envoltura"><table><thead><tr><th>Dato del contrato</th><th>De dónde sale</th><th>Qué tan directo</th></tr></thead>
        <tbody>${B.mapeo.map((x) => `<tr><td>${esc(nombre(x.campo))}</td><td>${esc(x.origen)}</td><td><span class="etiqueta-mapeo ${x.tipo}">${etiqueta[x.tipo]}</span></td></tr>`).join("")}</tbody></table></div></details>`)];
  }

  /* ------------------------------------------------------------------ el tablero */
  function pintarModelo(R, B) {
    const cual = modeloElegido(), ev = R.evaluacion, clave = CLAVE_MODELO[cual], m = ev.modelos[clave], c = $("#contenido");
    const T = tejas(m, ev), mz = m.matriz, total = mz.vp + mz.fp + mz.fn + mz.vn;
    const nombres = Object.keys(ev.modelos), mejorF1 = nombres.reduce((a, b) => (ev.modelos[b].f1 > ev.modelos[a].f1 ? b : a));
    const articulo = cual === "reglas" ? "las" : "la";
    c.replaceChildren();

    // 1. Lo primero que se ve: el veredicto y las cuatro notas.
    const veredicto = celda("c5 f2 celda-tinta celda-veredicto", `Con ${miles(ev.n_test)} estudiantes reales que nunca vio`, null, [
      nodo(`<div class="veredicto-cifra">${cifra(100 * m.recall, "ent", "cifra-grande")}<span>de cada 100</span></div>`),
      nodo(`<p class="veredicto-frase">estudiantes que desertaron fueron marcados a tiempo en riesgo alto por ${articulo} <strong>${NOMBRE_MODELO[cual]}</strong>.</p>`),
      nodo(`<p class="veredicto-frase">De cada 100 avisos, <strong>${entero(100 * m.precision)}</strong> eran ciertos. En total desertó el ${pct(ev.tasa_test, 0)} de los ${miles(ev.n_test)}.</p>`),
      nodo(`<p class="veredicto-nota">Nota general (F1) ${marca(T.f1.n)}</p>`)]);
    const notas = celda("c7 f2 celda-lisa celda-notas", null, null, [
      nodo(`<div class="tejas">${["auc", "f1", "recall", "precision"].map((k) => teja(T[k])).join("")}</div>`),
      nodo(`<details class="mas-notas"><summary>Ver 3 notas más y cómo se leen los símbolos</summary>
        <div class="tejas tejas-3">${["accuracy", "brier", "especificidad"].map((k) => teja(T[k])).join("")}</div>
        <p class="nota leyenda-notas">${Object.keys(NOTAS).map(marca).join(" ")} Umbrales de uso común [SUPUESTO]: AUC 0,9 / 0,8 / 0,7 · F1 0,8 / 0,65 / 0,5 · detección y precisión 85 / 70 / 50 % · exactitud 15 / 10 / 5 puntos sobre «nadie deserta» · Brier 0,10 / 0,15 / 0,20 · especificidad 90 / 80 / 65 %. Las rayas de cada medidor son esos umbrales.</p></details>`)]);

    // 2. Las dos preguntas honestas: de qué depende y cuánto vale sin los casos evidentes.
    const hon = honestas(R, clave);
    const celdas = [veredicto, notas];
    if (cual !== "reglas") {
      const dep = dependencia(R, cual);
      celdas.push(celda("c7 celda-dependencia", "De qué depende", dep.titulo, [dep.figura]));
    }
    celdas.push(celda(cual === "reglas" ? "c12" : "c5", "La nota honesta", hon.titulo, hon.nodos));
    celdas.push(
      celda("c7", "Aciertos y errores", `Acertó con ${miles(mz.vp + mz.vn)} de ${miles(total)} estudiantes`, ["Cada cuadro es un estudiante de prueba. «Avisar» es ponerlo en riesgo alto.", gofre(mz)]),
      celda("c5", "Frente a los otros", mejorF1 === clave ? `Es el de mejor equilibrio (F1 ${num(m.f1, 2)})` : `El mejor equilibrio lo tiene la ${esc(CORTO[mejorF1])} (F1 ${num(ev.modelos[mejorF1].f1, 2)})`, [comparacion(ev, clave)]),
      celda("c6", "Curva ROC", `Ordena bien a ${entero(100 * m.auc)} de cada 100 parejas (AUC ${num(m.auc, 3)})`, [curvaRoc(ev, clave)]),
      celda("c6", "Calibración", `Sus probabilidades se desvían ${num(desvioCalibracion(ev.calibracion[clave]), 1)} puntos de lo que pasó`, [calibracion(ev, clave)]));

    // 3. Cómo aprendió.
    if (cual === "reglas") {
      celdas.push(celda("c12", "Cómo se entrenó", "Las reglas no se entrenan", [
        "Sus puntos los escribió una persona en el contrato: tantos por promedio bajo, tantos por materias reprobadas, tantos por deuda. No hay vueltas a los datos ni pesos que aprender.",
        "Por eso sirven de punto de comparación: si un modelo que aprende no les gana, no vale la pena la complejidad. Elija arriba la regresión logística o la red neuronal para ver cómo aprendieron."]));
    } else {
      const sim = simulacion(R, cual);
      const como = sim.N >= sim.cfg.max_epocas ? `Dio las ${sim.N} vueltas permitidas a los datos` : `Aprendió en ${sim.N} vueltas a los datos y paró solo`;
      celdas.push(celda("c12 celda-entrenamiento", "Cómo se entrenó", `${como}; la mejor fue la ${sim.info.mejor_epoca}`, [
        `En cada vuelta mira a los ${miles(R.datos.division.train)} estudiantes de entrenamiento, mide cuánto se equivoca y corrige sus pesos. Reprodúzcalo o mueva la barra para ver cualquier vuelta. Tardó ${num(sim.info.segundos, 1)} s.`,
        sim.caja,
        nodo(`<details class="mas-notas"><summary>Con qué datos y con qué ajustes</summary></details>`)]));
      const det = celdas[celdas.length - 1].querySelector("details");
      det.append(reparto(R.datos), ajustes(R, cual));
    }
    const una = unaVariable(R, clave);
    if (una) {
      const u = ev.una_variable, gana = m.auc - u.auc_mejor;
      celdas.push(celda("c7", "Frente a una sola variable", gana > 0 ? `Le gana a la mejor variable sola por ${num(gana, 3)} de AUC` : `No le gana a la mejor variable sola (${esc(nombre(u.mejor))})`, [una]));
    }

    // 4. El modelo de ingreso (provisional) y la base.
    const ingreso = celda(una ? "c5" : "c12", "Modelo de ingreso", "Para quien el contrato no puede calificar: un resultado provisional", [nodo(`<div class="ingreso"><p class="nota">Consultando sus notas…</p></div>`)]);
    celdas.push(ingreso);
    if (B) celdas.push(celda("c12 celda-base", "La base de datos real", `${miles(B.total)} estudiantes reales de la ${esc(B.fuente.institucion)}`, nodoBase(B)));
    c.append(...celdas);
    aparecer(c.children, { pausa: 50, duracion: 300 });
    contar(c);
    pintarIngreso(ingreso.querySelector(".ingreso"));
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
