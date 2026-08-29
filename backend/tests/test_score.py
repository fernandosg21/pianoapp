"""Quantização e separação de mãos."""
from app.pipeline.base import RawNote
from app.pipeline.score import quantize, split_hands
from app.schemas import Hand


def test_quantize_snaps_to_sixteenth_grid():
    # a 120 BPM uma batida dura 0.5 s; 0.26 s cai na semicolcheia mais próxima
    assert quantize(0.26, 120.0) == 0.5
    assert quantize(0.5, 120.0) == 1.0
    assert quantize(0.0, 120.0) == 0.0


def test_split_hands_uses_middle_c():
    notes = [RawNote(48, 0.0, 1.0, 0.5), RawNote(72, 0.0, 1.0, 0.5)]
    assert split_hands(notes) == [Hand.LEFT, Hand.RIGHT]


def test_split_hands_keeps_deep_bass_on_the_left():
    """Um baixo grave não migra para a direita só porque a frase ao redor é aguda."""
    notes = [RawNote(80, 0.0, 0.2, 0.5) for _ in range(4)]
    notes.insert(2, RawNote(36, 0.0, 0.2, 0.5))
    assert split_hands(notes)[2] is Hand.LEFT
