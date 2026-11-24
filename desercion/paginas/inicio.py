"""Página «Inicio»: su HTML. La cabecera, la navegación y el pie los pone paginas_web.py.

Es un tablero en rejilla bento: una frase que dice qué es el sistema y celdas vivas que
public/js/inicio.js llena con la última lectura de la base real (/api/estudiantes) y con las
notas del modelo (reportes/real/resultados.json). Una sola acción principal: ver a los estudiantes.
Al final, una celda a todo el ancho abre la Bandeja de Bienestar (la app que usaría una institución).
Sus estilos están en public/estilos-inicio.css.
"""
ESTILOS = ["estilos-inicio.css"]
SCRIPTS = ["inicio"]


def cuerpo(lista_pasos=None):
    # `lista_pasos` ya no se usa aquí: los 9 pasos viven en «Cómo se hizo» (se conserva la firma).
    return """    <section class="seccion seccion-primera tablero-zona">
      <div class="envoltura">
        <header class="bienvenida">
          <h1>Alerta temprana de deserción</h1>
          <p>Elige qué quieres hacer. Puedes consultar el grupo o aprender con un ejemplo.</p>
        </header>
        <nav class="rutas-inicio" aria-label="Por dónde empezar">
          <a href="aviso-docente.html"><small>Para profesores</small><strong>Enviar un aviso a Bienestar</strong><span>Indica qué has observado para que el equipo pueda dar seguimiento al estudiante.</span></a>
          <a href="evaluar.html"><small>Para estudiantes</small><strong>Practicar con un caso</strong><span>Cambia un dato de un ejemplo ficticio y observa qué pasa con su nivel de riesgo.</span></a>
        </nav>
        <header class="resumen-grupo"><h2>Resumen del grupo de primer año</h2><a href="estudiantes.html">Consultar las fichas de estudiantes</a>
          <p class="t-pulso" id="t-pulso" aria-live="polite"><i aria-hidden="true"></i><span>Leyendo la base de datos…</span></p>
        </header>
        <div class="bento tablero">
          <section class="celda c4 t-alto" aria-labelledby="t-alto-rotulo">
            <span class="rotulo" id="t-alto-rotulo">Estudiantes con riesgo alto</span>
            <div class="t-alto-fila"><b class="cifra-grande" id="t-alto">–</b><p id="t-alto-sub">de los estudiantes calificados</p></div>
            <div id="t-niveles" class="t-niveles" role="img" aria-label="Reparto de los estudiantes por nivel de riesgo"></div>
            <ul id="t-leyenda" class="t-leyenda"></ul>
          </section>
          <section class="celda c8 t-programas" aria-labelledby="t-prog-rotulo">
            <div class="t-programas-cabeza"><span class="rotulo" id="t-prog-rotulo">Dónde se concentra el riesgo, por titulación</span>
              <ul class="t-leyenda t-leyenda-corta" aria-hidden="true"><li><i class="seg-alto"></i>alto</li><li><i class="seg-medio"></i>medio</li><li><i class="seg-bajo"></i>bajo</li></ul></div>
            <label class="orden-programas">Ordenar titulaciones
              <select id="orden-programas"><option value="proporcion">Por porcentaje de riesgo alto</option><option value="volumen">Por número de casos altos</option></select>
            </label>
            <div id="t-programas" class="t-barras"><p>Cargando…</p></div>
          </section>
          <a class="celda c4 t-enlace t-nota" href="modelo.html">
            <span class="rotulo">Calidad de las predicciones</span>
            <div id="t-notas" class="t-notas"><p>Cargando…</p></div>
            <span class="t-ir">Cómo le va al modelo</span>
          </a>
          <a class="celda c4 t-enlace" href="proceso.html">
            <span class="rotulo">Cómo se hizo</span>
            <p>De las reglas escritas a mano a una red neuronal, en nueve pasos con sus gráficas.</p>
            <span class="t-ir">Ver los pasos</span>
          </a>
          <section class="celda c4 t-avisos-celda" aria-labelledby="t-avisos-rotulo">
            <span class="rotulo" id="t-avisos-rotulo">Registros que necesitan revisión</span>
            <ul id="t-avisos" class="t-avisos"><li>Cargando…</li></ul>
          </section>
          <a class="celda t-enlace t-bandeja" href="bienestar.html">
            <div class="t-bandeja-texto">
              <span class="rotulo">Bandeja de Bienestar</span>
              <p>Así lo usaría el área de Bienestar de una universidad: a quién contactar esta semana, la agenda del día,
                los avisos de los profesores, mensajes por WhatsApp y un informe para la dirección.</p>
            </div>
            <span class="t-ir">Abrir la bandeja</span>
          </a>
        </div>
        <p class="nota t-honesto">Prototipo académico. La operación lee una base real y pública: estudiantes de primer
          año de la Universitat Politècnica de València (España). Su modelo usa un contrato ampliado: además de los 12 datos,
          las notas del primer cuatrimestre, la actividad en el campus y en el aula virtual, la admisión y la tasa de abandono
          de la titulación. La asistencia y el trabajo son aproximaciones y el estrato no existe. «Probar un
          caso» y «Cómo se hizo» usan ese mismo modelo. No se usa para decidir sobre
          estudiantes reales.</p>
      </div>
    </section>"""
