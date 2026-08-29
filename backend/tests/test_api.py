"""Rotas HTTP: validação de upload, ciclo de vida do job e biblioteca."""
import time

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _wait(client, job_id, timeout=180):
    deadline = time.time() + timeout
    while time.time() < deadline:
        status = client.get(f"/api/jobs/{job_id}").json()
        if status["state"] in ("done", "error"):
            return status
        time.sleep(0.5)
    raise AssertionError("job não terminou dentro do tempo limite")


def test_health_reports_a_device(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["device"] in ("cpu",) or body["device"].startswith("cuda")
    assert "basic-pitch" in body["models_loaded"]


def test_rejects_unsupported_format(client):
    r = client.post("/api/transcribe", files={"file": ("notas.txt", b"nao sou audio", "text/plain")})
    assert r.status_code == 415
    assert "Formato não suportado" in r.json()["detail"]


def test_rejects_oversized_upload(client, monkeypatch):
    from app import config

    monkeypatch.setattr(config, "MAX_UPLOAD_MB", 0.001)
    payload = b"\x00" * 200_000
    r = client.post("/api/transcribe", files={"file": ("grande.wav", payload, "audio/wav")})
    assert r.status_code == 413


def test_unknown_job_is_404(client):
    assert client.get("/api/jobs/naoexiste").status_code == 404


@pytest.mark.slow
def test_full_job_lifecycle(client, melody_wav):
    with melody_wav.open("rb") as f:
        r = client.post(
            "/api/transcribe",
            files={"file": ("melody.wav", f, "audio/wav")},
            data={"mode": "fast"},
        )
    assert r.status_code == 200
    job_id = r.json()["job_id"]

    status = _wait(client, job_id)
    assert status["state"] == "done", status.get("error")
    assert status["progress"] == 1.0

    result = client.get(f"/api/jobs/{job_id}/result").json()
    assert sorted({n["midi"] for n in result["notes"]}) == [60, 64, 67, 72]
    assert result["mode"] == "fast"

    assert client.get(f"/api/jobs/{job_id}/midi").status_code == 200
    assert client.get(f"/api/jobs/{job_id}/audio").status_code == 200
    assert any(j["id"] == job_id for j in client.get("/api/jobs").json())

    assert client.delete(f"/api/jobs/{job_id}").status_code == 200
    assert client.get(f"/api/jobs/{job_id}").status_code == 404


@pytest.mark.slow
def test_result_before_completion_is_409(client, melody_wav):
    with melody_wav.open("rb") as f:
        job_id = client.post(
            "/api/transcribe",
            files={"file": ("melody.wav", f, "audio/wav")},
            data={"mode": "fast"},
        ).json()["job_id"]
    r = client.get(f"/api/jobs/{job_id}/result")
    if r.status_code != 200:  # corrida benigna: pode já ter terminado em máquina rápida
        assert r.status_code == 409
    _wait(client, job_id)
