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
        la regla R3.4 y las garantías son las mismas, y las rondas 1 a 3 siguen pasando 35 de 35 en modo reglas.`,
        `Con la base real, el modelo recibe además un <strong>contrato ampliado</strong>: notas del cuatrimestre, días en el campus y en el aula virtual,
        admisión y titulación, todos opcionales (si falta uno se usa el valor usual y se dice). Estrato, deuda y asistencia siguen en el contrato porque los
        piden las reglas, pero el modelo real no los usa: la base no los trae. El paso siguiente muestra qué variables quedan.`] },
    ]);
  }

  /* ================================================================== 2. datos */
  const FUENTE_DE = { promedio_acumulado: "notas", materias_cursadas_periodo_anterior: "notas", tasa_reprobacion: "notas", asignaturas_no_presentadas: "notas",
    materias_reprobadas: "notas", nota_media_cuatrimestre: "notas", nota_minima_cuatrimestre: "notas",
    dias_campus_sep_nov: "actividad", dias_campus_dic_ene: "actividad", sin_registro_wifi: "actividad", dias_aula_virtual: "actividad",
    entregas_por_asignatura: "actividad", sin_aula_virtual: "actividad", porcentaje_asistencia: "actividad",
    creditos_inscritos: "admision", trabaja: "admision", nota_acceso: "admision", sin_nota_acceso: "admision", nota_bachillerato: "admision",
    sin_nota_bachillerato: "admision", opcion_titulacion: "admision", sin_opcion_titulacion: "admision", ingreso_ordinario: "admision",
    semestre: "admision", estrato: "admision", deuda_matricula: "admision", abandono_titulacion: "titulacion" };
  const FUENTES_TXT = { notas: "Notas del primer cuatrimestre", actividad: "Actividad (campus y aula virtual)", admision: "Matrícula y admisión", titulacion: "Titulación" };

  /* De la fuente a los estudiantes con los que se entrena, en una sola barra por etapa. */
  function embudo(d, impagos) {
    const W = 760, H = 220, izq = 160, der = 14;
    const total = d.n_generados + impagos;
    const svg = lienzo(W, H, `De ${miles(total)} estudiantes del extracto, ${impagos} con impago quedan fuera, ${d.n_descartados} los remite el Paso 1 y
      ${miles(d.n_validos)} se dividen en entrenamiento, validación y prueba.`);
    const X = escala(0, total, izq, W - der);
    const fila = (y, etiqueta, sub) => {
      svg.appendChild(s("text", { x: izq - 10, y: y + 15, "text-anchor": "end", class: "texto-svg-fuerte", texto: etiqueta }));
      svg.appendChild(s("text", { x: izq - 10, y: y + 30, "text-anchor": "end", class: "etiqueta-svg", texto: sub }));
    };
    const seg = (x0, ancho, y, alto, color, globo, texto) => {
      const r = s("rect", { x: x0, y, width: Math.max(1.5, ancho - 2), height: alto, rx: 2, fill: color });
      conGlobo(r, globo); svg.appendChild(r);
      if (texto && ancho > 90) svg.appendChild(s("text", { x: x0 + 8, y: y + alto / 2 + 4, class: "texto-svg", texto, fill: "var(--hoja)" }));
    };
    fila(10, "Extracto", `${miles(total)} estudiantes`);
    seg(X(0), X(d.n_validos) - X(0), 10, 34, "var(--acento)", `<b>Entran</b><br>${miles(d.n_validos)} estudiantes`, `${miles(d.n_validos)} entran`);
    let x = X(d.n_validos);
    for (const [motivo, n] of Object.entries(d.descartes_por_motivo)) {
      const w = X(n) - X(0);
      seg(x, w + 2, 10, 34, "var(--humano)", `<b>Paso 1: ${esc(motivo)}</b><br>${n} registros van a una persona`);
      x += w;
    }
    seg(x, X(impagos) - X(0) + 2, 10, 34, "var(--tenue)", `<b>Fuera: impago de matrícula</b><br>${impagos} estudiantes; la fuente no marca a ninguno como abandono`);
    svg.appendChild(s("text", { x: W - der, y: 60, "text-anchor": "end", class: "etiqueta-svg", texto: `${impagos} con impago fuera (gris) · ${d.n_descartados} remitidos por el Paso 1 (violeta)` }));
    fila(100, "División", "70 / 15 / 15 %");
    const Xv = escala(0, d.n_validos, izq, W - der);
    let x0 = Xv(0);
    for (const [clave, nombre_] of [["train", "entrenamiento"], ["val", "validación"], ["test", "prueba"]]) {
      const n = d.division[clave], tasa = d.division[`tasa_${clave}`];
      const w = Xv(n) - Xv(0);
      seg(x0, w * (1 - tasa), 100, 34, "var(--serie-1)", `<b>${nombre_}</b><br>${miles(n)} estudiantes; ${pct(tasa)} abandonan`);
      svg.appendChild(s("text", { x: x0, y: 150, class: "texto-svg-fuerte", texto: nombre_ }));
      svg.appendChild(s("text", { x: x0, y: 164, class: "etiqueta-svg", texto: miles(n) }));
      seg(x0 + w * (1 - tasa), w * tasa, 100, 34, "var(--serie-2)", `<b>${nombre_}: abandonan</b><br>${miles(Math.round(n * tasa))} estudiantes (${pct(tasa)})`);
      x0 += w;
    }
    svg.appendChild(s("text", { x: izq, y: 196, class: "etiqueta-svg", texto: "Estratificada y con semilla fija (2026): en los tres conjuntos abandona el mismo porcentaje." }));
    svg.appendChild(s("text", { x: izq, y: 212, class: "etiqueta-svg", texto: "La prueba no se usa hasta la evaluación final." }));
    return svg;
  }

  /* Cómo quedaron los datos: para cada variable, el promedio de quienes abandonaron frente al de quienes no. */
  function comparaMedias(rc) {
    const filas = [["promedio_acumulado", 2], ["porcentaje_asistencia", 1], ["materias_reprobadas", 2], ["materias_cursadas_periodo_anterior", 1]].filter(([k]) => rc.numericos[k] && rc.numericos[k].desv > 0);
    const W = 520, altoF = 46, izq = 150, der = 26, H = 10 + filas.length * altoF + 6;
    const svg = lienzo(W, H, "Promedio de cada variable entre quienes abandonaron y quienes no: " + filas.map(([k, dgt]) =>
      `${nombre(k)} ${num(rc.numericos[k].media_desertores, dgt)} frente a ${num(rc.numericos[k].media_no_desertores, dgt)}`).join("; ") + ".");
    filas.forEach(([k, dgt], i) => {
      const v = rc.numericos[k], y = 10 + i * altoF + 16, X = escala(v.min, v.max, izq, W - der);
      svg.appendChild(s("text", { x: izq - 14, y: y + 4, "text-anchor": "end", class: "texto-svg-fuerte", texto: k === "porcentaje_asistencia" ? "presencia (%)" : nombre(k) }));
      svg.appendChild(s("line", { x1: izq, x2: W - der, y1: y, y2: y, stroke: "var(--renglon)", "stroke-width": 6, "stroke-linecap": "round" }));
      svg.appendChild(s("line", { x1: X(v.media_desertores), x2: X(v.media_no_desertores), y1: y, y2: y, stroke: "var(--tinta-2)", "stroke-width": 2 }));
      svg.appendChild(s("text", { x: izq, y: y + 20, class: "etiqueta-svg", texto: num(v.min, 0) }));
      svg.appendChild(s("text", { x: W - der, y: y + 20, "text-anchor": "end", class: "etiqueta-svg", texto: num(v.max, 0) }));
      for (const [valor, color, quien] of [[v.media_no_desertores, "var(--serie-1)", "siguieron"], [v.media_desertores, "var(--serie-2)", "abandonaron"]]) {
        const punto = s("circle", { cx: X(valor), cy: y, r: 7, fill: color, stroke: "var(--hoja)", "stroke-width": 2 });
        conGlobo(punto, `<b>${esc(nombre(k))}</b><br>Quienes ${quien}: ${num(valor, dgt)} en promedio`);
        svg.appendChild(punto);
      }
      const izqEs = v.media_desertores < v.media_no_desertores;
      svg.appendChild(s("text", { x: X(v.media_desertores) + (izqEs ? -12 : 12), y: y - 10, "text-anchor": izqEs ? "end" : "start", class: "etiqueta-svg", texto: num(v.media_desertores, dgt) }));
      svg.appendChild(s("text", { x: X(v.media_no_desertores) + (izqEs ? 12 : -12), y: y - 10, "text-anchor": izqEs ? "start" : "end", class: "etiqueta-svg", texto: num(v.media_no_desertores, dgt) }));
    });
    return figura(svg, "La raya es el rango de cada campo; cada punto, el promedio de un grupo. Entre más separados, más distingue ese campo. La presencia combina wifi y aula virtual (la base no registra asistencia).",
      leyenda([["var(--serie-1)", "siguieron", "punto"], ["var(--serie-2)", "abandonaron", "punto"]]));
  }
  function tasasPorGrupo(R) {
    const d = R.datos, rc = d.resumen_campos, ev = R.datos_evidentes;
    const filas = (rc.categoricos.trabaja || []).map((f) => ({ etiqueta: f.valor === "true" ? "tiempo parcial" : "tiempo completo", valor: f.tasa_desercion,
      detalle: `${miles(f.n)} estudiantes (${pct(f.fraccion, 1)} del total)` }));
    if (ev) filas.push({ etiqueta: "no aprobó nada", valor: ev.tasa_desercion, detalle: `${miles(ev.n)} estudiantes (${pct(ev.fraccion, 1)} del total)` });
    return figura(grafBarras({ filas, formato: (v) => pct(v, 0), min: 0, grupos: [{ clave: "valor", color: "var(--serie-2)" }], anchoEtiqueta: 140, ancho: 520,
      linea: { valor: d.tasa_desercion, etiqueta: `todos: ${pct(d.tasa_desercion, 0)}`, color: "var(--tinta-2)" }, etiqueta: "Porcentaje que abandona en cada grupo" }),
      "Qué parte de cada grupo abandona. La matrícula a tiempo parcial es lo que la base tiene más parecido a «trabaja».");
  }
  function faltantes(d) {
    const f = d.faltantes_ampliado || {};
    const filas = Object.entries(f).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ etiqueta: nombre(k), valor: n / d.n_validos,
      detalle: `${miles(n)} de ${miles(d.n_validos)} estudiantes` }));
    return figura(grafBarras({ filas, formato: (v) => pct(v, 1), min: 0, grupos: [{ clave: "valor", color: "var(--tinta-2)" }], anchoEtiqueta: 210, ancho: 560,
      etiqueta: "Datos que faltan en la base" }), "Lo que falta se completa con la mediana de entrenamiento y una indicadora «sin dato» que el modelo ve: no se inventa nada en silencio.");
  }

  function pasoDatos(c, R, B) {
    const d = R.datos, dep = R.dependencia;
    const impagos = B && B.fuente ? Number((B.fuente.poblacion.match(/(\d+) estudiantes con impago/) || [])[1] || 0) : 0;
    const fuente = B && B.fuente ? B.fuente : null;
    const porFuente = {};
    dep.finales.forEach((v) => { const f = FUENTE_DE[v] || "admision"; (porFuente[f] = porFuente[f] || []).push(v); });
    secuencia(c, 2, [
      { id: "d-fuente", titulo: "De dónde salen los datos", nodos: [
        `Son estudiantes <strong>reales y anonimizados</strong> de primer año de la ${esc(fuente ? fuente.institucion : "Universitat Politècnica de València")},
        publicados en ${fuente ? `<a href="${esc(fuente.doi)}">${esc(fuente.repositorio)}</a> (${esc(fuente.licencia)})` : "Zenodo"}: cohortes 2021 y 2022. Colombia publica
        la deserción solo en totales (SPADIES), no estudiante por estudiante, y esta es la base pública más cercana con notas y actividad.`,
        `Se usa <strong>solo lo que se sabe al cerrar el primer cuatrimestre</strong> (septiembre a enero): notas, días en el campus (wifi), actividad en el
        aula virtual, matrícula y admisión. Nada posterior entra al modelo. <strong>Abandono</strong> = dos cursos seguidos sin matricularse en la titulación.`,
        html(`<details><summary>Cómo se armaron los 12 campos del contrato con esta base [SUPUESTOS]</summary><p class="nota">La asistencia se aproxima con la presencia
          (wifi y aula virtual); «trabaja», con la matrícula a tiempo parcial; el estrato no existe (vale 3 para todos) y la deuda no se usa. Por eso esos campos
          no entran al modelo real. Todo está en <code>desercion/datos_reales.py</code>.</p></details>`)] },
      { id: "d-validacion", titulo: "Quién entra y cómo se repartió", nodos: [
        html(`<dl class="cifras">
          <div><dt>Estudiantes que entran</dt><dd>${miles(d.n_validos)}</dd></div>
          <div><dt>Abandonan</dt><dd>${pct(d.tasa_desercion)}</dd></div>
          <div><dt>Remitidos por el Paso 1</dt><dd>${d.n_descartados}</dd></div>
          <div><dt>Fuera por impago</dt><dd>${impagos}</dd></div></dl>`),
        figura(desplazable(embudo(d, impagos)), `Los ${impagos} estudiantes con impago quedan fuera porque la fuente no marca a ninguno como abandono: con ellos el modelo
          aprendía que «no tener nota de acceso» protege. Los ${d.n_descartados} que remite el Paso 1 (dato faltante o contradictorio) los revisa una persona.`),
        html(`<ul class="tres-usos">
          <li><span>Entrenamiento</span><b>${miles(d.division.train)}</b>Con estos estudiantes se aprenden los pesos.</li>
          <li><span>Validación</span><b>${miles(d.division.val)}</b>Deciden cuándo parar, los cortes y el tope. El modelo no aprende de ellos.</li>
          <li><span>Prueba</span><b>${miles(d.division.test)}</b>Guardados bajo llave hasta la evaluación final.</li></ul>`)] },
      { id: "d-variables", titulo: `Las ${dep.finales.length} variables que usa el modelo`, nodos: [
        html(`<div class="tabla-envoltura"><table><thead><tr><th>Fuente</th><th class="n">n</th><th>Variables</th></tr></thead><tbody>${["notas", "actividad", "admision", "titulacion"]
          .filter((f) => porFuente[f]).map((f) => `<tr><td>${FUENTES_TXT[f]}</td><td class="n">${porFuente[f].length}</td><td>${porFuente[f].map((v) => esc(nombre(v))).join(", ")}</td></tr>`).join("")}</tbody></table></div>`),
        `La <strong>tasa de abandono de la titulación</strong> se calcula solo con estudiantes de entrenamiento y, para ellos mismos, «fuera de pliegue» (en 5 partes): la
        tasa de cada estudiante sale de las otras cuatro, para que su propio desenlace no se filtre en su dato. El paso siguiente explica cómo se llegó de ${dep.candidatas.length} candidatas a ${dep.finales.length}.`] },
      { id: "d-faltantes", titulo: "Datos que faltan", nodos: [faltantes(d)] },
      { id: "d-distribuciones", titulo: "Cómo se ven los datos", nodos: [
        "Antes de entrenar conviene mirar si los datos tienen sentido: quienes abandonan deberían traer peor promedio, menos presencia y más materias perdidas.",
        div("cuerpo", [comparaMedias(d.resumen_campos), tasasPorGrupo(R)])] },
    ]);
  }

  /* ================================================================== 3. variables */
  function mapaCalor(dep) {
    const nombres = dep.candidatas, n = nombres.length, P = dep.antes.pearson, S = dep.antes.spearman;
    const quitadas = new Set(dep.decisiones.map((x) => x.se_quita));
    const celda = n > 12 ? 30 : 44, izq = 230, arr = 8, abajo = 200;
    const W = izq + n * celda + 90, H = arr + n * celda + abajo;
    const svg = lienzo(W, H, `Matriz de correlación de Pearson entre las ${n} variables candidatas, en datos de entrenamiento.`);
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
        if (i !== j && Math.abs(r) >= (n > 12 ? 0.5 : 0.15)) svg.appendChild(s("text", { x: x + celda / 2 - 1, y: y + celda / 2 + 4, "text-anchor": "middle", "pointer-events": "none",
          class: Math.abs(r) > 0.55 ? "texto-svg-fuerte" : "etiqueta-svg", fill: Math.abs(r) > 0.55 ? "var(--hoja)" : null, texto: num(r, 2) }));
        if (i < j && Math.abs(r) > 0.8) svg.appendChild(s("rect", { x: x - 1, y: y - 1, width: celda, height: celda, rx: 4, fill: "none", stroke: "var(--tinta)", "stroke-width": 2.5, "pointer-events": "none" }));
      });
    });
    return svg;
  }

  function vifPesas(dep) {
    const filas = dep.candidatas.map((n) => ({ n, a: dep.antes.vif[n], d: dep.despues.vif[n] }));
    const W = 600, izq = 270, der = 44, altoF = 28, arr = 26;
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
    const constantes = dep.decisiones.filter((x) => !x.se_queda && x.vif === undefined);
    const pares = dep.decisiones.filter((x) => x.se_queda);
    const porVif = dep.decisiones.filter((x) => x.vif !== undefined);
    const filaDec = (x) => `<tr><td><strong>${esc(nombre(x.se_quita))}</strong></td><td>${x.se_queda ? `${esc(nombre(x.se_queda))} (r = ${num(x.correlacion, 2)})`
      : x.vif !== undefined ? `VIF ${num(x.vif, 1)}` : "—"}</td><td>${esc(x.motivo)}</td></tr>`;
    secuencia(c, 3, [
      { id: "v-candidatas", titulo: `${dep.candidatas.length} candidatas`, nodos: [
        `Del contrato salen 9 campos útiles (el identificador no predice; nivel y estado son iguales para todos) más una construida, la <strong>tasa de reprobación</strong>
        = perdidas ÷ cursadas, porque perder 2 de 3 no es lo mismo que 2 de 8. El contrato ampliado suma notas del cuatrimestre, actividad, admisión, indicadoras
        de «sin dato» y la tasa de abandono de la titulación: <strong>${dep.candidatas.length} candidatas</strong> en total.`] },
      { id: "v-constantes", titulo: "Lo que no distingue a nadie", nodos: [
        `${constantes.length} candidatas valen lo mismo para todos en esta base y se quitan antes de medir: ${constantes.map((x) => `<strong>${esc(nombre(x.se_quita))}</strong>`).join(", ")}.
        El semestre es 2 para todos (primer año al cerrar el primer cuatrimestre), el estrato no existe en la base y la deuda no se usa.`] },
      { id: "v-correlacion", titulo: "Cuánto se parecen entre sí", nodos: [
        "Si dos variables cargan casi la misma información, el modelo reparte el peso entre ellas de forma inestable y hasta puede darle a una un signo al revés.",
        figura(desplazable(mapaCalor(dep)), `Correlación de Pearson en entrenamiento (rojo: suben juntas; azul: una sube y la otra baja). Los recuadros marcan
          los pares por encima de 0,8; se escriben los valores desde 0,5. Pase el puntero para ver también Spearman.`)] },
      { id: "v-vif", titulo: "VIF y qué se quitó", nodos: [
        `El <strong>VIF</strong> mide cuánto se puede adivinar una variable a partir de las demás (más de 10 es grave). Se resolvió primero cada par con |r| &gt; 0,8 y
        después lo que siguiera con VIF alto.`,
        html(`<div class="tabla-envoltura"><table><thead><tr><th>Se quita</th><th>Frente a</th><th>Por qué</th></tr></thead><tbody>${[...pares, ...porVif].map(filaDec).join("")}</tbody></table></div>`),
        figura(desplazable(vifPesas(dep)), `VIF antes (círculo vacío) y después (círculo lleno). Quedan <strong>${dep.finales.length} variables</strong>, la mayor con VIF
          ${num(Math.max(...Object.values(dep.despues.vif)), 2)}.`)] },
      { id: "v-escala", titulo: "Todas en la misma escala", nodos: [
        html(`<div class="formula">z = (x − μ) / σ<small>μ y σ se calculan solo con entrenamiento</small></div>`),
        `Sin estandarizar, los días en el aula virtual (0 a 83) dominarían los gradientes frente al promedio (0 a 5), y la regularización castigaría según las
        unidades. En el paso siguiente se ve esta transformación con un estudiante concreto.`] },
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
        figura(desplazable(reparto(t)), `El reparto de los 100 puntos. Los puntos máximos dependen del peso y del rango posible de cada variable: por eso los créditos
          inscritos y la matrícula a tiempo parcial reparten más puntos aunque pocos estudiantes estén en el extremo. Las que dan 0 puntos quedaron con peso nulo tras el tope.`)] },
      { id: "t-cortes", titulo: "Los cortes se eligen con datos", nodos: [
        `Los cortes bajo, medio y alto ya no se fijan a mano en 30 y 60: se eligen en <strong>validación</strong> con un objetivo explícito: el nivel alto
        debe capturar al menos el ${pct(cl.objetivo.recall_alto_min, 0)} de los desertores sin pasar del ${pct(cl.objetivo.fraccion_alto_max, 0)} de los estudiantes,
        y en el bajo no puede quedar más del ${pct(cl.objetivo.desertores_en_bajo_max, 0)} de los desertores.`,
        figura(desplazable(comparaCortes(cl, cr)), `La neurona marca alto desde ${cl.corte_alto} puntos: ahí captura el ${pct(cl.en_validacion.recall_alto, 0)} de los
          desertores de validación marcando al ${pct(cl.en_validacion.fraccion_alto, 0)} de los estudiantes. En la red, el puntaje es 100 × probabilidad.`)] },
      { id: "t-hallazgo", titulo: "Un hallazgo para el equipo", nodos: [
        html(`<p class="hallazgo">${cl.objetivo_cumplido ? "Se cumplen las dos condiciones del nivel alto." : `Las dos condiciones no caben a la vez: capturar el
          ${pct(cl.objetivo.recall_alto_min, 0)} de los desertores obligaría a marcar a más del ${pct(cl.objetivo.fraccion_alto_max, 0)} de los estudiantes. Con la base real
          se priorizó no desbordar a Bienestar: el alto marca al ${pct(cl.en_validacion.fraccion_alto, 0)} y detecta el ${pct(cl.en_validacion.recall_alto, 0)};
          el resto de la detección queda en medio (tutoría académica). El equipo decide si cambia ese equilibrio.`}</p>`)] },
    ]);
  }

  /* ================================================================== 6. cuánto pesa cada variable */
  function pasoPesos(c, R) {
    const co = R.control, it = co.importancia_test, nombres = it.variables, fuentes = (R.grupos && R.grupos.fuentes) || [];
    const filasG = (it.grupos || []).map((g) => ({ etiqueta: FUENTES_TXT[g.fuente] || g.fuente, log: g.logistica_pct * 100, red: g.red_pct * 100 })).sort((a, b) => b.log - a.log);
    const filas = nombres.map((n, i) => ({ etiqueta: nombre(n), log: it.logistica_pct[i] * 100, red: it.red_pct[i] * 100 })).sort((a, b) => b.log - a.log);
    const mayor = filasG.length ? filasG[0] : null;
    const items = [{ id: "w-importancia", titulo: "Importancia por permutación, por fuente de datos", nodos: [
      `Si una sola fuente carga con todo, un error en ese dato arrastra la decisión. Para medirlo se <strong>desordena una fuente entera</strong> en los datos de
      prueba y se mira cuánto empeora el modelo. Se mide por fuente (notas, actividad, admisión, titulación) porque las variables de una misma fuente se suplen
      entre sí: desordenar una sola haría creer que pesa poco.`,
      figura(grafBarras({ filas: filasG, grupos: [{ clave: "log", color: "var(--serie-1)", nombre: "neurona" }, { clave: "red", color: "var(--serie-2)", nombre: "red neuronal" }],
        formato: (v) => `${num(v, 1)} %`, max: 50, linea: { valor: 35, etiqueta: "tope 35 %" }, etiqueta: "Importancia por fuente en prueba", anchoEtiqueta: 220 }),
        mayor ? `Parte de la importancia total que se lleva cada fuente. La titulación queda en el tope por poco (${num(mayor.log, 1)} % en la neurona y
        ${num(mayor.red, 1)} % en la red): frenarla más le pasaba el peso a las notas y costaba AUC, así que se dejó y se dice.` : "",
        leyenda([["var(--serie-1)", "neurona (logística)"], ["var(--serie-2)", "red neuronal"]])),
      html(`<details><summary>Ver la importancia variable por variable</summary></details>`)] }];
    items[0].nodos[2].appendChild(figura(grafBarras({ filas, grupos: [{ clave: "log", color: "var(--serie-1)", nombre: "neurona" }, { clave: "red", color: "var(--serie-2)", nombre: "red neuronal" }],
      formato: (v) => `${num(v, 1)} %`, max: 40, etiqueta: "Importancia por variable en prueba", anchoEtiqueta: 230 }), "Parte de la importancia total de cada variable."));
    if (co.pasos_tope.length) {
      const g0 = co.antes_tope.grupos_pct_train, g1 = co.despues_tope.grupos_pct_train;
      const pasos = [{ m: "inicio", v: Math.max(...g0) }, ...co.pasos_tope.map((x) => ({ m: `×${x.multiplicador_l2}`, v: x.max_pct_train }))];
      const antes = fuentes.map((f, i) => `${FUENTES_TXT[f] || f} ${pct(g0[i], 0)}`).join(", ");
      const despues = fuentes.map((f, i) => `${FUENTES_TXT[f] || f} ${pct(g1[i], 0)}`).join(", ");
      items.push({ id: "w-tope", titulo: "El tope de dominancia (35 % por fuente)", nodos: [
        `Sin freno, la neurona dependía de dos fuentes: ${antes} (medido en entrenamiento). En cada reentrenamiento se dobla la regularización L2 de las variables
        de la fuente que más pesa, hasta que ninguna pase del 33 % (35 % menos un margen por ruido). Al final: ${despues}.`,
        figura(grafLineas({ series: [{ nombre: "fuente que más pesa", color: "var(--serie-1)", puntos: true, valores: pasos.map((x, i) => [i, x.v * 100]) }],
          alto: 220, xEtiqueta: "reentrenamiento", yEtiqueta: "% de la importancia", yMin: 25, yMax: 50, formatoY: (v) => `${num(v, 0)} %`,
          formatoX: (v) => (pasos[v] ? pasos[v].m : ""), referencias: [{ y: 35, etiqueta: "tope 35 %", color: "var(--alto)" }, { y: 33, etiqueta: "objetivo 33 %" }],
          etiqueta: "Pasos del tope de dominancia" }), `${co.pasos_tope.length} reentrenamientos. Costo en prueba: AUC de ${num(co.antes_tope.auc_test, 3)} a
          ${num(co.despues_tope.auc_test, 3)}. Se paga a cambio de que el modelo no descanse en una sola fuente.`)] });
    }
    const abl = co.ablacion.map((a) => ({ etiqueta: nombre(a.variable), valor: a.delta_auc })).sort((a, b) => a.valor - b.valor);
    items.push({ id: "w-ablacion", titulo: "Ablación: quitar una variable a la vez", nodos: [
      figura(grafBarras({ filas: abl, min: -0.11, max: 0.01, formato: (v) => num(v, 4), linea: { valor: -0.1, etiqueta: "colapso" }, anchoEtiqueta: 230,
        etiqueta: "Ablación: cambio de AUC al quitar cada variable", grupos: [{ clave: "valor", color: "var(--serie-2)" }] }),
        `Se reentrenó sin cada variable. La mayor caída de AUC es ${num(Math.min(...abl.map((a) => a.valor)), 3)}, muy lejos del colapso (−0,10): ninguna es imprescindible.`)] });
    const cambios = co.estabilidad.cambios_de_signo || [];
    items.push({ id: "w-estabilidad", titulo: "Estabilidad: entrenar con otras muestras", nodos: [
      figura(grafBarras({ filas: nombres.map((n, i) => ({ etiqueta: nombre(n), valor: co.estabilidad.pesos_media[i], sd: co.estabilidad.pesos_desv[i], color: signoColor(co.estabilidad.pesos_media[i]) })),
        min: -0.5, max: 0.5, error: "sd", formato: (v) => num(v, 2), anchoEtiqueta: 230, etiqueta: "Pesos en cinco muestras bootstrap" }),
        `Peso medio y desviación en 5 reentrenamientos con muestras distintas. ${cambios.length ? `Cambian de signo entre muestras: ${cambios.map((v) => esc(nombre(v))).join(" y ")};
        son pesos cercanos a cero, así que no conviene leer su dirección. El resto conserva el signo.` : "Ningún peso cambia de signo: lo aprendido no es casualidad de una muestra."}`)] });
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

  function pasoResultados(c, R, D) {
    const ev = R.evaluacion, m = ev.modelos, nombres = Object.keys(m), se = ev.sin_evidentes, uv = ev.una_variable;
    const log = m["regresión logística"], red_ = m["red neuronal (MLP)"], reg = m["reglas (línea base)"];
    const fila = (et, k, f, M = m) => `<tr><td>${et}</td>${nombres.map((n) => `<td class="n">${f(M[n][k])}</td>`).join("")}</tr>`;
    const items = [
      { id: "e-orden", titulo: "AUC: qué tan bien ordena a los estudiantes", nodos: [
        `Solo al final se usó el conjunto de prueba (${miles(ev.n_test)} estudiantes que ningún modelo vio; abandona el ${pct(ev.tasa_test)}). El <strong>AUC</strong> es la
        probabilidad de que el modelo ponga a quien abandonó por encima de quien siguió (0,5 es azar, 1 es perfecto).`,
        figura(grafBarras({ filas: nombres.map((n) => ({ etiqueta: n, valor: m[n].auc })), min: 0.5, max: 0.9, formato: (v) => num(v, 3), anchoEtiqueta: 180,
          linea: { valor: uv.auc_mejor, etiqueta: `mejor variable sola ${num(uv.auc_mejor, 3)}`, color: "var(--tinta-2)" }, etiqueta: "AUC en prueba por modelo",
          grupos: [{ clave: "valor", color: "var(--acento)" }] }), `La raya es la mejor variable sola (${esc(nombre(uv.mejor))}): el modelo le gana por
          ${num(log.auc - uv.auc_mejor, 3)} (logística) y ${num(red_.auc - uv.auc_mejor, 3)} (red). Las reglas escritas a mano quedan en ${num(reg.auc, 3)}.`)] },
    ];
    if (D && D.distribucion) {
      const dd = D.distribucion, centros = dd.bordes.slice(0, -1).map((b, i) => (b + dd.bordes[i + 1]) / 2);
      const corte = log.confusion ? R.entrenamiento.cortes.corte_alto : null;
      items.push({ id: "e-solape", titulo: "Por qué el AUC no sube más", nodos: [
        figura(grafLineas({ series: [{ nombre: `siguieron (${miles(dd.n_siguieron)})`, color: "var(--serie-1)", valores: centros.map((x, i) => [x, dd.siguieron[i] * 100]) },
          { nombre: `abandonaron (${miles(dd.n_desertaron)})`, color: "var(--serie-2)", valores: centros.map((x, i) => [x, dd.desertaron[i] * 100]) }],
          alto: 260, xEtiqueta: "puntaje de riesgo (tarjeta de la logística)", yEtiqueta: "% de su grupo", formatoY: (v) => `${num(v, 0)} %`,
          marcas: corte ? [{ x: corte, etiqueta: `alto desde ${corte}` }] : [], etiqueta: "Distribución del puntaje en prueba" }),
          `Las dos curvas se <strong>solapan</strong>: después de un cuatrimestre, muchos futuros desertores se ven igual que quienes siguen (mismas notas, misma
          actividad). En esa franja ningún corte los separa, y eso pone el límite. Sin los casos evidentes (quienes no aprobaron nada) el AUC baja a
          ${num(se.modelos["regresión logística"].auc, 3)} (logística) y ${num(se.modelos["red neuronal (MLP)"].auc, 3)} (red): ahí está lo difícil.`,
          leyenda([["var(--serie-1)", "siguieron"], ["var(--serie-2)", "abandonaron"]]))] });
    }
    items.push({ id: "e-niveles", titulo: "A quién marca en cada nivel", nodos: [
      figura(desplazable(mosaico(m)), `Con la logística, de cada 100 estudiantes en alto abandonan ${num(log.confusion.alto.tasa_real * 100, 0)}, ${num(log.confusion.alto.tasa_real / ev.tasa_test, 1)}
        veces el promedio; en bajo, ${num(log.confusion.bajo.tasa_real * 100, 0)}. Los niveles ordenan bien aunque el alto tenga falsas alarmas.`)] });
    if (D && D.ganancia) {
      const g = D.ganancia.puntos, g20 = g.find((x) => Math.abs(x[0] - 0.2) < 1e-9);
      items.push({ id: "e-ganancia", titulo: "Lo que vale en la práctica: la curva de ganancia", nodos: [
        figura(grafLineas({ series: [{ nombre: "azar", color: "var(--tenue)", punteado: true, valores: [[0, 0], [1, 1]] },
          { nombre: "modelo", color: "var(--acento)", valores: g }], alto: 280, xMin: 0, xMax: 1, yMin: 0, yMax: 1, formatoX: (v) => pct(v, 0), formatoY: (v) => pct(v, 0),
          xEtiqueta: "estudiantes revisados, primero los de más riesgo", yEtiqueta: "desertores encontrados",
          marcas: g20 ? [{ x: 0.2, etiqueta: `20 % → ${pct(g20[1], 0)}` }] : [], etiqueta: "Curva de ganancia en prueba" }),
          g20 ? `Si Bienestar revisa primero al 20 % de más riesgo, encuentra el ${pct(g20[1], 0)} de quienes abandonan; al azar encontraría el 20 %.` : "",
          leyenda([["var(--acento)", "modelo (logística)"], ["var(--tenue)", "azar"]]))] });
    }
    items.push({ id: "e-precision", titulo: "Por qué hay tantas falsas alarmas", nodos: [
      html(`<dl class="cifras">
        <div><dt>Detecta (recall, nivel alto)</dt><dd>${pct(log.recall, 0)}</dd></div>
        <div><dt>Aciertan las alertas (precisión)</dt><dd>${pct(log.precision, 0)}</dd></div>
        <div><dt>Abandonan en toda la prueba</dt><dd>${pct(ev.tasa_test, 0)}</dd></div></dl>`),
      `Solo abandona el ${pct(ev.tasa_test, 0)}. Aun con un buen orden, para detectar a la mayoría hay que marcar también a muchos que siguen: en alto, ${pct(log.precision, 0)}
      de las alertas son reales, ${num(log.precision / ev.tasa_test, 1)} veces la tasa del grupo. Se aceptó porque una llamada de Bienestar cuesta poco y un
      desertor que se escapa cuesta mucho.`] });
    if (D && D.barrido) {
      const fl = D.barrido.filas, md = D.modelos["regresión logística"], mx = md.f1_maximo, ec = md.en_corte_alto;
      items.push({ id: "e-f1", titulo: "F1: por qué no pasa de ~0,5", nodos: [
        figura(grafLineas({ series: [{ nombre: "detección", color: "var(--serie-2)", valores: fl.map((f) => [f.corte, f.deteccion]) },
          { nombre: "precisión", color: "var(--serie-1)", valores: fl.filter((f) => f.precision !== null && f.fraccion_marcada >= 0.02).map((f) => [f.corte, f.precision]) },
          { nombre: "F1", color: "var(--tinta)", valores: fl.map((f) => [f.corte, f.f1]) }],
          alto: 280, yMin: 0, yMax: 1, formatoY: (v) => num(v, 1), xEtiqueta: "corte del puntaje (alto desde…)", yEtiqueta: "valor",
          marcas: [{ x: R.entrenamiento.cortes.corte_alto, etiqueta: `nuestro corte ${R.entrenamiento.cortes.corte_alto}` }], etiqueta: "Detección, precisión y F1 según el corte" }),
          `La precisión se dibuja solo mientras el corte marca al menos al 2 % de los estudiantes (más arriba son unos pocos casos). Al subir el corte, la detección baja y la precisión sube; con ${pct(ev.tasa_test, 0)} de desertores se cruzan abajo. El mejor F1 posible de la logística es
          ${num(mx.f1, 2)} (corte ${mx.corte}, detecta ${pct(mx.deteccion, 0)}); con nuestro corte es ${num(ec.f1, 2)} pero detecta ${pct(ec.deteccion, 0)}. Se eligió
          detectar más porque dejar escapar a un desertor es el error más caro.`,
          leyenda([["var(--serie-2)", "detección"], ["var(--serie-1)", "precisión"], ["var(--tinta)", "F1"]])),
        html(`<div class="tabla-envoltura"><table><thead><tr><th>Modelo</th><th class="n">F1 en su corte</th><th class="n">mejor F1 con cualquier corte</th></tr></thead><tbody>
          ${nombres.map((n) => `<tr><td>${esc(n)}</td><td class="n">${num(m[n].f1, 2)}</td><td class="n">${D.modelos[n] ? num(D.modelos[n].f1_maximo.f1, 2) : "—"}</td></tr>`).join("")}</tbody></table></div>`),
        "Ningún modelo pasa de ~0,5 con estos datos: subirlo pide más señal (asistencia real, trabajo, deuda), no otro modelo."] });
    }
    items.push({ id: "e-metricas", titulo: "Todas las métricas", nodos: [
      html(`<div class="tabla-envoltura"><table><thead><tr><th>Métrica en prueba</th>${nombres.map((n) => `<th class="n">${esc(n)}</th>`).join("")}</tr></thead><tbody>
        ${fila("AUC", "auc", (v) => num(v, 3))}${fila("Log-loss (menor es mejor)", "log_loss", (v) => num(v, 3))}${fila("Brier (menor es mejor)", "brier", (v) => num(v, 3))}
        ${fila("Desertores detectados en alto", "recall", (v) => pct(v, 0))}${fila("Abandonan de verdad entre los de alto", "precision", (v) => pct(v, 0))}
        ${fila("F1 (equilibrio de las dos anteriores, de 0 a 1)", "f1", (v) => num(v, 2))}
        ${fila("Estudiantes en alto", "fraccion_alto", (v) => pct(v, 0))}${fila("Accuracy", "accuracy", (v) => pct(v, 0))}
        ${fila("AUC sin los casos evidentes", "auc", (v) => num(v, 3), se.modelos)}${fila("F1 sin los casos evidentes", "f1", (v) => num(v, 2), se.modelos)}</tbody></table></div>`),
      `La accuracy engaña: un sistema que dijera «nadie abandona» acertaría el ${pct(1 - ev.tasa_test, 0)} sin detectar a nadie. Los casos evidentes son
      ${ev.evidentes.n} estudiantes de prueba que no aprobaron ninguna materia (abandona el ${pct(ev.evidentes.tasa, 0)}); sin ellos quedan ${miles(se.n)}.`] });
    items.push({ id: "e-calibracion", titulo: "¿Las probabilidades dicen la verdad?", nodos: [
      figura(grafLineas({ series: [{ nombre: "calibración perfecta", color: "var(--tenue)", punteado: true, valores: [[0, 0], [1, 1]] },
        ...nombres.map((n, i) => ({ nombre: n, color: `var(--serie-${i + 1})`, puntos: true, valores: ev.calibracion[n].map((x) => [x[0], x[1]]) }))],
        alto: 300, xMin: 0, xMax: 1, yMin: 0, yMax: 1, xEtiqueta: "probabilidad predicha", yEtiqueta: "tasa real de abandono", formatoY: (v) => pct(v, 0), formatoX: (v) => pct(v, 0),
        etiqueta: "Curva de calibración en prueba" }),
        `Si el modelo dice 30 %, ¿abandonan 3 de cada 10? Brier: logística ${num(log.brier, 3)}, red ${num(red_.brier, 3)}, reglas ${num(reg.brier, 3)}. Las reglas no
        fueron hechas para dar probabilidades.`,
        leyenda(nombres.map((n, i) => [`var(--serie-${i + 1})`, n])))] });
    items.push({ id: "e-conclusion", titulo: "Conclusión", nodos: [html(`<p class="hallazgo">${esc(ev.conclusion)}</p>`),
      `Lo que se ve aquí es el mismo modelo que califica en <a href="estudiantes.html">Estudiantes</a> y en <a href="evaluar.html">Probar un caso</a>;
      la página <a href="modelo.html">Modelo</a> lo explica para Bienestar.`] });
    secuencia(c, 8, items);
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
        esperada, <strong>ejecutar</strong>, <strong>corregir</strong> y volver a probar con <strong>casos nuevos</strong>. Los oráculos son borradores que debe firmar el equipo.`,
        `Las rondas prueban el <strong>contrato y el comportamiento</strong> del sistema con casos escritos a mano (R01 a R03, simulados y nuevos). La ronda 4 corre
        el modo aprendido con los pesos de la corrida de referencia, entrenada a propósito con datos simulados para poder fijar los oráculos. Estas pruebas no miden
        qué tan bien predice con estudiantes reales: eso está en el <a href="resultados.html">paso 8</a>.`] },
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

  /* Dibuja un paso en #contenido. `datos` = { R, rondas, modelos, diag, base } (R = reportes/real/resultados.json) */
  function montarPaso(clave, datos) {
    const c = $("#contenido");
    c.replaceChildren();
    const { R, rondas, modelos, diag, base } = datos;
    const args = { contrato: [], datos: [R, base], variables: [R], aprendizaje: [R, modelos], red: [R, modelos], puntaje: [R], pesos: [R],
      resultados: [R, diag], pruebas: [rondas] }[clave];
    try { PASOS[clave](c, ...args); } catch (e) { console.error(clave, e); c.append(p(`No se pudo dibujar este paso (${esc(e.message)}).`)); }
    if (clave === "pruebas") $("#btn-rondas").addEventListener("click", correrRondasEnVivo);
  }

  window.SAT = Object.assign(window.SAT || {}, { montarPaso });
})();
