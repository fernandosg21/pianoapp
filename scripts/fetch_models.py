"""Pré-baixa os pesos dos modelos.

Roda no build da imagem para que o container funcione offline e a primeira
transcrição não trave baixando 165 MB. A lib da ByteDance baixaria sozinha via
`os.system('wget ...')` sem tratamento de erro — melhor fazer aqui e verificar.
"""
from __future__ import annotations

import shutil
import sys
import urllib.request
from pathlib import Path

PIANO_URL = (
    "https://zenodo.org/record/4034264/files/"
    "CRNN_note_F1%3D0.9677_pedal_F1%3D0.9186.pth?download=1"
)
PIANO_DEST = (
    Path.home() / "piano_transcription_inference_data" / "note_F1=0.9677_pedal_F1=0.9186.pth"
)
MIN_BYTES = int(1.6e8)  # a própria lib rejeita arquivos menores que isto


def fetch_piano_checkpoint() -> None:
    if PIANO_DEST.exists() and PIANO_DEST.stat().st_size >= MIN_BYTES:
        print(f"checkpoint de piano já presente ({PIANO_DEST.stat().st_size / 1e6:.0f} MB)")
        return
    PIANO_DEST.parent.mkdir(parents=True, exist_ok=True)
    print(f"baixando checkpoint de piano (~165 MB) para {PIANO_DEST}")
    tmp = PIANO_DEST.with_suffix(".part")
    with urllib.request.urlopen(PIANO_URL) as response, tmp.open("wb") as out:
        shutil.copyfileobj(response, out)
    size = tmp.stat().st_size
    if size < MIN_BYTES:
        tmp.unlink(missing_ok=True)
        raise SystemExit(f"download incompleto: {size} bytes")
    tmp.rename(PIANO_DEST)
    print(f"ok — {size / 1e6:.0f} MB")


def fetch_demucs() -> None:
    """get_model baixa e guarda no cache do torch hub; chamar já materializa os pesos."""
    import os

    from demucs.pretrained import get_model

    name = os.getenv("PIANOAPP_DEMUCS_MODEL", "htdemucs")
    print(f"baixando pesos do Demucs ({name})")
    get_model(name)
    print("ok")


def fetch_basic_pitch() -> None:
    """O modelo ONNX vem dentro do wheel; só confirmamos que está no lugar."""
    from basic_pitch import ICASSP_2022_MODEL_PATH

    path = Path(str(ICASSP_2022_MODEL_PATH))
    if not path.exists():
        raise SystemExit(f"modelo do basic-pitch não encontrado em {path}")
    if path.suffix != ".onnx":
        print(f"aviso: basic-pitch resolveu para {path.suffix}, esperado .onnx")
    print(f"basic-pitch ok — {path}")


if __name__ == "__main__":
    fetch_basic_pitch()
    fetch_piano_checkpoint()
    fetch_demucs()
    print("\ntodos os modelos prontos.")
    sys.exit(0)
