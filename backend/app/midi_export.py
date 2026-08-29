"""Exportação para .mid — praticamente de graça, já que temos notas e pedal."""
from __future__ import annotations

from pathlib import Path

import pretty_midi

from .schemas import Transcription

ACOUSTIC_GRAND = 0
SUSTAIN_CC = 64


def write(transcription: Transcription, path: Path) -> Path:
    midi = pretty_midi.PrettyMIDI(initial_tempo=transcription.tempo)
    piano = pretty_midi.Instrument(program=ACOUSTIC_GRAND, name="Piano")

    for note in transcription.notes:
        piano.notes.append(
            pretty_midi.Note(
                velocity=max(1, min(127, int(round(note.velocity * 127)))),
                pitch=note.midi,
                start=note.start,
                end=max(note.end, note.start + 0.01),
            )
        )

    for event in transcription.pedal:
        piano.control_changes.append(
            pretty_midi.ControlChange(number=SUSTAIN_CC, value=127, time=event.start)
        )
        piano.control_changes.append(
            pretty_midi.ControlChange(number=SUSTAIN_CC, value=0, time=event.end)
        )

    midi.instruments.append(piano)
    midi.write(str(path))
    return path
