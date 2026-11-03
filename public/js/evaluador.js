/* Script clásico (sin módulos) para que la página funcione también abierta como archivo.
   Planilla + ficha de seguimiento. No recalcula ningún modelo: siempre pregunta a /api/evaluar,
   así la página nunca contradice al paquete Python (Paso 1, R3.4 y garantías incluidas). */
(function () {
  "use strict";
  const { $, esc, pct, num, json, nombre, ACCIONES, MOTIVOS, s, lienzo, escala, crearRecorrido, marcarRecorrido } = window.SAT;

  /* Respaldo del esquema del contrato (igual a public/reportes/esquema.json, que genera
     python -m desercion.publicar desde desercion/contrato.py). Se usa solo si ese archivo no carga. */
  const ESQUEMA_RESPALDO = { campos: {
    id_estudiante: { tipo: "str", obligatorio: true },
    nivel_formacion: { tipo: "enum", obligatorio: true, valores: ["educacion_continua", "posgrado", "pregrado"] },
    estado_matricula: { tipo: "enum", obligatorio: true, valores: ["activo", "graduado", "retirado"] },
    semestre: { tipo: "int", obligatorio: true, rango: [1, 12] },
    promedio_acumulado: { tipo: "num", obligatorio: true, rango: [0, 5] },
    creditos_inscritos: { tipo: "int", obligatorio: true, rango: [0, 25] },
    materias_cursadas_periodo_anterior: { tipo: "int", obligatorio: true, rango: [0, 12] },
    materias_reprobadas: { tipo: "int", obligatorio: true, rango: [0, 12] },
    porcentaje_asistencia: { tipo: "num", obligatorio: true, rango: [0, 100] },
    estrato: { tipo: "int", obligatorio: true, rango: [1, 6] },
    trabaja: { tipo: "bool", obligatorio: true },
    deuda_matricula: { tipo: "bool", obligatorio: false },
  } };

  const ETIQUETAS = {
    id_estudiante: "Identificador", nivel_formacion: "Nivel de formación", estado_matricula: "Estado de matrícula",
    semestre: "Semestre", promedio_acumulado: "Promedio acumulado", creditos_inscritos: "Créditos inscritos",
    materias_cursadas_periodo_anterior: "Materias cursadas el periodo anterior", materias_reprobadas: "Materias reprobadas",
    porcentaje_asistencia: "Asistencia", estrato: "Estrato", trabaja: "¿Trabaja?", deuda_matricula: "¿Debe matrícula?",
  };
  const PISTAS = {
    id_estudiante: "Cualquier código; no se usa para calificar.",
    nivel_formacion: "El sistema solo califica pregrado.",
    estado_matricula: "El sistema solo califica estudiantes activos.",
    semestre: "El sistema solo califica los semestres 2 a 4.",
    promedio_acumulado: "Escala de 0,0 a 5,0; se aprueba con 3,0.",
    creditos_inscritos: "Activo con 0 créditos es una contradicción.",
    materias_cursadas_periodo_anterior: "Desde el semestre 2 debe haber al menos una.",
    materias_reprobadas: "No puede superar las cursadas.",
    porcentaje_asistencia: "De 0 a 100. Las reglas usan 70 % y 85 % como umbrales.",
    estrato: "Estrato socioeconómico de la vivienda (1 es el más bajo).",
    deuda_matricula: "Si no se sabe, el sistema no lo inventa.",
  };
  const SUFIJO = { porcentaje_asistencia: " %" };
  const PASOS_NUM = { promedio_acumulado: 0.01, porcentaje_asistencia: 0.1 };
  const EJEMPLO = {
    id_estudiante: "EJEMPLO-001", nivel_formacion: "pregrado", estado_matricula: "activo", semestre: 3,
    promedio_acumulado: 3.1, creditos_inscritos: 15, materias_cursadas_periodo_anterior: 6, materias_reprobadas: 2,
    porcentaje_asistencia: 76.5, estrato: 2, trabaja: true, deuda_matricula: false,
  };
  /* Casos típicos R01–R03 del contrato (contexto/dataset.py), datos inventados para la práctica. */
  const BASE = { nivel_formacion: "pregrado", estado_matricula: "activo", materias_cursadas_periodo_anterior: 6, creditos_inscritos: 16, deuda_matricula: false };
  const CASOS = [
    { id: "R01", texto: "Promedio 3,8, asistencia del 92 % y ninguna materia perdida. Estrato 3, no trabaja.",
      entrada: { ...BASE, id_estudiante: "EST-101", semestre: 3, promedio_acumulado: 3.8, materias_reprobadas: 0, porcentaje_asistencia: 92, estrato: 3, trabaja: false } },
    { id: "R02", texto: "Promedio 3,2, una materia perdida, asistencia del 80 %. Estrato 2 y trabaja.",
      entrada: { ...BASE, id_estudiante: "EST-102", semestre: 2, promedio_acumulado: 3.2, materias_reprobadas: 1, porcentaje_asistencia: 80, estrato: 2, trabaja: true, creditos_inscritos: 15 } },
    { id: "R03", texto: "Promedio 2,7, tres de cinco materias perdidas, asistencia del 65 %. Estrato 1, trabaja y debe matrícula.",
      entrada: { ...BASE, id_estudiante: "EST-103", semestre: 4, promedio_acumulado: 2.7, materias_cursadas_periodo_anterior: 5, materias_reprobadas: 3, porcentaje_asistencia: 65, estrato: 1, trabaja: true, deuda_matricula: true, creditos_inscritos: 12 } },
  ];
  const SELLOS = {
    alto: ["Riesgo alto", "Remitir a bienestar y tutoría"],
    medio: ["Riesgo medio", "Tutoría académica"],
    bajo: ["Riesgo bajo", "Seguimiento rutinario"],
  };
  const MODOS = { reglas: "reglas del contrato", logistica: "regresión logística", red_neuronal: "red neuronal" };

  let ESQUEMA = ESQUEMA_RESPALDO;
  let TASA_BASE = 0.183;
  const valores = {};
  let temporizador = null;
  let solicitud = 0;
  let svgRecorrido = null;
  let ultimoNivel = null;

  async function evaluar(entrada, modo) {
    const cuerpo = { entrada, ...(modo === "reglas" ? { modo: "reglas" } : { modo: "aprendido", modelo: modo }) };
    const r = await fetch("api/evaluar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    if (!r.headers.get("content-type")?.includes("json")) throw new Error(`la API respondió ${r.status}`);
    return r.json();
  }

  /* ---------------------------------------------------------------- planilla */
  function crearCampos() {
    const cont = $("#campos");
    cont.replaceChildren();
    for (const [campo, def] of Object.entries(ESQUEMA.campos)) {
      const div = document.createElement("div");
      div.className = "campo vacio";
      div.dataset.campo = campo;
      const opcional = def.obligatorio ? "" : ' <span class="opcional">(opcional)</span>';
      let control;
      if (def.tipo === "str") {
        control = `<input type="text" id="c-${campo}" placeholder="por ejemplo EST-123" maxlength="40">`;
      } else if (def.tipo === "enum") {
        control = `<select id="c-${campo}"><option value="">elegir…</option>${def.valores.map((v) => `<option value="${esc(v)}">${esc(v.replace("_", " "))}</option>`).join("")}</select>`;
      } else if (def.tipo === "bool") {
        control = `<div class="dos-o-tres" role="group" aria-labelledby="l-${campo}">
          ${def.obligatorio ? "" : '<button type="button" data-v="">no se sabe</button>'}
          <button type="button" data-v="true">sí</button><button type="button" data-v="false">no</button></div>`;
      } else {
        const [min, max] = def.rango;
        const paso = PASOS_NUM[campo] || 1;
        control = `<div class="fila-num">
          <input type="number" id="c-${campo}" min="${min}" max="${max}" step="${paso}" inputmode="decimal" placeholder="${min} a ${max}" aria-describedby="p-${campo}">
          <input type="range" id="r-${campo}" min="${min}" max="${max}" step="${paso}" value="${min}" aria-label="${esc(ETIQUETAS[campo])}, deslizador" tabindex="-1">
        </div>`;
      }
      const etiqueta = def.tipo === "bool" ? `<span class="etiqueta" id="l-${campo}">${esc(ETIQUETAS[campo])}${opcional}</span>`
        : `<label for="c-${campo}" id="l-${campo}">${esc(ETIQUETAS[campo])}${opcional}</label>`;
      div.innerHTML = `<div class="campo-cabeza">${etiqueta}<span class="valor" id="v-${campo}"></span></div>${control}
        ${PISTAS[campo] ? `<span class="pista" id="p-${campo}">${PISTAS[campo]}</span>` : ""}`;
      cont.appendChild(div);
      fijar(campo, undefined);
    }
    cont.addEventListener("input", alCambiar);
    cont.addEventListener("change", alCambiar);
    cont.addEventListener("click", (ev) => {
      const b = ev.target.closest(".dos-o-tres button");
      if (!b) return;
      fijar(b.closest(".campo").dataset.campo, b.dataset.v === "" ? undefined : b.dataset.v === "true");
      actualizar();
    });
    document.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener("change", actualizar));
    $("#btn-ejemplo").addEventListener("click", () => cargarEnPlanilla(EJEMPLO));
    $("#btn-limpiar").addEventListener("click", () => {
      for (const k of Object.keys(ESQUEMA.campos)) fijar(k, undefined);
      if (location.hash) history.replaceState(null, "", location.pathname);
      actualizar();
      $("#c-id_estudiante").focus();
    });
  }

  function cargarEnPlanilla(datos) {
    for (const k of Object.keys(ESQUEMA.campos)) fijar(k, datos[k]);
    actualizar();
  }

  function alCambiar(ev) {
    const el = ev.target;
    const div = el.closest(".campo");
    if (!div) return;
    const campo = div.dataset.campo, def = ESQUEMA.campos[campo];
    if (def.tipo === "str" || def.tipo === "enum") fijar(campo, el.value.trim() === "" ? undefined : el.value, "texto");
    else if (el.type === "range" || el.type === "number") {
      const texto = el.value.replace(",", ".");
      if (texto === "" || Number.isNaN(Number(texto))) fijar(campo, undefined, "caja");
      else fijar(campo, def.tipo === "int" ? Math.round(Number(texto)) : Number(texto), el.type === "range" ? "deslizador" : "caja");
    }
    actualizar();
  }

  /* `origen` es el control que generó el cambio; ese no se reescribe para no mover el cursor. */
  function fijar(campo, valor, origen = null) {
    const def = ESQUEMA.campos[campo];
    if (valor === undefined) delete valores[campo]; else valores[campo] = valor;
    const div = document.querySelector(`.campo[data-campo="${campo}"]`);
    div.classList.toggle("vacio", valor === undefined);
    const etiqueta = $(`#v-${campo}`);
    if (def.tipo === "bool") {
      div.querySelectorAll(".dos-o-tres button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.v === "" ? undefined : b.dataset.v === "true") === valor)));
      etiqueta.textContent = valor === undefined ? (def.obligatorio ? "falta" : "no se sabe") : valor ? "sí" : "no";
    } else if (def.tipo === "str" || def.tipo === "enum") {
      if (origen !== "texto") $(`#c-${campo}`).value = valor ?? "";
      etiqueta.textContent = valor === undefined ? "falta" : "";
    } else {
      if (origen !== "caja") $(`#c-${campo}`).value = valor ?? "";
      const rango = $(`#r-${campo}`);
      if (origen !== "deslizador") rango.value = valor ?? def.rango[0];
      etiqueta.textContent = valor === undefined ? "falta" : String(valor).replace(".", ",") + (SUFIJO[campo] || "");
    }
  }

  const modoActual = () => document.querySelector('input[name="modo"]:checked').value;
  const faltantes = () => Object.entries(ESQUEMA.campos).filter(([k, d]) => d.obligatorio && valores[k] === undefined).map(([k]) => k);

  function actualizar() {
    clearTimeout(temporizador);
    $("#ficha-id").textContent = valores.id_estudiante || "sin identificar";
    $("#ficha-modo").textContent = MODOS[modoActual()];
    const faltan = faltantes();
    if (faltan.length) {
      solicitud++;
      ultimoNivel = null;
      $("#sello").innerHTML = `<p class="sello-vacio">Faltan ${faltan.length} ${faltan.length === 1 ? "dato" : "datos"}</p>`;
      $("#ficha-resumen").textContent = `Para calificar falta: ${faltan.map((k) => ETIQUETAS[k].toLowerCase().replace(/[¿?]/g, "")).join(", ")}.`;
      $("#ficha-detalle").hidden = true;
      marcarRecorrido(svgRecorrido, null);
      pintarFlotante(`Faltan ${faltan.length} datos`, "");
      return;
    }
    temporizador = setTimeout(consultar, 300);
  }

  async function consultar() {
    const id = ++solicitud;
    const modo = modoActual();
    try {
      const salida = await evaluar({ ...valores }, modo);
      if (id === solicitud) pintar(salida, modo);
    } catch (e) {
      if (id !== solicitud) return;
      $("#sello").innerHTML = `<p class="sello-vacio">Sin conexión con el sistema</p>`;
      $("#ficha-resumen").innerHTML = location.protocol === "file:"
        ? "Abrió la página como archivo. Para calificar hace falta el servidor: ejecute <code>python servidor_local.py</code> y entre a <code>http://localhost:8000</code>, o use la versión publicada."
        : `La API no respondió (${esc(e.message)}).`;
      $("#ficha-detalle").hidden = true;
    }
  }

  function sello(clase, titulo, detalle, animar) {
    return `<div class="sello ${clase}${animar ? " recien" : ""}" role="status"><b>${esc(titulo)}</b><small>${esc(detalle)}</small></div>`;
  }

  function pintar(salida, modo) {
    const r34 = salida.decision === "resultado" && (salida.regla_r34 || (modo === "reglas" && valores.promedio_acumulado < 3 && valores.porcentaje_asistencia < 70));
    marcarRecorrido(svgRecorrido, salida, { r34 });
    if (salida.decision !== "resultado") {
      const humano = salida.decision === "abstener";
      const campos = salida.campos ? ` (${salida.campos.map((c) => ETIQUETAS[c] || c).join(", ")})` : salida.campo ? ` en «${ETIQUETAS[salida.campo] || salida.campo}»` : "";
      const clave = `${salida.decision}-${salida.motivo}`;
      $("#sello").innerHTML = humano ? sello("sello-humano", "Revisión humana", "Remitido a consejería", clave !== ultimoNivel)
        : sello("sello-error", "Dato rechazado", "Corregir en el sistema de origen", clave !== ultimoNivel);
      ultimoNivel = clave;
      $("#ficha-resumen").textContent = humano
        ? `El sistema no decide porque ${MOTIVOS[salida.motivo] || salida.motivo}${campos}. Una persona revisa el caso.`
        : `Error controlado: ${MOTIVOS[salida.motivo] || salida.motivo}${campos}. El sistema no adivina el dato.`;
      $("#ficha-detalle").hidden = true;
      pintarFlotante(humano ? "Revisión humana" : "Dato rechazado", humano ? "humano" : "alto");
      return;
    }
    const [titulo, detalle] = SELLOS[salida.nivel];
    $("#sello").innerHTML = sello(`sello-${salida.nivel}`, titulo, detalle, salida.nivel !== ultimoNivel);
    ultimoNivel = salida.nivel;
    const prob = salida.probabilidad !== undefined ? `; probabilidad estimada ${pct(salida.probabilidad)}` : "";
    const extras = [];
    if (r34) extras.push("La regla R3.4 (promedio menor que 3,0 y asistencia menor que 70 %) fuerza el nivel alto.");
    if (salida.datos_no_informados?.length) extras.push(`No se informó ${salida.datos_no_informados.map((c) => nombre(c)).join(", ")}: no se inventa y se usa el valor que no baja el riesgo.`);
    $("#ficha-resumen").innerHTML = `<strong>${salida.en_riesgo ? "Se considera en riesgo de desertar." : "No se considera en riesgo."}</strong>
      Puntaje ${salida.puntaje} de 100${prob}. Acción: ${esc(ACCIONES[salida.accion])}. ${esc(extras.join(" "))}`;
    $("#ficha-detalle").hidden = false;
    pintarRegla(salida);
    pintarSigmoide(salida, modo);
    pintarInfluencia(salida, modo);
    pintarFlotante(titulo, salida.nivel);
  }

  /* Regla de 0 a 100 con los tres tramos del semáforo y la aguja del estudiante */
  function pintarRegla(salida) {
    const c = salida.cortes || { corte_medio: 30, corte_alto: 60 };
    const W = 400, Hh = 64, m = 8;
    const X = escala(0, 100, m, W - m);
    const svg = lienzo(W, Hh, `Puntaje ${salida.puntaje} de 100; medio desde ${c.corte_medio}, alto desde ${c.corte_alto}`);
    const tramos = [[0, c.corte_medio, "var(--bajo)", "bajo"], [c.corte_medio, c.corte_alto, "var(--medio)", "medio"], [c.corte_alto, 100, "var(--alto)", "alto"]];
    for (const [a, b, color, et] of tramos) {
      svg.appendChild(s("rect", { x: X(a), y: 24, width: Math.max(0, X(b) - X(a) - 2), height: 12, rx: 3, fill: color, opacity: et === salida.nivel ? 0.95 : 0.3 }));
      if (X(b) - X(a) > 44) svg.appendChild(s("text", { x: (X(a) + X(b)) / 2, y: 52, "text-anchor": "middle", class: "etiqueta-svg", texto: et }));
    }
    for (const v of [0, c.corte_medio, c.corte_alto, 100]) svg.appendChild(s("text", { x: X(v), y: 62, "text-anchor": v === 0 ? "start" : v === 100 ? "end" : "middle", class: "etiqueta-svg", texto: v }));
    const x = X(Math.max(0, Math.min(100, salida.puntaje)));
    svg.appendChild(s("path", { d: `M${x - 6},4 L${x + 6},4 L${x},14 z`, fill: "var(--tinta)" }));
    svg.appendChild(s("line", { x1: x, x2: x, y1: 14, y2: 40, stroke: "var(--tinta)", "stroke-width": 2.5 }));
    svg.appendChild(s("text", { x: x + (x > W - 80 ? -10 : 10), y: 12, "text-anchor": x > W - 80 ? "end" : "start", class: "texto-svg-fuerte", texto: `${salida.puntaje} puntos` }));
    $("#regla-puntaje").replaceChildren(svg);
  }

  /* Curva sigmoide: cómo el logit (suma ponderada) se convierte en probabilidad */
  function pintarSigmoide(salida, modo) {
    const bloque = $("#bloque-sigmoide");
    if (modo === "reglas" || salida.probabilidad === undefined) { bloque.hidden = true; return; }
    bloque.hidden = false;
    const p = Math.min(0.995, Math.max(0.005, salida.probabilidad));
    const z = Math.log(p / (1 - p));
    const W = 400, Hh = 170, m = { izq: 36, der: 10, arr: 10, aba: 30 };
    const X = escala(-5, 4, m.izq, W - m.der), Y = escala(0, 1, Hh - m.aba, m.arr);
    const svg = lienzo(W, Hh, `Curva sigmoide; este estudiante tiene probabilidad ${pct(p)}`);
    for (const v of [0, 0.5, 1]) {
      svg.appendChild(s("line", { x1: m.izq, x2: W - m.der, y1: Y(v), y2: Y(v), stroke: "var(--renglon)", "stroke-dasharray": "2 3" }));
      svg.appendChild(s("text", { x: m.izq - 6, y: Y(v) + 4, "text-anchor": "end", class: "etiqueta-svg", texto: `${v * 100} %` }));
    }
    let d = "";
    for (let i = 0; i <= 90; i++) { const zz = -5 + i * 0.1; d += `${i ? "L" : "M"}${X(zz).toFixed(1)},${Y(1 / (1 + Math.exp(-zz))).toFixed(1)}`; }
    svg.appendChild(s("path", { d, fill: "none", stroke: "var(--acento)", "stroke-width": 2.5 }));
    svg.appendChild(s("line", { x1: m.izq, x2: W - m.der, y1: Y(TASA_BASE), y2: Y(TASA_BASE), stroke: "var(--tenue)", "stroke-dasharray": "5 4" }));
    svg.appendChild(s("text", { x: W - m.der, y: Y(TASA_BASE) + 14, "text-anchor": "end", class: "etiqueta-svg", texto: `tasa simulada ${pct(TASA_BASE, 0)}` }));
    svg.appendChild(s("line", { x1: X(z), x2: X(z), y1: Hh - m.aba, y2: Y(p), stroke: "var(--tinta)", "stroke-dasharray": "3 3" }));
    svg.appendChild(s("line", { x1: m.izq, x2: X(z), y1: Y(p), y2: Y(p), stroke: "var(--tinta)", "stroke-dasharray": "3 3" }));
    svg.appendChild(s("circle", { cx: X(z), cy: Y(p), r: 6, fill: `var(--${salida.nivel})`, stroke: "var(--hoja)", "stroke-width": 2 }));
    svg.appendChild(s("text", { x: X(z) - 10, y: Y(p) - 8, "text-anchor": "end", class: "texto-svg-fuerte", texto: pct(p) }));
    svg.appendChild(s("text", { x: (m.izq + W - m.der) / 2, y: Hh - 6, "text-anchor": "middle", class: "etiqueta-svg", texto: "suma ponderada de las variables (logit)" }));
    $("#sigmoide").replaceChildren(svg);
  }

  function pintarInfluencia(salida, modo) {
    $("#nota-influencia").textContent = {
      reglas: "Puntos fijos escritos en el contrato (R2.1 a R2.6). La suma es el puntaje.",
      logistica: "Puntos de la tarjeta aprendida. Cada variable da 0 en su valor de menor riesgo; la suma es el puntaje.",
      red_neuronal: "Cuánto cambia el puntaje si la variable toma el valor medio de los estudiantes de entrenamiento. Negativo: esa variable le baja el riesgo a este estudiante.",
    }[modo];
    const pares = Object.entries(salida.puntos_por_variable || {}).sort((a, b) => b[1] - a[1]);
    const minimo = Math.min(0, ...pares.map((x) => x[1]));
    const maximo = Math.max(10, ...pares.map((x) => x[1]));
    const cero = (-minimo / (maximo - minimo)) * 100;
    $("#influencia").innerHTML = pares.map(([v, pts]) => {
      const w = (Math.abs(pts) / (maximo - minimo)) * 100;
      const r = Math.round(pts * 10) / 10;
      return `<div class="barra-var"><span class="nombre" title="${esc(nombre(v))}">${esc(nombre(v))}</span>
        <span class="pista-barra"><span class="relleno${pts < 0 ? " negativo" : ""}" style="left:${pts >= 0 ? cero : cero - w}%;width:${w}%"></span>
        <span class="cero" style="left:${cero}%"></span></span>
        <span class="cifra">${r > 0 ? "+" : ""}${num(r, Number.isInteger(r) ? 0 : 1)}</span></div>`;
    }).join("");
  }

  /* ---------------------------------------------------------------- resumen fijo en el celular */
  let flotante;
  function pintarFlotante(texto, nivel) {
    if (!flotante) return;
    flotante.innerHTML = `<span>${nivel ? `<span class="mini-sello ${nivel}">${esc(texto)}</span>` : esc(texto)}</span><a href="#ficha-titulo">Ver la ficha</a>`;
  }
  function prepararFlotante() {
    flotante = document.createElement("div");
    flotante.className = "sello-flotante";
    flotante.setAttribute("aria-hidden", "true");
    document.body.appendChild(flotante);
    if (!("IntersectionObserver" in window)) return;
    let planillaVisible = false, fichaVisible = false;
    const decidir = () => {
      const activo = planillaVisible && !fichaVisible;
      flotante.classList.toggle("activo", activo);
      document.body.classList.toggle("con-flotante", activo);
    };
    new IntersectionObserver(([e]) => { planillaVisible = e.isIntersecting; decidir(); }).observe($("#planilla"));
    new IntersectionObserver(([e]) => { fichaVisible = e.isIntersecting; decidir(); }, { threshold: 0.25 }).observe($(".ficha"));
  }

  /* ---------------------------------------------------------------- página Evaluar */
  async function iniciarEvaluador(R) {
    if (R) TASA_BASE = R.datos.tasa_desercion;
    svgRecorrido = crearRecorrido($("#recorrido"));
    try { ESQUEMA = await json("reportes/esquema.json"); } catch (e) { ESQUEMA = ESQUEMA_RESPALDO; }
    crearCampos();
    prepararFlotante();
    // La planilla empieza vacía para llenarla a mano. Desde la portada se puede abrir un caso: evaluar.html#caso-R01
    const abrirCaso = () => {
      const caso = CASOS.find((c) => location.hash === `#caso-${c.id}`);
      if (caso) { document.getElementById("modo-logistica").checked = true; cargarEnPlanilla(caso.entrada); }
      return Boolean(caso);
    };
    if (!abrirCaso()) actualizar();
    window.addEventListener("hashchange", abrirCaso);
  }

  /* ---------------------------------------------------------------- portada */
  async function iniciarPortada() {
    const lista = $("#casos-portada");
    const enlace = (c) => `<a href="evaluar.html#caso-${c.id}">Abrir en la ficha</a>`;
    try {
      const salidas = await Promise.all(CASOS.map((c) => evaluar(c.entrada, "logistica")));
      lista.innerHTML = CASOS.map((c, i) => {
        const r = salidas[i];
        const marca = r.decision === "resultado" ? `<span class="mini-sello ${r.nivel}">riesgo ${r.nivel}</span>` : `<span class="mini-sello humano">${esc(r.decision)}</span>`;
        const detalle = r.decision === "resultado" ? ` Puntaje ${r.puntaje} de 100, probabilidad ${pct(r.probabilidad)}.` : "";
        return `<li class="caso"><h3>Caso ${c.id}</h3>${marca}<p>${esc(c.texto)}${detalle} ${enlace(c)}</p></li>`;
      }).join("");
    } catch (e) {
      lista.innerHTML = CASOS.map((c) => `<li class="caso"><h3>Caso ${c.id}</h3><p>${esc(c.texto)} ${enlace(c)}</p></li>`).join("")
        + `<li class="caso-cargando">Sin conexión con el sistema: el nivel aparece al abrir la página con el servidor.</li>`;
    }
  }

  window.SAT = Object.assign(window.SAT || {}, { iniciarEvaluador, iniciarPortada, CASOS });
})();
