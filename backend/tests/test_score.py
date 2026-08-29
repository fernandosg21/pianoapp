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


def test_walking_bass_stays_left_under_a_treble_melody():
    """O caso que a suavização por maioria simples errava.

    Melodia aguda com baixo caminhante: as notas da direita são maioria em toda
    janela, e um sol grave era arrastado para a direita mesmo estando duas oitavas
    abaixo de onde essa mão toca.
    """
    melody = [RawNote(m, i * 0.25, i * 0.25 + 0.2, 0.6) for i, m in enumerate([72, 71, 69, 67, 71, 72])]
    bass = [RawNote(m, i * 0.5, i * 0.5 + 0.4, 0.6) for i, m in enumerate([55, 53, 55])]
    notes = sorted(melody + bass, key=lambda n: (n.start, n.midi))

    hands = split_hands(notes)
    for note, hand in zip(notes, hands):
        expected = Hand.LEFT if note.midi < 60 else Hand.RIGHT
        assert hand is expected, f"MIDI {note.midi} foi para {hand.value}"


def test_melody_dipping_below_middle_c_stays_on_the_right():
    """O caso que a suavização existe para resolver: a frase não pode picar."""
    pitches = [64, 62, 59, 58, 60, 62, 64]  # 59 e 58 caem abaixo do dó central
    notes = [RawNote(m, i * 0.25, i * 0.25 + 0.2, 0.6) for i, m in enumerate(pitches)]
    assert all(hand is Hand.RIGHT for hand in split_hands(notes))
