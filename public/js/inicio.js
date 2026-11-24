/* Script clásico (sin módulos). Vista Inicio: el tablero.
   Lee la última corrida de la base real (/api/estudiantes; si falla, la copia guardada) y las notas del modelo
   (reportes/real/resultados.json), y llena las celdas. La página no recalcula el modelo: solo cuenta y dibuja. */
(function () {
  "use strict";
  const { $, esc, pct, num, miles, json, conGlobo, aparecer, reducido } = window.SAT;
  const NIVELES = [["alto", "Alto"], ["medio", "Medio"], ["bajo", "Bajo"]];

  /* Una cifra que cuenta hasta su valor (280 ms). Con movimiento reducido aparece ya puesta. */
  function contar(el, hasta, formato = miles) {
    if (reducido() || !window.requestAnimationFrame) { el.textContent = formato(hasta); return; }
    const t0 = performance.now(), dur = 280;
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / dur), suave = 1 - Math.pow(1 - k, 3);
      el.textContent = formato(Math.round(hasta * suave));
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  /* Umbrales de uso común [SUPUESTO], los mismos de la página Modelo. */
  const MARCAS = { excelente: ["★", "Excelente"], bueno: ["✓", "Bueno"], aceptable: ["◐", "Aceptable"], debil: ["▲", "Débil"] };
  const nota = (v, [a, b, c]) => (v >= a ? "excelente" : v >= b ? "bueno" : v >= c ? "aceptable" : "debil");
  const marca = (n) => `<span class="t-marca t-marca-${n}"><i aria-hidden="true">${MARCAS[n][0]}</i>${MARCAS[n][1]}</span>`;

  function pintarOperacion(d, deCopia) {
    const ej = d.ejecucion, prov = d.niveles_provisional || {};
    const n = (k) => d.niveles[k].n + ((prov[k] || {}).n || 0);
    const calificados = NIVELES.reduce((a, [k]) => a + n(k), 0);
    const provAlto = (prov.alto || {}).n || 0;

    // protagonista
    contar($("#t-alto"), n("alto"));
    $("#t-alto-sub").innerHTML = `de ${miles(calificados)} estudiantes calificados${provAlto ? `<br>${miles(provAlto)} con resultado provisional` : ""}`;

    // reparto por nivel: una barra de 100 % con una parte por nivel
    const partes = [...NIVELES.map(([k, t]) => [k, t, n(k)]), ["devuelto", "Devueltos al registro", ej.con_error]].filter((p) => p[2] > 0);
    const barra = $("#t-niveles");
    barra.replaceChildren(...partes.map(([k, t, v]) => {
      const i = document.createElement("i");
      i.className = `seg-${k}`;
      i.style.flex = `${v} 1 0`;
      return conGlobo(i, `<b>${esc(t)}</b><br>${miles(v)} estudiantes (${pct(v / ej.leidos, 0)} de los leídos)`);
    }));
    barra.setAttribute("aria-label", "De " + miles(ej.leidos) + " registros leídos: " + partes.map(([, t, v]) => `${miles(v)} ${t.toLowerCase()}`).join(", ") + ".");
    aparecer(barra.children, { pausa: 70, duracion: 300, desde: "translateY(6px)" });
    $("#t-leyenda").innerHTML = partes.map(([k, t, v]) => `<li><i class="seg-${k}"></i>${esc(t)}<b class="num">${miles(v)}</b></li>`).join("");

    // el pulso: la base se acaba de leer
    const pulso = $("#t-pulso"), fecha = new Date(ej.fecha);
    const hora = fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
    pulso.querySelector("span").textContent = deCopia
      ? `Copia de la última corrida guardada · ${miles(ej.leidos)} registros`
      : `Base leída a las ${hora} · ${miles(ej.leidos)} registros en ${num(ej.ms_lectura + ej.ms_modelo, 0)} ms`;
    pulso.classList.add(deCopia ? "copia" : "vivo");

    // riesgo por titulación (cifrada en la fuente: T01, T02…): en cada una, qué parte quedó en alto, medio y bajo
    const prog = new Map();
    for (const e of d.estudiantes) {
      if (!e.nivel) continue;
      const p = prog.get(e.titulacion) || { alto: 0, medio: 0, bajo: 0, n: 0 };
      p[e.nivel] += 1; p.n += 1; prog.set(e.titulacion, p);
    }
    const orden = $("#orden-programas");
    function ordenarTitulaciones() {
      const volumen = orden.value === "volumen";
      const criterio = p => volumen ? p.alto : p.alto / p.n;
      const filas = [...prog].filter(([, p]) => p.n >= 15).sort((a, b) => criterio(b[1]) - criterio(a[1])).slice(0, 5);
      const caja = $("#t-programas");
      caja.replaceChildren(...filas.map(([nombre, p]) => {
        const f = document.createElement("div");
        f.className = "t-fila";
        f.innerHTML = `<span class="t-fila-nombre">${esc(nombre)}</span>
          <span class="t-fila-barra" aria-hidden="true">${NIVELES.map(([k]) => (p[k] ? `<i class="seg-${k}" style="flex:${p[k]} 1 0"></i>` : "")).join("")}</span>
          <b class="num">${volumen ? miles(p.alto) : pct(p.alto / p.n, 0)}</b>`;
        const ficha = (d.fichas_titulacion || {})[nombre.replace("Titulación ", "")];
        const historia = ficha && ficha.tasa != null
          ? `<br>En años anteriores: ${miles(ficha.n_historico)} estudiantes; abandonó el ${pct(ficha.tasa, 0)} en primer año`
            + (d.tasa_global != null ? ` (en toda la universidad, el ${pct(d.tasa_global, 0)})` : "")
            + (ficha.nota_acceso_media != null ? `<br>Nota de acceso media: ${num(ficha.nota_acceso_media, 1)} sobre 14` : "")
          : "";
        return conGlobo(f, `<b>${esc(nombre)}</b> · código anónimo de una carrera de la UPV<br>${miles(p.n)} estudiantes calificados ahora: `
          + `${NIVELES.map(([k, t]) => `${t.toLowerCase()} ${miles(p[k])}`).join(", ")}${historia}`);
      }));
      aparecer(caja.children, { pausa: 60, duracion: 300, desde: "translateX(-8px)" });
    }
    orden.onchange = ordenarTitulaciones;
    ordenarTitulaciones();

    // lo que se resolvió sin una persona
    const CAUSA = { promedio_acumulado: "sin ninguna nota del primer cuatrimestre", porcentaje_asistencia: "sin ningún dato de presencia",
      datos_contradictorios: "con presencia de 1 % o menos (el contrato duda de la escala)" };
    const avisos = (d.avisos || []).map((a) => (a.tipo === "dato_faltante"
      ? `<li><b class="num">${miles(a.n)}</b><span>${esc(CAUSA[a.causa] || "con un dato que el contrato no acepta")}: reciben un resultado provisional.</span></li>`
      : `<li><b class="num">${miles(a.n)}</b><span>con un dato fuera de rango: devueltos al registro para corregir.</span></li>`));
    avisos.push(`<li><b class="num">${miles(ej.a_revision || 0)}</b><span>casos esperando revisión manual.</span></li>`);
    $("#t-avisos").innerHTML = avisos.join("");
    aparecer($("#t-avisos").children, { pausa: 60, duracion: 300 });
  }

  function pintarNotas(R) {
    const m = R.evaluacion.modelos["regresión logística"];
    $("#t-notas").innerHTML = [["F1", num(m.f1, 2), nota(m.f1, [0.8, 0.65, 0.5]), "equilibrio entre avisar y acertar"],
      ["AUC", num(m.auc, 3), nota(m.auc, [0.9, 0.8, 0.7]), "qué tan bien ordena"]]
      .map(([t, v, n, que]) => `<div class="t-nota-fila"><span class="t-nota-nombre"><strong>${t}</strong><small>${que}</small></span>
        <b class="num">${v}</b>${marca(n)}</div>`).join("")
      + `<p>Regresión logística, con ${miles(R.evaluacion.n_test)} estudiantes reales que no había visto.${R.evaluacion.sin_evidentes
        ? ` Sin los que no aprobaron nada: AUC ${num(R.evaluacion.sin_evidentes.modelos["regresión logística"].auc, 3)}.` : ""}</p>`;
    aparecer($("#t-notas").children, { pausa: 70, duracion: 300 });
  }

  async function iniciarInicio() {
    json("reportes/real/resultados.json").then(pintarNotas)
      .catch(() => { $("#t-notas").innerHTML = "<p>No se encontraron las notas del modelo.</p>"; });
    let d, deCopia = false;
    try {
      d = await json("api/estudiantes?modelo=logistica");
      if (d.error) throw new Error(d.error);
    } catch (e1) {
      try { d = await json("reportes/real/estudiantes.json"); deCopia = true; } catch (e2) { d = null; }
    }
    if (!d) {
      $("#t-pulso").querySelector("span").textContent = "No se pudo leer la base de datos en este momento.";
      $("#t-programas").innerHTML = "<p>Sin datos.</p>"; $("#t-avisos").innerHTML = "<li>Sin datos.</li>";
      return;
    }
    pintarOperacion(d, deCopia);
  }

  window.SAT = Object.assign(window.SAT || {}, { iniciarInicio });
})();
