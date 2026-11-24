"""Página «Estudiantes»: su HTML. La cabecera, la navegación y el pie los pone paginas_web.py.

Sus estilos están en public/estilos-estudiantes.css y su comportamiento en public/js/estudiantes.js.

La única decisión de esta pantalla es «a qué estudiante miro» (ley de Hick). Por eso el selector
de modelo y el botón de volver a leer la base van plegados, y lo demás lo dibuja el JS con lo que
responde /api/estudiantes: el flujo del proceso automático, el tablero, la lista y la ficha.
"""
from .comun import SELECTOR_MODELO

ESTILOS = ["estilos-estudiantes.css"]
SCRIPTS = ["estudiantes"]


def cuerpo():
    return f"""    <section class="seccion seccion-primera vista-estudiantes">
      <div class="envoltura">
        <header class="est-cabeza">
          <div class="est-titulo">
            <p class="rotulo">Primer año · Universitat Politècnica de València</p>
            <h1>Estudiantes en seguimiento</h1>
            <p class="entrada">Busca por código o filtra por nivel de riesgo. Selecciona un estudiante para ver qué datos influyeron en su resultado y qué apoyo sugiere el sistema.</p>
            <p class="est-bandeja"><a href="bienestar.html">Ver cómo lo usaría Bienestar</a></p>
          </div>
        </header>
        <details class="auditoria"><summary>Método de evaluación · <b id="modelo-actual">regresión logística</b></summary>
          <div class="motor-controles">{SELECTOR_MODELO}
            <button type="button" class="boton" id="btn-leer">Actualizar los resultados</button>
          </div>
        </details>
        <details class="auditoria"><summary>Lectura de la base y resumen de la cohorte</summary>
        <section class="flujo-zona" aria-label="Proceso automático">
          <div id="flujo" class="flujo"><p class="nota flujo-espera">Conectando con la base de datos…</p></div>
          <p class="nota" id="estado-lectura" aria-live="polite">Leyendo la base de datos y calificando a cada estudiante…</p>
          <div id="avisos" class="avisos"></div>
        </section>
        <div class="bento tablero" id="tablero" aria-label="Tablero de la cohorte"></div>
        </details>
        <div class="filtros" id="lista-estudiantes">
          <div id="chips" class="chips" role="group" aria-label="Filtrar por resultado"></div>
          <div class="filtros-busqueda">
            <label class="oculto" for="buscar">Buscar por código</label>
            <input type="search" id="buscar" placeholder="Código (UPV21-0042)" autocomplete="off">
            <label class="oculto" for="titulacion">Titulación</label>
            <select id="titulacion"><option value="">Todas las titulaciones</option></select>
          </div>
        </div>
        <div class="seguimiento">
          <div class="lista-zona">
            <h2 class="plan-titulo">Lista de estudiantes</h2>
            <ol id="lista" class="lista-estudiantes"></ol>
            <p class="nota" id="cuenta-lista"></p>
            <button type="button" class="boton" id="btn-mas" hidden>Ver 20 más</button>
          </div>
          <article class="ficha" id="ficha-estudiante" aria-live="polite"><p class="ficha-resumen">Selecciona un código de la lista para abrir su ficha.</p></article>
        </div>
      </div>
    </section>"""
