"""Página «Inicio»: su HTML. La cabecera, la navegación y el pie los pone paginas_web.py.

Es un tablero en rejilla bento: una frase que dice qué es el sistema y celdas vivas que
public/js/inicio.js llena con la última lectura de la base real (/api/estudiantes) y con las
notas del modelo (reportes/real/resultados.json). Una sola acción principal: ver a los estudiantes.
Sus estilos están en public/estilos-inicio.css.
"""
ESTILOS = ["estilos-inicio.css"]
SCRIPTS = ["inicio"]


def cuerpo(lista_pasos=None):
    # `lista_pasos` ya no se usa aquí: los 9 pasos viven en «Cómo se hizo» (se conserva la firma).
    return """    <section class="seccion seccion-primera tablero-zona">
      <div class="envoltura">
        <div class="bento tablero">
          <section class="celda celda-tinta c5 f2 t-hero">
            <span class="rotulo">Alerta temprana de deserción</span>
            <h1>Lee la base de estudiantes y avisa a quién hay que ayudar antes de que se vaya.</h1>
            <p>Revisa cada registro, le da un nivel de riesgo y dice por qué y en qué ayudarle. Sin planillas y sin
              revisión a mano.</p>
            <p class="t-pulso" id="t-pulso" aria-live="polite"><i aria-hidden="true"></i><span>Leyendo la base de datos…</span></p>
            <a class="boton t-principal" href="estudiantes.html">Ver a los estudiantes</a>
          </section>
          <section class="celda c4 t-alto" aria-labelledby="t-alto-rotulo">
            <span class="rotulo" id="t-alto-rotulo">En riesgo alto hoy</span>
            <div class="t-alto-fila"><b class="cifra-grande" id="t-alto">–</b><p id="t-alto-sub">de los estudiantes calificados</p></div>
            <div id="t-niveles" class="t-niveles" role="img" aria-label="Reparto de los estudiantes por nivel de riesgo"></div>
            <ul id="t-leyenda" class="t-leyenda"></ul>
          </section>
          <a class="celda c3 t-enlace t-nota" href="modelo.html">
            <span class="rotulo">Nota del modelo</span>
            <div id="t-notas" class="t-notas"><p>Cargando…</p></div>
            <span class="t-ir">Cómo le va al modelo</span>
          </a>
          <section class="celda c7 t-programas" aria-labelledby="t-prog-rotulo">
            <div class="t-programas-cabeza"><span class="rotulo" id="t-prog-rotulo">Dónde se concentra el riesgo, por titulación</span>
              <ul class="t-leyenda t-leyenda-corta" aria-hidden="true"><li><i class="seg-alto"></i>alto</li><li><i class="seg-medio"></i>medio</li><li><i class="seg-bajo"></i>bajo</li></ul></div>
            <div id="t-programas" class="t-barras"><p>Cargando…</p></div>
          </section>
          <a class="celda c4 t-enlace" href="evaluar.html">
            <span class="rotulo">Probar un caso</span>
            <p>Llene los 12 datos de un estudiante y vea su ficha, paso a paso por el contrato.</p>
            <span class="t-ir">Abrir la planilla</span>
          </a>
          <a class="celda c4 t-enlace" href="proceso.html">
            <span class="rotulo">Cómo se hizo</span>
            <p>De las reglas escritas a mano a una red neuronal, en nueve pasos con sus gráficas.</p>
            <span class="t-ir">Ver los pasos</span>
          </a>
          <section class="celda c4 t-avisos-celda" aria-labelledby="t-avisos-rotulo">
            <span class="rotulo" id="t-avisos-rotulo">Lo que el sistema resolvió solo</span>
            <ul id="t-avisos" class="t-avisos"><li>Cargando…</li></ul>
          </section>
        </div>
        <p class="nota t-honesto">Prototipo académico. La operación lee una base real y pública: estudiantes de primer
          año de la Universitat Politècnica de València (España). Su modelo usa un contrato ampliado: además de los 12 datos,
          las notas del primer cuatrimestre, la actividad en el campus y en el aula virtual, la admisión y la tasa de abandono
          de la titulación. La asistencia y el trabajo son aproximaciones y el estrato no existe. «Probar un
          caso» y «Cómo se hizo» usan el modelo construido con datos sintéticos. No se usa para decidir sobre
          estudiantes reales.</p>
      </div>
    </section>"""
