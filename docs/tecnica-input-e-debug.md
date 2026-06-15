# Técnica: Input (remapeamento, dispositivos) e Tooling de Debug/QA

O lado técnico de duas coisas que estavam só implícitas: (1) um sistema de input que suporta
teclado/mouse, gamepad e toque, com REMAPEAMENTO total (exigência de acessibilidade da
[`spec-combate.md`](spec-combate.md) seção 7) e detecção de dispositivo; (2) o ferramental de
debug e QA para desenvolver e testar o jogo. O protótipo hoje tem só um `InputState` de teclado
(`prototipo/src/input.ts`); este doc descreve para onde ele cresce.

Liga-se a [`spec-combate.md`](spec-combate.md) (mapa de controles por dispositivo, latência <
100 ms, acessibilidade), [`spec-ui-hud-ux.md`](spec-ui-hud-ux.md) (HUD de toque, hold-x-toggle),
[`tecnica-arquitetura.md`](tecnica-arquitetura.md) (input é a primeira etapa da ordem de update)
e [`tecnica-performance-e-profiling.md`](tecnica-performance-e-profiling.md) (Inspector como
ferramenta de debug).

## 1. Onde o protótipo está hoje

`input.ts` expõe um `InputState` de teclado: `forward`/`strafe` (eixos WASD+setas), `running`
(Shift), `consumeJump()` (edge-trigger do Espaço). O `camera.ts` trata mouse-look via pointer
lock e zoom por roda. É o suficiente para o M0, mas amarra AÇÕES a TECLAS concretas (`KeyW` está
escrito no getter). O passo seguinte é separar "ação" de "tecla física".

## 2. A camada de abstração: ações, não teclas

A peça central é mapear DISPOSITIVO -> AÇÃO, nunca consultar teclas no gameplay. O jogo pergunta
"a ação `atacar_leve` está ativa?", não "a tecla X está pressionada?". Isso é o que viabiliza
remapeamento, gamepad e toque sem tocar na lógica.

Ações do jogo (derivadas do mapa de controles da spec-combate seção 2):

```ts
type Acao =
  | "mover_x" | "mover_y"          // eixos (-1..1)
  | "camera_x" | "camera_y"        // eixos
  | "atacar_leve" | "atacar_pesado" | "bloquear" | "esquivar"
  | "habilidade" | "distancia" | "lock_on" | "pular" | "interagir"
  | "pausa";
```

Tipos de ação:
- Botão (pressionado/segurado): `bloquear` (hold), `pular` (edge).
- Edge/disparo único: `pular`, `lock_on`, `esquivar` (consumido uma vez por toque, como o
  `consumeJump()` atual).
- Eixo (-1..1): `mover_x/y`, `camera_x/y` (analógico, ou teclas viram -1/0/+1, ou joystick
  virtual).

O `InputState` cresce para um `InputMap` que mantém o estado por AÇÃO e é alimentado por vários
backends de dispositivo:

```ts
class InputMap {
  private estado = new Map<Acao, number>();        // botão: 0/1; eixo: -1..1
  private edge = new Set<Acao>();                   // disparos a consumir neste frame

  valor(a: Acao): number { return this.estado.get(a) ?? 0; }
  ativo(a: Acao): boolean { return this.valor(a) > 0.5; }
  consumir(a: Acao): boolean { const t = this.edge.delete(a); return t; }

  // backends chamam estes para reportar input já traduzido em AÇÃO
  setEixo(a: Acao, v: number) { this.estado.set(a, v); }
  setBotao(a: Acao, v: boolean) { if (v && !this.ativo(a)) this.edge.add(a); this.estado.set(a, v ? 1 : 0); }
}
```

## 3. Backends de dispositivo

### 3.1 Teclado/mouse
Um binding `tecla -> ação` (em vez do `KeyW` fixo de hoje). Mouse-look continua via pointer lock
(já no `camera.ts`); os botões do mouse viram `atacar_leve`/`atacar_pesado` (spec-combate: botão
esq./dir.).

```ts
const bindTeclado: Record<string, Acao> = {
  Space: "pular", ShiftLeft: "esquivar", KeyQ: "bloquear",
  KeyE: "habilidade", KeyF: "distancia", Tab: "lock_on", KeyR: "interagir",
  // WASD alimentam os eixos mover_x/mover_y
};
```

### 3.2 Gamepad (Gamepad API)
Polling por frame (a Gamepad API não dá eventos, só estado): ler `navigator.getGamepads()`,
mapear sticks para `mover_*`/`camera_*` (com DEADZONE) e botões para ações. Babylon tem
`DeviceSourceManager`/`Gamepads`, mas a Gamepad API crua basta e é portável.

```ts
function lerGamepad(map: InputMap, dead = 0.15) {
  const gp = navigator.getGamepads()[0]; if (!gp) return;
  const dz = (v: number) => (Math.abs(v) < dead ? 0 : v);
  map.setEixo("mover_x", dz(gp.axes[0])); map.setEixo("mover_y", dz(-gp.axes[1]));
  map.setEixo("camera_x", dz(gp.axes[2])); map.setEixo("camera_y", dz(gp.axes[3]));
  map.setBotao("atacar_leve", gp.buttons[2].pressed);   // X/Quadrado
  // ... resto conforme a tabela da spec-combate
}
```

### 3.3 Toque (mobile)
Joystick virtual esquerdo (mover), arrastar à direita (câmera), botões na tela (ataque, bloqueio,
etc.). HUD configurável e auto-lock mais agressivo (spec-combate seção 2, spec-ui-hud-ux). Os
controles de toque produzem as MESMAS ações; nada na lógica muda.

## 4. Remapeamento (exigência de acessibilidade)

A spec-combate seção 7 exige "remapeamento total" e "hold convertível em toggle". Como o gameplay
só lê AÇÕES, remapear é editar a tabela `tecla -> ação` (e a de gamepad), não tocar no jogo:
- Tela de controles nas opções: o jogador clica numa ação, aperta a nova tecla/botão, a tabela
  atualiza. Detectar conflito (duas ações na mesma tecla) e avisar.
- Hold -> toggle: uma flag por ação (ex.: `bloquear` e `lock_on`) que transforma "segurar" em
  "apertar para ligar/desligar". É um wrapper sobre o backend, transparente para a lógica.
- O mapeamento é CONFIGURAÇÃO persistida à parte do save (ver
  [`spec-fluxo-e-persistencia.md`](spec-fluxo-e-persistencia.md) seção 6), com um botão "restaurar
  padrão".
- Não codificar ação só por cor/ícone fixo: mostrar o BINDING atual nas dicas de UI (a dica de
  pulo lê o binding real, não "Espaço" fixo). Isso fecha o ciclo com o i18n
  ([`tecnica-i18n.md`](tecnica-i18n.md)).

## 5. Detecção de dispositivo e troca de esquema

- Detectar o dispositivo ativo e adaptar a UI: mostrar prompts de teclado, de gamepad ou de toque
  conforme o ÚLTIMO input recebido (não conforme o hardware presente). Trocar os glifos da HUD ao
  vivo quando o jogador pega o gamepad.
- Toque: detectar por evento de toque / `navigator.maxTouchPoints` + tela pequena, ligando o HUD
  de toque e o auto-lock mais forte.
- `gamepadconnected`/`gamepaddisconnected` para ligar/desligar o polling e avisar na UI.
- Pausar o jogo ao desconectar o gamepad no meio do combate (cortesia padrão).

## 6. Input na ordem de update e latência

Input é a PRIMEIRA etapa da ordem de update (input -> IA -> física -> animação -> câmera ->
render, tecnica-arquitetura seção 6). Implicações:
- Ler o input (e fazer o polling de gamepad) no início do frame, antes da lógica.
- Latência de input crítico < 100 ms (spec-combate seção 6): evitar enfileirar input em buffers
  longos; o "buffer de input" de combo (tecnica-animacao-babylon seção 4) é curto e proposital,
  não uma fila de latência.
- Edge-triggers (pular, esquivar, lock-on) são CONSUMIDOS uma vez por frame de lógica (o padrão
  `consumeJump()` que já existe), para não disparar repetido enquanto a tecla fica pressionada.
- Com timestep fixo, o input lido no frame de render é aplicado nos passos fixos daquele frame;
  cuidar para não perder um toque curto entre passos (registrar o edge e consumir no próximo
  passo fixo).

## 7. Tooling de debug/QA

Ferramental para desenvolver e testar (separado do build de produção):

- Overlay de debug: estende o HUD de FPS atual com draw calls, frame time, estado do
  player/combate (LocomotionState, i-frames ativos, alvo do lock-on), posição/seed. Ligado por
  tecla (ex.: F1) e por flag de URL (`?debug=1`), nunca no build final.
- Babylon Inspector sob tecla (ver [`tecnica-performance-e-profiling.md`](tecnica-performance-e-profiling.md)):
  `scene.debugLayer.show()` em F12-de-jogo; import dinâmico para não pesar o bundle.
- Flags de URL para QA: `?renderer=webgl|webgpu` (já existe no `engine.ts`), `?area=<id>` para
  pular direto a uma área, `?nodialog` para pular cutscenes, `?god` para invulnerável,
  `?spawn=<empty>`. Tudo atrás de um gate de build de desenvolvimento.
- Visualização de colisores/hitboxes: desenhar as cápsulas/hitboxes de ataque (a hitbox do M2) em
  wireframe sob uma tecla, para depurar o combate (acerto/erro, alcance, i-frames).
- Console de comandos simples (opcional): dar vida/stamina, spawnar inimigo, ir a checkpoint;
  acelera muito o playtest do combate.
- Telemetria de playtest (plano-de-producao seção 6, spec-combate seção 8): logar uso de cada
  verbo, mortes por inimigo, FPS médio/p95, latência medida. Pode ser um buffer em memória
  exportável como JSON ao fim da sessão (sem servidor no protótipo).
- Gravação de input para repro de bug: gravar a sequência de ações + seed e reproduzir. Útil para
  bugs de combate difíceis de repetir; opcional, alto valor se o combate ficar complexo.

## 8. Recomendação para o projeto

- Refatorar o `input.ts` para a camada de AÇÕES (seção 2) já no M1/M2: o combate (M2) nasce lendo
  ações, não teclas, o que destrava remapeamento e gamepad sem retrabalho.
- Gamepad por polling no início do frame; toque a partir do momento em que o mobile entrar no
  alvo de teste.
- Remapeamento total + hold/toggle como configuração persistida, com restaurar-padrão (entrega de
  acessibilidade da spec-combate seção 7).
- Overlay de debug + Inspector sob tecla + flags de URL desde já: o gate de feel do M2 e o de
  performance do M4 dependem de medir e pular rápido para a cena certa.
- Manter tudo de debug atrás de um gate de build de desenvolvimento, fora do bundle de produção.

## Fontes

- https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
- https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API
- https://doc.babylonjs.com/features/featuresDeepDive/input/deviceSourceManager
- https://w3c.github.io/gamepad/ (padrão de mapeamento de botões/eixos)
- https://gameaccessibilityguidelines.com/ (remapeamento, hold/toggle, prompts por dispositivo)
- https://doc.babylonjs.com/toolsAndResources/inspector
