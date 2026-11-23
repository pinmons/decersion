# Alerta temprana de deserción universitaria (prototipo)

Recibe el registro de un estudiante de pregrado activo (semestres 2 a 4) y devuelve su **riesgo de
deserción** (bajo, medio o alto) con una acción recomendada, un **error controlado** si los datos están
mal, o una **abstención** que remite el caso a una persona.

Dos modos sobre el mismo contrato (validación del Paso 1, regla R3.4 y garantías):

| Modo | Cómo califica |
|---|---|
| `reglas` | Puntos fijos escritos a mano (línea base, idéntica a `contexto/sistema_v3.py`) |
| `aprendido` | Pesos aprendidos desde cero en NumPy: regresión logística (tarjeta de puntaje 0–100) o red neuronal |

> ⚠️ **Los datos de entrenamiento son sintéticos.** Todas las métricas describen qué tan bien se recupera
> una función simulada, no el desempeño con estudiantes reales. El prototipo no se usa para decidir sobre
> estudiantes reales.

## Resultados (ejecución con semilla 2026, datos sintéticos)

| Métrica en test | Reglas | Logística | Red neuronal |
|---|---|---|---|
| AUC-ROC | 0.793 | 0.817 | 0.823 |
| Log-loss | 0.455 | 0.365 | 0.362 |
| Recall de desertores (nivel alto) | 51 % | 70 % | 70 % |
| % de estudiantes en alto | 18 % | 30 % | 30 % |

Techo teórico (AUC de la probabilidad real simulada): 0.846. Pruebas: rondas 1–3 en modo reglas **35/35**;
ronda 4 (modo aprendido) logística **45/45** y red neuronal **45/45**. Detalle en
[reportes/reporte_entrenamiento.md](reportes/reporte_entrenamiento.md).

## Operación con una base de datos real

El mismo código se reentrenó con una base real y pública: **6 142 estudiantes de primer año de grado** de la
Universitat Politècnica de València, cohortes 2021 y 2022 («StudentDropoutDataset», Igualde-Sáez et al., 2025,
Zenodo, https://doi.org/10.5281/zenodo.17239943, CC BY 4.0). Se usa solo lo que se sabía al **terminar el primer
cuatrimestre** (septiembre a enero): notas del cuatrimestre, presencia en el campus (wifi) y en el aula virtual,
dedicación y créditos. Nada posterior entra al modelo. Esa corrida vive aparte (`modelos_entrenados/real/`,
`reportes/real/`) y no toca los modelos sintéticos ni las rondas.

> La base anterior (Instituto Politécnico de Portalegre, UCI 697) se descartó: el modelo dependía en un 85 % de la
> tasa de reprobación, y esa variable casi era la respuesta.

**Contrato ampliado.** Con los 12 campos del contrato el modelo real apenas le ganaba a una sola variable (AUC 0,743
frente a 0,728). El modelo real recibe ahora, en el mismo registro, lo que la base sabe al cerrar el primer
cuatrimestre: **notas** (nota media y mínima, no presentadas), **actividad** (días en el campus de septiembre a
noviembre y de diciembre a enero, días en el aula virtual y entregas por asignatura), **matrícula y admisión** (nota de
acceso, de bachillerato, opción, vía de ingreso) y la **tasa de abandono de su titulación** entre los estudiantes de
entrenamiento. Lo que falta se imputa con la mediana de entrenamiento más una indicadora «sin dato» (guardadas en el
JSON del modelo) y la ficha lo dice. El contrato de 12 campos, el modo reglas, «Probar un caso» y las rondas no cambian.
Todo en [CONTRATO_AMPLIADO.md](CONTRATO_AMPLIADO.md).

Los **334 estudiantes con impago** no entran: la fuente no marca a ninguno como abandono (0 de 334) aunque el 69 % no
aprobó nada; con ellos el modelo aprendía que «no tener nota de acceso» protege. Quedan 5 808 (abandona el 12 %).

| En prueba (864 estudiantes reales, abandona el 12 %) | Reglas | Logística | Red neuronal |
|---|---|---|---|
| AUC-ROC | 0,713 | 0,798 | 0,807 |
| F1 (nivel alto) | 0,38 | 0,48 | 0,46 |
| Detección (recall, nivel alto) | 40 % | 63 % | 66 % |
| Precisión (nivel alto) | 37 % | 38 % | 36 % |
| % de estudiantes en alto | 13 % | 20 % | 22 % |
| **Sin los casos evidentes** (801; quien no aprobó nada): AUC | 0,589 | 0,723 | 0,740 |
| Sin los casos evidentes: F1 | 0,09 | 0,33 | 0,33 |
| Con solo los 12 campos (misma población y división): AUC | – | 0,753 | 0,754 |

- **Contra una sola variable.** La mejor sola es la tasa de reprobación (AUC 0,718); sin los evidentes, la tasa de
  abandono de la titulación (0,706). El modelo les gana por 0,080 y 0,017 (logística) y por 0,089 y 0,034 (red).
- **Qué aporta cada fuente** (nuestra logística entrenada solo con esas variables, AUC en prueba): notas 0,732,
  actividad 0,659, matrícula y admisión 0,718, titulación 0,709, todo menos las notas 0,769, todo 0,815 (sin el freno
  del tope). Ninguna fuente sola llega.
- **De qué depende** (importancia por permutación en prueba, por fuente): titulación 36 % (logística) y 35 % (red),
  notas 31 % y 22 %, actividad 18 % y 23 %, matrícula y admisión 15 % y 20 %. **El tope de 35 % no se cumple por poco**
  (la titulación, 35,6 % y 35,3 %). Frenarla más pasa el peso a las notas; el freno ya cuesta 0,018 de AUC (0,815 →
  0,798 en la logística).
- **Verificación.** Con las mismas variables, división e imputación, nuestra logística sin restricción de signo da
  0,8215 y la de scikit-learn 0,8214. La restricción de signo de las variables ampliadas (para que los porqués tengan
  sentido) y el tope cuestan juntos 0,024.
- **Precisión.** Solo abandona el 12 %: en alto abandona el 38 % (3,2 veces la tasa del grupo), en medio el 8 % y en
  bajo el 4 %. La precisión es baja aunque el modelo ordene bien.
- **Aviso antes de las notas.** `desercion/ingreso.py` usa matrícula, admisión, actividad y titulación, sin notas
  (AUC 0,761, F1 0,40, detecta el 59 %). Da el resultado provisional de los 56 registros que el contrato no califica
  (36 sin notas, 20 con presencia de 1 % o menos). Nadie queda a revisión manual.
- `base_datos/registro_academico.sqlite` (1,1 MB) hace de registro académico; `GET /api/estudiantes` responde ~1 MB con
  920 estudiantes (los 864 de prueba y los 56 que el contrato no deja pasar), cada uno con su porqué y en qué mejorar
  en lenguaje llano («Entró al aula virtual 7 días por asignatura; lo usual son 36»).
- **Límites.** La base no registra asistencia ni si el estudiante trabaja (se aproximan con la presencia y la matrícula
  a tiempo parcial); el estrato no se pudo construir; la deuda no se usa; qué letra es abandono se dedujo de los datos.
  Todo está en `desercion/datos_reales.py` (`SUPUESTOS_MAPEO`) y en la página Modelo. No se usa para decidir sobre
  estudiantes reales.

```bash
python -m desercion.datos_reales                                                       # extracto → CSV del contrato
python -m desercion.datos_reales --extraer                                             # rehace el extracto (baja ~270 MB de Zenodo)
python -m desercion.entrenamiento --csv datos/reales/estudiantes_reales.csv --nombre real  # entrena aparte con el contrato ampliado (~3 min)
# --solo-contrato: entrena solo con los 12 campos aunque el CSV traiga los ampliados (para comparar)
python -m desercion.operacion                                                          # arma la base, entrena el aviso antes de las notas y deja la copia para la web
```

## Instalación

```bash
python -m pip install -r requirements-dev.txt   # numpy, pandas, matplotlib, streamlit, scikit-learn
```

`requirements.txt` solo tiene NumPy: es lo que instala Vercel para la inferencia.

## Uso

```bash
python -m desercion.entrenamiento              # datos → variables → entrenamiento → control → evaluación (~1.5 min)
python -m desercion.entrenamiento --hasta datos  # se detiene en una etapa (datos, dependencia, entrenamiento, control)

python pruebas/correr_rondas.py                # rondas 1 y 2 (v1, v2)        --pausa para presentar
python pruebas/correr_ronda3.py                # ronda 3 (v2, v3 y modo reglas) --todos para ver los 35
python pruebas/correr_ronda4.py                # ronda 4 (modo aprendido)     --todos, --pausa
python pruebas/verificar_modelos.py            # gradientes vs. diferencias finitas, métricas vs. scikit-learn, monotonía

streamlit run app.py                           # app local con las 5 secciones
python servidor_local.py                       # la web de Vercel en http://localhost:8000
```

Desde Python:

```python
from desercion.sistema import evaluar
evaluar(entrada)                                          # modo reglas
evaluar(entrada, modo="aprendido")                        # tarjeta de puntaje (logística)
evaluar(entrada, modo="aprendido", modelo="red_neuronal")
```

## Cambiar a datos reales

1. Prepare un CSV con las 12 columnas del contrato más `deserto` (0/1). Booleanos como `true`/`false`;
   `deuda_matricula` puede ir vacía. Los decimales van con punto (`3.8`): `"3,8"` se rechaza como
   `tipo_invalido`, igual que en el contrato.
2. Entrene con ese archivo, sin tocar el código:
   ```bash
   python -m desercion.entrenamiento --csv ruta/al/archivo.csv
   ```
   `cargar_datos_reales()` pasa cada fila por el Paso 1; las que no son válidas se descartan y se cuentan
   por motivo. Los pesos, los reportes y la web se regeneran con los datos nuevos.
3. Corra las rondas (`python pruebas/correr_ronda4.py`) y revise los supuestos del reporte.

## Despliegue en Vercel

Vercel no puede ejecutar Streamlit (necesita un servidor permanente con websockets). Por eso la web
publicada es:

- `public/`: sitio estático con una página por parte: `index.html` (portada), `evaluar.html` (planilla y
  ficha de seguimiento), `proceso.html` (índice), `reporte.html` (el reporte completo, en la web) y una página por cada uno de los
  9 pasos (`contrato`, `datos`, `variables`, `aprendizaje`, `red`, `puntaje`, `pesos`, `resultados`, `pruebas`).
  Cada paso dice qué es, por qué y para qué, y se explica en cajas numeradas con animaciones hechas con los pesos
  reales. Las genera `python -m desercion.paginas_web` desde una sola plantilla.
- `api/evaluar.py` y `api/rondas.py`: funciones Python que llaman a `desercion/` (solo NumPy).

Pasos: en vercel.com, **Add New → Project → Import** el repositorio `pinmons/decersion`, preset
**Other**, sin comando de build. Vercel sirve `public/` y crea las funciones de `api/` con
`requirements.txt`. `vercel.json` incluye en las funciones el paquete, los pesos y los casos de prueba.

El entrenamiento no corre en Vercel: se hace en local, y los pesos (`modelos_entrenados/`) y las gráficas
(`public/reportes/`, copiadas por `python -m desercion.publicar`) se suben al repositorio.

## Estructura

```
contexto/               trabajo previo (solo lectura): contrato, casos, oráculos, v1–v3
desercion/
  contrato.py           esquema E, Paso 1, R3.4
  contrato_ampliado.py  campos extra del modelo real: validación, imputación con indicadora, tasa por titulación
  textos.py             porqués y mejoras en lenguaje llano (operación y aviso antes de las notas)
  reglas.py             Pasos 2 y 3 por reglas (línea base)
  sistema.py            evaluar(entrada, modo, modelo)
  inferencia.py         modo aprendido (solo NumPy)
  datos_sinteticos.py   generador + cargar_datos_reales(csv)
  variables.py          ingeniería de variables
  preprocesamiento.py   división estratificada y estandarización
  dependencia.py        correlaciones, VIF, permutación, tope de dominancia
  modelos/              logistica.py y red_neuronal.py (desde cero)
  entrenamiento.py      orquesta todas las etapas
  tarjeta_puntaje.py    pesos → puntos 0–100 y cortes
  evaluacion.py         métricas en test
  reporte.py, figuras.py, publicar.py, web.py
  datos_reales.py       base real (UPV, Zenodo) → extracto → esquema del contrato, con sus supuestos
  operacion.py          base SQLite → Paso 1 → modelo → un resultado por estudiante
  ingreso.py            aviso antes de las notas: resultado provisional sin notas
  paginas_web.py        plantilla común; paginas/ tiene el HTML de inicio, estudiantes, modelo y proceso
base_datos/             registro académico real en SQLite (lo lee la API)
pruebas/                arnés de las rondas 1–4, casos U01–U15 y su oráculo, verificaciones
modelos_entrenados/     pesos en JSON (los lee la API)
reportes/               gráficas, datos_resumen.md, reporte_entrenamiento.md, resultados.json
datos/                  dataset sintético en CSV; reales/ tiene el extracto de la UPV y el CSV del contrato
api/, public/           web de Vercel
app.py                  app Streamlit local
PLAN.md                 plan por fases y supuestos
```

## Trabajar con Claude Code en remoto

El repositorio está preparado para **Claude Code en la web**: el hook `SessionStart` ejecuta
[scripts/claude-setup.sh](scripts/claude-setup.sh), que instala `requirements-dev.txt` en las sesiones
remotas. Instrucciones del proyecto en [CLAUDE.md](CLAUDE.md).
