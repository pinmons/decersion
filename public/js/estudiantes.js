/* Script clásico (sin módulos). Vista Estudiantes (base de datos real).
   - El flujo del proceso automático: base → validación → modelo → resultado, con fichas que viajan.
   - Un tablero con cuatro gráficas de la cohorte.
   - La lista agrupada por nivel y la ficha de cada estudiante: por qué y en qué mejorar.
   La página nunca recalcula el modelo: todo viene de /api/estudiantes. */
(function () {
  "use strict";
  const { $, esc, pct, num, miles, json, nombre, ACCIONES, MOTIVOS, conGlobo, s, lienzo, escala, aparecer, reducido } = window.SAT;

  const NOMBRE_MODELO = { logistica: "regresión logística", red_neuronal: "red neuronal", reglas: "reglas del contrato" };
  const NIVELES = ["alto", "medio", "bajo"];
  const TITULO = { alto: "Riesgo alto", medio: "Riesgo medio", bajo: "Riesgo bajo", devuelto: "Devueltos al registro" };
  const CHIPS = [["todos", "Todos"], ["alto", "Alto"], ["medio", "Medio"], ["bajo", "Bajo"], ["devuelto", "Devueltos"]];
  const DESENLACE = { abandono: "Abandonó la titulación", sigue: "No abandonó" };
  const CURVA = "cubic-bezier(0.23, 1, 0.32, 1)";
  const PASO = 20; // estudiantes por tanda en la lista
  const entero = (x) => num(x, 0);
  const html = (texto) => { const d = document.createElement("div"); d.innerHTML = texto; return d.firstElementChild; };
  const modeloElegido = () => (document.querySelector('input[name="modelo-operacion"]:checked') || {}).value || "logistica";
  /* Con nivel (definitivo o provisional) va a su nivel; sin nivel, el registro se devolvió. */
  const grupoDe = (e) => e.nivel || "devuelto";
  const E = { datos: null, filtro: "todos", texto: "", titulacion: "", visibles: PASO, elegido: null, deCopia: false, todasTitulaciones: false };

  function cuentas() {
    const c = { todos: 0, alto: 0, medio: 0, bajo: 0, devuelto: 0, provisional: { alto: 0, medio: 0, bajo: 0 } };
    for (const e of E.datos.estudiantes) {
      c.todos++; c[grupoDe(e)]++;
      if (e.decision === "provisional") c.provisional[e.nivel]++;
    }
    return c;
  }

  function filtrados() {
    const t = E.texto.trim().toLowerCase();
    return E.datos.estudiantes.filter((e) => (E.filtro === "todos" || grupoDe(e) === E.filtro)
      && (!E.titulacion || e.titulacion === E.titulacion) && (!t || e.id.toLowerCase().includes(t)));
  }

  function filtrar(cambios) {
    Object.assign(E, cambios, { visibles: PASO });
    $("#titulacion").value = E.titulacion;
    pintarChips(); pintarLista();
  }

  /* ================================================================== el flujo vivo */
  function contar(el, hasta, formato = miles) {
    if (reducido() || !window.requestAnimationFrame) { el.textContent = formato(hasta); return; }
    const t0 = performance.now(), dura = 700;
    const cuadro = (t) => {
      const k = Math.min(1, (t - t0) / dura);
      el.textContent = formato(hasta * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(cuadro);
    };
    requestAnimationFrame(cuadro);
  }

  /* Reparte n fichas entre los grupos en proporción a sus cuentas (resto mayor). */
  function repartir(n, grupos) {
    const total = grupos.reduce((a, [, c]) => a + c, 0) || 1;
    const partes = grupos.map(([k, c]) => ({ k, n: Math.floor((n * c) / total), resto: ((n * c) / total) % 1 }));
    let faltan = n - partes.reduce((a, p) => a + p.n, 0);
    for (const p of [...partes].sort((a, b) => b.resto - a.resto)) { if (faltan-- <= 0) break; p.n++; }
    return partes.flatMap((p) => Array(p.n).fill(p.k));
  }

  /* Dieciséis fichas salen de la base y saltan de estación en estación (280 ms por salto, solo transform y
     opacity). Las devueltas se quedan en la validación; las demás llegan al resultado con el color de su nivel. */
  function correrFichas(c) {
    const carril = $("#flujo .flujo-carril");
    if (!carril) return;
    carril.replaceChildren();
    const ancho = carril.getBoundingClientRect().width;
    if (!ancho || reducido() || !carril.animate) return;
    const tramo = ancho / 4, pos = (k, extra = 0, y = 0) => `translate(${k * tramo + extra}px, ${y}px)`;
    const destino = repartir(16, [["alto", c.alto], ["medio", c.medio], ["bajo", c.bajo], ["devuelto", c.devuelto]]);
    const puesto = { alto: 0, medio: 0, bajo: 0, devuelto: 0 };
    let llegados = 0;
    destino.sort(() => 0.5 - Math.random()).forEach((d, i) => {
      const f = document.createElement("i");
      f.className = "ficha-viaje";
      carril.appendChild(f);
      const devuelta = d === "devuelto";
      const cuadros = devuelta
        ? [{ transform: pos(0), opacity: 0 }, { transform: pos(0), opacity: 1, offset: 0.1 }, { transform: pos(1), opacity: 1, offset: 0.7 },
          { transform: pos(1, 18 + puesto.devuelto++ * 10, 12), opacity: 1 }]
        : [{ transform: pos(0), opacity: 0 }, { transform: pos(0), opacity: 1, offset: 0.04 }, { transform: pos(1), offset: 0.28 }, { transform: pos(1), offset: 0.38 },
          { transform: pos(2), offset: 0.62 }, { transform: pos(2), offset: 0.72 }, { transform: pos(3, 18 + llegados++ * 10), opacity: 1 }];
      const anim = f.animate(cuadros, { duration: devuelta ? 420 : 1100, delay: 150 + i * 80, easing: CURVA, fill: "forwards" });
      anim.onfinish = () => f.classList.add(`llego-${d}`);
    });
  }

  function pintarFlujo() {
    const d = E.datos, ej = d.ejecucion, c = cuentas();
    const sinHistorial = ej.provisionales || 0;  // el contrato no los califica: van al modelo de ingreso
    const estaciones = [
      ["Base de datos", ej.leidos, miles, "registros leídos", `${esc(d.base.archivo)}`],
      ["Validación", ej.calificados, miles, "pasan el contrato", `${miles(sinHistorial)} provisionales · ${miles(ej.con_error + (ej.a_revision || 0))} devueltos`],
      ["Modelo", ej.ms_lectura + ej.ms_modelo, (v) => `${entero(v)} ms`, "para calificarlos a todos", esc(NOMBRE_MODELO[ej.modelo]) + (sinHistorial ? " + modelo de ingreso" : "")],
      ["Resultado", c.alto, miles, "en riesgo alto", `${miles(c.medio)} en medio · ${miles(c.bajo)} en bajo`],
    ];
    const flujo = $("#flujo");
    flujo.innerHTML = `<div class="flujo-carril" aria-hidden="true"></div><ol class="flujo-pasos">${estaciones.map(([t, , , que, sub]) => `<li class="estacion">
      <span class="rotulo">${t}</span><b class="estacion-cifra num">0</b><span class="estacion-que">${que}</span><span class="estacion-sub">${sub}</span></li>`).join("")}</ol>`;
    flujo.querySelectorAll(".estacion-cifra").forEach((el, i) => contar(el, estaciones[i][1], estaciones[i][2]));
    aparecer(flujo.querySelectorAll(".estacion"), { pausa: 120, duracion: 280, desde: "translateY(6px)" });
    correrFichas(c);
    const fecha = new Date(ej.fecha);
    $("#estado-lectura").textContent = E.deCopia
      ? "No se pudo consultar la base en este momento. Se muestra la copia de la última corrida guardada."
      : `Leída y calificada hoy a las ${fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/\.$/, "")}. El proceso corre solo cada vez que se abre esta página.`;
    $("#modelo-actual").textContent = NOMBRE_MODELO[ej.modelo];
    const avisos = d.avisos || [];
    $("#avisos").innerHTML = avisos.length ? `<p class="aviso-registro"><span class="rotulo">El sistema ya le pidió al registro</span>
      ${avisos.map((a) => `<span>${esc(a.texto)}</span>`).join("")}</p>` : "";
  }

  /* ================================================================== el tablero */
  function celda(clases, rotulo, titulo, nodos, nota) {
    const c = html(`<section class="celda ${clases}"><p class="rotulo">${rotulo}</p><h2>${titulo}</h2></section>`);
    for (const n of [].concat(nodos)) if (n) c.appendChild(n);
    if (nota) c.appendChild(html(`<p class="nota">${nota}</p>`));
    return c;
  }

  /* 1. Cuántos hay en cada nivel. La parte rayada son resultados provisionales. Pulsar filtra la lista. */
  function graficaReparto(c) {
    const conResultado = c.alto + c.medio + c.bajo;
    const caja = html(`<div class="reparto"><div class="reparto-cifra"><b class="cifra-grande">${miles(c.alto)}</b>
      <span>en riesgo alto, de ${miles(conResultado)} con resultado</span></div><div class="reparto-barra" role="img" aria-label="Reparto por nivel"></div><ul class="reparto-leyenda"></ul></div>`);
    const barra = caja.querySelector(".reparto-barra"), leyenda = caja.querySelector("ul");
    for (const n of [...NIVELES, "devuelto"]) {
      if (!c[n]) continue;
      const prov = n === "devuelto" ? 0 : c.provisional[n];
      const seg = html(`<span class="tramo tramo-${n}" style="flex-grow:${c[n]}">${prov ? `<i style="width:${(100 * prov) / c[n]}%"></i>` : ""}</span>`);
      conGlobo(seg, `<b>${TITULO[n]}</b><br>${miles(c[n])} estudiantes (${pct(c[n] / c.todos, 0)})${prov ? `<br>${miles(prov)} con resultado provisional` : ""}`);
      barra.appendChild(seg);
      const li = html(`<li><button type="button" data-grupo="${n}"><i class="punto punto-${n}" aria-hidden="true"></i><span>${TITULO[n]}</span><b class="num">${miles(c[n])}</b></button></li>`);
      leyenda.appendChild(li);
    }
    caja.addEventListener("click", (ev) => { const b = ev.target.closest("[data-grupo]"); if (b) filtrar({ filtro: b.dataset.grupo }); });
    const prov = c.provisional.alto + c.provisional.medio + c.provisional.bajo;
    return celda("c4", "Hoy", "Cuántos hay en cada nivel", caja, prov ? `La parte rayada (${miles(prov)}) es resultado provisional: el contrato no los pudo calificar y se usaron los datos de su matrícula.` : "");
  }

  /* 2. Distribución de los puntajes definitivos, con los cortes y lo que pasó de verdad en cada tramo. */
  function graficaPuntajes() {
    const d = E.datos, cortes = d.cortes;
    const definitivos = d.estudiantes.filter((e) => e.decision === "resultado");
    if (!definitivos.length || !cortes) return null;
    const paso = 5, cajas = Array.from({ length: 100 / paso }, (_, i) => ({ desde: i * paso, si: 0, no: 0 }));
    for (const e of definitivos) { const b = cajas[Math.min(cajas.length - 1, Math.floor(e.puntaje / paso))]; e.desenlace === "abandono" ? b.si++ : b.no++; }
    const W = 680, H = 250, m = { izq: 34, der: 8, arr: 30, aba: 30 };
    const maximo = Math.max(...cajas.map((b) => b.si + b.no));
    const X = escala(0, 100, m.izq, W - m.der), Y = escala(0, maximo, H - m.aba, m.arr);
    const svg = lienzo(W, H, `Distribución de ${definitivos.length} puntajes de 0 a 100; el nivel medio empieza en ${cortes.corte_medio} y el alto en ${cortes.corte_alto}.`);
    const bandas = [["bajo", 0, cortes.corte_medio], ["medio", cortes.corte_medio, cortes.corte_alto], ["alto", cortes.corte_alto, 100]];
    for (const [n, a, b] of bandas) {
      svg.appendChild(s("rect", { x: X(a), y: m.arr - 18, width: X(b) - X(a), height: H - m.aba - m.arr + 18, fill: `var(--${n}-fondo)`, opacity: 0.7 }));
      if (X(b) - X(a) > 34) svg.appendChild(s("text", { x: X(a) + 5, y: m.arr - 5, class: "etiqueta-svg", texto: n }));
    }
    for (const v of [0, Math.round(maximo / 2), maximo]) svg.appendChild(s("text", { x: m.izq - 6, y: Y(v) + 4, "text-anchor": "end", class: "etiqueta-svg", texto: v }));
    for (const v of [0, 25, 50, 75, 100]) svg.appendChild(s("text", { x: X(v), y: H - m.aba + 15, "text-anchor": v === 100 ? "end" : v ? "middle" : "start", class: "etiqueta-svg", texto: v }));
    svg.appendChild(s("text", { x: (m.izq + W - m.der) / 2, y: H - 2, "text-anchor": "middle", class: "etiqueta-svg", texto: "puntaje de riesgo" }));
    svg.appendChild(s("line", { x1: m.izq, x2: W - m.der, y1: H - m.aba, y2: H - m.aba, stroke: "var(--tenue)" }));
    const ancho = X(paso) - X(0) - 2;
    for (const b of cajas) {
      if (!(b.si + b.no)) continue;
      const g = s("g", { class: "barra-puntaje" });
      const ySi = Y(b.si), yTodo = Y(b.si + b.no);
      if (b.no) g.appendChild(s("rect", { x: X(b.desde) + 1, y: yTodo, width: ancho, height: Math.max(1, ySi - yTodo - (b.si ? 2 : 0)), rx: 2, fill: "var(--tenue)", opacity: 0.5 }));
      if (b.si) g.appendChild(s("rect", { x: X(b.desde) + 1, y: ySi, width: ancho, height: Y(0) - ySi, rx: 2, fill: "var(--tinta)" }));
      g.appendChild(s("rect", { x: X(b.desde), y: m.arr, width: ancho + 2, height: H - m.aba - m.arr, fill: "transparent" }));
      conGlobo(g, `<b>Puntaje ${b.desde} a ${b.desde + paso - 1 + (b.desde + paso === 100 ? 1 : 0)}</b><br>${miles(b.si + b.no)} estudiantes<br>${miles(b.si)} abandonaron (${pct(b.si / (b.si + b.no), 0)})`);
      svg.appendChild(g);
    }
    const fig = html(`<figure class="grafica"><div class="leyenda"><span><i class="punto" style="background:var(--tinta)"></i>abandonó</span>
      <span><i class="punto" style="background:var(--tenue);opacity:.5"></i>no abandonó</span></div></figure>`);
    fig.appendChild(svg);
    return celda("c8", "Puntajes", "Entre más puntaje, más abandonaron de verdad", fig,
      `Cada barra junta 5 puntos. Las franjas son los niveles: medio desde ${cortes.corte_medio}, alto desde ${cortes.corte_alto}. Solo resultados definitivos (${miles(definitivos.length)}).`);
  }

  /* 3. Riesgo por titulación: composición de cada una, de la que más tiene en alto a la que menos. Pulsar filtra.
     Las titulaciones vienen cifradas en la fuente: se muestran con un código (T01 = la de más estudiantes). */
  function graficaTitulaciones() {
    const por = {};
    for (const e of E.datos.estudiantes) {
      if (!e.nivel) continue;
      const p = (por[e.titulacion] = por[e.titulacion] || { titulacion: e.titulacion, alto: 0, medio: 0, bajo: 0, n: 0 });
      p[e.nivel]++; p.n++;
    }
    // Con menos de 10 estudiantes un porcentaje engaña: esas van al final.
    const filas = Object.values(por).sort((a, b) => (b.n >= 10) - (a.n >= 10) || b.alto / b.n - a.alto / a.n);
    if (!filas.length) return null;
    const visibles = E.todasTitulaciones ? filas : filas.slice(0, 7);
    const caja = html(`<div class="programas"></div>`);
    for (const p of visibles) {
      const fila = html(`<button type="button" class="programa-fila" data-titulacion="${esc(p.titulacion)}" aria-pressed="${E.titulacion === p.titulacion}">
        <span class="programa-nombre">${esc(p.titulacion)} <small class="num">· ${miles(p.n)}</small></span>
        <span class="programa-barra" aria-hidden="true">${NIVELES.map((n) => (p[n] ? `<i class="tramo-${n}" style="flex-grow:${p[n]}"></i>` : "")).join("")}</span>
        <b class="num">${pct(p.alto / p.n, 0)}</b></button>`);
      conGlobo(fila, `<b>${esc(p.titulacion)}</b><br>${miles(p.n)} estudiantes<br>${miles(p.alto)} en alto · ${miles(p.medio)} en medio · ${miles(p.bajo)} en bajo`);
      caja.appendChild(fila);
    }
    if (filas.length > 7) caja.appendChild(html(`<button type="button" class="enlace-boton" data-todos="1">${E.todasTitulaciones ? "Ver solo las 7 primeras" : `Ver las ${filas.length} titulaciones`}</button>`));
    caja.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-todos]")) { E.todasTitulaciones = !E.todasTitulaciones; pintarTablero(); return; }
      const b = ev.target.closest("[data-titulacion]");
      if (!b) return;
      filtrar({ titulacion: E.titulacion === b.dataset.titulacion ? "" : b.dataset.titulacion });
      caja.querySelectorAll("[data-titulacion]").forEach((x) => x.setAttribute("aria-pressed", String(E.titulacion === x.dataset.titulacion)));
    });
    return celda("c7", "Titulaciones", "Dónde se concentra el riesgo alto", [html(`<div class="leyenda">${NIVELES.map((n) => `<span><i class="punto punto-${n}"></i>${n}</span>`).join("")}<span class="leyenda-derecha">% en alto</span></div>`), caja],
      "La fuente cifra las titulaciones: se muestran con un código. Las de menos de 10 estudiantes van al final. Pulse una para ver solo a sus estudiantes.");
  }

  /* 4. Lo que pasó de verdad en cada nivel (la base es histórica y trae el desenlace). */
  function graficaAciertos() {
    const n = E.datos.niveles;
    if (!NIVELES.some((k) => n[k].n)) return null;
    const caja = html(`<div class="aciertos"></div>`);
    for (const k of NIVELES) {
      const tasa = n[k].n ? n[k].desertaron / n[k].n : 0;
      const fila = html(`<div class="acierto"><span class="acierto-nivel"><i class="punto punto-${k}" aria-hidden="true"></i>${k}</span>
        <span class="acierto-barra" aria-hidden="true"><i class="tramo-${k}" style="width:${Math.max(1, 100 * tasa)}%"></i></span><b class="num">${pct(tasa, 0)}</b></div>`);
      conGlobo(fila, `<b>Nivel ${k}</b><br>${miles(n[k].desertaron)} de ${miles(n[k].n)} abandonaron`);
      caja.appendChild(fila);
    }
    const ing = E.datos.ingreso;
    const tasa = NIVELES.reduce((a, k) => a + n[k].desertaron, 0) / Math.max(1, NIVELES.reduce((a, k) => a + n[k].n, 0));
    return celda("c5", "Contra la realidad", "De cada nivel, cuántos abandonaron", caja,
      `En total abandonó el ${pct(tasa, 0)}. Si el modelo sirve, en alto abandonan varias veces más que en bajo; con tan pocos abandonos, ni en alto son mayoría. Resultados definitivos.${ing ? ` El modelo de ingreso (provisionales) es más débil: AUC ${num(ing.auc, 2)}.` : ""} Las demás notas están en <a href="modelo.html">Modelo</a>.`);
  }

  function pintarTablero() {
    const t = $("#tablero");
    t.replaceChildren(...[graficaReparto(cuentas()), graficaPuntajes(), graficaTitulaciones(), graficaAciertos()].filter(Boolean));
  }

  /* ================================================================== filtros y lista */
  function pintarChips() {
    const c = cuentas();
    $("#chips").innerHTML = CHIPS.filter(([k]) => k === "todos" || c[k]).map(([k, t]) => `<button type="button" class="chip chip-${k}" data-grupo="${k}" aria-pressed="${E.filtro === k}">
      <i aria-hidden="true"></i>${t}<b class="num">${miles(c[k])}</b></button>`).join("");
    const sel = $("#titulacion");
    if (sel.options.length <= 1) sel.innerHTML = `<option value="">Todas las titulaciones</option>` + (E.datos.titulaciones || []).map((p) => `<option>${esc(p)}</option>`).join("");
    sel.value = E.titulacion;
  }

  function pintarLista() {
    const todos = filtrados(), lista = todos.slice(0, E.visibles);
    const totales = {};
    for (const e of todos) totales[grupoDe(e)] = (totales[grupoDe(e)] || 0) + 1;
    let anterior = null;
    const partes = lista.map((e) => {
      const g = grupoDe(e);
      const cabeza = g !== anterior ? `<li class="grupo grupo-${g}"><i class="punto punto-${g}" aria-hidden="true"></i><span>${TITULO[g]}</span><b class="num">${miles(totales[g])}</b></li>` : "";
      anterior = g;
      const derecha = e.nivel
        ? `<span class="fila-barra${e.decision === "provisional" ? " provisional" : ""}" aria-hidden="true"><i class="tramo-${e.nivel}" style="width:${Math.max(2, e.puntaje)}%"></i></span><span class="fila-puntaje num">${e.puntaje}</span>`
        : `<span class="fila-motivo">${esc(MOTIVOS[e.motivo] || e.motivo)}</span>`;
      return `${cabeza}<li><button type="button" class="fila-est" data-id="${esc(e.id)}" aria-pressed="${E.elegido === e.id}">
        <span class="fila-id"><b>${esc(e.id)}</b><small>${esc(e.titulacion)}</small>${e.decision === "provisional" ? `<em class="marca-prov">provisional</em>` : ""}</span>${derecha}</button></li>`;
    });
    $("#lista").innerHTML = partes.join("") || `<li class="lista-vacia">Ningún estudiante con ese filtro.</li>`;
    $("#cuenta-lista").textContent = todos.length ? `${miles(lista.length)} de ${miles(todos.length)}, del puntaje más alto al más bajo.` : "";
    $("#btn-mas").hidden = lista.length >= todos.length;
    if (!todos.some((e) => e.id === E.elegido)) elegir(todos.length ? todos[0].id : null, false);
  }

  /* ================================================================== la ficha */
  function veredictoReal(e) {
    const deserto = e.desenlace === "abandono", avisado = e.nivel === "alto";
    if (avisado && deserto) return ["acierto", "El modelo avisó a tiempo."];
    if (avisado) return ["fallo", "Fue una falsa alarma."];
    if (deserto) return ["fallo", `Quedó en nivel ${e.nivel}: se le escapó.`];
    return ["acierto", "No hubo alerta alta, y acertó."];
  }

  function datosDe(e) {
    const r = e.registro, mt = e.matricula || {}, fila = (t, v) => `<div><dt>${t}</dt><dd class="num">${v}</dd></div>`;
    const sinDato = (v, f) => (v == null ? "sin dato" : f(v));
    const matricula = fila("Nota de acceso", sinDato(mt.nota_acceso, (v) => `${num(v, 2)} de 14`)) + fila("Opción en que eligió la titulación", sinDato(mt.preferencia, entero))
      + fila("Dedicación", mt.tiempo_parcial ? "tiempo parcial" : "tiempo completo") + fila("Créditos ECTS del 1.er cuatrimestre", sinDato(mt.ects, (v) => num(v, 1)))
      + fila("Cohorte", `${e.cohorte}-${String(e.cohorte + 1).slice(2)}`);
    const presencia = fila("Días en el campus (wifi), sept.–enero", sinDato(mt.wifi_dias, entero)) + fila("Días en el aula virtual, por asignatura", sinDato(mt.aula_dias, (v) => num(v, 1)))
      + fila("Entregas en el aula virtual, por asignatura", sinDato(mt.entregas, (v) => num(v, 1)));
    const academicos = fila("Promedio (escala 0–5)", sinDato(r.promedio_acumulado, (v) => num(v, 2))) + fila("Asignaturas del 1.er cuatrimestre", r.materias_cursadas_periodo_anterior)
      + fila("Suspendidas o sin nota", r.materias_reprobadas) + fila("Presencia", sinDato(r.porcentaje_asistencia, (v) => `${entero(v)} %`)) + fila("Créditos (escala del contrato)", r.creditos_inscritos);
    return (e.decision === "provisional" ? matricula + academicos : academicos + matricula) + presencia;
  }

  function pintarFicha(e, animar) {
    const f = $("#ficha-estudiante");
    if (!e) { f.innerHTML = `<p class="ficha-resumen">Elija un estudiante de la lista.</p>`; return; }
    const cabeza = `<header class="ficha-cabecera"><h2 class="num">${esc(e.id)}</h2><p class="ficha-programa">${esc(e.titulacion)}</p></header>`;
    const datos = `<details class="ficha-datos"><summary>Sus datos en la base</summary><dl class="datos-registro">${datosDe(e)}</dl></details>`;
    if (!e.nivel) {
      f.innerHTML = `${cabeza}<div class="ficha-bento"><div class="pieza pieza-sello"><div class="sello sello-error"><b>Devuelto</b><small>al registro académico</small></div></div>
        <div class="pieza"><p class="rotulo">Qué pasó</p><p>El sistema lo devolvió solo porque ${esc(MOTIVOS[e.motivo] || e.motivo)}${e.campo ? ` (<code>${esc(nombre(e.campo))}</code>)` : ""}. Se califica en cuanto el registro corrija el dato.</p></div></div>${datos}`;
      return;
    }
    const prov = e.decision === "provisional";
    const maximo = Math.max(0.001, ...e.porque.map((p) => (prov ? p.peso : p.puntos)));
    const porque = e.porque.length ? e.porque.slice(0, 5).map((p) => `<div class="razon"><span class="razon-texto">${esc(p.texto)}</span>
      <span class="razon-barra" aria-hidden="true"><i style="width:${(100 * (prov ? p.peso : p.puntos)) / maximo}%"></i></span>${prov ? "" : `<b class="num">+${entero(p.puntos)}</b>`}</div>`).join("")
      : `<p class="nota">Ningún dato le suma riesgo.</p>`;
    const textos = E.datos.textos_mejora || {};
    const mejorar = e.mejorar.length ? `<ol class="mejoras">${e.mejorar.slice(0, 3).map((m) => {
      const efecto = m.nivel_si_mejora ? `Hasta ${entero(m.puntos)} puntos menos${m.nivel_si_mejora !== e.nivel ? `: quedaría en <strong>${m.nivel_si_mejora}</strong>` : ""}.`
        : m.puntos ? `Le suma ${entero(m.puntos)} puntos de riesgo.` : "";
      return `<li><strong>${esc(m.texto || textos[m.variable] || m.variable)}</strong>${efecto ? `<span>${efecto}</span>` : ""}</li>`; }).join("")}</ol>`
      : `<p class="nota">Nada que bienestar deba trabajar: basta el seguimiento rutinario.</p>`;
    const [clase, frase] = veredictoReal(e);
    const sub = `${e.puntaje} de 100${e.probabilidad != null ? ` · ${pct(e.probabilidad, 0)}` : ""}`;
    f.innerHTML = `${cabeza}<div class="ficha-bento">
      <div class="pieza pieza-sello"><div class="sello sello-${e.nivel}${prov ? " sello-provisional" : ""}${animar ? " recien" : ""}"><b>Riesgo ${e.nivel}</b><small>${prov ? "provisional · " : ""}${sub}</small></div></div>
      <div class="pieza"><p class="rotulo">Qué hacer</p><p class="pieza-accion">${esc(ACCIONES[e.accion] || e.accion || "")}</p>
        ${e.r34 ? `<p class="nota">Alto por la regla R3.4 del contrato: promedio menor a 3,0 y asistencia (aquí, presencia) menor a 70 %.</p>` : ""}</div>
      ${prov ? `<p class="pieza pieza-ancha pieza-aviso">Es <strong>provisional</strong>: el contrato no lo pudo calificar porque ${esc(MOTIVOS[e.motivo] || e.motivo)}${e.campo ? ` (<code>${esc(nombre(e.campo))}</code>)` : ""}, así que se calculó solo con los datos de su matrícula. El sistema ya le pidió el dato al registro.</p>` : ""}
      <div class="pieza pieza-ancha"><p class="rotulo">Por qué</p><div class="razones">${porque}</div></div>
      <div class="pieza pieza-ancha"><p class="rotulo">En qué mejorar</p>${mejorar}</div>
      <div class="pieza pieza-ancha desenlace ${clase}"><p class="rotulo">Qué pasó en realidad</p><p><span class="desenlace-marca" aria-hidden="true">${clase === "acierto" ? "✓" : "✗"}</span>
        <strong>${DESENLACE[e.desenlace]}.</strong> ${frase}</p></div></div>${datos}`;
    if (animar) aparecer(f.querySelectorAll(".pieza"), { pausa: 35, duracion: 260, desde: "translateY(6px)" });
  }

  function elegir(id, animar = true) {
    E.elegido = id;
    document.querySelectorAll(".fila-est").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
    pintarFicha(E.datos.estudiantes.find((e) => e.id === id), animar);
  }

  /* ================================================================== lectura de la base */
  async function leerBase() {
    const btn = $("#btn-leer");
    btn.disabled = true;
    $("#estado-lectura").textContent = "Leyendo la base de datos y calificando a cada estudiante…";
    E.deCopia = false;
    try {
      if (/[?&]copia\b/.test(location.search)) throw new Error("se pidió la copia guardada");
      const d = await json(`api/estudiantes?modelo=${modeloElegido()}`);
      if (d.error) throw new Error(d.detalle || d.error);
      E.datos = d;
    } catch (e1) {
      try { E.datos = await json("reportes/real/estudiantes.json"); E.deCopia = true; }
      catch (e2) { $("#estado-lectura").textContent = "No se pudo leer la base de datos ni la copia de la última corrida."; btn.disabled = false; return; }
    }
    btn.disabled = false;
    E.visibles = PASO;
    /* Enlace directo a un estudiante: estudiantes.html#UPV21-0042 */
    const pedido = (location.hash.match(/[A-Z]+\d*-\d+/) || [])[0];
    if (pedido && E.elegido === null && E.datos.estudiantes.some((e) => e.id === pedido)) { E.elegido = pedido; E.texto = pedido; $("#buscar").value = pedido; }
    pintarFlujo(); pintarTablero(); pintarChips(); pintarLista();
    if (E.elegido) elegir(E.elegido, false);
  }

  function iniciarEstudiantes() {
    $("#chips").addEventListener("click", (ev) => { const b = ev.target.closest("[data-grupo]"); if (b) filtrar({ filtro: b.dataset.grupo }); });
    $("#lista").addEventListener("click", (ev) => {
      const b = ev.target.closest(".fila-est");
      if (!b) return;
      elegir(b.dataset.id);
      if (matchMedia("(max-width: 940px)").matches) $("#ficha-estudiante").scrollIntoView({ behavior: reducido() ? "auto" : "smooth", block: "start" });
    });
    $("#buscar").addEventListener("input", (ev) => { E.texto = ev.target.value; E.visibles = PASO; pintarLista(); });
    $("#titulacion").addEventListener("change", (ev) => filtrar({ titulacion: ev.target.value }));
    $("#btn-mas").addEventListener("click", () => { E.visibles += PASO; pintarLista(); });
    $("#btn-leer").addEventListener("click", leerBase);
    document.querySelectorAll('input[name="modelo-operacion"]').forEach((r) => r.addEventListener("change", leerBase));
    return leerBase();
  }

  window.SAT = Object.assign(window.SAT || {}, { iniciarEstudiantes });
})();
