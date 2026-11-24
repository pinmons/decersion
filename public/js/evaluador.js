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
  /* Respaldo del contrato ampliado (desercion/contrato_ampliado.py): lo usa el modelo de la base real. */
  const AMPLIADO_RESPALDO = {
    nota_media_cuatrimestre: { tipo: "num", rango: [0, 10] }, nota_minima_cuatrimestre: { tipo: "num", rango: [0, 10] },
    asignaturas_no_presentadas: { tipo: "int", rango: [0, 12] }, dias_campus_sep_nov: { tipo: "num", rango: [0, 91] },
    dias_campus_dic_ene: { tipo: "num", rango: [0, 62] }, dias_aula_virtual: { tipo: "num", rango: [0, 153] },
    entregas_por_asignatura: { tipo: "num", rango: [0, 200] }, nota_acceso: { tipo: "num", rango: [0, 14] },
    nota_bachillerato: { tipo: "num", rango: [0, 10] }, opcion_titulacion: { tipo: "int", rango: [1, 30] },
    tipo_ingreso: { tipo: "str" }, titulacion: { tipo: "str" },
  };

  const ETIQUETAS = {
    id_estudiante: "Identificador", nivel_formacion: "Nivel de formación", estado_matricula: "Estado de matrícula",
    semestre: "Semestre", promedio_acumulado: "Promedio acumulado", creditos_inscritos: "Créditos inscritos",
    materias_cursadas_periodo_anterior: "Materias cursadas el periodo anterior", materias_reprobadas: "Materias reprobadas",
    porcentaje_asistencia: "Asistencia", estrato: "Estrato", trabaja: "¿Trabaja?", deuda_matricula: "¿Debe matrícula?",
    titulacion: "Titulación", nota_media_cuatrimestre: "Nota media del cuatrimestre", nota_minima_cuatrimestre: "Nota más baja",
    asignaturas_no_presentadas: "Asignaturas no presentadas", dias_campus_sep_nov: "Días en el campus (sep.–nov.)",
    dias_campus_dic_ene: "Días en el campus (dic.–ene.)", dias_aula_virtual: "Días en el aula virtual",
    entregas_por_asignatura: "Entregas por asignatura", nota_acceso: "Nota de acceso", nota_bachillerato: "Nota de bachillerato",
    opcion_titulacion: "Opción en que eligió la carrera", tipo_ingreso: "Vía de ingreso",
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
    porcentaje_asistencia: "De 0 a 100. Las reglas usan 70 % y 85 %; el modelo real solo la usa en la regla R3.4.",
    estrato: "Lo pide el contrato, pero el modelo real no lo usa: la base no lo trae. Cuenta en modo reglas.",
    deuda_matricula: "El modelo real no la usa (la base no la trae). Cuenta en modo reglas.",
    titulacion: "Su tasa de abandono es lo que más pesa en el modelo real.",
    trabaja: "En la base real se aproxima con la matrícula a tiempo parcial; pesa mucho en el modelo real.",
    nota_media_cuatrimestre: "De 0 a 10 (en la base se aprueba con 5).",
    nota_minima_cuatrimestre: "No puede ser mayor que la media.",
    asignaturas_no_presentadas: "No puede superar las materias cursadas.",
    dias_aula_virtual: "Promedio por asignatura, de septiembre a enero.",
    entregas_por_asignatura: "Tareas y cuestionarios, promedio por asignatura.",
    nota_acceso: "De 0 a 14 (selectividad española).",
    opcion_titulacion: "1 = era su primera opción.",
  };
  const SUFIJO = { porcentaje_asistencia: " %" };
  const PASOS_NUM = { promedio_acumulado: 0.01, porcentaje_asistencia: 0.1, nota_media_cuatrimestre: 0.1, nota_minima_cuatrimestre: 0.1,
    nota_acceso: 0.01, nota_bachillerato: 0.01, entregas_por_asignatura: 0.5 };
  const VIAS = [["NAP", "Acceso ordinario"], ["OTRA", "Otra vía"]];
  const EJEMPLO = {
    id_estudiante: "EJEMPLO-001", nivel_formacion: "pregrado", estado_matricula: "activo", semestre: 3,
    promedio_acumulado: 3.1, creditos_inscritos: 15, materias_cursadas_periodo_anterior: 6, materias_reprobadas: 1,
    porcentaje_asistencia: 76.5, estrato: 2, trabaja: false, deuda_matricula: false,
    titulacion: "T05", nota_media_cuatrimestre: 5.4, nota_minima_cuatrimestre: 3.2, asignaturas_no_presentadas: 1,
    dias_campus_sep_nov: 30, dias_campus_dic_ene: 10, dias_aula_virtual: 25, entregas_por_asignatura: 3,
    nota_acceso: 9.5, nota_bachillerato: 7, opcion_titulacion: 2, tipo_ingreso: "NAP",
  };
  /* Casos típicos R01–R03 del contrato (contexto/dataset.py), datos inventados para la práctica. */
  const BASE = { nivel_formacion: "pregrado", estado_matricula: "activo", materias_cursadas_periodo_anterior: 6, creditos_inscritos: 16, deuda_matricula: false };
  const CASOS = [
    { id: "R01", texto: "Promedio 3,8, asistencia del 92 % y ninguna materia perdida. Nota media 7,8, entra seguido al campus y al aula virtual.",
      entrada: { ...BASE, id_estudiante: "EST-101", semestre: 3, promedio_acumulado: 3.8, materias_reprobadas: 0, porcentaje_asistencia: 92, estrato: 3, trabaja: false,
        titulacion: "T01", nota_media_cuatrimestre: 7.8, nota_minima_cuatrimestre: 6.5, asignaturas_no_presentadas: 0, dias_campus_sep_nov: 50, dias_campus_dic_ene: 25,
        dias_aula_virtual: 60, entregas_por_asignatura: 8, nota_acceso: 12.1, nota_bachillerato: 8.6, opcion_titulacion: 1, tipo_ingreso: "NAP" } },
    { id: "R02", texto: "Promedio 3,2, una materia perdida, nota media 6,0 y actividad cerca de lo usual. Trabaja (en la base real: matrícula a tiempo parcial), y eso es lo que más le sube el riesgo.",
      entrada: { ...BASE, id_estudiante: "EST-102", semestre: 2, promedio_acumulado: 3.2, materias_reprobadas: 1, porcentaje_asistencia: 80, estrato: 2, trabaja: true, creditos_inscritos: 15,
        titulacion: "T03", nota_media_cuatrimestre: 6, nota_minima_cuatrimestre: 4.2, asignaturas_no_presentadas: 0, dias_campus_sep_nov: 35, dias_campus_dic_ene: 12,
        dias_aula_virtual: 30, entregas_por_asignatura: 4, nota_acceso: 10.2, nota_bachillerato: 7.4, opcion_titulacion: 1, tipo_ingreso: "NAP" } },
    { id: "R03", texto: "Promedio 2,7, tres de cinco materias perdidas, dos sin presentar. Casi no va al campus ni al aula virtual, y su titulación tiene mucho abandono.",
      entrada: { ...BASE, id_estudiante: "EST-103", semestre: 4, promedio_acumulado: 2.7, materias_cursadas_periodo_anterior: 5, materias_reprobadas: 3, porcentaje_asistencia: 65, estrato: 1, trabaja: true, deuda_matricula: true, creditos_inscritos: 12,
        titulacion: "T04", nota_media_cuatrimestre: 3.1, nota_minima_cuatrimestre: 1, asignaturas_no_presentadas: 2, dias_campus_sep_nov: 8, dias_campus_dic_ene: 2,
        dias_aula_virtual: 6, entregas_por_asignatura: 0.5, nota_acceso: 6.8, nota_bachillerato: 6.1, opcion_titulacion: 4, tipo_ingreso: "OTRA" } },
  ];
  const SELLOS = {
    alto: ["Riesgo alto", "Remitir a bienestar y tutoría"],
    medio: ["Riesgo medio", "Tutoría académica"],
    bajo: ["Riesgo bajo", "Seguimiento rutinario"],
  };
  const MODOS = { reglas: "reglas del contrato", logistica: "regresión logística", red_neuronal: "red neuronal" };

  let ESQUEMA = ESQUEMA_RESPALDO;
  let CAMPOS = { ...ESQUEMA_RESPALDO.campos };   // contrato + ampliado (este último, opcional)
  let AMPLIADOS = new Set();
  let MEDIANAS = {};
  let TITULACIONES = null;   // {T01: [tasa, n], …} del modelo real
  let TASA_BASE = 0.12;
  const valores = {};
  let temporizador = null;
  let solicitud = 0;
  let svgRecorrido = null;
  let ultimoNivel = null;

  async function evaluar(entrada, modo) {
    const cuerpo = { entrada, ...(modo === "reglas" ? { modo: "reglas" } : { modo: "aprendido", modelo: modo, origen: "real" }) };
    const r = await fetch("api/evaluar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    if (!r.headers.get("content-type")?.includes("json")) throw new Error(`la API respondió ${r.status}`);
    return r.json();
  }

  /* ---------------------------------------------------------------- planilla */
  /* Tres bloques (ley de Hick): lo que más mueve el resultado va primero y abierto; los datos de
     matrícula casi nunca cambian (pregrado, activo) y quedan plegados con su resumen a la vista. */
  /* Los datos del primer cuatrimestre (contrato ampliado) son opcionales: si faltan, el modelo real usa el valor
     usual de la base y lo dice. Lo que más pesa (titulación y notas) va abierto; actividad y admisión, plegadas. */
  const GRUPOS = [
    { id: "rendimiento", titulo: "Rendimiento", campos: ["promedio_acumulado", "porcentaje_asistencia", "materias_cursadas_periodo_anterior", "materias_reprobadas"] },
    { id: "cuatrimestre", titulo: "Primer cuatrimestre", nota: "Lo usa el modelo de la base real; las reglas no.", campos: ["titulacion", "nota_media_cuatrimestre", "nota_minima_cuatrimestre", "asignaturas_no_presentadas"] },
    { id: "actividad", titulo: "Campus y aula virtual", plegado: true, campos: ["dias_campus_sep_nov", "dias_campus_dic_ene", "dias_aula_virtual", "entregas_por_asignatura"] },
    { id: "admision", titulo: "Admisión", plegado: true, campos: ["nota_acceso", "nota_bachillerato", "opcion_titulacion", "tipo_ingreso"] },
    { id: "situacion", titulo: "Carga y situación", campos: ["creditos_inscritos", "estrato", "trabaja", "deuda_matricula"] },
    { id: "matricula", titulo: "Matrícula", plegado: true, campos: ["id_estudiante", "semestre", "nivel_formacion", "estado_matricula"] },
  ];
  function resumirMatricula() {
    for (const g of GRUPOS.filter((x) => x.plegado && x.id !== "matricula")) {
      const r = document.getElementById(`resumen-${g.id}`);
      if (!r) continue;
      const hay = g.campos.filter((k) => valores[k] !== undefined).length;
      r.textContent = hay === g.campos.length ? "completo" : hay ? `${hay} de ${g.campos.length} datos; el resto, lo usual` : "sin datos: se usa lo usual";
    }
    const r = document.getElementById("resumen-matricula");
    if (!r) return;
    const partes = [valores.nivel_formacion, valores.estado_matricula, valores.semestre !== undefined ? `semestre ${valores.semestre}` : null].filter(Boolean);
    const faltan = GRUPOS.find((g) => g.id === "matricula").campos.filter((k) => valores[k] === undefined).length;
    r.textContent = faltan ? `${faltan === 1 ? "falta 1 dato" : `faltan ${faltan} datos`}` : partes.join(" · ").replace(/_/g, " ");
    r.classList.toggle("con-faltantes", faltan > 0);
    if (faltan) r.closest("details").open = true;
  }

  function crearCampos() {
    const cont = $("#campos");
    cont.replaceChildren();
    const rejillas = {};
    for (const g of GRUPOS) {
      const caja = document.createElement(g.plegado ? "details" : "fieldset");
      caja.className = "grupo-campos";
      caja.innerHTML = g.plegado ? `<summary><span class="rotulo">${g.titulo}</span><span class="resumen-grupo" id="resumen-${g.id}"></span></summary><div class="campos-rejilla"></div>`
        : `<legend class="rotulo">${g.titulo}</legend>${g.nota ? `<p class="nota">${esc(g.nota)}</p>` : ""}<div class="campos-rejilla"></div>`;
      cont.appendChild(caja);
      for (const k of g.campos) rejillas[k] = caja.querySelector(".campos-rejilla");
    }
    const orden = GRUPOS.flatMap((g) => g.campos).filter((k) => CAMPOS[k]);
    for (const campo of orden) {
      const def = CAMPOS[campo];
      const div = document.createElement("div");
      div.className = "campo vacio";
      div.dataset.campo = campo;
      const opcional = def.obligatorio ? "" : ' <span class="opcional">(opcional)</span>';
      let control;
      if (campo === "titulacion" && TITULACIONES) {
        const ops = Object.entries(TITULACIONES).map(([t, [tasa, n]]) => `<option value="${esc(t)}">${esc(t)} · abandona el ${num(100 * tasa, 0)} % (${n} estudiantes)</option>`);
        control = `<select id="c-${campo}"><option value="">no se sabe</option>${ops.join("")}</select>`;
      } else if (campo === "tipo_ingreso") {
        control = `<select id="c-${campo}"><option value="">no se sabe</option>${VIAS.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>`;
      } else if (def.tipo === "str") {
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
      const usual = MEDIANAS[campo] !== undefined ? ` Lo usual: ${num(MEDIANAS[campo], Number.isInteger(MEDIANAS[campo]) ? 0 : 1)}; si no se sabe, se usa ese valor.` : "";
      const pista = (PISTAS[campo] || "") + usual;
      div.innerHTML = `<div class="campo-cabeza">${etiqueta}<span class="valor" id="v-${campo}"></span></div>${control}
        ${pista ? `<span class="pista" id="p-${campo}">${pista.trim()}</span>` : ""}`;
      (rejillas[campo] || cont).appendChild(div);
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
    const marcarCaso = (boton) => document.querySelectorAll(".chip-caso").forEach((b) => b.setAttribute("aria-pressed", String(b === boton)));
    document.querySelectorAll(".chip-caso[data-caso]").forEach((b) => b.addEventListener("click", () => {
      const caso = CASOS.find((c) => c.id === b.dataset.caso);
      if (location.hash) history.replaceState(null, "", location.pathname);
      cargarEnPlanilla(caso ? caso.entrada : EJEMPLO);
      marcarCaso(b);
    }));
    $("#btn-limpiar").addEventListener("click", (ev) => {
      for (const k of Object.keys(CAMPOS)) fijar(k, undefined);
      if (location.hash) history.replaceState(null, "", location.pathname);
      marcarCaso(ev.currentTarget);
      actualizar();
      $("#c-promedio_acumulado").focus();
    });
  }

  function cargarEnPlanilla(datos) {
    for (const k of Object.keys(CAMPOS)) fijar(k, datos[k]);
    actualizar();
  }

  function alCambiar(ev) {
    const el = ev.target;
    const div = el.closest(".campo");
    if (!div) return;
    const campo = div.dataset.campo, def = CAMPOS[campo];
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
    const def = CAMPOS[campo];
    if (valor === undefined) delete valores[campo]; else valores[campo] = valor;
    const div = document.querySelector(`.campo[data-campo="${campo}"]`);
    div.classList.toggle("vacio", valor === undefined);
    const etiqueta = $(`#v-${campo}`);
    if (def.tipo === "bool") {
      div.querySelectorAll(".dos-o-tres button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.v === "" ? undefined : b.dataset.v === "true") === valor)));
      etiqueta.textContent = valor === undefined ? (def.obligatorio ? "falta" : "no se sabe") : valor ? "sí" : "no";
    } else if (def.tipo === "str" || def.tipo === "enum") {
      if (origen !== "texto") $(`#c-${campo}`).value = valor ?? "";
      etiqueta.textContent = valor === undefined ? (def.obligatorio ? "falta" : "no se sabe") : "";
    } else {
      if (origen !== "caja") $(`#c-${campo}`).value = valor ?? "";
      const rango = $(`#r-${campo}`);
      if (origen !== "deslizador") rango.value = valor ?? def.rango[0];
      etiqueta.textContent = valor === undefined ? (def.obligatorio ? "falta" : "no se sabe") : String(valor).replace(".", ",") + (SUFIJO[campo] || "");
    }
  }

  const modoActual = () => document.querySelector('input[name="modo"]:checked').value;
  const faltantes = () => Object.entries(CAMPOS).filter(([k, d]) => d.obligatorio && valores[k] === undefined).map(([k]) => k);

  function actualizar() {
    clearTimeout(temporizador);
    resumirMatricula();
    $("#ficha-id").textContent = valores.id_estudiante || "sin identificar";
    $("#ficha-modo").textContent = MODOS[modoActual()];
    const faltan = faltantes();
    if (faltan.length) {
      solicitud++;
      ultimoNivel = null;
      $("#sello").innerHTML = `<p class="sello-vacio">Faltan ${faltan.length} ${faltan.length === 1 ? "dato" : "datos"}</p>`;
      $("#ficha-resumen").textContent = `Para calificar falta: ${faltan.map((k) => ETIQUETAS[k].toLowerCase().replace(/[¿?]/g, "")).join(", ")}.`;
      $("#ficha-detalle").hidden = true;
      reglaViva = null;
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
      reglaViva = null;
      $("#bloque-recorrido").open = true;
      pintarFlotante(humano ? "Revisión humana" : "Dato rechazado", humano ? "humano" : "alto");
      return;
    }
    const [titulo, detalle] = SELLOS[salida.nivel];
    $("#sello").innerHTML = sello(`sello-${salida.nivel}`, titulo, detalle, salida.nivel !== ultimoNivel);
    ultimoNivel = salida.nivel;
    const prob = salida.probabilidad !== undefined ? `; probabilidad estimada ${pct(salida.probabilidad)}` : "";
    const extras = [];
    if (r34) extras.push("La regla R3.4 (promedio menor que 3,0 y asistencia menor que 70 %) fuerza el nivel alto.");
    const noInf = salida.datos_no_informados || [];
    if (noInf.includes("deuda_matricula") && modo === "reglas") extras.push("No se informó la deuda de matrícula: no se inventa y se usa el valor que no baja el riesgo.");
    const ampliadosNoInf = noInf.filter((c) => AMPLIADOS.has(c));
    if (ampliadosNoInf.length) extras.push(`No se informó ${ampliadosNoInf.map((c) => nombre(c)).join(", ")}: se usa el valor usual de la base real y el modelo sabe que falta.`);
    $("#ficha-resumen").innerHTML = `<strong>${salida.en_riesgo ? "Se considera en riesgo de desertar." : "No se considera en riesgo."}</strong>
      Puntaje ${salida.puntaje} de 100${prob}. Acción: ${esc(ACCIONES[salida.accion])}. ${esc(extras.join(" "))}`;
    $("#ficha-detalle").hidden = false;
    pintarRegla(salida);
    pintarSigmoide(salida, modo);
    pintarInfluencia(salida, modo);
    pintarFlotante(titulo, salida.nivel);
  }

  /* Regla de 0 a 100 con los tres tramos del semáforo y la aguja del estudiante.
     Se dibuja una vez por juego de cortes; después solo se desliza la aguja (transform) y se enciende el tramo. */
  let reglaViva = null;
  function pintarRegla(salida) {
    const c = salida.cortes || { corte_medio: 30, corte_alto: 60 };
    const W = 400, Hh = 70, m = 8, clave = `${c.corte_medio}-${c.corte_alto}`;
    const X = escala(0, 100, m, W - m);
    if (!reglaViva || reglaViva.clave !== clave || !reglaViva.svg.isConnected) {
      const svg = lienzo(W, Hh, "");
      const tramos = {};
      for (const [a0, b0, color, et] of [[0, c.corte_medio, "var(--bajo)", "bajo"], [c.corte_medio, c.corte_alto, "var(--medio)", "medio"], [c.corte_alto, 100, "var(--alto)", "alto"]]) {
        tramos[et] = s("rect", { x: X(a0), y: 28, width: Math.max(0, X(b0) - X(a0) - 2), height: 12, rx: 3, fill: color, class: "tramo-regla" });
        svg.appendChild(tramos[et]);
        if (X(b0) - X(a0) > 44) svg.appendChild(s("text", { x: (X(a0) + X(b0)) / 2, y: 56, "text-anchor": "middle", class: "etiqueta-svg", texto: et }));
      }
      for (const v of [0, c.corte_medio, c.corte_alto, 100]) svg.appendChild(s("text", { x: X(v), y: 67, "text-anchor": v === 0 ? "start" : v === 100 ? "end" : "middle", class: "etiqueta-svg", texto: v }));
      const texto = s("text", { y: 12, class: "texto-svg-fuerte" });
      const aguja = s("g", { class: "aguja-regla" }, [s("path", { d: "M-6,18 L6,18 L0,27 z", fill: "var(--tinta)" }),
        s("line", { x1: 0, x2: 0, y1: 26, y2: 44, stroke: "var(--tinta)", "stroke-width": 2.5 }), texto]);
      svg.appendChild(aguja);
      $("#regla-puntaje").replaceChildren(svg);
      reglaViva = { clave, svg, tramos, aguja, texto };
    }
    const x = X(Math.max(0, Math.min(100, salida.puntaje)));
    reglaViva.svg.setAttribute("aria-label", `Puntaje ${salida.puntaje} de 100; medio desde ${c.corte_medio}, alto desde ${c.corte_alto}`);
    for (const [et, r] of Object.entries(reglaViva.tramos)) r.style.opacity = et === salida.nivel ? 0.95 : 0.28;
    reglaViva.aguja.style.transform = `translateX(${x.toFixed(1)}px)`;
    const alFinal = x > W - 90;
    reglaViva.texto.setAttribute("x", alFinal ? -10 : 10);
    reglaViva.texto.setAttribute("text-anchor", alFinal ? "end" : "start");
    reglaViva.texto.textContent = `${salida.puntaje} puntos`;
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
    svg.appendChild(s("text", { x: W - m.der, y: Y(TASA_BASE) + 14, "text-anchor": "end", class: "etiqueta-svg", texto: `de cada 100 estudiantes de la base real desertan ${num(100 * TASA_BASE, 0)}` }));
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
    // Orden fijo (el del modelo): si las barras cambiaran de puesto al mover un control no se podrían seguir con la vista.
    const pares = Object.entries(salida.puntos_por_variable || {});
    const minimo = Math.min(0, ...pares.map((x) => x[1]));
    const maximo = Math.max(10, ...pares.map((x) => x[1]));
    const cero = (-minimo / (maximo - minimo)) * 100;
    const cont = $("#influencia"), clave = pares.map((x) => x[0]).join("|");
    if (cont.dataset.clave !== clave) {
      cont.dataset.clave = clave;
      cont.innerHTML = pares.map(([v]) => `<div class="barra-var" data-var="${esc(v)}"><span class="nombre" title="${esc(nombre(v))}">${esc(nombre(v))}</span>
        <span class="pista-barra"><span class="relleno sube"></span><span class="relleno negativo"></span><span class="cero"></span></span>
        <span class="cifra"></span></div>`).join("");
    }
    const mayor = Math.max(...pares.map((x) => x[1]));
    for (const [v, pts] of pares) {
      const fila = cont.querySelector(`[data-var="${CSS.escape(v)}"]`);
      const sube = fila.querySelector(".sube"), baja = fila.querySelector(".negativo");
      sube.style.left = `${cero}%`; sube.style.width = `${100 - cero}%`;
      baja.style.left = "0"; baja.style.width = `${cero}%`;
      sube.style.transform = `scaleX(${pts > 0 ? pts / maximo : 0})`;
      baja.style.transform = `scaleX(${pts < 0 && minimo < 0 ? pts / minimo : 0})`;
      fila.querySelector(".cero").style.left = `${cero}%`;
      const r = Math.round(pts * 10) / 10;
      fila.querySelector(".cifra").textContent = `${r > 0 ? "+" : ""}${num(r, Number.isInteger(r) ? 0 : 1)}`;
      fila.classList.toggle("la-mayor", pts === mayor && pts >= 1);
    }
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
  async function iniciarEvaluador() {
    svgRecorrido = crearRecorrido($("#recorrido"));
    try { ESQUEMA = await json("reportes/esquema.json"); } catch (e) { ESQUEMA = ESQUEMA_RESPALDO; }
    const ampliado = Object.fromEntries(Object.entries(ESQUEMA.ampliado || AMPLIADO_RESPALDO).map(([k, d]) => [k, { ...d, obligatorio: false }]));
    AMPLIADOS = new Set(Object.keys(ampliado));
    CAMPOS = { ...ESQUEMA.campos, ...ampliado };
    try {
      const [real, modelo] = await Promise.all([json("reportes/real/resultados.json"), json("reportes/real/modelos/logistica.json")]);
      TASA_BASE = real.datos.tasa_desercion;
      TITULACIONES = modelo.ampliado.titulaciones;
      MEDIANAS = modelo.ampliado.medianas;
    } catch (e) { /* sin los pesos publicados: titulación como texto y sin «lo usual» */ }
    crearCampos();
    prepararFlotante();
    // Empieza con un ejemplo ya calificado: el resultado se ve sin llenar nada. También se puede abrir un caso: evaluar.html#caso-R01
    $("#bloque-recorrido").open = !matchMedia("(max-width: 940px)").matches;
    const abrirCaso = () => {
      const caso = CASOS.find((c) => location.hash === `#caso-${c.id}`);
      if (caso) {
        document.getElementById("modo-logistica").checked = true; cargarEnPlanilla(caso.entrada);
        document.querySelectorAll(".chip-caso").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.caso === caso.id)));
      }
      return Boolean(caso);
    };
    if (!abrirCaso()) cargarEnPlanilla(EJEMPLO);
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
