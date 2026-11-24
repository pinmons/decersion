"""Página «Cómo se hizo (índice de pasos)»: su HTML. La cabecera, la navegación y el pie los pone paginas_web.py.

Los nueve pasos van en cuatro grupos con nombre: primero se elige el grupo y luego el paso (ley de
Hick). Cada grupo tiene una miniatura que public/js/indice.js dibuja con los datos reales del
entrenamiento (reportes/resultados.json). El reporte y las pruebas, que ya no están en la
navegación, se abren desde aquí. Sus estilos están en public/estilos-proceso.css.
"""
from html import escape

ESTILOS = ["estilos-proceso.css"]
SCRIPTS = ["indice"]

# (clave del grupo, nombre, la pregunta que responde, [(página, número, título, para qué sirve)])
GRUPOS = [
    ("reglas", "Las reglas", "Qué entra, qué se revisa y qué puede responder el sistema.", [
        ("contrato", 1, "El contrato", "Que toda respuesta sea un resultado, un error o una remisión a una persona."),
    ]),
    ("datos", "Los datos", "Con qué estudiantes aprende y qué variables usa.", [
        ("datos", 2, "Los datos", "Tener miles de ejemplos con los que entrenar y medir."),
        ("variables", 3, "Las variables", "Que cada variable aporte información propia."),
    ]),
    ("aprendizaje", "El aprendizaje", "Cómo salen los pesos de los datos y no del ojo.", [
        ("aprendizaje", 4, "Cómo aprende una neurona", "Seguir a un estudiante por la neurona, el error y la corrección."),
        ("red", 5, "La red neuronal", "Probar si un modelo más complejo predice mejor."),
        ("puntaje", 6, "De pesos a puntos", "Una tarjeta de 0 a 100 que un consejero entiende."),
        ("pesos", 7, "Cuánto pesa cada variable", "Que ninguna variable decida sola."),
    ]),
    ("comprobacion", "La comprobación", "Qué tan bien funciona y cómo se intentó romperlo.", [
        ("resultados", 8, "Qué tan bien funciona", "Comparar con honestidad las reglas, la neurona y la red."),
        ("pruebas", 9, "Pruebas de estrés", "Encontrar las fallas antes de que lleguen a un estudiante."),
    ]),
]

# Miniatura fija del primer grupo: las tres respuestas posibles del contrato.
MINI_REGLAS = """<div class="mini-salidas" role="img" aria-label="Las tres respuestas del sistema: un nivel de riesgo, un error o una remisión a una persona">
                <span class="mini-sello bajo">Bajo</span><span class="mini-sello medio">Medio</span><span class="mini-sello alto">Alto</span>
                <span class="mini-sello alto mini-error">Error</span><span class="mini-sello humano">Persona</span>
              </div>
              <p class="mini-pie">Tres respuestas posibles: un nivel, un error o una persona.</p>"""


def _grupo(i, clave, nombre, pregunta, pasos):
    items = "\n".join(
        f'                <li><a href="{pagina}.html"><b class="paso-n">{n}</b><span><strong>{escape(titulo)}</strong>'
        f'<small>{escape(para)}</small></span></a></li>' for pagina, n, titulo, para in pasos)
    mini = MINI_REGLAS if clave == "reglas" else '<p class="mini-pie">Cargando…</p>'
    return f"""          <section class="celda c6 grupo" aria-labelledby="grupo-{clave}">
            <header class="grupo-cabeza">
              <span class="rotulo">Parte {i} de {len(GRUPOS)}</span>
              <h2 id="grupo-{clave}">{escape(nombre)}</h2>
              <p>{escape(pregunta)}</p>
            </header>
            <div class="grupo-mini" id="mini-{clave}">
              {mini}
            </div>
            <ol class="grupo-pasos">
{items}
            </ol>
          </section>"""


def cuerpo(lista_pasos=None):
    # `lista_pasos` (los 9 <li> que arma paginas_web) ya no se usa: aquí van agrupados. Se conserva la firma.
    grupos = "\n".join(_grupo(i, *g) for i, g in enumerate(GRUPOS, 1))
    return f"""    <section class="seccion seccion-primera">
      <div class="envoltura">
        <header class="seccion-encabezado indice-cabeza">
          <p class="rotulo">Cuaderno metodológico</p>
          <h1>Cómo se hizo: de las reglas al modelo</h1>
          <p>De las reglas escritas a mano a una red neuronal que aprende sus pesos, en nueve pasos y cuatro partes.
            Cada número y cada gráfica salen del entrenamiento con la base real de la UPV (semilla 2026).</p>
        </header>
        <a class="boton boton-tinta abrir-leccion" href="aprendizaje.html">Explorar cómo aprende una neurona →</a>
        <div class="bento grupos">
{grupos}
        </div>
        <p class="indice-otros">También puede <a href="reporte.html">leer el reporte completo de corrido</a> o
          <a href="pruebas.html">correr las pruebas de estrés otra vez</a>.</p>
      </div>
    </section>"""
