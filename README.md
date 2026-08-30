# pianoapp

Transforma uma gravação de áudio em notas de piano: piano roll sincronizado ao som,
lista de notas e partitura. Roda inteiro na sua máquina, com GPU.

![modo](https://img.shields.io/badge/GPU-CUDA%2012.6-informational) ![licença](https://img.shields.io/badge/uso-self--hosted-lightgrey)

---

## Subir

```bash
git clone https://github.com/fernandosg21/pianoapp.git
cd pianoapp
./scripts/subir.sh
```

É só isso. O script confere os pré-requisitos antes de gastar minutos em build (Docker,
espaço em disco, alcance ao Zenodo de onde vem o checkpoint, passthrough de GPU),
constrói, sobe, espera o app responder, roda o autoteste e imprime as duas URLs — a
local e a da rede, para o iPad.

O primeiro build baixa a imagem base do PyTorch e os pesos dos modelos (~5,5 GB no
total) e leva alguns minutos. Depois disso o container funciona offline: nada é baixado
em tempo de execução.

```bash
./scripts/subir.sh --sem-teste   # só sobe, sem o autoteste
./scripts/subir.sh --rebuild     # reconstrói a imagem do zero
docker compose down              # parar
```

As transcrições ficam num volume e reaparecem no próximo `up`.

No PowerShell puro (sem WSL), os mesmos passos à mão:

```powershell
docker compose up -d --build
docker compose exec pianoapp python /app/scripts/autoteste.py
```

### Autoteste

`scripts/autoteste.py` roda dentro do container e exercita os três modelos de verdade:
o basic-pitch em ONNX, o checkpoint do modelo de piano da ByteDance e a separação do
Demucs. Mede o **pico de VRAM de cada estágio** e diz se o `PIANOAPP_DEMUCS_SEGMENT`
padrão serve para a sua placa — ou se dá para subir e ganhar velocidade.

```bash
docker compose exec pianoapp python /app/scripts/autoteste.py
```

Se algo falhar, ele imprime um relatório pronto para colar numa conversa com o Claude.

## Se algo der errado

| Sintoma | O que é | O que fazer |
|---|---|---|
| Build falha baixando o modelo de piano | Zenodo fora do ar ou bloqueado | Tente de novo mais tarde, ou `docker compose build --no-cache` |
| `/api/health` diz `"gpu": false` | Passthrough de GPU inativo | Instale o NVIDIA Container Toolkit (seção acima). O app funciona em CPU enquanto isso |
| `CUDA out of memory` no log | Pico de VRAM acima dos 6 GB | Baixe `PIANOAPP_DEMUCS_SEGMENT` no `.env` para `5.0`. O job não morre: refaz o estágio em CPU |
| Transcrição muito lenta | Caiu para CPU | Confira a faixa de status no topo da interface |
| `port is already allocated` | Porta 8080 ocupada | `PIANOAPP_PORT=8090` no `.env` |
| `no space left on device` no build | Disco cheio | `docker system prune -a` |
| iPad não abre a página | Firewall do host | `sudo ufw allow 8080/tcp` |

---

## GPU

O `docker-compose.yml` já pede a GPU. Isso exige o **NVIDIA Container Toolkit** no
host. Para conferir se o passthrough funciona:

```bash
docker run --rm --gpus all nvidia/cuda:12.6.0-base-ubuntu22.04 nvidia-smi
```

Se a sua placa aparecer nessa lista, está tudo certo. **Se não aparecer, o app sobe
do mesmo jeito e roda em CPU** — mais lento, porém funcional. A faixa no topo da
interface diz sempre qual dos dois está em uso.

Instalação do toolkit (Ubuntu/Debian):
<https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html>

### Tempos esperados

Para ~3 minutos de áudio numa GTX 1660 (6 GB):

| Modo | O que faz | Tempo |
|---|---|---|
| Rápido | um passe multi-instrumento, sem separação | ~10–30 s |
| Máxima precisão, instrumento solo | modelo dedicado a piano | ~30–60 s |
| Máxima precisão, mixagem densa | separação + transcrição por instrumento | ~1–2 min |

Em CPU, multiplique por algo entre 5× e 10×.

---

## Usar pelo iPad, na mesma rede

O container já escuta em todas as interfaces, então basta acessar pelo IP da
máquina — não há nada a configurar no app.

**1. Descubra o IP do computador:**

```bash
hostname -I | awk '{print $1}'      # Linux
ipconfig getifaddr en0              # macOS
ipconfig                            # Windows (procure "Endereço IPv4")
```

**2. No iPad, abra** `http://SEU-IP:8080` — por exemplo `http://192.168.0.42:8080`.

Se o computador tiver Avahi ou Bonjour, `http://nome-do-pc.local:8080` também
funciona e não muda quando o roteador troca o IP.

**3. Se não abrir**, quase sempre é o firewall do host:

```bash
sudo ufw allow 8080/tcp             # Ubuntu/Debian
sudo firewall-cmd --add-port=8080/tcp --permanent && sudo firewall-cmd --reload
```

### Deixe como um app

No Safari do iPad: **Compartilhar › Adicionar à Tela de Início**. Ele abre em tela
cheia, sem a moldura do navegador, com ícone próprio — e é assim que vale a pena
usar na estante da partitura.

### Durante o estudo

- **Laço A-B.** Toque em `A` no início do trecho e `B` no fim: ele passa a repetir
  sozinho. O trecho aparece marcado na linha do tempo e dentro do próprio rolo.
  `↻` liga e desliga sem perder as marcas, `✕` limpa.
- **Andamento.** 0,5× a 1×. A altura das notas não muda, só a velocidade.
- **Tema.** O ☾/☀ no topo troca entre a sala escura e o papel claro. Escuro não
  ofusca à noite; claro se enxerga sob a luz da janela.
- **Teclado ajustado.** Por padrão o app mostra só as oitavas que a música usa, para
  as teclas ficarem largas o bastante numa tela de tablet. "Ver as 88 teclas" mostra
  o piano inteiro.

### Dois detalhes do iOS que valem saber

**A tela apaga sozinha.** O navegador só permite segurar a tela acesa em HTTPS, e o
acesso pela rede local é HTTP — então a API padrão não fica disponível. O app avisa
quando isso acontece. A saída confiável é desativar o bloqueio automático enquanto
estuda: **Ajustes › Tela e Brilho › Bloqueio Automático › Nunca**.

**O interruptor lateral corta o som.** Se o iPad estiver no silencioso, o áudio de
página web não toca — é comportamento do iOS, não do app.

---

## Como funciona

Nenhum modelo de transcrição é o melhor para todo tipo de áudio, então o pipeline
escolhe o caminho conforme a gravação:

1. **Triagem** — mede quanto da energia do áudio é percussiva (separação
   harmônico/percussivo). Bateria e transientes densos empurram para "mixagem densa";
   piano e vozes sustentadas, para "instrumento solo".

2. **Instrumento solo** → *High-resolution Piano Transcription* (ByteDance), treinado
   especificamente em piano. É a melhor qualidade do projeto e a única rota que
   extrai **pedal de sustain** e dinâmica.

3. **Mixagem densa** → **Demucs** separa a faixa em bateria, baixo, vocais e demais
   instrumentos; a bateria é descartada e cada stem harmônico é transcrito
   separadamente com o **basic-pitch** (multi-instrumento). Transcrever a mixagem
   inteira de uma vez é o que faz qualquer modelo produzir lixo.

4. **Redução pianística** — funde as notas repetidas, descarta as curtas demais,
   limita a polifonia simultânea e separa as mãos, para o resultado ser tocável em
   duas mãos e não uma nuvem de notas.

A triagem é uma heurística e **vai errar em casos de borda**. A interface mostra qual
rota foi usada e oferece "reprocessar como solo/mixagem densa" com um clique, sem
precisar reenviar o arquivo.

### O que esperar da qualidade

- **Piano solo limpo:** excelente.
- **Faixa de banda completa:** utilizável, não fiel. Reduzir uma música pop a piano é
  aproximação por natureza, mesmo com separação de fontes.
- **Partitura:** é a saída mais frágil das três, porque encaixa uma grade rítmica
  estimada em cima de um resultado que já é aproximado. Serve para leitura, não como
  edição final — a interface avisa isso.

---

## Uso

1. Escolha o modo (**rápido** ou **máxima precisão**) e arraste um áudio.
2. Acompanhe o progresso por estágio.
3. No resultado, três visualizações compartilham o mesmo relógio do áudio:
   - **Piano roll** — blocos caindo sobre um teclado de 88 teclas, mãos em cores
     distintas.
   - **Lista de notas** — tabela com tempo, duração e mão; clique numa linha para
     saltar até ela; botão para copiar tudo.
   - **Partitura** — pauta dupla.
4. **MIDI** exporta o resultado para abrir em qualquer DAW ou editor.

O alternador **C D E / Dó Ré Mi** troca a notação em toda a interface. O laço A-B e o
andamento reduzido são o que torna o app útil para estudar de fato — veja a seção do
iPad acima.

Formatos aceitos: MP3, WAV, FLAC, OGG, M4A, AAC, AIFF, Opus.

---

## Ajustes

Copie `.env.example` para `.env`. Os que mais importam:

| Variável | Default | Para quê |
|---|---|---|
| `PIANOAPP_DEMUCS_SEGMENT` | `7.0` | Segundos por vez no Demucs — **é o que controla o pico de VRAM**. Reduza se vir `CUDA out of memory`; aumente para 15 se tiver 12 GB ou mais. |
| `PIANOAPP_DEVICE` | `auto` | `cpu` força CPU mesmo com GPU presente. |
| `PIANOAPP_MAX_WORKERS` | `1` | Jobs simultâneos. Mantenha 1 com GPU. |
| `PIANOAPP_MAX_POLYPHONY` | `8` | Notas simultâneas na redução. Menor = mais tocável, maior = mais fiel. |
| `PIANOAPP_PERCUSSIVE_THRESHOLD` | `0.42` | Limiar da triagem. |

Um `CUDA out of memory` não derruba o job: o estágio é refeito automaticamente em
CPU, mais devagar. Se isso estiver acontecendo sempre, baixe o `DEMUCS_SEGMENT`.

---

## Desenvolvimento

```bash
# backend
python -m venv .venv && source .venv/bin/activate
pip install -e "backend[dev]"
PIANOAPP_STATIC_DIR=frontend/dist uvicorn app.main:app --reload --port 8080 --app-dir backend

# frontend (proxy para :8080 já configurado)
cd frontend && npm install && npm run dev
```

Testes:

```bash
cd backend && python -m pytest          # tudo
python -m pytest -m "not slow"          # só as unidades rápidas
cd frontend && npm run typecheck
```

Os testes usam áudio sintético de alturas conhecidas (`scripts/make_test_audio.py`),
então rodam sem GPU e sem baixar modelo nenhum.

Para baixar os pesos fora do Docker: `python scripts/fetch_models.py`.

---

## API

| Rota | O que faz |
|---|---|
| `POST /api/transcribe` | upload (`file`, `mode`, `force_route`) → `{job_id}` |
| `GET /api/jobs` | histórico |
| `GET /api/jobs/{id}` | estado, estágio, progresso, posição na fila |
| `GET /api/jobs/{id}/result` | a transcrição |
| `GET /api/jobs/{id}/audio` | o áudio original |
| `GET /api/jobs/{id}/midi` | download `.mid` |
| `POST /api/jobs/{id}/reprocess` | refaz com outra rota, sem reenviar o arquivo |
| `DELETE /api/jobs/{id}` | remove job e arquivos |
| `GET /api/health` | device, GPU, VRAM, modelos carregados |

Documentação interativa em `/docs`.

---

## Créditos

- [Demucs](https://github.com/adefossez/demucs) — separação de fontes (Meta).
- [High-resolution Piano Transcription](https://github.com/bytedance/piano_transcription) — ByteDance.
- [basic-pitch](https://github.com/spotify/basic-pitch) — Spotify.
- [VexFlow](https://www.vexflow.com/) — renderização da partitura.
