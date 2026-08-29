"""Tipos internos do pipeline, antes de virarem o contrato da API."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RawNote:
    """Nota como sai de um modelo: tempo real em segundos, sem quantização."""

    midi: int
    start: float
    end: float
    velocity: float  # normalizado 0-1

    @property
    def duration(self) -> float:
        return self.end - self.start


@dataclass
class RawPedal:
    start: float
    end: float
