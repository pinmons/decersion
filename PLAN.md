# Plan del prototipo – Fase 0

Plan de ejecución de `PROMPT_PROTOTIPO.md`. Se leyó todo `contexto/` y se ejecutó la línea
base sin tocarla: **Ronda 3b (v3) 35/35** (reales 5/5, simulados 15/15, nuevos 15/15).

## 1. Cambio de fondo: el destino es Vercel

El prompt pide una app Streamlit, pero el prototipo se va a publicar en **Vercel**, que no
puede ejecutar Streamlit: Streamlit necesita un servidor encendido todo el tiempo con
websockets, y Vercel solo corre funciones que arrancan, responden y se apagan.

**[SUPUESTO] Arquitectura en dos capas, con el mismo núcleo:**

| Capa | Dónde corre | Qué hace |
|---|---|---|
| `desercion/` (paquete Python) | local y Vercel | contrato, reglas, modelos, evaluación |
| `api/*.py` (funciones serverless) | Vercel | `POST /api/evaluar` y `GET /api/rondas` llaman al paquete |
| `public/` (HTML + JS sin framework) | Vercel (estático) | la página web (estructura en la sección 6) |
| `app.py` (Streamlit) | local | las mismas 5 secciones, como pide el prompt |

- El **entrenamiento no corre en Vercel**. Se ejecuta en local con semilla fija; los pesos
  quedan en `modelos_entrenados/*.json` y las gráficas y métricas en `reportes/`. Vercel solo
  carga esos archivos y hace inferencia.
- La inferencia usa **solo NumPy** (la función de Vercel queda liviana). pandas, matplotlib,
  streamlit y scikit-learn quedan en `requirements-dev.txt`.

## 2. Estructura de carpetas

```
decersion/
├── contexto/                     # trabajo previo (solo lectura, no se escribe aquí)
├── desercion/
│   ├── contrato.py               # esquema E, Paso 1, R3.4, constantes del contrato
│   ├── reglas.py                 # Pasos 2 y 3 por reglas (= sistema_v3, línea base)
│   ├── variables.py              # ingeniería de variables compartida por train e inferencia
│   ├── datos_sinteticos.py       # generador + cargar_datos_reales(csv)
│   ├── preprocesamiento.py       # estandarización, división 70/15/15 estratificada
│   ├── dependencia.py            # correlaciones, VIF, permutación, ablación, estabilidad
│   ├── modelos/
│   │   ├── logistica.py          # regresión logística desde cero
│   │   └── red_neuronal.py       # MLP desde cero (forward, backprop, Adam, dropout)
│   ├── entrenamiento.py          # bucle, early stopping, registro por época (python -m)
│   ├── tarjeta_puntaje.py        # pesos → puntos 0–100, cortes elegidos en validación
│   ├── evaluacion.py             # métricas, confusión, calibración, comparación
│   ├── reporte.py                # genera reportes/reporte_entrenamiento.md
│   └── sistema.py                # evaluar(entrada, modo="reglas"|"aprendido")
├── pruebas/
│   ├── casos/                    # copia de dataset.py y dataset_r3.py (sin cambios, se
│   │                             #   verifica con hash que los oráculos son idénticos)
│   ├── casos_r4.py               # U01–U15 + su oráculo borrador, en archivo aparte
│   ├── correr_rondas.py          # rondas 1–2
│   ├── correr_ronda3.py          # ronda 3 (v2 y sistema.evaluar modo reglas)
│   ├── correr_ronda4.py          # ronda 4 (modo aprendido)
│   ├── explicaciones.py
│   └── resultados/               # JSON de resultados (antes se escribían en contexto/)
├── modelos_entrenados/           # pesos JSON (los lee la API)
├── reportes/                     # PNG, datos_resumen.md, reporte_entrenamiento.md, JSON
├── api/                          # funciones Python de Vercel
├── public/                       # interfaz web estática
├── app.py                        # Streamlit (local)
├── vercel.json
├── requirements.txt              # solo numpy (lo que instala Vercel)
├── requirements-dev.txt          # pandas, matplotlib, streamlit, scikit-learn
└── README.md
```

Las rondas 1 y 2 usan `sistema_v1` y `sistema_v2`, que se importan desde `contexto/` sin
modificarlos (son la historia del proyecto).

## 3. Fases

| Fase | Entregable | Criterio de aceptación |
|---|---|---|
| 1 | `contrato.py`, `reglas.py`, `sistema.py`, arnés en `pruebas/` | Ronda 3b 35/35 con `modo="reglas"` y salida idéntica a `sistema_v3` en los 35 casos |
| 2 | Generador de 20 000+ estudiantes, `cargar_datos_reales`, `datos_resumen.md` | Tasa base dentro del supuesto; defectuosos descartados por el Paso 1 y contados por motivo |
| 3 | Ingeniería de variables, Pearson/Spearman, VIF propio, estandarización | Ningún par > 0.8 ni VIF > 10 sin tratamiento documentado |
| 4 | Logística y MLP en NumPy, curvas, tarjeta de puntaje, cortes | Registro legible por época; gradientes verificados numéricamente; AUC contrastado con sklearn |
| 5 | Permutación, tope 35 %, ablación, 5 semillas, análisis por estrato | Ninguna variable > 35 % (o el antes/después si hubo que corregir) |
| 6 | Métricas en test de reglas, logística y MLP | Tabla comparativa y conclusión honesta |
| 7 | Ronda 4 (contrato + propiedades + U01–U15) | `X/Y pasan` real; rondas 1–3 siguen en 35/35 |
| 8 | Web en Vercel (estructura de la sección 6), `app.py`, `reporte_entrenamiento.md`, `README.md` | `vercel dev` responde igual que el paquete; la marca en vivo coincide con `evaluar()`; reporte generado automáticamente |

Cada fase va en uno o más commits en la rama `prototipo`. El merge a `main` se hace con un
PR que revisa el equipo.

## 4. Ambigüedades y supuestos

### Despliegue y repositorio
1. **[SUPUESTO] Vercel + Streamlit:** se resuelve con la arquitectura de la sección 1.
2. **[SUPUESTO] Idioma de los nombres:** el `CLAUDE.md` del repositorio pedía nombres de
   código en inglés y el del proyecto pide todo en español. Gana el del proyecto (es más
   reciente y específico); quedaron fusionados en un solo `CLAUDE.md`.
3. **[SUPUESTO] Ramas:** se trabaja en `prototipo` y no se hace push directo a `main`, como
   pide la configuración del repositorio.
4. **[SUPUESTO] `contexto/` es de solo lectura, pero sus arneses escriben JSON en la carpeta
   actual.** Los arneses nuevos escriben en `pruebas/resultados/`.

### Datos sintéticos
5. **[SUPUESTO] Tasa base: 18 %** (dentro del rango 12–25 % para semestres 2–4; SPADIES 2023
   reporta ~12 % anual con la mayor parte en los primeros semestres).
6. **[SUPUESTO] Correlaciones:** un factor latente de "desempeño académico" mueve el
   promedio, la tasa de reprobación y la asistencia; un factor "socioeconómico" liga estrato,
   trabajo y deuda. Se generan con una cópula gaussiana y luego se discretizan a los rangos y
   tipos del contrato.
7. **[SUPUESTO] Función latente distinta de las reglas** (logit, luego sigmoide y Bernoulli):
   términos no lineales (promedio con forma de bisagra alrededor de 3.2, asistencia
   cuadrática), interacción `trabaja × (asistencia baja)`, interacción `deuda × estrato bajo`,
   efecto pequeño del semestre y ruido gaussiano. El intercepto se ajusta numéricamente para
   llegar al 18 %. La fórmula exacta queda en el código y en el reporte.
8. **[SUPUESTO] Defectos: 3 %** de los registros, repartidos entre faltantes, tipos malos,
   fuera de rango, otra población y contradicciones. `deuda_matricula` ausente **no** es un
   defecto (es opcional): se deja ausente en ~8 % de los registros válidos.
9. **[SUPUESTO] Semillas:** 2026 para datos y división; 2026 + k para la estabilidad.

### Variables
10. **[SUPUESTO] Predictores:** `id_estudiante`, `nivel_formacion` y `estado_matricula` no
    entran (identificador y constantes dentro de la población). Candidatos: semestre,
    promedio, créditos, tasa de reprobación (reprobadas / cursadas), materias reprobadas,
    asistencia, estrato, trabaja, deuda. El conteo y la tasa de reprobación probablemente
    queden muy correlacionados; la decisión (combinar, quitar o regularizar) se toma en la
    Fase 3 con los números.
11. **[SUPUESTO] Estrato** se trata como numérico ordinal (1–6), no con una columna por valor.
12. **[SUPUESTO] Arquitectura de la MLP:** `n_variables → 16 → 8 → 1`. El prompt dice 12
    entradas, pero después de la ingeniería de variables quedan menos; la entrada es el número
    real de predictores.

### Deuda ausente
13. **[SUPUESTO] Imputación prudente:** en la logística se imputa el valor de `deuda` cuyo
    peso aprendido suba el riesgo (se espera `True`). En la MLP se evalúan ambos valores y se
    toma la probabilidad mayor. En los dos casos se reporta en `datos_no_informados`. Así
    nunca se reduce el riesgo por falta de un dato.

### Tarjeta de puntaje y niveles
14. **[SUPUESTO] Puntos:** cada variable aporta `peso × (valor − valor de menor riesgo)`,
    reescalado para que el mínimo posible dentro de los rangos del contrato sea 0 y el máximo
    sea 100. El puntaje es una función monótona del logit, así que ordena igual que la
    probabilidad.
15. **[SUPUESTO] Cortes, elegidos en validación:** *alto* = el corte más alto que capture
    ≥ 70 % de los desertores sin dejar más del 25 % de los estudiantes en alto; *medio* = el
    corte que deje como máximo el 10 % de los desertores en *bajo*. Si las dos condiciones no
    se pueden cumplir a la vez, se reporta y se prioriza el recall.
16. **[SUPUESTO] R3.4 en modo aprendido:** fuerza el nivel *alto* pero no cambia el
    puntaje (igual que en reglas, donde S14 queda en alto con 50).
17. **[SUPUESTO] Formato de salida en modo aprendido:** las mismas claves que en reglas;
    `factores` lista las variables que suman puntos, con sus puntos (ej.
    `"promedio_acumulado: +22"`). Se agregan las claves `modo` y `probabilidad`.

### Evaluación
18. **[SUPUESTO] Probabilidad de la línea base:** las reglas no dan probabilidades. Para la
    log-loss y el Brier se usa `puntaje / 100`, recortado a [0.01, 0.99]. El AUC, el recall y
    la matriz de confusión no dependen de esa conversión.
19. **[SUPUESTO] "En riesgo" para recall y precisión** = nivel alto. También se reporta
    medio + alto.
20. **[SUPUESTO] Ablación y estabilidad** se hacen sobre la logística (el modelo principal).
    En la MLP se reportan la importancia por permutación y 5 semillas.
21. **[SUPUESTO] Tope de dominancia:** 35 % de la importancia por permutación en test,
    medida sobre la logística.

### Ronda 4
22. **[SUPUESTO] Monotonía como garantía:** si la logística aprende un signo contrario al
    esperado por la colinealidad (ej. más reprobadas → menos riesgo), la prueba de monotonía lo
    detecta. La corrección, en una versión nueva, sería restringir los signos durante el
    entrenamiento (gradiente proyectado). No se aplica de entrada, para que la prueba pueda
    encontrar la falla.
23. **[SUPUESTO] Casos con resultado en modo aprendido** (R01–R05, S12–S14, T11, T13–T15):
    se exige `decision = "resultado"` y las propiedades del prompt, no el puntaje exacto. Los
    oráculos originales no se tocan.

## 5. Dependencias

- `requirements.txt` (Vercel): `numpy`.
- `requirements-dev.txt` (local): `numpy`, `pandas`, `matplotlib`, `streamlit`,
  `scikit-learn` (solo para verificar).
- Python 3.12 (el que hay en local y el que usa Vercel).

## 6. Estructura de la página web (Fase 8)

Idea del equipo: una página de tres partes, en este orden.

### 6.1 Portada: de qué trata el proyecto
- Qué problema resuelve (alerta temprana de deserción en semestres 2 a 4), para quién es
  (bienestar universitario, consejeros) y qué devuelve: nivel de riesgo, acción recomendada,
  error controlado o abstención que remite el caso a una persona.
- Aviso visible: **los datos de entrenamiento son sintéticos**; el prototipo no se usa para
  decidir sobre estudiantes reales.
- Botones que llevan a las otras dos partes.

### 6.2 Formulario interactivo: cuánto influye cada variable
- Los 12 campos del contrato, con los rangos del esquema E como límites de cada control
  (deslizadores para números, selectores para categorías). Selector de modo
  (reglas / aprendido).
- **Marca en vivo** que se actualiza a medida que se llenan los campos:
  - Mientras falten campos obligatorios: *"Faltan N datos"* (no se llama a la API).
  - Con el registro completo: **"Se considera en riesgo de desertar"** o **"No se considera en
    riesgo"**, con el nivel (bajo/medio/alto), el puntaje y la acción recomendada.
  - Si el Paso 1 rechaza el registro o el sistema se abstiene, la marca lo dice con su motivo
    (*"Error: …"* o *"Remitido a revisión humana: …"*), nunca un sí/no.
- **Influencia de cada variable:** barras con los puntos que aporta cada variable al puntaje,
  que cambian al mover un campo. Así se ve qué variable pesa más.
- **Botón "Cargar ejemplo":** llena el formulario con un estudiante ficticio que tiene las 12
  variables registradas, para ver el resultado sin escribir nada. También un botón "Limpiar".
- [SUPUESTO] "Desertado / no desertado" = nivel **alto** / nivel bajo o medio (igual que el
  supuesto 19). La marca muestra siempre el nivel para que no se pierda el matiz del *medio*.
- [SUPUESTO] La marca llama a `POST /api/evaluar` con una espera de ~300 ms tras el último
  cambio, en vez de recalcular el modelo en JavaScript. Así hay una sola implementación y la
  página nunca contradice al paquete (garantías, Paso 1 y R3.4 incluidas).
- [SUPUESTO] El ejemplo es un registro inventado y completo, válido en el contrato. No se
  usa ningún caso con un identificador que parezca real.

### 6.3 Cómo se hizo: el proceso y la lógica del modelo
Explicación paso a paso, en lenguaje claro y con los números reales de la ejecución
(salen de `reportes/`, no se escriben a mano):
1. **El contrato:** validación (Paso 1), cálculo del riesgo (Pasos 2 y 3), regla R3.4 y
   abstención.
2. **Datos:** cómo se generaron los datos sintéticos, la tasa base y los registros
   descartados.
3. **Variables:** correlaciones, VIF y qué se decidió con las variables redundantes.
4. **Modelos:** línea base por reglas, regresión logística y red neuronal; curvas de
   entrenamiento y cómo se convierten los pesos en la tarjeta de puntaje de 0 a 100.
5. **Cuánto pesa cada variable:** importancia por permutación con el tope del 35 %,
   ablación, estabilidad entre semillas y análisis por estrato.
6. **Resultados y pruebas:** tabla comparativa de los tres modelos, y las rondas 1 a 4 con la
   tabla PASA/FALLA.

[SUPUESTO] Las secciones 2 a 5 del prompt (Datos, Entrenamiento, Variables, Pruebas) se
integran en esta parte de la web, en vez de ir como pestañas sueltas. En `app.py`
(Streamlit, local) se mantienen las 5 secciones del prompt y se agrega la portada.
