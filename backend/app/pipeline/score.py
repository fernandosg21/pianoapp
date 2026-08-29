"""Tempo, quantização e separação de mãos — o que a partitura precisa.

É a etapa mais frágil do projeto: empilha uma grade rítmica estimada sobre um
resultado de transcrição que já é aproximado. A UI rotula a partitura como
aproximada justamente por isto.
"""
from __future__ import annotations

import logging

import numpy as np
import librosa

from ..schemas import Hand, Mode, Note, PedalEvent, Route, Transcription
from .base import RawNote, RawPedal
from .notes import midi_to_name, midi_to_octave

log = logging.getLogger(__name__)

MIDDLE_C = 60           # fronteira nominal entre as mãos
SUBDIVISION = 4         # semicolcheias por batida
DEFAULT_TEMPO = 120.0
_SMOOTH_WINDOW = 5      # notas vizinhas consideradas na suavização de mão
_MAX_REACH = 7          # semitons: o quanto uma nota pode estar do registro da outra mão


def estimate_tempo(y: np.ndarray, sr: int) -> float:
    try:
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        value = float(np.atleast_1d(tempo)[0])
        return value if value > 0 else DEFAULT_TEMPO
    except Exception:  # áudio curto demais ou sem pulso detectável
        log.warning("não foi possível estimar o tempo; assumindo %s BPM", DEFAULT_TEMPO)
        return DEFAULT_TEMPO


def quantize(value_s: float, tempo: float) -> float:
    """Segundos -> batidas, encaixado na grade de semicolcheia."""
    beats = value_s * tempo / 60.0
    return round(beats * SUBDIVISION) / SUBDIVISION


def split_hands(notes: list[RawNote]) -> list[Hand]:
    """Divide pelo dó central e depois suaviza.

    A divisão crua pica uma linha que cruza a fronteira, então uma nota pode migrar
    para a mão das vizinhas. Mas só migra se estiver de fato no registro daquela
    mão: contar vizinhas não basta — num trecho de melodia aguda sobre baixo
    caminhante, a maioria é sempre da direita, e um sol grave acabava arrastado
    para lá junto, a duas oitavas de onde a mão direita realmente está.
    """
    raw = [Hand.LEFT if n.midi < MIDDLE_C else Hand.RIGHT for n in notes]
    if len(raw) <= _SMOOTH_WINDOW:
        return raw

    smoothed: list[Hand] = []
    half = _SMOOTH_WINDOW // 2
    for i, hand in enumerate(raw):
        lo, hi = max(0, i - half), min(len(raw), i + half + 1)
        window = range(lo, hi)
        lefts = sum(1 for j in window if raw[j] is Hand.LEFT)
        rights = (hi - lo) - lefts
        majority = Hand.LEFT if lefts > rights else Hand.RIGHT

        if majority is hand:
            smoothed.append(hand)
            continue

        neighbours = [notes[j].midi for j in window if raw[j] is majority and j != i]
        centre = sum(neighbours) / len(neighbours) if neighbours else notes[i].midi
        within_reach = abs(notes[i].midi - centre) <= _MAX_REACH
        smoothed.append(majority if within_reach else hand)
    return smoothed


def build(
    notes: list[RawNote],
    pedal: list[RawPedal],
    y: np.ndarray,
    sr: int,
    route: Route,
    mode: Mode,
    device: str,
) -> Transcription:
    ordered = sorted(notes, key=lambda n: (n.start, n.midi))
    tempo = estimate_tempo(y, sr)
    hands = split_hands(ordered)

    built = [
        Note(
            midi=n.midi,
            name=midi_to_name(n.midi),
            octave=midi_to_octave(n.midi),
            start=round(n.start, 4),
            end=round(n.end, 4),
            velocity=round(n.velocity, 3),
            hand=hand,
            start_beat=quantize(n.start, tempo),
            dur_beats=max(1 / SUBDIVISION, quantize(n.duration, tempo)),
        )
        for n, hand in zip(ordered, hands)
    ]

    return Transcription(
        duration=round(len(y) / sr, 3),
        tempo=round(tempo, 2),
        route=route,
        mode=mode,
        device=device,
        notes=built,
        pedal=[PedalEvent(start=round(p.start, 4), end=round(p.end, 4)) for p in pedal],
    )
