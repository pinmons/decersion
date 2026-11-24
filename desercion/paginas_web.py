"""Genera las páginas HTML de la web (public/*.html) desde una sola plantilla.

    python -m desercion.paginas_web

Cada parte tiene su propia página: inicio, evaluar, el índice de "Cómo se construyó" y una
página por cada paso. La cabecera, la navegación y el pie son iguales en todas; el contenido de
cada paso lo dibuja public/js/proceso.js con los datos reales de public/reportes/.
"""
from html import escape

from . import RAIZ
from .paginas import bienestar as paginas_bienestar, estudiantes as paginas_estudiantes, inicio as paginas_inicio, modelo as paginas_modelo, proceso as paginas_proceso

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
FUENTES = "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap"
SCRIPTS = ["util", "recorrido", "evaluador", "aprendizaje", "proceso", "reporte"]  # comunes; "principal" va al final


def _pagina(archivo, titulo, descripcion, pagina, seccion, cuerpo, estilos=(), scripts=()):
    # Cuatro secciones (ley de Hick). El reporte y las pruebas se abren desde «Cómo se hizo».
    nav = [("index.html", "Inicio", "inicio"), ("estudiantes.html", "Estudiantes", "estudiantes"), ("modelo.html", "Modelo y validación", "modelo"),
           ("evaluar.html", "Probar un caso", "evaluar"), ("proceso.html", "Cómo se hizo", "proceso")]
    seccion = {"reporte": "proceso", "pruebas": "proceso"}.get(seccion, seccion)
    enlaces = "\n        ".join(
        f'<a href="{h}"{" aria-current=\"page\"" if seccion == s else ""}>{t}</a>' for h, t, s in nav)
    scripts = "\n  ".join(f'<script src="js/{n}.js" defer></script>' for n in [*SCRIPTS, *scripts, "principal"])
    hojas = "".join(f'\n  <link rel="stylesheet" href="{h}">' for h in ["estilos-pasos.css", *estilos, "cuaderno.css"])
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
  <link rel="stylesheet" href="{escape(FUENTES)}">
  <link rel="stylesheet" href="estilos.css">{hojas}
</head>
<body data-pagina="{pagina}">
  <!-- Generado por python -m desercion.paginas_web: edite la plantilla, no este archivo. -->
  <a class="saltar" href="#principal">Ir al contenido</a>
  <header class="barra">
    <div class="barra-interior">
      <a class="nombre-sitio" href="index.html">
        <svg class="semaforo-logo" viewBox="0 0 12 30" aria-hidden="true"><rect width="12" height="30" rx="6" fill="currentColor"/><circle cx="6" cy="7" r="3" fill="var(--alto)"/><circle cx="6" cy="15" r="3" fill="var(--medio)"/><circle cx="6" cy="23" r="3" fill="var(--bajo)"/></svg>
        <span>Alerta Temprana<small>Cuaderno Analítico</small></span>
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
      <p>Prototipo académico, con los modelos escritos desde cero en NumPy. «Estudiantes» y «Modelo» usan una base
        real y pública (Universitat Politècnica de València, España: primer año de grado) con un contrato ampliado (notas,
        actividad, admisión y titulación); en ella la asistencia y el trabajo son aproximaciones, el estrato no existe y
        los estudiantes con impago quedan fuera.
        «Probar un caso» y «Cómo se hizo» usan el modelo construido con datos sintéticos. No se usa para decidir sobre
        estudiantes reales.</p>
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
    cuerpo = paginas_inicio.cuerpo(_lista_pasos(con_descripcion=True))
    return _pagina("index.html", "Alerta temprana de deserción",
                   "Prototipo de un sistema de alerta temprana de deserción universitaria para semestres 2 a 4.",
                   "inicio", "inicio", cuerpo, paginas_inicio.ESTILOS, paginas_inicio.SCRIPTS)


def evaluar():
    cuerpo = """    <section class="seccion seccion-primera">
      <div class="envoltura">
        <header class="seccion-encabezado">
          <p class="rotulo">Práctica con datos ficticios</p>
          <h1>¿Qué cambia el nivel de riesgo?</h1>
          <p>Elige un caso y anota su nivel de riesgo. Después cambia solo la asistencia o el promedio y compara el resultado en la ficha.</p>
        </header>
        <div class="casos-rapidos" role="group" aria-label="Empezar con un caso">
          <span class="rotulo">Elige un ejemplo</span>
          <button type="button" class="chip-caso" data-caso="R01">Caso tranquilo</button>
          <button type="button" class="chip-caso" data-caso="ejemplo" aria-pressed="true">Caso intermedio</button>
          <button type="button" class="chip-caso" data-caso="R03">Caso crítico</button>
          <button type="button" class="chip-caso chip-vacio" id="btn-limpiar">Empezar en blanco</button>
        </div>
        <div class="evaluador">
          <form id="planilla" class="planilla" autocomplete="off" novalidate>
            <fieldset class="selector-modo">
              <legend class="rotulo">Quién califica</legend>
              <div class="segmentado" role="radiogroup" aria-label="Modo del sistema">
                <label><input type="radio" name="modo" value="logistica" id="modo-logistica" checked><span>Regresión logística <small>recomendado</small></span></label>
                <label><input type="radio" name="modo" value="red_neuronal" id="modo-red"><span>Red neuronal</span></label>
                <label><input type="radio" name="modo" value="reglas" id="modo-reglas"><span>Reglas del contrato</span></label>
              </div>
            </fieldset>
            <div id="campos" class="campos"><p class="nota">Cargando la planilla…</p></div>
          </form>
          <article class="ficha" aria-labelledby="ficha-titulo" aria-live="polite">
            <header class="ficha-cabecera">
              <h2 id="ficha-titulo">Resultado del ejemplo</h2>
              <dl class="ficha-meta">
                <div><dt>Estudiante</dt><dd id="ficha-id">sin identificar</dd></div>
                <div><dt>Calificó</dt><dd id="ficha-modo">regresión logística</dd></div>
              </dl>
            </header>
            <div id="sello" class="sello-zona"><p class="sello-vacio">Calificando…</p></div>
            <p id="ficha-resumen" class="ficha-resumen">Consultando el sistema…</p>
            <div id="ficha-detalle" class="ficha-detalle" hidden>
              <section class="ficha-bloque"><h3>Puntaje de riesgo</h3><div id="regla-puntaje"></div></section>
              <section class="ficha-bloque"><h3>Factores con mayor impacto</h3><div id="influencia" class="influencia"></div><p class="nota" id="nota-influencia"></p></section>
              <details class="ficha-bloque ficha-plegable" id="bloque-sigmoide" hidden><summary>De puntos a probabilidad</summary><div id="sigmoide"></div></details>
            </div>
            <details class="ficha-bloque ficha-plegable" id="bloque-recorrido"><summary>Recorrido por el contrato</summary><div id="recorrido" class="recorrido"></div></details>
          </article>
        </div>
      </div>
    </section>"""
    return _pagina("evaluar.html", "Probar un caso",
                   "Planilla con los 12 datos del contrato y ficha de seguimiento que responde al mover cada dato.",
                   "evaluar", "evaluar", cuerpo)


def estudiantes():
    cuerpo = paginas_estudiantes.cuerpo()
    return _pagina("estudiantes.html", "Estudiantes en seguimiento",
                   "La base de datos real se lee sola y cada estudiante recibe su nivel de riesgo, el porqué y en qué mejorar.",
                   "estudiantes", "estudiantes", cuerpo, paginas_estudiantes.ESTILOS, paginas_estudiantes.SCRIPTS)


def bienestar():
    # Es una aplicación aparte (sistema de información), sin la cabecera ni el pie del sitio.
    return paginas_bienestar.pagina(FAVICON, FUENTES)


def modelo():
    cuerpo = paginas_modelo.cuerpo()
    return _pagina("modelo.html", "Cómo le va al modelo",
                   "AUC, F1, detección y precisión del modelo con datos reales, qué significa cada una y cómo se entrenó.",
                   "modelo", "modelo", cuerpo, paginas_modelo.ESTILOS, paginas_modelo.SCRIPTS)


def proceso():
    cuerpo = paginas_proceso.cuerpo(_lista_pasos(con_descripcion=True))
    return _pagina("proceso.html", "Cómo se construyó", "Los nueve pasos del prototipo, en cuatro partes.",
                   "proceso", "proceso", cuerpo, paginas_proceso.ESTILOS, paginas_proceso.SCRIPTS)


def paso(i):
    clave, titulo, desc = PASOS[i]
    anterior = PASOS[i - 1] if i > 0 else None
    siguiente = PASOS[i + 1] if i + 1 < len(PASOS) else None
    extra = ""
    if clave == "contrato":
        extra = """
            <p class="nota nota-ampliado">Este paso describe el contrato de 12 campos, que usan «Probar un caso» y las rondas.
              El modelo de la base real (páginas Estudiantes y Modelo) recibe además un <strong>contrato ampliado</strong>: notas,
              actividad en el campus y el aula virtual, admisión y titulación, con la misma validación, la regla R3.4 y las
              mismas garantías. Se explica en <a href="modelo.html">Modelo</a>.</p>"""
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
          <a class="indice-volver" href="proceso.html">Cómo se hizo</a>
          <h2 class="plan-titulo">Plan de lecciones</h2>
          <ol class="lista-pasos">
{_lista_pasos(actual=clave)}
          </ol>
        </nav>
        <article class="paso" id="paso-{clave}" data-paso="{clave}">
          <header class="paso-cabecera">
            <label class="rotulo" for="avance">Lección {i + 1} de {len(PASOS)}</label>
            <progress id="avance" value="{i + 1}" max="{len(PASOS)}"></progress>
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
    paginas = {"index.html": inicio(), "estudiantes.html": estudiantes(), "bienestar.html": bienestar(),
               "aviso-docente.html": paginas_bienestar.pagina_docente(FAVICON, FUENTES), "modelo.html": modelo(), "evaluar.html": evaluar(),
               "proceso.html": proceso(), "reporte.html": reporte()}
    for i, (clave, _, _) in enumerate(PASOS):
        paginas[f"{clave}.html"] = paso(i)
    for nombre, html in paginas.items():
        (PUBLICO / nombre).write_text(html, encoding="utf-8", newline="\n")
    print(f"Web: {len(paginas)} páginas generadas en public/")


if __name__ == "__main__":
    generar()
