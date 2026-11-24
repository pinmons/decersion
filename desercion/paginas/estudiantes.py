"""Página «Estudiantes»: su HTML. La cabecera, la navegación y el pie los pone paginas_web.py.

Sus estilos están en public/estilos-estudiantes.css y su comportamiento en public/js/estudiantes.js.

Al entrar hay una sola decisión (ley de Hick): «Leer la base y asignar alertas». El JS pide
/api/estudiantes una vez y reproduce a cámara lenta lo que pasó (conectar, leer, validar, calificar,
asignar). El detalle (método, tablero, filtros, lista y ficha) vive en una plantilla y solo se monta
cuando ya hay resultado; si hoy ya se leyó en este navegador, se muestra directo.
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
            <p class="entrada">Cada lectura valida los registros, califica a cada estudiante y reparte las alertas de riesgo alto al equipo de Bienestar. Nadie tiene que hacerlo a mano.</p>
          </div>
        </header>
        <section class="carga" id="carga" aria-label="Lectura de la base de datos">
          <p class="nota carga-espera">Consultando el registro académico…</p>
        </section>
        <div id="zona-detalle"></div>
        <template id="plantilla-detalle">
          <div class="detalle" id="detalle">
            <details class="auditoria"><summary>Método de evaluación · <b id="modelo-actual">regresión logística</b></summary>
              <div class="motor-controles">{SELECTOR_MODELO}</div>
            </details>
            <div id="avisos" class="avisos"></div>
            <div class="bento tablero" id="tablero" aria-label="Tablero de la cohorte"></div>
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
        </template>
      </div>
    </section>"""
