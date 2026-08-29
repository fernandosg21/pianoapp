"""Configuração via ambiente. Os defaults miram uma GPU de 6 GB (GTX 1660)."""
from __future__ import annotations

import os
from pathlib import Path

DATA_DIR = Path(os.getenv("PIANOAPP_DATA_DIR", "/data"))
UPLOAD_DIR = DATA_DIR / "uploads"
RESULT_DIR = DATA_DIR / "results"
DB_PATH = DATA_DIR / "pianoapp.db"

# 'auto' cai para CPU quando não há CUDA, em vez de derrubar o app.
DEVICE = os.getenv("PIANOAPP_DEVICE", "auto")

# Limites de upload.
MAX_UPLOAD_MB = int(os.getenv("PIANOAPP_MAX_UPLOAD_MB", "60"))
MAX_DURATION_S = float(os.getenv("PIANOAPP_MAX_DURATION_S", "600"))

# Pico de VRAM do Demucs é controlado por este valor. 7 s cabe folgado em 6 GB.
DEMUCS_SEGMENT = float(os.getenv("PIANOAPP_DEMUCS_SEGMENT", "7.0"))
DEMUCS_MODEL = os.getenv("PIANOAPP_DEMUCS_MODEL", "htdemucs")
DEMUCS_OVERLAP = float(os.getenv("PIANOAPP_DEMUCS_OVERLAP", "0.25"))

# Segmento do modelo ByteDance, em segundos (o default da lib é 10).
PIANO_SEGMENT_S = float(os.getenv("PIANOAPP_PIANO_SEGMENT_S", "10.0"))

# Trabalho de GPU roda em série: dois Demucs simultâneos estouram 6 GB.
MAX_WORKERS = int(os.getenv("PIANOAPP_MAX_WORKERS", "1"))

# Pós-processamento da redução pianística.
MIN_NOTE_MS = float(os.getenv("PIANOAPP_MIN_NOTE_MS", "60"))
MAX_POLYPHONY = int(os.getenv("PIANOAPP_MAX_POLYPHONY", "8"))

# Limiar da triagem: acima disto, considera mix denso.
PERCUSSIVE_THRESHOLD = float(os.getenv("PIANOAPP_PERCUSSIVE_THRESHOLD", "0.42"))

# Serve o frontend compilado; vazio desativa (útil em dev com o Vite separado).
STATIC_DIR = os.getenv("PIANOAPP_STATIC_DIR", "/app/static")


def ensure_dirs() -> None:
    for d in (DATA_DIR, UPLOAD_DIR, RESULT_DIR):
        d.mkdir(parents=True, exist_ok=True)
