"""Página «Bandeja de Bienestar»: una aplicación, no una página del sitio del proyecto.

Es lo que usaría el área de Bienestar de una institución. Por eso no lleva la cabecera ni el pie del sitio:
tiene la forma de un sistema de información que la gente ya conoce (barra superior, menú lateral, tabla y
panel de detalle), como una plataforma de notas. Reglas de experiencia que sigue:
- Ley de Jakob: se parece a los sistemas que ya usan (menú a la izquierda, tabla en el centro, detalle a la derecha).
- Ley de Hick: una sola acción principal por caso («Lo contacté»); el resto va en segundo plano.
- Reconocer antes que recordar: el estado de cada estudiante se ve en la tabla con una etiqueta.
- Retroalimentación: cada registro confirma con un aviso y cambia la etiqueta al instante.
- Revelación progresiva: el próximo paso se programa en el mismo recuadro donde se registra, sin pantallas extra.

La vista «Hoy» es la agenda: lo atrasado, lo de hoy y lo de los próximos días, según la fecha del próximo paso
que se fija al registrar un contacto. La vista «Informe» resume lo registrado para la dirección (contactados,
remisiones, cierres y cuántos siguen estudiando), se imprime y descarga los casos en CSV para Excel. Para presentar
el prototipo hay un «ejemplo» que llena casos simulados, marcados como tales y borrables.

«Avisos de profesores» recibe lo que un docente reporta desde aviso-docente.html (no viene, va perdiendo, lo nota
mal…): una señal humana y a tiempo que el modelo no tiene, como los «progress reports» de EAB Navigate. El docente
nunca ve el nivel de riesgo (la lección de Purdue Course Signals). [SUPUESTO] En el prototipo el formulario y la
bandeja comparten el almacenamiento del navegador (misma dirección); en una institución el aviso iría a la base.

Mensajes por WhatsApp: plantillas (primer contacto, cita, recordatorio, sin respuesta, después de una remisión) que
nunca dicen «riesgo» ni «deserción», un enlace wa.me con el texto listo y una campaña para invitar a los pendientes
de la semana (como las campañas de citas de EAB). [SUPUESTO] La base no trae nombres ni celulares: se escriben a mano. [SUPUESTO] Si el estudiante no responde y no se elige fecha, el sistema
programa «Llamar de nuevo» a los 2 días.

Sus estilos están en public/estilos-bienestar.css y su comportamiento en public/js/bienestar.js (usa util.js).
[SUPUESTO] La lista de trabajo recibe solo el nivel alto (acción «remisión a bienestar y tutoría»); el nivel medio
va a tutoría académica. «Todos los estudiantes» deja buscar a cualquiera (también medio, bajo o devuelto) y abrirle
un caso, por ejemplo si llega a la oficina o lo remite un profesor. El cupo es de 20 estudiantes por semana. Los provisionales (modelo de ingreso) no se comparan
por puntaje con los definitivos: cada grupo se ordena por el suyo y se intercalan por percentil. En el prototipo
lo registrado se guarda en el navegador (localStorage); en una institución iría a su base de datos.

Lo que el sistema ya hizo llega a la vista (el humano solo habla con el estudiante y registra):
- Cada caso de riesgo alto llega asignado a una persona del equipo con su ruta de apoyo (desercion/plan_bienestar.py).
  «Ver casos de» en la barra superior filtra todas las vistas por persona; la vista «Equipo» muestra la carga de cada una.
- El motivo de cada fila es la primera señal de sus datos (lo que se ve frente a lo usual), no los puntos del modelo.
- La ficha del caso va en el orden de quien llama: quién es y quién lo atiende, qué se ve en sus datos, y un plan de
  tres pasos (mensaje ya redactado, la llamada, la remisión con la ruta preseleccionada).
- Automatizaciones en el navegador, cada una con su línea en el historial: dos intentos sin respuesta escalan el caso
  a coordinación; un aviso de profesor sube la prioridad del estudiante; el próximo paso se programa solo.
- «Titulación T04» es un código anónimo de la UPV: se explica con la ficha histórica de cada código.
"""
from html import escape

# Íconos de trazo del menú (24×24, sin relleno), para que cada opción se reconozca de un vistazo.
_TRAZO = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
ICONOS = {
    "agenda": f'<svg {_TRAZO}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M9 14.5l2 2 4-4"/></svg>',
    "semana": f'<svg {_TRAZO}><path d="M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 13h4.5l1 2h5l1-2H20"/></svg>',
    "seguimiento": f'<svg {_TRAZO}><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/></svg>',
    "cerrado": f'<svg {_TRAZO}><circle cx="12" cy="12" r="8"/><path d="M8.5 12.2l2.3 2.3 4.7-4.8"/></svg>',
    "directorio": f'<svg {_TRAZO}><circle cx="9" cy="9" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 6.2a3 3 0 0 1 0 5.6M18 19a5.5 5.5 0 0 0-2.4-4.5"/></svg>',
    "volver": f'<svg {_TRAZO}><path d="M10 6l-6 6 6 6M4 12h16"/></svg>',
    "informe": f'<svg {_TRAZO}><path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/></svg>',
    "avisos": f'<svg {_TRAZO}><path d="M4 10v4h3l6 4V6L7 10z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    "docente": f'<svg {_TRAZO}><path d="M3 9l9-4 9 4-9 4z"/><path d="M7 11v4c0 1.5 2.2 3 5 3s5-1.5 5-3v-4M21 9v5"/></svg>',
    "equipo": f'<svg {_TRAZO}><rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-2.5h12V16"/></svg>',
}


def pagina(favicon, fuentes):
    return f"""<!doctype html>
<html lang="es" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Bandeja de Bienestar</title>
  <meta name="description" content="Los estudiantes que Bienestar contacta esta semana, el porqué de cada uno y el registro de lo que pasó.">
  <link rel="icon" href="{escape(favicon)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="{escape(fuentes)}">
  <link rel="stylesheet" href="estilos-bienestar.css">
</head>
<body class="app" data-pagina="bienestar">
  <!-- Generado por python -m desercion.paginas_web: edite la plantilla, no este archivo. -->
  <a class="app-saltar" href="#ap-principal">Ir a la lista de estudiantes</a>
  <header class="app-barra">
    <button type="button" class="app-boton-menu" id="ap-boton-menu" aria-controls="ap-menu" aria-expanded="false">
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <span class="app-oculto">Menú</span>
    </button>
    <div class="app-marca">
      <svg class="app-logo" viewBox="0 0 12 30" aria-hidden="true"><rect width="12" height="30" rx="6" fill="currentColor"/><circle cx="6" cy="7" r="3" fill="#e05a4f"/><circle cx="6" cy="15" r="3" fill="#f2b23a"/><circle cx="6" cy="23" r="3" fill="#4fb57a"/></svg>
      <div><b>Bienestar<em> Universitario</em></b><span>Alerta temprana de deserción</span></div>
    </div>
    <div class="app-barra-der">
      <span class="app-lectura" id="ap-lectura">Leyendo la base…</span>
      <div class="app-persona">
        <i class="avatar av-equipo" id="ap-persona-avatar" aria-hidden="true">EQ</i>
        <label for="ap-persona"><span>Ver casos de</span>
          <select id="ap-persona"><option value="">Todo el equipo</option></select></label>
      </div>
    </div>
  </header>
  <div class="app-cuerpo">
    <nav class="app-menu" id="ap-menu" aria-label="Menú de la bandeja">
      <p class="app-menu-grupo">Casos</p>
      <button type="button" data-vista="agenda">{ICONOS["agenda"]}<span>Hoy</span><b id="n-agenda"></b></button>
      <button type="button" data-vista="avisos">{ICONOS["avisos"]}<span>Avisos de profesores</span><b id="n-avisos"></b></button>
      <button type="button" data-vista="semana" aria-current="page">{ICONOS["semana"]}<span>Esta semana</span><b id="n-semana"></b></button>
      <button type="button" data-vista="seguimiento">{ICONOS["seguimiento"]}<span>En seguimiento</span><b id="n-seguimiento"></b></button>
      <button type="button" data-vista="cerrado">{ICONOS["cerrado"]}<span>Cerrados</span><b id="n-cerrado"></b></button>
      <p class="app-menu-grupo">Consultar</p>
      <button type="button" data-vista="equipo">{ICONOS["equipo"]}<span>Equipo</span></button>
      <button type="button" data-vista="directorio">{ICONOS["directorio"]}<span>Todos los estudiantes</span><b id="n-directorio"></b></button>
      <button type="button" data-vista="informe">{ICONOS["informe"]}<span>Informe</span></button>
      <a class="app-menu-final" href="aviso-docente.html" target="_blank" rel="noopener">{ICONOS["docente"]}<span>Formulario para profesores</span></a>
      <a href="index.html">{ICONOS["volver"]}<span>Volver al inicio</span></a>
    </nav>
    <main class="app-principal" id="ap-principal">
      <p class="app-franja" id="ap-franja" hidden></p>
      <div class="app-encabezado">
        <div>
          <h1 id="ap-titulo">Por contactar esta semana</h1>
          <p id="ap-subtitulo">Cargando…</p>
        </div>
        <div class="app-avance" id="ap-avance" hidden>
          <span id="ap-avance-texto"></span>
          <div class="app-avance-barra" aria-hidden="true"><i id="ap-avance-relleno"></i></div>
        </div>
      </div>
      <div class="app-acciones-informe" id="ap-acciones-informe" hidden>
        <button type="button" class="boton-sec" id="ap-csv">Descargar casos (Excel)</button>
        <button type="button" class="boton-sec" id="ap-imprimir">Imprimir</button>
      </div>
      <section class="app-informe" id="ap-informe" aria-label="Informe" hidden></section>
      <section class="app-equipo" id="ap-equipo" aria-label="Equipo de Bienestar" hidden></section>
      <div class="app-herramientas" id="ap-herramientas">
        <label class="app-oculto" for="ap-buscar">Buscar por código</label>
        <input type="search" id="ap-buscar" placeholder="Buscar por código" autocomplete="off">
        <label class="app-oculto" for="ap-programa">Titulación</label>
        <select id="ap-programa"><option value="">Todas las titulaciones</option></select>
        <label class="app-oculto" for="ap-nivel">Nivel de riesgo</label>
        <select id="ap-nivel" hidden>
          <option value="">Todos los niveles</option><option value="alto">Riesgo alto</option><option value="medio">Riesgo medio</option>
          <option value="bajo">Riesgo bajo</option><option value="devuelto">Devueltos al registro</option>
        </select>
        <button type="button" class="boton-sec boton-wa" id="ap-campana" hidden>Invitar por WhatsApp a los pendientes</button>
      </div>
      <details class="app-explica" id="ap-explica" hidden><summary>¿Qué es «Titulación T04»?</summary><p id="ap-explica-texto"></p></details>
      <div class="app-tabla-zona" id="ap-tabla-zona">
        <table class="app-tabla">
          <thead><tr id="ap-cabeza"></tr></thead>
          <tbody id="ap-filas"></tbody>
        </table>
        <p class="app-vacio" id="ap-vacio" hidden></p>
        <div class="app-mas" id="ap-mas-zona" hidden><span id="ap-mas-texto"></span><button type="button" class="boton-sec" id="ap-mas">Ver 50 más</button></div>
      </div>
      <footer class="app-pie">
        <p id="ap-alcance"></p>
        <p>Prototipo: lo que registre se guarda solo en este navegador. En una institución quedaría en su base de datos,
          a la vista de todo el equipo de Bienestar. <button type="button" class="app-enlace" id="ap-borrar">Borrar lo registrado</button></p>
      </footer>
    </main>
    <aside class="app-detalle" id="ap-detalle" aria-label="Caso del estudiante" hidden tabindex="-1"></aside>
  </div>
  <div class="app-aviso" id="ap-aviso" role="status" aria-live="polite" hidden></div>
  <script src="js/util.js" defer></script>
  <script src="js/bienestar.js" defer></script>
</body>
</html>
"""


MOTIVOS_DOCENTE = ["No viene a clase", "Va perdiendo la asignatura", "No entrega los trabajos",
                   "Lo noto con problemas personales o de ánimo", "Tiene problemas económicos", "Otro motivo"]


def pagina_docente(favicon, fuentes):
    """Formulario del profesor: reporta a un estudiante y el aviso llega a la bandeja de Bienestar.

    Es corto a propósito (un profesor tiene un minuto): quién, en qué asignatura, qué pasa y un comentario.
    No muestra el nivel de riesgo del estudiante: eso solo lo ve Bienestar.
    """
    motivos = "\n".join(
        f'            <label class="doc-opcion"><input type="checkbox" name="motivo" value="{escape(m)}"><span>{escape(m)}</span></label>'
        for m in MOTIVOS_DOCENTE)
    return f"""<!doctype html>
<html lang="es" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Reportar a un estudiante</title>
  <meta name="description" content="Formulario para que un profesor avise a Bienestar sobre un estudiante que le preocupa.">
  <link rel="icon" href="{escape(favicon)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="{escape(fuentes)}">
  <link rel="stylesheet" href="estilos-bienestar.css">
</head>
<body class="app doc" data-pagina="aviso-docente">
  <!-- Generado por python -m desercion.paginas_web: edite la plantilla, no este archivo. -->
  <header class="app-barra">
    <div class="app-marca">
      <svg class="app-logo" viewBox="0 0 12 30" aria-hidden="true"><rect width="12" height="30" rx="6" fill="currentColor"/><circle cx="6" cy="7" r="3" fill="#e05a4f"/><circle cx="6" cy="15" r="3" fill="#f2b23a"/><circle cx="6" cy="23" r="3" fill="#4fb57a"/></svg>
      <div><b>Portal docente</b><span>Aviso a Bienestar Universitario</span></div>
    </div>
    <a href="index.html">Volver al inicio</a>
  </header>
  <main class="doc-principal">
    <form class="doc-tarjeta" id="doc-form" novalidate>
      <h1>Reportar a un estudiante</h1>
      <p class="doc-entrada">Si un estudiante le preocupa, avísele a Bienestar. Toma un minuto y una consejera lo contactará.</p>
      <div class="doc-campo">
        <label for="doc-codigo">Código del estudiante</label>
        <input id="doc-codigo" list="doc-codigos" autocomplete="off" placeholder="Por ejemplo, UPV22-1241" required>
        <datalist id="doc-codigos"></datalist>
        <p class="doc-ayuda" id="doc-quien" aria-live="polite"></p>
      </div>
      <div class="doc-campo">
        <label for="doc-asignatura">Asignatura</label>
        <input id="doc-asignatura" autocomplete="off" placeholder="Por ejemplo, Cálculo I" required>
      </div>
      <fieldset class="doc-campo">
        <legend>¿Qué está pasando? <span>Marque una o varias</span></legend>
        <div class="doc-opciones">
{motivos}
        </div>
      </fieldset>
      <div class="doc-campo">
        <label for="doc-comentario">Comentario <span>(opcional)</span></label>
        <textarea id="doc-comentario" rows="3" placeholder="Lo que ha notado y crea útil para Bienestar"></textarea>
      </div>
      <div class="doc-campo">
        <label for="doc-nombre">Su nombre</label>
        <input id="doc-nombre" autocomplete="name" placeholder="Para que Bienestar sepa a quién preguntar" required>
      </div>
      <p class="doc-error" id="doc-error" role="alert" hidden></p>
      <button type="submit" class="det-principal">Enviar aviso a Bienestar</button>
      <p class="doc-privado">Bienestar recibe el aviso y decide cómo acercarse al estudiante. El estudiante no ve este reporte.</p>
    </form>
    <div class="doc-tarjeta doc-enviado" id="doc-enviado" hidden tabindex="-1">
      <h1>Aviso enviado</h1>
      <p id="doc-resumen"></p>
      <p class="doc-entrada">Gracias. Una consejera de Bienestar lo revisará y contactará al estudiante.</p>
      <button type="button" class="boton-sec" id="doc-otro">Reportar a otro estudiante</button>
    </div>
    <p class="doc-pie">Prototipo: el aviso llega a la <a href="bienestar.html">Bandeja de Bienestar</a> abierta en este mismo navegador.</p>
  </main>
  <script src="js/util.js" defer></script>
  <script src="js/aviso-docente.js" defer></script>
</body>
</html>
"""
