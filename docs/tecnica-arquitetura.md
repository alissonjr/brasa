# Técnica: Arquitetura em Camadas

Como organizar o código para separar três preocupações, conforme a direção do projeto:
1. ENGINE - o que é inerente ao motor/framework e pode servir a outras histórias no futuro.
2. JOGO - o que é inerente a esta história e a estes personagens (Josué, fases, narrativa).
3. PLATAFORMA - meta-serviços: usuários, pontos, partida salva, opções, telemetria.

Reflete e organiza o que já existe no protótipo M0 (`prototipo/src/`). Ver
[`plano-de-producao.md`](plano-de-producao.md) (marcos), [`spec-combate.md`](spec-combate.md)
(sistemas que viram engine + tuning do jogo), [`spec-prototipo-jerico.md`](spec-prototipo-jerico.md)
e [`../narrativa/README.md`](../narrativa/README.md) (Ink = camada de jogo; estado salvo =
plataforma).

## 1. Princípios

- Separação por preocupação, não por tipo de arquivo. Cada camada é dona de um motivo de
  mudança: a engine muda quando a tecnologia muda; o jogo muda quando a história muda; a
  plataforma muda quando regras de conta/progresso mudam.
- Regra de dependência (a mais importante): as setas apontam para o que é genérico e
  estável. O JOGO depende da ENGINE e da PLATAFORMA. A ENGINE e a PLATAFORMA NÃO conhecem o
  jogo. Engine e Plataforma são independentes entre si.

```
            +----------------------+
            |        APP           |  composition root (monta e injeta tudo)
            +----------+-----------+
                       | usa
                       v
            +----------------------+
            |        JOGO          |  Josué, fases, inimigos, narrativa (Ink), tuning
            +----+------------+----+
                 | usa        | usa
                 v            v
       +----------------+  +--------------------+
       |    ENGINE      |  |     PLATAFORMA     |
       | (reutilizável) |  | (usuário, save,    |
       |                |  |  pontos, opções)   |
       +-------+--------+  +---------+----------+
               | usa                 |
               v                     v
            Babylon.js          Web APIs (storage, rede)
```

- Acoplamento por interface (ports), não por classe concreta. Quando uma camada precisa de
  outra, ela depende de uma INTERFACE definida na camada de baixo (ou injetada), nunca da
  implementação. Isso é o que corrige a violação atual (engine importando o herói do jogo).
- Comunicação desacoplada por eventos. O jogo emite eventos de domínio ("capítulo
  concluído", "ponto ganho", "checkpoint atingido"); a plataforma escuta para salvar/pontuar,
  sem que o jogo conheça a plataforma diretamente.
- "Escreva como se já fosse um pacote": mesmo começando em pastas (e não em pacotes npm
  separados), cada camada tem uma API pública (um `index.ts` barrel) e ninguém importa o
  "miolo" de outra camada por caminho profundo. Assim, extrair a engine para um pacote
  reutilizável depois é mecânico.

## 2. As camadas em detalhe

### 2.1 ENGINE (núcleo reutilizável)
Tudo que serviria a QUALQUER jogo 3D em 3a pessoa na web, sem uma linha sobre Josué.
Responsabilidades: criar a engine de render (WebGPU/WebGL2), serviço de física (Havok),
abstração de input (action map + remapeamento), câmera de 3a pessoa, controlador de
personagem genérico, laço do jogo e ordem de update (com timestep fixo), barramento de
eventos, máquina de estados, gerência de cenas e de assets (glTF/KTX2/Draco, telas de
loading), serviço de áudio, e a base do framework de UI/HUD.

Regra: a engine NÃO importa nada de `game/` nem de `platform/`. Se ela precisa de algo
do jogo (ex.: o visual do personagem), recebe via interface/port.

Já existem no M0 e pertencem aqui: `engine.ts` (createEngine), `physics.ts` (Havok),
`input.ts` (input), `camera.ts` (ThirdPersonCamera) e a LOCOMOÇÃO de `player.ts` (o
PhysicsCharacterController, sem o herói).

### 2.2 JOGO (esta história e estes personagens)
Tudo que é específico de "Josué: A Conquista". Responsabilidades: o ator Josué (compõe o
controlador da engine com o modelo visual e o input), o `HeroModel` (o Josué low-poly), os
inimigos (defensor cananeu, arqueiro, rei de Jericó), as cenas/fases (Gilgal, frente de
Jericó, Ai), a narrativa (ponte com o Ink e os roteiros `jerico.ink`/`ai.ink`), o tuning do
combate (os números das specs, em dados, não em código), a paleta e a identidade visual.

Já existem no M0 e pertencem aqui: `hero.ts` (HeroModel = Josué) e `environment.ts` (vira as
cenas do jogo). O jogo PODE importar a engine e a plataforma (pelas APIs públicas delas).

### 2.3 PLATAFORMA (meta-serviços)
Tudo que existe "em volta" do jogo e duraria entre jogos/sessões. Responsabilidades:
- Usuários/perfil: identidade local (e, no futuro, conta remota).
- Partida salva (save/load): persistir e recuperar o estado, incluindo o estado do Ink
  (continuidade entre capítulos), checkpoints, tempo de jogo.
- Progresso e pontos: pontuação, conquistas, estatísticas.
- Opções/configurações: áudio, controles (remapeamento), idioma, acessibilidade.
- Telemetria (opcional): métricas de playtest (ver [`spec-combate.md`](spec-combate.md) seção 8).

Regra: a plataforma é genérica (guarda blobs de save, perfis, pontos), NÃO conhece a
estrutura interna do jogo. O jogo decide O QUE salvar; a plataforma decide ONDE e COMO
(localStorage/IndexedDB agora; um backend depois, trocando só o adaptador).

Não existe nada disso no M0 ainda: é a camada a criar.

### 2.4 APP (composition root)
A "casca" que liga tudo: cria a engine, instancia os serviços da plataforma, monta o jogo e
injeta as dependências. É o único lugar que conhece as três camadas ao mesmo tempo. Hoje é o
`main.ts` (que mistura bootstrap + lógica); ele vira só o orquestrador.

## 3. Onde colocar cada coisa (rubrica rápida)
Pergunte, nesta ordem:
1. "Isto serviria a um jogo totalmente diferente, sem mudar nada?" Se sim, ENGINE.
2. "Isto é sobre conta, save, pontos, opções, e seria igual em outro jogo?" Se sim,
   PLATAFORMA.
3. "Isto fala de Josué, Jericó, cananeus, fases, números do combate, diálogos?" Se sim, JOGO.
4. "Isto só amarra as três e arranca o programa?" APP.

Exemplos de fronteira:
- Controlador de cápsula que anda/pula/sobe rampa = ENGINE. O ator Josué que usa esse
  controlador + o HeroModel = JOGO.
- Sistema genérico de "salvar um blob num slot" = PLATAFORMA. A decisão de que o save contém
  `capitulo`, `checkpoint` e o `inkState` = JOGO (define o formato) usando a PLATAFORMA (que
  guarda).
- Tocar um som espacial = ENGINE. A trilha "marcha de Jericó" e quando ela toca = JOGO.
- HUD framework (caixa, ancoragem, escala) = ENGINE/UI. O HUD de vida com moldura de argila e
  os textos = JOGO.

## 4. Estrutura de pastas proposta

Decisão recomendada: começar com PASTAS e fronteiras disciplinadas (não pacotes npm
separados ainda). Ver seção 8 para o porquê e a migração futura para workspaces.

```
prototipo/src/
  engine/                      # CAMADA ENGINE (genérica)
    index.ts                   # API publica da engine (barrel)
    rendering/createEngine.ts  # (era engine.ts)
    physics/physicsService.ts  # (era physics.ts) gravidade vem por config
    input/inputState.ts        # (era input.ts) -> evoluir p/ action map + rebinding
    camera/thirdPersonCamera.ts# (era camera.ts)
    character/characterController.ts # locomoção generica (extraida de player.ts)
    core/gameLoop.ts           # ordem de update + timestep fixo (GameClock)
    core/eventBus.ts           # barramento de eventos tipado
    core/stateMachine.ts       # helper de maquina de estados (combate, cenas)
    core/sceneManager.ts       # carregar/descarregar/transicionar cenas (futuro)
    assets/assetService.ts     # glTF/KTX2/Draco + loading (futuro)
    audio/audioService.ts      # Babylon Audio v2 (futuro)
    ui/uiRoot.ts               # framework de HUD/overlay (futuro)
  platform/                    # CAMADA PLATAFORMA (meta-servicos)
    index.ts
    save/saveStore.ts          # interface SaveStore + LocalSaveStore (localStorage/IDB)
    profile/profileService.ts  # usuarios/perfis
    progress/progressService.ts# pontos, conquistas, estatisticas
    settings/settingsService.ts# opcoes (audio, controles, idioma, acessibilidade)
    telemetry/telemetry.ts     # metricas (opcional)
  game/                        # CAMADA JOGO (Josue)
    index.ts
    actors/josue.ts            # ator Josue = controller(engine) + HeroModel + input
    actors/heroModel.ts        # (era hero.ts) visual de Josue
    actors/enemies/...         # defensor, arqueiro, rei de Jerico (futuro)
    chapters/jerico/...        # cena e fluxo do cap. 1
    chapters/ai/...            # cap. 2
    narrative/inkRunner.ts     # ponte com inkjs + tags (#GAMEPLAY/#RETOMAR)
    narrative/scripts/*.json   # roteiros .ink compilados
    content/combatTuning.ts    # numeros do spec-combate (data-driven)
    content/palette.ts         # cores (hoje embutidas em hero.ts)
    scenes/gilgal.ts           # (environment.ts evolui para as cenas reais)
    scenes/jericoFront.ts
  app/
    main.ts                    # (era main.ts) composition root: monta e injeta
    services.ts                # container de servicos (GameContext)
  index.html  vite.config.ts  tsconfig.json
```

Aliases de import (em `tsconfig.json` + `vite.config.ts`) para reforçar as fronteiras:
`@engine/*`, `@platform/*`, `@game/*`. Regra: ninguém importa caminho profundo de outra
camada; só o barrel (`@engine`, `@platform`). Opcional: `eslint-plugin-boundaries` ou
`dependency-cruiser` para travar a regra de dependência automaticamente.

## 5. Contratos-chave (interfaces)

### 5.1 Container de serviços (GameContext) injetado no jogo
O jogo nunca instancia a plataforma/engine concretas; recebe este contexto do app.
```ts
// engine e platform expoem tipos; o app monta o objeto e injeta no game.
export interface GameContext {
  scene: Scene;
  input: InputSource;          // engine
  camera: ThirdPersonCamera;   // engine
  events: EventBus;            // engine
  clock: GameClock;            // engine (timestep fixo)
  save: SaveStore;             // plataforma
  profile: ProfileService;     // plataforma
  progress: ProgressService;   // plataforma
  settings: SettingsService;   // plataforma
}
```

### 5.2 Port que quebra a violação atual (engine NAO importa o herói)
A engine define o que precisa de um "visual de personagem"; o jogo implementa.
```ts
// engine/character/characterController.ts
export interface CharacterVisual {
  root: TransformNode;
  // dirigido pelo controlador a cada passo (velocidade horizontal, no chao?)
  animate(dt: number, horizontalSpeed: number, grounded: boolean): void;
}
// O CharacterController (engine) move a capsula e chama visual.animate(...).
// Ele NAO conhece HeroModel.
```
```ts
// game/actors/josue.ts (CAMADA JOGO)
import { CharacterController } from "@engine";
import { HeroModel } from "./heroModel";
export class Josue {
  private controller: CharacterController;
  private visual: HeroModel; // implements CharacterVisual
  // compoe os dois; o engine dirige o visual via a interface.
}
```
Isto inverte a dependência: hoje `player.ts` (engine) importa `hero.ts` (jogo); depois, o
`game/actors/josue.ts` (jogo) importa o `CharacterController` (engine) e injeta o
`HeroModel`. A engine fica limpa e reutilizável.

### 5.3 Plataforma: partida salva (preenche uma lacuna conhecida)
```ts
// platform/save/saveStore.ts
export interface SaveStore {
  load(slot: string): Promise<SaveData | null>;
  save(slot: string, data: SaveData): Promise<void>;
  list(): Promise<SaveSlotInfo[]>;
  delete(slot: string): Promise<void>;
}
// Adaptador agora: LocalSaveStore (localStorage para slots pequenos; IndexedDB se crescer).
// Adaptador depois: RemoteSaveStore (mesma interface, backend). Troca sem tocar no jogo.

export interface SaveData {
  version: number;             // para migracao de formato
  profileId: string;
  chapter: string;             // ex.: "jerico", "ai"
  checkpoint: string;          // knot/cena de retomada
  inkState: string;            // story.state.toJson() do inkjs (continuidade!)
  points: number;
  playtimeSec: number;
  updatedAt: number;           // timestamp (passado de fora; ver nota)
}
```
Conexão com a narrativa: as variáveis de continuidade do Ink (`jurou_proteger_raabe`,
`extensao_misericordia`, etc., ver [`../narrativa/README.md`](../narrativa/README.md))
vivem em `inkState`. O JOGO decide montar o `SaveData`; a PLATAFORMA só persiste. Assim o
`ai.ink` consegue ler o que o `jerico.ink` gravou, atravessando sessões.

### 5.4 Eventos de domínio (desacoplam jogo e plataforma)
```ts
// engine/core/eventBus.ts (tipos genericos)
export interface EventBus {
  emit<T>(type: string, payload: T): void;
  on<T>(type: string, handler: (p: T) => void): () => void; // retorna unsubscribe
}
// O JOGO emite; a PLATAFORMA escuta:
events.emit("checkpoint", { chapter: "jerico", knot: "pos_combate" });
events.emit("score", { delta: 100, reason: "raabe_resgatada" });
// app conecta: events.on("score", p => progress.add(p.delta));
//              events.on("checkpoint", () => save.save("auto", game.snapshot()));
```

## 6. Laço do jogo e ordem de update

O M0 já estabelece a espinha (em `main.ts`); formalizamos como contrato da engine.
- `engine.runRenderLoop(() => scene.render())`: o Babylon avança a física (Havok) antes do
  render.
- Ordem por observables:
  1. Amostragem de input (já capturado por eventos).
  2. `onBeforePhysicsObservable`: lógica que precede a física (IA decide, define velocidade
     desejada).
  3. Passo de física (Havok) - automático.
  4. `onAfterPhysicsObservable`: ler o controlador e mover/animar atores (hoje:
     `player.update`).
  5. `onBeforeRenderObservable`: câmera segue (hoje: `camera.update`), VFX.
  6. Render.

Timestep fixo (corrige a lacuna apontada na revisão técnica): o feel do combate usa tempos
em segundos/frames (hit stop, i-frames, telegrafia). Para ser igual em qualquer FPS, a
lógica de gameplay determinística (máquina de estados de combate, contadores de i-frame) deve
rodar num acumulador de passo fixo (ex.: 60 Hz), separado do render, com interpolação visual.
```ts
// engine/core/gameLoop.ts
export class GameClock {
  private acc = 0;
  constructor(private step = 1 / 60) {}
  // chame com o dt real do frame; invoca fixedUpdate N vezes
  tick(dtSeconds: number, fixedUpdate: (h: number) => void): void {
    this.acc += dtSeconds;
    while (this.acc >= this.step) { fixedUpdate(this.step); this.acc -= this.step; }
  }
}
```
O Havok também aceita substep fixo; a câmera e a animação visual podem seguir o frame real
(damping por `1 - exp(-k*dt)`, como já está em `camera.ts` e `hero.ts`). Detalhe maior fica
para um futuro `tecnica-loop-e-timestep.md` se necessário.

## 7. Mapeamento do M0 atual para as camadas (refatoração incremental)

Sem parar o M1: mover por etapas pequenas, rodando `npm run dev` a cada passo.

| Arquivo M0 | Vai para | Observação |
|---|---|---|
| `engine.ts` (createEngine) | `engine/rendering/createEngine.ts` | já é puro de engine |
| `physics.ts` | `engine/physics/physicsService.ts` | tirar `WORLD_GRAVITY` daqui: gravidade vira config injetada (valor do jogo) |
| `input.ts` | `engine/input/inputState.ts` | depois evoluir para action map + remapeamento (acessibilidade) |
| `camera.ts` | `engine/camera/thirdPersonCamera.ts` | já é genérico |
| `player.ts` (locomoção) | `engine/character/characterController.ts` | EXTRAIR a parte do PhysicsCharacterController; remover o import de `hero.ts` |
| `player.ts` (composição com herói) | `game/actors/josue.ts` | novo: compõe controller (engine) + HeroModel (jogo) |
| `hero.ts` (HeroModel) | `game/actors/heroModel.ts` | implementa a interface `CharacterVisual` |
| `environment.ts` | `game/scenes/gilgal.ts` (e jericoFront) | gray-box vira as cenas reais a partir do M4 |
| `main.ts` | `app/main.ts` + `app/services.ts` | vira composition root: cria engine, monta plataforma, injeta GameContext no jogo, roda o loop |
| (não existe) | `platform/*` | criar o esqueleto: SaveStore local, settings, progress, profile |

Passos sugeridos (cada um é um commit que mantém o jogo rodando):
1. Criar as pastas `engine/`, `platform/`, `game/`, `app/` e os barrels `index.ts` vazios;
   configurar aliases `@engine`/`@platform`/`@game`.
2. Mover os arquivos já-genéricos (createEngine, physics, camera, input) para `engine/` e
   ajustar imports. Rodar.
3. Extrair `CharacterController` de `player.ts` para `engine/character/`, sem o herói. Criar
   `game/actors/josue.ts` que compõe controller + HeroModel. Rodar.
4. Mover `hero.ts` -> `game/actors/heroModel.ts` (implementando `CharacterVisual`) e
   `environment.ts` -> `game/scenes/`. Rodar.
5. Transformar `main.ts` em `app/main.ts` + `app/services.ts` (GameContext + injeção).
6. Criar o esqueleto da PLATAFORMA: `LocalSaveStore`, `SettingsService`, `ProgressService`,
   `ProfileService` (mesmo que mínimos), e ligar 1-2 eventos (checkpoint -> autosave) para
   validar o fluxo.

## 8. Decisão: pastas com fronteiras x pacotes (workspaces)

- Recomendado agora: PASTAS com fronteiras (aliases + barrels + regra de dependência). Dá
  ~90% do benefício (separação real, engine reutilizável "no papel") com ~10% do atrito.
  Como cada camada já tem API pública e não vaza imports, extrair depois é mecânico.
- Quando migrar para WORKSPACES (npm workspaces / pnpm, pacotes `@josue/engine`,
  `@josue/platform`, e o app do jogo): quando nascer um SEGUNDO jogo que reusa a engine, ou
  quando quiser versionar/publicar a engine. Aí a fronteira já estará limpa.
- Por que não workspaces já: para um protótipo solo, multiplica configuração (build,
  tsconfig, paths, versionamento) sem ganho real enquanto há só um jogo. A disciplina de
  pastas previne o acoplamento que tornaria a migração cara; o resto é cerimônia prematura.

## 9. Como as outras specs se encaixam nas camadas

- Combate ([`spec-combate.md`](spec-combate.md)): o "motor" (controlador, câmera, lock-on,
  hitbox, máquina de estados, juiciness) é ENGINE genérica; os NÚMEROS (vida, dano, tempos) e
  os inimigos/chefe específicos são JOGO (em `content/combatTuning.ts`, data-driven, para
  iterar sem recompilar).
- Narrativa (Ink): o runner do inkjs e o protocolo de tags é ENGINE/UI genérico; os roteiros
  `jerico.ink`/`ai.ink` e o que cada tag significa neste jogo são JOGO; o estado salvo do Ink
  é PLATAFORMA (via SaveStore).
- UI ([`spec-ui-hud-ux.md`](spec-ui-hud-ux.md)): o framework (HUD, caixa de diálogo, ancoragem,
  escala, acessibilidade) é ENGINE/UI; a "pele" (moldura de argila, textos, ícones) e o
  conteúdo é JOGO; opções/idioma persistidos são PLATAFORMA.
- Áudio ([`biblia-audio.md`](biblia-audio.md)): o serviço (Babylon Audio v2, buses, espacial)
  é ENGINE; as faixas/leitmotifs e quando tocam são JOGO; volume salvo é PLATAFORMA.
- Progressão ([`spec-progressao-e-economia.md`](spec-progressao-e-economia.md)): as regras de
  XP/equipamento são JOGO; pontos/conquistas persistidos são PLATAFORMA.
- Plataforma de dados (save, contas, nuvem, portais, privacidade, apresentação na UI): o
  estudo de tecnologia e o roadmap faseado da camada PLATAFORMA estão em
  [`plataforma-roadmap.md`](plataforma-roadmap.md).

## 10. Próximos passos
- Decidir a estrutura física (recomendo pastas com fronteiras; ver seção 8).
- Executar a refatoração incremental da seção 7 (posso fazer, mantendo o M0 rodando a cada
  passo).
- Escrever, quando útil, os docs técnicos irmãos ainda em aberto: animação no Babylon (M1),
  save/estado detalhado, pipeline de assets/loading, build/deploy/headers, performance/
  profiling (ver a revisão técnica que gerou esta lista).
