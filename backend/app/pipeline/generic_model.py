"""Modelo multi-instrumento (basic-pitch/Spotify), backend ONNX.

Usado no modo rápido e, na rota B, em cada stem separado. Ao contrário do modelo
da ByteDance ele não é piano-only, e é por isso que atende a mixagem de banda.
"""
from __future__ import annotations

import logging
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from .base import RawNote
from .notes import PIANO_MAX, PIANO_MIN, in_piano_range

log = logging.getLogger(__name__)

# Fora da faixa do piano nada nos interessa; estreitar a busca reduz falso positivo.
MIN_FREQ = 27.5    # A0
MAX_FREQ = 4186.0  # C8


def _midi_to_hz(midi: int) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def transcribe_array(
    y: np.ndarray,
    sr: int,
    onset_threshold: float = 0.5,
    frame_threshold: float = 0.3,
    minimum_note_length: float = 58.0,
) -> list[RawNote]:
    """O basic-pitch só aceita caminho de arquivo, então gravamos um WAV temporário."""
    from basic_pitch.inference import predict

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "stem.wav"
        sf.write(path, y, sr)
        _, _, events = predict(
            str(path),
            onset_threshold=onset_threshold,
            frame_threshold=frame_threshold,
            minimum_note_length=minimum_note_length,
            minimum_frequency=MIN_FREQ,
            maximum_frequency=MAX_FREQ,
        )

    notes = [
        RawNote(midi=int(midi), start=float(start), end=float(end), velocity=min(1.0, float(amp)))
        for start, end, midi, amp, *_ in events
        if in_piano_range(int(midi))
    ]
    log.info("basic-pitch: %d notas", len(notes))
    return notes
