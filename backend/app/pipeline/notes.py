"""Conversões de altura. Fonte única para backend e testes."""
from __future__ import annotations

PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

PIANO_MIN = 21   # A0
PIANO_MAX = 108  # C8


def midi_to_name(midi: int) -> str:
    return PITCH_CLASSES[midi % 12]


def midi_to_octave(midi: int) -> int:
    """Notação científica: MIDI 60 é C4."""
    return midi // 12 - 1


def in_piano_range(midi: int) -> bool:
    return PIANO_MIN <= midi <= PIANO_MAX
