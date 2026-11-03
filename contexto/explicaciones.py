"""Textos que explican, en la terminal, el significado de cada caso y de cada resultado."""
import textwrap

ANCHO = 100

QUE_PRUEBA = {
    "R01": "Estudiante sin ningún factor de riesgo (caso típico de todos los días).",
    "R02": "Estudiante con varios factores moderados: promedio 3.2, 1 materia perdida, 80% de asistencia, estrato 2 y trabaja.",
    "R03": "Estudiante con todos los factores de riesgo a la vez.",
    "R04": "Caso típico, pero sin el dato opcional de deuda de matrícula.",
    "R05": "Estudiante con buen promedio, pero 2 materias perdidas y deuda de matrícula.",
    "S01": "Falta el promedio acumulado, que es obligatorio.",
    "S02": "La asistencia llega vacía (null).",
    "S03": "Dice que perdió 5 materias de 4 cursadas: imposible.",
    "S04": "Estudiante 'activo' con 0 créditos inscritos.",
    "S05": "Estudiante de posgrado: el sistema no está hecho para él.",
    "S06": "Estudiante de semestre 7: fuera de la ventana de deserción temprana (semestres 2 a 4).",
    "S07": "Estudiante graduado al que además le falta el promedio: dos problemas a la vez.",
    "S08": "Promedio 38: viene en escala 0-100 en vez de 0-5.",
    "S09": "Semestre escrito como texto \"3\" en vez de número.",
    "S10": "Trabaja = \"no\" (texto) en vez de false.",
    "S11": "\"Pregrado\" con mayúscula; el valor permitido es \"pregrado\".",
    "S12": "Promedio 3.0 y asistencia 70 exactos: justo en los umbrales.",
    "S13": "Puntaje exactamente 60: la frontera entre riesgo medio y alto.",
    "S14": "Promedio 2.99 y asistencia 69.9: suma 50 (medio), pero activa la regla especial R3.4.",
    "S15": "Semestre = true (booleano). En Python, True vale 1.",
    "T01": "Asistencia 0.92: parece venir como proporción (92%) y no como porcentaje.",
    "T02": "Promedio \"3,8\" con coma decimal, como sale de Excel en español.",
    "T03": "Semestre 3.0 (decimal) en vez de 3 (entero).",
    "T04": "Trabaja = 1 (número) en vez de true.",
    "T05": "\"pregrado \" con un espacio invisible al final.",
    "T06": "El id del estudiante son solo espacios: la clave existe pero está vacía.",
    "T07": "El promedio llega con la clave mal escrita (\"Promedio_acumulado\").",
    "T08": "Dos errores de formato a la vez: semestre como texto y promedio 38.",
    "T09": "Estudiante de posgrado y además estrato 9 (fuera de rango).",
    "T10": "Estudiante retirado y con 0 créditos.",
    "T11": "Perdió 6 de 6 materias: el límite exacto de la regla de contradicción.",
    "T12": "Semestre 3 pero 0 materias cursadas el periodo anterior: no hay evidencia.",
    "T13": "Semestre 4, promedio 3.5 y asistencia 84.99: tres bordes a la vez.",
    "T14": "Promedio 2.99 pero asistencia exactamente 70: la regla R3.4 se cumple solo a medias.",
    "T15": "Solo promedio 2.9: puntaje exactamente 30, frontera entre bajo y medio.",
}

POR_QUE_ESPERADO = {
    "R01": "No suma puntos en ningún factor, así que el riesgo es bajo y basta el seguimiento normal.",
    "R02": "15 (promedio) + 10 (1 perdida) + 10 (asistencia) + 10 (estrato) + 5 (trabaja) = 50, que es riesgo medio: tutoría académica.",
    "R03": "Suma 100, el máximo: riesgo alto, remisión a bienestar y tutoría.",
    "R04": "Suma 15, riesgo bajo. La deuda no se inventa: se avisa que no llegó para que el consejero lo tenga en cuenta.",
    "R05": "25 (2 perdidas) + 10 (asistencia) + 10 (deuda) = 45, riesgo medio.",
    "S01": "Sin promedio no se puede calcular el riesgo sin inventar datos. Lo correcto es abstenerse y pasar el caso a un humano.",
    "S02": "null significa 'no hay dato', no 0%. Se abstiene igual que si el campo faltara.",
    "S03": "Los datos se contradicen; decidir con ellos sería adivinar. Se remite a un humano.",
    "S04": "Activo sin créditos indica un registro desactualizado o mal cargado. Se remite a un humano.",
    "S05": "Darle un nivel de riesgo a alguien fuera de la población no tiene sentido. Debe abstenerse.",
    "S06": "El sistema solo atiende semestres 2 a 4, así que debe abstenerse.",
    "S07": "El contrato revisa la población antes que los faltantes: si es graduado, no importa qué dato le falte.",
    "S08": "El dato está mal formado: error controlado para que se corrija en el sistema de origen.",
    "S09": "Tipo incorrecto: error controlado. El sistema no adivina conversiones.",
    "S10": "Tipo incorrecto. Si se aceptara, el texto \"no\" contaría como que sí trabaja.",
    "S11": "No coincide exactamente con los valores permitidos: se rechaza para que se corrija en el origen.",
    "S12": "3.0 cae en 3.0 <= p < 3.5 (+15), 70 cae en 70 <= a < 85 (+10) y la materia perdida suma +10: 35, riesgo medio.",
    "S13": "El corte '>= 60' es inclusivo: 60 ya es riesgo alto.",
    "S14": "La regla R3.4 (promedio < 3.0 Y asistencia < 70) sube el caso a alto aunque el puntaje sea 50.",
    "S15": "Un booleano no es un semestre válido: error de tipo.",
    "T01": "Una asistencia real de 0.92% es casi imposible en alguien activo; lo prudente es que un humano revise la escala.",
    "T02": "\"3,8\" es texto, no número: error para que se corrija en el origen.",
    "T03": "El semestre debe ser un entero: error de tipo.",
    "T04": "El campo debe ser booleano (true/false): error de tipo.",
    "T05": "No coincide exactamente con la lista de valores: valor no permitido.",
    "T06": "Un texto vacío equivale a un dato faltante: el sistema se abstiene y lo pide.",
    "T07": "El sistema no adivina nombres de campos: el promedio falta, así que se abstiene.",
    "T08": "Se reporta el primer error según el orden del contrato (semestre va antes que promedio).",
    "T09": "El formato se valida antes que la población: primero hay que corregir el dato roto.",
    "T10": "La población se revisa antes que las contradicciones: un retirado no se evalúa.",
    "T11": "6 de 6 es posible (no es 'mayor que'): resultado normal, 25 puntos, riesgo bajo.",
    "T12": "Sin materias cursadas no hay evidencia; '0 perdidas' no significa que le vaya bien. Revisa un humano.",
    "T13": "Semestre 4 sí entra; promedio 3.5 suma 0; asistencia 84.99 suma 10. Total 10, riesgo bajo.",
    "T14": "70 no es menor que 70, así que R3.4 no aplica: 30 + 10 = 40, riesgo medio.",
    "T15": "El corte '>= 30' es inclusivo: 30 ya es riesgo medio.",
}

POR_QUE_FALLA = {
    "R04": "v1 asume que la deuda siempre llega y se cae (KeyError) con un caso de todos los días.",
    "S01": "v1 no revisa campos faltantes: busca el promedio, no lo encuentra y se cae.",
    "S02": "v1 compara null < 70 y se cae (TypeError).",
    "S03": "v1 no cruza campos: calcula 25 puntos con datos imposibles y dice 'bajo'. FALLA SILENCIOSA.",
    "S04": "v1 no detecta la contradicción y dice 'bajo' como si todo estuviera bien. FALLA SILENCIOSA.",
    "S05": "v1 no revisa la población: califica a un estudiante de posgrado. FALLA SILENCIOSA.",
    "S06": "v1 no revisa la población: califica a un estudiante de semestre 7. FALLA SILENCIOSA.",
    "S07": "v1 no revisa población ni faltantes: se cae buscando el promedio.",
    "S08": "v1 no revisa rangos: 38 >= 3.5 suma 0 y dice 'bajo'. Un error de escala se vuelve una conclusión tranquilizadora. FALLA SILENCIOSA.",
    "S09": "v1 no revisa tipos y responde como si nada. FALLA SILENCIOSA.",
    "S10": "v1 lee el texto \"no\" como verdadero y suma 5 puntos por trabajar. FALLA SILENCIOSA.",
    "S11": "v1 no valida el valor y responde normalmente. FALLA SILENCIOSA.",
    "S14": "v1 no tiene la regla R3.4: deja en 'medio' a alguien con promedio y asistencia críticos.",
    "S15": "v1 acepta True como si fuera el semestre 1. FALLA SILENCIOSA.",
    "T01": "v2 acepta 0.92 porque está dentro de 0-100 y lo cuenta como asistencia bajísima. Es un hueco del contrato, no del código. FALLA SILENCIOSA.",
    "T06": "v2 lo trata como error de tipo en vez de dato faltante: el contrato no definía qué hacer con un texto vacío.",
    "T12": "v2 interpreta '0 perdidas' como algo bueno y dice 'bajo' sin evidencia. Es un hueco del contrato. FALLA SILENCIOSA.",
}

ACCIONES = {
    "seguimiento_rutinario": "seguimiento rutinario",
    "tutoria_academica": "tutoría académica",
    "remision_bienestar_y_tutoria": "remisión a bienestar y tutoría",
}
MOTIVOS = {
    "campo_faltante": "falta un dato obligatorio",
    "datos_contradictorios": "los datos se contradicen",
    "fuera_de_poblacion": "el estudiante no pertenece a la población del sistema",
    "tipo_invalido": "un dato tiene el tipo equivocado",
    "fuera_de_rango": "un dato está fuera del rango permitido",
    "valor_no_permitido": "un dato no está en la lista de valores permitidos",
    "error_interno": "ocurrió un imprevisto interno",
}

RESUMENES = {
    "Ronda 1 (v1)": "v1 solo implementa el camino feliz. Pasa casi todos los casos típicos, pero falla en casi todos los "
                    "adversariales. Lo grave no son las caídas, sino las fallas silenciosas: responde 'riesgo bajo' "
                    "con normalidad a casos que nunca debió calificar.",
    "Ronda 2 (v2)": "v2 implementa el contrato completo: valida tipos, rangos, población, faltantes y contradicciones, y "
                    "agrega la regla R3.4. Pasa todo, pero ojo: se corrigió mirando estos mismos casos.",
    "Ronda 3a (v2)": "Con 15 casos nuevos, v2 sin cambios resiste todos los ataques técnicos (tipos, orden, fronteras) y "
                     "no tiene regresiones. Sus 3 fallas vienen de reglas que el contrato no tenía: huecos del contrato, "
                     "no del código.",
    "Ronda 3b (v3)": "v3 agrega las tres reglas que faltaban (texto vacío = faltante, asistencia en escala 0-1, falta de "
                     "evidencia) y pasa los 35 casos. Sigue siendo sobre casos conocidos: el siguiente paso sería otra "
                     "ronda con casos nuevos.",
}


def lectura(obt):
    """Traduce la salida del sistema a lenguaje claro."""
    d = obt.get("decision")
    if d == "resultado":
        txt = (f"El sistema dio riesgo {obt['nivel'].upper()} ({obt['puntaje']} puntos) y recomienda "
               f"{ACCIONES.get(obt['accion'], obt['accion'])}.")
        if obt.get("datos_no_informados"):
            txt += f" Avisa que no llegó: {', '.join(obt['datos_no_informados'])}."
        return txt
    if d == "abstener":
        return f"El sistema NO decidió y envía el caso a un humano, porque {MOTIVOS.get(obt['motivo'], obt['motivo'])}."
    if d == "error":
        campo = f" (campo: {obt['campo']})" if obt.get("campo") else ""
        return f"El sistema rechazó la entrada con un error controlado: {MOTIVOS.get(obt['motivo'], obt['motivo'])}{campo}."
    if d == "excepcion":
        return f"El sistema SE CAYÓ con {obt.get('detalle')}. Esto nunca debería pasar: viola la garantía 'nunca lanza excepción'."
    return str(obt)


def _bloque(etiqueta, texto):
    return textwrap.fill(texto, ANCHO, initial_indent=f"  {etiqueta}",
                         subsequent_indent=" " * (len(etiqueta) + 2))


def imprimir_caso(id_, origen, esperado_corto, obtenido_corto, obt, pasa):
    marca = "PASA " if pasa else "FALLA"
    print("-" * ANCHO)
    print(f"[{marca}] {id_}  ({origen})")
    print(_bloque("Qué prueba:  ", QUE_PRUEBA.get(id_, "-")))
    print(_bloque("Esperado:    ", esperado_corto))
    print(_bloque("Obtenido:    ", obtenido_corto))
    print(_bloque("Qué hizo:    ", lectura(obt)))
    if pasa:
        print(_bloque("Significado: ", "Correcto. " + POR_QUE_ESPERADO.get(id_, "")))
    else:
        causa = POR_QUE_FALLA.get(id_, "La salida no coincide con el oráculo; revisar la traza.")
        print(_bloque("Significado: ", "Incorrecto. " + causa))
        print(_bloque("Lo correcto: ", POR_QUE_ESPERADO.get(id_, "")))


def imprimir_resumen(nombre, total, pasan, extra=""):
    print("=" * ANCHO)
    print(f"RESULTADO {nombre}: {pasan}/{total} pasan {extra}")
    if nombre in RESUMENES:
        print(textwrap.fill("Interpretación: " + RESUMENES[nombre], ANCHO))
    print("=" * ANCHO)
