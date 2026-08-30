#!/usr/bin/env bash
#
# Sobe o pianoapp nesta máquina, do zero, e verifica que funcionou.
#
# Faz as checagens caras antes do build: descobrir em dois segundos que falta espaço
# em disco é melhor que descobrir em oito minutos, no meio de um docker build.
#
#   ./scripts/subir.sh              sobe e roda o autoteste
#   ./scripts/subir.sh --sem-teste  só sobe
#   ./scripts/subir.sh --rebuild    força reconstrução da imagem
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

VERDE=$'\033[32m'; AMARELO=$'\033[33m'; VERMELHO=$'\033[31m'
NEGRITO=$'\033[1m'; FIM=$'\033[0m'

ok()     { printf '  %s✓%s %s\n' "$VERDE" "$FIM" "$1"; }
aviso()  { printf '  %s!%s %s\n' "$AMARELO" "$FIM" "$1"; }
erro()   { printf '  %s✗%s %s\n' "$VERMELHO" "$FIM" "$1"; }
titulo() { printf '\n%s%s%s\n' "$NEGRITO" "$1" "$FIM"; }
morrer() { erro "$1"; [ $# -gt 1 ] && printf '\n    %s\n' "$2"; exit 1; }

RODAR_TESTE=1
REBUILD=""
for arg in "$@"; do
  case "$arg" in
    --sem-teste) RODAR_TESTE=0 ;;
    --rebuild)   REBUILD="--no-cache" ;;
    -h|--help)   sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)           morrer "opção desconhecida: $arg" ;;
  esac
done

DISCO_MINIMO_GB=15
PORTA="${PIANOAPP_PORT:-8080}"
if [ -f .env ]; then
  PORTA_ENV=$(grep -E '^PIANOAPP_PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"' ' || true)
  [ -n "${PORTA_ENV:-}" ] && PORTA="$PORTA_ENV"
fi

# ---------------------------------------------------------------- pré-checagens
titulo "Verificando a máquina"

command -v docker >/dev/null 2>&1 || morrer \
  "docker não encontrado" "Instale em https://docs.docker.com/engine/install/"

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  morrer "docker compose não encontrado" "Instale o plugin Compose v2."
fi

docker info >/dev/null 2>&1 || morrer \
  "o daemon do Docker não está rodando" "Inicie o Docker Desktop, ou: sudo systemctl start docker"
ok "docker e $COMPOSE prontos"

DISCO_GB=$(df -Pk . 2>/dev/null | awk 'NR==2 {print int($4/1048576)}' || echo 0)
if [ "${DISCO_GB:-0}" -lt "$DISCO_MINIMO_GB" ]; then
  morrer "só ${DISCO_GB} GB livres; a imagem passa de 5 GB e o build precisa de ~${DISCO_MINIMO_GB} GB" \
         "Libere espaço, ou rode: docker system prune -a"
fi
ok "${DISCO_GB} GB livres em disco"

# O checkpoint do modelo de piano vem do Zenodo durante o build. É o passo com maior
# chance de falhar, e falha depois de vários minutos de build — vale checar antes.
if curl -sI --max-time 12 https://zenodo.org/ >/dev/null 2>&1; then
  ok "zenodo.org alcançável (o checkpoint de 165 MB vem de lá)"
else
  aviso "zenodo.org não respondeu — se o build falhar ao baixar o modelo de piano, é isso"
fi

# Passthrough de GPU. Falhar aqui NÃO aborta: o app roda em CPU de propósito.
GPU_INFO=$(docker run --rm --gpus all nvidia/cuda:12.6.0-base-ubuntu22.04 \
  nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null | head -1 || true)
if [ -n "${GPU_INFO:-}" ]; then
  ok "GPU visível ao Docker: ${GPU_INFO}"
else
  aviso "o Docker não enxerga GPU — o app vai subir e rodar em CPU, bem mais devagar"
  printf '    Para habilitar, instale o NVIDIA Container Toolkit:\n'
  printf '    https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html\n'
fi

# ------------------------------------------------------------------ build e up
titulo "Construindo e subindo"
printf '  A primeira vez baixa a imagem base do PyTorch e os pesos dos modelos.\n'
printf '  São alguns minutos e cerca de 5,5 GB. Depois disso, sobe em segundos.\n\n'

if [ -n "$REBUILD" ]; then
  $COMPOSE build $REBUILD
fi
$COMPOSE up -d --build

# ---------------------------------------------------------------- ficar saudável
titulo "Esperando o app responder"
LIMITE=300
INICIO=$(date +%s)
while :; do
  ESTADO=$($COMPOSE ps --format json 2>/dev/null \
            | grep -o '"Health":"[a-z]*"' | head -1 | cut -d'"' -f4 || true)
  if curl -sf --max-time 5 "http://127.0.0.1:${PORTA}/api/health" >/dev/null 2>&1; then
    ok "respondeu em $(( $(date +%s) - INICIO ))s"
    break
  fi
  if [ "$ESTADO" = "unhealthy" ] || [ $(( $(date +%s) - INICIO )) -gt $LIMITE ]; then
    erro "o app não respondeu em ${LIMITE}s"
    printf '\n%sÚltimas linhas do log:%s\n' "$NEGRITO" "$FIM"
    $COMPOSE logs --tail=80
    exit 1
  fi
  sleep 3
done

SAUDE=$(curl -s "http://127.0.0.1:${PORTA}/api/health")
if printf '%s' "$SAUDE" | grep -q '"gpu":true'; then
  NOME=$(printf '%s' "$SAUDE" | sed -n 's/.*"gpu_name":"\([^"]*\)".*/\1/p')
  LIVRE=$(printf '%s' "$SAUDE" | sed -n 's/.*"vram_free_mb":\([0-9]*\).*/\1/p')
  ok "rodando na GPU: ${NOME} (${LIVRE} MB de VRAM livres)"
else
  aviso "rodando em CPU — funciona, mas de 5 a 10 vezes mais devagar"
fi

# -------------------------------------------------------------------- autoteste
if [ "$RODAR_TESTE" -eq 1 ]; then
  titulo "Autoteste"
  printf '  Exercita os três modelos e mede o pico de VRAM de cada estágio.\n\n'
  if ! $COMPOSE exec -T pianoapp python /app/scripts/autoteste.py; then
    printf '\n%sO app está de pé, mas o autoteste encontrou problemas.%s\n' "$AMARELO" "$FIM"
    printf 'Cole o relatório acima na conversa com o Claude.\n'
    exit 1
  fi
fi

# ------------------------------------------------------------------------ URLs
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "${IP:-}" ] && IP=$(ipconfig getifaddr en0 2>/dev/null || true)

titulo "Pronto"
printf '  Neste computador:  %shttp://localhost:%s%s\n' "$NEGRITO" "$PORTA" "$FIM"
if [ -n "${IP:-}" ]; then
  printf '  No iPad, mesma rede: %shttp://%s:%s%s\n' "$NEGRITO" "$IP" "$PORTA" "$FIM"
  printf '\n  No Safari: Compartilhar › Adicionar à Tela de Início, para abrir em tela cheia.\n'
  printf '  Se o iPad não abrir, é o firewall do host: sudo ufw allow %s/tcp\n' "$PORTA"
fi
printf '\n  Parar:  %s down\n' "$COMPOSE"
printf '  Logs:   %s logs -f\n\n' "$COMPOSE"
