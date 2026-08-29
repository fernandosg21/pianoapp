"""Seleção de device, orçamento de VRAM e o retry que salva o job de um OOM."""
from __future__ import annotations

import gc
import logging
from typing import Callable, TypeVar

import torch

from . import config

log = logging.getLogger(__name__)

T = TypeVar("T")


def resolve_device() -> torch.device:
    """Respeita PIANOAPP_DEVICE; em 'auto' usa CUDA quando existe, senão CPU.

    O fallback silencioso é proposital: num self-host, um container que não sobe
    porque o passthrough de GPU está mal configurado é pior que um app lento.
    """
    want = config.DEVICE.lower()
    if want == "cpu":
        return torch.device("cpu")
    if want.startswith("cuda"):
        if not torch.cuda.is_available():
            log.warning("PIANOAPP_DEVICE=%s mas CUDA não está disponível; usando CPU", want)
            return torch.device("cpu")
        return torch.device(want)
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def device_info() -> dict:
    dev = resolve_device()
    info: dict = {"device": str(dev), "gpu": dev.type == "cuda"}
    if dev.type == "cuda":
        free, total = torch.cuda.mem_get_info(dev)
        info["gpu_name"] = torch.cuda.get_device_name(dev)
        info["vram_total_mb"] = int(total / 1024**2)
        info["vram_free_mb"] = int(free / 1024**2)
    return info


def release() -> None:
    """Devolve VRAM entre estágios. Sem isso o Demucs deixa cache que aperta o próximo."""
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def with_oom_fallback(fn: Callable[[torch.device], T], device: torch.device) -> tuple[T, torch.device]:
    """Roda `fn` no device pedido; se a VRAM estourar, repete em CPU.

    Com 32 GB de RAM o estágio termina mais devagar em vez de falhar — é a diferença
    entre um self-host utilizável e um que dá erro vermelho no meio do trabalho.
    """
    if device.type != "cuda":
        return fn(device), device
    try:
        return fn(device), device
    except torch.cuda.OutOfMemoryError:
        log.warning("CUDA sem memória; refazendo o estágio em CPU")
        release()
        cpu = torch.device("cpu")
        return fn(cpu), cpu
