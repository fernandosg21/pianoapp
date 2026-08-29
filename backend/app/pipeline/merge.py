"""Redução pianística: transformar a saída crua dos modelos em algo tocável.

Sem esta etapa a rota B devolve a soma de três stems transcritos — uma nuvem de
notas que nenhuma mão executa. Aqui o resultado vira duas mãos plausíveis.
"""
from __future__ import annotations

import logging

from .. import config
from .base import RawNote

log = logging.getLogger(__name__)

# Duas notas de mesma altura separadas por menos que isto são a mesma nota partida.
_MERGE_GAP_S = 0.05


def drop_short(notes: list[RawNote], min_ms: float | None = None) -> list[RawNote]:
    limit = (min_ms if min_ms is not None else config.MIN_NOTE_MS) / 1000.0
    return [n for n in notes if n.duration >= limit]


def dedupe(notes: list[RawNote]) -> list[RawNote]:
    """Funde repetições da mesma altura que se sobrepõem ou quase se tocam.

    Stems diferentes captam o mesmo instrumento vazado, então a mesma nota aparece
    duas vezes; e um modelo às vezes parte uma nota longa em duas.
    """
    by_pitch: dict[int, list[RawNote]] = {}
    for n in notes:
        by_pitch.setdefault(n.midi, []).append(n)

    merged: list[RawNote] = []
    for midi, group in by_pitch.items():
        group.sort(key=lambda n: n.start)
        current = group[0]
        for nxt in group[1:]:
            if nxt.start <= current.end + _MERGE_GAP_S:
                current = RawNote(
                    midi=midi,
                    start=current.start,
                    end=max(current.end, nxt.end),
                    velocity=max(current.velocity, nxt.velocity),
                )
            else:
                merged.append(current)
                current = nxt
        merged.append(current)

    merged.sort(key=lambda n: (n.start, n.midi))
    return merged


def limit_polyphony(notes: list[RawNote], max_poly: int | None = None) -> list[RawNote]:
    """Mantém no máximo N notas soando ao mesmo tempo, descartando as mais fracas."""
    limit = max_poly if max_poly is not None else config.MAX_POLYPHONY
    if limit <= 0:
        return notes

    ordered = sorted(notes, key=lambda n: n.start)
    kept: list[RawNote] = []
    active: list[RawNote] = []

    for note in ordered:
        active = [a for a in active if a.end > note.start]
        if len(active) >= limit:
            weakest = min([*active, note], key=lambda n: n.velocity)
            if weakest is note:
                continue
            active.remove(weakest)
            kept.remove(weakest)
        active.append(note)
        kept.append(note)

    kept.sort(key=lambda n: (n.start, n.midi))
    return kept


def reduce_to_piano(note_groups: list[list[RawNote]]) -> list[RawNote]:
    """Pipeline completo de redução, aplicado à união dos stems transcritos."""
    combined = [n for group in note_groups for n in group]
    before = len(combined)
    result = limit_polyphony(dedupe(drop_short(combined)))
    log.info("redução pianística: %d notas cruas -> %d", before, len(result))
    return result
