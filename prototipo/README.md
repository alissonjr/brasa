# Protótipo Jericó

Vertical slice do capítulo de Jericó. Stack: Babylon.js (TypeScript) + Vite + Havok.
Ver a especificação em [`../docs/spec-prototipo-jerico.md`](../docs/spec-prototipo-jerico.md).

## Estado atual: M0 - Esqueleto técnico

Cena Babylon + chão + Havok + cápsula cinemática que anda com a câmera de 3a pessoa
seguindo (gray-box). Critério de aceite do M0 (spec seção 11): "dá para andar uma cápsula
numa área com colisão e a câmera segue suave".

O que já está montado:

- Engine WebGPU com fallback automático para WebGL2 (timeout no init do WebGPU para nunca
  travar; ver `src/engine.ts`).
- Física Havok (WASM) habilitada na cena (`src/physics.ts`).
- Gray-box do ambiente: chão, caixas-obstáculo e uma rampa, todos com colisão; sol +
  luz ambiente (`src/environment.ts`).
- `PhysicsCharacterController` (cápsula cinemática como colisor): andar, correr, pular,
  gravidade, colisão, subir rampa e degraus (`src/player.ts`).
- Câmera de 3a pessoa orbital com damping, seguindo o herói; movimento relativo à
  câmera; mouse-look livre via pointer lock (`src/camera.ts`).
- HUD mínimo com controles e contador de FPS.

### Josué (personagem) - `src/hero.ts`

No lugar da cápsula gray-box, o protagonista é um **Josué low-poly procedural**, fiel à
documentação (`docs/personagens/01-lideres-israelitas.md`, `docs/biblia-vestuario.md` KIT A,
`docs/direcao-de-arte.md`): proporções de comandante, túnica ocre até o joelho, manto
terra-avermelhado (cor-assinatura), cinto de couro com placa de bronze, escamas de bronze
nos ombros, bandolete na testa, cabelo curto com grisalho, barba aparada, espada curta de
bronze na bainha, lança nas costas, sandálias. Tem locomoção procedural simples (passada,
braços alternando, manto inclinando ao correr).

Isto é o visual "caracterizado" do gray-box. O M1 "pleno" troca por um glTF rigado
(Blender/Mixamo) com animação por esqueleto.

## Como rodar

```bash
npm install
npm run dev      # http://localhost:5173
```

Build de produção:

```bash
npm run build    # gera dist/ (estático, pode publicar em itch.io/Netlify/Pages)
npm run preview
```

## Controles

- `WASD` / setas: mover (relativo à câmera)
- `Shift`: correr
- `Espaço`: pular
- Mouse (arrastar): girar a câmera; scroll: zoom

## Renderer

Por padrão tenta WebGPU e cai para WebGL2 se não inicializar em ~6s. Para forçar:

- `?renderer=webgl` - só WebGL2
- `?renderer=webgpu` - só WebGPU (sem fallback)

## Estrutura

```
src/
  main.ts          orquestra engine, física, cena e loop
  engine.ts        cria engine (WebGPU/WebGL2)
  physics.ts       carrega o Havok e habilita a física
  environment.ts   gray-box: chão, obstáculos, rampa, luzes
  camera.ts        câmera de 3a pessoa com damping
  player.ts        cápsula via PhysicsCharacterController + locomoção
  input.ts         estado do teclado
```

## Próximo marco

M1 - Herói animado: trocar a cápsula por Josué (glTF) com idle/andar/correr e blend de
locomoção. Ver a ordem de marcos na spec seção 11.
