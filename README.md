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
> tasa de reprobación, y esa variable casi era la respuesta (sola daba AUC 0,891, más que el modelo; el 94 % de quien
> reprobó todo ya se había ido).

| Métrica en prueba (901 estudiantes reales, abandona el 11 %) | Reglas | Logística | Red neuronal |
|---|---|---|---|
| AUC-ROC | 0,729 | 0,743 | 0,742 |
| F1 (nivel alto) | 0,38 | 0,38 | 0,39 |
| Detección (recall, nivel alto) | 48 % | 62 % | 60 % |
| Precisión (nivel alto) | 31 % | 27 % | 29 % |
| % de estudiantes en alto | 17 % | 26 % | 24 % |
| **Sin los casos evidentes** (811; quien no aprobó nada): AUC | 0,675 | 0,703 | 0,703 |
| Sin los casos evidentes: F1 | 0,26 | 0,30 | 0,31 |

- **Contra una sola variable.** La mejor variable sola es la tasa de reprobación (AUC 0,729; 0,678 sin los
  evidentes). Los modelos le ganan por poco (0,015 y 0,026): es lo que aportan las demás variables.
- **De qué depende.** Importancia por permutación en prueba, medida por grupo de variables correlacionadas
  (promedio y tasa de reprobación cuentan juntas): rendimiento del primer cuatrimestre 48 % (logística) y 48 % (red),
  presencia 36 %, asignaturas cursadas 12–13 %, tiempo parcial 3–4 %. **El tope de 35 % no se cumple**: bajarlo más
  hacía que el modelo adivinara peor que la tasa de reprobación sola, y el freno se detiene ahí. Por variable, la que
  más pesa es la presencia (39 %).
- **Por qué la precisión es baja.** Solo abandona el 11 %. Para no marcar en alto a más de un cuarto de la cohorte,
  el nivel alto detecta al 62 % de los que abandonan y en él abandona el 27 % (2,4 veces la tasa base); el resto de
  la detección queda en medio. En bajo abandona el 4 %.
- **Casos evidentes.** En la UPV quien no aprueba nada abandona solo en un 34–36 %: no son evidentes, así que los
  modelos aprenden con todos (sin `--sin-evidentes`). La nota sin ellos se da aparte, y es la honesta.
- `base_datos/registro_academico.sqlite` hace de registro académico. `GET /api/estudiantes` la lee, pasa cada
  registro por el Paso 1 y el modelo, y devuelve un resultado por estudiante con el porqué y en qué mejorar. En
  operación hay 1 040: los 901 de prueba y los 139 que el contrato no deja pasar.
- **Nadie queda en revisión manual.** 135 registros hacen que el contrato se abstenga (104 sin ninguna nota del
  primer cuatrimestre, 31 con presencia de 1 % o menos); para ellos `desercion/ingreso.py` da un resultado
  **provisional** con la matrícula: nota de acceso, opción, dedicación y créditos (AUC 0,712, F1 0,33). Los 4 con un
  dato fuera de rango se devuelven al registro.
- **Límites.** La base no registra asistencia ni si el estudiante trabaja: la asistencia es la presencia en el
  campus (wifi) y el aula virtual, y el trabajo, la matrícula a tiempo parcial. El estrato no se pudo construir (los
  estudios de los padres vienen como letras anonimizadas) y la deuda no se usa (la etiqueta trata aparte a los
  impagos). Qué letra es abandono («A») se dedujo de los datos. Todo está en `desercion/datos_reales.py`
  (`SUPUESTOS_MAPEO`) y en la página Modelo. No se usa para decidir sobre estudiantes reales.

```bash
python -m desercion.datos_reales                                                       # extracto → CSV del contrato
python -m desercion.datos_reales --extraer                                             # rehace el extracto (baja ~270 MB de Zenodo)
python -m desercion.entrenamiento --csv datos/reales/estudiantes_reales.csv --nombre real  # entrena aparte (~2 min)
python -m desercion.operacion                                                          # arma la base, entrena el modelo de ingreso y deja la copia para la web
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
  ingreso.py            resultado provisional para quien no tiene historial académico
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
