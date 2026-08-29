"""API do pianoapp e serviço do frontend compilado.

Um container só: o Vite compila para estático e o FastAPI serve — sem segundo
serviço, sem CORS, sem proxy.
"""
from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config, db, gpu, jobs
from .schemas import HealthResponse, JobStatus, JobSummary, Mode, Route, Transcription

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("pianoapp")

ALLOWED_SUFFIXES = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".aiff", ".aif", ".opus"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    config.ensure_dirs()
    db.connect()
    jobs.start()
    log.info("pianoapp pronto — device: %s", gpu.device_info())
    yield
    jobs.shutdown()


app = FastAPI(title="pianoapp", version="1.0.0", lifespan=lifespan)


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    from .pipeline import generic_model, piano_model, separate

    loaded = []
    if piano_model._model is not None:
        loaded.append("piano-transcription")
    if separate._model is not None:
        loaded.append("demucs")
    loaded.append("basic-pitch")  # ONNX, carregado sob demanda e barato

    return HealthResponse(models_loaded=loaded, **gpu.device_info())


@app.post("/api/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    mode: Mode = Form(Mode.PRECISE),
    force_route: Route | None = Form(None),
) -> dict:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(
            415,
            f"Formato não suportado: '{suffix or 'sem extensão'}'. "
            f"Aceitos: {', '.join(sorted(ALLOWED_SUFFIXES))}.",
        )

    config.ensure_dirs()
    dest = config.UPLOAD_DIR / f"{uuid.uuid4().hex[:12]}{suffix}"
    size = 0
    limit = config.MAX_UPLOAD_MB * 1024 * 1024
    with dest.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > limit:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(413, f"Arquivo maior que o limite de {config.MAX_UPLOAD_MB} MB.")
            out.write(chunk)

    try:
        info = sf.info(str(dest))
        duration = info.frames / info.samplerate
    except Exception:
        # Formatos que o libsndfile não abre (mp3 exótico, m4a) só serão decodificados
        # pelo librosa/ffmpeg adiante; a checagem de duração fica para lá.
        duration = None

    if duration is not None and duration > config.MAX_DURATION_S:
        dest.unlink(missing_ok=True)
        raise HTTPException(
            413,
            f"Áudio de {duration / 60:.1f} min excede o limite de "
            f"{config.MAX_DURATION_S / 60:.0f} min.",
        )

    job_id = jobs.submit(dest, file.filename or dest.name, mode, force_route)
    return {"job_id": job_id}


@app.get("/api/jobs", response_model=list[JobSummary])
def list_jobs(limit: int = 100) -> list[JobSummary]:
    return jobs.history(limit)


@app.get("/api/jobs/{job_id}", response_model=JobStatus)
def job_status(job_id: str) -> JobStatus:
    status = jobs.status(job_id)
    if status is None:
        raise HTTPException(404, "Job não encontrado.")
    return status


@app.get("/api/jobs/{job_id}/result", response_model=Transcription)
def job_result(job_id: str) -> Transcription:
    payload = db.result_of(job_id)
    if payload is None:
        status = jobs.status(job_id)
        if status is None:
            raise HTTPException(404, "Job não encontrado.")
        raise HTTPException(409, f"Transcrição ainda não concluída (estado: {status.state.value}).")
    return Transcription.model_validate(payload)


@app.get("/api/jobs/{job_id}/audio")
def job_audio(job_id: str) -> FileResponse:
    row = db.get(job_id)
    if row is None or not row["audio_path"]:
        raise HTTPException(404, "Job não encontrado.")
    path = Path(row["audio_path"])
    if not path.exists():
        raise HTTPException(410, "O áudio original não está mais disponível.")
    return FileResponse(path, filename=row["filename"])


@app.get("/api/jobs/{job_id}/midi")
def job_midi(job_id: str) -> FileResponse:
    path = config.RESULT_DIR / f"{job_id}.mid"
    if not path.exists():
        raise HTTPException(404, "MIDI indisponível para este job.")
    stem = Path(db.get(job_id)["filename"]).stem if db.get(job_id) else job_id
    return FileResponse(path, media_type="audio/midi", filename=f"{stem}.mid")


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: str) -> dict:
    if not jobs.remove(job_id):
        raise HTTPException(404, "Job não encontrado.")
    return {"deleted": job_id}


class SpaStaticFiles(StaticFiles):
    """Devolve index.html para rotas do cliente, mantendo 404 real sob /api."""

    async def get_response(self, path: str, scope):  # type: ignore[override]
        response = await super().get_response(path, scope)
        if response.status_code == 404 and not path.startswith("api"):
            return await super().get_response("index.html", scope)
        return response


static_dir = Path(config.STATIC_DIR)
if static_dir.is_dir():
    app.mount("/", SpaStaticFiles(directory=static_dir, html=True), name="static")
else:
    @app.get("/")
    def dev_root() -> JSONResponse:
        return JSONResponse({
            "message": "Backend no ar. O frontend compilado não está montado.",
            "static_dir": str(static_dir),
        })
