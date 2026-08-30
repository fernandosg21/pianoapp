---
name: deploy
description: Sobe o pianoapp nesta máquina com Docker e verifica que funcionou de ponta a ponta, incluindo GPU e os três modelos de transcrição. Use quando pedirem para instalar, subir, fazer deploy, rodar localmente ou colocar o pianoapp no ar. Também cobre diagnosticar um deploy que falhou e ajustar o uso de VRAM.
---

# Deploy do pianoapp

Você está numa máquina que tem Docker e provavelmente uma GPU NVIDIA. Sua tarefa é
deixar o app rodando e **confirmado funcionando** — não apenas iniciado.

O app foi desenvolvido num ambiente sem GPU, sem Docker e sem acesso aos servidores dos
modelos. Duas das três rotas de transcrição nunca puderam ser executadas lá. É por isso
que existe um autoteste: **você é quem vai executá-las pela primeira vez.** Trate o
resultado dele como a entrega, não como formalidade.

## Sequência

```bash
./scripts/subir.sh --json
```

Um comando faz tudo: pré-checagens, build, subida, espera, autoteste e as URLs. Ele
grava `relatorio-deploy.json` na raiz. O autoteste pode gravar o dele:

```bash
PIANOAPP_AUTOTESTE_JSON=relatorio-autoteste.json \
  docker compose exec -T pianoapp python /app/scripts/autoteste.py
```

Leia os dois JSON em vez de interpretar o texto colorido. O primeiro build baixa ~5,5 GB
e leva alguns minutos — não interrompa achando que travou.

## Quando algo falha

Diagnostique pelo campo `erro` do JSON e siga a tabela. **Só faça o que a coluna de ação
diz**, e pergunte antes de qualquer coisa destrutiva.

| Sintoma | Ação |
|---|---|
| `o daemon do Docker não está rodando` | Peça para a pessoa abrir o Docker Desktop. Não tente `sudo systemctl` sem permissão. |
| Menos de 15 GB livres | **Pergunte antes**: `docker system prune -a` apaga imagens não usadas. Só rode com autorização explícita. |
| `zenodo.org` não respondeu | É de lá que vem o checkpoint de 165 MB do modelo de piano. Tente de novo; se persistir, avise que o build vai falhar nesse passo. |
| Docker não enxerga GPU | Não é bloqueio: o app roda em CPU, 5 a 10× mais lento. Termine o deploy e informe. Para habilitar depois, é o NVIDIA Container Toolkit. |
| App não respondeu em 300 s | `docker compose logs --tail=80`. Leia o traceback antes de qualquer palpite. |
| `port is already allocated` | Escreva `PIANOAPP_PORT=8090` no `.env` e suba de novo. |
| Autoteste: checkpoint ausente | `docker compose exec pianoapp python /app/scripts/fetch_models.py`, depois repita o autoteste. |
| Autoteste: `CUDA out of memory` | Baixe `PIANOAPP_DEMUCS_SEGMENT` para `5.0` no `.env`, `docker compose up -d`, repita. O job não morre por isso — refaz o estágio em CPU —, mas o pico precisa caber. |
| Autoteste: `weights_only` | O patch de compatibilidade do `torch.load` não segurou; a lib do modelo de piano mudou. **Não contorne** — relate, é achado real. |

## Ajuste de VRAM

O autoteste imprime o pico por estágio e compara com a VRAM total. Aja sobre o número:

- **Folga menor que 800 MB** → baixe `PIANOAPP_DEMUCS_SEGMENT` para `5.0`.
- **Folga maior que 3 GB** → suba para `12` ou `15`. Ganha velocidade real na separação.
- Depois de mexer: `docker compose up -d` e rode o autoteste de novo para confirmar.

O default é `7.0`, escolhido às cegas para uma placa de 6 GB. Se a máquina tiver outra,
esse número está errado e você tem os dados para corrigi-lo.

## Antes de dizer que terminou

1. `curl -s localhost:8080/api/health` responde e mostra o device correto.
2. O autoteste passou em todas as verificações, ou você explicou cada falha restante.
3. A página abre no navegador.

Se tiver navegador disponível, suba um áudio curto pela interface e confirme que o piano
roll aparece e acompanha o som. É o teste que nenhuma checagem de API substitui.

## O que relatar

- A URL local e a da rede (para o iPad).
- GPU em uso ou CPU, e por quê.
- A tabela de pico de VRAM e se ajustou o `DEMUCS_SEGMENT`.
- Quanto levou uma transcrição real, se fez uma.
- Qualquer verificação que ficou falhando, com a mensagem — sem maquiar.

## Nunca

- Desabilitar ou pular verificação do autoteste para "passar".
- Mexer em `PIANOAPP_MAX_POLYPHONY`, limiares de triagem ou parâmetros dos modelos: são
  decisões de qualidade musical, não de deploy.
- Commitar `.env`, `relatorio-*.json` ou o volume de dados.
- Afirmar que as rotas de precisão funcionam sem o autoteste ter passado nelas.
