#!/usr/bin/env bash
set -euo pipefail


PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
VENV_DIR="$BACKEND_DIR/.venv"

if [ ! -d "$BACKEND_DIR" ]; then
  echo "[ERROR] backend directory not found at $BACKEND_DIR" >&2
  exit 1
fi

# 1. Check uv
if ! command -v uv >/dev/null 2>&1; then
  echo "[INFO] uv not found, installing uv (this may take a moment)..."
  # Official install method from https://github.com/astral-sh/uv
  curl -LsSf https://astral.sh/uv/install.sh | sh
  # Try to ensure uv is on PATH for this session
  if [ -d "$HOME/.cargo/bin" ]; then
    export PATH="$HOME/.cargo/bin:$PATH"
  fi
  if ! command -v uv >/dev/null 2>&1; then
    echo "[ERROR] uv still not found after installation. Please ensure it is on your PATH." >&2
    exit 1
  fi
else
  echo "[INFO] Using existing uv: $(command -v uv)"
fi

cd "$BACKEND_DIR"

# Parse arguments (currently only --run)
RUN_SERVER=false
if [ "${1-}" = "--run" ]; then
  RUN_SERVER=true
fi

# 2. Create virtual environment with uv
if [ ! -d "$VENV_DIR" ]; then
  echo "[INFO] Creating virtual environment with uv at $VENV_DIR ..."
  uv venv "$VENV_DIR"
else
  echo "[INFO] Virtual environment already exists at $VENV_DIR, reusing."
fi

# 3. Install dependencies using uv (fast pip backend)
echo "[INFO] Installing Python dependencies from requirements.txt using uv pip..."
# Install into the venv's Python using global uv
uv pip install -r requirements.txt --python "$VENV_DIR/bin/python"

# 4. If requested, activate venv and start uvicorn
if [ "$RUN_SERVER" = true ]; then
  echo "[INFO] Starting uvicorn server (app.main:app, --reload) ..."
  # Activate venv for this script process only
  # shellcheck disable=SC1090
  source "$VENV_DIR/bin/activate"
  uvicorn app.main:app --reload
  exit 0
fi

cat <<EOF

[INFO] Setup complete.

To activate the environment, run:
  source backend/.venv/bin/activate

To start the backend server, run (after activating the venv):
  uvicorn app.main:app --reload

Or run everything in one step:
  ./setup.sh --run

EOF
