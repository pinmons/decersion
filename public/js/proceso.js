/* Script clásico (sin módulos) para que la página funcione también abierta como archivo. */
(function () {
  "use strict";
  const { $, esc, pct, num, miles, nombre, s, lienzo, escala, figura, leyenda, conGlobo, grafLineas, grafBarras, json,
    crearRecorrido, secuencia, pasoNeurona, pasoRed } = window.SAT;
  /* "Cómo se construyó": ocho pasos, cada uno con su explicación visual hecha con los datos reales. */

  const p = (html) => { const e = document.createElement("p"); e.innerHTML = html; return e; };
  const div = (clase, hijos = []) => { const d = document.createElement("div"); d.className = clase; hijos.forEach((h) => h && d.appendChild(h)); return d; };
  const html = (cadena) => { const t = document.createElement("template"); t.innerHTML = cadena.trim(); return t.content.firstElementChild; };
  const desplazable = (el) => div("desplazable", [el]);
  const signoColor = (w) => (w >= 0 ? "var(--div-pos)" : "var(--div-neg)");

  /* ================================================================== 1. contrato */
  const CAMPOS_CONTRATO = [
    ["id_estudiante", "texto no vacío", "cualquier código", "sí"], ["nivel_formacion", "lista", "pregrado, posgrado, educacion_continua", "sí"],
    ["estado_matricula", "lista", "activo, retirado, graduado", "sí"], ["semestre", "entero", "1 a 12", "sí"], ["promedio_acumulado", "número", "0,0 a 5,0", "sí"],
    ["creditos_inscritos", "entero", "0 a 25", "sí"], ["materias_cursadas_periodo_anterior", "entero", "0 a 12", "sí"], ["materias_reprobadas", "entero", "0 a 12", "sí"],
    ["porcentaje_asistencia", "número", "0 a 100", "sí"], ["estrato", "entero", "1 a 6", "sí"], ["trabaja", "sí o no", "true o false", "sí"],
    ["deuda_matricula", "sí o no", "true o false", "no: si falta, se reporta"],
  ];
  function pasoContrato(c) {
    const lugar = div("recorrido");
    crearRecorrido(lugar);
    const fig = figura(lugar, `Las cuatro revisiones van en este orden y la primera que falla termina el proceso. En la página
      <a href="evaluar.html">Evaluar</a>, este mismo diagrama se ilumina con el camino de cada estudiante.`);
    const filas = CAMPOS_CONTRATO.map(([campo, tipo, valores, oblig]) => `<tr><td><code>${campo}</code></td><td>${tipo}</td><td>${valores}</td><td>${oblig}</td></tr>`).join("");
    secuencia(c, 1, [
      { id: "c-entrada", titulo: "Qué datos entran", nodos: [
        "El contrato fija 12 campos, con su tipo, su rango y si son obligatorios. Todo lo que llegue distinto se rechaza o se remite; nunca se adivina.",
        html(`<div class="tabla-envoltura"><table><thead><tr><th>Campo</th><th>Tipo</th><th>Valores permitidos</th><th>Obligatorio</th></tr></thead><tbody>${filas}</tbody></table></div>`)] },
      { id: "c-orden", titulo: "En qué orden se revisa", nodos: [
        "<strong>Formato antes que población:</strong> un dato roto (un semestre escrito como texto, un promedio de 38) se rechaza para que se corrija en el origen.",
        "<strong>Población antes que faltantes:</strong> si ya se sabe que el estudiante es de posgrado o está retirado, no tiene sentido pedirle más datos.",
        "<strong>Coherencia al final:</strong> C1 más materias perdidas que cursadas, C2 activo sin créditos, C3 asistencia entre 0 y 1 (escala equivocada), C4 sin materias cursadas desde el semestre 2.",
        fig] },
      { id: "c-salidas", titulo: "Las tres respuestas posibles", nodos: [
        html(`<div class="fichas">
          <div class="ficha-metodo"><span class="mini-sello bajo">resultado</span><p>Nivel bajo, medio o alto, puntaje de 0 a 100, acción recomendada, factores y datos no informados.</p></div>
          <div class="ficha-metodo"><span class="mini-sello alto">error</span><p>Un dato tiene el tipo, el rango o el valor equivocado. Se corrige en el sistema de origen.</p></div>
          <div class="ficha-metodo"><span class="mini-sello humano">abstener</span><p>Falta un dato, hay una contradicción o el estudiante no es de la población. Decide una persona.</p></div></div>`)] },
      { id: "c-reglas", titulo: "Cómo califican las reglas escritas a mano", nodos: [
        "La línea base suma puntos fijos y corta en 30 y 60. Es transparente, pero los pesos y los escalones los decidió alguien a ojo.",
        html(`<div class="tabla-envoltura"><table><thead><tr><th>Regla</th><th>Condición</th><th class="n">Puntos</th></tr></thead><tbody>
          <tr><td>R2.1</td><td>promedio &lt; 3,0 / entre 3,0 y 3,5</td><td class="n">+30 / +15</td></tr>
          <tr><td>R2.2</td><td>2 o más materias perdidas / 1</td><td class="n">+25 / +10</td></tr>
          <tr><td>R2.3</td><td>asistencia &lt; 70 % / entre 70 y 85 %</td><td class="n">+20 / +10</td></tr>
          <tr><td>R2.4</td><td>estrato 1 o 2</td><td class="n">+10</td></tr>
          <tr><td>R2.5</td><td>trabaja</td><td class="n">+5</td></tr>
          <tr><td>R2.6</td><td>debe matrícula (si no se sabe, 0 y se reporta)</td><td class="n">+10</td></tr>
          <tr><td>R3.1 a R3.3</td><td colspan="2">alto desde 60, medio desde 30, bajo por debajo</td></tr>
          <tr><td>R3.4</td><td colspan="2">promedio &lt; 3,0 y asistencia &lt; 70 % fuerza alto, en los dos modos</td></tr></tbody></table></div>`)] },
      { id: "c-aprendido", titulo: "Qué cambia con el modelo aprendido", nodos: [
        `El modelo aprendido <strong>solo reemplaza el puntaje y los cortes</strong>: los pesos salen de los datos en vez de escribirse a mano. La validación,
        la regla R3.4 y las garantías son las mismas, y las rondas 1 a 3 siguen pasando 35 de 35 en modo reglas.`] },
    ]);
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
    secuencia(c, 2, [
      { id: "d-por-que", titulo: "Por qué datos sintéticos", nodos: [
        `No hay registros reales de estudiantes con la etiqueta de si desertaron, así que se simularon ${miles(d.n_generados)}. Lo delicado es no generar
        la etiqueta con las mismas reglas que se quieren aprender: el modelo solo se copiaría a sí mismo. Cuando haya datos reales, se cargan con
        <code>--csv</code> y todo lo demás se repite igual.`] },
      { id: "d-fabrica", titulo: "Cómo se fabricó cada estudiante", nodos: [
        figura(desplazable(diagramaFabrica()), `Cada estudiante sale de dos factores ocultos. Por eso las variables vienen correlacionadas como en la vida
          real (un promedio bajo va con más materias perdidas; un estrato bajo, con más trabajo y deuda), y la deserción se sortea con una función que no
          tiene los escalones de las reglas.`),
        `La tasa de deserción se ajustó al ${pct(d.tasa_objetivo, 0)} (SPADIES reporta cerca de 12 % anual, concentrado en los primeros semestres).`] },
      { id: "d-validacion", titulo: "Qué descartó la validación", nodos: [
        html(`<dl class="cifras">
          <div><dt>Estudiantes válidos</dt><dd>${miles(d.n_validos)}</dd></div>
          <div><dt>Desertan en la simulación</dt><dd>${pct(d.tasa_desercion)}</dd></div>
          <div><dt>Descartados por el Paso 1</dt><dd>${d.n_descartados}</dd></div>
          <div><dt>Techo de AUC posible</dt><dd>${num(d.auc_techo_test, 3)}</dd></div></dl>`),
        figura(desplazable(embudo(d)), `Los ${d.n_descartados} registros con defectos a propósito pasaron por la misma validación del contrato y ninguno entró
          al entrenamiento. El techo de AUC es lo mejor que podría lograr un modelo perfecto: el resto es ruido de la simulación.`)] },
      { id: "d-division", titulo: "Entrenamiento, validación y prueba", nodos: [
        html(`<div class="fichas">
          <div class="ficha-metodo"><h3>Entrenamiento</h3><span class="valor-metodo">${miles(d.division.train)}</span><p>Con estos estudiantes se aprenden los pesos.</p></div>
          <div class="ficha-metodo"><h3>Validación</h3><span class="valor-metodo">${miles(d.division.val)}</span><p>Deciden cuándo parar, los cortes y el tope. El modelo no aprende de ellos.</p></div>
          <div class="ficha-metodo"><h3>Prueba</h3><span class="valor-metodo">${miles(d.division.test)}</span><p>Guardados bajo llave hasta la evaluación final.</p></div></div>`)] },
      { id: "d-distribuciones", titulo: "Cómo quedaron los datos", nodos: [
        html(`<figure class="figura-png"><img src="reportes/distribuciones.png" alt="Histogramas de promedio, asistencia, tasa de reprobación y créditos por si el estudiante desertó, y tasas de deserción por estrato, semestre, trabajo y deuda" loading="lazy" width="1680" height="768"></figure>`),
        html(`<details><summary>Ver la fórmula con la que se generó la etiqueta [SUPUESTO]</summary><p class="nota"><code>${esc(d.formula_latente)}</code></p></details>`)] },
    ]);
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
    secuencia(c, 3, [
      { id: "v-candidatas", titulo: "De 12 campos a 10 candidatas", nodos: [
        `El identificador no sirve para predecir, y nivel de formación y estado de matrícula son iguales para todos (pregrado y activo). Quedan 9 campos y se
        agrega una variable construida: la <strong>tasa de reprobación</strong> = perdidas ÷ cursadas, porque perder 2 de 3 no es lo mismo que 2 de 8.`] },
      { id: "v-correlacion", titulo: "Cuánto se parecen entre sí", nodos: [
        "Si dos variables cargan casi la misma información, el modelo reparte el peso entre ellas de forma inestable y hasta puede darle a una un signo al revés.",
        figura(desplazable(mapaCalor(dep)), `Correlación de Pearson en entrenamiento (rojo: suben juntas; azul: una sube y la otra baja). Los recuadros marcan
          los dos pares por encima de 0,8. Pase el puntero para ver también Spearman.`)] },
      { id: "v-vif", titulo: "VIF y qué se quitó", nodos: [
        div("dos-columnas", [
          figura(vifPesas(dep), "VIF antes (círculo vacío) y después (círculo lleno). Más de 10 es multicolinealidad grave."),
          div("cuerpo", [
            p(`El <strong>VIF</strong> mide cuánto se puede adivinar una variable a partir de las demás. Se quitó <strong>${esc(nombre(d1.se_quita))}</strong>
              porque la ${esc(nombre(d1.se_queda))} ya la contiene (r = ${num(d1.correlacion, 2)}).`),
            d2 ? p(`Se quitó <strong>${esc(nombre(d2.se_quita))}</strong>: mide lo mismo que los ${esc(nombre(d2.se_queda))} (r = ${num(d2.correlacion, 2)}).`) : null,
            p(`Quedan <strong>${dep.finales.length} variables</strong>, todas con VIF menor que 2,5.`),
          ])])] },
      { id: "v-escala", titulo: "Todas en la misma escala", nodos: [
        html(`<div class="formula">z = (x − μ) / σ<small>μ y σ se calculan solo con entrenamiento</small></div>`),
        `Sin estandarizar, la asistencia (0 a 100) dominaría los gradientes frente al promedio (0 a 5), y la regularización castigaría según las unidades.
        En el paso siguiente se ve esta transformación con un estudiante concreto.`] },
    ]);
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
    secuencia(c, 6, [
      { id: "t-por-que", titulo: "Por qué convertir pesos en puntos", nodos: [
        `Un consejero no trabaja con logits. Para conservar la explicabilidad de las reglas, los pesos de la neurona se convierten en una
        <strong>tarjeta de puntaje</strong>: cada variable da 0 puntos en su valor de menor riesgo y su máximo en el de mayor riesgo, y la suma va de 0 a 100.`] },
      { id: "t-como", titulo: "De pesos a puntos", nodos: [
        html(`<div class="formula">βⱼ = wⱼ / σⱼ &nbsp;&nbsp; puntosⱼ = (βⱼ · xⱼ − mínimoⱼ) × ${num(t.escala, 2)}<small>de unidades estandarizadas a unidades reales</small></div>`),
        `El puntaje es lineal en el logit (logit = ${num(t.logit_base, 2)} + puntaje / ${num(t.escala, 2)}), así que ordena a los estudiantes exactamente igual que la probabilidad.`,
        figura(desplazable(reparto(t)), "El reparto de los 100 puntos. Una asistencia de 0 % o un promedio de 0,0 son posibles en el contrato, por eso esas dos variables tienen los rangos más amplios.")] },
      { id: "t-cortes", titulo: "Los cortes se eligen con datos", nodos: [
        `Los cortes bajo, medio y alto ya no se fijan a mano en 30 y 60: se eligen en <strong>validación</strong> con un objetivo explícito. El nivel alto
        debe capturar al menos el 70 % de los desertores, y en el bajo no puede quedar más del 10 %.`,
        figura(desplazable(comparaCortes(cl, cr)), `La neurona marca alto desde ${cl.corte_alto} puntos: ahí captura el ${pct(cl.en_validacion.recall_alto, 0)} de los
          desertores de validación. En la red, el puntaje es 100 × probabilidad.`)] },
      { id: "t-hallazgo", titulo: "Un hallazgo para el equipo", nodos: [
        html(`<p class="hallazgo">La meta también pedía no poner a más del 25 % de los estudiantes en alto. Con lo que estos datos permiten, capturar el 70 % de los
          desertores obliga a marcar al <strong>${pct(cl.en_validacion.fraccion_alto, 0)}</strong>. Se priorizó no dejar escapar desertores; el equipo decide si
          acepta ese volumen de remisiones o baja la meta.</p>`)] },
    ]);
  }

  /* ================================================================== 6. cuánto pesa cada variable */
  function pasoPesos(c, R) {
    const co = R.control, it = co.importancia_test, nombres = it.variables;
    const filas = nombres.map((n, i) => ({ etiqueta: nombre(n), log: it.logistica_pct[i] * 100, red: it.red_pct[i] * 100 })).sort((a, b) => b.log - a.log);
    const items = [{ id: "w-importancia", titulo: "Importancia por permutación", nodos: [
      `Si una sola variable carga con todo, un error en ese dato arrastra la decisión. Para medirlo se <strong>desordena una variable</strong> en los datos de
      prueba y se mira cuánto empeora el modelo.`,
      figura(grafBarras({ filas, grupos: [{ clave: "log", color: "var(--serie-1)", nombre: "neurona" }, { clave: "red", color: "var(--serie-2)", nombre: "red neuronal" }],
        formato: (v) => `${num(v, 1)} %`, max: 40, linea: { valor: 35, etiqueta: "tope 35 %" }, etiqueta: "Importancia por permutación en prueba", anchoEtiqueta: 140 }),
        "Parte de la importancia total que se lleva cada variable. Ninguna pasa del tope del 35 %.",
        leyenda([["var(--serie-1)", "neurona (logística)"], ["var(--serie-2)", "red neuronal"]]))] }];
    if (co.pasos_tope.length) {
      const pasos = [{ m: 1, v: Math.max(...co.antes_tope.pct_train) }, ...co.pasos_tope.map((x) => ({ m: x.multiplicador_l2, v: x.max_pct_train }))];
      const variable = co.pasos_tope[0].variable;
      items.push({ id: "w-tope", titulo: "El tope de dominancia", nodos: [
        `En la primera versión, la <strong>${esc(nombre(variable))}</strong> se llevaba el ${pct(pasos[0].v)} de la importancia (medida en entrenamiento). Se le
        subió la regularización L2 solo a ella, de a doble, hasta bajarla a ${pct(pasos.at(-1).v)}. Costo en prueba: AUC de ${num(co.antes_tope.auc_test, 4)} a
        ${num(co.despues_tope.auc_test, 4)}, prácticamente gratis.`,
        figura(grafLineas({ series: [{ nombre: `máximo (${nombre(variable)})`, color: "var(--serie-1)", puntos: true, valores: pasos.map((x, i) => [i, x.v * 100]) }],
          alto: 210, xEtiqueta: "paso", yEtiqueta: "% de la importancia", yMin: 28, yMax: 40, formatoY: (v) => `${num(v, 1)} %`,
          formatoX: (v) => (pasos[v] ? `L2 ×${pasos[v].m}` : ""), referencias: [{ y: 35, etiqueta: "tope 35 %", color: "var(--alto)" }, { y: 33, etiqueta: "objetivo con margen 33 %" }],
          etiqueta: "Pasos del tope de dominancia" }), "Cada punto es un reentrenamiento con el doble de L2 sobre esa variable.")] });
    }
    const abl = co.ablacion.map((a) => ({ etiqueta: nombre(a.variable), valor: a.delta_auc })).sort((a, b) => a.valor - b.valor);
    items.push({ id: "w-ablacion", titulo: "Ablación: quitar una variable a la vez", nodos: [
      figura(grafBarras({ filas: abl, min: -0.11, max: 0, formato: (v) => num(v, 4), linea: { valor: -0.1, etiqueta: "colapso" }, anchoEtiqueta: 140,
        etiqueta: "Ablación: cambio de AUC al quitar cada variable", grupos: [{ clave: "valor", color: "var(--serie-2)" }] }),
        `Se reentrenó sin cada variable. La mayor caída de AUC es ${num(Math.min(...abl.map((a) => a.valor)), 4)}, muy lejos del colapso (−0,10): ninguna es imprescindible.`)] });
    items.push({ id: "w-estabilidad", titulo: "Estabilidad: entrenar con otras muestras", nodos: [
      figura(grafBarras({ filas: nombres.map((n, i) => ({ etiqueta: nombre(n), valor: co.estabilidad.pesos_media[i], sd: co.estabilidad.pesos_desv[i], color: signoColor(co.estabilidad.pesos_media[i]) })),
        min: -0.5, max: 0.5, error: "sd", formato: (v) => num(v, 2), anchoEtiqueta: 140, etiqueta: "Pesos en cinco muestras bootstrap" }),
        `Peso medio y desviación en 5 reentrenamientos con muestras distintas. ${co.estabilidad.cambios_de_signo.length ? "Algún peso cambia de signo." : "Ningún peso cambia de signo: lo aprendido no es casualidad de una muestra."}`)] });
    const e = co.estrato;
    if (e) items.push({ id: "w-estrato", titulo: "La variable sensible: estrato", nodos: [
      "El estrato ayuda a predecir en estos datos, pero usarlo puede concentrar las remisiones en los estratos bajos. Se entrenó también una versión sin estrato.",
      figura(grafBarras({ filas: e.con_estrato.map((a, i) => ({ etiqueta: `estrato ${a.estrato}`, con: a.fraccion_alto * 100, sin: e.sin_estrato[i].fraccion_alto * 100,
        detalle: `desertan en realidad: ${pct(a.tasa_real)}` })), grupos: [{ clave: "con", color: "var(--serie-1)", nombre: "con estrato" }, { clave: "sin", color: "var(--serie-2)", nombre: "sin estrato" }],
        formato: (v) => `${num(v, 0)} %`, max: 70, anchoEtiqueta: 90, etiqueta: "Porcentaje de estudiantes en nivel alto por estrato" }),
        `Estudiantes en nivel alto por estrato. Sin estrato, el AUC pasa de ${num(e.global_con.auc, 3)} a ${num(e.global_sin.auc, 3)}. Dejarlo o quitarlo es una decisión del equipo.`,
        leyenda([["var(--serie-1)", "con estrato"], ["var(--serie-2)", "sin estrato"]]))] });
    secuencia(c, 7, items);
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
    secuencia(c, 8, [
      { id: "e-orden", titulo: "Qué tan bien ordena a los estudiantes", nodos: [
        `Solo al final se usó el conjunto de prueba, que ningún modelo había visto. El <strong>AUC</strong> es la probabilidad de que el modelo ponga a un desertor
        por encima de alguien que no desertó (0,5 es azar, 1 es perfecto).`,
        figura(grafBarras({ filas: nombres.map((n) => ({ etiqueta: n, valor: m[n].auc })), min: 0.5, max: 0.9, formato: (v) => num(v, 3), anchoEtiqueta: 160,
          linea: { valor: ev.auc_techo, etiqueta: `techo ${num(ev.auc_techo, 3)}`, color: "var(--tinta-2)" }, etiqueta: "AUC en prueba por modelo",
          grupos: [{ clave: "valor", color: "var(--acento)" }] }), "La línea es el techo de la simulación: ni un modelo perfecto pasaría de ahí.")] },
      { id: "e-niveles", titulo: "A quién marca en cada nivel", nodos: [
        figura(desplazable(mosaico(m)), `Con las reglas, de cada 100 estudiantes en alto desertan ${num(m["reglas (línea base)"].confusion.alto.tasa_real * 100, 0)}, pero se escapan más
          desertores a bajo y medio. Los modelos aprendidos marcan a más estudiantes y dejan en bajo a muy pocos desertores.`)] },
      { id: "e-metricas", titulo: "Todas las métricas", nodos: [
        html(`<div class="tabla-envoltura"><table><thead><tr><th>Métrica en prueba</th>${nombres.map((n) => `<th class="n">${esc(n)}</th>`).join("")}</tr></thead><tbody>
          ${fila("Log-loss (menor es mejor)", "log_loss", (v) => num(v, 3))}${fila("Brier (menor es mejor)", "brier", (v) => num(v, 3))}
          ${fila("Desertores detectados en alto", "recall", (v) => pct(v, 0))}${fila("Desertan de verdad entre los de alto", "precision", (v) => pct(v, 0))}
          ${fila("Estudiantes en alto", "fraccion_alto", (v) => pct(v, 0))}${fila("Accuracy", "accuracy", (v) => pct(v, 0))}</tbody></table></div>`),
        `La accuracy engaña: un sistema que dijera «nadie deserta» acertaría el ${pct(1 - ev.tasa_test, 0)} sin detectar a nadie.`] },
      { id: "e-calibracion", titulo: "¿Las probabilidades dicen la verdad?", nodos: [
        figura(grafLineas({ series: [{ nombre: "calibración perfecta", color: "var(--tenue)", punteado: true, valores: [[0, 0], [1, 1]] },
          ...nombres.map((n, i) => ({ nombre: n, color: `var(--serie-${i + 1})`, puntos: true, valores: ev.calibracion[n].map((x) => [x[0], x[1]]) }))],
          alto: 300, xMin: 0, xMax: 1, yMin: 0, yMax: 1, xEtiqueta: "probabilidad predicha", yEtiqueta: "tasa real de deserción", formatoY: (v) => pct(v, 0), formatoX: (v) => pct(v, 0),
          etiqueta: "Curva de calibración en prueba" }),
          "Si el modelo dice 30 %, ¿desertan 3 de cada 10? Los modelos aprendidos siguen la diagonal. Las reglas no fueron hechas para dar probabilidades y sobreestiman el riesgo.",
          leyenda(nombres.map((n, i) => [`var(--serie-${i + 1})`, n])))] },
      { id: "e-conclusion", titulo: "Conclusión", nodos: [html(`<p class="hallazgo">${esc(ev.conclusion)}</p>`)] },
    ]);
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
    const lista = div("rondas");
    if (rondas.r12) lista.append(filaRonda("Ronda 1", "v1, solo el camino feliz", rondas.r12.ronda1.filas, porLetra),
      filaRonda("Ronda 2", "v2, contrato completo", rondas.r12.ronda2.filas, porLetra));
    if (rondas.r3) {
      lista.append(filaRonda("Ronda 3a", "v2 con 15 casos nuevos", rondas.r3.ronda3a_v2.filas, porLetra),
        filaRonda("Ronda 3b", "v3, contrato v2", rondas.r3.ronda3b_v3.filas, porLetra));
      if (rondas.r3.ronda3c_sistema_reglas) lista.append(filaRonda("Ronda 3c", "sistema migrado, modo reglas", rondas.r3.ronda3c_sistema_reglas.filas, porLetra));
    }
    const corto = { "Ronda 4 – modo reglas (referencia)": "reglas (referencia)", "Ronda 4 – modo aprendido, logística": "neurona (logística)", "Ronda 4 – modo aprendido, red neuronal": "red neuronal" };
    if (rondas.r4v1) for (const v of rondas.r4v1.versiones) if (v.nombre.includes("red")) lista.append(filaRonda("Ronda 4, versión 1", corto[v.nombre] || v.nombre, v.filas, porGrupo));
    if (rondas.r4) for (const v of rondas.r4.versiones) lista.append(filaRonda("Ronda 4", corto[v.nombre] || v.nombre, v.filas, porGrupo));
    secuencia(c, 9, [
      { id: "p-metodo", titulo: "La metodología", nodos: [
        `Desde la primera práctica es la misma: <strong>contrato</strong>, <strong>casos</strong>, un <strong>oráculo</strong> escrito aparte con la respuesta
        esperada, <strong>ejecutar</strong>, <strong>corregir</strong> y volver a probar con <strong>casos nuevos</strong>. Los oráculos son borradores que debe firmar el equipo.`] },
      { id: "p-rondas", titulo: "Ronda por ronda, caso por caso", nodos: [
        "Cada cuadro es un caso; rojo es una falla. Pase el puntero por un cuadro para ver qué se esperaba y qué salió.", lista] },
      { id: "p-hallazgos", titulo: "Qué falló y cómo se corrigió", nodos: [
        html(`<div class="tabla-envoltura"><table><thead><tr><th>Ronda</th><th>Qué falló</th><th>Corrección</th></tr></thead><tbody>
          <tr><td>1 (v1)</td><td>14 de 20: sin validación, el sistema calificaba a quien no debía y se caía con datos faltantes.</td><td>v2: contrato completo, 20 de 20.</td></tr>
          <tr><td>3a (v2)</td><td>3 de 35: asistencia en escala 0–1, texto vacío y estudiante sin materias cursadas. Eran huecos del contrato.</td><td>v3: reglas C3, C4 y texto vacío = faltante, 35 de 35.</td></tr>
          <tr><td>4 (red v1)</td><td>La red bajaba el riesgo en un caso raro cuando la asistencia bajaba.</td><td>Red monótona por construcción, 45 de 45.</td></tr>
          <tr><td>4 (reglas)</td><td>Escalones: una centésima de promedio cambia 15 puntos; una asistencia de 0 % queda en bajo.</td><td>Hallazgo para el equipo; las reglas no se tocan.</td></tr></tbody></table></div>`)] },
      { id: "p-vivo", titulo: "Correr las pruebas otra vez", nodos: ["El botón de abajo corre en el servidor las rondas 1 a 3 (modo reglas) y la ronda 4 (modo aprendido) en este momento."] },
    ]);
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
  const PASOS = { contrato: pasoContrato, datos: pasoDatos, variables: pasoVariables, aprendizaje: pasoNeurona, red: pasoRed,
    puntaje: pasoTarjeta, pesos: pasoPesos, resultados: pasoResultados, pruebas: pasoPruebas };

  /* Dibuja un paso en #contenido. `datos` = { R, rondas, modelos } */
  function montarPaso(clave, datos) {
    const c = $("#contenido");
    c.replaceChildren();
    const { R, rondas, modelos } = datos;
    const args = { contrato: [], datos: [R], variables: [R], aprendizaje: [R, modelos], red: [R, modelos], puntaje: [R], pesos: [R],
      resultados: [R], pruebas: [rondas] }[clave];
    try { PASOS[clave](c, ...args); } catch (e) { console.error(clave, e); c.append(p(`No se pudo dibujar este paso (${esc(e.message)}).`)); }
    if (clave === "pruebas") $("#btn-rondas").addEventListener("click", correrRondasEnVivo);
  }

  window.SAT = Object.assign(window.SAT || {}, { montarPaso });
})();
