# decersion

Proyecto en construcción.

## Trabajar con Claude Code en remoto

Este repositorio está preparado para usarse con **Claude Code en la web** (sesiones en la nube).

### Primera vez (una sola vez)

1. Entra en <https://claude.ai/code> e inicia sesión.
2. Conecta tu cuenta de GitHub e instala la **Claude GitHub App** dando acceso al repositorio `pinmons/decersion`.
3. Crea un entorno (environment) para el repo. Con acceso a red "Trusted" basta para instalar paquetes de npm/pip.

### Cada sesión

1. En claude.ai/code elige el repo `pinmons/decersion` y escribe la tarea.
2. Al arrancar, el hook `SessionStart` ejecuta [scripts/claude-setup.sh](scripts/claude-setup.sh), que instala las dependencias automáticamente (solo en remoto).
3. Claude trabaja en una rama propia y te propone los cambios. Puedes abrir un PR desde la web o traerte la sesión a tu terminal con "Open in CLI" (`claude --teleport`).

También puedes lanzar una tarea remota desde tu terminal local con `claude --remote "tu tarea"`.

### Archivos de configuración

| Archivo | Para qué sirve |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Instrucciones y contexto del proyecto que Claude lee siempre |
| [.claude/settings.json](.claude/settings.json) | Permisos y hooks compartidos |
| [scripts/claude-setup.sh](scripts/claude-setup.sh) | Instalación de dependencias al arrancar una sesión remota |
| [.gitattributes](.gitattributes) | Fuerza finales de línea LF (los scripts se ejecutan en Linux) |
