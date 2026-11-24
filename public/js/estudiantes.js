/* Script clásico (sin módulos). Vista Estudiantes (base de datos real).
   - La carga viva: un botón pide /api/estudiantes una sola vez y reproduce a cámara lenta, con los datos reales,
     lo que pasó: conectar, leer, validar con el contrato, calificar con el modelo y asignar las alertas a Bienestar.
     Los 920 puntos van en un canvas movido con requestAnimationFrame (no 920 nodos animados con CSS).
   - Debajo, el detalle: un tablero con cuatro gráficas, filtros, la lista agrupada por nivel y la ficha.
   La página nunca recalcula el modelo: todo viene de /api/estudiantes. */
(function () {
  "use strict";
  const { $, esc, pct, num, miles, json, nombre, ACCIONES, MOTIVOS, conGlobo, mostrarGlobo, ocultarGlobo, s, lienzo, escala, aparecer, reducido } = window.SAT;

  const NOMBRE_MODELO = { logistica: "regresión logística", red_neuronal: "red neuronal", reglas: "reglas del contrato" };
  const NIVELES = ["alto", "medio", "bajo"];
  const TITULO = { alto: "Riesgo alto", medio: "Riesgo medio", bajo: "Riesgo bajo", devuelto: "Devueltos al registro" };
  const CHIPS = [["todos", "Todos"], ["alto", "Alto"], ["medio", "Medio"], ["bajo", "Bajo"], ["devuelto", "Devueltos"]];
  const DESENLACE = { abandono: "Abandonó la titulación", sigue: "No abandonó" };
  const FUENTE_SENAL = { notas: "Notas del cuatrimestre", presencia: "Presencia en el campus y el aula virtual", situacion: "Situación de matrícula", admision: "Admisión", titulacion: "Titulación" };
  const ORDEN_GRAVEDAD = { alta: 0, media: 1, leve: 2 };
  const PASO = 20; // estudiantes por tanda en la lista
  const CLAVE_CARGA = "decersion-ultima-carga";
  const entero = (x) => num(x, 0);
  const html = (texto) => { const d = document.createElement("div"); d.innerHTML = texto; return d.firstElementChild; };
  const modeloElegido = () => (document.querySelector('input[name="modelo-operacion"]:checked') || {}).value || "logistica";
  const codigoTit = (t) => (String(t || "").match(/T\d+/) || [String(t || "")])[0];
  const capital = (t) => String(t || "").charAt(0).toUpperCase() + String(t || "").slice(1);
  /* Con nivel (definitivo o provisional) va a su nivel; sin nivel, el registro se devolvió. */
  const grupoDe = (e) => e.nivel || "devuelto";
  const E = { datos: null, filtro: "todos", texto: "", titulacion: "", visibles: PASO, elegido: null, deCopia: false, todasTitulaciones: false, detalleListo: false };

  /* ================================================================== memoria de este navegador */
  function cargaGuardada() {
    try { const v = JSON.parse(localStorage.getItem(CLAVE_CARGA) || "null"); return v && v.fecha ? v : null; } catch (e) { return null; }
  }
  function guardarCarga(P) {
    const por = {};
    for (const p of P.puntos) if (p.persona) por[p.persona] = (por[p.persona] || 0) + 1;
    const v = { fecha: new Date().toISOString(), leidos: P.n, alertas: P.alertas, por_persona: por, modelo: P.d.ejecucion.modelo, de_copia: E.deCopia };
    try { localStorage.setItem(CLAVE_CARGA, JSON.stringify(v)); } catch (e) { /* sin almacenamiento: no pasa nada */ }
    return v;
  }
  const esHoy = (iso) => { const f = new Date(iso); return !isNaN(f) && f.toDateString() === new Date().toDateString(); };
  const hora = (iso) => new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dia = (iso) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long" });

  /* ================================================================== titulaciones (códigos anónimos) */
  function fichaTitulacion(tit) {
    const cod = codigoTit(tit), f = ((E.datos && E.datos.fichas_titulacion) || {})[cod];
    const partes = [`${cod} · código anónimo de una carrera de la UPV`];
    if (f) {
      if (f.n_historico != null) partes.push(`${miles(f.n_historico)} estudiantes en años anteriores`);
      if (f.tasa != null) partes.push(`abandona el ${pct(f.tasa, 0)} en primer año${E.datos.tasa_global != null ? ` (en toda la universidad, el ${pct(E.datos.tasa_global, 0)})` : ""}`);
      if (f.nota_acceso_media != null) partes.push(`nota de acceso media ${num(f.nota_acceso_media, 1)}`);
    }
    return partes.join(" · ");
  }

  /* ================================================================== la carga viva */
  /* Etapas: [nombre, desde ms, hasta ms]. En total ~11 s. */
  const ETAPAS = [["Conectar", 0, 900], ["Leer", 900, 3700], ["Validar", 3700, 5100], ["Calificar", 5100, 8100], ["Asignar", 8100, 10600]];
  const FIN = 10900, VUELO = 650, VUELO_ALERTA = 850;

  /* cubic-bezier(0.23, 1, 0.32, 1), la curva de salida de la casa, resuelta a mano para los puntos del canvas. */
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const e = X(t) - x, d = dX(t); if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break; t = Math.min(1, Math.max(0, t - e / d)); }
      return Y(t);
    };
  }
  const suave = bezier(0.23, 1, 0.32, 1);
  /* La lectura arranca despacio (se alcanzan a leer los primeros registros), acelera y frena al final. */
  const ritmo = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  function preparar(d) {
    const lista = [...d.estudiantes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)); // orden de lectura
    const n = lista.length, [, l0, l1] = ETAPAS[1], [, v0, v1] = ETAPAS[2], [, c0, c1] = ETAPAS[3], [, a0, a1] = ETAPAS[4];
    const equipo = d.equipo || [], deEquipo = new Set(equipo.map((p) => p.id));
    const cuenta = { alto: 0, medio: 0, bajo: 0 };
    let m = 0;
    const puntos = lista.map((e, i) => {
      let lo = 0, hi = 1;
      for (let k = 0; k < 22; k++) { const mitad = (lo + hi) / 2; if (n * ritmo(mitad) >= i + 1) hi = mitad; else lo = mitad; }
      const p = { e, i, nivel: e.nivel || null, estado: e.nivel ? (e.decision === "provisional" ? "provisional" : "pasa") : "devuelto",
        tLee: l0 + hi * (l1 - l0), tVal: v0 + (i / n) * (v1 - v0 - 200), tCal: null, ranura: -1, tAsi: null, persona: null, ruta: null };
      if (p.nivel) { p.ranura = cuenta[p.nivel]++; p.tCal = c0 + (i / n) * (c1 - c0 - VUELO); }
      if (e.plan && deEquipo.has(e.plan.asignada)) { p.persona = e.plan.asignada; p.ruta = e.plan.ruta; p.j = m++; }
      return p;
    });
    const rutas = {};
    for (const p of puntos) {
      if (!p.persona) continue;
      p.tAsi = a0 + (p.j / Math.max(1, m)) * (a1 - a0 - VUELO_ALERTA);
      const r = (rutas[p.persona] = rutas[p.persona] || {});
      r[p.ruta] = (r[p.ruta] || 0) + 1;
    }
    const asignados = puntos.filter((p) => p.persona);
    const ej = d.ejecucion || {};
    return { d, puntos, asignados, n, equipo, cuenta, m, rutas, alertas: cuenta.alto, msReal: (ej.ms_lectura || 0) + (ej.ms_modelo || 0),
      archivo: (d.base && d.base.archivo) || "la base", motor: (d.base && d.base.motor) || "", modelo: NOMBRE_MODELO[ej.modelo] || ej.modelo || "el modelo" };
  }

  function titular(P, etapa) {
    const conEquipo = P.equipo.length;
    return [
      ["Conectando con el registro académico", `${esc(P.archivo)}${P.motor ? ` (${esc(P.motor)})` : ""} · ${miles(P.n)} registros de primer año esperan.`],
      ["Leyendo los registros", "Cada punto es un estudiante, en el orden en que sale de la base."],
      ["Validando cada registro con el contrato", "Pasan los completos; sin notas, el resultado es provisional (anillo); con datos rotos, vuelven al registro."],
      [`Calificando con el modelo: ${esc(P.modelo)}`, "Cada estudiante cae en su nivel de riesgo. Los anillos son resultados provisionales."],
      ["Asignando las alertas a Bienestar", conEquipo ? `Cada caso de riesgo alto va a la persona de su ruta de apoyo. Nadie lo reparte a mano.` : "Esta corrida no trae equipo de Bienestar: las alertas quedan sin asignar."],
    ][etapa];
  }

  function construirPanel(P) {
    const raiz = $("#carga");
    const personas = P.equipo.map((p) => {
      const rutas = Object.keys(P.rutas[p.id] || {});
      return `<li class="persona" data-id="${esc(p.id)}"><span class="avatar" aria-hidden="true">${esc(p.iniciales)}</span>
        <span class="persona-quien"><b>${esc(p.nombre.split(" ")[0])}<span class="solo-ancho"> ${esc(p.nombre.split(" ").slice(1).join(" "))}</span></b><small>${esc(p.rol)}</small></span>
        <b class="persona-cuenta num" data-persona="${esc(p.id)}">0</b>
        ${rutas.length ? `<ul class="persona-rutas">${rutas.map((r) => `<li><span>${esc(r)}</span><b class="num" data-ruta="${esc(p.id)}|${esc(r)}">0</b></li>`).join("")}</ul>` : ""}</li>`;
    }).join("");
    raiz.innerHTML = `<div class="carga-vivo">
      <div class="carga-cabeza"><p class="rotulo">Registro académico<span class="solo-ancho"> · ${esc(P.archivo)}</span></p>
        <button type="button" class="enlace-boton" id="btn-saltar">Saltar animación</button></div>
      <div class="progreso" role="progressbar" aria-label="Avance de la lectura" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
      <ol class="etapas">${ETAPAS.map(([t], k) => `<li class="etapa" data-etapa="${k}"><span class="etapa-num" aria-hidden="true">${k + 1}</span><span class="etapa-nombre">${t}</span><small class="etapa-dato num"></small></li>`).join("")}</ol>
      <div class="carga-titular" aria-live="polite"><div class="titular-texto"><h2></h2><p></p></div><div class="carga-acciones"></div></div>
      <div class="carga-cuerpo">
        <div class="carga-consola">
          <ol class="consola" aria-hidden="true">${"<li></li>".repeat(5)}</ol>
          <div class="pozo"><p class="zona-rotulo"><span class="rotulo">Leídos</span><b class="num" data-c="leidos">0</b><span class="de num">de ${miles(P.n)}</span></p><div class="pozo-puntos"></div></div>
          <dl class="validacion">
            <div><dt>Pasan</dt><dd class="num" data-c="pasa">0</dd></div>
            <div><dt>Provisionales</dt><dd class="num" data-c="provisional">0</dd></div>
            <div><dt>Devueltos</dt><dd class="num" data-c="devuelto">0</dd></div>
          </dl>
        </div>
        <div class="carga-escena">
          <div class="niveles">${NIVELES.map((l) => `<div class="nivel nivel-${l}"><p class="zona-rotulo"><i class="punto punto-${l}" aria-hidden="true"></i><span>${TITULO[l]}</span><b class="num" data-c="${l}">0</b></p><div class="nivel-puntos" data-nivel="${l}"></div></div>`).join("")}</div>
          <p class="rotulo equipo-rotulo">${P.equipo.length ? `Bienestar recibe las alertas · ${miles(P.equipo.length)} personas` : "Bienestar"}</p>
          <ul class="equipo">${personas || `<li class="nota">Sin equipo en esta corrida.</li>`}</ul>
        </div>
        <canvas class="carga-lienzo" aria-hidden="true"></canvas>
      </div></div>`;
    const css = getComputedStyle(document.documentElement), col = (v) => css.getPropertyValue(v).trim() || "#888";
    Object.assign(P, {
      raiz, cuerpo: raiz.querySelector(".carga-cuerpo"), lienzo: raiz.querySelector("canvas"), pozo: raiz.querySelector(".pozo-puntos"),
      cajas: Object.fromEntries(NIVELES.map((l) => [l, raiz.querySelector(`[data-nivel="${l}"]`)])),
      avatares: Object.fromEntries([...raiz.querySelectorAll(".persona")].map((li) => [li.dataset.id, li.querySelector(".avatar")])),
      barra: raiz.querySelector(".progreso"), barraIn: raiz.querySelector(".progreso i"), etapas: [...raiz.querySelectorAll(".etapa")],
      consola: [...raiz.querySelectorAll(".consola li")], titularEl: raiz.querySelector(".titular-texto"), acciones: raiz.querySelector(".carga-acciones"),
      cifras: [...raiz.querySelectorAll("[data-c],[data-persona],[data-ruta]")], valores: new Map(), ultimaConsola: -1, etapaPintada: -2, pulso: {},
      col: { tinta: col("--tinta"), tinta2: col("--tinta-2"), tenue: col("--tenue"), renglon: col("--renglon"), alto: col("--alto"), medio: col("--medio"), bajo: col("--bajo") },
    });
    P.ctx = P.lienzo.getContext("2d");
    medir(P);
  }

  /* Geometría: dónde cae cada ranura, medida sobre el DOM (las cajas fijan el sitio; el canvas solo pinta encima). */
  function medir(P) {
    const ancho = P.cuerpo.clientWidth, paso = ancho < 560 ? 5 : 6.5;
    const colsP = Math.max(12, Math.floor(P.pozo.clientWidth / paso));
    P.pozo.style.height = `${Math.ceil(P.n / colsP) * paso}px`;
    const colsB = Math.max(4, Math.floor(P.cajas.alto.clientWidth / paso));
    const filasB = Math.max(1, ...NIVELES.map((l) => Math.ceil((P.cuenta[l] || 0) / colsB)));
    for (const l of NIVELES) P.cajas[l].style.height = `${filasB * paso}px`;
    const base = P.cuerpo.getBoundingClientRect();
    const caja = (el) => { const b = el.getBoundingClientRect(); return { x: b.left - base.left, y: b.top - base.top, w: b.width, h: b.height }; };
    const personas = {};
    for (const [id, av] of Object.entries(P.avatares)) { const b = caja(av); personas[id] = [b.x + b.w / 2, b.y + b.h / 2]; }
    P.geo = { w: base.width, h: base.height, paso, colsP, colsB, pozo: caja(P.pozo), cajas: Object.fromEntries(NIVELES.map((l) => [l, caja(P.cajas[l])])), personas, arco: ancho < 560 ? 18 : 34 };
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    P.dpr = dpr;
    P.lienzo.width = Math.round(base.width * dpr); P.lienzo.height = Math.round(base.height * dpr);
    P.lienzo.style.width = `${base.width}px`; P.lienzo.style.height = `${base.height}px`;
  }

  const enPozo = (g, i) => [g.pozo.x + ((i % g.colsP) + 0.5) * g.paso, g.pozo.y + (Math.floor(i / g.colsP) + 0.5) * g.paso];
  const enNivel = (g, l, k) => { const c = g.cajas[l]; return [c.x + ((k % g.colsB) + 0.5) * g.paso, c.y + c.h - (Math.floor(k / g.colsB) + 0.5) * g.paso]; };

  function dibujar(P, t) {
    const g = P.geo, ctx = P.ctx, c = P.col;
    if (!g) return;
    ctx.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
    ctx.clearRect(0, 0, g.w, g.h);
    const r = g.paso * 0.36;
    const punto = (x, y, radio, color, alfa, anillo) => {
      ctx.globalAlpha = alfa;
      ctx.beginPath(); ctx.arc(x, y, radio, 0, 6.2832);
      if (anillo) { ctx.strokeStyle = color; ctx.lineWidth = 1.25; ctx.stroke(); } else { ctx.fillStyle = color; ctx.fill(); }
    };
    const enVuelo = [], alertas = [];
    for (const p of P.puntos) {
      if (t < p.tLee) continue;
      const [px, py] = enPozo(g, p.i);
      const salio = p.tCal != null && t >= p.tCal;
      if (!salio) {
        const a = Math.min(1, (t - p.tLee) / 260);
        if (t < p.tVal) punto(px, py, r, c.tenue, 0.55 * a, false);
        else if (p.estado === "pasa") punto(px, py, r, c.tinta, 1, false);
        else punto(px, py, r - 0.6, p.estado === "provisional" ? c.tinta2 : c.tenue, 1, true);
        continue;
      }
      punto(px, py, r * 0.55, c.renglon, 1, false); // la ranura que quedó vacía
      const [bx, by] = enNivel(g, p.nivel, p.ranura);
      const k = (t - p.tCal) / VUELO;
      if (k < 1) {
        const e = suave(k);
        enVuelo.push([px + (bx - px) * e, py + (by - py) * e - Math.sin(Math.PI * Math.min(1, k * 1.15)) * g.arco, p]);
        continue;
      }
      const entregado = p.tAsi != null && t >= p.tAsi;
      punto(bx, by, p.estado === "provisional" ? r - 0.6 : r, c[p.nivel], entregado ? 0.4 : 1, p.estado === "provisional");
      if (entregado) {
        const k2 = (t - p.tAsi) / VUELO_ALERTA, destino = g.personas[p.persona];
        if (k2 < 1 && destino) {
          const e = suave(k2);
          alertas.push([bx + (destino[0] - bx) * e, by + (destino[1] - by) * e - Math.sin(Math.PI * k2) * g.arco * 0.6, k2 < 0.7 ? 1 : 1 - (k2 - 0.7) / 0.3]);
        }
      }
    }
    for (const [x, y, p] of enVuelo) punto(x, y, r * 1.12, c[p.nivel], 1, false);
    for (const [x, y, a] of alertas) punto(x, y, r * 1.2, c.alto, a, false);
    ctx.globalAlpha = 1;
  }

  /* Contadores, etapas, barra y consola. Solo se toca el DOM cuando una cifra cambia. */
  function cuentasEn(P, t) {
    const k = { leidos: 0, pasa: 0, provisional: 0, devuelto: 0, alto: 0, medio: 0, bajo: 0, asignadas: 0 }, persona = {}, ruta = {};
    for (const p of P.puntos) {
      if (t >= p.tLee) k.leidos++;
      if (t >= p.tVal) k[p.estado]++;
      if (p.tCal != null && t >= p.tCal + VUELO) k[p.nivel]++;
      if (p.tAsi != null && t >= p.tAsi + VUELO_ALERTA) {
        k.asignadas++; persona[p.persona] = (persona[p.persona] || 0) + 1;
        const clave = `${p.persona}|${p.ruta}`; ruta[clave] = (ruta[clave] || 0) + 1;
      }
    }
    return { k, persona, ruta };
  }

  function lineaConsola(P, etapa, t) {
    const a = (e) => e.ampliado || {};
    if (etapa === 0) {
      return [`<span class="sale">→</span> Conectando con <b>${esc(P.archivo)}</b>${P.motor ? ` (${esc(P.motor)})` : ""}…`,
        t > 300 ? `<span class="sale">→</span> <b class="num">${miles(P.n)}</b> registros de primer año en operación` : "",
        t > 600 ? `<span class="sale">→</span> Contrato ampliado listo · modelo: ${esc(P.modelo)}` : ""].filter(Boolean);
    }
    const ultimos = (lista) => lista.slice(-6);
    if (etapa === 1) return ultimos(P.puntos.filter((p) => t >= p.tLee)).map(({ e }) => `<b>${esc(e.id)}</b><span>${esc(codigoTit(e.titulacion))}</span>`
      + `<span>${e.ects != null ? `${num(e.ects, 0)} ECTS` : "ECTS sin dato"}</span><span>acceso ${a(e).nota_acceso != null ? num(a(e).nota_acceso, 1) : "sin dato"}</span>`
      + `<span>aula virtual ${a(e).dias_aula_virtual != null ? `${num(a(e).dias_aula_virtual, 0)} d` : "sin dato"}</span>`);
    if (etapa === 2) return ultimos(P.puntos.filter((p) => t >= p.tVal)).map(({ e, estado }) => estado === "pasa"
      ? `<span class="marca">✓</span><b>${esc(e.id)}</b><span>pasa el contrato</span>`
      : estado === "provisional" ? `<span class="marca">◌</span><b>${esc(e.id)}</b><span>provisional: ${esc(MOTIVOS[e.motivo] || e.motivo || "le faltan las notas")}</span>`
        : `<span class="marca">✗</span><b>${esc(e.id)}</b><span>vuelve al registro: ${esc(MOTIVOS[e.motivo] || e.motivo || "dato inválido")}</span>`);
    if (etapa === 3) return ultimos(P.puntos.filter((p) => p.tCal != null && t >= p.tCal)).map(({ e }) =>
      `<b>${esc(e.id)}</b><span class="sale">→</span><span><i class="punto punto-${e.nivel}" aria-hidden="true"></i> riesgo ${e.nivel} · ${entero(e.puntaje)} puntos${e.decision === "provisional" ? " (provisional)" : ""}</span>`);
    const nombres = Object.fromEntries(P.equipo.map((p) => [p.id, p.nombre]));
    const hechos = P.asignados.filter((p) => t >= p.tAsi);
    if (!hechos.length) return [`<span class="sale">→</span> ${miles(P.alertas)} alertas de riesgo alto listas para repartir`];
    return ultimos(hechos).map(({ e, persona, ruta }) => `<b>${esc(e.id)}</b><span class="sale">→</span><span><strong>${esc(nombres[persona])}</strong> · ${esc(ruta)}</span>`);
  }

  function poner(P, el, valor) {
    if (P.valores.get(el) === valor) return false;
    P.valores.set(el, valor); el.textContent = valor;
    return true;
  }

  function pintarTitular(P, etapa, animar) {
    const tx = P.titularEl;
    let h, sub;
    if (etapa >= ETAPAS.length) {
      const personas = P.equipo.length;
      h = `${miles(P.n)} leídos · ${miles(P.alertas)} alertas${P.m ? ` · asignadas a ${miles(personas)} personas` : ""}`;
      const real = `el proceso real tardó ${miles(Math.round(P.msReal))} ms`;
      sub = P.modoFinal === "animada" && !P.saltada ? `${capital(real)}; aquí se mostró a cámara lenta.`
        : P.modoFinal === "guardada" ? `Lectura de hoy a las ${esc(hora(P.guardada.fecha))} en este navegador; ${real}.`
          : `${capital(real)}.`;
      if (E.deCopia) sub += " Se usó la copia de la última corrida guardada: la base no respondió.";
      tx.querySelector("h2").textContent = h;
      tx.querySelector("p").innerHTML = sub;
    } else {
      [h, sub] = titular(P, etapa);
      tx.querySelector("h2").innerHTML = h;
      tx.querySelector("p").innerHTML = sub;
    }
    if (animar && tx.animate && !reducido()) tx.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  }

  function actualizar(P, t, ahora) {
    const etapa = t >= FIN ? ETAPAS.length : Math.max(0, ETAPAS.findIndex(([, , b]) => t < b));
    const { k, persona, ruta } = cuentasEn(P, t);
    for (const el of P.cifras) {
      const v = el.dataset.c ? k[el.dataset.c] : el.dataset.persona ? persona[el.dataset.persona] || 0 : ruta[el.dataset.ruta] || 0;
      if (poner(P, el, miles(v)) && el.dataset.persona && P.animando) {
        const av = P.avatares[el.dataset.persona];
        if (av && av.animate && ahora - (P.pulso[el.dataset.persona] || 0) > 160) {
          P.pulso[el.dataset.persona] = ahora;
          av.animate([{ transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 240, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
        }
      }
    }
    const avance = Math.min(1, t / FIN);
    P.barraIn.style.transform = `scaleX(${avance})`;
    P.barra.setAttribute("aria-valuenow", String(Math.round(avance * 100)));
    const datos = [`${miles(P.n)} registros`, `${miles(k.leidos)} de ${miles(P.n)}`, `${miles(k.pasa)} pasan`, `${miles(k.alto)} en alto`, `${miles(k.asignadas)} de ${miles(P.m)}`];
    P.etapas.forEach((li, i) => {
      const estado = i < etapa ? "hecha" : i === etapa ? "activa" : "espera";
      if (li.dataset.estado !== estado) { li.dataset.estado = estado; li.classList.toggle("hecha", estado === "hecha"); li.classList.toggle("activa", estado === "activa"); }
      poner(P, li.querySelector(".etapa-dato"), i <= etapa ? datos[i] : "");
    });
    if (etapa !== P.etapaPintada) { pintarTitular(P, etapa, P.etapaPintada !== -2); P.etapaPintada = etapa; }
    if (etapa !== P.etapaConsola || ahora - P.ultimaConsola > 70) {
      P.ultimaConsola = ahora; P.etapaConsola = etapa;
      const lineas = lineaConsola(P, Math.min(etapa, ETAPAS.length - 1), t);
      P.consola.forEach((li, i) => { const x = lineas[i - (P.consola.length - lineas.length)] || ""; if (li.innerHTML !== x) li.innerHTML = x; });
    }
  }

  /* Reproduce la carga. Devuelve una promesa que se cumple al final (o al saltar). */
  function reproducir(P) {
    return new Promise((listo) => {
      let t0 = null, saltar = false;
      P.animando = true;
      P.saltar = () => { saltar = true; P.saltada = true; };
      const cuadro = (ahora) => {
        if (t0 === null) t0 = ahora;
        const t = saltar ? FIN : Math.min(FIN, ahora - t0);
        const etapa = t >= FIN ? ETAPAS.length : ETAPAS.findIndex(([, , b]) => t < b);
        if (etapa !== P.etapaMedida) {
          P.etapaMedida = etapa; medir(P); // por si las letras cargaron tarde
          /* En pantallas bajas, la vista sigue a la acción: al asignar, que se vea el equipo. */
          const eq = etapa === ETAPAS.length - 1 && P.raiz.querySelector(".equipo");
          if (eq && !saltar) { const b = eq.getBoundingClientRect().bottom; if (b > innerHeight - 8) scrollBy({ top: b - innerHeight + 16, behavior: "smooth" }); }
        }
        dibujar(P, t); actualizar(P, t, ahora);
        P.t = t;
        if (t >= FIN) { P.animando = false; listo(); return; }
        requestAnimationFrame(cuadro);
      };
      requestAnimationFrame(cuadro);
    });
  }

  function pintarFinal(P) { P.t = FIN; medir(P); dibujar(P, FIN); actualizar(P, FIN, performance.now()); }

  function pintarAcciones(P, animar) {
    $("#btn-saltar").outerHTML = `<button type="button" class="enlace-boton" id="btn-releer">Volver a leer la base</button>`;
    $("#btn-releer").addEventListener("click", () => cargar({ animar: true }));
    P.acciones.innerHTML = `<a class="boton boton-tinta" href="bienestar.html">Ir a la Bandeja de Bienestar</a>
      <button type="button" class="boton" id="btn-detalle">Ver el detalle aquí abajo</button>`;
    $("#btn-detalle").addEventListener("click", () => $("#detalle").scrollIntoView({ behavior: reducido() ? "auto" : "smooth", block: "start" }));
    if (animar) {
      aparecer(P.acciones.children, { pausa: 60, duracion: 320, desde: "translateY(6px)" });
      const arriba = P.titularEl.getBoundingClientRect().top;
      if (arriba < 60) scrollBy({ top: arriba - 72, behavior: "smooth" }); // que el resumen y la acción queden a la vista
    }
  }

  /* ---------------------------------------------------------------- estado inicial: una sola decisión */
  async function pintarInicio() {
    const raiz = $("#carga"), previa = cargaGuardada();
    const ultima = previa
      ? `La última lectura desde este navegador fue el ${esc(dia(previa.fecha))} a las ${esc(hora(previa.fecha))}${previa.alertas != null ? ` (${miles(previa.alertas)} alertas)` : ""}.`
      : "Todavía no se ha leído desde este navegador.";
    raiz.innerHTML = `<div class="carga-inicio">
      <div class="carga-base"><p class="rotulo">Registro académico</p>
        <h2><b class="cifra-grande num" id="inicio-total">…</b> <span id="inicio-que">registros esperan en la base</span></h2>
        <p class="carga-archivo" id="inicio-archivo">registro_academico.sqlite</p>
        <p class="carga-ultima">${ultima}</p></div>
      <div class="carga-accion"><button type="button" class="boton boton-tinta boton-grande" id="btn-cargar">Leer la base y asignar alertas</button>
        <p class="nota">Unos 10 segundos: se ve entrar cada registro, se valida, se califica y las alertas de riesgo alto se reparten solas al equipo de Bienestar.</p></div></div>`;
    $("#btn-cargar").addEventListener("click", () => cargar({ animar: true }));
    try {
      const b = await json("reportes/real/base.json");
      if (b.operacion != null) $("#inicio-total").textContent = miles(b.operacion);
      $("#inicio-archivo").textContent = [b.archivo, b.motor, "primer año de grado de la UPV, cohortes 2021 y 2022"].filter(Boolean).join(" · ");
    } catch (e) {
      const total = $("#inicio-total");
      if (total) { total.remove(); $("#inicio-que").textContent = "Registros de primer año en la base"; }
    }
  }

  /* ---------------------------------------------------------------- pedir los datos (una vez) */
  async function pedirDatos() {
    E.deCopia = false;
    try {
      if (/[?&]copia\b/.test(location.search)) throw new Error("se pidió la copia guardada");
      const d = await json(`api/estudiantes?modelo=${modeloElegido()}`);
      if (d.error) throw new Error(d.detalle || d.error);
      return d;
    } catch (e1) {
      const d = await json("reportes/real/estudiantes.json"); // si también falla, sube el error
      E.deCopia = true;
      return d;
    }
  }

  let cargando = false;
  /* animar: true = el visitante pulsó el botón; false = ya se leyó hoy aquí, enlace a un estudiante o cambio de modelo. */
  async function cargar({ animar, guardada = null, recalcular = false }) {
    if (cargando) return;
    cargando = true;
    const boton = $("#btn-cargar") || $("#btn-releer");
    if (boton) { boton.disabled = true; boton.textContent = "Conectando con la base…"; }
    let d;
    try { d = await pedirDatos(); }
    catch (e) {
      cargando = false;
      if (boton) { boton.disabled = false; boton.textContent = "Intentar otra vez"; }
      const aviso = $("#carga .nota") || $("#carga");
      aviso.insertAdjacentHTML("afterend", `<p class="nota carga-error">No se pudo leer la base de datos ni la copia de la última corrida.</p>`);
      return;
    }
    E.datos = d;
    const P = preparar(d);
    E.carga = P;
    construirPanel(P);
    const animada = animar && !reducido();
    P.modoFinal = animada ? "animada" : guardada ? "guardada" : "directa";
    P.guardada = guardada;
    $("#btn-saltar").addEventListener("click", () => P.saltar && P.saltar());
    if (animada) {
      ocultarDetalle();
      /* Que el panel entero quede a la vista mientras corre: su borde de arriba, justo bajo la barra fija. */
      const barra = document.querySelector(".barra"), alto = barra && getComputedStyle(barra).position !== "static" ? barra.getBoundingClientRect().height : 0;
      const top = P.raiz.getBoundingClientRect().top - alto - 12;
      if (Math.abs(top) > 24) scrollTo({ top: scrollY + top, behavior: "smooth" });
      await reproducir(P);
    } else {
      $("#btn-saltar").hidden = true;
      pintarFinal(P);
    }
    if (animar) guardarCarga(P);
    pintarAcciones(P, animada);
    mostrarDetalle(recalcular);
    cargando = false;
  }

  /* ================================================================== el detalle */
  function ocultarDetalle() { const z = $("#detalle"); if (z) z.hidden = true; }
  function mostrarDetalle(recalcular) {
    if (!E.detalleListo) montarDetalle();
    const z = $("#detalle");
    z.hidden = false;
    E.visibles = PASO;
    const pedido = (location.hash.match(/[A-Z]+\d*-\d+/) || [])[0];
    if (pedido && E.elegido === null && E.datos.estudiantes.some((e) => e.id === pedido)) { E.elegido = pedido; E.texto = pedido; $("#buscar").value = pedido; }
    $("#modelo-actual").textContent = NOMBRE_MODELO[E.datos.ejecucion.modelo] || E.datos.ejecucion.modelo;
    const avisos = E.datos.avisos || [];
    $("#avisos").innerHTML = avisos.length ? `<p class="aviso-registro"><span class="rotulo">El sistema ya le pidió al registro</span>
      ${avisos.map((a) => `<span>${esc(a.texto)}</span>`).join("")}</p>` : "";
    if (recalcular) $("#titulacion").options.length = 1;
    pintarTablero(); pintarChips(); pintarLista();
    if (E.elegido) elegir(E.elegido, false);
    if (pedido && E.elegido === pedido) $("#ficha-estudiante").scrollIntoView({ block: "start" });
  }

  function montarDetalle() {
    const plantilla = $("#plantilla-detalle");
    $("#zona-detalle").appendChild(plantilla.content.cloneNode(true));
    E.detalleListo = true;
    $("#chips").addEventListener("click", (ev) => { const b = ev.target.closest("[data-grupo]"); if (b) filtrar({ filtro: b.dataset.grupo }); });
    const lista = $("#lista");
    lista.addEventListener("click", (ev) => {
      const b = ev.target.closest(".fila-est");
      if (!b) return;
      elegir(b.dataset.id);
      if (matchMedia("(max-width: 940px)").matches) $("#ficha-estudiante").scrollIntoView({ behavior: reducido() ? "auto" : "smooth", block: "start" });
    });
    lista.addEventListener("pointermove", (ev) => { const t = ev.target.closest(".fila-tit"); if (t) mostrarGlobo(ev, esc(fichaTitulacion(t.dataset.tit))); else ocultarGlobo(); });
    lista.addEventListener("pointerleave", ocultarGlobo);
    $("#buscar").addEventListener("input", (ev) => { E.texto = ev.target.value; E.visibles = PASO; pintarLista(); });
    $("#titulacion").addEventListener("change", (ev) => filtrar({ titulacion: ev.target.value }));
    $("#btn-mas").addEventListener("click", () => { E.visibles += PASO; pintarLista(); });
    document.querySelectorAll('input[name="modelo-operacion"]').forEach((r) => r.addEventListener("change", () => cargar({ animar: false, recalcular: true })));
  }

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
    return celda("c4", "Hoy", "Cuántos hay en cada nivel", caja, prov ? `La parte rayada (${miles(prov)}) es resultado provisional: el contrato no los pudo calificar y se usó el aviso antes de las notas (matrícula, actividad y titulación).` : "");
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
     Las titulaciones vienen cifradas en la fuente: se muestran con un código (T01 = la de más estudiantes).
     Debajo del título va, una vez, qué es un código; al pasar el puntero o pulsar uno, su ficha. */
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
        <span class="programa-nombre"><abbr class="codigo-tit">${esc(codigoTit(p.titulacion))}</abbr> <small class="num">· ${miles(p.n)} est.</small></span>
        <span class="programa-barra" aria-hidden="true">${NIVELES.map((n) => (p[n] ? `<i class="tramo-${n}" style="flex-grow:${p[n]}"></i>` : "")).join("")}</span>
        <b class="num">${pct(p.alto / p.n, 0)}</b></button>`);
      conGlobo(fila, `<b>${esc(fichaTitulacion(p.titulacion))}</b><br>Hoy: ${miles(p.n)} estudiantes · ${miles(p.alto)} en alto · ${miles(p.medio)} en medio · ${miles(p.bajo)} en bajo`);
      caja.appendChild(fila);
    }
    if (filas.length > 7) caja.appendChild(html(`<button type="button" class="enlace-boton" data-todos="1">${E.todasTitulaciones ? "Ver solo las 7 primeras" : `Ver las ${filas.length} titulaciones`}</button>`));
    const elegida = html(`<p class="titulacion-elegida" aria-live="polite"></p>`);
    const pintarElegida = () => { elegida.textContent = E.titulacion ? fichaTitulacion(E.titulacion) : ""; elegida.hidden = !E.titulacion; };
    pintarElegida();
    caja.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-todos]")) { E.todasTitulaciones = !E.todasTitulaciones; pintarTablero(); return; }
      const b = ev.target.closest("[data-titulacion]");
      if (!b) return;
      filtrar({ titulacion: E.titulacion === b.dataset.titulacion ? "" : b.dataset.titulacion });
      caja.querySelectorAll("[data-titulacion]").forEach((x) => x.setAttribute("aria-pressed", String(E.titulacion === x.dataset.titulacion)));
      pintarElegida();
    });
    const explica = E.datos.explicacion_titulacion
      || "La UPV publica la carrera de cada estudiante anonimizada: «T04» es un código, no se sabe a qué carrera corresponde.";
    return celda("c7", "Titulaciones", "Dónde se concentra el riesgo alto", [html(`<p class="explica-tit">${esc(explica)}</p>`),
      html(`<div class="leyenda">${NIVELES.map((n) => `<span><i class="punto punto-${n}"></i>${n}</span>`).join("")}<span class="leyenda-derecha">% en alto</span></div>`), caja, elegida],
      "Las de menos de 10 estudiantes van al final. Pase el puntero por un código para ver su ficha; púlselo para ver solo a sus estudiantes.");
  }

  /* 4. Lo que pasó de verdad en cada nivel (la base es histórica y trae el desenlace). */
  function graficaAciertos() {
    const n = E.datos.niveles;
    if (!n || !NIVELES.some((k) => n[k] && n[k].n)) return null;
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
      `En total abandonó el ${pct(tasa, 0)}. Si el modelo sirve, en alto abandonan varias veces más que en bajo; con tan pocos abandonos, ni en alto son mayoría. Resultados definitivos.${ing ? ` El aviso antes de las notas (provisionales) es más débil: AUC ${num(ing.auc, 2)}.` : ""} Las demás notas están en <a href="modelo.html">Modelo</a>.`);
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
    const sel = $("#titulacion"), fichas = E.datos.fichas_titulacion || {};
    if (sel.options.length <= 1) sel.innerHTML = `<option value="">Todas las titulaciones</option>` + (E.datos.titulaciones || []).map((p) => {
      const f = fichas[codigoTit(p)];
      return `<option value="${esc(p)}">${esc(codigoTit(p))}${f && f.tasa != null ? ` · abandono histórico ${pct(f.tasa, 0)}` : ""}</option>`;
    }).join("");
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
        <span class="fila-id"><b>${esc(e.id)}</b><small class="fila-tit" data-tit="${esc(e.titulacion)}">${esc(e.titulacion)}</small>${e.decision === "provisional" ? `<em class="marca-prov">provisional</em>` : ""}</span>${derecha}</button></li>`;
    });
    $("#lista").innerHTML = partes.join("") || `<li class="lista-vacia">Ningún estudiante con ese filtro.</li>`;
    $("#cuenta-lista").textContent = todos.length ? `${miles(lista.length)} de ${miles(todos.length)}, del puntaje más alto al más bajo; en cada nivel, los provisionales van al final.` : "";
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

  /* Lo que la base tiene del estudiante: los 12 campos del contrato y los del contrato ampliado («sin dato» si falta). */
  function datosDe(e) {
    const r = e.registro, a = e.ampliado || {}, fila = (t, v) => `<div><dt>${t}</dt><dd class="num">${v}</dd></div>`;
    const sinDato = (v, f) => (v == null ? `<span class="sin-dato">sin dato</span>` : f(v));
    const usual = E.datos.usual || {}, con = (campo, f) => (usual[campo] != null ? ` <small>(lo usual: ${f(usual[campo])})</small>` : "");
    const d1 = (v) => num(v, 1), d0 = (v) => entero(v);
    const notas = fila("Promedio de lo aprobado (escala 0–5)", sinDato(r.promedio_acumulado, (v) => num(v, 2)))
      + fila("Suspendidas o sin nota", `${r.materias_reprobadas} de ${r.materias_cursadas_periodo_anterior}`)
      + fila("Nota media de lo presentado (0–10)", sinDato(a.nota_media_cuatrimestre, d1))
      + fila("Nota más baja (0–10)", sinDato(a.nota_minima_cuatrimestre, d1))
      + fila("Asignaturas no presentadas", sinDato(a.asignaturas_no_presentadas, d0));
    const actividad = fila("Días en el campus, sept.–nov.", sinDato(a.dias_campus_sep_nov, (v) => d0(v) + con("dias_campus_sep_nov", d0)))
      + fila("Días en el campus, dic.–enero", sinDato(a.dias_campus_dic_ene, (v) => d0(v) + con("dias_campus_dic_ene", d0)))
      + fila("Días en el aula virtual, por asignatura", sinDato(a.dias_aula_virtual, (v) => d1(v) + con("dias_aula_virtual", d0)))
      + fila("Entregas por asignatura", sinDato(a.entregas_por_asignatura, (v) => d1(v) + con("entregas_por_asignatura", d0)))
      + fila("Presencia (contrato)", sinDato(r.porcentaje_asistencia, (v) => `${entero(v)} %`));
    const admision = fila("Nota de acceso", sinDato(a.nota_acceso, (v) => `${num(v, 2)} de 14`))
      + fila("Opción en que pidió la titulación", sinDato(a.opcion_titulacion, d0))
      + fila("Vía de ingreso", sinDato(a.tipo_ingreso, (v) => (v === "NAP" ? "acceso ordinario" : `otra (${esc(v)})`)))
      + fila("Dedicación", r.trabaja ? "tiempo parcial" : "tiempo completo")
      + fila("Créditos ECTS del 1.er cuatrimestre", sinDato(e.ects, d1))
      + fila("Cohorte", `${e.cohorte}-${String(e.cohorte + 1).slice(2)}`);
    const bloque = (t, x) => `<div class="datos-bloque"><dt class="datos-titulo">${t}</dt></div>${x}`;
    const partes = [["Notas del primer cuatrimestre", notas], ["Actividad", actividad], ["Matrícula y admisión", admision]];
    if (e.decision === "provisional") partes.push(partes.shift());
    return partes.map(([t, x]) => bloque(t, x)).join("");
  }

  /* Las señales de sus datos, agrupadas por fuente, con un punto de gravedad (lleno = alta, medio = media, anillo = leve). */
  function senalesDe(e) {
    const grupos = {};
    for (const sn of e.senales || []) (grupos[sn.fuente] = grupos[sn.fuente] || []).push(sn);
    const orden = [...Object.keys(FUENTE_SENAL).filter((f) => grupos[f]), ...Object.keys(grupos).filter((f) => !FUENTE_SENAL[f])];
    return orden.map((f) => `<div class="senal-grupo"><p class="senal-fuente">${esc(FUENTE_SENAL[f] || f)}</p><ul class="senales">${grupos[f]
      .sort((a, b) => (ORDEN_GRAVEDAD[a.gravedad] ?? 3) - (ORDEN_GRAVEDAD[b.gravedad] ?? 3))
      .map((sn) => `<li><i class="grav grav-${esc(sn.gravedad)}" aria-hidden="true"></i><span>${esc(sn.texto)}<span class="oculto"> (gravedad ${esc(sn.gravedad)})</span></span></li>`).join("")}</ul></div>`).join("");
  }

  function pintarFicha(e, animar) {
    const f = $("#ficha-estudiante");
    if (!e) { f.innerHTML = `<p class="ficha-resumen">Selecciona un código de la lista para abrir su ficha.</p>`; return; }
    const cabeza = `<header class="ficha-cabecera"><h2 class="num">${esc(e.id)}</h2><p class="ficha-programa">${esc(e.titulacion)}</p></header>
      <p class="ficha-titulacion">${esc(fichaTitulacion(e.titulacion))}.</p>`;
    const datos = `<details class="ficha-datos"><summary>Sus datos en la base</summary><dl class="datos-registro">${datosDe(e)}</dl></details>`;
    if (!e.nivel) {
      f.innerHTML = `${cabeza}<div class="ficha-bento"><div class="pieza pieza-sello"><div class="sello sello-error"><b>Devuelto</b><small>al registro académico</small></div></div>
        <div class="pieza"><p class="rotulo">Qué pasó</p><p>El sistema lo devolvió solo porque ${esc(MOTIVOS[e.motivo] || e.motivo)}${e.campo ? ` (<code>${esc(nombre(e.campo))}</code>)` : ""}. Se califica en cuanto el registro corrija el dato.</p></div></div>${datos}`;
      return;
    }
    const prov = e.decision === "provisional";
    const maximo = Math.max(0.001, ...e.porque.map((p) => (prov ? p.peso : p.puntos)));
    const razones = e.porque.length ? `<div class="razones">${e.porque.slice(0, 5).map((p) => `<div class="razon"><span class="razon-texto">${esc(p.texto)}</span>
      <span class="razon-barra" aria-hidden="true"><i style="width:${(100 * (prov ? p.peso : p.puntos)) / maximo}%"></i></span>${prov ? "" : `<b class="num">+${entero(p.puntos)}</b>`}</div>`).join("")}</div>`
      : `<p class="nota">Ningún dato le suma riesgo.</p>`;
    /* Decisión: las señales (hechos legibles, por fuente y gravedad) van primero; el «por qué» del modelo (puntos que sumó
       cada dato) queda plegado debajo, porque repite los mismos hechos en otro idioma. Sin señales, se muestra el «por qué». */
    const senales = (e.senales || []).length
      ? `<div class="pieza pieza-ancha"><p class="rotulo">Señales en sus datos</p><div class="senales-zona">${senalesDe(e)}</div>
        <p class="nota senal-leyenda"><span><i class="grav grav-alta" aria-hidden="true"></i>alta</span><span><i class="grav grav-media" aria-hidden="true"></i>media</span><span><i class="grav grav-leve" aria-hidden="true"></i>leve</span></p>
        <details class="pesos"><summary>Cuánto le sumó cada dato al puntaje</summary>${razones}</details></div>`
      : `<div class="pieza pieza-ancha"><p class="rotulo">Por qué</p>${razones}</div>`;
    const textos = E.datos.textos_mejora || {};
    const mejorar = e.mejorar.length ? `<ol class="mejoras">${e.mejorar.slice(0, 3).map((m) => {
      const efecto = m.nivel_si_mejora ? `Hasta ${entero(m.puntos)} puntos menos${m.nivel_si_mejora !== e.nivel ? `: quedaría en <strong>${m.nivel_si_mejora}</strong>` : ""}.`
        : m.puntos ? `Le suma ${entero(m.puntos)} puntos de riesgo.` : "";
      return `<li><strong>${esc(m.texto || textos[m.variable] || m.variable)}</strong>${efecto ? `<span>${efecto}</span>` : ""}</li>`; }).join("")}</ol>`
      : `<p class="nota">El modelo sugiere continuar con el seguimiento habitual.</p>`;
    const [clase, frase] = veredictoReal(e);
    const sub = `Puntaje: ${e.puntaje} de 100${e.probabilidad != null ? ` · Probabilidad estimada: ${pct(e.probabilidad, 0)}` : ""}`;
    const r34 = e.r34 ? `<p class="nota">Alto por la regla R3.4 del contrato: promedio menor a 3,0 y asistencia (aquí, presencia) menor a 70 %.</p>` : "";
    const plan = e.plan, persona = plan && (E.datos.equipo || []).find((p) => p.id === plan.asignada);
    const apoyo = plan
      ? `<div class="pieza"><p class="rotulo">Ruta sugerida</p><p class="pieza-accion">${esc(plan.ruta)}</p>${plan.porque ? `<p class="plan-porque">— ${esc(plan.porque)}.</p>` : ""}${r34}</div>`
      : `<div class="pieza"><p class="rotulo">Apoyo sugerido</p><p class="pieza-accion">${esc(ACCIONES[e.accion] || e.accion || "")}</p>${r34}</div>`;
    const asignado = persona ? `<div class="pieza pieza-ancha pieza-asignado"><span class="avatar" aria-hidden="true">${esc(persona.iniciales)}</span>
      <p><span class="rotulo">Asignado a</span><span><strong>${esc(persona.nombre)}</strong>, ${esc(persona.rol)}</span></p>
      <a href="bienestar.html">Ver en la Bandeja</a></div>` : "";
    f.innerHTML = `${cabeza}<div class="ficha-bento">
      <div class="pieza pieza-sello"><div class="sello sello-${e.nivel}${prov ? " sello-provisional" : ""}${animar ? " recien" : ""}"><b>Riesgo ${e.nivel}</b><small>${prov ? "provisional · " : ""}${sub}</small></div></div>
      ${apoyo}${asignado}
      ${prov ? `<p class="pieza pieza-ancha pieza-aviso">Es <strong>provisional</strong>: el contrato no lo pudo calificar porque ${esc(MOTIVOS[e.motivo] || e.motivo)}${e.campo ? ` (<code>${esc(nombre(e.campo))}</code>)` : ""}, así que se calculó sin notas: con su matrícula, su actividad en el campus y en el aula virtual, y su titulación (el aviso antes de las notas). El sistema ya le pidió el dato al registro.</p>` : ""}
      ${e.sin_dato && e.sin_dato.length ? `<p class="pieza pieza-ancha nota">Sin dato en la base: ${e.sin_dato.map((c) => esc(nombre(c))).join(", ")}. El modelo usó el valor usual y lo tuvo en cuenta como dato que falta; no se inventó.</p>` : ""}
      ${senales}
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

  /* ================================================================== arranque */
  function iniciarEstudiantes() {
    let pendiente = 0;
    addEventListener("resize", () => {
      cancelAnimationFrame(pendiente);
      pendiente = requestAnimationFrame(() => { const P = E.carga; if (P && P.geo && document.contains(P.cuerpo)) { medir(P); dibujar(P, P.t ?? FIN); } });
    });
    const previa = cargaGuardada();
    const pedido = /[A-Z]+\d*-\d+/.test(location.hash);
    /* Si hoy ya se leyó en este navegador (o se pidió un estudiante por enlace), el resultado va directo. */
    if (previa && esHoy(previa.fecha)) return cargar({ animar: false, guardada: previa });
    if (pedido) return cargar({ animar: false });
    return pintarInicio();
  }

  window.SAT = Object.assign(window.SAT || {}, { iniciarEstudiantes });
})();
