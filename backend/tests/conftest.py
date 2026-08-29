import os
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT.parent))

# Isola os dados de teste antes de qualquer import do app.
_TMP = tempfile.mkdtemp(prefix="pianoapp-test-")
os.environ.setdefault("PIANOAPP_DATA_DIR", _TMP)
os.environ.setdefault("PIANOAPP_STATIC_DIR", str(Path(_TMP) / "no-static"))
os.environ.setdefault("PIANOAPP_DEVICE", "cpu")

from scripts.make_test_audio import chord, melody  # noqa: E402


@pytest.fixture(scope="session")
def audio_dir() -> Path:
    directory = Path(_TMP) / "audio"
    directory.mkdir(parents=True, exist_ok=True)
    melody(str(directory / "melody.wav"))
    chord(str(directory / "chord.wav"))
    return directory


@pytest.fixture(scope="session")
def melody_wav(audio_dir: Path) -> Path:
    return audio_dir / "melody.wav"


@pytest.fixture(scope="session")
def chord_wav(audio_dir: Path) -> Path:
    return audio_dir / "chord.wav"
