/* Página del prototipo. No recalcula ningún modelo: pregunta siempre a /api/evaluar, así la
   página nunca contradice al paquete Python (Paso 1, R3.4 y garantías incluidas). */
"use strict";

const ETIQUETAS = {
  id_estudiante: "Identificador del estudiante",
  nivel_formacion: "Nivel de formación",
  estado_matricula: "Estado de matrícula",
  semestre: "Semestre",
  promedio_acumulado: "Promedio acumulado (0–5)",
  creditos_inscritos: "Créditos inscritos",
  materias_cursadas_periodo_anterior: "Materias cursadas (periodo anterior)",
  materias_reprobadas: "Materias reprobadas",
  porcentaje_asistencia: "Asistencia (%)",
  estrato: "Estrato",
  trabaja: "¿Trabaja?",
  deuda_matricula: "¿Tiene deuda de matrícula?",
};
const NOMBRES_CORTOS = {
  semestre: "semestre", promedio_acumulado: "promedio", creditos_inscritos: "créditos inscritos",
  materias_cursadas_periodo_anterior: "materias cursadas", materias_reprobadas: "materias reprobadas",
  tasa_reprobacion: "tasa de reprobación", porcentaje_asistencia: "asistencia", estrato: "estrato",
  trabaja: "trabaja", deuda_matricula: "deuda de matrícula",
};
const PASOS_NUM = { promedio_acumulado: 0.01, porcentaje_asistencia: 0.1 };
const ACCIONES = {
  seguimiento_rutinario: "seguimiento rutinario",
  tutoria_academica: "tutoría académica",
  remision_bienestar_y_tutoria: "remisión a bienestar y tutoría",
};
const MOTIVOS = {
  campo_faltante: "falta un dato obligatorio",
  datos_contradictorios: "los datos se contradicen",
  fuera_de_poblacion: "el estudiante no pertenece a la población del sistema (pregrado, activo, semestres 2 a 4)",
  tipo_invalido: "un dato tiene el tipo equivocado",
  fuera_de_rango: "un dato está fuera del rango permitido",
  valor_no_permitido: "un dato no está en la lista de valores permitidos",
  error_interno: "ocurrió un imprevisto interno",
  modelo_no_disponible: "el modelo entrenado no está disponible",
};
const EJEMPLO = {
  id_estudiante: "EJEMPLO-001", nivel_formacion: "pregrado", estado_matricula: "activo", semestre: 3,
  promedio_acumulado: 3.1, creditos_inscritos: 15, materias_cursadas_periodo_anterior: 6, materias_reprobadas: 2,
  porcentaje_asistencia: 76.5, estrato: 2, trabaja: true, deuda_matricula: false,
};

let ESQUEMA = null;
const valores = {};
let temporizador = null;
let solicitud = 0;

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x, d = 1) => `${(100 * x).toFixed(d).replace(".", ",")} %`;
const num = (x, d = 3) => Number(x).toFixed(d).replace(".", ",");
const nombre = (v) => NOMBRES_CORTOS[v] || v;

async function cargarJSON(ruta) {
  const r = await fetch(ruta, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
  return r.json();
}

/* ============================================================ formulario */
function crearCampos() {
  const cont = $("#campos");
  for (const [campo, def] of Object.entries(ESQUEMA.campos)) {
    const div = document.createElement("div");
    div.className = "campo vacio";
    div.dataset.campo = campo;
    const opcional = def.obligatorio ? "" : ' <span class="opcional">(opcional)</span>';
    let control = "";
    if (def.tipo === "str") {
      control = `<input type="text" id="c-${campo}" placeholder="ej. EST-123" maxlength="40">`;
    } else if (def.tipo === "enum") {
      control = `<select id="c-${campo}"><option value="">— sin dato —</option>${def.valores
        .map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}</select>`;
    } else if (def.tipo === "bool") {
      const tercero = def.obligatorio ? "— sin dato —" : "no informado";
      control = `<div class="segmentos" role="group" aria-label="${esc(ETIQUETAS[campo])}">
        <button type="button" data-v="">${tercero}</button>
        <button type="button" data-v="true">sí</button>
        <button type="button" data-v="false">no</button></div>`;
    } else {
      const [min, max] = def.rango;
      const paso = PASOS_NUM[campo] || 1;
      control = `<div class="fila-num">
        <input type="range" id="r-${campo}" min="${min}" max="${max}" step="${paso}" value="${(min + max) / 2}" aria-label="${esc(ETIQUETAS[campo])}">
        <input type="number" id="c-${campo}" min="${min}" max="${max}" step="${paso}" placeholder="—" aria-label="${esc(ETIQUETAS[campo])} (número)">
      </div>`;
    }
    const rango = def.rango ? `${def.rango[0]}–${def.rango[1]}` : "";
    div.innerHTML = `<label for="c-${campo}"><span>${esc(ETIQUETAS[campo])}${opcional}</span>
      <span class="valor" id="v-${campo}">sin dato${rango ? " · " + rango : ""}</span></label>${control}`;
    cont.appendChild(div);
  }
  cont.addEventListener("input", alCambiar);
  cont.addEventListener("change", alCambiar);
  cont.addEventListener("click", (ev) => {
    const b = ev.target.closest(".segmentos button");
    if (!b) return;
    const campo = b.closest(".campo").dataset.campo;
    fijar(campo, b.dataset.v === "" ? undefined : b.dataset.v === "true");
    actualizar();
  });
  document.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener("change", actualizar));
  $("#btn-ejemplo").addEventListener("click", () => { for (const [k, v] of Object.entries(EJEMPLO)) fijar(k, v); actualizar(); });
  $("#btn-limpiar").addEventListener("click", () => { for (const k of Object.keys(ESQUEMA.campos)) fijar(k, undefined); actualizar(); });
}

function alCambiar(ev) {
  const el = ev.target;
  const div = el.closest(".campo");
  if (!div) return;
  const campo = div.dataset.campo;
  const def = ESQUEMA.campos[campo];
  if (def.tipo === "str") fijar(campo, el.value.trim() === "" ? undefined : el.value, false);
  else if (def.tipo === "enum") fijar(campo, el.value === "" ? undefined : el.value, false);
  else if (el.type === "range" || el.type === "number") {
    if (el.value === "") fijar(campo, undefined, false);
    else {
      let v = Number(el.value);
      if (def.tipo === "int") v = Math.round(v);
      fijar(campo, v, el.type === "range" ? "deslizador" : "caja");
    }
  }
  actualizar();
}

/* Actualiza el estado y los controles. `origen` es el control que generó el cambio ("caja",
   "deslizador" o false para texto/selector): ese control no se reescribe para no mover el cursor. */
function fijar(campo, valor, origen = null) {
  const def = ESQUEMA.campos[campo];
  if (valor === undefined) delete valores[campo]; else valores[campo] = valor;
  const div = document.querySelector(`.campo[data-campo="${campo}"]`);
  div.classList.toggle("vacio", valor === undefined);
  const etiqueta = $(`#v-${campo}`);
  if (def.tipo === "bool") {
    div.querySelectorAll(".segmentos button").forEach((b) => {
      const v = b.dataset.v === "" ? undefined : b.dataset.v === "true";
      b.setAttribute("aria-pressed", String(v === valor));
    });
    etiqueta.textContent = valor === undefined ? (def.obligatorio ? "sin dato" : "no informado") : valor ? "sí" : "no";
  } else if (def.tipo === "str" || def.tipo === "enum") {
    if (origen !== false) $(`#c-${campo}`).value = valor ?? "";
    etiqueta.textContent = valor === undefined ? "sin dato" : "";
  } else {
    const rango = $(`#r-${campo}`), caja = $(`#c-${campo}`);
    if (origen !== "caja") caja.value = valor ?? "";
    if (origen !== "deslizador" && valor !== undefined) rango.value = valor;
    etiqueta.textContent = valor === undefined ? `sin dato · ${def.rango[0]}–${def.rango[1]}` : String(valor).replace(".", ",");
  }
}

function modoActual() {
  const v = document.querySelector('input[name="modo"]:checked').value;
  return v === "reglas" ? { modo: "reglas" } : { modo: "aprendido", modelo: v };
}

function faltantes() {
  return Object.entries(ESQUEMA.campos).filter(([k, d]) => d.obligatorio && valores[k] === undefined).map(([k]) => k);
}

function actualizar() {
  clearTimeout(temporizador);
  const faltan = faltantes();
  if (faltan.length) {
    solicitud++;
    mostrarMarca("marca-vacia", `Faltan ${faltan.length} ${faltan.length === 1 ? "dato" : "datos"}`,
      `Falta: ${faltan.map((k) => ETIQUETAS[k].replace(/ \(.*\)/, "").toLowerCase()).join(", ")}.`);
    $("#detalle-resultado").hidden = true;
    return;
  }
  $("#marca").classList.add("marca-cargando");
  temporizador = setTimeout(evaluarAhora, 300);
}

async function evaluarAhora() {
  const id = ++solicitud;
  const cuerpo = { entrada: { ...valores }, ...modoActual() };
  try {
    const r = await fetch("api/evaluar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    const s = await r.json();
    if (id === solicitud) pintar(s, cuerpo.modo === "reglas" ? "reglas" : cuerpo.modelo);
  } catch (e) {
    if (id === solicitud) {
      mostrarMarca("marca-error", "No se pudo consultar el sistema", "La API no respondió. Si abrió el archivo directamente, use el servidor: python servidor_local.py");
      $("#detalle-resultado").hidden = true;
    }
  }
}

let marcaFlotante = false;

function mostrarMarca(clase, titulo, detalle) {
  const m = $("#marca");
  m.className = `marca ${clase}${marcaFlotante ? " flotante" : ""}`;
  m.innerHTML = `<p class="marca-titulo">${titulo}</p><p class="marca-detalle">${detalle}</p>`;
}

function pintar(s, modo) {
  if (s.decision === "abstener") {
    const campos = s.campos ? ` (${s.campos.map((c) => esc(ETIQUETAS[c] || c)).join(", ")})` : "";
    mostrarMarca("marca-abstener", "Remitido a revisión humana",
      `El sistema no decide porque ${esc(MOTIVOS[s.motivo] || s.motivo)}${campos}. Un consejero revisa el caso.`);
    $("#detalle-resultado").hidden = true;
    return;
  }
  if (s.decision !== "resultado") {
    const campo = s.campo ? ` en «${esc(ETIQUETAS[s.campo] || s.campo)}»` : "";
    mostrarMarca("marca-error", `Error: ${esc(MOTIVOS[s.motivo] || s.motivo)}`,
      `Error controlado${campo}. El dato se corrige en el sistema de origen; no se adivina.`);
    $("#detalle-resultado").hidden = true;
    return;
  }
  const nivel = `<span class="nivel nivel-${s.nivel}">${s.nivel}</span>`;
  mostrarMarca(s.en_riesgo ? "marca-riesgo" : "marca-sin-riesgo",
    s.en_riesgo ? "Se considera en riesgo de desertar" : "No se considera en riesgo",
    `Nivel ${nivel} · puntaje <strong>${s.puntaje}</strong>/100 · ${esc(ACCIONES[s.accion] || s.accion)}.`);
  $("#detalle-resultado").hidden = false;

  const cortes = s.cortes || { corte_medio: 30, corte_alto: 60 };
  const p = Math.max(0, Math.min(100, s.puntaje));
  $("#regla-puntaje").innerHTML = `
    <span class="etq" style="left:${p}%">${s.puntaje}</span>
    <div class="pista"><div class="tramo t-bajo" style="width:${cortes.corte_medio}%"></div>
      <div class="tramo t-medio" style="width:${cortes.corte_alto - cortes.corte_medio}%"></div>
      <div class="tramo t-alto" style="width:${100 - cortes.corte_alto}%"></div></div>
    <span class="marca-corte" style="left:${cortes.corte_medio}%"></span>
    <span class="marca-corte" style="left:${cortes.corte_alto}%"></span>
    <div class="aguja" style="left:${p}%"></div>`;
  $("#leyenda-cortes").textContent = `Puntaje ${s.puntaje} de 100 · bajo < ${cortes.corte_medio} · medio ${cortes.corte_medio}–${cortes.corte_alto - 1} · alto ≥ ${cortes.corte_alto}`;

  const filas = [
    ["Modo", modo === "reglas" ? "reglas (puntos fijos del contrato)" : modo === "logistica" ? "aprendido – regresión logística" : "aprendido – red neuronal"],
    ["Acción", ACCIONES[s.accion] || s.accion],
  ];
  if (s.probabilidad !== undefined) filas.push(["Probabilidad estimada", pct(s.probabilidad)]);
  if (s.regla_r34 || (modo === "reglas" && valores.promedio_acumulado < 3 && valores.porcentaje_asistencia < 70))
    filas.push(["Regla R3.4", "promedio < 3.0 y asistencia < 70: el nivel se fuerza a alto"]);
  if (s.datos_no_informados?.length)
    filas.push(["No informado", s.datos_no_informados.map((c) => ETIQUETAS[c] || c).join(", ") + " (no se inventa; se usa el valor que no baja el riesgo)"]);
  $("#datos-resultado").innerHTML = filas.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join("");

  $("#ayuda-influencia").textContent = {
    reglas: "Puntos fijos del contrato (R2.1 a R2.6). La suma es el puntaje.",
    logistica: "Puntos de la tarjeta aprendida: cada variable aporta 0 en su valor de menor riesgo. La suma es el puntaje.",
    red_neuronal: "Cuántos puntos cambia el puntaje si la variable toma el valor medio de entrenamiento. Negativo: esa variable baja el riesgo de este estudiante.",
  }[modo];
  const pares = Object.entries(s.puntos_por_variable || {}).sort((a, b) => b[1] - a[1]);
  const minimo = Math.min(0, ...pares.map((x) => x[1]));
  const maximo = Math.max(10, ...pares.map((x) => x[1]));
  const ancho = maximo - minimo;
  const cero = (-minimo / ancho) * 100;
  $("#influencia").innerHTML = pares.map(([v, pts]) => {
    const w = (Math.abs(pts) / ancho) * 100;
    const izq = pts >= 0 ? cero : cero - w;
    return `<div class="barra-var"><span class="nombre" title="${esc(nombre(v))}">${esc(nombre(v))}</span>
      <span class="pista"><span class="relleno${pts < 0 ? " negativo" : ""}" style="left:${izq}%;width:${w}%"></span>
      <span class="cero" style="left:${cero}%"></span></span>
      <span class="num">${pts > 0 ? "+" : ""}${String(Math.round(pts * 10) / 10).replace(".", ",")}</span></div>`;
  }).join("");
}

/* ============================================================ cómo se hizo */
const tabla = (enc, filas, numericas = []) => `<div class="tabla-envoltura"><table><thead><tr>${enc
  .map((e, i) => `<th${numericas.includes(i) ? ' class="n"' : ""}>${esc(e)}</th>`).join("")}</tr></thead><tbody>${filas
  .map((f) => `<tr>${f.map((c, i) => `<td${numericas.includes(i) ? ' class="n"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const figura = (archivo, pie) => `<figure class="figura"><img src="reportes/${archivo}" alt="${esc(pie)}" loading="lazy"><figcaption>${esc(pie)}</figcaption></figure>`;

function pasoDatos(r) {
  const d = r.datos;
  return `<p>No hay registros reales con la etiqueta de si el estudiante desertó, así que se simularon
    <strong>${d.n_generados.toLocaleString("es")}</strong> estudiantes. Las variables salen de dos factores ocultos
    correlacionados (socioeconómico y académico), así que se relacionan como en la vida real. La etiqueta se generó con una
    función <em>distinta</em> de las reglas del contrato (no lineal, con interacciones y ruido), para que el modelo no se
    copie a sí mismo.</p>
    ${tabla(["Concepto", "Valor"], [
      ["Válidos (pasan el Paso 1)", d.n_validos.toLocaleString("es")],
      ["Descartados por el Paso 1 (no entran al entrenamiento)", d.n_descartados],
      ["Defectuosos que se colaron", d.defectuosos_colados],
      ["Tasa de deserción simulada", pct(d.tasa_desercion)],
      ["Sin deuda informada (opcional, se conservan)", d.sin_deuda_informada.toLocaleString("es")],
      ["División train / validación / test", `${d.division.train} / ${d.division.val} / ${d.division.test}`],
      ["Techo teórico de AUC (probabilidad real)", num(d.auc_techo_test)],
    ], [1])}
    <details><summary>Descartes por motivo</summary>${tabla(["Salida del Paso 1", "Registros"],
      Object.entries(d.descartes_por_motivo).map(([k, v]) => [esc(k), v]), [1])}</details>
    <details><summary>Fórmula con la que se generó la etiqueta [SUPUESTO]</summary><p><code>${esc(d.formula_latente)}</code></p></details>
    ${figura("distribuciones.png", "Distribuciones del dataset por si el estudiante desertó (datos sintéticos)")}`;
}

function pasoVariables(r) {
  const dep = r.dependencia;
  const vifs = Object.keys(dep.antes.vif).map((n) => [esc(nombre(n)), num(dep.antes.vif[n], 2),
    dep.despues.vif[n] !== undefined ? num(dep.despues.vif[n], 2) : "quitada"]);
  return `<p>Antes de entrenar se midió cuánto se parecen las variables entre sí (en train). Si dos variables cargan la
    misma información, el modelo reparte el peso entre ellas de forma inestable. Se calculó la correlación de Pearson y
    de Spearman y el <strong>VIF</strong> (factor de inflación de varianza; &gt; 10 es grave).</p>
    <ul class="lista">${dep.decisiones.map((x) => `<li>Se quitó <strong>${esc(nombre(x.se_quita))}</strong>
      (r = ${num(x.correlacion, 2)} con ${esc(nombre(x.se_queda))}). ${esc(x.motivo)}</li>`).join("")}</ul>
    ${tabla(["Variable", "VIF antes", "VIF después"], vifs, [1, 2])}
    <p>Después se <strong>estandarizó</strong> cada variable (media 0, desviación 1) con la media y la desviación de
    train: sin eso, la asistencia (0–100) dominaría los gradientes frente al promedio (0–5).</p>
    ${figura("correlacion_antes.png", "Correlación entre las variables candidatas")}
    ${figura("vif.png", "VIF antes y después de tratar la colinealidad")}`;
}

function pasoModelos(r) {
  const e = r.entrenamiento, t = e.tarjeta, nombres = r.dependencia.finales;
  const cortes = (c) => `medio ≥ ${c.corte_medio}, alto ≥ ${c.corte_alto} (alto captura ${pct(c.en_validacion.recall_alto)} de los desertores con ${pct(c.en_validacion.fraccion_alto)} de los estudiantes)`;
  return `<ul class="lista">
      <li><strong>Línea base por reglas</strong>: los puntos fijos del contrato (promedio &lt; 3.0 → +30, …) y cortes 30/60.</li>
      <li><strong>Regresión logística</strong> (la red más simple: una neurona sigmoide): descenso de gradiente por mini-lotes
        de ${e.config_logistica.tam_lote}, pesos por clase, L2 y early stopping. Corrió ${e.info_logistica.epocas_corridas}
        épocas y se quedó con la <strong>${e.info_logistica.mejor_epoca}</strong>.</li>
      <li><strong>Red neuronal</strong> ${nombres.length} → ${e.config_red.capas.join(" → ")} → 1: forward, backpropagation y Adam
        programados a mano, dropout ${pct(e.config_red.dropout, 0)}, inicialización He y early stopping
        (${e.info_red.epocas_corridas} épocas, mejor la ${e.info_red.mejor_epoca}). Es monótona por construcción en promedio,
        tasa de reprobación y asistencia.</li>
    </ul>
    ${figura("curvas_perdida.png", "Pérdida de entrenamiento y validación por época")}
    ${figura("evolucion_pesos.png", "Cómo se fueron repartiendo los pesos durante el primer entrenamiento, antes de aplicar el tope de dominancia (paso 5). La tabla de abajo tiene los pesos finales, después del tope.")}
    <h4>De pesos a puntos: la tarjeta de puntaje</h4>
    <p>Cada peso se pasa a unidades originales y se escala para que cada variable dé 0 puntos en su valor de menor riesgo y
    la suma vaya de 0 a 100. El puntaje ordena igual que la probabilidad del modelo.</p>
    ${tabla(["Variable", "Peso final (estandarizado)", "Puntos máximos", "0 puntos cuando vale"],
      nombres.map((n, j) => [esc(nombre(n)), num(e.pesos_finales[j]), num(t.puntos_maximos[j], 1), esc(t.valor_menor_riesgo[j])]), [1, 2, 3])}
    <p>Cortes elegidos en <strong>validación</strong>: logística ${cortes(e.cortes)}; red neuronal ${cortes(e.cortes_red)}.</p>
    <p class="destacado"><strong>Hallazgo:</strong> el objetivo «el nivel alto captura ≥ 70 % de los desertores marcando
    ≤ 25 % de los estudiantes» no se puede cumplir con un AUC cercano a 0,82. Se priorizó el recall; el equipo decide si
    acepta marcar a cerca de 1 de cada 3 estudiantes o baja la meta.</p>`;
}

function pasoPesos(r) {
  const c = r.control, nombres = c.importancia_test.variables;
  const filas = nombres.map((n, j) => [esc(nombre(n)), pct(c.importancia_test.logistica_pct[j]), pct(c.importancia_test.red_pct[j]),
    `${num(c.ablacion[j].delta_auc, 4)}`, `${num(c.estabilidad.pesos_media[j])} ± ${num(c.estabilidad.pesos_desv[j])}`])
    .sort((a, b) => parseFloat(b[1].replace(",", ".")) - parseFloat(a[1].replace(",", ".")));
  const ultimo = c.pasos_tope.length ? c.pasos_tope[c.pasos_tope.length - 1] : null;
  const tope = ultimo ? `<p class="destacado"><strong>Tope de dominancia (${pct(c.tope, 0)}):</strong> la tasa de reprobación
    se llevaba ${pct(Math.max(...c.antes_tope.pct_train))} de la importancia (medida en train). Se subió su L2 ×${ultimo.multiplicador_l2} y bajó a
    ${pct(Math.max(...c.despues_tope.pct_train))}. Costo en test: AUC ${num(c.antes_tope.auc_test, 4)} → ${num(c.despues_tope.auc_test, 4)}.</p>`
    : "<p>Ninguna variable superó el tope.</p>";
  const e = c.estrato;
  const estrato = e ? `<h4>Variable sensible: estrato</h4>
    ${tabla(["Estrato", "n", "Deserción real", "% en alto (con estrato)", "% en alto (sin estrato)", "Recall (con)", "Recall (sin)"],
      e.con_estrato.map((a, i) => [a.estrato, a.n, pct(a.tasa_real), pct(a.fraccion_alto), pct(e.sin_estrato[i].fraccion_alto),
        pct(a.recall_alto), pct(e.sin_estrato[i].recall_alto)]), [1, 2, 3, 4, 5, 6])}
    <p>Global: con estrato AUC ${num(e.global_con.auc, 4)}; sin estrato ${num(e.global_sin.auc, 4)}. La decisión de dejarlo o
    quitarlo queda para el equipo.</p>` : "";
  return `<p><strong>Importancia por permutación</strong>: se desordena una variable a la vez en test y se mide cuánto cae
    el AUC. <strong>Ablación</strong>: se reentrena sin la variable. <strong>Estabilidad</strong>: 5 muestras bootstrap.</p>
    ${tabla(["Variable", "Importancia logística", "Importancia red", "Δ AUC sin la variable", "Peso (media ± desv.)"], filas, [1, 2, 3, 4])}
    ${tope}
    <p>Ninguna variable hace colapsar al modelo al quitarla (la mayor caída de AUC es
    ${num(Math.min(...c.ablacion.map((a) => a.delta_auc)), 4)}).</p>
    ${figura("importancia_permutacion.png", "Importancia por permutación con la línea del tope del 35 %")}
    ${estrato}`;
}

function pasoResultados(r, rondas) {
  const ev = r.evaluacion, m = ev.modelos, nombres = Object.keys(m);
  const fila = (et, k, f) => [esc(et), ...nombres.map((n) => f(m[n][k]))];
  const metricas = tabla(["Métrica (test)", ...nombres], [
    fila("Log-loss (↓)", "log_loss", (x) => num(x, 4)), fila("Brier (↓)", "brier", (x) => num(x, 4)),
    fila("AUC-ROC (↑)", "auc", (x) => num(x, 4)), fila("Recall de desertores (alto)", "recall", (x) => pct(x)),
    fila("Precisión (alto)", "precision", (x) => pct(x)), fila("Accuracy (alto)", "accuracy", (x) => pct(x)),
    fila("% de estudiantes en alto", "fraccion_alto", (x) => pct(x)),
  ], [1, 2, 3]);
  const resumen = [];
  if (rondas.r12) {
    resumen.push(["Ronda 1 – v1 (solo camino feliz)", `${rondas.r12.ronda1.pasan}/20`]);
    resumen.push(["Ronda 2 – v2", `${rondas.r12.ronda2.pasan}/20`]);
  }
  if (rondas.r3) {
    resumen.push(["Ronda 3a – v2 con 15 casos nuevos", `${rondas.r3.ronda3a_v2.pasan}/35`]);
    resumen.push(["Ronda 3b – v3", `${rondas.r3.ronda3b_v3.pasan}/35`]);
    if (rondas.r3.ronda3c_sistema_reglas) resumen.push(["Ronda 3c – sistema migrado, modo reglas", `${rondas.r3.ronda3c_sistema_reglas.pasan}/35`]);
  }
  for (const v of rondas.r4?.version_1 || []) resumen.push([esc(v.nombre), `${v.pasan}/${v.total}${v.fallan.length ? " (fallan " + esc(v.fallan.join(", ")) + ")" : ""}`]);
  for (const v of rondas.r4?.versiones || []) resumen.push([esc(v.nombre) + " (versión final)", `${v.pasan}/${v.total}`]);
  return `${metricas}
    <p>Techo teórico: AUC ${num(ev.auc_techo, 4)}. <strong>Conclusión:</strong> ${esc(ev.conclusion)}</p>
    ${figura("calibracion.png", "Curva de calibración en test")}
    <h4>Pruebas de estrés (ejecución guardada)</h4>
    ${tabla(["Ronda", "Pasan"], resumen.map(([a, b]) => [a, b]), [1])}
    ${rondas.r4 ? `<p>${esc(rondas.r4.lectura)}</p>` : ""}`;
}

async function cargarProceso() {
  let r;
  try { r = await cargarJSON("reportes/resultados.json"); } catch (e) {
    document.querySelectorAll(".paso .cuerpo").forEach((c) => { c.textContent = "No se encontraron los resultados del entrenamiento."; });
    return;
  }
  const rondas = {};
  await Promise.all([["r12", "reportes/resultados_rondas.json"], ["r3", "reportes/resultados_ronda3.json"], ["r4", "reportes/resultados_ronda4.json"]]
    .map(async ([k, ruta]) => { try { rondas[k] = await cargarJSON(ruta); } catch (e) { /* opcional */ } }));
  $("#paso-datos .cuerpo").innerHTML = pasoDatos(r);
  $("#paso-variables .cuerpo").innerHTML = pasoVariables(r);
  $("#paso-modelos .cuerpo").innerHTML = pasoModelos(r);
  $("#paso-pesos .cuerpo").innerHTML = pasoPesos(r);
  $("#paso-resultados .cuerpo").innerHTML = pasoResultados(r, rondas);

  const log = r.evaluacion.modelos["regresión logística"];
  const r4 = rondas.r4?.versiones?.[1];
  $("#cifras-portada").innerHTML = [
    ["Estudiantes simulados", r.datos.n_validos.toLocaleString("es")],
    ["Tasa de deserción simulada", pct(r.datos.tasa_desercion)],
    ["AUC de la logística en test", num(log.auc, 3)],
    ["Recall de desertores (nivel alto)", pct(log.recall)],
    ...(r4 ? [["Ronda 4, modo aprendido", `${r4.pasan}/${r4.total}`]] : []),
  ].map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join("");
}

async function correrRondas() {
  const btn = $("#btn-rondas"), estado = $("#estado-rondas");
  btn.disabled = true;
  estado.textContent = "Corriendo las pruebas en el servidor…";
  try {
    const t0 = performance.now();
    const d = await cargarJSON("api/rondas");
    if (d.error) throw new Error(d.detalle || d.error);
    estado.textContent = `Listo en ${((performance.now() - t0) / 1000).toFixed(1).replace(".", ",")} s.`;
    const grupos = [{ nombre: d.ronda3.nombre, pasan: d.ronda3.pasan, total: d.ronda3.total,
      filas: d.ronda3.filas.map((f) => ({ id: f.id, grupo: f.origen, esperado: f.esperado, obtenido: f.obtenido, resultado: f.resultado })) },
      ...d.ronda4];
    $("#tabla-rondas").innerHTML = grupos.map((g) => `<details${g.pasan < g.total ? " open" : ""}>
      <summary>${esc(g.nombre)}: <span class="${g.pasan === g.total ? "pasa" : "falla"}">${g.pasan}/${g.total} pasan</span></summary>
      ${tabla(["Caso", "Grupo", "Esperado", "Obtenido", ""], g.filas.map((f) => [esc(f.id), esc(f.grupo), esc(f.esperado), esc(f.obtenido),
        `<span class="${f.resultado === "PASA" ? "pasa" : "falla"}">${f.resultado}</span>`]))}</details>`).join("");
  } catch (e) {
    estado.textContent = `No se pudieron correr las pruebas: ${e.message}`;
  } finally {
    btn.disabled = false;
  }
}

async function iniciar() {
  try {
    ESQUEMA = await cargarJSON("reportes/esquema.json");
    crearCampos();
    // ?ejemplo=1 abre la página con el ejemplo cargado (útil para compartir un enlace)
    if (new URLSearchParams(location.search).has("ejemplo")) $("#btn-ejemplo").click();
  } catch (e) {
    $("#campos").textContent = "No se pudo cargar el esquema del contrato.";
  }
  $("#btn-rondas").addEventListener("click", correrRondas);
  // En el celular la marca flota abajo solo mientras el formulario está en pantalla
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => {
      marcaFlotante = e.isIntersecting;
      $("#marca").classList.toggle("flotante", marcaFlotante);
      document.body.classList.toggle("con-marca-flotante", marcaFlotante);
    }).observe($("#formulario"));
  }
  cargarProceso();
}

iniciar();
