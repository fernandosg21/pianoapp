"""Gera áudios sintéticos com notas conhecidas, para os testes de fumaça e o pytest."""
import sys
import numpy as np
import soundfile as sf

SR = 44100


def midi_to_hz(m: int) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def tone(midi: int, dur: float, sr: int = SR) -> np.ndarray:
    """Nota com alguns harmônicos e envelope, para parecer instrumento e não senóide pura."""
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    f = midi_to_hz(midi)
    wave = sum(a * np.sin(2 * np.pi * f * h * t) for h, a in [(1, 1.0), (2, 0.5), (3, 0.25)])
    env = np.exp(-3.0 * t) * (1 - np.exp(-200.0 * t))
    return wave * env


def melody(path: str) -> None:
    """C4 E4 G4 C5, uma por segundo — alturas MIDI 60, 64, 67, 72."""
    out = np.concatenate([tone(m, 1.0) for m in (60, 64, 67, 72)])
    sf.write(path, out / np.max(np.abs(out)), SR)


def chord(path: str) -> None:
    """Tríade de dó maior sustentada: 60, 64, 67 simultâneas."""
    parts = [tone(m, 2.0) for m in (60, 64, 67)]
    out = sum(parts)
    sf.write(path, out / np.max(np.abs(out)), SR)


if __name__ == "__main__":
    dest = sys.argv[1] if len(sys.argv) > 1 else "."
    melody(f"{dest}/melody.wav")
    chord(f"{dest}/chord.wav")
    print(f"escrito em {dest}: melody.wav (60,64,67,72), chord.wav (60,64,67)")
