"""Página «Modelo»: su HTML. La cabecera, la navegación y el pie los pone paginas_web.py.

Sus estilos están en public/estilos-modelo.css y su comportamiento en public/js/modelo.js.
Es un tablero: la única decisión de la página es qué modelo se mira (el selector de arriba);
todo lo demás lo dibuja modelo.js en la rejilla #contenido con los datos de reportes/real/.
"""
from .comun import SELECTOR_MODELO

ESTILOS = ["estilos-modelo.css"]
SCRIPTS = ["modelo"]


def cuerpo():
    return f"""    <section class="seccion seccion-primera modelo-pagina">
      <div class="envoltura">
        <header class="seccion-encabezado modelo-encabezado">
          <h1>Cómo le va al modelo</h1>
          <p>Sus notas con estudiantes reales que nunca había visto, y cómo aprendió.</p>
        </header>
        <div class="selector-estudiante modelo-selector">
          {SELECTOR_MODELO}
        </div>
        <div class="bento modelo-tablero" id="contenido"><p class="nota">Cargando los resultados…</p></div>
      </div>
    </section>"""
