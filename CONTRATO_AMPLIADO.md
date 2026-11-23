# Contrato ampliado (solo el modelo de la base real)

El contrato de 12 campos (`desercion/contrato.py`, `contexto/practica_pruebas_estres.md`) **no cambia**: lo siguen
usando el modo reglas, «Probar un caso», «Cómo se hizo», la corrida sintética y las rondas 1 a 4. El modelo
entrenado con la base real de la UPV (`--nombre real`, páginas Estudiantes y Modelo) recibe, **en el mismo registro**,
los campos de abajo. El Paso 1 del contrato ignora las claves que no conoce, así que un registro ampliado pasa por él
igual que uno de 12 campos. Código: `desercion/contrato_ampliado.py`.

## Qué se conserva del contrato original

- **Paso 1** (validación de los 12 campos, población, faltantes obligatorios, contradicciones C1–C4): igual, antes de
  todo lo demás. Un registro sin notas del primer cuatrimestre sigue abstenido.
- **R3.4** (promedio < 3,0 y asistencia < 70 → alto): igual, en los dos modelos.
- **Garantías**: nunca lanza excepción; no califica fuera de la población; no inventa datos en silencio; los umbrales
  se aplican tal como están.
- **Abstenciones**: las del Paso 1. Quien queda abstenido recibe el resultado provisional del aviso antes de las notas
  (`desercion/ingreso.py`), marcado como provisional.

## Los campos

Todos son **opcionales**. Fuente: «StudentDropoutDataset», UPV (Zenodo, CC BY 4.0); se arman en
`desercion/datos_reales.py` (`mapear`) solo con lo que se sabía **al cerrar el primer cuatrimestre** (enero).

| Campo | Fuente | Tipo y rango | De dónde sale | Si falta |
|---|---|---|---|---|
| `nota_media_cuatrimestre` | notas | real 0–10 | media de todas las notas presentadas del 1.er cuatrimestre | mediana + aviso |
| `nota_minima_cuatrimestre` | notas | real 0–10 | la más baja de las presentadas | mediana + aviso |
| `asignaturas_no_presentadas` | notas | entero 0–12 (≤ cursadas) | asignaturas sin nota | mediana + aviso |
| `dias_campus_sep_nov` | actividad | real 0–91 | días con conexión al wifi del campus, sept.–nov. | mediana + `sin_registro_wifi` |
| `dias_campus_dic_ene` | actividad | real 0–62 | lo mismo, dic.–enero | mediana + `sin_registro_wifi` |
| `dias_aula_virtual` | actividad | real 0–153 | días en el aula virtual, promedio por asignatura | mediana + `sin_aula_virtual` |
| `entregas_por_asignatura` | actividad | real 0–200 | tareas y cuestionarios entregados por asignatura | mediana + `sin_aula_virtual` |
| `nota_acceso` | admisión | real 0–14 | nota de acceso a la universidad | mediana + `sin_nota_acceso` |
| `nota_bachillerato` | admisión | real 0–10 | nota media del bachillerato | mediana + `sin_nota_bachillerato` |
| `opcion_titulacion` | admisión | entero 1–30 | en qué opción pidió la titulación | mediana + `sin_opcion_titulacion` |
| `tipo_ingreso` | admisión | texto | vía de ingreso («NAP» = acceso ordinario) | cuenta como ordinario, sin indicadora (ver abajo) |
| `titulacion` | titulación | texto | código de la titulación (T01…T45) | tasa general de abandono |

Las variables del contrato original también se asignan a una fuente: promedio, tasa de reprobación y asignaturas
cursadas son **notas**; la asistencia (presencia) es **actividad**; trabaja (tiempo parcial) y créditos son
**matrícula y admisión**.

**Validación de los campos ampliados** (`contrato_ampliado.validar`, después del Paso 1): un campo presente con tipo
o rango inválido es un `error` controlado con su campo (`tipo_invalido`, `fuera_de_rango`); no presentarse a más
asignaturas de las cursadas, o una nota mínima mayor que la media, es `abstener` por `datos_contradictorios`.

## Qué entra al modelo

- Cada campo numérico, **recortado** al percentil 99 de entrenamiento (los conteos no se recortan) [SUPUESTO].
- Las **indicadoras «sin dato»** (`sin_registro_wifi`, `sin_aula_virtual`, `sin_nota_acceso`, `sin_nota_bachillerato`,
  `sin_opcion_titulacion`).
- `ingreso_ordinario` (1 si la vía es «NAP»).
- `abandono_titulacion`: la tasa de abandono de su titulación entre los estudiantes de **entrenamiento**, suavizada
  hacia la tasa general con 20 estudiantes ficticios (una titulación con 8 estudiantes no da una tasa fiable). Para
  cada estudiante de entrenamiento se calcula **fuera de pliegue** (5 partes: su propio desenlace no cuenta); validación,
  prueba y operación usan la de todo el entrenamiento. La ficha lo dice así: «En su titulación abandona el 21 %».

Después, la misma Fase 3 de siempre quita lo redundante (|r| > 0,8 o VIF > 10). Entre una variable del contrato y una
ampliada que dicen casi lo mismo se queda la del contrato; entre la nota de acceso y la de bachillerato, la de acceso.
Lo que quedó fuera en la corrida publicada está en `reportes/real/reporte_entrenamiento.md`.

**Sentido de cada variable** [SUPUESTO]: en las dos redes (logística y neuronal) el peso de cada variable ampliada con
un sentido claro está restringido a ese sentido: más nota, más días en el campus o más entregas nunca suben el riesgo;
más abandono en la titulación o elegirla en una opción más baja nunca lo bajan; y **que falte un dato nunca baja el
riesgo** (el mismo principio que el contrato aplica a la deuda ausente). Sin esto, la logística aprendía que, a igual
tasa de reprobación, más nota de acceso sube el riesgo, y la ficha habría dado como porqué «entró con 13 de nota de
acceso». Las variables del contrato original no se restringen (como antes).

## Imputación: no se inventa en silencio

Lo que falta se reemplaza por la **mediana de los estudiantes de entrenamiento** y se enciende su indicadora. Las
medianas, los recortes y la tabla de tasas por titulación se guardan en el JSON del modelo (clave `ampliado` de
`modelos_entrenados/real/*.json`), así la inferencia (Vercel, solo NumPy) hace exactamente lo mismo. La salida lista
los campos que faltaban en `datos_no_informados`, y la ficha del estudiante dice «sin dato».

## Quién no entra en la base

Los **334 estudiantes con impago** de matrícula. La fuente no marca a ninguno como abandono (0 de 334) aunque el 69 %
no aprobó ninguna asignatura: la etiqueta los trata aparte y no se sabe si abandonaron. Eran casi todos los que no
tienen nota de acceso ni vía de ingreso, así que con ellos dentro el modelo habría aprendido que «no tener nota de
acceso» protege. Por eso, entre los que quedan, la nota de acceso falta solo en 42 (0,7 %), no en el ~6 % de la fuente
completa. Los 54 sin vía de ingreso que quedan tampoco tienen ningún abandono: por eso la vía ausente no tiene
indicadora.

## Cómo se usa

```bash
python -m desercion.datos_reales                                                          # CSV con el contrato ampliado
python -m desercion.entrenamiento --csv datos/reales/estudiantes_reales.csv --nombre real   # lo detecta y lo usa
python -m desercion.entrenamiento --csv datos/reales/estudiantes_reales.csv --nombre real12 --solo-contrato  # 12 campos, para comparar
python -m desercion.operacion                                                             # base, aviso antes de las notas y copia web
```

Desde Python, un registro ampliado se evalúa igual que siempre:
`evaluar({...12 campos..., "dias_campus_sep_nov": 9, "titulacion": "T05", ...}, modo="aprendido", origen="real")`.
