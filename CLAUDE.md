# Proyecto: sistema de alerta temprana de deserción (prototipo)

## Qué es
Sistema que recibe el registro de un estudiante de pregrado activo (semestres 2 a 4) y
devuelve su riesgo de deserción (bajo, medio o alto) con una acción recomendada, o un error
controlado, o una abstención que remite el caso a un humano. Tiene dos modos: `reglas`
(pesos fijos, línea base) y `aprendido` (pesos entrenados con datos).

El plan completo está en `PROMPT_PROTOTIPO.md` y el plan de ejecución en `PLAN.md`. El
trabajo previo está en `contexto/` y es de solo lectura.

## Reglas que no se rompen
- Todo en español: código (también nombres de variables, funciones y archivos), comentarios,
  interfaz y reportes.
- El contrato (`contexto/practica_pruebas_estres.md`, pasos 1 a 3 y paso 9) es la fuente de
  verdad. La validación del Paso 1, la regla R3.4 y las garantías aplican en ambos modos.
- Los oráculos nunca se editan para hacer pasar una prueba. Un oráculo dudoso se reporta.
- Con `modo="reglas"`, las rondas 1 a 3 deben seguir en 35/35 después de cada cambio.
- No se inventan resultados: toda métrica sale de ejecutar código. Semillas fijas.
- Toda decisión no especificada se marca como `[SUPUESTO]`.
- Los modelos se implementan desde cero en NumPy. scikit-learn solo para verificar.
- Los datos de entrenamiento son sintéticos. Todo reporte de error debe decirlo.
- La corrida con la base real (UCI, Portalegre) va aparte: `--nombre real`, `modelos_entrenados/real/`,
  `reportes/real/`. Nunca reemplaza a la sintética, que es la que prueban las rondas. Las páginas Estudiantes y
  Modelo usan la real; sus tres datos aproximados (asistencia, estrato, trabaja) se dicen siempre.
- Nada escribe dentro de `contexto/`: los resultados van a `reportes/` o `pruebas/resultados/`.

## Entorno
- El desarrollo local es en Windows; las sesiones remotas de Claude Code corren en Linux.
- `scripts/claude-setup.sh` instala dependencias al inicio de cada sesión remota. Si se añade
  un paso de instalación nuevo, se actualiza ese script.
- Scripts en LF (lo garantiza `.gitattributes`).
- Despliegue en Vercel: `api/` (funciones Python, solo NumPy) + `public/` (interfaz web
  estática). Streamlit (`app.py`) es para uso local; Vercel no puede ejecutarlo.
- Páginas web: se generan con `python -m desercion.paginas_web` (también lo hace `python -m desercion.publicar`);
  no editar los `.html` de `public/` a mano. La plantilla común (cabecera, cuatro secciones de navegación, pie) está
  en `desercion/paginas_web.py`; el HTML de inicio, estudiantes, modelo y el índice de pasos, en `desercion/paginas/`.
  Cada vista tiene su hoja (`public/estilos-<vista>.css`) y su script (`public/js/<vista>.js`); `estilos.css` y
  `util.js` son lo común (tokens, rejilla `.bento`/`.celda`, `.num`, `.rotulo`, gráficas SVG).
- Diseño: una decisión por pantalla (ley de Hick), lo avanzado plegado, cifras en Literata (`.num`), rejilla bento
  para tableros. Antes de dar por buena una vista se mide y se prueba en navegador real (1229×660 y 390 px, sin
  desborde horizontal ni errores de consola).
- Animaciones: seguir las skills `.claude/skills/animate` y `animation-performance` (solo transform y
  opacity, ease-out fuerte, una vez al entrar en pantalla, versión tranquila con reduced motion).
- Diseño de la web: seguir la skill `.claude/skills/frontend-design` y la identidad ya definida en
  `public/estilos.css` (ficha de seguimiento con sello, semáforo de riesgo, tinta azul, Literata +
  Atkinson Hyperlegible). Las gráficas se dibujan en SVG con los datos reales de `public/reportes/`.

## Flujo de trabajo
- Se trabaja y se sube directo a `main` (decisión del dueño del repositorio, 2026-11-03). La rama
  `prototipo` quedó como historial.
- Commits pequeños con mensajes claros en español, uno o más por fase.
- Antes de dar algo por terminado se corren las rondas.

## Comandos
- Pruebas por reglas: `python pruebas/correr_rondas.py` y `python pruebas/correr_ronda3.py`
- Pruebas del modo aprendido: `python pruebas/correr_ronda4.py`
- Verificar gradientes, métricas y monotonía: `python pruebas/verificar_modelos.py`
- Entrenar: `python -m desercion.entrenamiento` (datos reales: `--csv archivo.csv`)
- Base real: `python -m desercion.datos_reales`, luego
  `python -m desercion.entrenamiento --csv datos/reales/estudiantes_reales.csv --nombre real` y
  `python -m desercion.operacion` (arma `base_datos/` y la copia de la web)
- App local: `streamlit run app.py`
- Web local (como en Vercel): `python servidor_local.py` (o `vercel dev`)
