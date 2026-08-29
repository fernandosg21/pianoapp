"""Orquestração do pipeline adaptativo.

Nenhum modelo é o melhor para os dois tipos de entrada: o modelo de piano ganha
com folga em instrumento solo e perde numa mixagem de banda, onde o caminho bom é
separar as fontes antes. A triagem escolhe; o usuário pode forçar.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Callable

import librosa
import numpy as np

from .. import gpu
from ..schemas import Mode, Route, Stage, Transcription
from . import generic_model, merge, piano_model, router, score, separate
from .base import RawNote, RawPedal

log = logging.getLogger(__name__)

ANALYSIS_SR = 22050  # suficiente para triagem e detecção de pulso

ProgressFn = Callable[[Stage, float], None]


def _noop(stage: Stage, progress: float) -> None:
    pass


def transcribe_file(
    path: Path,
    mode: Mode = Mode.PRECISE,
    force_route: Route | None = None,
    on_progress: ProgressFn | None = None,
) -> Transcription:
    progress = on_progress or _noop
    device = gpu.resolve_device()

    progress(Stage.LOADING, 0.05)
    y_analysis, _ = librosa.load(str(path), sr=ANALYSIS_SR, mono=True)
    if not np.any(np.abs(y_analysis) > 1e-4):
        raise ValueError("O áudio parece estar em silêncio — não há o que transcrever.")

    progress(Stage.TRIAGE, 0.1)
    triage = router.classify(y_analysis, ANALYSIS_SR, force=force_route)
    log.info(
        "triagem: rota=%s razão percussiva=%.3f forçada=%s",
        triage.route.value, triage.percussive_ratio, triage.forced,
    )

    pedal: list[RawPedal] = []

    if mode is Mode.FAST:
        # Modo rápido ignora a rota: um único passe multi-instrumento, sem separação.
        progress(Stage.TRANSCRIPTION, 0.3)
        y_native, sr_native = librosa.load(str(path), sr=None, mono=True)
        groups = [generic_model.transcribe_array(y_native, sr_native)]
        used_device = "cpu"  # basic-pitch roda em ONNX/CPU
    elif triage.route is Route.SOLO:
        progress(Stage.TRANSCRIPTION, 0.3)
        y_16k, _ = librosa.load(str(path), sr=piano_model.SAMPLE_RATE, mono=True)
        (result, used) = gpu.with_oom_fallback(
            lambda dev: piano_model.transcribe(y_16k, dev), device
        )
        notes, pedal = result
        groups = [notes]
        used_device = str(used)
        gpu.release()
    else:
        progress(Stage.SEPARATION, 0.2)
        sr_demucs = separate.model_sample_rate()
        y_demucs, _ = librosa.load(str(path), sr=sr_demucs, mono=True)
        stems, used = gpu.with_oom_fallback(
            lambda dev: separate.separate(y_demucs, sr_demucs, dev), device
        )
        used_device = str(used)
        gpu.release()

        progress(Stage.TRANSCRIPTION, 0.5)
        groups = []
        for i, (name, stem) in enumerate(sorted(stems.items())):
            log.info("transcrevendo stem %s", name)
            groups.append(generic_model.transcribe_array(stem, sr_demucs))
            progress(Stage.TRANSCRIPTION, 0.5 + 0.35 * (i + 1) / len(stems))

    progress(Stage.SCORE, 0.9)
    reduced: list[RawNote] = merge.reduce_to_piano(groups)
    result = score.build(
        reduced, pedal, y_analysis, ANALYSIS_SR, triage.route, mode, used_device
    )
    progress(Stage.DONE, 1.0)
    return result
