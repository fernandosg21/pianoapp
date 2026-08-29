"""Rota A — modelo dedicado a piano (ByteDance high-resolution piano transcription).

É a melhor qualidade do projeto para piano e instrumento solo, e a única fonte de
pedal de sustain. Em compensação foi treinado só em piano (MAESTRO): numa mixagem de
banda rende pior que o basic-pitch, e por isso a rota B não o usa.
"""
from __future__ import annotations

import contextlib
import logging
import os
from pathlib import Path

import numpy as np
import torch

from .. import config
from .base import RawNote, RawPedal
from .notes import in_piano_range

log = logging.getLogger(__name__)

SAMPLE_RATE = 16000  # fixo pelo modelo (piano_transcription_inference.config)

DEFAULT_CHECKPOINT = (
    Path.home() / "piano_transcription_inference_data" / "note_F1=0.9677_pedal_F1=0.9186.pth"
)

_model = None
_model_device: torch.device | None = None


def checkpoint_path() -> Path:
    return Path(os.getenv("PIANOAPP_PIANO_CHECKPOINT", str(DEFAULT_CHECKPOINT)))


@contextlib.contextmanager
def _legacy_torch_load():
    """Permite carregar o checkpoint de 2021 em PyTorch moderno.

    O torch 2.6 inverteu o default de `torch.load` para weights_only=True, e a lib
    chama torch.load sem esse argumento — o checkpoint não carrega mais sem isto.
    É seguro porque o arquivo vem embutido na imagem, não de entrada do usuário.
    """
    original = torch.load

    def patched(*args, **kwargs):
        kwargs.setdefault("weights_only", False)
        return original(*args, **kwargs)

    torch.load = patched
    try:
        yield
    finally:
        torch.load = original


def load(device: torch.device):
    """Carrega uma vez e reusa. Recarregar por requisição jogaria segundos fora."""
    global _model, _model_device
    if _model is not None and _model_device == device:
        return _model

    from piano_transcription_inference import PianoTranscription

    ckpt = checkpoint_path()
    if not ckpt.exists() or ckpt.stat().st_size < 1.6e8:
        raise RuntimeError(
            f"Checkpoint do modelo de piano ausente ou incompleto em {ckpt}. "
            "A imagem Docker o embute no build; rode scripts/fetch_models.py para baixá-lo."
        )

    with _legacy_torch_load():
        _model = PianoTranscription(
            device=device,
            checkpoint_path=str(ckpt),
            segment_samples=int(SAMPLE_RATE * config.PIANO_SEGMENT_S),
        )
    _model_device = device
    return _model


def unload() -> None:
    global _model, _model_device
    _model = None
    _model_device = None


def transcribe(y: np.ndarray, device: torch.device) -> tuple[list[RawNote], list[RawPedal]]:
    """`y` precisa estar mono e em 16 kHz (SAMPLE_RATE)."""
    model = load(device)
    out = model.transcribe(y.astype(np.float32), None)

    notes = [
        RawNote(
            midi=int(e["midi_note"]),
            start=float(e["onset_time"]),
            end=float(e["offset_time"]),
            velocity=min(1.0, float(e["velocity"]) / 127.0),
        )
        for e in out["est_note_events"]
        if in_piano_range(int(e["midi_note"]))
    ]
    pedal = [
        RawPedal(start=float(e["onset_time"]), end=float(e["offset_time"]))
        for e in out.get("est_pedal_events", [])
    ]
    log.info("modelo de piano: %d notas, %d eventos de pedal", len(notes), len(pedal))
    return notes, pedal
