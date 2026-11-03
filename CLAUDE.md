# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio.

## Proyecto

`decersion` — pendiente de definir (descripción, objetivo y stack). Actualiza esta sección cuando se decida.

## Idioma

- Responde y escribe la documentación en español.
- Nombres de código (variables, funciones, archivos) en inglés.

## Entorno

- El desarrollo local es en Windows; las sesiones remotas de Claude Code corren en Linux.
- `scripts/claude-setup.sh` instala dependencias al inicio de cada sesión remota. Si añades un gestor de paquetes o un paso de instalación nuevo, actualiza ese script.
- Mantén los scripts en LF (lo garantiza `.gitattributes`).

## Flujo de trabajo

- Trabaja en ramas; no hagas push directo a `main`.
- Commits pequeños con mensajes claros en español.
- Antes de dar algo por terminado, ejecuta los tests y el linter si existen.

## Comandos

<!-- Rellenar cuando exista el stack, por ejemplo:
- Instalar: `npm install`
- Desarrollo: `npm run dev`
- Tests: `npm test`
-->
