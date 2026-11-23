"""Página «Inicio»: su HTML. La cabecera, la navegación y el pie los pone paginas_web.py.

Sus estilos están en public/estilos-inicio.css y su comportamiento en public/js/inicio.js.
"""
ESTILOS = ["estilos-inicio.css"]
SCRIPTS = ["inicio"]


def cuerpo(lista_pasos):
    return f"""    <section class="portada">
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
          <p class="aviso"><strong>Ya opera con una base de datos real.</strong> El mismo código se reentrenó con
            4 424 estudiantes reales y ahora lee esa base y califica solo a cada estudiante.</p>
          <div class="acciones">
            <a class="boton boton-tinta" href="estudiantes.html">Ver a los estudiantes</a>
            <a class="boton" href="modelo.html">Cómo le va al modelo</a>
            <a class="boton" href="evaluar.html">Evaluar a uno a mano</a>
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
{lista_pasos}
        </ol>
      </div>
    </section>"""
