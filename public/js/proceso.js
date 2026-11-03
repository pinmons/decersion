/* Script clásico (sin módulos) para que la página funcione también abierta como archivo. */
(function () {
  "use strict";
  const { $, esc, pct, num, miles, nombre, s, lienzo, escala, figura, leyenda, conGlobo, grafLineas, grafBarras, json,
    crearRecorrido } = window.SAT;
  /* "Cómo se construyó": ocho pasos, cada uno con su explicación visual hecha con los datos reales. */

  const p = (html) => { const e = document.createElement("p"); e.innerHTML = html; return e; };
  const div = (clase, hijos = []) => { const d = document.createElement("div"); d.className = clase; hijos.forEach((h) => h && d.appendChild(h)); return d; };
  const html = (cadena) => { const t = document.createElement("template"); t.innerHTML = cadena.trim(); return t.content.firstElementChild; };
  const desplazable = (el) => div("desplazable", [el]);
  const signoColor = (w) => (w >= 0 ? "var(--div-pos)" : "var(--div-neg)");

  /* ================================================================== 1. contrato */
  function pasoContrato(c) {
    const fig = document.createElement("figure");
    fig.className = "grafica";
    const lugar = document.createElement("div");
    lugar.className = "recorrido";
    fig.appendChild(lugar);
    crearRecorrido(lugar);
    fig.appendChild(html(`<figcaption>Las cuatro revisiones van en este orden y la primera que falla termina el proceso. En la página
      <a href="evaluar.html">Evaluar</a>, este mismo diagrama se ilumina con el camino de cada estudiante.</figcaption>`));
    const texto = div("cuerpo", [
      p("El contrato es la parte que no cambia entre modos. Fija los 12 datos que entran, en qué orden se revisan y qué responde el sistema en cada caso."),
      p("<strong>Formato antes que población.</strong> Un dato roto (un semestre escrito como texto, un promedio de 38) se rechaza para que se corrija en el origen. No se adivina."),
      p("<strong>Población antes que faltantes.</strong> Si ya se sabe que el estudiante es de posgrado o está retirado, no tiene sentido pedirle más datos."),
      p("<strong>Abstenerse también es una respuesta.</strong> Con un dato faltante o contradictorio, el sistema no decide: le pasa el caso a una persona."),
      p("El modelo aprendido <strong>solo reemplaza el puntaje y los cortes</strong>. La validación, la regla R3.4 y las garantías son las mismas: nunca lanza una excepción, nunca inventa un dato y nunca califica a alguien fuera de la población."),
    ]);
    c.append(div("dos-columnas", [texto, fig]));
  }

  /* ================================================================== 2. datos */
  function diagramaFabrica() {
    const W = 760, H = 300;
    const svg = lienzo(W, H, "Cómo se generó cada estudiante simulado: dos factores ocultos producen las variables, y una función distinta de las reglas produce la probabilidad de desertar.");
    svg.appendChild(s("defs", {}, [s("marker", { id: "punta-fab", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, markerUnits: "userSpaceOnUse", orient: "auto" }, [s("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--tenue)" })])]));
    const flecha = (x1, y1, x2, y2, extra = {}) => svg.appendChild(s("path", { d: `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`, fill: "none", stroke: "var(--tenue)", "stroke-width": 1.3, "marker-end": "url(#punta-fab)", ...extra }));
    const latentes = [{ id: "S", t: "Socioeconómico", y: 80 }, { id: "A", t: "Académico", y: 210 }];
    const vars = [["estrato", "S"], ["trabaja", "S"], ["deuda", "S"], ["promedio", "A"], ["reprobadas", "A"], ["asistencia", "A"], ["créditos", "A"]];
    const yVar = (i) => 22 + i * 38;
    vars.forEach(([v, f], i) => flecha(150, latentes.find((l) => l.id === f).y, 268, yVar(i) + 13));
    vars.forEach((_, i) => flecha(400, yVar(i) + 13, 506, 150));
    latentes.forEach((l) => {
      svg.appendChild(s("circle", { cx: 100, cy: l.y, r: 46, fill: "var(--acento-suave)", stroke: "var(--acento)", "stroke-width": 1.5 }));
      svg.appendChild(s("text", { x: 100, y: l.y - 4, "text-anchor": "middle", class: "texto-svg-fuerte", texto: `Factor ${l.id}` }));
      svg.appendChild(s("text", { x: 100, y: l.y + 13, "text-anchor": "middle", class: "etiqueta-svg", texto: l.t }));
    });
    svg.appendChild(s("line", { x1: 100, x2: 100, y1: 128, y2: 162, stroke: "var(--acento)", "stroke-dasharray": "3 3" }));
    svg.appendChild(s("text", { x: 108, y: 149, class: "etiqueta-svg", texto: "r = 0,30" }));
    vars.forEach(([v], i) => {
      svg.appendChild(s("rect", { x: 270, y: yVar(i), width: 128, height: 26, rx: 5, fill: "var(--hoja)", stroke: "var(--renglon)" }));
      svg.appendChild(s("text", { x: 334, y: yVar(i) + 17, "text-anchor": "middle", class: "texto-svg", texto: v }));
    });
    svg.appendChild(s("rect", { x: 508, y: 104, width: 120, height: 92, rx: 8, fill: "var(--hoja)", stroke: "var(--tinta)", "stroke-width": 1.5 }));
    [["Función latente z", "texto-svg-fuerte", 126], ["no lineal", "etiqueta-svg", 146], ["con interacciones", "etiqueta-svg", 161], ["y ruido N(0; 0,6)", "etiqueta-svg", 176]]
      .forEach(([t, cl, y]) => svg.appendChild(s("text", { x: 568, y, "text-anchor": "middle", class: cl, texto: t })));
    flecha(628, 150, 664, 150);
    svg.appendChild(s("rect", { x: 666, y: 118, width: 86, height: 64, rx: 8, fill: "var(--alto-fondo)", stroke: "var(--alto)", "stroke-width": 1.5 }));
    svg.appendChild(s("text", { x: 709, y: 144, "text-anchor": "middle", class: "texto-svg-fuerte", texto: "¿desertó?" }));
    svg.appendChild(s("text", { x: 709, y: 162, "text-anchor": "middle", class: "etiqueta-svg", texto: "sí con prob. p" }));
    svg.appendChild(s("text", { x: 568, y: 226, "text-anchor": "middle", class: "etiqueta-svg", texto: "no usa las reglas" }));
    svg.appendChild(s("text", { x: 568, y: 240, "text-anchor": "middle", class: "etiqueta-svg", texto: "del contrato" }));
    return svg;
  }

  function embudo(d) {
    const W = 760, H = 190, izq = 150, der = 14;
    const svg = lienzo(W, H, `De ${miles(d.n_generados)} registros generados, ${d.n_descartados} los descartó el Paso 1; los ${miles(d.n_validos)} válidos se dividieron en entrenamiento, validación y prueba.`);
    const X = escala(0, d.n_generados, izq, W - der);
    const fila = (y, etiqueta, sub) => {
      svg.appendChild(s("text", { x: izq - 10, y: y + 15, "text-anchor": "end", class: "texto-svg-fuerte", texto: etiqueta }));
      svg.appendChild(s("text", { x: izq - 10, y: y + 30, "text-anchor": "end", class: "etiqueta-svg", texto: sub }));
    };
    const seg = (x0, ancho, y, alto, color, globo, texto, opacidad = 1) => {
      const r = s("rect", { x: x0, y, width: Math.max(1.5, ancho - 2), height: alto, rx: 2, fill: color, opacity: opacidad });
      conGlobo(r, globo); svg.appendChild(r);
      if (texto && ancho > 70) svg.appendChild(s("text", { x: x0 + 8, y: y + alto / 2 + 4, class: "texto-svg", texto, fill: "var(--hoja)" }));
    };
    fila(10, "Generados", `${miles(d.n_generados)} registros`);
    seg(X(0), X(d.n_validos) - X(0), 10, 34, "var(--acento)", `<b>Válidos</b><br>${miles(d.n_validos)} pasan el Paso 1`, `${miles(d.n_validos)} válidos`);
    let x = X(d.n_validos);
    for (const [motivo, n] of Object.entries(d.descartes_por_motivo)) {
      const w = X(n) - X(0);
      seg(x, w + 2, 10, 34, motivo.startsWith("error") ? "var(--alto)" : "var(--humano)", `<b>Descartado: ${esc(motivo)}</b><br>${n} registros`);
      x += w;
    }
    svg.appendChild(s("text", { x: W - der, y: 60, "text-anchor": "end", class: "etiqueta-svg", texto: `${d.n_descartados} descartados por el Paso 1 (en rojo, error; en violeta, abstención)` }));
    fila(92, "División", "70 / 15 / 15 %");
    const Xv = escala(0, d.n_validos, izq, W - der);
    let x0 = Xv(0);
    for (const [clave, nombre_] of [["train", "entrenamiento"], ["val", "validación"], ["test", "prueba"]]) {
      const n = d.division[clave], tasa = d.division[`tasa_${clave}`];
      const w = Xv(n) - Xv(0);
      seg(x0, w * (1 - tasa), 92, 34, "var(--serie-1)", `<b>${nombre_}</b><br>${miles(n)} estudiantes; ${pct(tasa)} desertan`);
      svg.appendChild(s("text", { x: x0, y: 142, class: "texto-svg-fuerte", texto: nombre_ }));
      svg.appendChild(s("text", { x: x0, y: 156, class: "etiqueta-svg", texto: miles(n) }));
      seg(x0 + w * (1 - tasa), w * tasa, 92, 34, "var(--serie-2)", `<b>${nombre_}: desertan</b><br>${miles(Math.round(n * tasa))} estudiantes (${pct(tasa)})`);
      x0 += w;
    }
    svg.appendChild(s("text", { x: izq, y: 182, class: "etiqueta-svg", texto: "La división es estratificada: en los tres conjuntos deserta el mismo porcentaje. La prueba no se tocó hasta el paso 7." }));
    return svg;
  }

  function pasoDatos(c, R) {
    const d = R.datos;
    c.append(
      p(`No hay registros reales de estudiantes con la etiqueta de si desertaron, así que se simularon. Lo delicado es no
        generar la etiqueta con las mismas reglas que se quieren aprender: el modelo solo se copiaría a sí mismo.`),
      figura(desplazable(diagramaFabrica()), `Cada estudiante sale de dos factores ocultos. Por eso las variables vienen
        correlacionadas como en la vida real (un promedio bajo va con más materias perdidas; un estrato bajo, con más trabajo y deuda),
        y la deserción se sortea con una función que no tiene los escalones de las reglas.`),
      html(`<dl class="cifras">
        <div><dt>Estudiantes válidos</dt><dd>${miles(d.n_validos)}</dd></div>
        <div><dt>Desertan en la simulación</dt><dd>${pct(d.tasa_desercion)}</dd></div>
        <div><dt>Descartados por el Paso 1</dt><dd>${d.n_descartados}</dd></div>
        <div><dt>Techo de AUC posible</dt><dd>${num(d.auc_techo_test, 3)}</dd></div></dl>`),
      figura(desplazable(embudo(d)), `Los ${d.n_descartados} registros con defectos a propósito (faltantes, tipos malos, otra población,
        contradicciones) pasaron por la misma validación del contrato y ninguno entró al entrenamiento. El techo de AUC es lo mejor que
        podría lograr un modelo perfecto: el resto es ruido de la simulación.`),
      html(`<details><summary>Ver las distribuciones y la fórmula de la etiqueta</summary>
        <p class="nota">Fórmula [SUPUESTO]: <code>${esc(d.formula_latente)}</code></p>
        <figure class="figura-png"><img src="reportes/distribuciones.png" alt="Histogramas de promedio, asistencia, tasa de reprobación y créditos por si el estudiante desertó, y tasas de deserción por estrato, semestre, trabajo y deuda" loading="lazy" width="1680" height="768"></figure></details>`),
    );
  }

  /* ================================================================== 3. variables */
  function mapaCalor(dep) {
    const nombres = dep.candidatas, n = nombres.length, P = dep.antes.pearson, S = dep.antes.spearman;
    const quitadas = new Set(dep.decisiones.map((x) => x.se_quita));
    const celda = 44, izq = 196, arr = 8, abajo = 150;
    const W = izq + n * celda + 90, H = arr + n * celda + abajo;
    const svg = lienzo(W, H, "Matriz de correlación de Pearson entre las diez variables candidatas, en datos de entrenamiento.");
    nombres.forEach((a, i) => {
      const et = nombre(a) + (quitadas.has(a) ? " (quitada)" : "");
      svg.appendChild(s("text", { x: izq - 8, y: arr + i * celda + celda / 2 + 4, "text-anchor": "end", class: quitadas.has(a) ? "etiqueta-svg" : "texto-svg", texto: et }));
      svg.appendChild(s("text", { x: 0, y: 0, transform: `translate(${izq + i * celda + celda / 2 + 4},${arr + n * celda + 8}) rotate(50)`, class: quitadas.has(a) ? "etiqueta-svg" : "texto-svg", texto: et }));
      nombres.forEach((b, j) => {
        const r = P[i][j];
        const x = izq + j * celda, y = arr + i * celda;
        svg.appendChild(s("rect", { x, y, width: celda - 2, height: celda - 2, rx: 3, fill: "var(--div-cero)" }));
        const color = s("rect", { x, y, width: celda - 2, height: celda - 2, rx: 3, fill: r >= 0 ? "var(--div-pos)" : "var(--div-neg)", "fill-opacity": Math.min(1, Math.abs(r)) });
        conGlobo(color, `<b>${esc(nombre(a))} y ${esc(nombre(b))}</b><br>Pearson ${num(r, 2)} · Spearman ${num(S[i][j], 2)}`);
        svg.appendChild(color);
        if (i !== j && Math.abs(r) >= 0.15) svg.appendChild(s("text", { x: x + celda / 2 - 1, y: y + celda / 2 + 4, "text-anchor": "middle", "pointer-events": "none",
          class: Math.abs(r) > 0.55 ? "texto-svg-fuerte" : "etiqueta-svg", fill: Math.abs(r) > 0.55 ? "var(--hoja)" : null, texto: num(r, 2) }));
        if (i < j && Math.abs(r) > 0.8) svg.appendChild(s("rect", { x: x - 1, y: y - 1, width: celda, height: celda, rx: 4, fill: "none", stroke: "var(--tinta)", "stroke-width": 2.5, "pointer-events": "none" }));
      });
    });
    return svg;
  }

  function vifPesas(dep) {
    const filas = dep.candidatas.map((n) => ({ n, a: dep.antes.vif[n], d: dep.despues.vif[n] }));
    const W = 440, izq = 140, der = 44, altoF = 28, arr = 26;
    const H = arr + filas.length * altoF + 10;
    const X = escala(0, Math.ceil(Math.max(...filas.map((f) => f.a)) / 5) * 5, izq, W - der);
    const svg = lienzo(W, H, "VIF de cada variable antes y después de quitar las redundantes.");
    for (const [v, t, color, ancla, dx] of [[5, "moderada", "var(--medio)", "end", -4], [10, "grave", "var(--alto)", "start", 4]]) {
      svg.appendChild(s("line", { x1: X(v), x2: X(v), y1: arr - 6, y2: H - 6, stroke: color, "stroke-dasharray": "4 3" }));
      svg.appendChild(s("text", { x: X(v) + dx, y: 12, "text-anchor": ancla, class: "etiqueta-svg", texto: `${t} (${v})` }));
    }
    filas.forEach((f, i) => {
      const y = arr + i * altoF + altoF / 2;
      svg.appendChild(s("text", { x: izq - 10, y: y + 4, "text-anchor": "end", class: "texto-svg", texto: nombre(f.n) }));
      if (f.d !== undefined) svg.appendChild(s("line", { x1: X(f.a), x2: X(f.d), y1: y, y2: y, stroke: "var(--renglon)", "stroke-width": 3 }));
      const antes = s("circle", { cx: X(f.a), cy: y, r: 6, fill: "var(--hoja)", stroke: "var(--tinta-2)", "stroke-width": 2 });
      conGlobo(antes, `<b>${esc(nombre(f.n))}</b><br>VIF antes ${num(f.a, 2)}`);
      svg.appendChild(antes);
      if (f.d !== undefined) {
        const desp = s("circle", { cx: X(f.d), cy: y, r: 6, fill: "var(--acento)" });
        conGlobo(desp, `<b>${esc(nombre(f.n))}</b><br>VIF después ${num(f.d, 2)}`);
        svg.appendChild(desp);
      } else {
        svg.appendChild(s("text", { x: X(f.a) + 12, y: y + 4, class: "etiqueta-svg", texto: "quitada" }));
      }
    });
    return svg;
  }

  function pasoVariables(c, R) {
    const dep = R.dependencia;
    const [d1, d2] = dep.decisiones;
    c.append(
      p(`Antes de entrenar se midió cuánto se parecen las variables entre sí. Si dos cargan casi la misma información, el modelo
        reparte el peso entre ellas de forma inestable y hasta puede darle a una un signo al revés.`),
      figura(desplazable(mapaCalor(dep)), `Correlación de Pearson entre las diez variables candidatas (rojo: suben juntas; azul: una sube
        y la otra baja). Los recuadros marcan los dos pares por encima de 0,8. Pase el puntero para ver también Spearman.`),
      div("dos-columnas", [
        figura(vifPesas(dep), "VIF antes (círculo vacío) y después (círculo lleno). Más de 10 es multicolinealidad grave."),
        div("cuerpo", [
          p(`Se quitó <strong>${esc(nombre(d1.se_quita))}</strong> porque la ${esc(nombre(d1.se_queda))} ya la contiene y es comparable entre
            estudiantes con distinta carga (r = ${num(d1.correlacion, 2)}).`),
          d2 ? p(`Se quitó <strong>${esc(nombre(d2.se_quita))}</strong>: mide lo mismo que los ${esc(nombre(d2.se_queda))} (r = ${num(d2.correlacion, 2)}).`) : null,
          p(`Después se <strong>estandarizó</strong> cada variable (media 0, desviación 1) con los datos de entrenamiento. Sin eso, la
            asistencia, que va de 0 a 100, dominaría los gradientes frente al promedio, que va de 0 a 5.`),
        ]),
      ]),
    );
  }

  /* ================================================================== 4. cómo aprende */
  function neurona(nombres, historial, mejor) {
    const W = 640, H = 330, xIn = 214, xN = 420, yN = 160, rN = 40;
    const wmax = Math.max(...historial.flatMap((h) => h.pesos.map(Math.abs)));
    const yIn = (i) => 24 + i * ((H - 48) / (nombres.length - 1));
    const svg = lienzo(W, H, "Diagrama de la regresión logística: cada variable entra a una sola neurona con un peso; el grosor de la línea es el tamaño del peso.");
    const aristas = nombres.map((_, i) => s("line", { x1: xIn + 6, y1: yIn(i), x2: xN - rN, y2: yN, "stroke-linecap": "round" }));
    const valores = nombres.map((_, i) => s("text", { x: xIn - 12, y: yIn(i) + 4, "text-anchor": "end", class: "texto-svg-fuerte" }));
    nombres.forEach((n, i) => {
      svg.appendChild(aristas[i]);
      svg.appendChild(s("circle", { cx: xIn, cy: yIn(i), r: 5, fill: "var(--tinta-2)" }));
      svg.appendChild(s("text", { x: xIn - 62, y: yIn(i) + 4, "text-anchor": "end", class: "texto-svg", texto: nombre(n) }));
      svg.appendChild(valores[i]);
    });
    svg.appendChild(s("circle", { cx: xN, cy: yN, r: rN, fill: "var(--hoja)", stroke: "var(--tinta)", "stroke-width": 2 }));
    svg.appendChild(s("text", { x: xN, y: yN - 4, "text-anchor": "middle", class: "texto-svg-fuerte", texto: "Σ pesos" }));
    svg.appendChild(s("text", { x: xN, y: yN + 12, "text-anchor": "middle", class: "etiqueta-svg", texto: "→ sigmoide" }));
    svg.appendChild(s("line", { x1: xN + rN, x2: 516, y1: yN, y2: yN, stroke: "var(--tinta)", "stroke-width": 2 }));
    svg.appendChild(s("path", { d: `M516,${yN - 6} L528,${yN} L516,${yN + 6} z`, fill: "var(--tinta)" }));
    svg.appendChild(s("text", { x: 534, y: yN - 4, class: "texto-svg-fuerte", texto: "probabilidad" }));
    svg.appendChild(s("text", { x: 534, y: yN + 12, class: "etiqueta-svg", texto: "de desertar" }));
    const pie = s("text", { x: xN, y: H - 8, "text-anchor": "middle", class: "etiqueta-svg" });
    svg.appendChild(pie);
    svg.actualizar = (k) => {
      const h = historial[k];
      h.pesos.forEach((w, i) => {
        aristas[i].setAttribute("stroke-width", (1 + 11 * Math.abs(w) / wmax).toFixed(2));
        aristas[i].style.stroke = signoColor(w);
        valores[i].textContent = num(w, 2);
      });
      pie.textContent = `época ${h.epoca}: pérdida de validación ${num(h.perdida_val, 3)}, AUC ${num(h.auc_val, 3)}${h.epoca === mejor ? " (la mejor)" : ""}`;
    };
    return svg;
  }

  function redNeuronal(modelo) {
    const W = 660, H = 400;
    const capas = [modelo.variables.length, ...modelo.capas, 1];
    const xs = [190, 340, 480, 600];
    const ys = capas.map((n) => Array.from({ length: n }, (_, i) => (n === 1 ? (H - 24) / 2 : 14 + i * ((H - 52) / (n - 1)))));
    const svg = lienzo(W, H, "Red neuronal 8, 16, 8, 1 dibujada con sus pesos aprendidos; la opacidad de cada línea es el tamaño del peso.");
    modelo.W.forEach((Wk, k) => {
      const max = Math.max(...Wk.flat().map(Math.abs));
      Wk.forEach((fila, i) => fila.forEach((w, j) => {
        if (Math.abs(w) / max < 0.06) return;
        svg.appendChild(s("line", { x1: xs[k], y1: ys[k][i], x2: xs[k + 1], y2: ys[k + 1][j], "stroke-width": 0.6 + 2.2 * Math.abs(w) / max,
          stroke: signoColor(w), "stroke-opacity": (0.15 + 0.85 * Math.abs(w) / max).toFixed(2) }));
      }));
    });
    capas.forEach((n, k) => ys[k].forEach((y) => svg.appendChild(s("circle", { cx: xs[k], cy: y, r: k === 0 ? 5 : 6, fill: "var(--hoja)", stroke: "var(--tinta)", "stroke-width": 1.5 }))));
    modelo.variables.forEach((v, i) => {
      const sg = modelo.signos_entrada?.[i];
      svg.appendChild(s("text", { x: xs[0] - 12, y: ys[0][i] + 4, "text-anchor": "end", class: sg ? "texto-svg-fuerte" : "texto-svg", texto: nombre(v) + (sg ? (sg > 0 ? " (+)" : " (−)") : "") }));
    });
    [["entrada", 0], ["16 ReLU", 1], ["8 ReLU", 2], ["salida", 3]].forEach(([t, k]) => svg.appendChild(s("text", { x: xs[k], y: H - 2, "text-anchor": "middle", class: "etiqueta-svg", texto: t })));
    return svg;
  }

  function pasoAprende(c, R, modelos) {
    const e = R.entrenamiento, nombres = R.dependencia.finales, hist = e.historial_logistica;
    const mejor = e.info_logistica.mejor_epoca;
    const lotes = Math.ceil(R.datos.division.train / e.config_logistica.tam_lote);
    c.append(
      p(`La regresión logística es la red neuronal más simple: una sola neurona. Multiplica cada variable por un peso, suma y pasa
        el resultado por una curva sigmoide que lo convierte en probabilidad. <strong>Aprender es encontrar esos pesos.</strong>`),
      p(`Arranca con todos los pesos cerca de cero. En cada <strong>época</strong> recorre los ${miles(R.datos.division.train)} estudiantes de
        entrenamiento en <strong>mini-lotes</strong> de ${e.config_logistica.tam_lote} (unas ${lotes} correcciones por época). Con cada lote mide
        la <strong>pérdida</strong> (qué tan lejos quedaron sus probabilidades de lo que pasó) y su <strong>gradiente</strong> (hacia dónde mover cada
        peso para que baje), y da un paso en esa dirección. Los desertores pesan ${num(e.info_logistica.pesos_clase.positivo, 2)} veces cada uno
        y los demás ${num(e.info_logistica.pesos_clase.negativo, 2)}, para que el modelo no aprenda a decir que nadie deserta.`),
    );
    const control = html(`<div class="control-epoca">
        <button type="button" class="boton" id="btn-reproducir">Reproducir</button>
        <label for="epoca" class="nota">Época</label>
        <input type="range" id="epoca" min="0" max="${hist.length - 1}" value="${mejor - 1}">
        <output id="salida-epoca" for="epoca"></output></div>`);
    const svgN = neurona(nombres, hist, mejor);
    const curvaCont = document.createElement("div");
    const leyN = leyenda([["var(--div-pos)", "peso que sube el riesgo"], ["var(--div-neg)", "peso que lo baja"]]);
    const figN = figura(desplazable(svgN), `Mueva la época para ver cómo se reparten los pesos. El grosor es el tamaño del peso. Con
      early stopping el entrenamiento se detuvo en la época ${hist.length} y se quedó con la ${mejor}, la de menor pérdida de validación.
      Estos pesos son anteriores al tope de dominancia del paso 6.`, control);
    figN.insertBefore(leyN, figN.lastChild);
    c.append(figN, curvaCont);
    const dibujarCurva = (k) => {
      curvaCont.replaceChildren(figura(grafLineas({
        series: [{ nombre: "entrenamiento", color: "var(--serie-1)", valores: hist.map((h) => [h.epoca, h.perdida_train]) },
                 { nombre: "validación", color: "var(--serie-2)", valores: hist.map((h) => [h.epoca, h.perdida_val]) }],
        alto: 220, xEtiqueta: "época", yEtiqueta: "pérdida (entropía cruzada ponderada)", formatoY: (v) => num(v, 3),
        marcas: [{ x: hist[k].epoca, etiqueta: `época ${hist[k].epoca}` }], etiqueta: "Pérdida por época de la regresión logística",
      }), "La pérdida baja rápido al principio y luego se aplana: ahí el modelo ya aprendió lo que los datos permiten.",
        leyenda([["var(--serie-1)", "entrenamiento"], ["var(--serie-2)", "validación"]])));
    };
    const rango = control.querySelector("#epoca"), salida = control.querySelector("#salida-epoca");
    const mover = (k) => { rango.value = k; salida.value = `${hist[k].epoca} de ${hist.length}`; svgN.actualizar(k); dibujarCurva(k); };
    rango.addEventListener("input", () => mover(+rango.value));
    let animacion = null;
    control.querySelector("#btn-reproducir").addEventListener("click", (ev) => {
      if (animacion) { clearInterval(animacion); animacion = null; ev.target.textContent = "Reproducir"; return; }
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) { mover(hist.length - 1); return; }
      let k = 0; ev.target.textContent = "Pausar";
      animacion = setInterval(() => { mover(k); k++; if (k >= hist.length) { clearInterval(animacion); animacion = null; ev.target.textContent = "Reproducir"; } }, 120);
    });
    mover(mejor - 1);

    if (modelos.red) {
      const hr = e.historial_red;
      c.append(
        p(`La <strong>red neuronal</strong> apila neuronas en capas (${nombres.length} → ${modelos.red.capas.join(" → ")} → 1). Se entrena igual, pero el
          gradiente se calcula capa por capa hacia atrás (<strong>backpropagation</strong>), programado a mano y verificado contra diferencias finitas.
          Usa dropout (apaga el ${pct(e.config_red.dropout, 0)} de las neuronas al azar en cada lote) para no depender de un solo camino.`),
        figura(desplazable(redNeuronal(modelos.red)), `Los pesos reales de la red entrenada. Las variables marcadas con (+) o (−) tienen el signo
          fijo: después de la primera capa todos los pesos son positivos, y así la red no puede bajar el riesgo cuando el promedio baja, la
          tasa de reprobación sube o la asistencia baja. Esa corrección salió de la ronda 4 de pruebas.`,
          leyenda([["var(--div-pos)", "peso positivo"], ["var(--div-neg)", "peso negativo"]])),
        figura(grafLineas({
          series: [{ nombre: "logística", color: "var(--serie-1)", valores: hist.map((h) => [h.epoca, h.auc_val]) },
                   { nombre: "red neuronal", color: "var(--serie-2)", valores: hr.map((h) => [h.epoca, h.auc_val]) }],
          alto: 220, xEtiqueta: "época", yEtiqueta: "AUC en validación", formatoY: (v) => num(v, 3), etiqueta: "AUC de validación por época",
        }), `La red tarda más (mejor época ${e.info_red.mejor_epoca}) pero termina un poco arriba de la logística.`,
          leyenda([["var(--serie-1)", "logística"], ["var(--serie-2)", "red neuronal"]])),
      );
    }
  }

  /* ================================================================== 5. de pesos a puntos */
  function reparto(t) {
    const W = 760, H = 96, izq = 0, der = 0;
    const X = escala(0, 100, izq, W - der);
    const svg = lienzo(W, H, "Cómo se reparten los 100 puntos posibles entre las variables.");
    const orden = t.variables.map((v, i) => [v, t.puntos_maximos[i]]).sort((a, b) => b[1] - a[1]);
    let x = 0;
    orden.forEach(([v, pts], i) => {
      const r = s("rect", { x: X(x), y: 8, width: Math.max(1, X(x + pts) - X(x) - 2), height: 40, rx: 2, fill: "var(--acento)", "fill-opacity": 1 - i * 0.09 });
      conGlobo(r, `<b>${esc(nombre(v))}</b><br>hasta ${num(pts, 1)} puntos`);
      svg.appendChild(r);
      if (X(x + pts) - X(x) > nombre(v).length * 7 + 10) {
        svg.appendChild(s("text", { x: X(x) + 6, y: 66, class: "texto-svg-fuerte", texto: nombre(v) }));
        svg.appendChild(s("text", { x: X(x) + 6, y: 82, class: "etiqueta-svg", texto: `${num(pts, 1)} pts` }));
      }
      x += pts;
    });
    return svg;
  }

  function comparaCortes(cortesLog, cortesRed) {
    const W = 760, H = 150, izq = 170, der = 16;
    const X = escala(0, 100, izq, W - der);
    const svg = lienzo(W, H, "Cortes de los niveles en la escala de 0 a 100 para las reglas, la logística y la red.");
    const filas = [["Reglas del contrato", 30, 60, "fijos a mano"], ["Regresión logística", cortesLog.corte_medio, cortesLog.corte_alto, "elegidos en validación"],
      ["Red neuronal", cortesRed.corte_medio, cortesRed.corte_alto, "elegidos en validación"]];
    filas.forEach(([et, cm, ca, sub], i) => {
      const y = 10 + i * 44;
      svg.appendChild(s("text", { x: izq - 10, y: y + 12, "text-anchor": "end", class: "texto-svg-fuerte", texto: et }));
      svg.appendChild(s("text", { x: izq - 10, y: y + 26, "text-anchor": "end", class: "etiqueta-svg", texto: sub }));
      for (const [a, b, color, n] of [[0, cm, "var(--bajo)", "bajo"], [cm, ca, "var(--medio)", "medio"], [ca, 100, "var(--alto)", "alto"]]) {
        const r = s("rect", { x: X(a), y, width: Math.max(1, X(b) - X(a) - 2), height: 22, rx: 3, fill: color, opacity: 0.85 });
        conGlobo(r, `<b>${et}</b><br>${n}: de ${a} a ${b === 100 ? 100 : b - 1}`);
        svg.appendChild(r);
      }
      svg.appendChild(s("text", { x: X(cm), y: y + 36, "text-anchor": "middle", class: "etiqueta-svg", texto: cm }));
      svg.appendChild(s("text", { x: X(ca), y: y + 36, "text-anchor": "middle", class: "etiqueta-svg", texto: ca }));
    });
    return svg;
  }

  function pasoTarjeta(c, R) {
    const e = R.entrenamiento, t = e.tarjeta, cl = e.cortes, cr = e.cortes_red;
    c.append(
      p(`Un consejero no trabaja con logits. Para conservar la explicabilidad de las reglas, los pesos de la logística se convierten en una
        <strong>tarjeta de puntaje</strong>: cada variable da 0 puntos en su valor de menor riesgo y su máximo en el de mayor riesgo, y la suma va
        de 0 a 100. El puntaje ordena a los estudiantes exactamente igual que la probabilidad del modelo.`),
      figura(desplazable(reparto(t)), `El reparto de los 100 puntos. Una asistencia de 0 % o un promedio de 0,0 son posibles en el contrato,
        por eso la asistencia y el promedio tienen los rangos más amplios.`),
      p(`Los cortes bajo, medio y alto ya no se fijan a mano en 30 y 60: se eligen en <strong>validación</strong> con un objetivo explícito.
        El nivel alto debe capturar al menos el 70 % de los desertores, y en el bajo no puede quedar más del 10 %.`),
      figura(desplazable(comparaCortes(cl, cr)), `La logística marca alto desde ${cl.corte_alto} puntos: ahí captura el ${pct(cl.en_validacion.recall_alto, 0)}
        de los desertores de validación. En la red, el puntaje es 100 × probabilidad.`),
      html(`<p class="hallazgo"><strong>Hallazgo para el equipo.</strong> La meta también pedía no poner a más del 25 % de los estudiantes en
        alto. Con lo que estos datos permiten, capturar el 70 % de los desertores obliga a marcar al ${pct(cl.en_validacion.fraccion_alto, 0)}. Se
        priorizó no dejar escapar desertores; el equipo decide si acepta ese volumen de remisiones o baja la meta.</p>`),
    );
  }

  /* ================================================================== 6. cuánto pesa cada variable */
  function pasoPesos(c, R) {
    const co = R.control, it = co.importancia_test, nombres = it.variables;
    const filas = nombres.map((n, i) => ({ etiqueta: nombre(n), log: it.logistica_pct[i] * 100, red: it.red_pct[i] * 100 })).sort((a, b) => b.log - a.log);
    c.append(
      p(`Que el modelo funcione no basta: si una sola variable carga con todo, un error en ese dato arrastra la decisión. Se midió la
        <strong>importancia por permutación</strong>: se desordena una variable en los datos de prueba y se mira cuánto empeora el modelo.`),
      figura(grafBarras({ filas, grupos: [{ clave: "log", color: "var(--serie-1)", nombre: "logística" }, { clave: "red", color: "var(--serie-2)", nombre: "red neuronal" }],
        formato: (v) => `${num(v, 1)} %`, max: 40, linea: { valor: 35, etiqueta: "tope 35 %" }, etiqueta: "Importancia por permutación en prueba", anchoEtiqueta: 140 }),
        "Porcentaje de la importancia total que se lleva cada variable. Ninguna pasa del tope del 35 %.",
        leyenda([["var(--serie-1)", "logística"], ["var(--serie-2)", "red neuronal"]])),
    );
    if (co.pasos_tope.length) {
      const pasos = [{ m: 1, v: Math.max(...co.antes_tope.pct_train) }, ...co.pasos_tope.map((x) => ({ m: x.multiplicador_l2, v: x.max_pct_train }))];
      const variable = co.pasos_tope[0].variable;
      c.append(
        div("cuerpo", [
          p(`En la primera versión, la <strong>${esc(nombre(variable))}</strong> se llevaba el ${pct(pasos[0].v / 1)} de la importancia (medida en entrenamiento).
            Se le subió la regularización L2 solo a ella, de a doble, hasta bajarla a ${pct(pasos.at(-1).v)}.`),
          p(`Costo en prueba: AUC de ${num(co.antes_tope.auc_test, 4)} a ${num(co.despues_tope.auc_test, 4)}. Repartir el peso salió prácticamente gratis,
            porque el promedio y la asistencia, que se correlacionan con ella, recogieron la información.`),
        ]),
        figura(grafLineas({ series: [{ nombre: `máximo (${nombre(variable)})`, color: "var(--serie-1)", puntos: true, valores: pasos.map((x, i) => [i, x.v * 100]) }],
          alto: 210, xEtiqueta: "paso", yEtiqueta: "% de la importancia", yMin: 28, yMax: 40, formatoY: (v) => `${num(v, 1)} %`,
          formatoX: (v) => (pasos[v] ? `L2 ×${pasos[v].m}` : ""), referencias: [{ y: 35, etiqueta: "tope 35 %", color: "var(--alto)" }, { y: 33, etiqueta: "objetivo con margen 33 %" }],
          etiqueta: "Pasos del tope de dominancia" }), "Cada punto es un reentrenamiento con el doble de L2 sobre esa variable."),
      );
    }
    const abl = co.ablacion.map((a) => ({ etiqueta: nombre(a.variable), valor: a.delta_auc })).sort((a, b) => a.valor - b.valor);
    c.append(
      figura(grafBarras({ filas: abl, min: -0.11, max: 0, formato: (v) => num(v, 4), linea: { valor: -0.1, etiqueta: "colapso" }, anchoEtiqueta: 140,
        etiqueta: "Ablación: cambio de AUC al quitar cada variable", grupos: [{ clave: "valor", color: "var(--serie-2)" }] }),
        `<strong>Ablación.</strong> Se reentrenó quitando una variable a la vez. La mayor caída de AUC es ${num(Math.min(...abl.map((a) => a.valor)), 4)}, muy lejos
        del colapso (−0,10): ninguna variable es imprescindible.`),
      figura(grafBarras({ filas: nombres.map((n, i) => ({ etiqueta: nombre(n), valor: co.estabilidad.pesos_media[i], sd: co.estabilidad.pesos_desv[i], color: signoColor(co.estabilidad.pesos_media[i]) })),
        min: -0.5, max: 0.5, error: "sd", formato: (v) => num(v, 2), anchoEtiqueta: 140, etiqueta: "Pesos en cinco muestras bootstrap" }),
        `<strong>Estabilidad.</strong> Peso medio y desviación en 5 reentrenamientos con muestras distintas. ${co.estabilidad.cambios_de_signo.length ? "Algún peso cambia de signo." : "Ningún peso cambia de signo."}`),
    );
    const e = co.estrato;
    if (e) {
      c.append(
        p(`<strong>El estrato es una variable sensible.</strong> Ayuda a predecir en estos datos, pero usarla puede concentrar las remisiones en los
          estratos bajos. Se entrenó también una versión sin estrato para poner los números a la vista.`),
        figura(grafBarras({ filas: e.con_estrato.map((a, i) => ({ etiqueta: `estrato ${a.estrato}`, con: a.fraccion_alto * 100, sin: e.sin_estrato[i].fraccion_alto * 100,
          detalle: `desertan en realidad: ${pct(a.tasa_real)}` })), grupos: [{ clave: "con", color: "var(--serie-1)", nombre: "con estrato" }, { clave: "sin", color: "var(--serie-2)", nombre: "sin estrato" }],
          formato: (v) => `${num(v, 0)} %`, max: 70, anchoEtiqueta: 90, etiqueta: "Porcentaje de estudiantes en nivel alto por estrato" }),
          `Porcentaje de estudiantes que quedan en nivel alto en cada estrato. Sin estrato, el AUC pasa de ${num(e.global_con.auc, 3)} a ${num(e.global_sin.auc, 3)}.
          Dejarlo o quitarlo es una decisión del equipo.`, leyenda([["var(--serie-1)", "con estrato"], ["var(--serie-2)", "sin estrato"]])),
      );
    }
  }

  /* ================================================================== 7. resultados */
  function mosaico(modelos) {
    const nombres = Object.keys(modelos);
    const W = 760, izq = 170, der = 10, altoF = 64;
    const H = 10 + nombres.length * altoF + 18;
    const X = escala(0, 1, izq, W - der);
    const svg = lienzo(W, H, "Para cada modelo, qué parte de los estudiantes de prueba queda en cada nivel y cuántos de ellos desertan.");
    nombres.forEach((n, i) => {
      const y = 10 + i * altoF, conf = modelos[n].confusion;
      svg.appendChild(s("text", { x: izq - 10, y: y + 26, "text-anchor": "end", class: "texto-svg-fuerte", texto: n }));
      let x = 0;
      for (const nivel of ["bajo", "medio", "alto"]) {
        const f = conf[nivel], w = f.fraccion_estudiantes, alto = altoF - 18;
        const hD = alto * f.tasa_real;
        const total = f.deserto_si + f.deserto_no;
        const g = s("g", {}, [
          s("rect", { x: X(x), y, width: Math.max(1, X(x + w) - X(x) - 3), height: alto - hD, rx: 2, fill: `var(--${nivel})`, opacity: 0.28 }),
          s("rect", { x: X(x), y: y + alto - hD, width: Math.max(1, X(x + w) - X(x) - 3), height: hD, rx: 2, fill: `var(--${nivel})` }),
        ]);
        conGlobo(g, `<b>${esc(n)}, nivel ${nivel}</b><br>${miles(total)} estudiantes (${pct(w)})<br>${miles(f.deserto_si)} desertan (${pct(f.tasa_real)})`);
        svg.appendChild(g);
        if (X(x + w) - X(x) > 64) svg.appendChild(s("text", { x: X(x) + 6, y: y + 14, class: "texto-svg", "pointer-events": "none", texto: `${nivel}: ${pct(f.tasa_real, 0)} desertan` }));
        x += w;
      }
    });
    svg.appendChild(s("text", { x: izq, y: H - 4, class: "etiqueta-svg", texto: "Ancho: parte de los estudiantes en cada nivel. Parte oscura: los que sí desertaron." }));
    return svg;
  }

  function pasoResultados(c, R) {
    const ev = R.evaluacion, m = ev.modelos, nombres = Object.keys(m);
    const fila = (et, k, f) => `<tr><td>${et}</td>${nombres.map((n) => `<td class="n">${f(m[n][k])}</td>`).join("")}</tr>`;
    c.append(
      p(`Solo al final se usó el conjunto de prueba, que ningún modelo había visto. Se comparan las reglas del contrato (la línea base)
        con los dos modelos aprendidos.`),
      figura(grafBarras({ filas: nombres.map((n) => ({ etiqueta: n, valor: m[n].auc })), min: 0.5, max: 0.9, formato: (v) => num(v, 3), anchoEtiqueta: 160,
        linea: { valor: ev.auc_techo, etiqueta: `techo ${num(ev.auc_techo, 3)}`, color: "var(--tinta-2)" }, etiqueta: "AUC en prueba por modelo",
        grupos: [{ clave: "valor", color: "var(--acento)" }] }),
        `AUC: la probabilidad de que el modelo ponga a un desertor por encima de alguien que no desertó (0,5 es azar). La línea es el techo de la simulación.`),
      figura(desplazable(mosaico(m)), `Con las reglas, de cada 100 estudiantes en alto desertan ${num(m["reglas (línea base)"].confusion.alto.tasa_real * 100, 0)}, pero se escapan más desertores
        a los niveles bajo y medio. Los modelos aprendidos marcan a más estudiantes y dejan en bajo a muy pocos desertores.`),
      html(`<div class="tabla-envoltura"><table><thead><tr><th>Métrica en prueba</th>${nombres.map((n) => `<th class="n">${esc(n)}</th>`).join("")}</tr></thead><tbody>
        ${fila("Log-loss (menor es mejor)", "log_loss", (v) => num(v, 3))}
        ${fila("Brier (menor es mejor)", "brier", (v) => num(v, 3))}
        ${fila("Desertores detectados en alto", "recall", (v) => pct(v, 0))}
        ${fila("Desertan de verdad entre los de alto", "precision", (v) => pct(v, 0))}
        ${fila("Estudiantes en alto", "fraccion_alto", (v) => pct(v, 0))}
        ${fila("Accuracy", "accuracy", (v) => pct(v, 0))}</tbody></table></div>`),
      p(`La accuracy engaña: un sistema que dijera «nadie deserta» acertaría el ${pct(1 - ev.tasa_test, 0)} sin detectar a nadie.`),
      figura(grafLineas({ series: [{ nombre: "calibración perfecta", color: "var(--tenue)", punteado: true, valores: [[0, 0], [1, 1]] },
        ...nombres.map((n, i) => ({ nombre: n, color: `var(--serie-${i + 1})`, puntos: true, valores: ev.calibracion[n].map((x) => [x[0], x[1]]) }))],
        alto: 300, xMin: 0, xMax: 1, yMin: 0, yMax: 1, xEtiqueta: "probabilidad predicha", yEtiqueta: "tasa real de deserción", formatoY: (v) => pct(v, 0), formatoX: (v) => pct(v, 0),
        etiqueta: "Curva de calibración en prueba" }),
        `Calibración: si el modelo dice 30 %, ¿desertan 3 de cada 10? Los modelos aprendidos siguen la diagonal. Las reglas no fueron hechas para dar
        probabilidades y sobreestiman el riesgo.`,
        leyenda(nombres.map((n, i) => [`var(--serie-${i + 1})`, n]))),
      html(`<p class="hallazgo"><strong>Conclusión.</strong> ${esc(ev.conclusion)}</p>`),
    );
  }

  /* ================================================================== 8. pruebas */
  function filaRonda(titulo, sub, filas, separar) {
    const pasan = filas.filter((f) => f.resultado === "PASA").length;
    const r = div("ronda");
    r.innerHTML = `<span class="titulo-ronda">${esc(titulo)}<small>${esc(sub)}</small></span><span class="casillas"></span>
      <span class="marcador ${pasan === filas.length ? "pasa" : "falla"}">${pasan}/${filas.length}</span>`;
    const cas = r.querySelector(".casillas");
    let grupoAnterior = null;
    for (const f of filas) {
      const grupo = separar(f);
      if (grupoAnterior !== null && grupo !== grupoAnterior) { const sep = document.createElement("i"); sep.className = "sep"; cas.appendChild(sep); }
      grupoAnterior = grupo;
      const i = document.createElement("i");
      if (f.resultado !== "PASA") i.className = "f";
      i.setAttribute("aria-label", `${f.id} ${f.resultado}`);
      conGlobo(i, `<b>${esc(f.id)}: ${f.resultado === "PASA" ? "pasa" : "falla"}</b><br>Esperado: ${esc(String(f.esperado).slice(0, 120))}<br>Obtenido: ${esc(String(f.obtenido).slice(0, 160))}`);
      cas.appendChild(i);
    }
    return r;
  }
  const porLetra = (f) => f.id[0];
  const porGrupo = (f) => f.grupo || f.origen;

  function pasoPruebas(c, rondas) {
    c.append(p(`La metodología es la misma desde la primera práctica: contrato, casos, un oráculo escrito aparte, ejecutar, corregir y volver a probar
      con casos nuevos. Cada cuadro es un caso; rojo es una falla. Pase el puntero por un cuadro para ver qué se esperaba y qué salió.`));
    const lista = div("rondas");
    if (rondas.r12) {
      lista.append(filaRonda("Ronda 1", "v1, solo el camino feliz", rondas.r12.ronda1.filas, porLetra),
        filaRonda("Ronda 2", "v2, contrato completo", rondas.r12.ronda2.filas, porLetra));
    }
    if (rondas.r3) {
      lista.append(filaRonda("Ronda 3a", "v2 con 15 casos nuevos", rondas.r3.ronda3a_v2.filas, porLetra),
        filaRonda("Ronda 3b", "v3, contrato v2", rondas.r3.ronda3b_v3.filas, porLetra));
      if (rondas.r3.ronda3c_sistema_reglas) lista.append(filaRonda("Ronda 3c", "sistema migrado, modo reglas", rondas.r3.ronda3c_sistema_reglas.filas, porLetra));
    }
    const corto = { "Ronda 4 – modo reglas (referencia)": "reglas (referencia)", "Ronda 4 – modo aprendido, logística": "logística", "Ronda 4 – modo aprendido, red neuronal": "red neuronal" };
    if (rondas.r4v1) for (const v of rondas.r4v1.versiones) if (v.nombre.includes("red")) lista.append(filaRonda("Ronda 4, versión 1", corto[v.nombre] || v.nombre, v.filas, porGrupo));
    if (rondas.r4) for (const v of rondas.r4.versiones) lista.append(filaRonda("Ronda 4", corto[v.nombre] || v.nombre, v.filas, porGrupo));
    c.append(lista);
    c.append(p(`En la ronda 4 los casos van en tres grupos: los 23 del contrato que deben dar error o abstención exactos, 7 propiedades (orden,
      monotonía, R3.4, deuda) y 15 casos nuevos que atacan al modelo. La primera red neuronal falló la monotonía; la versión 2 la garantiza por
      construcción. Las reglas fallan 4 casos por sus escalones (una centésima de promedio cambia 15 puntos): es un hallazgo sobre el contrato,
      no un error de código.`));
  }

  async function correrRondasEnVivo() {
    const btn = $("#btn-rondas"), estado = $("#estado-rondas"), destino = $("#tabla-rondas");
    btn.disabled = true;
    estado.textContent = "Corriendo las pruebas en el servidor…";
    try {
      const t0 = performance.now();
      const d = await json("api/rondas");
      if (d.error) throw new Error(d.detalle || d.error);
      estado.textContent = `Listo en ${num((performance.now() - t0) / 1000, 1)} s. Estos resultados son de esta ejecución.`;
      const lista = div("rondas", [filaRonda("Rondas 1 a 3", "35 casos, modo reglas", d.ronda3.filas, porGrupo),
        ...d.ronda4.map((v) => filaRonda("Ronda 4", v.nombre.replace("Ronda 4 – ", ""), v.filas, porGrupo))]);
      destino.replaceChildren(lista);
    } catch (e) {
      estado.textContent = `No se pudieron correr las pruebas: ${e.message}`;
    } finally {
      btn.disabled = false;
    }
  }

  /* ================================================================== montaje */
  const PASOS = { contrato: pasoContrato, datos: pasoDatos, variables: pasoVariables, aprendizaje: pasoAprende,
    puntaje: pasoTarjeta, pesos: pasoPesos, resultados: pasoResultados, pruebas: pasoPruebas };

  /* Dibuja un paso en #contenido. `datos` = { R, rondas, modelos } */
  function montarPaso(clave, datos) {
    const c = $("#contenido");
    c.replaceChildren();
    const { R, rondas, modelos } = datos;
    const args = { contrato: [], datos: [R], variables: [R], aprendizaje: [R, modelos], puntaje: [R], pesos: [R],
      resultados: [R], pruebas: [rondas] }[clave];
    try { PASOS[clave](c, ...args); } catch (e) { console.error(clave, e); c.append(p(`No se pudo dibujar este paso (${esc(e.message)}).`)); }
    if (clave === "pruebas") $("#btn-rondas").addEventListener("click", correrRondasEnVivo);
  }

  window.SAT = Object.assign(window.SAT || {}, { montarPaso });
})();
