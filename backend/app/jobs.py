"""Fila de transcrição.

Trabalho de GPU roda em série por padrão (MAX_WORKERS=1): dois Demucs simultâneos
estouram os 6 GB de uma GTX 1660. O estado vive em SQLite para sobreviver a restart.
"""
from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from . import config, db, midi_export
from .pipeline import transcribe_file
from .schemas import JobState, JobStatus, JobSummary, Mode, Route, Stage

log = logging.getLogger(__name__)

_executor: ThreadPoolExecutor | None = None
_pending: list[str] = []   # ids ainda não iniciados, para reportar posição na fila
_pending_lock = threading.Lock()


def start() -> None:
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(max_workers=config.MAX_WORKERS, thread_name_prefix="job")
    recovered = db.recover_interrupted()
    if recovered:
        log.info("%d job(s) interrompidos por reinício foram marcados como erro", recovered)


def shutdown() -> None:
    global _executor
    if _executor is not None:
        _executor.shutdown(wait=False, cancel_futures=True)
        _executor = None


def submit(audio_path: Path, filename: str, mode: Mode, force_route: Route | None) -> str:
    if _executor is None:
        raise RuntimeError("A fila não foi inicializada.")

    job_id = uuid.uuid4().hex[:12]
    db.insert({
        "id": job_id,
        "filename": filename,
        "state": JobState.QUEUED.value,
        "stage": Stage.QUEUED.value,
        "progress": 0.0,
        "mode": mode.value,
        "created_at": time.time(),
        "audio_path": str(audio_path),
    })
    with _pending_lock:
        _pending.append(job_id)
    _executor.submit(_run, job_id, audio_path, mode, force_route)
    return job_id


def _run(job_id: str, audio_path: Path, mode: Mode, force_route: Route | None) -> None:
    with _pending_lock:
        if job_id in _pending:
            _pending.remove(job_id)

    db.update(job_id, state=JobState.RUNNING.value, stage=Stage.LOADING.value, progress=0.02)

    def on_progress(stage: Stage, progress: float) -> None:
        db.update(job_id, stage=stage.value, progress=progress)

    try:
        result = transcribe_file(audio_path, mode=mode, force_route=force_route,
                                 on_progress=on_progress)
        midi_export.write(result, config.RESULT_DIR / f"{job_id}.mid")
        db.update(
            job_id,
            state=JobState.DONE.value,
            stage=Stage.DONE.value,
            progress=1.0,
            route=result.route.value,
            device=result.device,
            duration=result.duration,
            result_json=json.dumps(result.model_dump(mode="json")),
        )
        log.info("job %s concluído: %d notas", job_id, len(result.notes))
    except Exception as exc:  # noqa: BLE001 — a mensagem precisa chegar à UI
        log.exception("job %s falhou", job_id)
        db.update(job_id, state=JobState.ERROR.value, error=str(exc))


def _queue_position(job_id: str) -> int | None:
    with _pending_lock:
        if job_id in _pending:
            return _pending.index(job_id) + 1
    return None


def status(job_id: str) -> JobStatus | None:
    row = db.get(job_id)
    if row is None:
        return None
    return JobStatus(
        id=row["id"],
        filename=row["filename"],
        state=JobState(row["state"]),
        stage=Stage(row["stage"]),
        progress=row["progress"],
        queue_position=_queue_position(job_id),
        mode=Mode(row["mode"]),
        route=Route(row["route"]) if row["route"] else None,
        device=row["device"],
        error=row["error"],
        created_at=row["created_at"],
    )


def history(limit: int = 100) -> list[JobSummary]:
    return [
        JobSummary(
            id=row["id"],
            filename=row["filename"],
            state=JobState(row["state"]),
            mode=Mode(row["mode"]),
            route=Route(row["route"]) if row["route"] else None,
            created_at=row["created_at"],
            duration=row["duration"],
        )
        for row in db.list_recent(limit)
    ]


def remove(job_id: str) -> bool:
    row = db.get(job_id)
    if row is None:
        return False
    for path in (row["audio_path"], str(config.RESULT_DIR / f"{job_id}.mid")):
        if path:
            Path(path).unlink(missing_ok=True)
    db.delete(job_id)
    return True
