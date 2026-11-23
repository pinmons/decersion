"""Página «Estudiantes»: su HTML. La cabecera, la navegación y el pie los pone paginas_web.py.

Sus estilos están en public/estilos-estudiantes.css y su comportamiento en public/js/estudiantes.js.
"""
from .comun import SELECTOR_MODELO

ESTILOS = ["estilos-estudiantes.css"]
SCRIPTS = ["estudiantes"]


def cuerpo():
    return f"""    <section class="seccion seccion-primera">
      <div class="envoltura">
        <header class="seccion-encabezado">
          <h1>Estudiantes en seguimiento</h1>
          <p>Nadie llena una planilla aquí. El sistema lee la base de datos real, revisa cada registro contra el contrato
            y le da a cada estudiante su resultado: qué tan alto es su riesgo, por qué y en qué se le puede ayudar.</p>
        </header>
        <section class="tuberia-zona" aria-label="Proceso automático">
          <div class="tuberia-cabeza">
          {SELECTOR_MODELO}
            <button type="button" class="boton" id="btn-leer">Volver a leer la base</button>
          </div>
          <ol id="tuberia" class="tuberia"><li class="tubo tubo-espera">Conectando con la base de datos…</li></ol>
          <p class="nota" id="estado-lectura" aria-live="polite">Leyendo la base de datos y calificando a cada estudiante…</p>
        </section>
        <div class="filtros">
          <div id="chips" class="chips" role="group" aria-label="Filtrar por resultado"></div>
          <div class="filtros-busqueda">
            <label class="oculto" for="buscar">Buscar por código</label>
            <input type="search" id="buscar" placeholder="Buscar por código (IPP-0042)" autocomplete="off">
            <label class="oculto" for="programa">Programa</label>
            <select id="programa"><option value="">Todos los programas</option></select>
          </div>
        </div>
        <div class="seguimiento">
          <div class="lista-zona">
            <ol id="lista" class="lista-estudiantes"></ol>
            <p class="nota" id="cuenta-lista"></p>
            <button type="button" class="boton" id="btn-mas" hidden>Ver 25 más</button>
          </div>
          <article class="ficha" id="ficha-estudiante" aria-live="polite"><p class="ficha-resumen">Elija un estudiante de la lista.</p></article>
        </div>
      </div>
    </section>"""
