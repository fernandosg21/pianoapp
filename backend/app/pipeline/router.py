"""Triagem: instrumento solo ou mix denso?

Heurística, não classificador. Por isso o resultado é exposto na API e o usuário
pode forçar a outra rota — um caso de borda mal classificado, sem escapatória,
vira um resultado ruim que a pessoa não consegue explicar.
"""
from __future__ import annotations

import numpy as np
import librosa

from .. import config
from ..schemas import Route, TriageInfo


def percussive_ratio(y: np.ndarray, sr: int) -> float:
    """Fração da energia que é percussiva, via separação harmônico/percussivo.

    Bateria e transientes densos empurram para 1; piano e vozes sustentadas, para 0.
    """
    harmonic, percussive = librosa.effects.hpss(y)
    h_energy = float(np.sum(harmonic.astype(np.float64) ** 2))
    p_energy = float(np.sum(percussive.astype(np.float64) ** 2))
    total = h_energy + p_energy
    if total <= 0:
        return 0.0
    return p_energy / total


def classify(y: np.ndarray, sr: int, force: Route | None = None) -> TriageInfo:
    ratio = percussive_ratio(y, sr)
    if force is not None:
        return TriageInfo(route=force, percussive_ratio=ratio, forced=True)
    route = Route.DENSE_MIX if ratio >= config.PERCUSSIVE_THRESHOLD else Route.SOLO
    return TriageInfo(route=route, percussive_ratio=ratio, forced=False)
