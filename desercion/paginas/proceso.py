"""Página «Cómo se hizo (índice de pasos)»: su HTML. La cabecera, la navegación y el pie los pone paginas_web.py.

Sus estilos están en public/estilos-proceso.css y su comportamiento en public/js/indice.js.
"""
ESTILOS = ["estilos-proceso.css"]
SCRIPTS = ["indice"]


def cuerpo(lista_pasos):
    return f"""    <section class="seccion seccion-primera">
      <div class="envoltura">
        <header class="seccion-encabezado">
          <h1>Cómo se construyó</h1>
          <p>Nueve pasos, de las reglas escritas a mano a una red neuronal que aprende sus pesos. Cada número y cada gráfica salen
            de la ejecución real del entrenamiento (semilla 2026). Si prefiere leerlo todo de corrido, está el
            <a href="reporte.html">reporte completo</a>.</p>
        </header>
        <ol class="tarjetas-pasos">
{lista_pasos}
        </ol>
      </div>
    </section>"""
