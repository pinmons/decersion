#!/usr/bin/env bash
# Instala dependencias al iniciar una sesión remota de Claude Code.
# En local no hace nada (CLAUDE_CODE_REMOTE solo vale "true" en la nube).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}"

# Node.js
if [ -f package-lock.json ]; then
  echo "[setup] npm ci"
  npm ci
elif [ -f pnpm-lock.yaml ]; then
  echo "[setup] pnpm install"
  npx --yes pnpm install --frozen-lockfile
elif [ -f yarn.lock ]; then
  echo "[setup] yarn install"
  npx --yes yarn install --frozen-lockfile
elif [ -f package.json ]; then
  echo "[setup] npm install"
  npm install
fi

# Python
if [ -f requirements.txt ]; then
  echo "[setup] pip install -r requirements.txt"
  pip install -r requirements.txt
elif [ -f pyproject.toml ]; then
  echo "[setup] pip install -e ."
  pip install -e .
fi

echo "[setup] listo"
