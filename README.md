# Brasa

> Dungeon crawler de fantasia low-poly que roda no navegador. Desca o poço-cripta,
> reacenda os braseiros e reavive a Brasa antes que a superficie congele.

Brasa e um RPG de acao em 3a pessoa, sala a sala, construido para **rodar leve no
navegador** (WebGPU com fallback automatico para WebGL2). Arte low-poly montada sobre
o ecossistema CC0 do KayKit. Prototipo em desenvolvimento.

<!-- TODO: trocar pelo GIF de gameplay quando houver um capturado -->
<!-- ![Brasa - gameplay](docs/midia/gameplay.gif) -->

## A premissa

Um reino sobrevive ao frio eterno gracas a **Brasa**: uma chama ancestral que arde no
fundo de um poco-cripta de pedra. Enquanto a Brasa arde, a superficie tem calor e vida.
A Brasa esta morrendo, e conforme a luz recua poco abaixo, os mortos selados naquelas
camaras ao longo de geracoes despertam no escuro.

Voce e a ultima **Acendedora**: a guardia que ainda carrega uma fagulha do fogo. Sua
missao e descer, camara por camara, reacender os braseiros antigos de cada andar e
chegar ao fundo do poco para reavivar a Brasa.

A luz e a personagem silenciosa: cada sala comeca quase no escuro e a Acendedora a
devolve a vida ao acender o braseiro. O contraste frio-azul (morte/escuro) contra
laranja-quente (Brasa/vida) e a assinatura visual.

## O laco de jogo

1. A Acendedora entra por uma porta de pedra, que se sela atras dela. A sala esta em
   penumbra fria.
2. Os mortos da camara despertam.
3. Voce limpa a sala com o combate melee (golpes leves em combo, pesado, esquiva,
   bloqueio, e o golpe de fogo da Fagulha).
4. Com a sala limpa, o **braseiro** central pode ser aceso: acende a luz quente,
   concede uma dadiva (dano, alcance, vida, raio de luz) e destrava a porta de saida.
5. A sala anterior e descarregada, a proxima e carregada. A descida termina no andar
   do chefe: o Guardiao da Brasa apagada.

Cada andar e uma camara selada, e a luz so alcanca uma sala por vez: o jogo so mantem
**uma sala carregada de cada vez**. A limitacao tecnica (nao renderizar o mundo inteiro)
virou premissa narrativa.

## Como rodar

Pre-requisitos: Node.js 20+ e npm.

```bash
cd prototipo
npm install
npm run dev      # abre em http://localhost:5173
```

Build de producao (gera `dist/` estatico):

```bash
npm run build
npm run preview  # serve o dist/ localmente
```

## Stack

| Camada | Tecnologia |
|---|---|
| Engine 3D | Babylon.js 9 (WebGPU com fallback WebGL2) |
| Fisica | Havok (WASM) |
| Linguagem | TypeScript |
| Build | Vite 6 |
| Save | Dexie (IndexedDB) |
| Narrativa | Ink (via inkjs) |
| Tipografia | Cinzel + EB Garamond |

A arquitetura separa **engine** (reutilizavel, agnostico de jogo), **game** (Brasa) e
**platform** (save, contas, apresentacao). Ver
[`docs/tecnica-arquitetura.md`](docs/tecnica-arquitetura.md).

## Estrutura do repositorio

```
.
├── docs/            Documentacao de design (a "biblia" do projeto)
│   ├── projeto-brasa.md   Documento mestre
│   ├── brasa/             Specs e biblias do Brasa (combate, niveis, arte, audio...)
│   └── tecnica-*.md       Estudos tecnicos (engine, build, performance, assets...)
└── prototipo/       O jogo (Vite + Babylon + TypeScript)
    ├── src/engine/        Motor reutilizavel (render, fisica, combate, IA, camera)
    ├── src/game/          Conteudo do Brasa (cripta, atores, HUD, codex)
    ├── src/platform/      Save e plataforma
    ├── src/app/           Entrypoint e composicao
    └── public/            Assets CC0 (modelos, kits, animacoes)
```

## Licenca

- **Codigo-fonte**: MIT (ver [`LICENSE`](LICENSE)).
- **Assets** (modelos, kits, animacoes): todos CC0 1.0. Creditos e fontes em
  [`ASSETS-LICENSE.md`](ASSETS-LICENSE.md) e
  [`prototipo/public/models/CREDITS.txt`](prototipo/public/models/CREDITS.txt).

## Status

Prototipo: vertical slice da cripta (uma descida curta com combate, acender braseiro e
um chefe) em construcao. Roadmap em [`docs/brasa/plano-de-producao.md`](docs/brasa/plano-de-producao.md).
