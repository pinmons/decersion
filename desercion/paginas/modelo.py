"""Página «Modelo»: su HTML. La cabecera, la navegación y el pie los pone paginas_web.py.

Sus estilos están en public/estilos-modelo.css y su comportamiento en public/js/modelo.js.
"""
from .comun import SELECTOR_MODELO

ESTILOS = ["estilos-modelo.css"]
SCRIPTS = ["modelo"]


def cuerpo():
    return f"""    <section class="seccion seccion-primera">
      <div class="envoltura">
        <header class="seccion-encabezado">
          <h1>Cómo le va al modelo</h1>
          <p>Sus notas con estudiantes reales que nunca había visto, qué significa cada una y cómo se entrenó.</p>
        </header>
        <div class="selector-estudiante">
          {SELECTOR_MODELO}
        </div>
        <div class="cuerpo modelo-cuerpo" id="contenido"><p class="nota">Cargando los resultados…</p></div>
      </div>
    </section>"""
