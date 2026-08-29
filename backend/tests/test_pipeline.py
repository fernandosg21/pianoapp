"""Integração do pipeline sobre áudio sintético de alturas conhecidas.

Roda no modo rápido: é o caminho que não depende de checkpoint baixado, então
funciona em CI e em máquina sem GPU.
"""
import numpy as np
import pytest

from app.pipeline import router, transcribe_file
from app.pipeline.notes import midi_to_name
from app.schemas import Mode, Route


@pytest.mark.slow
def test_melody_pitches_are_recovered(melody_wav):
    result = transcribe_file(melody_wav, mode=Mode.FAST)
    detected = sorted({n.midi for n in result.notes})
    assert detected == [60, 64, 67, 72]
    assert [n.name for n in sorted(result.notes, key=lambda n: n.start)][:2] == ["C", "E"]


@pytest.mark.slow
def test_chord_recovers_all_three_pitches(chord_wav):
    result = transcribe_file(chord_wav, mode=Mode.FAST)
    detected = {n.midi for n in result.notes}
    assert {60, 64, 67} <= detected


@pytest.mark.slow
def test_a440_maps_to_midi_69(tmp_path):
    import soundfile as sf
    from scripts.make_test_audio import SR, tone

    path = tmp_path / "a440.wav"
    sf.write(path, tone(69, 2.0), SR)
    result = transcribe_file(path, mode=Mode.FAST)
    assert 69 in {n.midi for n in result.notes}
    assert midi_to_name(69) == "A"


@pytest.mark.slow
def test_silence_is_rejected_with_a_clear_message(tmp_path):
    import soundfile as sf

    path = tmp_path / "silence.wav"
    sf.write(path, np.zeros(44100), 44100)
    with pytest.raises(ValueError, match="silêncio"):
        transcribe_file(path, mode=Mode.FAST)


def test_triage_calls_harmonic_audio_solo(melody_wav):
    import librosa

    y, sr = librosa.load(str(melody_wav), sr=22050, mono=True)
    assert router.classify(y, sr).route is Route.SOLO


def test_triage_calls_noise_a_dense_mix():
    """Ruído branco é o extremo percussivo — precisa cair na rota de separação."""
    rng = np.random.default_rng(0)
    y = rng.standard_normal(22050 * 3).astype(np.float32) * 0.3
    assert router.classify(y, 22050).route is Route.DENSE_MIX


def test_forced_route_overrides_triage(melody_wav):
    import librosa

    y, sr = librosa.load(str(melody_wav), sr=22050, mono=True)
    info = router.classify(y, sr, force=Route.DENSE_MIX)
    assert info.route is Route.DENSE_MIX and info.forced
