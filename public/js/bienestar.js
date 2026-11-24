/* Script clásico (sin módulos). Bandeja de Bienestar: una aplicación tipo sistema de información.
   Menú lateral (vistas), tabla de estudiantes y panel de detalle donde se registra lo que pasó.
   - La lista de la semana, «En seguimiento» y «Cerrados» son el trabajo: solo llega el riesgo alto,
     salvo los casos que la consejera abra a mano.
   - «Todos los estudiantes» es la consulta: los 1 040 con su nivel, para abrirle un caso a cualquiera.
   No recalcula nada: los niveles vienen de /api/estudiantes (o de su copia guardada).
   [SUPUESTO] En el prototipo lo registrado vive en localStorage; en una institución iría a su base. */
(function () {
  "use strict";
  const { esc, num, miles, json, nombre, ACCIONES, MOTIVOS } = window.SAT;
  const $ = (sel) => document.querySelector(sel);

  const CUPO = 20;                       // estudiantes por semana [SUPUESTO]
  const PAGINA = 50;                     // filas por tanda en «Todos los estudiantes»
  const CLAVE = "bandeja-bienestar-v1";  // dónde se guarda lo registrado en este navegador
  const CLAVE_AVISOS = "avisos-docentes-v1";  // lo que envían los profesores desde aviso-docente.html
  const DESTINOS = ["Tutoría académica", "Apoyo financiero", "Atención psicológica", "Orientación vocacional"];
  const CIERRES = ["Sigue estudiando", "Se retiró de la universidad", "No quiso recibir apoyo"];
  const ESTADO = { contacto: "Contactado", sin_respuesta: "Sin respuesta", remision: "Remitido", cierre: "Cerrado", mensaje: "Mensaje enviado", sistema: "Sistema" };
  const CLAVE_PERSONA = "bandeja-bienestar-persona";  // «Ver casos de»: la persona elegida en este navegador
  const CLAVE_CARGA = "decersion-ultima-carga";       // la deja la página Estudiantes al terminar su carga viva
  const INTENTOS_ESCALAR = 2;  // [SUPUESTO] dos intentos sin respuesta seguidos: el caso pasa a coordinación
  const FUENTES_SENAL = { notas: "Notas", presencia: "Presencia", situacion: "Situación", admision: "Admisión", titulacion: "Titulación" };
  const GRAVEDAD = { alta: "gravedad alta", media: "gravedad media", leve: "gravedad leve" };
  const AVISO = { contacto: "Contacto registrado", sin_respuesta: "Intento registrado", remision: "Remisión registrada", cierre: "Caso cerrado", mensaje: "Mensaje registrado" };
  /* Mensajes por WhatsApp. Nunca dicen «riesgo» ni «deserción»: invitan a conversar (la lección de Purdue: una
     etiqueta de riesgo puede desanimar). {nombre}, {firma}, {fecha} y {destino} se llenan con el caso. */
  const PLANTILLAS = {
    primer: ["Primer contacto", "Hola{nombre}, te escribe {firma} de Bienestar Universitario. Queremos saber cómo te va este semestre y si hay algo en lo que te podamos ayudar. ¿Tienes unos minutos para hablar esta semana?"],
    cita: ["Invitación a una cita", "Hola{nombre}, te escribe {firma} de Bienestar Universitario. Te invitamos a una conversación corta para conocerte y contarte los apoyos que tenemos: tutorías, apoyo financiero y acompañamiento. ¿Te queda bien el {fecha}? Si no, dime qué día te sirve."],
    recordatorio: ["Recordatorio de cita", "Hola{nombre}, te recuerdo nuestra cita del {fecha} en Bienestar Universitario. Si no puedes venir, avísame y buscamos otro momento."],
    sin_respuesta: ["No pudimos comunicarnos", "Hola{nombre}, te escribe {firma} de Bienestar Universitario. Intentamos llamarte y no pudimos comunicarnos. Cuando puedas, respóndeme por aquí; queremos saber cómo vas."],
    remision: ["Después de una remisión", "Hola{nombre}, te escribe {firma} de Bienestar Universitario. ¿Cómo te fue con {destino}? Cuéntame si pudiste ir o si necesitas ayuda para agendar."],
  };
  const CLAVE_FIRMA = "bandeja-bienestar-firma";  // el nombre con que firma la consejera, para no escribirlo cada vez
  const NIVEL = { alto: "Alto", medio: "Medio", bajo: "Bajo" };
  const ORDEN_NIVEL = { alto: 0, medio: 1, bajo: 2 };
  /* Próximo paso: qué hacer y cuándo. Se fija al registrar y alimenta la vista «Hoy». */
  const QUE = ["Llamar de nuevo", "Cita presencial", "Revisar cómo va la remisión", "Revisar sus notas", "Revisar si respondió"];
  const CUANDO = [["", "Sin próximo paso"], ["1", "Mañana"], ["3", "En 3 días"], ["7", "En una semana"], ["14", "En dos semanas"], ["otra", "Elegir fecha…"]];
  const DIAS_REINTENTO = 2;  // [SUPUESTO] si no respondió y no se eligió fecha, se vuelve a llamar a los 2 días
  /* «¿Acertó el sistema?»: la consejera, después de hablar con el estudiante, dice si la alerta tenía sentido
     (como OU Analyse, que estudia las predicciones que fallaron). Para quien el modelo no marcó en alto, la
     pregunta es si necesitaba apoyo: un «sí» ahí es un caso que el modelo no vio. */
  const VEREDICTOS_ALTO = [["si", "Sí, necesitaba apoyo"], ["parte", "En parte"], ["no", "No, estaba bien"]];
  const VEREDICTOS_OTRO = [["si", "Sí, necesitaba apoyo"], ["no", "No, estaba bien"]];
  const FALLOS = ["El motivo real era otro", "Los datos estaban mal o desactualizados", "Ya recibía apoyo", "Otro"];
  const VISTAS = {
    agenda: ["Hoy", "Primero lo atrasado, después lo de hoy y lo de los próximos días."],
    semana: ["Por contactar esta semana", "Los de mayor riesgo van primero: abra uno, contáctelo y registre lo que pasó."],
    seguimiento: ["En seguimiento", "Estudiantes que ya contactó o remitió y siguen abiertos."],
    cerrado: ["Cerrados", "Casos que ya no necesitan a Bienestar."],
    directorio: ["Todos los estudiantes", "Busque a cualquier estudiante, vea su nivel de riesgo y ábrale un caso si lo necesita."],
    informe: ["Informe", "Lo que ha hecho Bienestar con la lista de riesgo, para compartir con la dirección."],
    avisos: ["Avisos de profesores", "Lo que reportan los docentes desde sus clases. No viene del modelo: es alguien que vio algo y avisó."],
    equipo: ["Equipo", "Quién atiende qué esta semana. El sistema reparte los casos según la ruta de apoyo y equilibra la carga."],
  };
  const entero = (x) => num(x, 0);
  const fecha = (iso) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  const hora = (iso) => new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  const grupo = (e) => e.nivel || "devuelto";

  /* Titulación: la UPV publica la carrera anonimizada («T29» es un código). Se explica con su ficha histórica. */
  const codigoTit = (e) => String(e.titulacion || "").replace("Titulación", "").trim();
  function explicaTit(e) {
    const cod = codigoTit(e), f = ((B.datos || {}).fichas_titulacion || {})[cod], g = (B.datos || {}).tasa_global;
    if (!f || f.tasa == null) return `${cod} · código anónimo de una carrera de la UPV`;
    return `${cod} · código anónimo de una carrera de la UPV · ${miles(f.n_historico)} estudiantes en años anteriores · `
      + `abandona el ${Math.round(100 * f.tasa)} % en primer año${g ? ` (en toda la universidad, el ${Math.round(100 * g)} %)` : ""}`;
  }
  const titulacion = (e) => `<span class="tit" title="${esc(explicaTit(e))}">${esc(e.titulacion)}</span>`;

  /* Equipo: cada caso de riesgo alto llega con su persona y su ruta (plan_bienestar.py). Si la API es vieja, no hay equipo. */
  const equipo = () => (B.datos && B.datos.equipo) || [];
  const coordinacion = () => (B.datos && B.datos.coordinacion) || { nombre: "Coordinación", rol: "Coordinación de Bienestar" };
  const persona = (id) => equipo().find((p) => p.id === id);
  const plan = (e) => e.plan || null;
  const escalado = (id) => { const x = caso(id).escalado; return x && !x.resuelto && caso(id).estado !== "cerrado" ? x : null; };
  const avatar = (p, chico) => (p ? `<i class="avatar av-${esc(p.id)}${chico ? " avatar-chico" : ""}" aria-hidden="true">${esc(p.iniciales)}</i>` : "");
  const iniciales = (n) => String(n || "").split(/\s+/).map((x) => x[0] || "").join("").slice(0, 2).toUpperCase();
  /* «Ver casos de»: «coordinacion» muestra los escalados; una persona, los suyos. */
  const deLaPersona = (e) => !B.persona || (B.persona === "coordinacion" ? Boolean(escalado(e.id)) : (plan(e) || {}).asignada === B.persona);
  const nombrePersona = () => (B.persona === "coordinacion" ? coordinacion().nombre : (persona(B.persona) || {}).nombre || "");
  /* Lo que se ve en sus datos: la primera señal, que ya viene ordenada de la más grave a la más leve. */
  const senalPrincipal = (e) => (e.senales || [])[0] || null;

  /* Fechas del calendario como texto AAAA-MM-DD en hora local, para comparar días sin líos de zona horaria. */
  const dia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const hoy = () => dia(new Date());
  const sumarDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return dia(d); };
  const aFecha = (s) => { const [a, m, d] = s.split("-").map(Number); return new Date(a, m - 1, d); };
  const diasHasta = (s) => Math.round((aFecha(s) - aFecha(hoy())) / 864e5);
  function cuandoTexto(s) {
    const n = diasHasta(s), largo = aFecha(s).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
    if (n < 0) return { clase: "atrasado", corto: n === -1 ? "Atrasado 1 día" : `Atrasado ${-n} días`, largo };
    if (n === 0) return { clase: "hoy", corto: "Hoy", largo };
    if (n === 1) return { clase: "pronto", corto: "Mañana", largo };
    return { clase: "pronto", corto: largo, largo };
  }
  const vencido = (id) => { const p = caso(id).proximo; return p && caso(id).estado !== "cerrado" && diasHasta(p.fecha) <= 0; };

  const B = { datos: null, todos: [], porId: new Map(), alto: [], prioridad: new Map(), vista: "semana", elegido: null, abierto: null,
    buscar: "", programa: "", nivel: "", visibles: PAGINA, deCopia: false, reg: { semana: null, casos: {} }, avisos: [], persona: "" };

  /* ------------------------------------------------------------------ registro guardado */
  function leerRegistro() {
    try { const r = JSON.parse(localStorage.getItem(CLAVE) || "null"); if (r && r.casos) B.reg = r; } catch (e) { /* sin almacenamiento */ }
  }
  function guardarRegistro() {
    try { localStorage.setItem(CLAVE, JSON.stringify(B.reg)); } catch (e) { /* sin almacenamiento: no recuerda, pero funciona */ }
  }
  /* Avisos de profesores: una lista aparte, porque los escribe otra página (el portal docente). */
  function leerAvisos() {
    try { const a = JSON.parse(localStorage.getItem(CLAVE_AVISOS) || "[]"); B.avisos = Array.isArray(a) ? a : []; } catch (e) { B.avisos = []; }
  }
  function guardarAvisos() {
    try { localStorage.setItem(CLAVE_AVISOS, JSON.stringify(B.avisos)); } catch (e) { /* sin almacenamiento */ }
  }
  const avisosDe = (id) => B.avisos.filter((a) => a.codigo === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const sinLeer = (id) => B.avisos.some((a) => a.codigo === id && !a.leido);
  const caso = (id) => B.reg.casos[id] || { estado: "por_contactar", historial: [] };
  /* Lo que registró una persona (las líneas del sistema quedan en el historial, pero no cuentan como atención). */
  const humanos = (c) => c.historial.filter((h) => h.tipo !== "sistema");
  const ultimo = (id) => humanos(caso(id)).at(-1);
  const leerPersona = () => { try { return localStorage.getItem(CLAVE_PERSONA) || ""; } catch (e) { return ""; } };
  const guardarPersona = (v) => { try { localStorage.setItem(CLAVE_PERSONA, v); } catch (e) { /* sin almacenamiento */ } };
  function leerCarga() {
    try { const c = JSON.parse(localStorage.getItem(CLAVE_CARGA) || "null"); return c && c.fecha ? c : null; } catch (e) { return null; }
  }

  /* ================================================================== automatizaciones (en el navegador)
     Cada una deja una línea del sistema en el historial del caso, para que se vea qué hizo y por qué. */
  function lineaSistema(c, texto, fechaIso) { c.historial.push({ tipo: "sistema", fecha: fechaIso || new Date().toISOString(), texto }); }

  /* Un aviso de profesor sube la prioridad: el caso aparece en «Hoy» y, si es de riesgo alto y aún nadie lo ha
     contactado, entra a la lista de esta semana en lugar del último pendiente (el cupo sigue en 20). */
  function procesarAvisos() {
    const hechos = new Set(B.reg.avisosVistos || []);
    let cambio = false;
    B.avisos.forEach((a) => {
      if (!a.id || hechos.has(a.id)) return;
      hechos.add(a.id);
      const e = B.porId.get(a.codigo);
      if (!e) return;
      const c = caso(e.id);
      if (c.estado === "cerrado") return;
      cambio = true;
      let texto = `El sistema subió su prioridad por el aviso de ${a.docente} (${a.asignatura})`;
      const s = B.reg.semana;
      if (!a.ejemplo && s && B.prioridad.has(e.id) && !s.ids.includes(e.id) && !ultimo(e.id)) {
        const fuera = [...s.ids].reverse().find((id) => !ultimo(id) && !caso(id).porAviso);
        if (s.ids.length >= CUPO && fuera) s.ids.splice(s.ids.indexOf(fuera), 1);
        if (s.ids.length < CUPO) { s.ids.unshift(e.id); texto += " y lo pasó a la lista de esta semana"; }
      }
      c.porAviso = a.fecha || new Date().toISOString();
      if (!c.proximo || c.proximo.fecha > hoy()) c.proximo = { fecha: hoy(), que: "Contactar: aviso de profesor" };
      lineaSistema(c, texto, a.fecha);
      B.reg.casos[e.id] = c;
      if (a.ejemplo && B.reg.ejemploIds && !B.reg.ejemploIds.includes(e.id)) B.reg.ejemploIds.push(e.id);
    });
    B.reg.avisosVistos = [...hechos];
    if (cambio) guardarRegistro();
    return cambio;
  }

  /* Intentos sin respuesta seguidos (desde el último contacto o remisión). */
  function intentosSeguidos(c) {
    let n = 0;
    for (const h of [...humanos(c)].reverse()) { if (h.tipo === "sin_respuesta") n++; else if (h.tipo === "contacto" || h.tipo === "remision") break; }
    return n;
  }
  /* Dos intentos sin respuesta: pasa a coordinación, con su etiqueta, y aparece en «Hoy». */
  function escalarSiToca(c) {
    if (c.escalado && !c.escalado.resuelto) return false;
    if (intentosSeguidos(c) < INTENTOS_ESCALAR) return false;
    const co = coordinacion();
    c.escalado = { fecha: new Date().toISOString(), a: co.nombre };
    c.estado = "seguimiento";
    c.proximo = { fecha: hoy(), que: `Coordinación (${co.nombre}): decidir cómo llegarle` };
    lineaSistema(c, `El sistema lo escaló a coordinación (${co.nombre}) tras ${INTENTOS_ESCALAR} intentos sin respuesta`);
    return true;
  }

  /* ------------------------------------------------------------------ la semana */
  function armarSemana() {
    /* Entra quien sigue por contactar y no estaba en la semana anterior; quien no respondió vuelve más adelante. */
    const antes = new Set((B.reg.semana || {}).ids || []);
    /* Los que un profesor reportó van primero (el aviso sube la prioridad); después, el orden del modelo. */
    const libres = B.alto.filter((e) => caso(e.id).estado === "por_contactar" && !antes.has(e.id))
      .sort((a, b) => (caso(a.id).porAviso ? 0 : 1) - (caso(b.id).porAviso ? 0 : 1));
    B.reg.semana = { creada: new Date().toISOString(), ids: libres.slice(0, CUPO).map((e) => e.id) };
    guardarRegistro();
  }
  const semanaValida = () => { const s = B.reg.semana; return s && s.ids.length && s.ids.every((id) => B.prioridad.has(id)); };

  function listaDeVista() {
    let lista;
    if (B.vista === "semana") {
      const pos = (id) => B.reg.semana.ids.indexOf(id), aviso = (id) => (caso(id).porAviso && !ultimo(id) ? 0 : 1);
      lista = B.reg.semana.ids.map((id) => B.porId.get(id)).filter(Boolean).sort((a, b) => aviso(a.id) - aviso(b.id) || pos(a.id) - pos(b.id));
    } else if (B.vista === "directorio") lista = B.todos;
    else if (B.vista === "avisos") {
      const ultimoAviso = (id) => avisosDe(id)[0].fecha;
      lista = B.todos.filter((e) => avisosDe(e.id).length).sort((a, b) => ultimoAviso(b.id).localeCompare(ultimoAviso(a.id)));
    } else if (B.vista === "agenda") {
      lista = B.todos.filter((e) => caso(e.id).proximo && caso(e.id).estado !== "cerrado")
        .sort((a, b) => caso(a.id).proximo.fecha.localeCompare(caso(b.id).proximo.fecha) || (B.prioridad.get(a.id) || 1e4) - (B.prioridad.get(b.id) || 1e4));
    }
    else lista = B.todos.filter((e) => caso(e.id).estado === B.vista);
    const q = B.buscar.trim().toUpperCase();
    return lista.filter((e) => (!q || e.id.includes(q)) && (!B.programa || e.titulacion === B.programa)
      && (B.vista !== "directorio" || !B.nivel || grupo(e) === B.nivel) && deLaPersona(e));
  }

  /* ------------------------------------------------------------------ etiquetas */
  function etiquetaEstado(id) {
    if (escalado(id)) return `<span class="etiqueta et-escalado" title="Lo atiende ${esc(escalado(id).a)}">Escalado a coordinación</span>`;
    const u = ultimo(id);
    if (!u && caso(id).porAviso && caso(id).estado !== "cerrado") return `<span class="etiqueta et-prioridad" title="Un profesor lo reportó: el sistema subió su prioridad">Prioridad: aviso</span>`;
    if (!u) return B.prioridad.has(id) ? `<span class="etiqueta et-pendiente">Pendiente</span>` : `<span class="etiqueta et-sin-caso">Sin caso</span>`;
    let texto = ESTADO[u.tipo];
    if (u.tipo === "sin_respuesta") { const n = caso(id).historial.filter((h) => h.tipo === "sin_respuesta").length; texto = `Sin respuesta (${n})`; }
    return `<span class="etiqueta et-${u.tipo}">${esc(texto)}</span>`;
  }
  function etiquetaNivel(e) {
    if (!e.nivel) return `<span class="etiqueta et-devuelto">Devuelto</span>`;
    const prov = e.decision === "provisional";
    return `<span class="etiqueta et-${e.nivel}"${prov ? ' title="Calculado con la matrícula: faltan datos académicos"' : ""}>${NIVEL[e.nivel]}${prov ? ", provisional" : ""}</span>`;
  }
  const marcaProvisional = (e) => (e.decision === "provisional" ? ` <span class="mini-prov" title="Calculado con la matrícula: faltan datos académicos">provisional</span>` : "");
  /* El motivo es lo que se ve en sus datos (la primera señal), no los puntos del modelo: estos ponían «tiempo parcial»
     primero incluso a quien suspendió todo. Si no hay señal, se cae a la razón del modelo. */
  function motivoDe(e) {
    if (!e.nivel) return `Devuelto: ${MOTIVOS[e.motivo] || e.motivo}`;
    const s = senalPrincipal(e);
    return s ? s.texto : ((e.porque || [])[0] || {}).texto || "Sus datos no se salen de lo usual";
  }
  function celdaMotivo(e) {
    const s = e.nivel ? senalPrincipal(e) : null;
    return `<td class="motivo">${s ? `<i class="punto punto-${esc(s.gravedad)}" title="${esc(GRAVEDAD[s.gravedad] || "")}"></i>` : ""}${esc(motivoDe(e))}</td>`;
  }
  /* A cargo: la persona asignada (avatar y nombre) y, debajo, la ruta de apoyo. */
  function celdaCargo(e) {
    const p = plan(e), quien = p && persona(p.asignada), arriba = escalado(e.id);
    if (!quien) return `<td class="a-cargo"><span class="a-cargo-nadie">—</span></td>`;
    return `<td class="a-cargo"><span class="a-cargo-in">${avatar(quien, true)}<span><b>${esc(quien.nombre)}</b>`
      + `<small>${arriba ? `Coordinación: ${esc(arriba.a)}` : esc(p.ruta)}</small></span></span></td>`;
  }

  /* ------------------------------------------------------------------ menú, encabezado y tabla */
  function pintarMenu() {
    document.querySelectorAll(".app-menu [data-vista]").forEach((b) => {
      if (b.dataset.vista === B.vista) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    /* Los números del menú cuentan solo los casos de la persona elegida en «Ver casos de». */
    const mios = B.todos.filter(deLaPersona), mio = (id) => B.porId.has(id) && deLaPersona(B.porId.get(id));
    $("#n-semana").textContent = B.reg.semana.ids.filter((id) => !ultimo(id) && mio(id)).length;
    /* «Hoy» cuenta lo que vence hoy o ya venció; en rojo si hay algo atrasado. */
    const pendientesHoy = mios.filter((e) => vencido(e.id));
    const nAgenda = $("#n-agenda");
    nAgenda.textContent = pendientesHoy.length;
    nAgenda.classList.toggle("urgente", pendientesHoy.some((e) => diasHasta(caso(e.id).proximo.fecha) < 0));
    ["seguimiento", "cerrado"].forEach((v) => { $(`#n-${v}`).textContent = mios.filter((e) => caso(e.id).estado === v).length; });
    $("#n-directorio").textContent = miles(mios.length);
    $("#n-avisos").textContent = B.avisos.filter((a) => !a.leido && mio(a.codigo)).length;
  }

  /* «Ver casos de»: avatar y nombre de quien se eligió. */
  function pintarPersona() {
    const p = persona(B.persona), co = B.persona === "coordinacion";
    const av = $("#ap-persona-avatar");
    av.textContent = p ? p.iniciales : co ? iniciales(coordinacion().nombre) : "EQ";
    av.className = `avatar ${p ? `av-${p.id}` : co ? "av-coordinacion" : "av-equipo"}`;
    $("#ap-persona").value = B.persona;
  }

  /* Lo que el sistema ya hizo, en una línea: de dónde salió la lista y que todo llega repartido y redactado. */
  function pintarFranja() {
    const f = $("#ap-franja");
    f.hidden = !["semana", "agenda"].includes(B.vista) || B.deCopia;
    if (f.hidden) return;
    const carga = leerCarga(), lp = window.SAT.lecturaProgramada();
    const manual = carga && new Date(carga.fecha) > lp.ultima;   // alguien la leyó a mano después de la automática
    const cuando = manual ? carga.fecha : lp.ultima.toISOString();
    const ids = B.reg.semana.ids, personas = new Set(ids.map((id) => (plan(B.porId.get(id) || {}) || {}).asignada).filter(Boolean));
    const alertas = carga && Number.isFinite(Number(carga.alertas)) ? Number(carga.alertas) : B.alto.length;
    let deCuando = "";
    if (cuando && !Number.isNaN(new Date(cuando).getTime())) {
      deCuando = dia(new Date(cuando)) === hoy() ? ` de hoy ${hora(cuando)}` : ` del ${fecha(cuando)}, ${hora(cuando)}`;
    }
    const reparto = personas.size ? `, repartidas entre ${personas.size} ${personas.size === 1 ? "persona" : "personas"}` : "";
    f.innerHTML = `<b>Recibido de la lectura ${manual ? "" : "automática "}${esc(deCuando.replace(/^ de /, "de ").replace(/^ del /, "del "))}:</b> <span>${miles(alertas)} alertas</span> · <span>${ids.length} para esta semana${reparto}</span>`
      + `${equipo().length ? " · <span>mensajes de primer contacto listos</span>" : ""}`;
  }

  /* «Semana del 23 al 29 de noviembre»: la semana corre siete días desde que se armó la lista. */
  function rangoSemana() {
    const ini = new Date(B.reg.semana.creada), fin = new Date(ini.getTime() + 6 * 864e5);
    const mes = (d) => d.toLocaleDateString("es-CO", { month: "long" });
    return ini.getMonth() === fin.getMonth() ? `Semana del ${ini.getDate()} al ${fin.getDate()} de ${mes(fin)}`
      : `Semana del ${ini.getDate()} de ${mes(ini)} al ${fin.getDate()} de ${mes(fin)}`;
  }

  function pintarEncabezado() {
    const [titulo, base] = VISTAS[B.vista];
    const fechaHoy = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
    const quien = nombrePersona();
    const sub = B.vista === "semana" ? `${rangoSemana()}. ${quien ? `Los casos de ${quien}, de mayor riesgo primero.` : base}`
      : B.vista === "agenda" ? `${fechaHoy.charAt(0).toUpperCase()}${fechaHoy.slice(1)}. ${base}`
      : quien && B.vista !== "equipo" && B.vista !== "informe" ? `${base} Solo los casos de ${quien}.` : base;
    $("#ap-titulo").textContent = titulo;
    const todosIds = B.reg.semana.ids;
    const ids = todosIds.filter((id) => B.porId.has(id) && deLaPersona(B.porId.get(id))), hechos = ids.filter((id) => ultimo(id)).length;
    const todosHechos = todosIds.every((id) => ultimo(id));
    $("#ap-subtitulo").innerHTML = B.vista === "semana" && todosHechos
      ? `Ya atendieron a los ${todosIds.length} de esta semana. <button type="button" class="app-enlace" id="ap-nueva">Armar la semana siguiente</button>`
      : esc(sub);
    $("#ap-avance").hidden = B.vista !== "semana" || !ids.length;
    const informe = B.vista === "informe", panel = informe || B.vista === "equipo";
    ["#ap-herramientas", "#ap-tabla-zona"].forEach((s) => { $(s).hidden = panel; });
    $("#ap-informe").hidden = !informe;
    $("#ap-equipo").hidden = B.vista !== "equipo";
    $("#ap-acciones-informe").hidden = !informe;
    $("#ap-explica").hidden = B.vista !== "directorio";
    $("#ap-avance-texto").textContent = quien ? `${hechos} de ${ids.length} de ${quien.split(" ")[0]} atendidos` : `${hechos} de ${ids.length} atendidos esta semana`;
    $("#ap-avance-relleno").style.transform = `scaleX(${ids.length ? hechos / ids.length : 0})`;
    $("#ap-nivel").hidden = B.vista !== "directorio";
    pintarFranja(); pintarPersona();
    const pend = pendientesSemana().length;
    $("#ap-campana").hidden = B.vista !== "semana" || !pend;
    $("#ap-campana").textContent = `Invitar por WhatsApp a los ${pend} pendientes`;
  }

  /* En la lista de trabajo todos son de riesgo alto, así que no hay columna de nivel: solo se marca el provisional.
     En «Todos los estudiantes» el nivel es lo que se busca, y la prioridad no aplica. */
  function pintarTabla() {
    const directorio = B.vista === "directorio", agenda = B.vista === "agenda", avisos = B.vista === "avisos";
    /* El estudiante va en una sola celda (código y, debajo, programa), como en las plataformas de notas: deja más
       espacio al motivo, que es lo que la consejera lee para decidir. En la agenda, lo primero es cuándo y qué hacer. */
    /* «Motivo principal» = lo que se ve en sus datos; «A cargo» = quién lo atiende y por qué ruta. */
    const cargo = `<th scope="col" class="col-cargo">A cargo</th>`;
    $("#ap-cabeza").innerHTML = directorio
      ? `<th scope="col">Estudiante</th><th scope="col">Nivel</th><th scope="col">Motivo principal</th>${cargo}<th scope="col">Caso</th>`
      : avisos
        ? `<th scope="col" class="col-cuando">Recibido</th><th scope="col">Estudiante</th><th scope="col">Qué está pasando</th><th scope="col" class="col-programa">Reportado por</th><th scope="col">Nivel</th><th scope="col">Caso</th>`
      : agenda
        ? `<th scope="col" class="col-cuando">Cuándo</th><th scope="col">Estudiante</th><th scope="col">Qué hacer</th>${cargo}<th scope="col">Estado</th><th scope="col" class="col-fecha">Último contacto</th>`
        : `<th scope="col" class="col-n" title="Prioridad">#</th><th scope="col">Estudiante</th><th scope="col">Motivo principal</th>${cargo}<th scope="col">Estado</th><th scope="col" class="col-fecha">Última acción</th>`;
    document.querySelector(".app-tabla").classList.toggle("es-agenda", agenda);
    const lista = listaDeVista(), mostrados = directorio ? lista.slice(0, B.visibles) : lista;
    $("#ap-filas").innerHTML = mostrados.map((e) => {
      const u = ultimo(e.id), hecha = B.vista === "semana" && u;
      const nuevo = sinLeer(e.id);
      const codigo = `<td class="codigo"><button type="button" aria-label="Abrir el caso de ${esc(e.id)}">${esc(e.id)}</button>${directorio ? "" : marcaProvisional(e)}
        ${nuevo && !avisos ? `<span class="mini-aviso" title="Un profesor lo reportó">aviso</span>` : ""}<span class="programa">${titulacion(e)}</span></td>`;
      const motivo = celdaMotivo(e);
      let filas;
      if (avisos) {
        const a = avisosDe(e.id)[0], n = avisosDe(e.id).length;
        const recibido = Math.round((aFecha(hoy()) - aFecha(dia(new Date(a.fecha)))) / 864e5);
        filas = `<td class="col-n cuando">${recibido === 0 ? "Hoy" : recibido === 1 ? "Ayer" : fecha(a.fecha)}</td>${codigo}`
          + `<td class="motivo">${esc(a.motivos.join(", "))}${n > 1 ? ` <span class="mini-aviso">${n} avisos</span>` : ""}</td>`
          + `<td class="docente programa"><b>${esc(a.docente)}</b>${esc(a.asignatura)}</td>`
          + `<td class="riesgo">${etiquetaNivel(e)}</td><td class="estado">${etiquetaEstado(e.id)}</td>`;
        return `<tr data-id="${esc(e.id)}" aria-selected="${e.id === B.elegido}"${nuevo ? ' class="fila-nueva"' : ""}>${filas}</tr>`;
      }
      if (directorio) filas = `${codigo}<td class="riesgo">${etiquetaNivel(e)}</td>${motivo}${celdaCargo(e)}<td class="estado">${etiquetaEstado(e.id)}</td>`;
      else if (agenda) {
        const p = caso(e.id).proximo, c = cuandoTexto(p.fecha);
        filas = `<td class="col-n cuando cuando-${c.clase}" title="${esc(c.largo)}">${esc(c.corto)}</td>${codigo}<td class="motivo"><strong>${esc(p.que)}</strong></td>`
          + `${celdaCargo(e)}<td class="estado">${etiquetaEstado(e.id)}</td><td class="fecha">${u ? fecha(u.fecha) : "—"}</td>`;
      } else filas = `<td class="col-n">${B.prioridad.get(e.id) || "—"}</td>${codigo}${motivo}${celdaCargo(e)}<td class="estado">${etiquetaEstado(e.id)}</td><td class="fecha">${u ? fecha(u.fecha) : "—"}</td>`;
      return `<tr data-id="${esc(e.id)}" aria-selected="${e.id === B.elegido}"${hecha ? ' class="fila-hecha"' : ""}>${filas}</tr>`;
    }).join("");
    const vacio = $("#ap-vacio");
    vacio.hidden = lista.length > 0;
    vacio.textContent = B.buscar || B.programa || B.nivel ? "Ningún estudiante coincide con la búsqueda."
      : B.persona === "coordinacion" ? "Ningún caso escalado. Cuando un estudiante no responde a dos intentos, el sistema lo pasa a coordinación y aparece aquí."
      : B.persona && B.vista === "semana" ? `${nombrePersona()} no tiene casos en la lista de esta semana. Elija «Todo el equipo» para ver los 20.`
      : B.vista === "seguimiento" ? "Nadie en seguimiento. Cuando registre un contacto o una remisión, el estudiante aparece aquí."
      : B.vista === "cerrado" ? "Ningún caso cerrado todavía."
      : avisos ? "Ningún profesor ha enviado avisos. El formulario para profesores está en el menú, abajo."
      : agenda ? "No hay nada programado. Cuando registre un contacto, elija el próximo paso y aparecerá aquí en su fecha."
      : "No hay estudiantes en esta lista.";
    const quedan = lista.length - mostrados.length;
    $("#ap-mas-zona").hidden = quedan <= 0;
    $("#ap-mas-texto").textContent = `Mostrando ${miles(mostrados.length)} de ${miles(lista.length)}`;
  }

  /* ------------------------------------------------------------------ panel de detalle */
  function propuestas(e) {
    const textos = B.datos.textos_mejora || {}, vistas = new Set();
    return (e.mejorar || []).map((m) => m.texto || textos[m.variable]).filter((t) => t && !vistas.has(t) && vistas.add(t)).slice(0, 3);
  }

  /* Ficha rápida: los tres datos que una consejera pregunta primero, a la vista y sin abrir nada. */
  function fichaRapida(e) {
    const r = e.registro, sinDato = (v, f) => (v == null ? "sin dato" : f(v));
    /* En la base real «trabaja» es la matrícula a tiempo parcial; las versiones viejas de la API la traían en «matricula». */
    const parcial = r.trabaja ?? Boolean((e.matricula || {}).tiempo_parcial);
    const dato = (valor, rotulo) => `<div class="det-dato"><b>${esc(valor)}</b><span>${rotulo}</span></div>`;
    return `<div class="det-ficha">
      ${dato(sinDato(r.promedio_acumulado, (v) => num(v, 1)), "promedio de 0 a 5")}
      ${dato(`${r.materias_reprobadas} de ${r.materias_cursadas_periodo_anterior}`, "asignaturas perdidas")}
      ${dato(sinDato(r.porcentaje_asistencia, (v) => `${entero(v)} %`), "asistencia")}
    </div>
    <p class="det-linea">${parcial ? "Tiempo parcial" : "Tiempo completo"}. Cohorte ${e.cohorte}-${String(e.cohorte + 1).slice(2)}. Datos del primer cuatrimestre.</p>`;
  }

  function historial(id) {
    const h = caso(id).historial;
    if (!h.length) return `<p class="det-sin">Todavía no hay nada registrado.</p>`;
    return `<ol class="det-historial">${h.slice().reverse().map((x) => {
      if (x.tipo === "sistema") return `<li class="det-h-sistema"><time datetime="${esc(x.fecha)}">${fecha(x.fecha)}, ${hora(x.fecha)}</time>${esc(x.texto)}.</li>`;
      const detalle = x.tipo === "remision" ? ` a ${x.destino.toLowerCase()}` : x.tipo === "cierre" ? `: ${x.motivo.toLowerCase()}`
        : x.tipo === "mensaje" ? ` por WhatsApp: ${(x.plantilla || "").toLowerCase()}` : "";
      const sig = x.proximo ? `<span class="det-sig">Próximo paso: ${esc(x.proximo.que.toLowerCase())}, ${esc(cuandoTexto(x.proximo.fecha).largo)}.</span>` : "";
      return `<li><time datetime="${esc(x.fecha)}">${fecha(x.fecha)}, ${hora(x.fecha)}</time>
        <strong>${ESTADO[x.tipo]}</strong>${esc(detalle)}${x.nota ? `. <em>«${esc(x.nota)}»</em>` : ""}${sig}</li>`;
    }).join("")}</ol>`;
  }

  /* Lo que reportaron los profesores, del más reciente al más antiguo. Si el modelo no lo tenía en riesgo alto,
     se dice: es justo el caso que el aviso humano viene a cubrir. */
  function bloqueAvisos(e) {
    const lista = avisosDe(e.id);
    if (!lista.length) return "";
    const nota = e.nivel !== "alto" ? `<p class="det-nota-sistema">El modelo no lo tiene en riesgo alto${e.nivel ? ` (está en ${e.nivel})` : ""}: este aviso es una señal que los datos no muestran.</p>` : "";
    return `<section class="det-bloque"><h3>Avisos de profesores (${lista.length})</h3><div class="det-avisos">${lista.map((a) => `
      <article class="det-aviso-doc"><header><b>${esc(a.docente)}, ${esc(a.asignatura)}</b><time datetime="${esc(a.fecha)}">${fecha(a.fecha)}, ${hora(a.fecha)}</time></header>
        <ul>${a.motivos.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>${a.comentario ? `<em>«${esc(a.comentario)}»</em>` : ""}</article>`).join("")}</div>${nota}</section>`;
  }

  /* Encabezado del caso, para quien llama: quién es (titulación explicada), quién lo atiende y por qué ruta. */
  function cabeceraCaso(e) {
    const p = plan(e), quien = p && persona(p.asignada), arriba = escalado(e.id);
    const tit = explicaTit(e).replace(/^[^·]+·\s*/, "");
    return `<div class="det-cabeza">
        <div><h2>${esc(e.id)}</h2>
          <div class="det-etiquetas">${etiquetaNivel(e)}${etiquetaEstado(e.id)}</div></div>
        <button type="button" class="det-cerrar" id="det-cerrar" aria-label="Cerrar el panel">✕</button>
      </div>
      <p class="det-tit"><b>${esc(e.titulacion)}</b>, cohorte ${e.cohorte}. <span>${esc(tit.charAt(0).toUpperCase() + tit.slice(1))}.</span></p>
      ${quien ? `<div class="det-asignada">
        <div class="det-quien">${avatar(quien)}<div><span>A cargo</span><b>${esc(quien.nombre)}</b><small>${esc(quien.rol)}</small></div></div>
        <div class="det-ruta"><span>Ruta sugerida</span><b>${esc(p.ruta)}</b><small>Porque ${esc(p.porque)}.</small></div>
      </div>` : ""}
      ${arriba ? `<p class="det-escalado"><b>Escalado a coordinación.</b> ${esc(arriba.a)} decide cómo llegarle: no respondió a ${INTENTOS_ESCALAR} intentos.</p>` : ""}`;
  }

  /* Qué se ve en sus datos: las señales por fuente, con un punto de gravedad. Lo que no se puede trabajar con el
     estudiante (admisión, titulación) va aparte como contexto. */
  function bloqueSenales(e) {
    const s = e.senales || [], trab = s.filter((x) => x.trabajable), ctx = s.filter((x) => !x.trabajable);
    const item = (x) => `<li><i class="punto punto-${esc(x.gravedad)}" title="${esc(GRAVEDAD[x.gravedad] || "")}"></i><span>${esc(x.texto)}<span class="app-oculto"> (${esc(GRAVEDAD[x.gravedad] || "")})</span></span></li>`;
    const grupos = Object.keys(FUENTES_SENAL).map((f) => [f, trab.filter((x) => x.fuente === f)]).filter(([, l]) => l.length);
    return `<section class="det-bloque"><h3>Qué se ve en sus datos</h3>
      ${fichaRapida(e)}
      ${grupos.length ? `<dl class="det-senales">${grupos.map(([f, l]) => `<dt>${esc(FUENTES_SENAL[f])}</dt><dd><ul>${l.map(item).join("")}</ul></dd>`).join("")}</dl>`
        : `<p class="det-sin">${s.length ? "Nada que se pueda trabajar con el estudiante se sale de lo usual." : "Sus datos no se salen de lo usual."}</p>`}
      ${ctx.length ? `<div class="det-contexto"><p>Contexto (no se puede cambiar)</p><ul>${ctx.map(item).join("")}</ul></div>` : ""}
    </section>`;
  }

  /* Plan sugerido: lo que ya hizo el sistema y lo que hace la persona, en tres pasos. El humano solo toca para
     enviar, registrar la llamada y confirmar la remisión; lo demás ya viene redactado y preseleccionado. */
  function bloquePlan(e) {
    const p = plan(e);
    if (!p || caso(e.id).estado === "cerrado") return "";
    const h = humanos(caso(e.id)), hecho = (t) => h.find((x) => x.tipo === t);
    const quien = persona(p.asignada), firma = quien ? quien.nombre : leerFirma();
    const texto = textoMensaje("primer", { firma, id: e.id });
    const msj = hecho("mensaje"), con = hecho("contacto"), rem = hecho("remision"), arriba = escalado(e.id);
    const intentos = intentosSeguidos(caso(e.id));
    const paso = (n, estado, quienHace, titulo, cuerpo) => `<li class="plan-paso${estado ? ` plan-${estado}` : ""}">
        <span class="plan-n" aria-hidden="true">${estado === "hecho" ? "✓" : n}</span>
        <div><p class="plan-titulo"><b>${titulo}</b><span class="plan-quien plan-quien-${quienHace === "Sistema" ? "sis" : "hum"}">${quienHace}</span></p>${cuerpo}</div></li>`;
    return `<section class="det-bloque det-plan"><h3>Plan sugerido</h3><ol class="plan-pasos">
      ${paso(1, msj ? "hecho" : "", "Sistema", "Mensaje de primer contacto", msj
        ? `<p class="plan-nota">Enviado el ${fecha(msj.fecha)}. Ya está redactado por el sistema.</p>`
        : `<p class="plan-nota">Ya redactado y firmado por ${esc(firma || "usted")}. No menciona riesgo ni deserción.</p>
          <blockquote class="plan-texto">${esc(texto)}</blockquote>
          <a class="boton-sec boton-wa" id="plan-wa" href="${esc(enlaceWhatsApp("", texto))}" target="_blank" rel="noopener">Enviar por WhatsApp</a>`)}
      ${paso(2, con ? "hecho" : arriba ? "escalado" : "", "Usted", "Llamada o cita", con
        ? `<p class="plan-nota">Contactado el ${fecha(con.fecha)}.</p>`
        : arriba ? `<p class="plan-nota">Lo tiene ${esc(arriba.a)} (coordinación) tras ${INTENTOS_ESCALAR} intentos sin respuesta. Si aun así lo contacta, regístrelo abajo.</p>`
        : `<p class="plan-nota">Llámelo o cítelo. Al terminar, toque «Lo contacté» abajo${intentos ? `. Lleva ${intentos} ${intentos === 1 ? "intento" : "intentos"} sin respuesta; al ${INTENTOS_ESCALAR}.º, el sistema lo pasa a coordinación` : ""}.</p>`)}
      ${paso(3, rem ? "hecho" : "", "Usted", `Remisión a ${esc(p.ruta.toLowerCase())}`, rem
        ? `<p class="plan-nota">Remitido a ${esc(rem.destino.toLowerCase())} el ${fecha(rem.fecha)}.</p>`
        : `<p class="plan-nota">Después de hablar con el estudiante. El formulario ya trae la ruta elegida; puede cambiarla.</p>
          <button type="button" class="boton-sec" data-abre="remision" aria-expanded="${B.abierto === "remision"}">Remitir a ${esc(p.ruta.toLowerCase())}…</button>`)}
    </ol></section>`;
  }

  /* Un aviso en lenguaje simple cuando el estudiante no viene de la lista de riesgo alto. */
  function avisoOrigen(e) {
    if (!e.nivel) return `<p class="det-aviso">Su registro se devolvió al registro académico porque ${esc(MOTIVOS[e.motivo] || e.motivo)}${e.campo ? ` (${esc(nombre(e.campo))})` : ""}. No tiene nivel de riesgo hasta que lo corrijan, pero puede abrirle un caso.</p>`;
    if (e.decision === "provisional") return `<p class="det-aviso">Resultado provisional: ${esc(MOTIVOS[e.motivo] || e.motivo)}${e.campo ? ` (${esc(nombre(e.campo))})` : ""}. Se calculó con su matrícula y puede cambiar.</p>`;
    if (e.nivel !== "alto" && !ultimo(e.id) && !avisosDe(e.id).length) return `<p class="det-aviso det-aviso-info">No está en la lista de Bienestar: su riesgo es ${e.nivel}${e.nivel === "medio" ? " y lo atiende tutoría académica" : ""}. Si llegó a la oficina o se lo remitieron, registre el contacto y queda en seguimiento.</p>`;
    return "";
  }

  function pintarDetalle() {
    const panel = $("#ap-detalle"), cuerpo = document.querySelector(".app-cuerpo");
    const e = B.porId.get(B.elegido);
    panel.hidden = !e && !B.campana;
    cuerpo.classList.toggle("con-detalle", Boolean(e || B.campana));
    if (B.campana && !e) { pintarCampana(); return; }
    if (!e) return;
    const cerrado = caso(e.id).estado === "cerrado";
    const razones = (e.porque || []).slice(0, 3).map((p) => `<li>${esc(p.texto)}</li>`).join("");
    const props = propuestas(e).map((t) => `<li>${esc(t)}</li>`).join("");
    /* Lo que la consejera ya escribió o eligió se conserva al volver a dibujar el panel. */
    const borrador = { nota: ($("#det-nota") || {}).value || "", cuando: ($("#det-cuando") || {}).value || "",
      que: ($("#det-que") || {}).value || QUE[0], fecha: ($("#det-fecha") || {}).value || "" };
    const p = caso(e.id).proximo;
    const proximo = p && !cerrado ? (() => {
      const c = cuandoTexto(p.fecha);
      return `<div class="det-proximo cuando-${c.clase}"><div><span>Próximo paso</span><strong>${esc(p.que)}</strong>
        <span>${esc(c.corto === c.largo ? c.largo : `${c.corto}, ${c.largo}`)}</span></div>
        <button type="button" class="app-enlace" data-quitar>Quitar</button></div>`;
    })() : "";
    const programar = `<div class="det-programar">
        <label for="det-cuando">Próximo paso</label>
        <div><select id="det-cuando">${CUANDO.map(([v, t]) => `<option value="${v}"${v === borrador.cuando ? " selected" : ""}>${t}</option>`).join("")}</select>
          <label class="app-oculto" for="det-que">Qué hacer</label>
          <select id="det-que"${borrador.cuando ? "" : " hidden"}>${QUE.map((q) => `<option${q === borrador.que ? " selected" : ""}>${q}</option>`).join("")}</select></div>
        <label class="app-oculto" for="det-fecha">Fecha</label>
        <input type="date" id="det-fecha" min="${hoy()}" value="${esc(borrador.fecha)}"${borrador.cuando === "otra" ? "" : " hidden"}>
      </div>`;
    const nota = borrador.nota;
    const conPlan = Boolean(plan(e));
    /* Lo que dice el modelo (sus puntos y recomendaciones) queda plegado: para llamar sirve más lo que se ve en los datos. */
    const modelo = e.nivel && (razones || props || ACCIONES[e.accion]) ? `<details class="det-plegable"><summary>Por qué lo marcó el modelo</summary>
        <div class="det-plegable-cuerpo">${razones ? `<ol>${razones}</ol>` : ""}${props ? `<p class="det-sub">Qué se recomienda</p><ul>${props}</ul>` : ""}
        ${ACCIONES[e.accion] ? `<p class="det-nota-sistema">Acción del sistema: ${esc(ACCIONES[e.accion])}.</p>` : ""}</div></details>` : "";
    const nHist = caso(e.id).historial.length;
    const destinoSugerido = (plan(e) || {}).ruta;
    panel.innerHTML = `
      ${cabeceraCaso(e)}
      ${proximo}
      ${avisoOrigen(e)}
      ${bloqueSenales(e)}
      ${bloqueAvisos(e)}
      ${bloquePlan(e)}
      ${cerrado ? `<p class="det-cerrado">Caso cerrado. ${esc(ultimo(e.id).motivo)}.</p>` : `
      <section class="det-registrar" aria-labelledby="det-reg-titulo">
        <h3 id="det-reg-titulo">${ultimo(e.id) || B.prioridad.has(e.id) ? "Registrar lo que pasó" : "Abrir un caso"}</h3>
        <label class="app-oculto" for="det-nota">Nota</label>
        <textarea id="det-nota" placeholder="Nota (opcional): qué le dijo, qué acordaron…">${esc(nota)}</textarea>
        ${programar}
        <button type="button" class="det-principal" data-accion="contacto">Lo contacté</button>
        <div class="det-secundarias">
          <button type="button" class="boton-sec" data-accion="sin_respuesta">No respondió</button>
          ${conPlan ? "" : `<button type="button" class="boton-sec" data-abre="remision" aria-expanded="${B.abierto === "remision"}">Remitir…</button>`}
          <button type="button" class="boton-sec" data-abre="cierre" aria-expanded="${B.abierto === "cierre"}">Cerrar caso…</button>
        </div>
        ${B.abierto === "remision" ? `<div class="det-elegir"><label for="det-destino">¿A dónde lo remite?</label>
          <div><select id="det-destino">${DESTINOS.map((d) => `<option${d === destinoSugerido ? " selected" : ""}>${d}</option>`).join("")}</select>
          <button type="button" class="boton-sec" data-accion="remision">Guardar remisión</button></div>
          ${destinoSugerido ? `<p class="det-nota-sistema">Preseleccionada la ruta sugerida. Puede cambiarla.</p>` : ""}</div>` : ""}
        ${B.abierto === "cierre" ? `<div class="det-elegir"><label for="det-motivo">¿Por qué se cierra?</label>
          <div><select id="det-motivo">${CIERRES.map((d) => `<option>${d}</option>`).join("")}</select>
          <button type="button" class="boton-sec" data-accion="cierre">Cerrar caso</button></div></div>` : ""}
      </section>`}
      ${cerrado ? "" : bloqueMensaje(e)}
      ${bloqueVeredicto(e)}
      ${modelo}
      ${nHist > 4 ? `<details class="det-plegable"><summary>Historial (${nHist})</summary><div class="det-plegable-cuerpo">${historial(e.id)}</div></details>`
        : `<section class="det-bloque"><h3>Historial</h3>${historial(e.id)}</section>`}`;
    if (B.mensaje && !cerrado) llenarMensaje(e);
  }

  function avisar(texto) {
    const a = $("#ap-aviso");
    a.hidden = true; void a.offsetWidth;  // reinicia la animación de entrada
    a.textContent = texto; a.hidden = false;
    clearTimeout(avisar.t); avisar.t = setTimeout(() => { a.hidden = true; }, 2600);
  }

  function registrar(tipo) {
    const id = B.elegido, c = caso(id);
    const entrada = { tipo, fecha: new Date().toISOString(), nota: ($("#det-nota").value || "").trim() };
    if (tipo === "remision") entrada.destino = $("#det-destino").value;
    if (tipo === "cierre") entrada.motivo = $("#det-motivo").value;
    /* Próximo paso: el que se eligió; si no respondió y no se eligió nada, volver a llamar en 2 días.
       Registrar algo cumple el paso anterior, así que se reemplaza; cerrar el caso lo quita. */
    const cuando = $("#det-cuando").value;
    if (cuando === "otra" && !$("#det-fecha").value) { avisar("Elija la fecha del próximo paso"); $("#det-fecha").focus(); return; }
    let fechaSig = cuando === "otra" ? $("#det-fecha").value : cuando ? sumarDias(Number(cuando)) : "";
    let que = $("#det-que").value;
    const auto = !fechaSig && tipo === "sin_respuesta";
    if (auto) { fechaSig = sumarDias(DIAS_REINTENTO); que = "Llamar de nuevo"; }
    if (tipo !== "cierre" && fechaSig) { c.proximo = { fecha: fechaSig, que }; entrada.proximo = c.proximo; }
    else delete c.proximo;
    c.historial.push(entrada);
    /* «No respondió» deja el caso por contactar; si el estudiante no venía de la lista, igual queda en seguimiento
       para que no se pierda. */
    if (tipo === "cierre") c.estado = "cerrado";
    else if (tipo !== "sin_respuesta" || !B.prioridad.has(id)) c.estado = "seguimiento";
    /* Automatizaciones: hablar con el estudiante resuelve el escalado; el segundo intento sin respuesta lo escala;
       si no se eligió fecha, el sistema programa volver a llamar (y lo anota). */
    if (tipo !== "sin_respuesta" && c.escalado && !c.escalado.resuelto) c.escalado.resuelto = entrada.fecha;
    const escalo = tipo === "sin_respuesta" && escalarSiToca(c);
    if (escalo) delete entrada.proximo;  // el próximo paso ahora es de coordinación, hoy
    if (auto && !escalo) lineaSistema(c, `El sistema programó «Llamar de nuevo» para dentro de ${DIAS_REINTENTO} días`);
    B.reg.casos[id] = c; B.abierto = null;
    guardarRegistro();
    $("#det-nota").value = ""; $("#det-cuando").value = ""; $("#det-fecha").value = "";
    avisar(escalo ? `${AVISO[tipo]}: ${id}. Segundo intento sin respuesta: pasó a coordinación (${coordinacion().nombre})`
      : `${AVISO[tipo]}: ${id}${c.proximo ? `. Próximo paso: ${cuandoTexto(c.proximo.fecha).largo}` : ""}`);
    pintarTodo();
  }

  /* ================================================================== mensajes por WhatsApp
     El enlace wa.me abre WhatsApp (web o en el celular) con el texto listo; si no hay número, deja elegir el
     contacto. [SUPUESTO] La base de la UPV no trae nombres ni celulares: en el prototipo se escriben a mano; en una
     institución vendrían del registro académico. */
  const leerFirma = () => { try { return localStorage.getItem(CLAVE_FIRMA) || ""; } catch (e) { return ""; } };
  const guardarFirma = (v) => { try { localStorage.setItem(CLAVE_FIRMA, v); } catch (e) { /* sin almacenamiento */ } };

  function plantillaSugerida(id) {
    const c = caso(id), u = ultimo(id);
    if (c.proximo && c.proximo.que === "Cita presencial") return "recordatorio";
    if (!u) return "primer";
    if (u.tipo === "sin_respuesta") return "sin_respuesta";
    if (u.tipo === "remision") return "remision";
    return "cita";
  }

  function textoMensaje(clave, { nombre = "", firma = "", id }) {
    const c = caso(id), rem = [...c.historial].reverse().find((h) => h.tipo === "remision");
    const fechaCita = c.proximo ? aFecha(c.proximo.fecha).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }) : "[día y hora]";
    return PLANTILLAS[clave][1].replace("{nombre}", nombre.trim() ? ` ${nombre.trim()}` : "")
      .replace("{firma}", firma.trim() || "[su nombre]").replace("{fecha}", fechaCita)
      .replace("{destino}", rem ? rem.destino.toLowerCase() : "el servicio al que te remitimos");
  }

  /* Colombia: un celular de 10 dígitos que empieza por 3 lleva el indicativo 57. */
  function enlaceWhatsApp(celular, texto) {
    let n = (celular || "").replace(/\D/g, "");
    if (n.length === 10 && n.startsWith("3")) n = `57${n}`;
    return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
  }

  function bloqueMensaje(e) {
    const abierto = B.mensaje && B.mensaje.id === e.id;
    const sugerida = plantillaSugerida(e.id);
    return `<details class="det-mensaje"${abierto ? " open" : ""}><summary>Escribirle por WhatsApp</summary>
      <div class="det-mensaje-cuerpo">
        <label>Mensaje<select id="msj-plantilla">${Object.entries(PLANTILLAS).map(([k, [t]]) =>
          `<option value="${k}"${k === (abierto ? B.mensaje.plantilla : sugerida) ? " selected" : ""}>${t}</option>`).join("")}</select></label>
        <div class="det-mensaje-datos">
          <label>Nombre del estudiante<input id="msj-nombre" autocomplete="off" placeholder="Opcional"></label>
          <label>Celular<input id="msj-celular" inputmode="tel" autocomplete="off" placeholder="Opcional, ej. 3001234567"></label>
          <label>Firma<input id="msj-firma" autocomplete="name" placeholder="Su nombre"></label>
        </div>
        <label class="app-oculto" for="msj-texto">Texto del mensaje</label>
        <textarea id="msj-texto" rows="5"></textarea>
        <p class="det-nota-sistema">El mensaje no menciona riesgo ni deserción: invita a conversar.</p>
        <div class="det-secundarias">
          <a class="boton-sec boton-wa" id="msj-abrir" href="#" target="_blank" rel="noopener">Abrir en WhatsApp</a>
          <button type="button" class="boton-sec" id="msj-copiar">Copiar</button>
          <button type="button" class="boton-sec" id="msj-enviado">Registrar que lo envié</button>
        </div>
      </div></details>`;
  }

  /* Rellena el redactor con lo que ya se había escrito (se conserva al volver a dibujar el panel). */
  function llenarMensaje(e) {
    const m = B.mensaje;
    if (!m || m.id !== e.id || !$("#msj-texto")) return;
    $("#msj-nombre").value = m.nombre; $("#msj-celular").value = m.celular; $("#msj-firma").value = m.firma;
    $("#msj-texto").value = m.texto;
    $("#msj-abrir").href = enlaceWhatsApp(m.celular, m.texto);
  }

  /* Cambió algo del redactor: la plantilla, el nombre o la firma rehacen el texto; el celular solo cambia el enlace. */
  function actualizarMensaje(origen) {
    const m = B.mensaje;
    m.plantilla = $("#msj-plantilla").value; m.nombre = $("#msj-nombre").value; m.celular = $("#msj-celular").value; m.firma = $("#msj-firma").value;
    if (origen === "texto") m.texto = $("#msj-texto").value;
    else if (origen !== "celular") { m.texto = textoMensaje(m.plantilla, { nombre: m.nombre, firma: m.firma, id: m.id }); $("#msj-texto").value = m.texto; }
    if (origen === "firma") guardarFirma(m.firma);
    $("#msj-abrir").href = enlaceWhatsApp(m.celular, m.texto);
  }

  function abrirMensaje(e) {
    if (B.mensaje && B.mensaje.id === e.id) return;
    /* Firma: la persona a cargo del caso; si no tiene, la que se guardó en este navegador. */
    const quien = plan(e) && persona(plan(e).asignada);
    const plantilla = plantillaSugerida(e.id), firma = quien ? quien.nombre : leerFirma();
    B.mensaje = { id: e.id, plantilla, nombre: "", celular: "", firma, texto: textoMensaje(plantilla, { firma, id: e.id }) };
    llenarMensaje(e);
  }

  /* Enviar un mensaje no cambia el estado del caso, pero queda en el historial y, si no hay un próximo paso,
     programa «Revisar si respondió» a los 2 días. */
  function registrarMensaje(id, plantilla) {
    const c = caso(id);
    const entrada = { tipo: "mensaje", fecha: new Date().toISOString(), nota: "", plantilla: PLANTILLAS[plantilla][0] };
    const programa = !c.proximo;
    if (programa) { c.proximo = { fecha: sumarDias(DIAS_REINTENTO), que: "Revisar si respondió" }; entrada.proximo = c.proximo; }
    c.historial.push(entrada);
    if (programa) lineaSistema(c, `El sistema programó «Revisar si respondió» para dentro de ${DIAS_REINTENTO} días`);
    if (c.estado === "por_contactar" && !B.prioridad.has(id)) c.estado = "seguimiento";
    B.reg.casos[id] = c;
  }

  /* ------------------------------------------------------------------ campaña: invitar a los pendientes de la semana
     Como las «campañas de citas» de EAB Navigate: un mismo mensaje para todos, y un botón por estudiante que abre
     WhatsApp con el texto listo. Al final se registran como enviados los que se abrieron. */
  const pendientesSemana = () => B.reg.semana.ids.filter((id) => !ultimo(id)).map((id) => B.porId.get(id)).filter((e) => e && deLaPersona(e));

  function abrirCampana() {
    const firma = leerFirma();
    B.elegido = null; B.mensaje = null;
    B.campana = { texto: textoMensaje("cita", { firma, id: "" }), abiertos: new Set() };
    pintarTabla(); pintarDetalle();
    $("#ap-detalle").focus({ preventScroll: true });
  }

  function pintarCampana() {
    const lista = pendientesSemana(), n = B.campana.abiertos.size;
    $("#ap-detalle").innerHTML = `
      <div class="det-cabeza"><div><h2>Invitar a los pendientes</h2><p>${lista.length} estudiantes de esta semana sin contactar</p></div>
        <button type="button" class="det-cerrar" id="det-cerrar" aria-label="Cerrar el panel">✕</button></div>
      <section class="det-bloque"><h3>Mensaje para todos</h3>
        <label class="app-oculto" for="cmp-texto">Texto del mensaje</label>
        <textarea id="cmp-texto" class="cmp-texto" rows="6">${esc(B.campana.texto)}</textarea>
        <p class="det-nota-sistema">Cambie [día y hora] por la fecha que ofrece. Sin el celular en la base, WhatsApp le pedirá elegir el contacto.</p></section>
      <section class="det-bloque"><h3>Uno por uno</h3>
        <ol class="cmp-lista">${lista.map((e) => `<li class="${B.campana.abiertos.has(e.id) ? "cmp-hecho" : ""}">
          <div><b>${esc(e.id)}</b><span>${esc(motivoDe(e))}</span></div>
          <a class="boton-sec boton-wa" data-cmp="${esc(e.id)}" href="${enlaceWhatsApp("", B.campana.texto)}" target="_blank" rel="noopener">${B.campana.abiertos.has(e.id) ? "Abierto ✓" : "Abrir WhatsApp"}</a></li>`).join("")}</ol></section>
      <section class="det-registrar">
        <button type="button" class="det-principal" id="cmp-registrar"${n ? "" : " disabled"}>Registrar como enviados (${n})</button>
        <p class="det-nota-sistema">Solo se registran los que abrió. A cada uno se le programa «Revisar si respondió» en 2 días.</p>
      </section>`;
  }

  function pintarEnlacesCampana() {
    document.querySelectorAll("[data-cmp]").forEach((a) => { a.href = enlaceWhatsApp("", B.campana.texto); });
  }

  function campanaClic(ev) {
    if (!B.campana) return false;
    const enlace = ev.target.closest("[data-cmp]");
    if (enlace) {
      B.campana.abiertos.add(enlace.dataset.cmp);
      setTimeout(pintarCampana, 0);  // después de que el navegador siga el enlace
      return true;
    }
    if (ev.target.closest("#cmp-registrar")) {
      const ids = [...B.campana.abiertos];
      ids.forEach((id) => registrarMensaje(id, "cita"));
      guardarRegistro();
      B.campana = null;
      avisar(`${ids.length} mensajes registrados`);
      pintarTodo();
      return true;
    }
    return false;
  }

  /* Solo se pregunta cuando ya hubo una conversación (contacto o remisión): antes no hay cómo saberlo. */
  function bloqueVeredicto(e) {
    const c = caso(e.id);
    if (!c.historial.some((h) => h.tipo === "contacto" || h.tipo === "remision")) return "";
    const alto = e.nivel === "alto", v = c.veredicto || {};
    const opciones = (alto ? VEREDICTOS_ALTO : VEREDICTOS_OTRO).map(([valor, texto]) =>
      `<button type="button" class="det-chip" data-veredicto="${valor}" aria-pressed="${v.valor === valor}">${texto}</button>`).join("");
    const fallo = alto && (v.valor === "parte" || v.valor === "no") ? `<label class="det-fallo">¿Qué no cuadró?
        <select id="det-fallo"><option value="">Elija una opción</option>${FALLOS.map((f) => `<option${f === v.motivo ? " selected" : ""}>${f}</option>`).join("")}</select></label>` : "";
    const pregunta = alto ? "Después de hablar con el estudiante, ¿la alerta tenía sentido?"
      : "El modelo no lo marcó en riesgo alto. Después de hablar con él, ¿necesitaba apoyo?";
    return `<section class="det-bloque det-veredicto"><h3>¿Acertó el sistema?</h3><p class="det-nota-sistema">${pregunta}</p>
      <div class="det-chips" role="group" aria-label="¿Acertó el sistema?">${opciones}</div>${fallo}
      ${v.valor ? `<p class="det-nota-sistema">Queda en el informe para revisar el modelo.</p>` : ""}</section>`;
  }

  function fijarVeredicto(valor, motivo) {
    const c = caso(B.elegido);
    const anterior = c.veredicto || {};
    c.veredicto = { valor, motivo: valor === "si" ? "" : (motivo ?? (anterior.valor === valor ? anterior.motivo : "")), fecha: new Date().toISOString() };
    B.reg.casos[B.elegido] = c;
    guardarRegistro();
    if (motivo === undefined) avisar("Respuesta guardada");
    pintarDetalle();
  }

  function quitarProximo() {
    const c = caso(B.elegido);
    delete c.proximo;
    B.reg.casos[B.elegido] = c;
    guardarRegistro();
    avisar("Próximo paso quitado");
    pintarTodo();
  }

  /* ================================================================== informe para la dirección
     Una sola serie por gráfica (barras de un solo color, la tinta azul), con el valor escrito al lado: no hace
     falta leyenda ni distinguir colores. El título de cada gráfica dice qué se cuenta. */
  function contar(casos) {
    const n = { conIntento: 0, contactados: 0, remitidos: 0, cerrados: 0, atrasados: 0, destinos: {}, cierres: {}, semanas: {} };
    casos.forEach(([id, c]) => {
      const tipos = new Set(humanos(c).map((h) => h.tipo));
      if (humanos(c).length) n.conIntento++;
      if (tipos.has("contacto") || tipos.has("remision")) n.contactados++;
      if (tipos.has("remision")) n.remitidos++;
      if (c.estado === "cerrado") n.cerrados++;
      if (c.proximo && c.estado !== "cerrado" && diasHasta(c.proximo.fecha) < 0) n.atrasados++;
      humanos(c).forEach((h) => {
        if (h.tipo === "remision") n.destinos[h.destino] = (n.destinos[h.destino] || 0) + 1;
        if (h.tipo === "cierre") n.cierres[h.motivo] = (n.cierres[h.motivo] || 0) + 1;
        const semanas = Math.floor((aFecha(hoy()) - aFecha(dia(new Date(h.fecha)))) / (7 * 864e5));
        n.semanas[semanas] = (n.semanas[semanas] || 0) + 1;
      });
    });
    return n;
  }

  /* Barras horizontales: etiqueta, barra proporcional y valor. El globo nativo (title) repite el dato al pasar el cursor. */
  function barras(filas, total) {
    const max = Math.max(1, ...filas.map(([, v]) => v));
    return `<div class="inf-barras">${filas.map(([t, v, extra]) => {
      const pct = total ? ` (${Math.round((100 * v) / total)} %)` : "";
      return `<div class="inf-fila" title="${esc(t)}: ${v}${pct}"><span class="inf-rotulo">${esc(t)}</span>
        <span class="inf-pista"><i style="width:${(100 * v) / max}%"></i></span><b>${v}${extra ? `<small>${extra}</small>` : ""}</b></div>`;
    }).join("")}</div>`;
  }

  /* Barras de parte y total: el total en tono claro y, dentro, la parte hecha («12 de 55 contactados»). */
  function barrasParte(filas, leyenda) {
    const max = Math.max(1, ...filas.map(([, t]) => t));
    return `<p class="inf-leyenda" aria-hidden="true"><span><i class="inf-l-parte"></i>${esc(leyenda[0])}</span><span><i class="inf-l-total"></i>${esc(leyenda[1])}</span></p>
      <div class="inf-barras">${filas.map(([t, total, parte]) => `<div class="inf-fila inf-fila-parte" title="${esc(t)}: ${parte} de ${total} ${esc(leyenda[0].toLowerCase())}">
        <span class="inf-rotulo">${esc(t)}</span>
        <span class="inf-pista"><i class="inf-total" style="width:${(100 * total) / max}%"><i class="inf-parte" style="width:${total ? (100 * parte) / total : 0}%"></i></i></span>
        <b>${parte}<small> de ${total}</small></b></div>`).join("")}</div>`;
  }

  function columnasSemanas(semanas) {
    const filas = [5, 4, 3, 2, 1, 0].map((s) => [s === 0 ? "Esta semana" : s === 1 ? "Semana pasada" : `Hace ${s} semanas`, semanas[s] || 0]);
    const max = Math.max(1, ...filas.map(([, v]) => v));
    return `<div class="inf-columnas">${filas.map(([t, v]) => `<div class="inf-col" title="${esc(t)}: ${v} registros">
      <b>${v}</b><span class="inf-col-pista"><i style="height:${(100 * v) / max}%"></i></span><span>${esc(t)}</span></div>`).join("")}</div>`;
  }

  function pintarInforme() {
    const zona = $("#ap-informe");
    const todosCasos = Object.entries(B.reg.casos).filter(([id, c]) => humanos(c).length && B.porId.has(id));
    const casos = todosCasos.filter(([id]) => deLaPersona(B.porId.get(id)));
    if (!todosCasos.length) {
      zona.innerHTML = `<div class="inf-vacio"><h2>Todavía no hay nada que informar</h2>
        <p>El informe se arma solo con lo que registre en los casos: contactos, remisiones y cierres. Para ver cómo
          luce, puede llenarlo con un ejemplo de 70 casos simulados de las últimas semanas.</p>
        <button type="button" class="det-principal" data-ejemplo>Llenar con un ejemplo</button></div>`;
      $("#ap-acciones-informe").hidden = true;
      return;
    }
    const n = contar(casos), alto = B.alto.filter(deLaPersona).length;
    const sigue = n.cierres["Sigue estudiando"] || 0;
    const pct = (v, t) => (t ? `${Math.round((100 * v) / t)} %` : "—");
    const desde = todosCasos.flatMap(([, c]) => humanos(c).map((h) => h.fecha)).sort()[0];
    /* Lo nuevo: casos por persona y por ruta (de todo el equipo, para comparar), con cuántos se contactaron. */
    const registrados = new Map(todosCasos);
    const contactado = (id) => { const c = registrados.get(id); return Boolean(c && humanos(c).some((h) => h.tipo === "contacto" || h.tipo === "remision")); };
    const porPersona = equipo().map((p) => {
      const suyos = B.alto.filter((e) => (plan(e) || {}).asignada === p.id);
      return [p.nombre, suyos.length, suyos.filter((e) => contactado(e.id)).length];
    });
    const escalados = B.todos.filter((e) => escalado(e.id)).length;
    /* Remitidos a la ruta que sugirió el sistema (de todo el equipo). */
    const rutas = {}, remitidos = {};
    B.alto.forEach((e) => {
      const r = (plan(e) || {}).ruta, c = registrados.get(e.id);
      if (!r) return;
      rutas[r] = (rutas[r] || 0) + 1;
      if (c && humanos(c).some((h) => h.tipo === "remision" && h.destino === r)) remitidos[r] = (remitidos[r] || 0) + 1;
    });
    const porRuta = Object.entries(rutas).sort((a, b) => b[1] - a[1]).map(([r, v]) => [r, v, remitidos[r] || 0]);
    const tarjetasEquipo = equipo().length ? `
        <section class="inf-tarjeta"><h2>Casos por persona</h2><p class="inf-nota">Casos de riesgo alto que el sistema asignó a cada una, y cuántos ya contactó. Todo el equipo.</p>
          ${barrasParte(porPersona, ["Contactados", "Asignados"])}
          <p class="inf-nota">${escalados ? `<b>${escalados}</b> ${escalados === 1 ? "caso escalado" : "casos escalados"} a coordinación (${esc(coordinacion().nombre)}).` : `Ningún caso escalado a coordinación (${esc(coordinacion().nombre)}).`}</p></section>
        <section class="inf-tarjeta"><h2>Casos por ruta de apoyo</h2><p class="inf-nota">A qué servicio sugiere llevar el sistema cada caso de riesgo alto, y cuántos se remitieron a esa ruta.</p>
          ${barrasParte(porRuta, ["Remitidos a esa ruta", "Sugeridos"])}</section>` : "";
    const ordenar = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
    /* ¿Acertó el sistema? Solo casos con respuesta de la consejera. */
    const revisados = casos.map(([id, c]) => [B.porId.get(id), c.veredicto]).filter(([, v]) => v && v.valor);
    const revAlto = revisados.filter(([e]) => e.nivel === "alto");
    const cuantos = (val) => revAlto.filter(([, v]) => v.valor === val).length;
    const fallos = {};
    revAlto.filter(([, v]) => v.valor !== "si" && v.motivo).forEach(([, v]) => { fallos[v.motivo] = (fallos[v.motivo] || 0) + 1; });
    const noVistos = revisados.filter(([e, v]) => e.nivel !== "alto" && v.valor === "si").length;
    const tarjetaAcierto = `<section class="inf-tarjeta inf-ancha"><h2>¿Acertó el sistema?</h2>
      <p class="inf-nota">Lo que anotaron las consejeras después de hablar con cada estudiante. No es una métrica del modelo: es la mirada de quien lo atendió.</p>
      <div class="inf-dos">
        <div>${revAlto.length ? `<p class="inf-sub">Alertas de riesgo alto revisadas: ${revAlto.length}</p>`
          + barras([["Sí, necesitaba apoyo", cuantos("si")], ["En parte", cuantos("parte")], ["No, estaba bien", cuantos("no")]], revAlto.length)
          : `<p class="det-sin">Aún no hay respuestas. Se responden en cada caso, después de hablar con el estudiante.</p>`}</div>
        <div>${Object.keys(fallos).length ? `<p class="inf-sub">Qué no cuadró</p>${barras(ordenar(fallos))}` : ""}
          <p class="inf-no-vistos"><b>${noVistos}</b> ${noVistos === 1 ? "estudiante que el modelo no marcó en alto sí necesitaba" : "estudiantes que el modelo no marcó en alto sí necesitaban"} apoyo.
            <span>Llegaron por un aviso de profesor o porque la consejera los buscó. Son los casos que el modelo debe aprender a ver.</span></p></div>
      </div></section>`;
    zona.innerHTML = `
      ${B.reg.ejemploIds ? `<p class="inf-ejemplo">Está viendo <strong>datos de ejemplo</strong>: casos simulados para mostrar el informe, no contactos reales.
        <button type="button" class="app-enlace" data-borrar-ejemplo>Borrar el ejemplo</button></p>` : ""}
      <p class="inf-periodo">Desde el ${new Date(desde).toLocaleDateString("es-CO", { day: "numeric", month: "long" })} hasta hoy${B.persona ? `. Cifras de ${esc(nombrePersona())}; las gráficas por persona y por ruta son de todo el equipo` : ""}.</p>
      <div class="inf-cifras">
        <div class="inf-cifra"><b>${n.contactados}</b><span>estudiantes contactados</span><small>${pct(n.contactados, alto)} de los ${alto} en riesgo alto</small></div>
        <div class="inf-cifra"><b>${n.remitidos}</b><span>remitidos a otro servicio</span><small>${pct(n.remitidos, n.contactados)} de los contactados</small></div>
        <div class="inf-cifra"><b>${n.cerrados}</b><span>casos cerrados</span><small>${sigue} siguen estudiando</small></div>
        <div class="inf-cifra${n.atrasados ? " inf-alerta" : ""}"><b>${n.atrasados}</b><span>seguimientos atrasados</span><small>${n.atrasados ? "Revise la vista «Hoy»" : "Todo al día"}</small></div>
      </div>
      ${n.cerrados ? `<p class="inf-titular">De los <strong>${n.cerrados}</strong> casos cerrados, <strong>${sigue}</strong> (${pct(sigue, n.cerrados)}) siguen estudiando.</p>` : ""}
      <div class="inf-rejilla">
        <section class="inf-tarjeta"><h2>Del aviso al cierre</h2><p class="inf-nota">Estudiantes en cada paso. Cada paso cuenta a quienes llegaron a él.</p>
          ${barras([["En riesgo alto", alto], ["Con algún intento de contacto", n.conIntento], ["Contactados", n.contactados], ["Remitidos", n.remitidos], ["Casos cerrados", n.cerrados]], alto)}</section>
        <section class="inf-tarjeta"><h2>Cómo se cerraron los casos</h2><p class="inf-nota">El dato que justifica el programa: quién siguió estudiando.</p>
          ${n.cerrados ? barras(ordenar(n.cierres), n.cerrados) : `<p class="det-sin">Aún no hay casos cerrados.</p>`}</section>
        <section class="inf-tarjeta"><h2>A dónde se remitió</h2><p class="inf-nota">Remisiones por servicio.</p>
          ${n.remitidos ? barras(ordenar(n.destinos), Object.values(n.destinos).reduce((a, b) => a + b, 0)) : `<p class="det-sin">Aún no hay remisiones.</p>`}</section>
        <section class="inf-tarjeta"><h2>Actividad por semana</h2><p class="inf-nota">Registros hechos (contactos, intentos, remisiones y cierres).</p>
          ${columnasSemanas(n.semanas)}</section>
        ${tarjetasEquipo}
        ${tarjetaAcierto}
      </div>
      <p class="inf-nota">Prototipo: las cifras salen de lo registrado en este navegador. El riesgo viene del modelo con la base
        real de la UPV; «siguen estudiando» es lo que la consejera anotó al cerrar el caso, no un dato del registro académico.</p>`;
  }

  /* ================================================================== equipo: la carga de cada persona esta semana
     Una barra por persona, partida en contactados, con intento y pendientes. Tocar una tarjeta filtra la bandeja. */
  function pintarEquipo() {
    const zona = $("#ap-equipo"), gente = equipo();
    if (!gente.length) { zona.innerHTML = `<p class="det-sin">Esta copia de los datos no trae el equipo. Recargue cuando haya conexión.</p>`; return; }
    const ids = B.reg.semana.ids.map((id) => B.porId.get(id)).filter(Boolean);
    const carga = gente.map((p) => {
      const suyos = ids.filter((e) => (plan(e) || {}).asignada === p.id);
      const h = (e) => humanos(caso(e.id));
      const contactados = suyos.filter((e) => h(e).some((x) => x.tipo === "contacto" || x.tipo === "remision")).length;
      const pendientes = suyos.filter((e) => !h(e).length).length;
      const cartera = B.alto.filter((e) => (plan(e) || {}).asignada === p.id).length;
      return { p, n: suyos.length, contactados, intento: suyos.length - contactados - pendientes, pendientes, cartera };
    });
    const max = Math.max(1, ...carga.map((c) => c.n));
    const co = coordinacion(), escalados = B.todos.filter((e) => escalado(e.id));
    const seg = (v, clase) => (v ? `<i class="${clase}" style="width:${(100 * v) / max}%"></i>` : "");
    zona.innerHTML = `
      <p class="eq-leyenda" aria-hidden="true"><span><i class="eq-hecho"></i>Contactados</span><span><i class="eq-intento"></i>Con algún intento</span><span><i class="eq-pend"></i>Pendientes</span></p>
      <div class="eq-rejilla">${carga.map((c) => `
        <button type="button" class="eq-tarjeta" data-ver-persona="${esc(c.p.id)}" aria-pressed="${B.persona === c.p.id}">
          <span class="eq-cabeza">${avatar(c.p)}<span><b>${esc(c.p.nombre)}</b><small>${esc(c.p.rol)} · ${esc((c.p.rutas || []).join(", ").toLowerCase())}</small></span></span>
          <span class="eq-barra" role="img" aria-label="${c.contactados} contactados, ${c.intento} con algún intento y ${c.pendientes} pendientes de ${c.n}">${seg(c.contactados, "eq-hecho")}${seg(c.intento, "eq-intento")}${seg(c.pendientes, "eq-pend")}</span>
          <span class="eq-cifras"><span><b>${c.n}</b> esta semana</span><span><b>${c.pendientes}</b> pendientes</span><span><b>${c.contactados}</b> contactados</span></span>
          <span class="eq-total">${c.cartera} casos de riesgo alto en su cartera</span>
        </button>`).join("")}
        <button type="button" class="eq-tarjeta eq-coord" data-ver-persona="coordinacion" aria-pressed="${B.persona === "coordinacion"}">
          <span class="eq-cabeza"><i class="avatar av-coordinacion" aria-hidden="true">${esc(iniciales(co.nombre))}</i><span><b>${esc(co.nombre)}</b><small>${esc(co.rol || "Coordinación")}</small></span></span>
          <span class="eq-cifras"><span><b>${escalados.length}</b> ${escalados.length === 1 ? "caso escalado" : "casos escalados"}</span></span>
          <span class="eq-total">${esc(co.tarea || "Recibe los casos que no responden a dos intentos.")}</span>
        </button>
      </div>
      <p class="inf-nota">El sistema asigna cada caso a quien atiende su ruta de apoyo; si esa persona ya lleva mucha más carga que otra, el caso pasa a quien tiene menos. Toque una tarjeta para ver solo sus casos.</p>`;
  }

  /* ------------------------------------------------------------------ descargar casos para Excel */
  function descargarCsv() {
    const celda = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const cab = ["Código", "Titulación", "Nivel", "Provisional", "A cargo", "Ruta sugerida", "Escalado a coordinación", "Estado", "Última acción", "Fecha última acción", "Nota última acción",
      "Próximo paso", "Fecha próximo paso", "Contactos", "Intentos sin respuesta", "Remisiones", "Motivo de cierre", "Avisos de profesores", "¿Acertó el sistema?", "Qué no cuadró"];
    const filas = Object.entries(B.reg.casos).filter(([id, c]) => humanos(c).length && B.porId.has(id) && deLaPersona(B.porId.get(id))).map(([id, c]) => {
      const e = B.porId.get(id), u = humanos(c).at(-1), cuenta = (t) => c.historial.filter((h) => h.tipo === t).length;
      const p = plan(e) || {};
      return [id, e.titulacion, e.nivel || "devuelto", e.decision === "provisional" ? "sí" : "no",
        (persona(p.asignada) || {}).nombre || "", p.ruta || "", escalado(id) ? "sí" : "no",
        c.estado === "cerrado" ? "cerrado" : c.estado === "seguimiento" ? "en seguimiento" : "por contactar",
        ESTADO[u.tipo], dia(new Date(u.fecha)), u.nota, c.proximo ? c.proximo.que : "", c.proximo ? c.proximo.fecha : "",
        cuenta("contacto"), cuenta("sin_respuesta"), c.historial.filter((h) => h.tipo === "remision").map((h) => h.destino).join(", "),
        (c.historial.find((h) => h.tipo === "cierre") || {}).motivo || "", avisosDe(id).length,
        { si: "sí", parte: "en parte", no: "no" }[(c.veredicto || {}).valor] || "", (c.veredicto || {}).motivo || ""];
    });
    /* Punto y coma y BOM: así lo abre bien Excel en español (la coma es el separador decimal). */
    const texto = "﻿" + [cab, ...filas].map((f) => f.map(celda).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
    a.download = `casos-bienestar-${hoy()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    avisar(`Descargados ${filas.length} casos`);
  }

  /* ------------------------------------------------------------------ ejemplo para presentar
     Llena casos simulados (con semilla fija) en estudiantes de riesgo alto que no están en la lista de esta semana,
     con fechas de las últimas cuatro semanas. Se marcan como ejemplo y se pueden borrar sin tocar lo demás. */
  function llenarEjemplo() {
    let semilla = 2026;
    const azar = () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296; };
    const elegir = (pares) => { let r = azar(), acum = 0; for (const [v, p] of pares) { acum += p; if (r < acum) return v; } return pares.at(-1)[0]; };
    const enFecha = (diasAtras) => { const d = new Date(); d.setDate(d.getDate() - diasAtras); d.setHours(8 + Math.floor(azar() * 9), Math.floor(azar() * 60)); return d.toISOString(); };
    const NOTAS = ["Dice que trabaja por las tardes y no alcanza a llegar.", "Acordamos una cita la próxima semana.", "Tiene dificultades para pagar la matrícula.",
      "Se siente perdido en las asignaturas de primer año.", "Está pensando en cambiarse de programa.", ""];
    const semana = new Set(B.reg.semana.ids), ids = [];
    B.alto.filter((e) => !semana.has(e.id) && !B.reg.casos[e.id]).slice(0, 70).forEach((e) => {
      const historial = [], c = { estado: "seguimiento", historial };
      let atras = 3 + Math.floor(azar() * 25);
      const nota = () => NOTAS[Math.floor(azar() * NOTAS.length)];
      if (azar() < 0.18) {  // no se ha podido contactar
        historial.push({ tipo: "sin_respuesta", fecha: enFecha(atras), nota: "" });
        c.estado = "por_contactar";
        c.proximo = { fecha: sumarDias(-Math.floor(azar() * 4) + 1), que: "Llamar de nuevo" };
        /* Algunos tampoco respondieron al segundo intento: el sistema los escaló a coordinación. */
        if (azar() < 0.45) { historial.push({ tipo: "sin_respuesta", fecha: enFecha(Math.max(0, atras - 2)), nota: "" }); escalarSiToca(c); }
      } else {
        historial.push({ tipo: "contacto", fecha: enFecha(atras), nota: nota() });
        if (azar() < 0.45) { atras = Math.max(0, atras - 1 - Math.floor(azar() * 3));
          historial.push({ tipo: "remision", fecha: enFecha(atras), nota: "", destino: elegir([["Tutoría académica", 0.45], ["Apoyo financiero", 0.3], ["Atención psicológica", 0.17], ["Orientación vocacional", 0.08]]) }); }
        if (atras > 6 && azar() < 0.55) {
          historial.push({ tipo: "cierre", fecha: enFecha(Math.max(0, atras - 5)), nota: "", motivo: elegir([["Sigue estudiando", 0.7], ["Se retiró de la universidad", 0.18], ["No quiso recibir apoyo", 0.12]]) });
          c.estado = "cerrado";
        } else c.proximo = { fecha: sumarDias(Math.floor(azar() * 10) - 2), que: elegir([["Cita presencial", 0.4], ["Llamar de nuevo", 0.3], ["Revisar cómo va la remisión", 0.2], ["Revisar sus notas", 0.1]]) };
      }
      /* Respuesta simulada a «¿Acertó el sistema?» en la mitad de los casos con conversación. */
      if (historial.some((h) => h.tipo === "contacto") && azar() < 0.6) {
        const valor = elegir([["si", 0.65], ["parte", 0.2], ["no", 0.15]]);
        c.veredicto = { valor, motivo: valor === "si" ? "" : elegir([["El motivo real era otro", 0.4], ["Ya recibía apoyo", 0.3], ["Los datos estaban mal o desactualizados", 0.3]]), fecha: historial[0].fecha };
      }
      B.reg.casos[e.id] = c; ids.push(e.id);
    });
    B.reg.ejemploIds = ids;
    /* Avisos de profesores de ejemplo: la mayoría sobre estudiantes de riesgo alto, y dos sobre estudiantes de riesgo
       medio, para mostrar lo que el modelo no ve. */
    const DOCENTES = [["Prof. A. Gómez", "Cálculo I"], ["Prof. L. Martínez", "Física"], ["Prof. C. Ruiz", "Programación"], ["Prof. M. Torres", "Química"]];
    const MOTIVOS_DOC = ["No viene a clase", "Va perdiendo la asignatura", "No entrega los trabajos", "Lo noto con problemas personales o de ánimo", "Tiene problemas económicos"];
    const COMENTARIOS = ["Faltó a las últimas tres clases.", "Perdió el primer parcial y no vino a la revisión.", "Se le ve muy cansado; dice que trabaja de noche.", ""];
    const destinatarios = [...B.alto.filter((e) => !semana.has(e.id) && !ids.includes(e.id)).slice(0, 4),
      ...B.todos.filter((e) => e.nivel === "medio").slice(0, 2)];
    destinatarios.forEach((e, i) => {
      const [docente, asignatura] = DOCENTES[i % DOCENTES.length];
      const motivos = MOTIVOS_DOC.filter(() => azar() < 0.35);
      B.avisos.push({ id: `ejemplo-${i}`, fecha: enFecha(i < 3 ? 0 : 1 + i), codigo: e.id, docente, asignatura, motivos: motivos.length ? motivos : [MOTIVOS_DOC[i % 5]],
        comentario: COMENTARIOS[i % COMENTARIOS.length], leido: false, ejemplo: true });
      /* El primero de riesgo medio ya fue atendido: la consejera confirmó que sí necesitaba apoyo (lo que el modelo no vio). */
      if (e.nivel === "medio" && !B.reg.casos[e.id] && i === destinatarios.length - 2) {
        const f = enFecha(0);
        B.reg.casos[e.id] = { estado: "seguimiento", historial: [{ tipo: "contacto", fecha: f, nota: "Confirmó que está pensando en retirarse." }],
          veredicto: { valor: "si", motivo: "", fecha: f } };
        ids.push(e.id);
      }
    });
    procesarAvisos();  // los avisos de ejemplo pasan por la misma automatización que los reales
    guardarAvisos();
    guardarRegistro();
    avisar(`Ejemplo cargado: ${ids.length} casos simulados`);
    pintarTodo();
  }

  function borrarEjemplo() {
    (B.reg.ejemploIds || []).forEach((id) => { delete B.reg.casos[id]; });
    delete B.reg.ejemploIds;
    const deEjemplo = new Set(B.avisos.filter((a) => a.ejemplo).map((a) => a.id));
    B.reg.avisosVistos = (B.reg.avisosVistos || []).filter((id) => !deEjemplo.has(id));
    B.avisos = B.avisos.filter((a) => !a.ejemplo); guardarAvisos();
    guardarRegistro();
    avisar("Ejemplo borrado");
    pintarTodo();
  }

  function pintarTodo() {
    pintarMenu(); pintarEncabezado();
    if (B.vista === "informe") pintarInforme(); else if (B.vista === "equipo") pintarEquipo(); else pintarTabla();
    pintarDetalle();
  }

  /* ------------------------------------------------------------------ arranque */
  async function cargar() {
    try {
      if (/[?&]copia\b/.test(location.search)) throw new Error("se pidió la copia guardada");
      const d = await json("api/estudiantes?modelo=logistica");
      if (d.error) throw new Error(d.detalle || d.error);
      B.datos = d;
    } catch (e1) {
      try { B.datos = await json("reportes/real/estudiantes.json"); B.deCopia = true; }
      catch (e2) { $("#ap-subtitulo").textContent = "No se pudo leer la base de datos. Revise la conexión y recargue la página."; return false; }
    }
    return true;
  }

  function ordenar(d) {
    /* Prioridad del riesgo alto. Los provisionales salen de otro modelo (el de ingreso) y su puntaje no es comparable:
       con la base real, su probabilidad mediana en alto es 0,68 pero abandona el 30 %, frente a 0,17 y 27 % en los
       definitivos. [SUPUESTO] Cada grupo se ordena por su propio puntaje y se intercalan por percentil. */
    const altos = d.estudiantes.filter((e) => e.nivel === "alto"), rango = new Map();
    ["resultado", "provisional"].forEach((dec) => {
      const g = altos.filter((e) => e.decision === dec).sort((a, b) => b.puntaje - a.puntaje);
      g.forEach((e, i) => rango.set(e.id, (i + 0.5) / g.length));
    });
    B.alto = altos.sort((a, b) => rango.get(a.id) - rango.get(b.id) || b.puntaje - a.puntaje);
    B.alto.forEach((e, i) => B.prioridad.set(e.id, i + 1));
    /* Todos: alto en su orden de prioridad, luego medio y bajo por puntaje, y al final los devueltos. */
    const resto = d.estudiantes.filter((e) => e.nivel !== "alto")
      .sort((a, b) => (ORDEN_NIVEL[a.nivel] ?? 3) - (ORDEN_NIVEL[b.nivel] ?? 3) || (b.puntaje ?? -1) - (a.puntaje ?? -1));
    B.todos = [...B.alto, ...resto];
    B.todos.forEach((e) => B.porId.set(e.id, e));
  }

  function elegir(id) {
    B.elegido = id; B.abierto = null; B.mensaje = null; B.campana = null;
    const nota = $("#det-nota"); if (nota) nota.value = "";
    /* Abrir el caso cuenta como leer sus avisos. */
    if (sinLeer(id)) { B.avisos.forEach((a) => { if (a.codigo === id) a.leido = true; }); guardarAvisos(); pintarMenu(); }
    pintarTabla(); pintarDetalle();
    $("#ap-detalle").focus({ preventScroll: true });
  }

  async function iniciar() {
    leerRegistro(); leerAvisos();
    if (!(await cargar())) return;
    const d = B.datos, ej = d.ejecucion || {};
    ordenar(d);
    if (!semanaValida()) armarSemana();
    procesarAvisos();  // avisos de profesores que llegaron mientras la bandeja estaba cerrada
    /* «Ver casos de»: lo elegido la última vez, si esa persona sigue en el equipo. */
    const guardada = leerPersona();
    B.persona = guardada === "coordinacion" || persona(guardada) ? guardada : "";
    if (equipo().length) {
      $("#ap-persona").insertAdjacentHTML("beforeend", equipo().map((p) => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join("")
        + `<option value="coordinacion">${esc(coordinacion().nombre)} (coordinación)</option>`);
    } else document.querySelector(".app-persona").hidden = true;
    $("#ap-explica-texto").textContent = `${d.explicacion_titulacion || "La UPV publica la carrera de cada estudiante anonimizada: «T04» es un código, no el nombre de la carrera."} Pase el puntero sobre la titulación de un estudiante para ver la ficha de su código.`;
    const mios = B.todos.filter(deLaPersona);
    if (mios.some((e) => vencido(e.id))) B.vista = "agenda";  // si hay algo para hoy, se abre en «Hoy»
    else if (B.avisos.some((a) => !a.leido && B.porId.has(a.codigo) && deLaPersona(B.porId.get(a.codigo)))) B.vista = "avisos";  // si no, los avisos nuevos
    /* Un aviso enviado desde el portal docente (otra pestaña del mismo navegador) llega al instante y sube la prioridad. */
    window.addEventListener("storage", (ev) => {
      if (ev.key !== CLAVE_AVISOS) return;
      const antes = B.avisos.length;
      leerAvisos(); procesarAvisos();
      pintarTodo();
      if (B.avisos.length > antes) { const a = B.avisos.at(-1); avisar(`Nuevo aviso de ${a.docente} sobre ${a.codigo}: el sistema subió su prioridad`); }
    });
    $("#ap-lectura").textContent = B.deCopia ? "Sin conexión: copia de la última lectura"
      : `Lectura automática diaria, ${window.SAT.lecturaProgramada().texto}: ${miles(ej.leidos || d.estudiantes.length)} registros`;
    const n = (f) => d.estudiantes.filter(f).length;
    const devueltos = n((e) => !e.nivel);
    $("#ap-alcance").textContent = `A la lista de trabajo llega solo el riesgo alto (${miles(B.alto.length)}). Los ${miles(n((e) => e.nivel === "medio"))} de riesgo medio van a tutoría académica`
      + (devueltos ? `, los ${miles(n((e) => e.nivel === "bajo"))} de riesgo bajo siguen su curso y ${miles(devueltos)} ${devueltos === 1 ? "registro con datos imposibles se devolvió" : "registros con datos imposibles se devolvieron"} al registro académico. `
        : ` y los ${miles(n((e) => e.nivel === "bajo"))} de riesgo bajo siguen su curso. `)
      + `Todos se pueden consultar en «Todos los estudiantes».`;
    const programas = [...new Set(B.todos.map((e) => e.titulacion))].sort();
    $("#ap-programa").insertAdjacentHTML("beforeend", programas.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join(""));
    pintarTodo();

    /* «Ver casos de»: filtra todas las vistas y se recuerda en este navegador. */
    const fijarPersona = (v) => {
      B.persona = v; guardarPersona(v);
      B.elegido = null; B.mensaje = null; B.campana = null; B.visibles = PAGINA;
      pintarTodo();
    };
    $("#ap-persona").addEventListener("change", (ev) => {
      fijarPersona(ev.target.value);
      avisar(ev.target.value ? `Viendo los casos de ${nombrePersona()}` : "Viendo los casos de todo el equipo");
    });
    $("#ap-equipo").addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-ver-persona]");
      if (!t) return;
      B.vista = t.dataset.verPersona === "coordinacion" ? "agenda" : "semana";
      fijarPersona(t.dataset.verPersona);
      avisar(`Viendo los casos de ${nombrePersona()}`);
    });

    const filtrar = (cambio) => { Object.assign(B, cambio, { visibles: PAGINA }); pintarTabla(); };
    $("#ap-menu").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-vista]");
      if (!b) return;
      B.vista = b.dataset.vista; B.elegido = null; B.abierto = null; B.visibles = PAGINA; B.mensaje = null; B.campana = null;
      $("#ap-menu").classList.remove("abierto"); $("#ap-boton-menu").setAttribute("aria-expanded", "false");
      pintarTodo();
    });
    $("#ap-boton-menu").addEventListener("click", () => {
      const abierto = $("#ap-menu").classList.toggle("abierto");
      $("#ap-boton-menu").setAttribute("aria-expanded", String(abierto));
    });
    $("#ap-filas").addEventListener("click", (ev) => { const tr = ev.target.closest("tr[data-id]"); if (tr) elegir(tr.dataset.id); });
    $("#ap-buscar").addEventListener("input", (ev) => filtrar({ buscar: ev.target.value }));
    $("#ap-programa").addEventListener("change", (ev) => filtrar({ programa: ev.target.value }));
    $("#ap-nivel").addEventListener("change", (ev) => filtrar({ nivel: ev.target.value }));
    $("#ap-mas").addEventListener("click", () => { B.visibles += PAGINA; pintarTabla(); });
    $("#ap-csv").addEventListener("click", descargarCsv);
    $("#ap-campana").addEventListener("click", abrirCampana);
    $("#ap-imprimir").addEventListener("click", () => window.print());
    $("#ap-informe").addEventListener("click", (ev) => {
      if (ev.target.closest("[data-ejemplo]")) llenarEjemplo();
      if (ev.target.closest("[data-borrar-ejemplo]")) borrarEjemplo();
    });
    document.querySelector(".app-encabezado").addEventListener("click", (ev) => {
      if (ev.target.id !== "ap-nueva") return;
      armarSemana(); B.elegido = null; pintarTodo();
    });
    $("#ap-detalle").addEventListener("click", (ev) => {
      if (ev.target.closest("#det-cerrar")) { B.elegido = null; B.mensaje = null; B.campana = null; pintarTabla(); pintarDetalle(); return; }
      if (ev.target.closest("#msj-copiar")) {
        const texto = B.mensaje.texto;
        (navigator.clipboard ? navigator.clipboard.writeText(texto) : Promise.reject()).then(() => avisar("Mensaje copiado"), () => { $("#msj-texto").select(); avisar("Seleccioné el texto: cópielo con Ctrl+C"); });
        return;
      }
      if (ev.target.closest("#msj-abrir")) { setTimeout(() => avisar("Si lo envió, use «Registrar que lo envié»"), 300); return; }
      /* Paso 1 del plan: un toque abre WhatsApp con el mensaje ya redactado y lo deja registrado. */
      if (ev.target.closest("#plan-wa")) {
        const id = B.elegido;
        setTimeout(() => {  // después de que el navegador siga el enlace
          registrarMensaje(id, "primer"); guardarRegistro();
          avisar(`Mensaje de primer contacto registrado: ${id}`);
          pintarTodo();
        }, 0);
        return;
      }
      if (ev.target.closest("#msj-enviado")) {
        registrarMensaje(B.elegido, B.mensaje.plantilla); guardarRegistro();
        B.mensaje = null;
        avisar(`${AVISO.mensaje}: ${B.elegido}`);
        pintarTodo();
        return;
      }
      if (campanaClic(ev)) return;
      const abre = ev.target.closest("[data-abre]");
      if (abre) {
        B.abierto = B.abierto === abre.dataset.abre ? null : abre.dataset.abre;
        pintarDetalle();
        const sel = B.abierto && $(B.abierto === "remision" ? "#det-destino" : "#det-motivo");
        if (sel) sel.focus();
        return;
      }
      if (ev.target.closest("[data-quitar]")) { quitarProximo(); return; }
      const veredicto = ev.target.closest("[data-veredicto]");
      if (veredicto) { fijarVeredicto(veredicto.dataset.veredicto); return; }
      const accion = ev.target.closest("[data-accion]");
      if (accion) registrar(accion.dataset.accion);
    });
    /* Al elegir cuándo, aparece qué hacer (y el calendario si es «Elegir fecha…»). */
    /* Redactor de WhatsApp: abrir el desplegable lo prepara; escribir actualiza el texto y el enlace. */
    $("#ap-detalle").addEventListener("toggle", (ev) => {
      if (!ev.target.classList || !ev.target.classList.contains("det-mensaje")) return;
      if (ev.target.open) abrirMensaje(B.porId.get(B.elegido)); else B.mensaje = null;
    }, true);
    $("#ap-detalle").addEventListener("input", (ev) => {
      const origen = { "msj-texto": "texto", "msj-nombre": "nombre", "msj-firma": "firma", "msj-celular": "celular" }[ev.target.id];
      if (origen && B.mensaje) actualizarMensaje(origen);
      if (ev.target.id === "cmp-texto" && B.campana) { B.campana.texto = ev.target.value; pintarEnlacesCampana(); }
    });
    $("#ap-detalle").addEventListener("change", (ev) => {
      if (ev.target.id === "msj-plantilla" && B.mensaje) { actualizarMensaje("plantilla"); return; }
      if (ev.target.id === "det-fallo") { fijarVeredicto(caso(B.elegido).veredicto.valor, ev.target.value); avisar("Respuesta guardada"); return; }
      if (ev.target.id !== "det-cuando") return;
      const v = ev.target.value;
      $("#det-que").hidden = !v;
      $("#det-fecha").hidden = v !== "otra";
      if (v === "otra") $("#det-fecha").focus();
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && (B.elegido || B.campana)) { B.elegido = null; B.mensaje = null; B.campana = null; pintarTabla(); pintarDetalle(); }
    });
    $("#ap-borrar").addEventListener("click", () => {
      if (!confirm("¿Borrar todo lo registrado en esta bandeja? Se pierde el historial guardado en este navegador.")) return;
      B.reg = { semana: null, casos: {} }; armarSemana();
      B.avisos = []; guardarAvisos();
      B.vista = "semana"; B.elegido = null; pintarTodo();
      avisar("Registro borrado");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
