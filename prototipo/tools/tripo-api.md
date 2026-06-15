# Tripo 3D - como chamar a API (gerar assets por IA)

Referência de uso da API da Tripo 3D para gerar modelos 3D (personagem, props, cenário)
por texto/imagem, baixar o `.glb` e integrar no jogo. O token fica em
`tools/.tripo-token` (gitignored, NÃO versionar).

- Base URL: `https://api.tripo3d.ai/v2/openapi`
- Auth: header `Authorization: Bearer <TOKEN>` (token em `tools/.tripo-token`)
- Resposta: JSON com `code` (0 = sucesso) e `data`.
- Docs oficiais: https://docs.tripo3d.ai/ e https://platform.tripo3d.ai/docs/schema

## Saldo (verificado, não gasta crédito)
```bash
TOK=$(cat tools/.tripo-token)
curl -s https://api.tripo3d.ai/v2/openapi/user/balance -H "Authorization: Bearer $TOK"
# -> {"code":0,"data":{"balance":<creditos>,"frozen":<reservado>}}
```
IMPORTANTE: gerar modelo CONSOME crédito. Se `balance` for 0, as tarefas falham por saldo
insuficiente - ativar o plano grátis (300 créditos/mês) ou adicionar crédito no painel.

## 1) Texto -> 3D (text_to_model)
```bash
TOK=$(cat tools/.tripo-token)
curl -s -X POST https://api.tripo3d.ai/v2/openapi/task \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOK" \
  -d '{"type":"text_to_model","prompt":"ancient Israelite commander, ocre tunic, red cloak, bronze, bearded","model_version":"v2.5-20250123","texture":true,"pbr":true}'
# -> {"code":0,"data":{"task_id":"..."}}
```
Parâmetros úteis: `prompt`, `negative_prompt`, `model_version`, `texture` (bool),
`pbr` (bool), `face_limit` (int, limita polígonos p/ web), `quad` (bool, topologia quad).

## 2) Imagem -> 3D (image_to_model)
Fluxo em 2 passos: subir a imagem e depois criar a tarefa com o token da imagem.
```bash
# (a) upload da imagem
curl -s -X POST https://api.tripo3d.ai/v2/openapi/upload \
  -H "Authorization: Bearer $TOK" -F "file=@concept.png"
# -> {"code":0,"data":{"image_token":"..."}}
# (b) cria a tarefa
curl -s -X POST https://api.tripo3d.ai/v2/openapi/task \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOK" \
  -d '{"type":"image_to_model","file":{"type":"png","file_token":"<image_token>"},"texture":true,"pbr":true}'
```

## 3) Polling do status
```bash
curl -s https://api.tripo3d.ai/v2/openapi/task/<task_id> -H "Authorization: Bearer $TOK"
# data.status: queued/running/success/failed (e data.progress 0-100)
# em sucesso: data.output.model (URL do .glb) e data.output.pbr_model
```

## 4) Download do modelo
A URL em `data.output.model` (ou `pbr_model`) é um `.glb` temporário; baixar com curl:
```bash
curl -s -L -o public/models/asset.glb "<URL_do_output.model>"
```

## 5) Rig + animação (para personagem)
A Tripo também rigga e anima por tarefas encadeadas (usam o `task_id` do modelo base):
- `animate_rig` (gera esqueleto) e `animate_retarget` (aplica animações).
- Parâmetros exatos: ver https://docs.tripo3d.ai/ (seção Animation). Alternativa: gerar o
  modelo aqui e riggar/animar no Mixamo, depois eu integro o glb.

## Helper pronto
`tools/tripo_gen.py` faz tudo (cria tarefa text_to_model, faz polling e baixa o glb):
```bash
python3 tools/tripo_gen.py --balance
python3 tools/tripo_gen.py "ancient mud-brick house, flat roof, desert" -o public/models/casa.glb
```
