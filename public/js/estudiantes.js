/* Script clásico (sin módulos). Vista Estudiantes (base de datos real).
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

  /* ================================================================== ESTUDIANTES */
  const GRUPOS = [
    ["todos", "Todos"], ["alto", "Riesgo alto"], ["medio", "Riesgo medio"], ["bajo", "Riesgo bajo"],
    ["revision", "Revisar a mano"], ["error", "Dato con error"],
  ];
  const grupoDe = (e) => (e.decision === "resultado" ? e.nivel : e.decision === "abstener" ? "revision" : "error");
  const SELLO = { alto: ["alto", "Alto"], medio: ["medio", "Medio"], bajo: ["bajo", "Bajo"], revision: ["humano", "Revisar"], error: ["alto error", "Error"] };
  const DESENLACE = { deserto: "Desertó", se_graduo: "Se graduó", sigue_matriculado: "Sigue matriculado" };
  const CAMPOS_FICHA = [
    ["promedio_acumulado", "Promedio", (v) => num(v, 2)], ["materias_cursadas_periodo_anterior", "Materias cursadas", entero],
    ["materias_reprobadas", "Materias reprobadas", entero], ["porcentaje_asistencia", "Se presentó a evaluación", (v) => `${entero(v)} %`],
    ["creditos_inscritos", "Créditos", entero], ["estrato", "Escolaridad del hogar", (v) => `banda ${v} de 6`],
    ["trabaja", "Jornada nocturna", (v) => (v ? "sí" : "no")], ["deuda_matricula", "Deuda de matrícula", (v) => (v == null ? "sin dato" : v ? "sí" : "no")],
  ];
  const E = { datos: null, filtro: "todos", texto: "", programa: "", visibles: 25, elegido: null, deCopia: false };

  function razonCorta(e) {
    if (e.decision === "resultado") return e.porque.length ? e.porque[0].texto : "Sin factores de riesgo";
    return MOTIVOS[e.motivo] || e.motivo;
  }

  function filtrados() {
    const t = E.texto.trim().toLowerCase();
    return E.datos.estudiantes.filter((e) => (E.filtro === "todos" || grupoDe(e) === E.filtro)
      && (!E.programa || e.programa === E.programa) && (!t || e.id.toLowerCase().includes(t)));
  }

  /* La tira del proceso automático: base de datos → validación → modelo → resultado, con las cifras de esta lectura. */
  function pintarTuberia() {
    const d = E.datos, ej = d.ejecucion, n = d.niveles;
    const pasos = [
      ["Base de datos", miles(ej.leidos), "registros leídos", `${esc(d.base.archivo)} · ${miles(d.base.total)} en total`],
      ["Validación", miles(ej.calificados), "pasan el contrato", `${miles(ej.a_revision)} a revisión · ${miles(ej.con_error)} con error`],
      ["Modelo", `${num(ej.ms_lectura + ej.ms_modelo, 0)} ms`, "para calificarlos a todos", esc(NOMBRE_MODELO[ej.modelo])],
      ["Resultado", miles(n.alto.n), "en riesgo alto", `${miles(n.medio.n)} en medio · ${miles(n.bajo.n)} en bajo`],
    ];
    const ol = $("#tuberia");
    ol.innerHTML = pasos.map(([t, cifra, que, sub]) => `<li class="tubo"><span class="tubo-titulo">${t}</span>
      <b class="tubo-cifra num">${cifra}</b><span class="tubo-que">${que}</span><span class="tubo-sub">${sub}</span></li>`).join("");
    aparecer(ol.children, { pausa: 110, duracion: 300, desde: "translateX(-10px)" });
    const fecha = new Date(ej.fecha);
    $("#estado-lectura").innerHTML = E.deCopia
      ? "No se pudo consultar la base en este momento. Se muestra la copia de la última corrida guardada."
      : `Base leída y calificada el ${fecha.toLocaleDateString("es-CO", { day: "numeric", month: "long" })} a las ${fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/\.$/, "")}. Cada vez que abre esta página, el proceso corre de nuevo.`;
  }

  function pintarFiltros() {
    const cuenta = { todos: E.datos.estudiantes.length };
    for (const e of E.datos.estudiantes) cuenta[grupoDe(e)] = (cuenta[grupoDe(e)] || 0) + 1;
    $("#chips").innerHTML = GRUPOS.map(([k, t]) => `<button type="button" class="chip chip-${k}" data-grupo="${k}" aria-pressed="${E.filtro === k}">
      <i aria-hidden="true"></i>${t}<b class="num">${miles(cuenta[k] || 0)}</b></button>`).join("");
    const sel = $("#programa");
    if (sel.options.length <= 1) sel.innerHTML = `<option value="">Todos los programas</option>` + E.datos.programas.map((p) => `<option>${esc(p)}</option>`).join("");
  }

  function pintarLista() {
    const todos = filtrados(), lista = todos.slice(0, E.visibles), cortes = E.datos.cortes;
    const ol = $("#lista");
    ol.innerHTML = lista.map((e) => {
      const g = grupoDe(e), [clase, texto] = SELLO[g];
      const barra = e.decision === "resultado"
        ? `<span class="fila-barra" aria-hidden="true"><i class="relleno-${e.nivel}" style="width:${Math.max(2, e.puntaje)}%"></i>${cortes ? `<u style="left:${cortes.corte_medio}%"></u><u style="left:${cortes.corte_alto}%"></u>` : ""}</span><span class="fila-puntaje num">${e.puntaje}</span>`
        : `<span class="fila-barra vacia" aria-hidden="true"></span><span class="fila-puntaje">–</span>`;
      return `<li><button type="button" class="fila-est" data-id="${esc(e.id)}" aria-pressed="${E.elegido === e.id}">
        <span class="mini-sello ${clase}">${texto}</span>
        <span class="fila-id"><b>${esc(e.id)}</b><small>${esc(e.programa)}</small></span>
        ${barra}<span class="fila-razon">${esc(razonCorta(e))}</span></button></li>`;
    }).join("") || `<li class="lista-vacia">Ningún estudiante con ese filtro.</li>`;
    $("#cuenta-lista").textContent = todos.length ? `Se muestran ${miles(lista.length)} de ${miles(todos.length)}, del riesgo más alto al más bajo.` : "";
    $("#btn-mas").hidden = lista.length >= todos.length;
    if (!todos.some((e) => e.id === E.elegido)) elegir(todos.length ? todos[0].id : null, false);
  }

  function veredictoReal(e) {
    const deserto = e.desenlace === "deserto", avisado = e.nivel === "alto";
    if (avisado && deserto) return ["acierto", "El modelo avisó a tiempo."];
    if (avisado) return ["fallo", "Fue una falsa alarma del modelo."];
    if (deserto) return ["fallo", `El modelo lo dejó en nivel ${e.nivel}: se le escapó.`];
    return ["acierto", "El modelo no dio alerta alta, y acertó."];
  }

  function pintarFicha(e, animar) {
    const f = $("#ficha-estudiante");
    if (!e) { f.innerHTML = `<p class="ficha-resumen">Elija un estudiante de la lista.</p>`; return; }
    const meta = `<header class="ficha-cabecera"><h2>${esc(e.id)}</h2><dl class="ficha-meta">
      <div><dt>Programa</dt><dd>${esc(e.programa)}</dd></div><div><dt>Edad al ingresar</dt><dd>${e.edad}</dd></div>
      <div><dt>Beca</dt><dd>${e.becado ? "sí" : "no"}</dd></div></dl></header>`;
    const datos = `<section class="ficha-bloque"><h3>Sus datos en la base</h3><dl class="datos-registro">${CAMPOS_FICHA.map(([k, t, fmt]) =>
      `<div><dt>${t}</dt><dd class="num">${fmt(e.registro[k])}</dd></div>`).join("")}</dl></section>`;
    let cuerpo;
    if (e.decision !== "resultado") {
      const humano = e.decision === "abstener";
      cuerpo = `<div class="sello-zona"><div class="sello ${humano ? "sello-humano" : "sello-error"}"><b>${humano ? "Revisar a mano" : "Dato con error"}</b>
        <small>${humano ? "el sistema se abstiene" : "se devuelve al registro"}</small></div></div>
        <p class="ficha-resumen">${humano ? "El sistema no lo califica" : "El registro se rechaza"} porque ${esc(MOTIVOS[e.motivo] || e.motivo)}${e.campo ? ` (<code>${esc(nombre(e.campo))}</code>)` : ""}.
        ${humano ? "Una persona de bienestar debe revisar el caso." : "Hay que corregir el dato en el sistema de origen."}</p>${datos}`;
    } else {
      const maximo = Math.max(1, ...e.porque.map((p) => p.puntos));
      const porque = e.porque.length ? e.porque.map((p) => `<div class="razon"><span class="razon-texto">${esc(p.texto)}</span>
        <span class="razon-barra" aria-hidden="true"><i style="width:${(100 * p.puntos) / maximo}%"></i></span><b class="num">+${entero(p.puntos)}</b></div>`).join("")
        : `<p class="nota">Ningún dato le suma puntos de riesgo.</p>`;
      const mejorar = e.mejorar.length ? `<ol class="mejoras">${e.mejorar.slice(0, 3).map((m) => {
        const efecto = m.nivel_si_mejora
          ? `Le quitaría hasta ${entero(m.puntos)} puntos${m.nivel_si_mejora !== e.nivel ? ` y lo dejaría en nivel <strong>${m.nivel_si_mejora}</strong>` : ""}.`
          : `Es de lo que más le sube el riesgo (${entero(m.puntos)} puntos).`;
        return `<li><strong>${esc(m.texto)}</strong><span>${efecto}</span></li>`; }).join("")}</ol>`
        : `<p class="nota">No hay un factor que bienestar pueda trabajar: basta el seguimiento rutinario.</p>`;
      const [clase, frase] = veredictoReal(e);
      const prob = e.probabilidad != null ? ` · probabilidad ${pct(e.probabilidad, 0)}` : "";
      cuerpo = `<div class="sello-zona"><div class="sello sello-${e.nivel}${animar ? " recien" : ""}"><b>Riesgo ${e.nivel}</b><small>${e.puntaje} de 100${prob}</small></div></div>
        <p class="ficha-resumen">Acción: <strong>${esc(ACCIONES[e.accion] || e.accion)}</strong>.${e.r34 ? " Nivel alto por la regla R3.4 (promedio menor a 3,0 y asistencia menor a 70 %)." : ""}</p>
        <section class="ficha-bloque"><h3>Por qué</h3><div class="razones">${porque}</div></section>
        <section class="ficha-bloque"><h3>En qué mejorar</h3>${mejorar}</section>${datos}
        <section class="ficha-bloque"><h3>Qué pasó en realidad</h3><p class="desenlace ${clase}"><span aria-hidden="true">${clase === "acierto" ? "✓" : "✗"}</span>
          <span><strong>${DESENLACE[e.desenlace]}.</strong> ${frase}</span></p>
          <p class="nota">La base es histórica: el desenlace se conoce, pero el modelo nunca lo vio.</p></section>`;
    }
    f.innerHTML = meta + cuerpo;
  }

  function elegir(id, animar = true) {
    E.elegido = id;
    document.querySelectorAll(".fila-est").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
    pintarFicha(E.datos.estudiantes.find((e) => e.id === id), animar);
  }

  async function leerBase() {
    const btn = $("#btn-leer");
    btn.disabled = true;
    $("#estado-lectura").textContent = "Leyendo la base de datos y calificando a cada estudiante…";
    E.deCopia = false;
    try {
      const d = await json(`api/estudiantes?modelo=${modeloElegido()}`);
      if (d.error) throw new Error(d.detalle || d.error);
      E.datos = d;
    } catch (e1) {
      try { E.datos = await json("reportes/real/estudiantes.json"); E.deCopia = true; }
      catch (e2) { $("#estado-lectura").textContent = "No se pudo leer la base de datos ni la copia de la última corrida."; btn.disabled = false; return; }
    }
    btn.disabled = false;
    E.visibles = 25;
    pintarTuberia(); pintarFiltros(); pintarLista();
  }

  function iniciarEstudiantes() {
    $("#chips").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-grupo]");
      if (!b) return;
      E.filtro = b.dataset.grupo; E.visibles = 25; pintarFiltros(); pintarLista();
    });
    $("#lista").addEventListener("click", (ev) => {
      const b = ev.target.closest(".fila-est");
      if (!b) return;
      elegir(b.dataset.id);
      if (matchMedia("(max-width: 940px)").matches) $("#ficha-estudiante").scrollIntoView({ behavior: reducido() ? "auto" : "smooth", block: "start" });
    });
    $("#buscar").addEventListener("input", (ev) => { E.texto = ev.target.value; E.visibles = 25; pintarLista(); });
    $("#programa").addEventListener("change", (ev) => { E.programa = ev.target.value; E.visibles = 25; pintarLista(); });
    $("#btn-mas").addEventListener("click", () => { E.visibles += 25; pintarLista(); });
    $("#btn-leer").addEventListener("click", leerBase);
    document.querySelectorAll('input[name="modelo-operacion"]').forEach((r) => r.addEventListener("change", leerBase));
    return leerBase();
  }

  window.SAT = Object.assign(window.SAT || {}, { iniciarEstudiantes });
})();
