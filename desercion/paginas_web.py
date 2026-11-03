"""Genera las páginas HTML de la web (public/*.html) desde una sola plantilla.

    python -m desercion.paginas_web

Cada parte tiene su propia página: inicio, evaluar, el índice de "Cómo se construyó" y una
página por cada paso. La cabecera, la navegación y el pie son iguales en todas; el contenido de
cada paso lo dibuja public/js/proceso.js con los datos reales de public/reportes/.
"""
from html import escape

from . import RAIZ

PUBLICO = RAIZ / "public"

PASOS = [
    ("contrato", "El contrato", "Qué datos entran, en qué orden se revisan y qué responde el sistema en cada caso."),
    ("datos", "Los datos", "Cómo se simularon 20 000 estudiantes y qué registros descartó la validación."),
    ("variables", "Las variables", "Correlaciones, VIF y qué variables redundantes se quitaron antes de entrenar."),
    ("aprendizaje", "Cómo aprende una neurona", "Siga a un estudiante: de sus datos a números, por la neurona, la pérdida y el gradiente, hasta las épocas y la regularización."),
    ("red", "La red neuronal", "Aprendizaje profundo: capas, ReLU, backpropagation, Adam, inicialización He, dropout y monotonía."),
    ("puntaje", "De pesos a puntos", "La tarjeta de puntaje de 0 a 100 y cómo se eligieron los cortes de cada nivel."),
    ("pesos", "Cuánto pesa cada variable", "Importancia, tope del 35 %, ablación, estabilidad y la variable sensible estrato."),
    ("resultados", "Qué tan bien funciona", "Las métricas en prueba de los modelos aprendidos frente a las reglas del contrato."),
    ("pruebas", "Pruebas de estrés", "Las rondas 1 a 4 caso por caso, y un botón para correrlas otra vez."),
]

# Qué es, por qué y para qué de cada paso (se muestra en la cabecera de su página).
QUE_PORQUE = {
    "contrato": ("Las reglas fijas que dicen qué datos entran, en qué orden se revisan y qué puede responder el sistema.",
                 "Sin reglas claras, el sistema calificaría datos rotos o a estudiantes que no le corresponden, y se equivocaría sin avisar.",
                 "Que toda respuesta sea un resultado confiable, un error que se corrige en el origen o una remisión a una persona."),
    "datos": ("La generación de 20 000 estudiantes simulados, cada uno con la marca de si desertó o no.",
              "No hay registros reales con esa marca, y un modelo necesita miles de ejemplos para aprender.",
              "Tener con qué entrenar y medir los modelos, y dejar listo el camino para cambiar a datos reales."),
    "variables": ("Elegir y preparar las variables que entran al modelo.",
                  "Variables repetidas confunden al modelo, y variables en escalas distintas desequilibran el aprendizaje.",
                  "Que cada variable aporte información propia y todas compitan en igualdad de condiciones."),
    "aprendizaje": ("El entrenamiento de una regresión logística: una sola neurona que aprende un peso por variable.",
                    "Los pesos de las reglas se pusieron a ojo; aquí salen de los datos, midiendo cuánto se equivoca y corrigiendo.",
                    "Obtener pesos medidos que después se convierten en una tarjeta de puntos que un consejero entiende."),
    "red": ("Una red neuronal de tres capas, entrenada con las técnicas del aprendizaje profundo.",
            "Una red puede captar combinaciones que una sola neurona no ve, como que trabajar pesa más cuando la asistencia es baja.",
            "Comprobar si un modelo más complejo predice mejor, y a qué costo en explicabilidad."),
    "puntaje": ("Convertir los pesos aprendidos en puntos de 0 a 100 y elegir dónde empieza cada nivel.",
                "Un consejero necesita ver por qué un estudiante sale en riesgo, no un número abstracto.",
                "Mantener la forma de las reglas (puntos, niveles y acción) pero con pesos aprendidos de los datos."),
    "pesos": ("Medir cuánto depende el modelo de cada variable y repartir el peso si una domina.",
              "Si una sola variable decide todo, un error en ese dato arrastra la decisión completa.",
              "Un modelo robusto y estable, con el estrato revisado aparte por ser una variable sensible."),
    "resultados": ("La evaluación final con 3 000 estudiantes que ningún modelo había visto.",
                   "Medir con los mismos datos del entrenamiento daría números inflados.",
                   "Comparar con honestidad las reglas, la neurona y la red, y saber cuánto confiar en cada una."),
    "pruebas": ("Casos diseñados para romper el sistema, con la respuesta esperada escrita aparte.",
                "Un sistema que funciona con casos típicos puede fallar en silencio con casos raros.",
                "Encontrar y corregir las fallas antes de que lleguen a un estudiante real."),
}

FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' "
           "rx='6' fill='%232350a8'/%3E%3Ccircle cx='16' cy='9' r='3.4' fill='%23e05a4f'/%3E%3Ccircle cx='16' cy='16' r='3.4' "
           "fill='%23f2b23a'/%3E%3Ccircle cx='16' cy='23' r='3.4' fill='%234fb57a'/%3E%3C/svg%3E")
FUENTES = ("https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400"
           "&family=Literata:ital,opsz,wght@0,7..72,400..800;1,7..72,400..600&display=swap")
SCRIPTS = ["util", "recorrido", "evaluador", "aprendizaje", "proceso", "reporte", "principal"]


def _pagina(archivo, titulo, descripcion, pagina, seccion, cuerpo):
    nav = [("index.html", "Inicio", "inicio"), ("evaluar.html", "Evaluar", "evaluar"),
           ("proceso.html", "Cómo se construyó", "proceso"), ("reporte.html", "Reporte", "reporte"), ("pruebas.html", "Pruebas", "pruebas")]
    enlaces = "\n        ".join(
        f'<a href="{h}"{" aria-current=\"page\"" if seccion == s else ""}>{t}</a>' for h, t, s in nav)
    scripts = "\n  ".join(f'<script src="js/{n}.js" defer></script>' for n in SCRIPTS)
    return f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{escape(titulo)}</title>
  <meta name="description" content="{escape(descripcion)}">
  <link rel="icon" href="{FAVICON}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="{FUENTES}">
  <link rel="stylesheet" href="estilos.css">
</head>
<body data-pagina="{pagina}">
  <!-- Generado por python -m desercion.paginas_web: edite la plantilla, no este archivo. -->
  <a class="saltar" href="#principal">Ir al contenido</a>
  <header class="barra">
    <div class="barra-interior">
      <a class="nombre-sitio" href="index.html">
        <svg class="semaforo-logo" viewBox="0 0 12 30" aria-hidden="true"><rect width="12" height="30" rx="6" fill="currentColor"/><circle cx="6" cy="7" r="3" fill="var(--alto)"/><circle cx="6" cy="15" r="3" fill="var(--medio)"/><circle cx="6" cy="23" r="3" fill="var(--bajo)"/></svg>
        Alerta temprana
      </a>
      <nav aria-label="Secciones">
        {enlaces}
      </nav>
    </div>
  </header>
  <div id="aviso-archivo" class="aviso-archivo" hidden></div>
  <main id="principal">
{cuerpo}
  </main>
  <footer class="pie">
    <div class="envoltura">
      <p>Prototipo académico. Los modelos están implementados desde cero en NumPy y se entrenaron con datos
        sintéticos: las métricas no representan el desempeño con estudiantes reales. Los oráculos de las pruebas son
        borradores que debe firmar el equipo.</p>
    </div>
  </footer>
  <div id="globo" class="globo" role="tooltip" hidden></div>
  {scripts}
</body>
</html>
"""


def _lista_pasos(actual=None, con_descripcion=False):
    items = []
    for i, (clave, titulo, desc) in enumerate(PASOS, 1):
        marca = ' aria-current="page"' if clave == actual else ""
        extra = f"<span>{escape(QUE_PORQUE[clave][0])}</span><span class=\"para-que\">Para qué: {escape(QUE_PORQUE[clave][2].rstrip('.'))}.</span>" if con_descripcion else ""
        items.append(f'<li><a href="{clave}.html"{marca}><b class="paso-n">{i}</b><span class="paso-texto"><strong>{escape(titulo)}</strong>{extra}</span></a></li>')
    return "\n".join(items)


def inicio():
    cuerpo = f"""    <section class="portada">
      <div class="envoltura portada-rejilla">
        <div class="portada-texto">
          <h1>Detectar a tiempo a quién se le está haciendo cuesta arriba la universidad.</h1>
          <p class="entrada">Entre el segundo y el cuarto semestre de pregrado es cuando más estudiantes se van. Este
            prototipo lee el registro académico y socioeconómico de un estudiante y le dice a bienestar universitario
            qué tan alto es su riesgo de desertar y qué hacer: seguimiento, tutoría o remisión.</p>
          <p class="entrada">Cuando los datos están mal, los rechaza. Cuando no le corresponde decidir, se abstiene y le
            pasa el caso a una persona.</p>
          <p class="aviso"><strong>Prototipo con datos sintéticos.</strong> Los modelos aprendieron de
            <span data-cifra="n_validos">20 000</span> estudiantes simulados. Sirve para ver y discutir el proceso,
            no para decidir sobre estudiantes reales.</p>
          <div class="acciones">
            <a class="boton boton-tinta" href="evaluar.html">Evaluar a un estudiante</a>
            <a class="boton" href="proceso.html">Ver cómo se construyó</a>
          </div>
        </div>
        <figure class="portada-casos" aria-labelledby="casos-titulo">
          <figcaption id="casos-titulo">Tres casos típicos del contrato, calificados ahora mismo por el modelo aprendido</figcaption>
          <ol id="casos-portada" class="casos-lista">
            <li class="caso-cargando">Consultando el sistema…</li>
          </ol>
        </figure>
      </div>
    </section>
    <section class="seccion">
      <div class="envoltura">
        <header class="seccion-encabezado">
          <h2>Cómo se construyó, paso a paso</h2>
          <p>Cada paso tiene su propia página, con las gráficas hechas a partir de la ejecución real del entrenamiento.</p>
        </header>
        <ol class="tarjetas-pasos">
{_lista_pasos(con_descripcion=True)}
        </ol>
      </div>
    </section>"""
    return _pagina("index.html", "Alerta temprana de deserción",
                   "Prototipo de un sistema de alerta temprana de deserción universitaria para semestres 2 a 4.",
                   "inicio", "inicio", cuerpo)


def evaluar():
    cuerpo = """    <section class="seccion seccion-primera">
      <div class="envoltura">
        <header class="seccion-encabezado">
          <h1>Evaluar a un estudiante</h1>
          <p>Llene la planilla con los 12 datos del contrato. La ficha de seguimiento se actualiza sola cuando están
            completos los obligatorios y muestra el recorrido que hizo el registro por las reglas. Si prefiere, cargue un
            ejemplo y modifíquelo.</p>
        </header>
        <div class="evaluador">
          <form id="planilla" class="planilla" autocomplete="off" novalidate>
            <fieldset class="selector-modo">
              <legend>Quién califica</legend>
              <div class="segmentado" role="radiogroup" aria-label="Modo del sistema">
                <label><input type="radio" name="modo" value="reglas" id="modo-reglas"><span>Reglas del contrato</span></label>
                <label><input type="radio" name="modo" value="logistica" id="modo-logistica" checked><span>Regresión logística</span></label>
                <label><input type="radio" name="modo" value="red_neuronal" id="modo-red"><span>Red neuronal</span></label>
              </div>
            </fieldset>
            <div id="campos" class="campos"><p class="nota">Cargando la planilla…</p></div>
            <div class="acciones">
              <button type="button" class="boton boton-tinta" id="btn-ejemplo">Cargar un ejemplo</button>
              <button type="button" class="boton" id="btn-limpiar">Limpiar planilla</button>
            </div>
          </form>
          <article class="ficha" aria-labelledby="ficha-titulo" aria-live="polite">
            <header class="ficha-cabecera">
              <h2 id="ficha-titulo">Ficha de seguimiento</h2>
              <dl class="ficha-meta">
                <div><dt>Estudiante</dt><dd id="ficha-id">sin identificar</dd></div>
                <div><dt>Calificó</dt><dd id="ficha-modo">regresión logística</dd></div>
              </dl>
            </header>
            <div id="sello" class="sello-zona"><p class="sello-vacio">Faltan 11 datos</p></div>
            <p id="ficha-resumen" class="ficha-resumen">Llene la planilla para calificar al estudiante.</p>
            <div id="ficha-detalle" class="ficha-detalle" hidden>
              <section class="ficha-bloque"><h3>Puntaje de riesgo</h3><div id="regla-puntaje"></div></section>
              <section class="ficha-bloque" id="bloque-sigmoide" hidden><h3>De puntos a probabilidad</h3><div id="sigmoide"></div></section>
              <section class="ficha-bloque"><h3>Qué empuja el puntaje</h3><p class="nota" id="nota-influencia"></p><div id="influencia" class="influencia"></div></section>
            </div>
            <section class="ficha-bloque"><h3>Recorrido por el contrato</h3><div id="recorrido" class="recorrido"></div></section>
          </article>
        </div>
      </div>
    </section>"""
    return _pagina("evaluar.html", "Evaluar a un estudiante",
                   "Planilla con los 12 datos del contrato y ficha de seguimiento con el nivel de riesgo.",
                   "evaluar", "evaluar", cuerpo)


def proceso():
    cuerpo = f"""    <section class="seccion seccion-primera">
      <div class="envoltura">
        <header class="seccion-encabezado">
          <h1>Cómo se construyó</h1>
          <p>Nueve pasos, de las reglas escritas a mano a una red neuronal que aprende sus pesos. Cada número y cada gráfica salen
            de la ejecución real del entrenamiento (semilla 2026). Si prefiere leerlo todo de corrido, está el
            <a href="reporte.html">reporte completo</a>.</p>
        </header>
        <ol class="tarjetas-pasos">
{_lista_pasos(con_descripcion=True)}
        </ol>
      </div>
    </section>"""
    return _pagina("proceso.html", "Cómo se construyó", "Los ocho pasos del prototipo, cada uno en su página.",
                   "proceso", "proceso", cuerpo)


def paso(i):
    clave, titulo, desc = PASOS[i]
    anterior = PASOS[i - 1] if i > 0 else None
    siguiente = PASOS[i + 1] if i + 1 < len(PASOS) else None
    extra = ""
    if clave == "pruebas":
        extra = """
            <div class="pruebas-vivo">
              <button type="button" class="boton boton-tinta" id="btn-rondas">Correr las pruebas en el servidor</button>
              <p class="nota" id="estado-rondas">Corre otra vez las rondas 1 a 3 (modo reglas) y la ronda 4 (modo aprendido).</p>
              <div id="tabla-rondas"></div>
            </div>"""
    pie = ['<nav class="paso-navegacion" aria-label="Pasos vecinos">']
    pie.append(f'<a class="boton" href="{anterior[0]}.html">Paso {i}: {escape(anterior[1])}</a>' if anterior
               else '<a class="boton" href="proceso.html">Todos los pasos</a>')
    pie.append(f'<a class="boton boton-tinta" href="{siguiente[0]}.html">Paso {i + 2}: {escape(siguiente[1])}</a>' if siguiente
               else '<a class="boton boton-tinta" href="evaluar.html">Evaluar a un estudiante</a>')
    pie.append("</nav>")
    cuerpo = f"""    <section class="seccion seccion-primera">
      <div class="envoltura proceso-rejilla">
        <nav class="indice" aria-label="Pasos del proceso">
          <a class="indice-volver" href="proceso.html">Cómo se construyó</a>
          <ol class="lista-pasos">
{_lista_pasos(actual=clave)}
          </ol>
        </nav>
        <article class="paso" id="paso-{clave}" data-paso="{clave}">
          <header class="paso-cabecera">
            <p class="nota">Paso {i + 1} de {len(PASOS)}</p>
            <h1>{escape(titulo)}</h1>
            <p class="entrada">{escape(desc)}</p>
          </header>
          <dl class="que-porque">
            <div><dt>Qué es</dt><dd>{escape(QUE_PORQUE[clave][0])}</dd></div>
            <div><dt>Por qué</dt><dd>{escape(QUE_PORQUE[clave][1])}</dd></div>
            <div><dt>Para qué</dt><dd>{escape(QUE_PORQUE[clave][2])}</dd></div>
          </dl>
          <div class="cuerpo" id="contenido"><p class="nota">Cargando…</p></div>{extra}
          {"".join(pie)}
        </article>
      </div>
    </section>"""
    return _pagina(f"{clave}.html", titulo, desc, f"paso-{clave}", "pruebas" if clave == "pruebas" else "proceso", cuerpo)


def reporte():
    cuerpo = """    <section class="seccion seccion-primera">
      <div class="envoltura">
        <header class="seccion-encabezado">
          <h1>Reporte del entrenamiento</h1>
          <p>Todo lo que se hizo y lo que salió, en un solo documento: datos, variables, entrenamiento, control de
            dominancia, evaluación, pruebas y supuestos. Los números salen de la ejecución real (semilla 2026).</p>
        </header>
        <div class="reporte-rejilla">
          <nav class="indice" aria-label="Secciones del reporte"><ol class="lista-pasos" id="indice-reporte"></ol></nav>
          <article class="reporte cuerpo" id="contenido"><p class="nota">Cargando el reporte…</p></article>
        </div>
      </div>
    </section>"""
    return _pagina("reporte.html", "Reporte del entrenamiento", "Reporte completo del entrenamiento con datos sintéticos.",
                   "reporte", "reporte", cuerpo)


def generar():
    paginas = {"index.html": inicio(), "evaluar.html": evaluar(), "proceso.html": proceso(), "reporte.html": reporte()}
    for i, (clave, _, _) in enumerate(PASOS):
        paginas[f"{clave}.html"] = paso(i)
    for nombre, html in paginas.items():
        (PUBLICO / nombre).write_text(html, encoding="utf-8", newline="\n")
    print(f"Web: {len(paginas)} páginas generadas en public/")


if __name__ == "__main__":
    generar()
