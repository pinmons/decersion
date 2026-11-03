/* Planilla + ficha de seguimiento. No recalcula ningún modelo: siempre pregunta a /api/evaluar,
   así la página nunca contradice al paquete Python (Paso 1, R3.4 y garantías incluidas). */
import { $, esc, pct, num, json, nombre, ACCIONES, MOTIVOS, s, lienzo, escala } from "./util.js";
import { crearRecorrido, marcarRecorrido } from "./recorrido.js";

const ETIQUETAS = {
  id_estudiante: "Identificador", nivel_formacion: "Nivel de formación", estado_matricula: "Estado de matrícula",
  semestre: "Semestre", promedio_acumulado: "Promedio acumulado", creditos_inscritos: "Créditos inscritos",
  materias_cursadas_periodo_anterior: "Materias cursadas el periodo anterior", materias_reprobadas: "Materias reprobadas",
  porcentaje_asistencia: "Asistencia", estrato: "Estrato", trabaja: "¿Trabaja?", deuda_matricula: "¿Debe matrícula?",
};
const PISTAS = {
  semestre: "El sistema solo califica los semestres 2 a 4.",
  promedio_acumulado: "Escala de 0,0 a 5,0; se aprueba con 3,0.",
  creditos_inscritos: "Activo con 0 créditos es una contradicción.",
  materias_reprobadas: "No puede superar las cursadas.",
  porcentaje_asistencia: "Las reglas usan 70 % y 85 % como umbrales.",
  estrato: "Estrato socioeconómico de la vivienda (1 es el más bajo).",
  deuda_matricula: "Si no se sabe, el sistema no lo inventa.",
};
const SUFIJO = { porcentaje_asistencia: " %" };
const PASOS_NUM = { promedio_acumulado: 0.01, porcentaje_asistencia: 0.1 };
export const EJEMPLO = {
  id_estudiante: "EJEMPLO-001", nivel_formacion: "pregrado", estado_matricula: "activo", semestre: 3,
  promedio_acumulado: 3.1, creditos_inscritos: 15, materias_cursadas_periodo_anterior: 6, materias_reprobadas: 2,
  porcentaje_asistencia: 76.5, estrato: 2, trabaja: true, deuda_matricula: false,
};
/* Casos típicos R01–R03 del contrato (contexto/dataset.py), datos inventados para la práctica. */
const BASE = { nivel_formacion: "pregrado", estado_matricula: "activo", materias_cursadas_periodo_anterior: 6, creditos_inscritos: 16, deuda_matricula: false };
export const CASOS = [
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

let ESQUEMA = null;
let TASA_BASE = 0.183;
const valores = {};
let temporizador = null;
let solicitud = 0;
let svgRecorrido = null;
let ultimoNivel = null;

export async function evaluar(entrada, modo) {
  const cuerpo = { entrada, ...(modo === "reglas" ? { modo: "reglas" } : { modo: "aprendido", modelo: modo }) };
  const r = await fetch("api/evaluar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  return r.json();
}

/* ------------------------------------------------------------------ planilla */
function crearCampos() {
  const cont = $("#campos");
  for (const [campo, def] of Object.entries(ESQUEMA.campos)) {
    const div = document.createElement("div");
    div.className = "campo vacio";
    div.dataset.campo = campo;
    const opcional = def.obligatorio ? "" : ' <span class="opcional">(opcional)</span>';
    let control;
    if (def.tipo === "str") {
      control = `<input type="text" id="c-${campo}" placeholder="por ejemplo EST-123" maxlength="40">`;
    } else if (def.tipo === "enum") {
      control = `<select id="c-${campo}"><option value="">sin dato</option>${def.valores.map((v) => `<option value="${esc(v)}">${esc(v.replace("_", " "))}</option>`).join("")}</select>`;
    } else if (def.tipo === "bool") {
      control = `<div class="dos-o-tres" role="group" aria-labelledby="l-${campo}">
        <button type="button" data-v="">${def.obligatorio ? "sin dato" : "no se sabe"}</button>
        <button type="button" data-v="true">sí</button><button type="button" data-v="false">no</button></div>`;
    } else {
      const [min, max] = def.rango;
      const paso = PASOS_NUM[campo] || 1;
      control = `<div class="fila-num">
        <input type="range" id="r-${campo}" min="${min}" max="${max}" step="${paso}" value="${(min + max) / 2}" aria-label="${esc(ETIQUETAS[campo])}, deslizador">
        <input type="number" id="c-${campo}" min="${min}" max="${max}" step="${paso}" placeholder="—" aria-label="${esc(ETIQUETAS[campo])}">
      </div>`;
    }
    const etiqueta = def.tipo === "bool" ? `<span class="etiqueta" id="l-${campo}">${esc(ETIQUETAS[campo])}${opcional}</span>`
      : `<label for="c-${campo}" id="l-${campo}">${esc(ETIQUETAS[campo])}${opcional}</label>`;
    div.innerHTML = `<div class="campo-cabeza">${etiqueta}<span class="valor" id="v-${campo}">sin dato</span></div>${control}
      ${PISTAS[campo] ? `<span class="pista">${PISTAS[campo]}</span>` : ""}`;
    cont.appendChild(div);
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
  $("#btn-ejemplo").addEventListener("click", () => cargarEnPlanilla(EJEMPLO, false));
  $("#btn-limpiar").addEventListener("click", () => { for (const k of Object.keys(ESQUEMA.campos)) fijar(k, undefined); actualizar(); });
}

export function cargarEnPlanilla(datos, desplazar = true) {
  for (const k of Object.keys(ESQUEMA.campos)) fijar(k, datos[k]);
  actualizar();
  if (desplazar) document.getElementById("ficha").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function alCambiar(ev) {
  const el = ev.target;
  const div = el.closest(".campo");
  if (!div) return;
  const campo = div.dataset.campo, def = ESQUEMA.campos[campo];
  if (def.tipo === "str" || def.tipo === "enum") fijar(campo, el.value.trim() === "" ? undefined : el.value, "texto");
  else if (el.type === "range" || el.type === "number") {
    if (el.value === "") fijar(campo, undefined, "caja");
    else fijar(campo, def.tipo === "int" ? Math.round(Number(el.value)) : Number(el.value), el.type === "range" ? "deslizador" : "caja");
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
    etiqueta.textContent = valor === undefined ? (def.obligatorio ? "sin dato" : "no se sabe") : valor ? "sí" : "no";
  } else if (def.tipo === "str" || def.tipo === "enum") {
    if (origen !== "texto") $(`#c-${campo}`).value = valor ?? "";
    etiqueta.textContent = valor === undefined ? "sin dato" : "";
  } else {
    if (origen !== "caja") $(`#c-${campo}`).value = valor ?? "";
    if (origen !== "deslizador" && valor !== undefined) $(`#r-${campo}`).value = valor;
    etiqueta.textContent = valor === undefined ? `sin dato (${def.rango[0]} a ${def.rango[1]})` : String(valor).replace(".", ",") + (SUFIJO[campo] || "");
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
    $("#ficha-resumen").textContent = `Para calificar faltan: ${faltan.map((k) => ETIQUETAS[k].toLowerCase()).join(", ")}.`;
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
    $("#sello").innerHTML = `<p class="sello-vacio">Sin conexión</p>`;
    $("#ficha-resumen").textContent = "La API no respondió. En local, abra la página con python servidor_local.py.";
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
    const campos = salida.campos ? ` (${salida.campos.map((c) => ETIQUETAS[c] || c).join(", ")})` : salida.campo ? ` en ${ETIQUETAS[salida.campo] || salida.campo}` : "";
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
  svg.appendChild(s("text", { x: Math.min(W - 30, Math.max(30, x)) + (x > W - 60 ? -10 : 10), y: 12, "text-anchor": x > W - 60 ? "end" : "start", class: "texto-svg-fuerte", texto: `${salida.puntaje} puntos` }));
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
  svg.appendChild(s("text", { x: X(z) + (z > 1.5 ? -10 : 10), y: Y(p) - 8, "text-anchor": z > 1.5 ? "end" : "start", class: "texto-svg-fuerte", texto: pct(p) }));
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
    return `<div class="barra-var"><span class="nombre" title="${esc(nombre(v))}">${esc(nombre(v))}</span>
      <span class="pista-barra"><span class="relleno${pts < 0 ? " negativo" : ""}" style="left:${pts >= 0 ? cero : cero - w}%;width:${w}%"></span>
      <span class="cero" style="left:${cero}%"></span></span>
      <span class="cifra">${pts > 0 ? "+" : ""}${num(Math.round(pts * 10) / 10, Math.abs(pts) < 10 && pts % 1 ? 1 : 0)}</span></div>`;
  }).join("");
}

/* ------------------------------------------------------------------ resumen fijo en el celular */
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
  pintarFlotante("Faltan 12 datos", "");
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

/* ------------------------------------------------------------------ casos de la portada */
async function pintarCasos() {
  const lista = $("#casos-portada");
  try {
    const salidas = await Promise.all(CASOS.map((c) => evaluar(c.entrada, "logistica")));
    lista.innerHTML = CASOS.map((c, i) => {
      const r = salidas[i];
      const sello_ = r.decision === "resultado" ? `<span class="mini-sello ${r.nivel}">riesgo ${r.nivel}</span>` : `<span class="mini-sello humano">${esc(r.decision)}</span>`;
      const detalle = r.decision === "resultado" ? ` Puntaje ${r.puntaje} de 100, probabilidad ${pct(r.probabilidad)}.` : "";
      return `<li class="caso"><h3>Caso ${c.id}</h3>${sello_}<p>${esc(c.texto)}${detalle} <a href="#ficha" data-caso="${i}">Abrir en la ficha</a></p></li>`;
    }).join("");
    lista.addEventListener("click", (e) => {
      const a = e.target.closest("[data-caso]");
      if (!a) return;
      e.preventDefault();
      document.getElementById("modo-logistica").checked = true;
      cargarEnPlanilla(CASOS[+a.dataset.caso].entrada);
    });
  } catch (e) {
    lista.innerHTML = `<li class="caso-cargando">No se pudo consultar la API. En local, use <code>python servidor_local.py</code>.</li>`;
  }
}

export async function iniciarEvaluador(resultados) {
  if (resultados) TASA_BASE = resultados.datos.tasa_desercion;
  svgRecorrido = crearRecorrido($("#recorrido"));
  prepararFlotante();
  try {
    ESQUEMA = await json("reportes/esquema.json");
  } catch (e) {
    $("#campos").textContent = "No se pudo cargar el esquema del contrato (reportes/esquema.json).";
    return;
  }
  crearCampos();
  pintarCasos();
  // La ficha abre con un ejemplo cargado, para que se vea qué hace el sistema sin escribir nada.
  cargarEnPlanilla(EJEMPLO, false);
}
