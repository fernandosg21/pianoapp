"""Rota B, primeiro passo — separação de fontes com Demucs.

Numa mixagem densa qualquer modelo de transcrição gera lixo se receber a mistura
inteira. Separar, jogar a bateria fora e transcrever cada stem harmônico em
separado é o que produz o salto de qualidade real nesse caso.
"""
from __future__ import annotations

import logging

import numpy as np
import torch

from .. import config

log = logging.getLogger(__name__)

# A bateria não contribui altura nenhuma; transcrevê-la só adiciona ruído.
DISCARDED_STEMS = {"drums"}

_model = None


def load():
    global _model
    if _model is None:
        from demucs.pretrained import get_model

        _model = get_model(config.DEMUCS_MODEL)
        _model.eval()
    return _model


def unload() -> None:
    global _model
    _model = None


def model_sample_rate() -> int:
    return int(load().samplerate)


def separate(y: np.ndarray, sr: int, device: torch.device) -> dict[str, np.ndarray]:
    """Devolve os stems harmônicos em mono, na taxa do modelo.

    `y` entra mono; o Demucs espera estéreo, então duplicamos o canal. O parâmetro
    `segment` é o que controla o pico de VRAM — é o botão para caber em 6 GB.
    """
    from demucs.apply import apply_model

    model = load()
    model.to(device)

    mix = torch.from_numpy(np.asarray(y, dtype=np.float32))
    if mix.ndim == 1:
        mix = mix.unsqueeze(0)
    if mix.shape[0] == 1 and model.audio_channels == 2:
        mix = mix.repeat(2, 1)

    # O Demucs assume entrada normalizada pela própria estatística da mixagem.
    ref = mix.mean(0)
    mean, std = ref.mean(), ref.std()
    if float(std) > 0:
        mix = (mix - mean) / std

    with torch.no_grad():
        sources = apply_model(
            model,
            mix.unsqueeze(0),
            device=device,
            segment=config.DEMUCS_SEGMENT,
            overlap=config.DEMUCS_OVERLAP,
            split=True,
            progress=False,
        )[0]

    if float(std) > 0:
        sources = sources * std + mean

    stems: dict[str, np.ndarray] = {}
    for name, tensor in zip(model.sources, sources):
        if name in DISCARDED_STEMS:
            continue
        stems[name] = tensor.mean(dim=0).cpu().numpy().astype(np.float32)

    model.to("cpu")
    log.info("separação concluída: stems %s", sorted(stems))
    return stems
