/* Script clásico (sin módulos) para que la página funcione también abierta como archivo. */
(function () {
  "use strict";
  /* Utilidades compartidas: formato en español, datos, tooltip y gráficas SVG pequeñas hechas a mano. */

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = (x, d = 1) => `${(100 * x).toFixed(d).replace(".", ",")} %`;
  const num = (x, d = 3) => Number(x).toFixed(d).replace(".", ",").replace("-", "−");
  const miles = (x) => Number(x).toLocaleString("es-CO");

  async function json(ruta) {
    const r = await fetch(ruta, { cache: "no-cache" });
    if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
    return r.json();
  }

  const NOMBRES = {
    semestre: "semestre", promedio_acumulado: "promedio", creditos_inscritos: "créditos inscritos",
    materias_cursadas_periodo_anterior: "materias cursadas", materias_reprobadas: "materias reprobadas",
    tasa_reprobacion: "tasa de reprobación", porcentaje_asistencia: "asistencia", estrato: "estrato",
    trabaja: "trabaja", deuda_matricula: "deuda de matrícula",
  };
  const nombre = (v) => NOMBRES[v] || v;
  const ACCIONES = {
    seguimiento_rutinario: "seguimiento rutinario",
    tutoria_academica: "tutoría académica",
    remision_bienestar_y_tutoria: "remisión a bienestar y tutoría",
  };
  const MOTIVOS = {
    campo_faltante: "falta un dato obligatorio",
    datos_contradictorios: "los datos se contradicen",
    fuera_de_poblacion: "el estudiante no es de la población (pregrado, activo, semestres 2 a 4)",
    tipo_invalido: "un dato tiene el tipo equivocado",
    fuera_de_rango: "un dato está fuera del rango permitido",
    valor_no_permitido: "un dato no está en la lista de valores permitidos",
    error_interno: "ocurrió un imprevisto interno",
    modelo_no_disponible: "el modelo entrenado no está disponible",
  };

  /* ------------------------------------------------------------------ tooltip */
  const globo = () => document.getElementById("globo");
  function mostrarGlobo(evento, html) {
    const g = globo();
    g.innerHTML = html;
    g.hidden = false;
    const { innerWidth: W, innerHeight: H } = window;
    const r = g.getBoundingClientRect();
    let x = evento.clientX + 14, y = evento.clientY + 14;
    if (x + r.width > W - 8) x = evento.clientX - r.width - 14;
    if (y + r.height > H - 8) y = evento.clientY - r.height - 14;
    g.style.left = `${Math.max(8, x)}px`;
    g.style.top = `${Math.max(8, y)}px`;
  }
  function ocultarGlobo() { globo().hidden = true; }
  function conGlobo(el, html) {
    el.addEventListener("pointermove", (e) => mostrarGlobo(e, typeof html === "function" ? html(e) : html));
    el.addEventListener("pointerleave", ocultarGlobo);
    return el;
  }

  /* ------------------------------------------------------------------ SVG */
  const NS = "http://www.w3.org/2000/svg";
  const PROPIEDADES_CSS = new Set(["fill", "stroke", "opacity", "fill-opacity", "stroke-opacity"]);
  /* Crea un elemento SVG. Los colores con var(--token) van en style para que sigan el tema. */
  function s(tag, attrs = {}, hijos = []) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      if (k === "texto") el.textContent = v;
      else if (PROPIEDADES_CSS.has(k) && String(v).includes("var(")) el.style.setProperty(k, v);
      else el.setAttribute(k, v);
    }
    for (const h of [].concat(hijos)) if (h) el.appendChild(h);
    return el;
  }
  function lienzo(ancho, alto, etiqueta) {
    return s("svg", { viewBox: `0 0 ${ancho} ${alto}`, role: "img", "aria-label": etiqueta });
  }
  function escala(d0, d1, r0, r1) {
    const f = (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
    f.invertir = (p) => d0 + ((p - r0) / (r1 - r0 || 1)) * (d1 - d0);
    return f;
  }
  function marcasBonitas(min, max, n = 5) {
    const paso0 = (max - min) / n;
    const mag = 10 ** Math.floor(Math.log10(paso0 || 1));
    const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= paso0) || mag * 10;
    const marcas = [];
    for (let v = Math.ceil(min / paso) * paso; v <= max + paso * 1e-9; v += paso) marcas.push(+v.toFixed(10));
    return marcas;
  }
  function figura(svgEl, pie, extra) {
    const f = document.createElement("figure");
    f.className = "grafica";
    if (extra) f.appendChild(extra);
    f.appendChild(svgEl);
    if (pie) { const c = document.createElement("figcaption"); c.innerHTML = pie; f.appendChild(c); }
    return f;
  }
  function leyenda(items) {
    const d = document.createElement("div");
    d.className = "leyenda";
    d.innerHTML = items.map(([color, texto, tipo]) => `<span><i class="${tipo || ""}" style="background:${color}"></i>${esc(texto)}</span>`).join("");
    return d;
  }

  /* Gráfica de líneas con cuadrícula, ejes y una guía vertical que sigue al puntero. */
  function grafLineas({ series, ancho = 620, alto = 260, xEtiqueta = "", yEtiqueta = "", formatoY = (v) => num(v, 2),
    formatoX = (v) => v, yMin, yMax, xMin, xMax, marcas = [], referencias = [], etiqueta = "Gráfica de líneas" }) {
    const m = { izq: 52, der: 16, arr: 14, aba: 40 };
    const todos = series.flatMap((se) => se.valores);
    const x0 = xMin ?? Math.min(...todos.map((p) => p[0])), x1 = xMax ?? Math.max(...todos.map((p) => p[0]));
    const y0 = yMin ?? Math.min(...todos.map((p) => p[1])), y1 = yMax ?? Math.max(...todos.map((p) => p[1]));
    const X = escala(x0, x1, m.izq, ancho - m.der), Y = escala(y0, y1, alto - m.aba, m.arr);
    const svg = lienzo(ancho, alto, etiqueta);
    const cuad = s("g", { class: "cuadricula" });
    const ejeY = s("g", { class: "eje" });
    for (const v of marcasBonitas(y0, y1, 4)) {
      cuad.appendChild(s("line", { x1: m.izq, x2: ancho - m.der, y1: Y(v), y2: Y(v) }));
      ejeY.appendChild(s("text", { x: m.izq - 8, y: Y(v) + 4, "text-anchor": "end", texto: formatoY(v) }));
    }
    const ejeX = s("g", { class: "eje" });
    ejeX.appendChild(s("line", { x1: m.izq, x2: ancho - m.der, y1: alto - m.aba, y2: alto - m.aba }));
    for (const v of marcasBonitas(x0, x1, 6)) ejeX.appendChild(s("text", { x: X(v), y: alto - m.aba + 16, "text-anchor": "middle", texto: formatoX(v) }));
    if (xEtiqueta) ejeX.appendChild(s("text", { x: (m.izq + ancho - m.der) / 2, y: alto - 4, "text-anchor": "middle", texto: xEtiqueta }));
    if (yEtiqueta) ejeY.appendChild(s("text", { x: 4, y: 9, texto: yEtiqueta, "text-anchor": "start" }));
    svg.append(cuad, ejeY, ejeX);
    for (const r of referencias) {
      svg.appendChild(s("line", { x1: m.izq, x2: ancho - m.der, y1: Y(r.y), y2: Y(r.y), stroke: r.color || "var(--tenue)", "stroke-dasharray": "5 4", "stroke-width": 1.5 }));
      svg.appendChild(s("text", { x: ancho - m.der, y: Y(r.y) - 5, "text-anchor": "end", class: "etiqueta-svg", texto: r.etiqueta }));
    }
    for (const mk of marcas) {
      svg.appendChild(s("line", { x1: X(mk.x), x2: X(mk.x), y1: m.arr, y2: alto - m.aba, stroke: "var(--tenue)", "stroke-dasharray": "3 3" }));
      svg.appendChild(s("text", { x: X(mk.x) + 5, y: m.arr + 10, class: "etiqueta-svg", texto: mk.etiqueta }));
    }
    for (const se of series) {
      const d = se.valores.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");
      svg.appendChild(s("path", { d, fill: "none", stroke: se.color, "stroke-width": se.grosor || 2, "stroke-linejoin": "round", "stroke-dasharray": se.punteado ? "5 4" : null }));
      if (se.puntos) for (const p of se.valores) svg.appendChild(s("circle", { cx: X(p[0]), cy: Y(p[1]), r: 4, fill: se.color, stroke: "var(--hoja)", "stroke-width": 2 }));
    }
    // guía que sigue al puntero
    const guia = s("line", { y1: m.arr, y2: alto - m.aba, stroke: "var(--tinta-2)", "stroke-width": 1, opacity: 0 });
    const puntos = series.map((se) => s("circle", { r: 4.5, fill: se.color, stroke: "var(--hoja)", "stroke-width": 2, opacity: 0 }));
    svg.append(guia, ...puntos);
    const blanco = s("rect", { x: m.izq, y: m.arr, width: ancho - m.izq - m.der, height: alto - m.arr - m.aba, class: "blanco-hover" });
    svg.appendChild(blanco);
    blanco.addEventListener("pointermove", (e) => {
      const caja = svg.getBoundingClientRect();
      const px = ((e.clientX - caja.left) / caja.width) * ancho;
      const xv = X.invertir(px);
      let filas = [];
      let xMostrado = null;
      series.forEach((se, i) => {
        const p = se.valores.reduce((a, b) => (Math.abs(b[0] - xv) < Math.abs(a[0] - xv) ? b : a));
        xMostrado = p[0];
        puntos[i].setAttribute("cx", X(p[0])); puntos[i].setAttribute("cy", Y(p[1])); puntos[i].setAttribute("opacity", 1);
        filas.push(`<span style="color:${se.color}">■</span> ${esc(se.nombre)}: <b>${formatoY(p[1])}</b>`);
      });
      guia.setAttribute("x1", X(xMostrado)); guia.setAttribute("x2", X(xMostrado)); guia.setAttribute("opacity", 0.5);
      mostrarGlobo(e, `<b>${esc(xEtiqueta || "x")} ${formatoX(xMostrado)}</b><br>${filas.join("<br>")}`);
    });
    blanco.addEventListener("pointerleave", () => { ocultarGlobo(); guia.setAttribute("opacity", 0); puntos.forEach((p) => p.setAttribute("opacity", 0)); });
    svg.ejes = { X, Y, m, ancho, alto };
    return svg;
  }

  /* Barras horizontales; `grupos` permite dos barras por fila (ej. logística y red). */
  function grafBarras({ filas, grupos = [{ clave: "valor", color: "var(--serie-1)", nombre: "" }], ancho = 620,
    formato = (v) => num(v, 2), min = 0, max, linea, etiqueta = "Gráfica de barras", anchoEtiqueta = 150, error }) {
    const altoFila = grupos.length > 1 ? 30 : 24;
    const m = { izq: anchoEtiqueta, der: 64, arr: linea ? 22 : 8, aba: 8 };
    const alto = m.arr + filas.length * altoFila + m.aba;
    const maxV = max ?? Math.max(...filas.flatMap((f) => grupos.map((g) => f[g.clave] + (error ? f[error] || 0 : 0))));
    const X = escala(min, maxV, m.izq, ancho - m.der);
    const svg = lienzo(ancho, alto, etiqueta);
    if (min < 0) svg.appendChild(s("line", { x1: X(0), x2: X(0), y1: m.arr - 4, y2: alto - m.aba, stroke: "var(--tenue)" }));
    filas.forEach((f, i) => {
      const y = m.arr + i * altoFila;
      svg.appendChild(s("text", { x: m.izq - 10, y: y + altoFila / 2 + 4, "text-anchor": "end", class: "texto-svg", texto: f.etiqueta }));
      const alturaBarra = (altoFila - 8) / grupos.length;
      grupos.forEach((g, j) => {
        const v = f[g.clave];
        const xa = X(Math.min(0, v) < 0 ? v : Math.max(min, 0)), xb = X(Math.max(0, v));
        const yb = y + 4 + j * alturaBarra;
        const barra = s("rect", { x: Math.min(xa, xb), y: yb, width: Math.max(1, Math.abs(xb - xa)), height: alturaBarra - 2, rx: 2,
          fill: f.color || g.color });
        conGlobo(barra, `<b>${esc(f.etiqueta)}</b>${g.nombre ? ` · ${esc(g.nombre)}` : ""}<br>${formato(v)}${f.detalle ? "<br>" + f.detalle : ""}`);
        svg.appendChild(barra);
        if (error && f[error] !== undefined) {
          const e0 = X(v - f[error]), e1 = X(v + f[error]), ym = yb + (alturaBarra - 2) / 2;
          svg.appendChild(s("line", { x1: e0, x2: e1, y1: ym, y2: ym, stroke: "var(--tinta)", "stroke-width": 1.5 }));
          svg.appendChild(s("line", { x1: e0, x2: e0, y1: ym - 4, y2: ym + 4, stroke: "var(--tinta)", "stroke-width": 1.5 }));
          svg.appendChild(s("line", { x1: e1, x2: e1, y1: ym - 4, y2: ym + 4, stroke: "var(--tinta)", "stroke-width": 1.5 }));
        }
        const xt = v >= 0 ? Math.max(xa, xb) + 6 : Math.min(xa, xb) - 6;
        if (grupos.length === 1 || alturaBarra >= 10)
          svg.appendChild(s("text", { x: error ? X(v + (f[error] || 0)) + 6 : xt, y: yb + alturaBarra / 2 + 3, "text-anchor": v >= 0 || error ? "start" : "end",
            class: "etiqueta-svg", texto: formato(v) }));
      });
    });
    if (linea) {
      svg.appendChild(s("line", { x1: X(linea.valor), x2: X(linea.valor), y1: m.arr - 6, y2: alto - m.aba, stroke: linea.color || "var(--alto)", "stroke-dasharray": "5 4", "stroke-width": 1.5 }));
      svg.appendChild(s("text", { x: X(linea.valor), y: 12, "text-anchor": "middle", class: "etiqueta-svg", texto: linea.etiqueta, fill: linea.color || "var(--alto)" }));
    }
    return svg;
  }

  window.SAT = Object.assign(window.SAT || {}, { $, esc, pct, num, miles, json, NOMBRES, nombre, ACCIONES, MOTIVOS, mostrarGlobo, ocultarGlobo, conGlobo, s, lienzo, escala, marcasBonitas, figura, leyenda, grafLineas, grafBarras });
})();
