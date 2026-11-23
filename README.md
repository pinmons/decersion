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

El mismo código se reentrenó con una base real y pública: **4 424 estudiantes** del Instituto Politécnico de
Portalegre (Realinho et al., 2021, UCI, https://doi.org/10.24432/C5MC89, CC BY 4.0). Esa corrida vive aparte
(`modelos_entrenados/real/`, `reportes/real/`) y no toca los modelos sintéticos ni las rondas.

| Métrica en prueba (625 estudiantes reales) | Reglas | Logística | Red neuronal |
|---|---|---|---|
| AUC-ROC | 0.883 | 0.876 | 0.916 |
| F1 (nivel alto) | 0.55 | 0.72 | 0.75 |
| Recall de desertores (nivel alto) | 40 % | 71 % | 69 % |
| Precisión (nivel alto) | 91 % | 73 % | 83 % |

- `base_datos/registro_academico.sqlite` hace de registro académico. `GET /api/estudiantes` la lee, pasa cada
  registro por el Paso 1 y el modelo, y devuelve un resultado por estudiante con el porqué y en qué mejorar.
- **Nadie queda en revisión manual.** 180 registros (todos de un programa cuyo historial académico no está en la
  base) hacen que el contrato se abstenga; para ellos `desercion/ingreso.py` da un resultado **provisional** con los
  datos de la matrícula (AUC 0.785, F1 0.61: más débil que el modelo principal, y la web lo dice). El hueco se le
  pide al registro en un solo aviso. Los 82 con un dato fuera de rango se devuelven solos.
- En la web, cuatro secciones: **Estudiantes** (proceso automático, tablero con gráficas, lista y ficha), **Modelo**
  (AUC, F1, detección y precisión con su símbolo, aciertos, ROC, calibración y el entrenamiento reproducible),
  **Probar un caso** y **Cómo se hizo** (los 9 pasos en cuatro partes; desde ahí se abren el reporte y las pruebas).
- La base no trae asistencia, estrato ni si el estudiante trabaja: son aproximaciones `[SUPUESTO]`, descritas en
  `desercion/datos_reales.py` y en la página Modelo. No se usa para decidir sobre estudiantes reales.

```bash
python -m desercion.datos_reales                                                        # fuente → CSV del contrato
python -m desercion.entrenamiento --csv datos/reales/estudiantes_reales.csv --nombre real  # entrena aparte (~30 s)
python -m desercion.operacion                                                           # arma la base, entrena el modelo de ingreso y deja la copia para la web
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
  datos_reales.py       base real (UCI) → esquema del contrato, con sus supuestos
  operacion.py          base SQLite → Paso 1 → modelo → un resultado por estudiante
  ingreso.py            resultado provisional para quien no tiene historial académico
  paginas_web.py        plantilla común; paginas/ tiene el HTML de inicio, estudiantes, modelo y proceso
base_datos/             registro académico real en SQLite (lo lee la API)
pruebas/                arnés de las rondas 1–4, casos U01–U15 y su oráculo, verificaciones
modelos_entrenados/     pesos en JSON (los lee la API)
reportes/               gráficas, datos_resumen.md, reporte_entrenamiento.md, resultados.json
datos/                  dataset sintético en CSV
api/, public/           web de Vercel
app.py                  app Streamlit local
PLAN.md                 plan por fases y supuestos
```

## Trabajar con Claude Code en remoto

El repositorio está preparado para **Claude Code en la web**: el hook `SessionStart` ejecuta
[scripts/claude-setup.sh](scripts/claude-setup.sh), que instala `requirements-dev.txt` en las sesiones
remotas. Instrucciones del proyecto en [CLAUDE.md](CLAUDE.md).
