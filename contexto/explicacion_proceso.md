# Explicación del proceso y resultados
## Práctica de pruebas de estrés – Sistema de alerta temprana de deserción universitaria

Documento explicativo que acompaña a `practica_pruebas_estres.md` y a `artefactos_practica.zip`.
Aquí no solo se muestra **qué** se entregó, sino **por qué** se tomó cada decisión,
**cómo** se ejecutó cada prueba y **qué significan** los resultados.

---

## Índice

1. Contexto: qué pedía la práctica
2. Punto de partida y el primer supuesto
3. El sistema evaluado
4. Paso 1 – El contrato, campo por campo y regla por regla
5. Paso 2 – Los 5 casos típicos, calculados a mano
6. Paso 3 – Los 15 casos adversariales y la lógica detrás de cada uno
7. Paso 4 – El oráculo y por qué va separado
8. Paso 5 – La versión 1 y la ronda 1
9. Paso 6 – La versión 2 y la ronda 2
10. Paso 7 – La biblioteca de prompts
11. Paso 8 – Los diagramas
12. Paso 9 – Segunda iteración: contrato v2, casos nuevos, ronda 3
13. Resultados consolidados
14. Lecciones aprendidas
15. Limitaciones y amenazas a la validez
16. Cómo reproducir todo
17. Glosario
18. Conclusiones

---

## 1. Contexto: qué pedía la práctica

La práctica de clase propone una metodología para someter a pruebas de estrés
un sistema que toma decisiones (con o sin IA).

La idea central es simple pero exigente:

- Primero se escribe un **contrato**: qué entra, qué sale y con qué reglas.
- Después se construyen **datos** para probarlo: algunos típicos y muchos hostiles.
- Luego se escribe la **respuesta esperada** (el oráculo), separada de los datos.
- Se **ejecuta** una primera versión del sistema y se compara lo obtenido con lo esperado.
- Se **corrige** y se vuelve a ejecutar.
- Al final se guardan los **artefactos**: código, datos, prompts y diagramas.

La metodología insiste en tres reglas que guiaron todo el trabajo:

1. **El orden importa.** El oráculo se escribe después de los casos y aparte de ellos.
   Si se escribe junto a los casos, quien los diseña tiende a inventar casos
   "fáciles de responder" en lugar de casos que rompan el sistema.
2. **No maquillar resultados.** Si algo falla, se reporta. Si no se ejecutó código,
   se dice "ejecución simulada a mano".
3. **Las personas firman el oráculo.** Si el mismo modelo escribe el sistema y la
   respuesta esperada, la prueba mide qué tan coherente es consigo mismo,
   no si el sistema hace lo correcto.

En este trabajo **todo el código se ejecutó de verdad** en Python 3,
sin librerías externas. Ningún resultado de las rondas es simulado.

---

## 2. Punto de partida y el primer supuesto

El documento de la práctica decía:

> El sistema a evaluar está en el archivo/texto adjunto: [ADJUNTO]

Pero el adjunto no traía ningún sistema: el texto `[ADJUNTO]` era un espacio
sin rellenar. La propia metodología resuelve este caso:

> Si falta información para alguna regla, NO preguntes ni te detengas:
> elige el supuesto más razonable, márcalo como [SUPUESTO] y sigue.

### ¿Por qué el sistema de deserción?

Se eligió el sistema de **alerta temprana de deserción universitaria** por cuatro razones:

| Razón | Explicación |
|---|---|
| Es un proyecto propio | Ya existe un trabajo sobre deserción en Colombia con un sistema predictivo de alerta temprana |
| Es un sistema con IA que decide | Clasifica estudiantes por riesgo, que es exactamente el tipo de sistema que pide la práctica |
| Tiene consecuencias reales | Un error puede dejar sin apoyo a un estudiante en riesgo, o etiquetar mal a uno que no lo está |
| Tiene datos ricos para atacar | Mezcla datos académicos, socioeconómicos y administrativos, con muchas formas de llegar mal |

Después confirmaste que el sistema correcto era este ("si con lo de deserción"),
así que el supuesto quedó validado.

### Qué se prueba y qué no

Es importante aclarar el alcance:

- **Sí se prueba** la capa de reglas que rodea al modelo: validación de la entrada,
  cálculo del puntaje, decisión del nivel y acción recomendada.
- **No se prueba** la precisión estadística de un modelo de machine learning
  (por ejemplo, su AUC o su recall). Eso requiere otra metodología y datos reales.

En un sistema real, el modelo predictivo produciría un puntaje o probabilidad,
y alrededor de él habría exactamente este tipo de reglas: quién puede ser evaluado,
qué hacer si faltan datos, cuándo remitir a un humano.
Esas reglas son las que más fallan en producción, y son las que esta práctica ataca.

---

## 3. El sistema evaluado

### Descripción en cinco líneas

- **Recibe:** el registro de un estudiante (12 campos académicos y socioeconómicos).
- **Valida:** que los datos estén bien formados, completos, coherentes y que el
  estudiante pertenezca a la población atendida.
- **Calcula:** un puntaje de riesgo de 0 a 100 sumando puntos por factores de riesgo.
- **Decide:** un nivel (bajo, medio, alto) y una acción (seguimiento, tutoría, remisión).
- **Devuelve:** el resultado, o un error controlado, o una abstención que envía el caso a un humano.

### Las tres salidas posibles

| Salida | Cuándo ocurre | Qué significa para la institución |
|---|---|---|
| `resultado` | Los datos son válidos y el estudiante pertenece a la población | El sistema recomienda una acción |
| `error` | Un dato está mal formado (tipo, rango, valor no permitido) | Hay que corregir el dato en el sistema de origen |
| `abstener` | Falta un dato, hay contradicción o el estudiante no es de la población | Un consejero humano revisa el caso |

La distinción entre `error` y `abstener` es clave:

- El **error** dice "el dato está roto": es un problema técnico.
- La **abstención** dice "no me corresponde decidir": es una decisión prudente.

Un sistema que confunde estas dos cosas, o que no tiene ninguna de las dos,
termina dando resultados a casos que no debería tocar.

### La cadena de pasos

```
E (entrada) → Paso 1: validar → Paso 2: puntaje → Paso 3: nivel y acción
```

Cada paso tiene una entrada y una salida (S1, S2, S3). Si el Paso 1 no da "válido",
la cadena se detiene ahí y nunca llega a calcular un puntaje.

---

## 4. Paso 1 – El contrato, campo por campo y regla por regla

### 4.1 La entrada E

El contrato define 12 campos. Para cada uno se fijó tipo, rango y si es obligatorio.

| Campo | Tipo | Rango | Obligatorio | Por qué existe |
|---|---|---|---|---|
| id_estudiante | texto no vacío | — | Sí | Para trazar a quién se refiere cada alerta |
| nivel_formacion | enum | pregrado, posgrado, educacion_continua | Sí | Define si el estudiante es de la población |
| estado_matricula | enum | activo, retirado, graduado | Sí | Solo tiene sentido alertar a quien sigue estudiando |
| semestre | entero | 1 a 12 | Sí | El foco es la deserción temprana |
| promedio_acumulado | número | 0.0 a 5.0 | Sí | Escala colombiana; principal señal académica |
| creditos_inscritos | entero | 0 a 25 | Sí | Indica carga académica actual |
| materias_cursadas_periodo_anterior | entero | 0 a 12 | Sí | Da contexto a las reprobadas |
| materias_reprobadas | entero | 0 a 12 | Sí | Señal fuerte de riesgo |
| porcentaje_asistencia | número | 0.0 a 100.0 | Sí | La inasistencia precede a la deserción |
| estrato | entero | 1 a 6 | Sí | Factor socioeconómico usado en Colombia |
| trabaja | booleano | true / false | Sí | Trabajar compite con el tiempo de estudio |
| deuda_matricula | booleano | true / false | No | Factor financiero; no siempre está disponible |

### 4.2 Decisiones de diseño en la entrada

**Escala del promedio (0.0 a 5.0).**
En Colombia las notas van de 0 a 5 y se aprueba con 3.0.
Fijar el rango permite detectar un promedio en escala 0–100, error común
cuando los datos vienen de sistemas distintos.

**`deuda_matricula` como opcional.** [SUPUESTO]
Muchas veces la información financiera la maneja otra dependencia y no llega
completa. Hacerla opcional obliga a decidir qué pasa cuando falta,
y ese "qué pasa" es una de las cosas que la práctica quiere probar.

**`null` es lo mismo que ausente.**
Un campo con valor `null` no es un error de tipo: es un dato que no está.
Esta regla evita que el sistema rechace como "mal formado" algo que simplemente falta.

**Booleanos estrictos.**
`trabaja` debe ser exactamente `true` o `false`. No vale `"no"`, ni `1`, ni `"sí"`.
Esto parece exagerado, pero en Python el texto `"no"` se evalúa como verdadero,
así que un sistema permisivo marcaría como trabajador a quien escribió "no".

### 4.3 Paso 1 – Validar la entrada

El Paso 1 aplica reglas en un orden fijo. La primera que se cumple termina el proceso.

| Orden | Regla | Condición | Salida |
|---|---|---|---|
| 1 | R1.1a | Tipo incorrecto | `error(tipo_invalido)` |
| 2 | R1.1b | Valor fuera de la lista del enum | `error(valor_no_permitido)` |
| 3 | R1.1c | Número fuera de rango | `error(fuera_de_rango)` |
| 4 | R1.2-P1 | No es pregrado | `abstener(fuera_de_poblacion)` |
| 5 | R1.2-P2 | No está activo | `abstener(fuera_de_poblacion)` |
| 6 | R1.2-P3 | Semestre fuera de 2 a 4 | `abstener(fuera_de_poblacion)` |
| 7 | R1.3 | Falta un obligatorio | `abstener(campo_faltante)` |
| 8 | R1.4-C1 | Reprobadas > cursadas | `abstener(datos_contradictorios)` |
| 9 | R1.4-C2 | Activo con 0 créditos | `abstener(datos_contradictorios)` |
| — | — | Nada de lo anterior | `válido` |

#### ¿Por qué este orden?

**Formato primero.** Si un dato está mal formado, no se puede razonar con él.
Por ejemplo, no se puede saber si un semestre `"3"` (texto) está en la población.

**Población antes que faltantes.** [SUPUESTO]
Si ya se sabe que alguien es graduado, no tiene sentido decirle "te falta el promedio".
La respuesta útil es "este sistema no te atiende".

**Contradicciones al final.** Solo se pueden comparar campos entre sí
cuando todos están presentes y bien formados.

#### ¿Por qué la población es semestres 2 a 4? [SUPUESTO]

- El proyecto de deserción parte de que la mayoría de la deserción ocurre en los
  primeros semestres; el sistema se enfoca en esa ventana.
- El semestre 1 se excluye porque el estudiante aún no tiene historial:
  no hay promedio acumulado ni materias del periodo anterior.
- A partir del semestre 5 el sistema no aplica (sería otro modelo).

#### Las dos contradicciones

- **C1: reprobadas > cursadas.** Es imposible reprobar más materias de las que se cursaron.
  Cada campo por separado puede estar en rango, pero juntos no tienen sentido.
- **C2: activo con 0 créditos.** Un estudiante activo sin materias inscritas
  indica un dato desactualizado o un error de registro.

### 4.4 Paso 2 – El puntaje de riesgo

El puntaje es **aditivo**: cada factor suma puntos. Esto lo hace transparente:
cualquier persona puede recalcularlo a mano y saber por qué salió ese número.

| Regla | Factor | Condición | Puntos |
|---|---|---|---|
| R2.1 | Promedio | < 3.0 | +30 |
| R2.1 | Promedio | 3.0 ≤ p < 3.5 | +15 |
| R2.1 | Promedio | ≥ 3.5 | 0 |
| R2.2 | Reprobadas | ≥ 2 | +25 |
| R2.2 | Reprobadas | = 1 | +10 |
| R2.3 | Asistencia | < 70 | +20 |
| R2.3 | Asistencia | 70 ≤ a < 85 | +10 |
| R2.3 | Asistencia | ≥ 85 | 0 |
| R2.4 | Estrato | ≤ 2 | +10 |
| R2.5 | Trabaja | true | +5 |
| R2.6 | Deuda | true | +10 |
| R2.6 | Deuda | ausente | 0 y se reporta como "no informado" |

El máximo posible es 30 + 25 + 20 + 10 + 5 + 10 = **100**.

#### Inclusividad de los umbrales

Cada umbral dice explícitamente si es inclusivo:

- Promedio exactamente 3.0 → cae en "3.0 ≤ p < 3.5" → suma 15, no 30.
- Asistencia exactamente 70 → cae en "70 ≤ a < 85" → suma 10, no 20.
- Asistencia exactamente 85 → cae en "≥ 85" → suma 0.

Sin esta precisión, dos programadores podrían implementar el mismo contrato
de dos maneras distintas y ambos creer que lo hicieron bien.

#### El caso de la deuda ausente

Si `deuda_matricula` no llega, el sistema:

- **no** suma los 10 puntos (no asume que hay deuda),
- **no** asume que no hay deuda en silencio,
- **sí** lo reporta en `datos_no_informados`.

Así el consejero que lee la alerta sabe que el puntaje podría ser más alto.

### 4.5 Paso 3 – Nivel y acción

| Orden | Regla | Condición | Nivel | Acción |
|---|---|---|---|---|
| 1 | R3.4 | promedio < 3.0 **y** asistencia < 70 | alto | remisión a bienestar y tutoría |
| 2 | R3.1 | puntaje ≥ 60 | alto | remisión a bienestar y tutoría |
| 3 | R3.2 | 30 ≤ puntaje < 60 | medio | tutoría académica |
| 4 | R3.3 | puntaje < 30 | bajo | seguimiento rutinario |

#### ¿Por qué existe la regla R3.4?

Un estudiante con promedio bajo y asistencia baja, pero sin más factores,
suma 30 + 20 = 50 puntos: quedaría en "medio".
Sin embargo, esa combinación es una señal clara de abandono en curso.
R3.4 es una **regla de anulación**: sin importar el puntaje, lo sube a "alto".

Este tipo de regla es justamente lo que una primera versión suele olvidar,
porque no aparece en el camino feliz del puntaje.

### 4.6 Garantías del contrato

| Garantía | Qué significa en la práctica |
|---|---|
| Nunca lanza excepción | Todo termina en resultado, error o abstención; el sistema no "se cae" |
| Nunca inventa datos | Un faltante no se trata como 0, false ni vacío |
| Nunca califica fuera de población | Un posgrado o un graduado nunca recibe un nivel de riesgo |
| Umbrales inclusivos como están escritos | ≤ es ≤ y < es <, sin interpretaciones |

Estas garantías son lo que después se intenta romper con los casos adversariales.

---

## 5. Paso 2 – Los 5 casos típicos, calculados a mano

Estos casos representan lo que el sistema vería un día normal.
Están marcados como **[DATOS TÍPICOS INVENTADOS: reemplazar por reales]**
porque no se contó con registros reales de estudiantes.

Todos comparten: pregrado, activo, 6 materias cursadas, salvo que se indique.

### R01 – Estudiante sin factores de riesgo

| Campo | Valor | Puntos |
|---|---|---|
| promedio | 3.8 | 0 (≥ 3.5) |
| reprobadas | 0 | 0 |
| asistencia | 92 | 0 (≥ 85) |
| estrato | 3 | 0 |
| trabaja | false | 0 |
| deuda | false | 0 |
| **Total** | | **0 → bajo** |

Este caso además sirve como **base** de todos los adversariales:
cada caso hostil parte de R01 y cambia lo mínimo.

### R02 – Riesgo medio

| Campo | Valor | Puntos |
|---|---|---|
| promedio | 3.2 | +15 |
| reprobadas | 1 | +10 |
| asistencia | 80 | +10 |
| estrato | 2 | +10 |
| trabaja | true | +5 |
| deuda | false | 0 |
| **Total** | | **50 → medio** |

### R03 – Riesgo alto con todos los factores

| Campo | Valor | Puntos |
|---|---|---|
| promedio | 2.7 | +30 |
| reprobadas | 3 de 5 | +25 |
| asistencia | 65 | +20 |
| estrato | 1 | +10 |
| trabaja | true | +5 |
| deuda | true | +10 |
| **Total** | | **100 → alto** |

Además cumple R3.4 (promedio < 3.0 y asistencia < 70). Llega a alto por dos caminos.

### R04 – Deuda no informada

| Campo | Valor | Puntos |
|---|---|---|
| promedio | 4.1 | 0 |
| reprobadas | 0 | 0 |
| asistencia | 88 | 0 |
| estrato | 2 | +10 |
| trabaja | true | +5 |
| deuda | *(ausente)* | 0, se reporta |
| **Total** | | **15 → bajo**, con `datos_no_informados: [deuda_matricula]` |

Este caso es "típico" pero esconde una trampa: el campo opcional falta.
Es un caso cotidiano que, como se verá, rompió la versión 1.

### R05 – Riesgo medio por reprobadas

| Campo | Valor | Puntos |
|---|---|---|
| promedio | 3.6 | 0 |
| reprobadas | 2 | +25 |
| asistencia | 78 | +10 |
| estrato | 4 | 0 |
| trabaja | false | 0 |
| deuda | true | +10 |
| **Total** | | **45 → medio** |

---

## 6. Paso 3 – Los 15 casos adversariales

### 6.1 La estrategia: cambio mínimo sobre una base sana

Cada caso adversarial parte de R01 (el estudiante sin riesgo)
y cambia **uno o dos campos**. Esto tiene una ventaja enorme:

- Si el caso falla, se sabe exactamente qué lo rompió.
- Si se cambiaran muchos campos a la vez, no se sabría cuál causó el problema.

Es el mismo principio de un experimento controlado: aislar la variable.

### 6.2 Cobertura exigida por la práctica

| Categoría exigida | Casos que la cubren |
|---|---|
| Campos faltantes | S01, S02, S07 |
| Campos contradictorios | S03, S04 |
| Otra población | S05, S06, S07 |
| Fuera de rango u otro tipo/escala | S08, S09, S10, S11, S15 |
| Valores justo en umbrales | S12, S13, S14 |
| Respuesta correcta = abstenerse | S01 a S07 |

### 6.3 Caso por caso

**S01 – Falta el promedio.**
La clave `promedio_acumulado` no existe.
Ataca la garantía "nunca inventa datos". Una versión ingenua hace
`e["promedio_acumulado"]` y lanza `KeyError`, o usa `0` por defecto
y termina marcando al estudiante como riesgo alto por un dato inventado.

**S02 – Asistencia en null.**
La clave existe pero vale `null`. Es más sutil que S01: un chequeo del tipo
"¿está la clave?" lo deja pasar, y luego `None < 70` revienta en Python.

**S03 – Reprobó 5 de 4 materias.**
Cada número está dentro de su rango; solo la relación entre ellos es imposible.
Ataca a los sistemas que validan campo por campo pero nunca los cruzan.

**S04 – Activo con 0 créditos.**
El 0 es un valor permitido. La contradicción es de significado, no de formato.

**S05 – Estudiante de posgrado.**
Todos los demás datos son perfectos. Es el caso más peligroso para un sistema
sin control de población: no hay nada "raro" que lo delate.

**S06 – Semestre 7.**
El 7 está dentro del rango 1–12, así que no es un error. Pero está fuera
de la población (2–4). Distingue entre "dato inválido" y "caso que no me toca".

**S07 – Graduado y sin promedio.**
Dos motivos de abstención a la vez. Prueba si el sistema respeta el orden
definido (población antes que faltantes).

**S08 – Promedio 38.**
Escala 0–100 en vez de 0–5. Sin validación de rango, 38 es ≥ 3.5,
suma 0 puntos y el estudiante sale "bajo". Un error de escala se convierte
en una conclusión tranquilizadora y falsa.

**S09 – Semestre "3" como texto.**
Muy común cuando los datos vienen de un CSV o un formulario web.

**S10 – Trabaja = "no".**
En Python `bool("no")` es `True`. Una versión ingenua suma 5 puntos
como si el estudiante trabajara. El dato dice lo contrario de lo que el sistema entiende.

**S11 – "Pregrado" con mayúscula.**
Plantea una decisión de diseño: ¿normalizar en silencio o rechazar?
El contrato dice rechazar, para que el error se corrija en el origen.

**S12 – Promedio 3.0 y asistencia 70 exactos.**
Dos valores justo en umbrales inclusivos.
Si alguien escribió `<=` en lugar de `<`, el puntaje cambia.
Además verifica que R3.4 no se active (3.0 no es menor que 3.0).

**S13 – Puntaje exactamente 60.**
Está en la frontera entre medio y alto. Con `>` en lugar de `>=`, saldría medio.

**S14 – Promedio 2.99 y asistencia 69.9.**
Suma 50 (medio), pero activa R3.4 y debe salir alto.
Ataca la regla de excepción que no está en el camino feliz.

**S15 – Semestre = true.**
Trampa propia de Python: `bool` es subclase de `int`.
`isinstance(True, int)` devuelve `True` y `True` vale 1.
Un chequeo de tipo "normal" lo acepta como el semestre 1.

### 6.4 Lo que NO se puso en la tabla

La tabla de casos adversariales **no incluye la respuesta esperada**.
Esa es la regla clave del Paso 3. La razón es psicológica:
si al diseñar un caso ya se piensa en su respuesta,
se tiende a crear casos cuya respuesta es obvia.

---

## 7. Paso 4 – El oráculo y por qué va separado

### 7.1 Qué es el oráculo

El oráculo es la lista de **respuestas correctas** para cada uno de los 20 casos.
Es contra lo que se compara la salida del sistema para decir PASA o FALLA.

### 7.2 Cómo se construyó

Se aplicó el contrato regla por regla, a mano, para cada caso.
Cada fila indica la regla que justifica la respuesta:

| ID | Decisión | Detalle | Regla |
|---|---|---|---|
| R01 | resultado | bajo, 0 | Nada suma → R3.3 |
| R02 | resultado | medio, 50 | 15+10+10+10+5 → R3.2 |
| R03 | resultado | alto, 100 | Todos los factores → R3.1 |
| R04 | resultado | bajo, 15, deuda no informada | 10+5 → R3.3 |
| R05 | resultado | medio, 45 | 25+10+10 → R3.2 |
| S01 | abstener | campo_faltante | R1.3 |
| S02 | abstener | campo_faltante | R1.3 (null = faltante) |
| S03 | abstener | datos_contradictorios | R1.4-C1 |
| S04 | abstener | datos_contradictorios | R1.4-C2 |
| S05 | abstener | fuera_de_poblacion | R1.2-P1 |
| S06 | abstener | fuera_de_poblacion | R1.2-P3 |
| S07 | abstener | fuera_de_poblacion | R1.2-P2 (antes que faltantes) |
| S08 | error | fuera_de_rango | R1.1c |
| S09 | error | tipo_invalido | R1.1a |
| S10 | error | tipo_invalido | R1.1a |
| S11 | error | valor_no_permitido | R1.1b |
| S12 | resultado | medio, 35 | 15+10+10 → R3.2 |
| S13 | resultado | alto, 60 | ≥ 60 inclusivo → R3.1 |
| S14 | resultado | alto, 50 | R3.4 anula el puntaje |
| S15 | error | tipo_invalido | R1.1a: bool no es int |

### 7.3 Distribución de respuestas esperadas

| Decisión esperada | Cantidad | Casos |
|---|---|---|
| resultado | 8 | R01–R05, S12, S13, S14 |
| abstener | 7 | S01–S07 |
| error | 5 | S08–S11, S15 |
| **Total** | **20** | |

Solo 8 de 20 casos (40 %) deberían producir un nivel de riesgo.
El resto exige que el sistema **no decida**. Esta proporción es intencional:
la mayoría de los fallos graves en sistemas de IA vienen de decidir cuando no se debía.

### 7.4 Por qué lo firman personas

El oráculo quedó marcado como **BORRADOR**. Hay un riesgo de fondo:
el mismo modelo escribió el contrato, los casos, el oráculo y el código.
Si interpretó mal una regla, la interpretó mal en todas partes de forma coherente,
y las pruebas pasarían igual. Eso no demostraría que el sistema funciona,
solo que es consistente consigo mismo.

Por eso el equipo debe revisar al menos:

- que cada cálculo de puntaje sea correcto,
- que el orden de las reglas del Paso 1 sea el que la institución quiere,
- que las decisiones de población y abstención sean las adecuadas.

---

## 8. Paso 5 – La versión 1 y la ronda 1

### 8.1 Qué es la versión 1

La práctica pide una v1 que implemente **solo el camino feliz**,
como suele quedar la primera versión real de un sistema.

`sistema_v1.py` hace esto:

- Calcula el puntaje con las reglas R2.1 a R2.6.
- Asigna nivel con los cortes de 60 y 30.
- **No** valida tipos, rangos ni enums.
- **No** revisa población ni contradicciones.
- **No** implementa la regla de excepción R3.4.
- Lee `deuda_matricula` como si siempre existiera.

Fragmento representativo:

```python
def paso2_puntaje(e):
    p = 0
    prom = e["promedio_acumulado"]   # asume que existe
    if prom < 3.0:
        p += 30
    elif prom < 3.5:
        p += 15
    ...
    if e["trabaja"]:                 # "no" se evalúa como verdadero
        p += 5
    if e["deuda_matricula"]:         # KeyError si falta
        p += 10
    return p
```

No se introdujeron errores artificiales en los cálculos.
Los umbrales están bien escritos. Las fallas que aparecen vienen
de lo que **falta**, no de lo que está mal. Así es una v1 realista.

### 8.2 Cómo se ejecutó

Se escribió `correr_rondas.py`, un arnés de pruebas que:

1. Recorre los 20 casos.
2. Llama a `evaluar(entrada)` del sistema.
3. Si el sistema lanza una excepción, la captura y la registra como `EXCEPCIÓN`.
4. Compara lo obtenido con el oráculo.
5. Registra la traza S1, S2, S3 de cada caso.
6. Guarda todo en `resultados_rondas.json`.

La comparación usa estas reglas:

- Si la decisión esperada es `resultado`, deben coincidir nivel, puntaje,
  acción y lista de datos no informados.
- Si es `abstener` o `error`, debe coincidir el motivo.

Comando ejecutado:

```bash
python3 dataset.py && python3 correr_rondas.py
```

### 8.3 Resultados de la ronda 1

| ID | Esperado | Obtenido | Resultado |
|---|---|---|---|
| R01 | bajo (0) | bajo (0) | PASA |
| R02 | medio (50) | medio (50) | PASA |
| R03 | alto (100) | alto (100) | PASA |
| R04 | bajo (15) + no informado | EXCEPCIÓN KeyError | FALLA |
| R05 | medio (45) | medio (45) | PASA |
| S01 | abstener(campo_faltante) | EXCEPCIÓN KeyError | FALLA |
| S02 | abstener(campo_faltante) | EXCEPCIÓN TypeError | FALLA |
| S03 | abstener(contradictorios) | bajo (25) | FALLA |
| S04 | abstener(contradictorios) | bajo (0) | FALLA |
| S05 | abstener(fuera_poblacion) | bajo (0) | FALLA |
| S06 | abstener(fuera_poblacion) | bajo (0) | FALLA |
| S07 | abstener(fuera_poblacion) | EXCEPCIÓN KeyError | FALLA |
| S08 | error(fuera_de_rango) | bajo (0) | FALLA |
| S09 | error(tipo_invalido) | bajo (0) | FALLA |
| S10 | error(tipo_invalido) | bajo (5) | FALLA |
| S11 | error(valor_no_permitido) | bajo (0) | FALLA |
| S12 | medio (35) | medio (35) | PASA |
| S13 | alto (60) | alto (60) | PASA |
| S14 | alto (50) | medio (50) | FALLA |
| S15 | error(tipo_invalido) | bajo (0) | FALLA |

**Ronda 1: 6/20 pasan.**

### 8.4 Lectura de los resultados

#### Por origen

| Grupo | Pasan | Porcentaje |
|---|---|---|
| Típicos (R) | 4/5 | 80 % |
| Adversariales (S) | 2/15 | 13 % |
| **Total** | **6/20** | **30 %** |

Un 80 % en casos típicos podría hacer creer que v1 "casi funciona".
Los adversariales muestran que no: falla en 13 de 15.
Esta es la razón de existir de la práctica: **los casos típicos no bastan**.

#### Por tipo de falla

| Tipo de falla | Casos | Cantidad |
|---|---|---|
| Excepción (el sistema se cae) | R04, S01, S02, S07 | 4 |
| Silenciosa (resultado falso pero creíble) | S03, S04, S05, S06, S08, S09, S10, S11, S14, S15 | 10 |
| **Total de fallas** | | **14** |

Este es el hallazgo más importante de la ronda 1:

- Las **excepciones** son molestas, pero visibles: alguien nota que el sistema se cayó.
- Las **fallas silenciosas** son peligrosas: el sistema responde con total normalidad
  algo falso. Un estudiante de posgrado recibe "seguimiento rutinario".
  Un promedio mal escalado produce "riesgo bajo". Nadie se entera.

10 de las 14 fallas (71 %) son silenciosas.
Además, casi todas producen "bajo", la conclusión más tranquilizadora.
En un sistema de alerta temprana, eso significa estudiantes en riesgo sin atención.

#### Por paso donde falla

| Paso | Fallas | Casos |
|---|---|---|
| Paso 1 (validación inexistente) | 12 | S01–S11, S15 |
| Paso 2 (opcional mal leído) | 1 | R04 |
| Paso 3 (regla de excepción faltante) | 1 | S14 |

Casi todo el problema está en el Paso 1, que en v1 simplemente no existe.

#### Qué sí funcionó

S12 y S13 pasaron. Esto confirma que los umbrales de v1 estaban bien
implementados (`<`, `>=` correctos). Las fronteras no fueron el problema;
el problema fue todo lo que rodea al cálculo.

### 8.5 Análisis de cada falla y su corrección

| ID | Paso | Causa | Corrección |
|---|---|---|---|
| R04 | 2 | `e["deuda_matricula"]` asume que el opcional existe | Usar `e.get()`; si falta, reportar |
| S01 | 1 | No hay chequeo de obligatorios | R1.3: ausente → abstener |
| S02 | 1 | `null` no se trata como faltante | R1.3: null → abstener |
| S03 | 1 | No se cruzan campos | R1.4-C1 |
| S04 | 1 | No se cruzan campos | R1.4-C2 |
| S05 | 1 | No hay control de población | R1.2-P1 |
| S06 | 1 | No hay control de población | R1.2-P3 |
| S07 | 1 | No hay orden de reglas | Población antes que faltantes |
| S08 | 1 | No hay chequeo de rango | R1.1c |
| S09 | 1 | No hay chequeo de tipo | R1.1a |
| S10 | 1 | `"no"` es truthy | Tipo estricto + `trabaja is True` |
| S11 | 1 | Enum no validado | R1.1b, comparación exacta |
| S14 | 3 | Falta R3.4 | Evaluarla antes de los cortes |
| S15 | 1 | `bool` es `int` en Python | Excluir `bool` en campos enteros |

---

## 9. Paso 6 – La versión 2 y la ronda 2

### 9.1 Qué cambió en v2

`sistema_v2.py` implementa el contrato completo. Las correcciones principales:

**1. Un esquema declarativo.**
En lugar de chequear campo por campo con `if`, se define una tabla:

```python
ESQUEMA = {
    "semestre": ("int", (1, 12), True),
    "promedio_acumulado": ("num", (0.0, 5.0), True),
    "trabaja": ("bool", None, True),
    "deuda_matricula": ("bool", None, False),
    ...
}
```

Esto hace que el código refleje el contrato de forma casi literal.
Si el contrato cambia, se cambia una línea.

**2. Chequeo de tipo estricto.**

```python
def _tipo_ok(tipo, v):
    if tipo == "bool":
        return isinstance(v, bool)
    if tipo == "int":
        return isinstance(v, int) and not isinstance(v, bool)
    if tipo == "num":
        return (isinstance(v, (int, float)) and not isinstance(v, bool)
                and not math.isnan(v) and not math.isinf(v))
```

La línea `and not isinstance(v, bool)` es la corrección de S15.
También se rechazan `NaN` e infinito, que son números para Python
pero no tienen sentido como promedio o asistencia.

**3. Paso 1 completo y en orden.**
Formato → población → faltantes → contradicciones, exactamente como dice el contrato.

**4. El opcional se lee con `.get()`.**

```python
deuda = e.get("deuda_matricula")
if deuda is None:
    no_inf.append("deuda_matricula")
elif deuda is True:
    p += 10
```

**5. La regla R3.4 se evalúa primero en el Paso 3.**

**6. Red de seguridad.**
Todo `evaluar` está dentro de un `try/except` que convierte cualquier imprevisto
en `error(error_interno)`. Así se cumple la garantía "nunca lanza excepción"
incluso ante un caso que nadie previó.

### 9.2 Resultados de la ronda 2

| ID | Esperado | Obtenido | Resultado |
|---|---|---|---|
| R01 | bajo (0) | bajo (0) | PASA |
| R02 | medio (50) | medio (50) | PASA |
| R03 | alto (100) | alto (100) | PASA |
| R04 | bajo (15) + no inf. | bajo (15) + no inf. | PASA |
| R05 | medio (45) | medio (45) | PASA |
| S01 | abstener(campo_faltante) | abstener(campo_faltante) | PASA |
| S02 | abstener(campo_faltante) | abstener(campo_faltante) | PASA |
| S03 | abstener(contradictorios) | abstener(contradictorios) | PASA |
| S04 | abstener(contradictorios) | abstener(contradictorios) | PASA |
| S05 | abstener(fuera_poblacion) | abstener(fuera_poblacion) | PASA |
| S06 | abstener(fuera_poblacion) | abstener(fuera_poblacion) | PASA |
| S07 | abstener(fuera_poblacion) | abstener(fuera_poblacion) | PASA |
| S08 | error(fuera_de_rango) | error(fuera_de_rango) | PASA |
| S09 | error(tipo_invalido) | error(tipo_invalido) | PASA |
| S10 | error(tipo_invalido) | error(tipo_invalido) | PASA |
| S11 | error(valor_no_permitido) | error(valor_no_permitido) | PASA |
| S12 | medio (35) | medio (35) | PASA |
| S13 | alto (60) | alto (60) | PASA |
| S14 | alto (50) | alto (50) | PASA |
| S15 | error(tipo_invalido) | error(tipo_invalido) | PASA |

**Ronda 2: 20/20 pasan.**

### 9.3 Por qué el 20/20 no es suficiente

Un 20/20 suena a éxito total, pero hay que leerlo con cuidado:

- v2 se escribió **mirando** los 20 casos y sus fallas.
- Por lo tanto, era casi seguro que los pasaría.
- Esto se llama **sobreajuste a las pruebas**: el sistema aprende a pasar
  estas pruebas concretas, no necesariamente a manejar cualquier entrada.

Es el mismo problema que en machine learning cuando se evalúa un modelo
con los mismos datos con los que se entrenó.

La respuesta correcta a un 20/20 no es "terminamos", sino
"generemos casos nuevos que v2 no haya visto". Eso es lo que hace el Paso 9.

### 9.4 Un hueco detectado sin ningún caso

Al revisar v2 se notó un problema que **ningún caso cubría**:
si la asistencia llega como proporción (0.92 en lugar de 92),
el valor está dentro del rango 0–100, así que v2 lo acepta.
Luego 0.92 < 70, suma 20 puntos y el estudiante queda con asistencia "bajísima".
Este hueco se registró y se atacó en la segunda iteración.

---

## 10. Paso 7 – La biblioteca de prompts

Se guardaron tres prompts reutilizables. Cada uno tiene propósito,
momento de uso y una regla clave que no se debe romper.

### P1 – Generar 15 casos adversariales

| Elemento | Contenido |
|---|---|
| Propósito | Crear el dataset hostil a partir del contrato y los casos reales |
| Cuándo | Apenas existe el contrato, antes de programar |
| Regla clave | Nunca incluir la respuesta esperada |

Pide explícitamente: faltantes (ausente y null), contradicciones,
otra población, tipos y escalas, fronteras y abstenciones,
partiendo de un caso real y cambiando lo mínimo.

### P2 – 15 casos nuevos para la siguiente ronda

| Elemento | Contenido |
|---|---|
| Propósito | Atacar las correcciones desde otro ángulo y detectar sobreajuste |
| Cuándo | Después de una ronda con buen puntaje |
| Regla clave | No repetir entradas; atacar la causa, no el síntoma |

Ejemplos de "otro ángulo": el mismo tipo de error en otro campo,
dos errores a la vez, el otro lado de cada umbral,
unidades confundidas que siguen dentro de rango.

### P3 – Revisar el contrato antes de probar

| Elemento | Contenido |
|---|---|
| Propósito | Encontrar ambigüedades antes de que se vuelvan discusiones |
| Cuándo | Antes del Paso 2 y cada vez que cambie el contrato |
| Regla clave | Listar preguntas, no reescribir el contrato |

Busca: umbrales sin inclusividad, campos sin rango,
combinaciones sin regla, orden de evaluación indefinido,
dudas de abstención y tratamiento de null, vacío, NaN y texto numérico.

Los tres prompts se usaron de verdad: P1 para los casos S, P3 y P2 en la segunda iteración.

---

## 11. Paso 8 – Los diagramas

Se entregaron dos diagramas en Mermaid (se ven renderizados en GitHub,
Notion, Obsidian o en el editor en línea mermaid.live).

### Diagrama A – El sistema por pasos

Muestra la cadena E → Paso 1 → Paso 2 → Paso 3 con:

- Las dos salidas terminales del Paso 1: `error` (va a corregir el dato en origen)
  y `abstener` (va a un humano en consejería).
- La salida S2 con puntaje, factores y datos no informados.
- El Paso 3 con su orden de reglas (R3.4 primero) y las tres acciones posibles.

Sirve para explicar el sistema a alguien que no ha leído el contrato.

### Diagrama B – El proceso de la práctica

Muestra el ciclo completo:

```
contrato → 5 reales → 15 simulados → oráculo → ejecutar
    → ¿obtenido = esperado?
        → no: analizar, corregir, nueva ronda
        → sí: casos nuevos (P2) contra sobreajuste → artefactos
```

El detalle importante es que el "sí" no lleva directo al final:
lleva a generar casos nuevos. Ese bucle es el que se ejecutó en el Paso 9.

---

## 12. Paso 9 – Segunda iteración: contrato v2, casos nuevos, ronda 3

Cuando confirmaste el sistema de deserción y pediste "volver a iterar",
se hizo un ciclo completo adicional en cinco etapas.

### 12.1 Etapa A – Revisión del contrato con P3

Antes de crear casos nuevos se revisó el contrato buscando ambigüedades.
Se encontraron seis:

| # | Ambigüedad | Ejemplo que la expone | Decisión |
|---|---|---|---|
| 1 | La unidad de la asistencia no está fijada | 0.92 | Nueva regla C3: 0 < asistencia ≤ 1 → abstener [SUPUESTO] |
| 2 | ¿Texto vacío es error de tipo o faltante? | id "   " | R1.3 ampliada: vacío = faltante [SUPUESTO] |
| 3 | Un 0 en reprobadas parece bueno aunque no haya evidencia | 0 cursadas en semestre 3 | Nueva regla C4: semestre ≥ 2 y 0 cursadas → abstener [SUPUESTO] |
| 4 | ¿Qué error se reporta si hay dos? | semestre "3" y promedio 38 | El primero en el orden de la tabla E |
| 5 | ¿Qué hacer con claves desconocidas? | "Promedio_acumulado" | Nueva regla R1.0: se ignoran |
| 6 | Decimales con coma | "3,8" | Son texto → tipo_invalido |

Se verificó que ninguna regla nueva cambiara la respuesta esperada
de los 20 casos anteriores. Ninguno tenía asistencia ≤ 1, textos vacíos
ni 0 materias cursadas, así que el oráculo original siguió siendo válido.

#### Por qué la regla C4 es importante

Este hallazgo merece atención especial. Un estudiante de semestre 3
con 0 materias cursadas el periodo anterior tiene 0 reprobadas.
Para el sistema, "0 reprobadas" es una buena señal: no suma puntos.
Pero no es una buena señal: es **ausencia de evidencia**.
El sistema confundía "no hay datos de fracaso" con "no hay fracaso".
Puede tratarse de un reintegro, un aplazamiento o un error de registro,
y en todos los casos lo prudente es que lo revise una persona.

### 12.2 Etapa B – 15 casos nuevos con P2

Cada caso nuevo (T01–T15) ataca una corrección anterior **desde otro ángulo**:

| ID | Corrección que ataca | Entrada | Idea |
|---|---|---|---|
| T01 | S08 (escala) | asistencia 0.92 | Escala equivocada pero dentro de rango |
| T02 | S09 (tipo) | promedio "3,8" | Formato decimal colombiano |
| T03 | S15 (tipo) | semestre 3.0 | `3.0 == 3` en Python |
| T04 | S10 (bool) | trabaja 1 | `1 == True` en Python |
| T05 | S11 (enum) | "pregrado " | Espacio invisible |
| T06 | S01 (faltante) | id "   " | Faltante disfrazado de texto |
| T07 | S01 (faltante) | "Promedio_acumulado" | Clave mal escrita |
| T08 | orden de errores | semestre "3" + promedio 38 | Dos errores de formato |
| T09 | orden error/población | posgrado + estrato 9 | Error y población a la vez |
| T10 | orden población/contradicción | retirado + 0 créditos | ¿Cuál gana? |
| T11 | S03 frontera | reprobó 6 de 6 | Justo en el límite de C1 |
| T12 | S04 sin evidencia | 0 cursadas, semestre 3 | Ausencia de evidencia |
| T13 | S12 lado opuesto | semestre 4, prom 3.5, asis 84.99 | Tres bordes a la vez |
| T14 | S14 lado opuesto | prom 2.99, asis 70.0 | R3.4 a medias |
| T15 | S13 corte inferior | prom 2.9 | Puntaje exacto 30 |

La diferencia con la primera ronda es el tipo de ataque:

- En la ronda 1 se atacaba la **ausencia** de controles.
- En la ronda 3 se atacan los **controles existentes**, buscando sus bordes:
  si v2 rechaza `True` como semestre, ¿rechaza `3.0`?
  Si rechaza "Pregrado", ¿rechaza "pregrado "?

### 12.3 Etapa C – Oráculo de la ronda 3

Se escribió aparte, como borrador, aplicando el contrato v2:

| ID | Decisión | Detalle | Regla |
|---|---|---|---|
| T01 | abstener | datos_contradictorios | C3 (nueva) |
| T02 | error | tipo_invalido | R1.1a |
| T03 | error | tipo_invalido | float no es int |
| T04 | error | tipo_invalido | int no es bool |
| T05 | error | valor_no_permitido | enum exacto |
| T06 | abstener | campo_faltante | R1.3 ampliada |
| T07 | abstener | campo_faltante | R1.3 + R1.0 |
| T08 | error | tipo_invalido (semestre) | primero en orden de la tabla |
| T09 | error | fuera_de_rango (estrato) | formato antes que población |
| T10 | abstener | fuera_de_poblacion | población antes que contradicción |
| T11 | resultado | bajo, 25 | 6 no es > 6; +25 |
| T12 | abstener | datos_contradictorios | C4 (nueva) |
| T13 | resultado | bajo, 10 | semestre 4 incluido; 3.5 → 0; 84.99 → +10 |
| T14 | resultado | medio, 40 | 70 no es < 70; R3.4 no aplica |
| T15 | resultado | medio, 30 | ≥ 30 inclusivo |

### 12.4 Etapa D – Ronda 3a: v2 sin cambios contra 35 casos

Se ejecutó v2 **sin modificarla** contra los 20 casos viejos y los 15 nuevos.

Comando:

```bash
python3 dataset_r3.py && python3 correr_ronda3.py
```

| Grupo | Pasan |
|---|---|
| Típicos R01–R05 | 5/5 |
| Adversariales S01–S15 | 15/15 |
| Nuevos T01–T15 | 12/15 |
| **Total** | **32/35** |

**No hubo regresiones**: todo lo que pasaba en la ronda 2 siguió pasando.

Las tres fallas:

| ID | Esperado | Obtenido v2 | Causa |
|---|---|---|---|
| T01 | abstener(contradictorios) | resultado bajo (20) | Hueco del contrato: asistencia sin unidad fija |
| T06 | abstener(campo_faltante) | error(tipo_invalido) | Hueco del contrato: texto vacío sin definir |
| T12 | abstener(contradictorios) | resultado bajo (0) | Hueco del contrato: no se exigía evidencia |

#### El hallazgo central de la ronda 3

Las 3 fallas vienen de **huecos del contrato**, no de errores de programación.

El código de v2 resistió los 12 ataques técnicos:

- Rechazó `3.0` como semestre (T03).
- Rechazó `1` como booleano (T04).
- Rechazó "3,8" como número (T02).
- Rechazó "pregrado " con espacio (T05).
- Respetó el orden de errores, población y contradicciones (T08, T09, T10).
- Manejó bien todas las fronteras (T11, T13, T14, T15).

Esto confirma algo que la metodología sugiere con el prompt P3:
**una vez que el código cumple el contrato, los errores que quedan están en el contrato**.
Ninguna cantidad de programación corrige una regla que nadie escribió.

Dos de las tres fallas (T01 y T12) son, además, **silenciosas**:
v2 respondía "riesgo bajo" con total normalidad.
Es el mismo patrón peligroso de la ronda 1, ahora en un nivel más sutil.

### 12.5 Etapa E – Versión 3 y ronda 3b

`sistema_v3.py` toma v2 y agrega tres cambios, marcados en el código como `# FIX`:

**1. Normalizar textos vacíos (T06).**

```python
def _normalizar(e):
    return {k: (None if isinstance(v, str) and v.strip() == "" else v)
            for k, v in e.items()}
```

Un texto vacío o con solo espacios se convierte en `None` antes de validar,
así que cae en la regla de faltantes y no en la de tipo.

**2. Regla C3: asistencia en escala equivocada (T01).**

```python
if 0 < e["porcentaje_asistencia"] <= 1.0:
    return {"decision": "abstener", "motivo": "datos_contradictorios"}
```

**3. Regla C4: sin evidencia del periodo anterior (T12).**

```python
if e["semestre"] >= 2 and e["materias_cursadas_periodo_anterior"] == 0:
    return {"decision": "abstener", "motivo": "datos_contradictorios"}
```

Resultado de la ronda 3b:

| Grupo | Pasan |
|---|---|
| Típicos R01–R05 | 5/5 |
| Adversariales S01–S15 | 15/15 |
| Nuevos T01–T15 | 15/15 |
| **Total** | **35/35** |

### 12.6 Lectura honesta del 35/35

Se aplica la misma advertencia que al 20/20:
v3 se corrigió conociendo los 35 casos. El 35/35 demuestra que
los fallos conocidos están resueltos, no que el sistema sea robusto
ante cualquier entrada.

Además, las reglas nuevas tienen **efectos colaterales** que el equipo debe aceptar:

- C3 hace que un estudiante con asistencia real de 1 % también se abstenga.
  Es un caso raro y se va a revisión humana, pero conviene saberlo.
- C4 hace que los reintegros y aplazamientos siempre vayan a revisión humana.
  Puede ser deseable o puede saturar a consejería.

---

## 13. Resultados consolidados

### 13.1 Evolución de las rondas

| Ronda | Versión | Casos | Pasan | Porcentaje |
|---|---|---|---|---|
| 1 | v1 (camino feliz) | 20 | 6 | 30 % |
| 2 | v2 (contrato completo) | 20 | 20 | 100 % |
| 3a | v2 sin cambios | 35 | 32 | 91 % |
| 3b | v3 (contrato v2) | 35 | 35 | 100 % |

### 13.2 Qué falló en cada ronda

| Ronda | Fallas | Origen de las fallas |
|---|---|---|
| 1 | 14 | Código: validación inexistente, opcional mal leído, regla omitida |
| 2 | 0 | — |
| 3a | 3 | Contrato: reglas que nadie había escrito |
| 3b | 0 | — |

La naturaleza de los errores cambió a lo largo del proceso:

```
Ronda 1: el código no cumple el contrato
Ronda 3: el código cumple el contrato, pero el contrato tiene huecos
```

### 13.3 Fallas silenciosas vs. visibles

| Ronda | Excepciones | Silenciosas | Clasificación incorrecta |
|---|---|---|---|
| 1 | 4 | 10 | — |
| 3a | 0 | 2 (T01, T12) | 1 (T06: error en vez de abstener) |

En ambas rondas con fallas, la mayoría fueron **silenciosas**.
Este es el resultado más relevante para un sistema de alerta temprana:
el riesgo real no es que el sistema se caiga, sino que diga "todo bien" cuando no lo está.

### 13.4 Versiones del código

| Versión | Líneas aprox. | Qué agrega |
|---|---|---|
| v1 | 45 | Puntaje y nivel del camino feliz |
| v2 | 120 | Esquema, validación completa, población, contradicciones, R3.4, red de seguridad |
| v3 | 130 | Normalización de vacíos, C3, C4 |

La mayor parte del código de v2 y v3 es **validación**, no cálculo.
Es una proporción normal en sistemas reales: decidir es poco código,
decidir con cuidado es mucho más.

### 13.5 Archivos entregados

| Archivo | Contenido |
|---|---|
| `practica_pruebas_estres.md` | Informe con los 9 pasos |
| `explicacion_proceso.md` | Este documento |
| `dataset.py` | Casos R, S y oráculo de la ronda 1–2 |
| `dataset_r3.py` | Casos T y oráculo de la ronda 3 |
| `sistema_v1.py` | Versión del camino feliz |
| `sistema_v2.py` | Versión con el contrato completo |
| `sistema_v3.py` | Versión con el contrato v2 |
| `correr_rondas.py` | Arnés de las rondas 1 y 2 |
| `correr_ronda3.py` | Arnés de la ronda 3 |
| `dataset_20_casos.json` | Los 20 casos, sin respuesta |
| `dataset_ronda3.json` | Los 15 casos nuevos, sin respuesta |
| `oraculo_borrador.json` | Oráculo de los 20 casos |
| `oraculo_ronda3_borrador.json` | Oráculo de los 15 casos nuevos |
| `resultados_rondas.json` | Trazas y resultados de rondas 1 y 2 |
| `resultados_ronda3.json` | Trazas y resultados de la ronda 3 |

Los datasets y los oráculos están en archivos **separados** a propósito:
así se puede compartir el dataset con otro equipo para que escriba
su propio oráculo sin ver el nuestro, y luego comparar ambos.

---

## 14. Lecciones aprendidas

### 14.1 Los casos típicos engañan

v1 pasó 4 de 5 casos típicos (80 %) y solo 2 de 15 adversariales (13 %).
Si solo se hubiera probado con datos normales, v1 habría parecido lista.

### 14.2 Lo peligroso no es caerse, es mentir con calma

La mayoría de las fallas fueron silenciosas: resultados falsos pero creíbles.
En un sistema que decide sobre personas, esta es la falla que más daño hace,
porque nadie la investiga.

### 14.3 "No decidir" es una funcionalidad

12 de 35 casos (34 %) tienen como respuesta correcta **abstenerse**.
Un sistema que siempre responde no es más útil: es más peligroso.
La abstención con remisión a un humano es parte del diseño, no un fallo.

### 14.4 Separar error de abstención aclara responsabilidades

- Un `error` va al equipo de datos: "este registro está roto".
- Una `abstención` va a consejería: "este caso necesita criterio humano".

Mezclarlos hace que cada equipo reciba casos que no le corresponden.

### 14.5 El lenguaje tiene trampas propias

Tres casos atacaron comportamientos de Python:
`bool` es `int` (S15), `"no"` es verdadero (S10), `3.0 == 3` (T03).
Un contrato escrito en lenguaje natural no los menciona,
pero el código sí tiene que manejarlos.

### 14.6 Un 100 % es una invitación a buscar más

Tanto el 20/20 como el 35/35 se obtuvieron sobre casos conocidos.
La ronda 3 mostró que v2, con su 20/20, todavía tenía tres huecos.
Cada puntaje perfecto debe seguirse de casos nuevos.

### 14.7 Al final, los errores están en el contrato

Cuando el código ya cumple las reglas, lo que queda son reglas mal escritas
o que faltan. Por eso P3 (revisar el contrato) es tan importante como P1 y P2.

### 14.8 Cambiar lo mínimo hace las pruebas legibles

Como cada caso adversarial cambió uno o dos campos de una base sana,
cada falla se pudo atribuir a una causa concreta sin depurar nada.

---

## 15. Limitaciones y amenazas a la validez

Es importante ser explícito sobre lo que este trabajo **no** demuestra.

### 15.1 Los datos "reales" son inventados

R01–R05 no vienen de estudiantes reales. Representan situaciones típicas,
pero la distribución real (cuántos estudiantes caen en cada nivel,
cuántos registros llegan incompletos) puede ser muy distinta.

### 15.2 El mismo modelo hizo todo

Contrato, casos, oráculo y código salieron del mismo autor.
Un malentendido de una regla se reproduciría en todas partes
y las pruebas pasarían igual. Mitigación: que el equipo firme el oráculo
y, mejor aún, que otra persona escriba un oráculo independiente para comparar.

### 15.3 Sobreajuste

v2 y v3 se corrigieron conociendo los casos. Los puntajes perfectos
miden la corrección de fallos conocidos, no la robustez general.

### 15.4 Pesos y umbrales no calibrados

Los puntos (30, 25, 20…) y los cortes (30, 60) son ilustrativos.
No se derivaron de datos. Un sistema real debería calibrarlos
con datos históricos de deserción de la institución.

### 15.5 Alcance de las pruebas

No se probó:

- la precisión predictiva de un modelo de ML,
- el sesgo del sistema (por ejemplo, si el estrato penaliza injustamente),
- el rendimiento con grandes volúmenes,
- la integración con los sistemas de origen.

El uso del estrato como factor de riesgo, en particular, merece una
discusión ética aparte: puede ser predictivo y a la vez reforzar estigmas.

### 15.6 Supuestos pendientes de validar

| Supuesto | Dónde |
|---|---|
| Sistema = alerta de deserción | Confirmado por ti |
| Población = pregrado, activo, semestres 2–4 | Paso 1 |
| Deuda opcional | Paso 1 |
| Población antes que faltantes | Paso 1 |
| Enums sensibles a mayúsculas | Paso 1 |
| C3: asistencia ≤ 1 se abstiene | Paso 9 |
| C4: semestre ≥ 2 sin cursadas se abstiene | Paso 9 |
| Texto vacío = faltante; claves extra se ignoran | Paso 9 |

---

## 16. Cómo reproducir todo

Requisitos: Python 3.8 o superior. No hace falta instalar nada.

```bash
# 1. Descomprimir
unzip artefactos_practica.zip -d practica
cd practica

# 2. Generar los datasets y oráculos en JSON
python3 dataset.py
python3 dataset_r3.py

# 3. Rondas 1 y 2 (v1 y v2 contra 20 casos)
python3 correr_rondas.py

# 4. Ronda 3 (v2 y v3 contra 35 casos)
python3 correr_ronda3.py
```

Salidas esperadas en consola:

```
===== Ronda 1 (v1): 6/20 pasan =====
===== Ronda 2 (v2): 20/20 pasan =====
===== Ronda 3a (v2): 32/35 pasan =====
===== Ronda 3b (v3): 35/35 pasan =====
```

### Cómo agregar un caso nuevo

1. Abrir `dataset_r3.py` (o crear `dataset_r4.py`).
2. Agregar una entrada en la lista de casos usando `caso("ID", campo=valor)`.
3. **Sin mirar el código**, agregar su respuesta esperada al oráculo.
4. Ejecutar el arnés y revisar si pasa.

### Cómo cambiar una regla

1. Cambiar el contrato en el informe.
2. Revisar si la regla cambia respuestas esperadas de casos existentes.
3. Actualizar el oráculo (y que el equipo lo firme).
4. Cambiar el código en una versión nueva.
5. Correr **todos** los casos, no solo los nuevos, para detectar regresiones.

---

## 17. Glosario

| Término | Significado |
|---|---|
| Contrato | Especificación de entradas, salidas y reglas de un sistema |
| E / S1 / S2 / S3 | Entrada y salidas de cada paso de la cadena |
| Camino feliz | El flujo cuando todos los datos llegan bien |
| Caso adversarial | Entrada diseñada para romper el sistema |
| Caso frontera | Valor justo en un umbral |
| Oráculo | Conjunto de respuestas esperadas contra las que se compara |
| Abstención | El sistema decide no decidir y remite a un humano |
| Error controlado | Respuesta estructurada ante un dato mal formado, sin excepción |
| Falla silenciosa | Resultado incorrecto que parece correcto |
| Regresión | Algo que funcionaba y deja de funcionar tras un cambio |
| Sobreajuste a las pruebas | Pasar los casos conocidos sin ser robusto en general |
| Arnés de pruebas | Script que ejecuta los casos y compara resultados |
| Traza | Registro de la salida de cada paso para un caso |
| Truthy | Valor que Python evalúa como verdadero (como el texto "no") |
| Enum | Campo que solo acepta una lista cerrada de valores |
| Población | Conjunto de casos que el sistema está diseñado para atender |

---

## 18. Conclusiones

1. **Se completó la metodología entera**, en el orden exigido:
   contrato, 5 casos típicos, 15 adversariales sin respuesta, oráculo aparte,
   ronda 1, correcciones, ronda 2, biblioteca de prompts y diagramas.

2. **Se hizo una segunda iteración** con los prompts P3 y P2:
   revisión del contrato, 15 casos nuevos, ronda 3 con v2 y corrección en v3.

3. **Todo se ejecutó de verdad.** Los conteos 6/20, 20/20, 32/35 y 35/35
   salen de correr el código, no de simularlo.

4. **La primera versión falló en 14 de 20 casos**, 10 de ellas en silencio,
   casi siempre respondiendo "riesgo bajo". Para un sistema de alerta temprana,
   eso equivale a dejar sin apoyo a estudiantes que lo necesitan.

5. **La segunda versión resistió todos los ataques técnicos nuevos.**
   Sus tres fallas en la ronda 3 vinieron de reglas que el contrato no tenía.

6. **El aprendizaje principal** es que probar un sistema que decide sobre personas
   no consiste en verificar que calcula bien, sino en verificar que sabe
   cuándo no debe calcular.

7. **Quedan pendientes antes de entregar:**
   - que el equipo revise y firme los dos oráculos,
   - que se validen los supuestos (población, reglas C3 y C4),
   - que se reemplacen los datos típicos inventados por registros reales anonimizados,
   - y, si se quiere seguir, una ronda 4 enfocada en las reglas de negocio
     (pesos, umbrales, uso del estrato) en lugar de la validación.
