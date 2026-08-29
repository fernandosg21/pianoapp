"""Unidades puras: nomes de altura e a redução pianística."""
from app.pipeline.base import RawNote
from app.pipeline.merge import dedupe, drop_short, limit_polyphony
from app.pipeline.notes import in_piano_range, midi_to_name, midi_to_octave


def test_midi_60_is_c4():
    assert midi_to_name(60) == "C"
    assert midi_to_octave(60) == 4


def test_midi_69_is_a4():
    assert midi_to_name(69) == "A"
    assert midi_to_octave(69) == 4


def test_piano_range_bounds():
    assert in_piano_range(21) and in_piano_range(108)
    assert not in_piano_range(20) and not in_piano_range(109)


def test_drop_short_removes_blips():
    notes = [RawNote(60, 0.0, 0.01, 0.5), RawNote(62, 0.0, 0.5, 0.5)]
    assert [n.midi for n in drop_short(notes, min_ms=60)] == [62]


def test_dedupe_merges_same_pitch_overlap():
    notes = [RawNote(60, 0.0, 1.0, 0.4), RawNote(60, 0.98, 2.0, 0.9)]
    merged = dedupe(notes)
    assert len(merged) == 1
    assert merged[0].start == 0.0 and merged[0].end == 2.0
    assert merged[0].velocity == 0.9  # fica a mais forte


def test_dedupe_keeps_distinct_repetitions():
    notes = [RawNote(60, 0.0, 0.5, 0.5), RawNote(60, 2.0, 2.5, 0.5)]
    assert len(dedupe(notes)) == 2


def test_limit_polyphony_drops_weakest():
    notes = [RawNote(60 + i, 0.0, 1.0, 0.1 * (i + 1)) for i in range(6)]
    kept = limit_polyphony(notes, max_poly=3)
    assert len(kept) == 3
    assert {n.midi for n in kept} == {63, 64, 65}


def test_limit_polyphony_ignores_non_overlapping():
    notes = [RawNote(60, float(i), float(i) + 0.5, 0.5) for i in range(6)]
    assert len(limit_polyphony(notes, max_poly=2)) == 6
