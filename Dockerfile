# ---------------------------------------------------------------------------
# Estágio 1: compila o frontend.
# ---------------------------------------------------------------------------
FROM node:22-slim AS frontend

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install

COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Estágio 2: runtime.
#
# A base já traz PyTorch compilado com CUDA — é a parte mais chata do Dockerfile
# resolvida de graça. CUDA 12.6 e não 13.x porque 12.x é o terreno mais batido
# para Turing (a GTX 1660 é sm_75).
# ---------------------------------------------------------------------------
FROM pytorch/pytorch:2.9.1-cuda12.6-cudnn9-runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIANOAPP_DATA_DIR=/data \
    PIANOAPP_STATIC_DIR=/app/static

# ffmpeg cobre m4a/ogg/mp3 que o libsndfile sozinho não decodifica.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/pyproject.toml ./
# O basic-pitch entra sem dependências de propósito: em Linux + Python >=3.11 o
# marker dele arrasta TensorFlow (~600 MB), que não tem serventia alguma aqui —
# usamos o modelo ONNX que já vem dentro do wheel, e o PyTorch vem da imagem base.
RUN pip install --no-cache-dir \
        "fastapi>=0.115" "uvicorn[standard]>=0.30" "python-multipart>=0.0.9" \
        "pydantic>=2.7" "librosa>=0.10.2" "soundfile>=0.12" "pretty_midi>=0.2.10" \
        "demucs>=4.1.0" "piano_transcription_inference>=0.0.6" \
        "onnxruntime>=1.17" "scipy>=1.11" "scikit-learn>=1.4" \
        "resampy>=0.4.2" "mir_eval>=0.7" \
    && pip install --no-cache-dir --no-deps "basic-pitch==0.4.0"

# Modelos embutidos na imagem: o container funciona offline e a primeira
# transcrição não trava baixando 165 MB do Zenodo.
COPY scripts/ /app/scripts/
RUN python /app/scripts/fetch_models.py

COPY backend/app/ /app/app/
COPY --from=frontend /build/dist/ /app/static/

VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
