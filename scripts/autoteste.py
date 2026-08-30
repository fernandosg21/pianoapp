"""Autoteste — roda DENTRO do container, na máquina que tem a GPU.

Existe porque o ambiente onde este app foi escrito não tinha GPU, não tinha daemon
Docker e não alcançava os servidores dos modelos. As duas rotas de precisão nunca
puderam ser executadas lá. Este script é o que fecha essa lacuna: exercita os três
modelos de verdade, mede o pico de VRAM de cada estágio e diz, com números, se a
configuração padrão serve para a placa desta máquina.

Uso:  docker compose exec pianoapp python /app/scripts/autoteste.py
"""
from __future__ import annotations

import json
import os
import sys
import time
import traceback
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

# Funciona tanto dentro da imagem (/app) quanto num checkout de desenvolvimento.
_ROOT = Path(__file__).resolve().parent.parent
for _candidate in ("/app", str(_ROOT), str(_ROOT / "backend")):
    if _candidate not in sys.path and Path(_candidate).is_dir():
        sys.path.insert(0, _candidate)

# Cor só quando há terminal: capturada por um agente, ANSI vira ruído.
_TTY = sys.stdout.isatty()


def _c(codigo: str, texto: str) -> str:
    return f"\033[{codigo}m{texto}\033[0m" if _TTY else texto


OK = _c("32", "✓")
FAIL = _c("31", "✗")
SKIP = _c("33", "–")
RELATORIO_JSON = os.getenv("PIANOAPP_AUTOTESTE_JSON", "")
API = os.getenv("PIANOAPP_SELFTEST_API", "http://127.0.0.1:8080")


@dataclass
class Result:
    name: str
    passed: bool
    detail: str = ""
    seconds: float = 0.0
    vram_mb: float | None = None
    skipped: bool = False


@dataclass
class Report:
    results: list[Result] = field(default_factory=list)

    def add(self, result: Result) -> Result:
        mark = SKIP if result.skipped else (OK if result.passed else FAIL)
        vram = f"  pico {result.vram_mb:.0f} MB" if result.vram_mb is not None else ""
        print(f"  {mark} {result.name}  ({result.seconds:.1f}s){vram}")
        if result.detail:
            for line in result.detail.splitlines():
                print(f"      {line}")
        self.results.append(result)
        return result

    @property
    def failed(self) -> list[Result]:
        return [r for r in self.results if not r.passed and not r.skipped]


def section(title: str) -> None:
    print("\n" + _c("1", title))


# Falhas que este script levanta de propósito: a mensagem já diz tudo, e o traceback
# só afoga o relatório que o Fernando vai colar na conversa.
_ESPERADAS = (AssertionError, FileNotFoundError, ValueError, TimeoutError)

# Assinaturas conhecidas → o que fazer a respeito. Sem isto, um erro de rede chega
# como URLError cru, que não diz a ninguém qual é o próximo passo.
_PISTAS: list[tuple[str, str]] = [
    ("out of memory",
     "VRAM insuficiente. Baixe PIANOAPP_DEMUCS_SEGMENT no .env (tente 5.0) e suba de novo."),
    ("weights_only",
     "O patch de compatibilidade do torch.load não segurou — a lib do modelo de piano "
     "provavelmente mudou. Vale reportar."),
    ("Tunnel connection failed",
     "Sem acesso à rede a partir do container. Os pesos dos modelos deveriam ter sido "
     "embutidos no build: rode 'docker compose build --no-cache'."),
    ("Connection refused",
     "A API não respondeu. O container subiu? Veja 'docker compose logs --tail=50'."),
    ("urlopen error",
     "Falha de rede ao buscar os pesos. Confira a conexão e rode "
     "'docker compose exec pianoapp python /app/scripts/fetch_models.py'."),
    ("No such file or directory: '/app",
     "Rodando fora do container. Este script foi feito para "
     "'docker compose exec pianoapp python /app/scripts/autoteste.py'."),
]


def explicar(exc: Exception) -> str:
    """Mensagem enxuta quando a falha é prevista; traceback curto quando não é."""
    texto = f"{exc}" if isinstance(exc, _ESPERADAS) else f"{type(exc).__name__}: {exc}"
    combinado = f"{type(exc).__name__}: {exc}"
    for assinatura, pista in _PISTAS:
        if assinatura.lower() in combinado.lower():
            return f"{texto}\n→ {pista}"
    if isinstance(exc, _ESPERADAS):
        return texto
    return texto + "\n" + traceback.format_exc(limit=2)


def peak_vram_mb(device) -> float | None:
    import torch

    if device.type != "cuda":
        return None
    return torch.cuda.max_memory_allocated(device) / 1024**2


def reset_vram(device) -> None:
    import torch

    if device.type == "cuda":
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats(device)


def run(report: Report, name: str, fn, device=None) -> Result:
    """Executa uma etapa medindo tempo e pico de VRAM, sem deixar exceção escapar."""
    if device is not None:
        reset_vram(device)
    started = time.time()
    try:
        detail = fn() or ""
        return report.add(
            Result(name, True, detail, time.time() - started,
                   peak_vram_mb(device) if device is not None else None)
        )
    except Exception as exc:  # noqa: BLE001 — o relatório precisa registrar qualquer falha
        return report.add(Result(name, False, explicar(exc), time.time() - started))


def main() -> int:
    print(_c("1", "Autoteste do pianoapp"))
    print("Valida o que o ambiente de desenvolvimento não conseguia executar.\n")

    import numpy as np
    import torch

    from app import gpu
    from app.pipeline import generic_model, merge, piano_model, router, score, separate
    from app.schemas import Mode, Route
    from scripts.make_test_audio import SR, chord, melody

    report = Report()

    # ---------------------------------------------------------------- ambiente
    section("Ambiente")
    device = gpu.resolve_device()
    info = gpu.device_info()
    print(f"  torch {torch.__version__}  ·  device {device}")
    if info["gpu"]:
        print(f"  GPU: {info['gpu_name']}  ·  "
              f"{info['vram_free_mb']} de {info['vram_total_mb']} MB livres")
        capability = torch.cuda.get_device_capability(device)
        print(f"  compute capability {capability[0]}.{capability[1]}")
    else:
        print("  " + _c("33", "Sem CUDA — o autoteste roda em CPU."))
        print("  Se esta máquina tem GPU, o passthrough do Docker não está ativo:")
        print("  docker run --rm --gpus all nvidia/cuda:12.6.0-base-ubuntu22.04 nvidia-smi")

    workdir = Path("/tmp/pianoapp-autoteste")
    workdir.mkdir(parents=True, exist_ok=True)
    melody_wav = workdir / "melody.wav"
    chord_wav = workdir / "chord.wav"
    melody(str(melody_wav))
    chord(str(chord_wav))

    import librosa

    y_melody, _ = librosa.load(str(melody_wav), sr=22050, mono=True)

    # -------------------------------------------------------------- basic-pitch
    section("Modelo multi-instrumento (basic-pitch, ONNX)")

    def check_basic_pitch() -> str:
        y, sr = librosa.load(str(melody_wav), sr=None, mono=True)
        notes = generic_model.transcribe_array(y, sr)
        found = sorted({n.midi for n in notes})
        expected = [60, 64, 67, 72]
        if not set(expected).issubset(found):
            raise AssertionError(f"esperava {expected} entre as alturas, veio {found}")
        from basic_pitch import ICASSP_2022_MODEL_PATH

        backend = Path(str(ICASSP_2022_MODEL_PATH)).suffix
        if backend != ".onnx":
            return f"alturas ok, mas o backend resolveu para '{backend}' e não ONNX"
        return f"alturas {found} · backend ONNX, sem TensorFlow"

    run(report, "transcreve a melodia sintética", check_basic_pitch)

    # ------------------------------------------------------- ByteDance / piano
    section("Modelo dedicado a piano (ByteDance)")
    print("  Este é o teste do checkpoint de 2021 sob PyTorch moderno: a lib chama")
    print("  torch.load sem weights_only, cujo padrão o torch 2.6 inverteu.")

    def check_piano_checkpoint() -> str:
        path = piano_model.checkpoint_path()
        if not path.exists():
            raise FileNotFoundError(
                f"checkpoint ausente em {path} — o build deveria tê-lo embutido; "
                "rode 'python /app/scripts/fetch_models.py' dentro do container"
            )
        size = path.stat().st_size / 1e6
        if size < 160:
            raise ValueError(f"checkpoint incompleto: {size:.0f} MB (esperado ~165 MB)")
        return f"{path.name} · {size:.0f} MB"

    ckpt = run(report, "checkpoint presente e íntegro", check_piano_checkpoint)

    if ckpt.passed:
        def check_piano_transcribe() -> str:
            y, _ = librosa.load(str(chord_wav), sr=piano_model.SAMPLE_RATE, mono=True)
            notes, pedal = piano_model.transcribe(y, device)
            found = sorted({n.midi for n in notes})
            if not found:
                raise AssertionError("nenhuma nota detectada na tríade de dó maior")
            return f"{len(notes)} notas {found} · {len(pedal)} eventos de pedal"

        run(report, "carrega e transcreve (torch.load + inferência)",
            check_piano_transcribe, device)
        gpu.release()
    else:
        report.add(Result("carrega e transcreve", False, "pulado: sem checkpoint",
                          skipped=True))

    # ------------------------------------------------------------------ Demucs
    section("Separação de fontes (Demucs)")

    def check_demucs() -> str:
        sr = separate.model_sample_rate()
        y, _ = librosa.load(str(chord_wav), sr=sr, mono=True)
        stems = separate.separate(y, sr, device)
        if "drums" in stems:
            raise AssertionError("a bateria deveria ter sido descartada")
        if not stems:
            raise AssertionError("nenhum stem devolvido")
        return f"stems {sorted(stems)} · segmento {os.getenv('PIANOAPP_DEMUCS_SEGMENT', '7.0')}s"

    demucs_result = run(report, "separa em stems harmônicos", check_demucs, device)
    gpu.release()

    # ------------------------------------------------------------- fallback CPU
    section("Degradação para CPU")

    def check_cpu_fallback() -> str:
        cpu = torch.device("cpu")
        y, _ = librosa.load(str(melody_wav), sr=piano_model.SAMPLE_RATE, mono=True)
        piano_model.unload()
        notes, _ = piano_model.transcribe(y, cpu)
        piano_model.unload()
        return f"{len(notes)} notas transcritas em CPU"

    if device.type == "cuda" and ckpt.passed:
        run(report, "o mesmo estágio roda em CPU quando a VRAM falta", check_cpu_fallback)
    else:
        report.add(Result("degradação para CPU", True,
                          "já estamos em CPU — caminho exercitado acima", skipped=True))

    # --------------------------------------------------------- pipeline inteiro
    section("Pipeline completo, pela API")

    def check_http_job() -> str:
        boundary = "----pianoapp-autoteste"
        payload = melody_wav.read_bytes()
        body = b"".join([
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; '
            f'filename="melody.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode(),
            payload, b"\r\n",
            f'--{boundary}\r\nContent-Disposition: form-data; name="mode"\r\n\r\n'
            f'precise\r\n--{boundary}--\r\n'.encode(),
        ])
        request = urllib.request.Request(
            f"{API}/api/transcribe", data=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        )
        job_id = json.load(urllib.request.urlopen(request, timeout=30))["job_id"]

        stages_seen = []
        deadline = time.time() + 900
        while time.time() < deadline:
            status = json.load(urllib.request.urlopen(f"{API}/api/jobs/{job_id}", timeout=15))
            if status["stage"] not in stages_seen:
                stages_seen.append(status["stage"])
            if status["state"] == "done":
                break
            if status["state"] == "error":
                raise RuntimeError(f"job falhou: {status['error']}")
            time.sleep(1)
        else:
            raise TimeoutError("o job não terminou em 15 minutos")

        result = json.load(urllib.request.urlopen(f"{API}/api/jobs/{job_id}/result", timeout=15))
        midi = urllib.request.urlopen(f"{API}/api/jobs/{job_id}/midi", timeout=15)
        if midi.status != 200:
            raise AssertionError("o MIDI não ficou disponível")
        return (f"rota {result['route']} · {len(result['notes'])} notas · "
                f"{result['tempo']} BPM · estágios {' → '.join(stages_seen)}")

    run(report, "upload → fila → progresso → resultado → MIDI", check_http_job)

    # ----------------------------------------------------------------- resumo
    section("Resumo")
    vram_rows = [r for r in report.results if r.vram_mb is not None]
    if vram_rows:
        print("  Pico de VRAM por estágio:")
        for row in vram_rows:
            print(f"    {row.name:<48} {row.vram_mb:>7.0f} MB")
        worst = max(r.vram_mb for r in vram_rows)
        total = info.get("vram_total_mb")
        if total:
            folga = total - worst
            print(f"\n  Maior pico: {worst:.0f} MB de {total} MB ({folga:.0f} MB de folga)")
            if folga < 800:
                print("  " + _c("33", "Folga apertada. Baixe PIANOAPP_DEMUCS_SEGMENT"
                                   " no .env (tente 5.0)."))
            elif folga > 3000 and demucs_result.passed:
                print("  " + _c("32", "Sobra VRAM. Suba PIANOAPP_DEMUCS_SEGMENT para"
                                   " 12 ou 15 e ganhe velocidade."))

    if RELATORIO_JSON:
        Path(RELATORIO_JSON).write_text(json.dumps({
            "ok": not report.failed,
            "device": str(device),
            "gpu": info["gpu"],
            "gpu_nome": info.get("gpu_name"),
            "vram_total_mb": info.get("vram_total_mb"),
            "verificacoes": [
                {"nome": r.name, "passou": r.passed, "pulada": r.skipped,
                 "detalhe": r.detail, "segundos": round(r.seconds, 2),
                 "pico_vram_mb": round(r.vram_mb) if r.vram_mb is not None else None}
                for r in report.results
            ],
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  relatório em {RELATORIO_JSON}")

    falhas = report.failed
    total_ok = sum(1 for r in report.results if r.passed and not r.skipped)
    print()
    if falhas:
        print(_c("31", f"{len(falhas)} verificação(ões) falharam")
              + f", {total_ok} passaram.")
        print("\nCole o relatório acima na conversa com o Claude para diagnóstico.")
        return 1

    print(_c("32", "Tudo passou") + f" — {total_ok} verificações.")
    print("\nO app está pronto. Abra http://localhost:8080")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
