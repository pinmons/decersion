# Prompt para Claude Code – Prototipo del sistema de alerta temprana de deserción

> Cómo usarlo: abre Claude Code en la carpeta del proyecto y escribe
> `Lee PROMPT_PROTOTIPO.md y CLAUDE.md y ejecuta la Fase 0.`
> Después de cada fase, revisa lo que hizo y escribe `Continúa con la siguiente fase.`

---

## Rol

Actúa como ingeniero(a) de machine learning y de pruebas de software. Vas a construir un
**prototipo funcional** del sistema de alerta temprana de deserción universitaria que está
documentado en la carpeta `contexto/`. Todo el código, los comentarios, la interfaz y los
reportes van en **español**.

## Contexto que debes leer primero

En `contexto/` está el trabajo previo. Léelo completo antes de escribir código:

| Archivo | Qué contiene |
|---|---|
| `practica_pruebas_estres.md` | Contrato del sistema (pasos 1 a 3), casos, oráculo, rondas 1 a 3 y supuestos |
| `explicacion_proceso.md` | Explicación detallada de cada decisión y de los resultados |
| `sistema_v3.py` | Versión final por reglas: pasa los 35 casos del oráculo |
| `dataset.py`, `dataset_r3.py` | 35 casos de prueba (R01–R05, S01–S15, T01–T15) y sus oráculos |
| `correr_rondas.py`, `correr_ronda3.py`, `explicaciones.py` | Arnés de pruebas que explica cada caso en la terminal |
| `*.json` | Datasets, oráculos y resultados de las rondas |
| `*.png` | Diagramas del contrato, actividades, ejemplos y resultados |

**Lo que se mantiene sí o sí (la base del proyecto):**

1. El **contrato**: los 12 campos de entrada, el Paso 1 (validación con salidas `error` y
   `abstener`), el orden de reglas (formato → población → faltantes → contradicciones), las
   reglas C1 a C4, la regla de anulación R3.4 y las cuatro garantías.
2. Las **tres salidas posibles**: `resultado` (nivel, puntaje 0–100, acción, factores,
   datos no informados), `error` controlado y `abstener` con remisión a un humano.
3. Los **35 casos y sus oráculos**, que no se modifican para hacer pasar pruebas.
4. El **arnés con explicaciones en la terminal** (`--pausa`, `--todos`).
5. La metodología: contrato → casos → oráculo aparte → ejecutar → corregir → nueva ronda.

## Qué se agrega

Hoy el Paso 2 asigna puntos fijos escritos a mano (promedio < 3.0 → +30, etc.). El objetivo
nuevo es que **los pesos de las variables se aprendan de muchos ejemplos**, como en deep
learning. El proceso de entrenamiento tiene que quedar explicado paso a paso y debe reportar
el error final del modelo. Se usan técnicas para que **ninguna variable domine** la predicción.

El sistema por reglas (`sistema_v3`) se conserva como **línea base** para comparar.

---

## Fase 0 – Plan y estructura (no escribas código todavía)

1. Lee todo `contexto/`.
2. Propón la estructura de carpetas, las dependencias y un plan por fases.
3. Lista las ambigüedades que encuentres y el supuesto que tomarás para cada una, marcado
   como `[SUPUESTO]`. No te detengas a preguntar: decide y sigue.

Estructura sugerida (ajústala si tienes una razón):

```
prototipo/
├── contexto/                 # trabajo previo (solo lectura)
├── desercion/
│   ├── contrato.py           # esquema E, Paso 1 (validación), R3.4, constantes del contrato
│   ├── reglas.py             # Paso 2 y 3 por reglas fijas (= sistema_v3, línea base)
│   ├── datos_sinteticos.py   # generador de estudiantes simulados con etiqueta desertó
│   ├── preprocesamiento.py   # escalado, ingeniería de variables, división train/val/test
│   ├── dependencia.py        # correlaciones, VIF, importancia, ablación, tope de dominancia
│   ├── modelos/
│   │   ├── logistica.py      # regresión logística desde cero en NumPy
│   │   └── red_neuronal.py   # MLP desde cero en NumPy (forward, backprop, actualización)
│   ├── entrenamiento.py      # bucle de entrenamiento, early stopping, registro por época
│   ├── tarjeta_puntaje.py    # convierte pesos aprendidos en puntos 0–100 explicables
│   ├── evaluacion.py         # métricas, matriz de confusión, comparación con la línea base
│   └── sistema.py            # evaluar(entrada, modo="reglas"|"aprendido")
├── pruebas/
│   ├── correr_rondas.py      # rondas 1–3 (se conservan)
│   ├── correr_ronda4.py      # pruebas nuevas del modo aprendido
│   └── explicaciones.py
├── app.py                    # interfaz Streamlit
├── reportes/                 # gráficas PNG y reporte_entrenamiento.md generados
├── requirements.txt
└── README.md
```

Dependencias permitidas: `numpy`, `pandas`, `matplotlib`, `streamlit`. Puedes usar
`scikit-learn` **solo** para verificar (por ejemplo, comparar tu AUC con `roc_auc_score`), no
para entrenar los modelos principales. Los modelos se implementan desde cero para que cada
paso del aprendizaje sea visible y explicable.

**Detente al final de la Fase 0 y muestra el plan.**

---

## Fase 1 – Migrar la base sin romperla

1. Separa `sistema_v3.py` en `contrato.py` (Paso 1, esquema, R3.4) y `reglas.py` (Pasos 2 y 3
   por reglas).
2. `sistema.evaluar(entrada, modo="reglas")` debe dar exactamente lo mismo que `sistema_v3`.
3. Mueve el arnés a `pruebas/` y ejecútalo.

**Criterio de aceptación:** la ronda 3b sigue en **35/35** con `modo="reglas"`. Muestra la
salida real de la terminal. Si algo cambia, corrígelo antes de seguir.

---

## Fase 2 – Datos de entrenamiento (muchas muestras)

No hay datos reales de estudiantes, así que se generan datos sintéticos. Es la parte más
delicada: si la etiqueta se genera con las mismas reglas que se quieren aprender, el modelo
solo se copia a sí mismo.

1. Genera **al menos 20 000 estudiantes** de la población válida (pregrado, activo,
   semestres 2–4) con los 12 campos del contrato y una etiqueta `deserto` (0/1).
2. Las variables deben estar **correlacionadas como en la vida real**, no independientes.
   Por ejemplo: un promedio bajo va con más materias perdidas y menos asistencia; un estrato
   bajo va con más probabilidad de trabajar y de tener deuda. Esto es a propósito: sirve para
   probar las técnicas contra la dependencia excesiva.
3. La probabilidad real de desertar se calcula con una **función latente distinta de las
   reglas del contrato**: no lineal, con al menos una interacción (por ejemplo, trabajar pesa
   más si la asistencia es baja) y con ruido. Documenta la fórmula en el código y en el
   reporte como `[SUPUESTO]`.
4. Ajusta la tasa base de deserción a un valor realista. El proyecto usa SPADIES 2023:
   la tasa anual de deserción en Colombia es cercana al 12 % y la mayor parte ocurre en los
   primeros semestres. Toma un supuesto razonable (entre 12 % y 25 % para esta población
   temprana) y documéntalo.
5. Incluye una fracción pequeña de registros con defectos (faltantes, tipos malos, fuera de
   rango, otra población). Deben pasar por el Paso 1 y **quedar fuera del entrenamiento**.
   Reporta cuántos se descartaron y por qué motivo.
6. Divide los datos en **train 70 % / validación 15 % / test 15 %**, estratificado por la
   etiqueta y con semilla fija. El test no se toca hasta la evaluación final.
7. Deja una función `cargar_datos_reales(csv)` que acepte un CSV con el mismo esquema más la
   columna `deserto`, para cambiar a datos reales sin tocar el resto del código.

Salida de la fase: `reportes/datos_resumen.md` con el tamaño, la tasa de deserción, las
distribuciones y los registros descartados por el Paso 1.

---

## Fase 3 – Revisar la dependencia entre variables ANTES de entrenar

El objetivo es que ninguna variable cargue con demasiado peso y que no haya variables
redundantes que se repartan o se roben el peso entre sí.

1. **Ingeniería de variables:** convierte los conteos en tasas cuando tenga sentido, por
   ejemplo `tasa_reprobacion = materias_reprobadas / materias_cursadas_periodo_anterior`.
   Codifica los booleanos como 0/1. Justifica cada transformación.
2. **Matriz de correlación** (Pearson y Spearman) entre todas las variables predictoras.
   Guárdala como mapa de calor PNG.
3. **VIF (factor de inflación de varianza)** por variable, calculado desde cero.
   Marca VIF > 5 como multicolinealidad moderada y VIF > 10 como grave.
4. Si hay pares con |correlación| > 0.8 o VIF > 10, aplica una solución y explícala: combinar
   las variables, quitar una o dejarlas y controlarlas con regularización. Deja el antes y el
   después en el reporte.
5. **Estandariza** las variables numéricas (media 0, desviación 1) usando **solo** la media y
   la desviación del conjunto de entrenamiento. Explica por qué: sin escalar, la variable con
   números más grandes domina los gradientes.

---

## Fase 4 – Entrenamiento (el aprendizaje como en deep learning)

Entrena dos modelos desde cero en NumPy. Los dos usan los mismos datos ya preparados.

### Modelo A – Regresión logística (el modelo principal, interpretable)

- Es la red neuronal más simple: una sola neurona con activación sigmoide.
- Pérdida: entropía cruzada binaria (log-loss) **con pesos por clase**, porque hay muchos
  menos desertores que no desertores.
- Optimización: descenso de gradiente por mini-lotes.
- **Regularización L2** (weight decay): penaliza pesos grandes para que ninguna variable crezca
  sin control.
- **Early stopping**: se detiene cuando la pérdida de validación deja de mejorar durante N
  épocas y se queda con los mejores pesos.

### Modelo B – Red neuronal multicapa (MLP)

- Por ejemplo 12 → 16 → 8 → 1, activación ReLU en las ocultas y sigmoide a la salida.
- Implementa a mano el forward, la pérdida, el **backpropagation** y la actualización
  (SGD con momentum o Adam).
- Inicialización He o Xavier, L2, **dropout** en las capas ocultas y early stopping.

### Lo que se registra en cada época (ambos modelos)

- Pérdida de entrenamiento y de validación.
- AUC y recall de desertores en validación.
- La **norma de los pesos** y el peso de cada variable (en la logística), para ver cómo se van
  repartiendo a medida que el modelo aprende.

La terminal debe mostrar el proceso de forma legible, por ejemplo cada 10 épocas:

```
Época  40 | pérdida train 0.412 | pérdida val 0.428 | AUC val 0.81 | recall val 0.74
           Pesos: promedio -0.92 · tasa_reprobacion 0.71 · asistencia -0.55 · ...
           Peso más grande: promedio (27 % del total) → dentro del tope (35 %)
```

Guarda las curvas de pérdida y de AUC por época en PNG.

### Convertir lo aprendido en puntos (tarjeta de puntaje)

Para no perder la explicabilidad del contrato, convierte los pesos de la regresión logística
en una **tarjeta de puntaje**: cada variable aporta puntos, la suma va de 0 a 100 y la salida
conserva el mismo formato que hoy (`nivel`, `puntaje`, `accion`, `factores`,
`datos_no_informados`). En la red neuronal, el puntaje es `round(100 × probabilidad)`.

- Los cortes bajo/medio/alto ya no se fijan a mano en 30 y 60: se eligen en **validación**
  según un objetivo explícito. Por ejemplo, que el nivel alto capture al menos el 70 % de los
  desertores sin que más del 25 % de los estudiantes queden en alto. Documenta el objetivo y
  los cortes resultantes.
- La regla R3.4 (promedio < 3.0 y asistencia < 70 → alto) **se mantiene** como anulación
  encima del modelo.
- La deuda opcional ausente se sigue reportando en `datos_no_informados`. Imputa el valor
  más prudente, nunca uno que reduzca el riesgo, y explica cuál usaste.

---

## Fase 5 – Controlar que ninguna variable domine

Después de entrenar, demuestra con números que el peso está repartido:

1. **Importancia por permutación** en el conjunto de test: desordena una variable a la vez y
   mide cuánto empeora el AUC. Expresa cada importancia como porcentaje del total.
2. **Tope de dominancia:** ninguna variable puede superar el **35 %** de la importancia total
   `[SUPUESTO, ajustable]`. Si una lo supera:
   - sube la regularización L2 o aplica una penalización extra sobre esa variable,
   - vuelve a entrenar,
   - y reporta el antes y el después, incluido cuánto error cuesta repartir el peso.
3. **Ablación:** reentrena quitando una variable a la vez y mide el cambio de error. Si quitar
   una sola variable hace colapsar el modelo, eso es dependencia excesiva y se reporta.
4. **Estabilidad:** entrena con 5 semillas o con 5 muestras bootstrap. Las importancias y los
   pesos deben ser estables. Reporta media y desviación de cada uno.
5. **Variable sensible (estrato):** reporta el error y la tasa de nivel alto por estrato.
   Entrena también una versión sin estrato y compara. La decisión de dejarlo o quitarlo queda
   para el equipo, con los números a la vista.

---

## Fase 6 – Evaluación final y el error del modelo

Solo ahora se usa el conjunto de test. Reporta para la línea base por reglas (`sistema_v3`),
la regresión logística y la MLP:

| Métrica | Para qué sirve |
|---|---|
| Log-loss | Error principal que minimizó el entrenamiento |
| Brier score | Qué tan bien calibradas están las probabilidades |
| AUC-ROC | Qué tan bien ordena a los estudiantes por riesgo |
| Accuracy | Aciertos totales (engaña con clases desbalanceadas; explicar por qué) |
| Recall de desertores | Cuántos desertores reales detecta (el error más costoso es no detectarlos) |
| Precisión | De los marcados en riesgo, cuántos desertan de verdad |
| Matriz de confusión | Por nivel bajo/medio/alto contra desertó sí/no |
| Curva de calibración | PNG: probabilidad predicha contra tasa real |

Cierra con una tabla comparativa y una conclusión honesta: si la red neuronal no supera a la
logística, dilo. Si la línea base por reglas queda cerca, dilo también. Aclara siempre que el
error se midió contra **datos sintéticos** y no representa el desempeño real.

---

## Fase 7 – Pruebas de estrés del modo aprendido (ronda 4)

1. **Casos del contrato:** con `modo="aprendido"`, todos los casos cuya respuesta esperada es
   `error` o `abstener` deben coincidir exactamente con el oráculo. El modelo nunca debe ver
   esos casos.
2. **Casos con resultado:** con pesos aprendidos, el puntaje exacto del oráculo ya no aplica.
   **No edites el oráculo.** Verifícalos con **propiedades** (pruebas metamórficas):
   - Orden: el riesgo de R03 es mayor que el de R02 y el de R02 mayor que el de R01.
   - Monotonía: bajar el promedio, subir las materias perdidas o bajar la asistencia nunca
     reduce el riesgo, si lo demás se mantiene igual.
   - R3.4: S14 sale en alto.
   - La deuda ausente (R04) aparece en `datos_no_informados`.
3. Genera **15 casos nuevos (U01–U15)** con el prompt P2 de `contexto/` que ataquen al modelo:
   violaciones de monotonía, combinaciones válidas pero raras (fuera de lo visto en el
   entrenamiento), una variable extrema con las demás normales y dos variables muy
   correlacionadas que se contradicen. Escribe su oráculo **aparte** y como borrador.
4. Corre la ronda 4 con explicaciones en la terminal, igual que las rondas anteriores, y
   reporta `X/Y pasan`. Si algo falla, analiza la causa y corrige en una nueva versión. No
   maquilles resultados.
5. Las rondas 1 a 3 con `modo="reglas"` siguen pasando (35/35). Si no, hay una regresión.

---

## Fase 8 – Interfaz y reporte

### App Streamlit (`app.py`) con 5 secciones

1. **Evaluar estudiante:** formulario con los 12 campos y selector de modo
   (reglas/aprendido). Muestra la decisión, el nivel, el puntaje, la acción, los factores con
   sus puntos y los datos no informados. Los errores y abstenciones se muestran claramente
   con su motivo.
2. **Datos:** resumen del dataset sintético, distribuciones y registros descartados.
3. **Entrenamiento:** curvas de pérdida y AUC por época, y evolución de los pesos.
4. **Variables:** correlaciones, VIF, importancia por permutación con la línea del tope del
   35 %, ablación, estabilidad y análisis por estrato.
5. **Pruebas:** botón para correr las rondas y tabla PASA/FALLA con la explicación de cada
   caso.

### `reportes/reporte_entrenamiento.md` (generado automáticamente)

Debe incluir una sección **"Cómo se asignan los pesos de las variables"** que explique en
lenguaje claro, con los números reales de la ejecución:

1. Cómo se generaron los datos y por qué son sintéticos.
2. Qué es una época, un mini-lote, la pérdida y el gradiente, usando este sistema como
   ejemplo.
3. Cómo cambiaron los pesos de cada variable desde la época 1 hasta la final.
4. Qué hizo cada técnica contra la dependencia excesiva (escalado, L2, dropout, early
   stopping, tope de dominancia) y cuál fue su efecto medido.
5. Cómo se convirtieron los pesos en la tarjeta de puntaje de 0 a 100.
6. El error final en test de cada modelo, comparado con la línea base por reglas.
7. Limitaciones y una lista de `[SUPUESTO]` para revisar.

### `README.md`

Instalación, cómo entrenar (`python -m desercion.entrenamiento`), cómo correr las pruebas,
cómo abrir la app (`streamlit run app.py`) y cómo cambiar a datos reales.

---

## Reglas para todo el trabajo

- Sigue las fases en orden y muestra la salida real de la terminal al terminar cada una.
- Nunca modifiques un oráculo para que una prueba pase. Si crees que un oráculo está mal,
  repórtalo como hallazgo y deja la decisión al equipo.
- No inventes resultados: todas las métricas salen de ejecutar código.
- Semillas fijas para que todo sea reproducible.
- Marca cada decisión no especificada como `[SUPUESTO]` y júntalas en el reporte final.
- Las garantías del contrato se cumplen en ambos modos: nunca lanza excepción, nunca inventa
  datos faltantes, nunca califica fuera de la población y los umbrales se aplican tal como
  están escritos.
