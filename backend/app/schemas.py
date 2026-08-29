"""Contrato da API. O frontend espelha estes tipos em src/types.ts."""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class Mode(str, Enum):
    """Modo de qualidade escolhido no upload."""

    FAST = "fast"
    PRECISE = "precise"


class Route(str, Enum):
    """Caminho do pipeline. A triagem escolhe, o usuário pode forçar."""

    SOLO = "solo"
    DENSE_MIX = "dense_mix"


class Hand(str, Enum):
    LEFT = "left"
    RIGHT = "right"


class Stage(str, Enum):
    """Estágios reportados no progresso. Um job de minutos precisa disso."""

    QUEUED = "queued"
    LOADING = "loading"
    TRIAGE = "triage"
    SEPARATION = "separation"
    TRANSCRIPTION = "transcription"
    SCORE = "score"
    DONE = "done"


class JobState(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    ERROR = "error"


class Note(BaseModel):
    midi: int = Field(ge=21, le=108, description="Altura MIDI, faixa do piano A0-C8")
    name: str = Field(description="Nome da classe de altura em notação inglesa, ex. 'C#'")
    octave: int
    start: float = Field(description="Segundos reais — o piano roll segue o áudio")
    end: float
    velocity: float = Field(ge=0.0, le=1.0)
    hand: Hand
    start_beat: float = Field(description="Posição quantizada em batidas — a partitura usa esta")
    dur_beats: float


class PedalEvent(BaseModel):
    """Só existe na rota de piano solo: o basic-pitch não estima pedal."""

    start: float
    end: float


class Transcription(BaseModel):
    duration: float
    tempo: float
    time_signature: tuple[int, int] = (4, 4)
    route: Route
    mode: Mode
    device: str
    notes: list[Note]
    pedal: list[PedalEvent] = []


class TriageInfo(BaseModel):
    """Por que a triagem decidiu o que decidiu — a UI mostra isso."""

    route: Route
    percussive_ratio: float
    forced: bool = False


class JobSummary(BaseModel):
    """Uma linha da biblioteca de transcrições."""

    id: str
    filename: str
    state: JobState
    mode: Mode
    route: Route | None = None
    created_at: float
    duration: float | None = None


class JobStatus(BaseModel):
    id: str
    filename: str
    state: JobState
    stage: Stage
    progress: float = Field(ge=0.0, le=1.0)
    queue_position: int | None = None
    mode: Mode
    route: Route | None = None
    device: str | None = None
    error: str | None = None
    created_at: float


class HealthResponse(BaseModel):
    status: str = "ok"
    device: str
    gpu: bool
    gpu_name: str | None = None
    vram_total_mb: int | None = None
    vram_free_mb: int | None = None
    models_loaded: list[str]
