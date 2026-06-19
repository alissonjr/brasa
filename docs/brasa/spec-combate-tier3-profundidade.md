# Brasa - Spec: profundidade de combate Tier 3 (stamina de guarda, flanco/backstab)

Segue os Tiers [1](spec-combate-tier1-profundidade.md) (poise/inquebrável/parry) e
[2](spec-combate-tier2-profundidade.md) (esquiva perfeita/cleave/Ressonância). O Tier 3 fecha duas
lacunas de nuance que sobraram: o BLOQUEIO é seguro demais (segurar guarda não custa nada) e o
POSICIONAMENTO não é recompensado (acertar pelas costas vale o mesmo que de frente).

Convenção: pt-BR, sem travessões, sem emojis. Procedência: `[DESIGN]`/`[CÓDIGO]`. Exigência:
`[NORMATIVO]`/`[ASPIRACIONAL]`.

Snapshot: 2026-06-16.

---

## 1. Stamina de guarda + guard break

### Objetivo
`[DESIGN]` Hoje só esquiva e pesado consomem stamina; o bloqueio é gratuito (só não deixa agir),
então turtlar é a opção segura sem custo. Fazer a guarda CUSTAR stamina cria a tensão "quanto posso
segurar?" e completa o triângulo defensivo: parry (de graça, exige timing) > bloqueio (custa, seguro
mas drena) > turtle (quebra). Não toca o fluxo ofensivo (ataque leve segue sem custo, p/ responsividade).

### Mecânica
`[NORMATIVO]`
- Segurar bloqueio DRENA stamina devagar (~12/s).
- APARAR um golpe (bloqueio que reduz dano) custa stamina = ~50% do dano que seria recebido (chip
  na stamina, não na vida).
- Se a stamina chega a zero enquanto bloqueia (segurando ou ao aparar um golpe), ocorre GUARD BREAK:
  o herói CAMBALEIA ~0,5 s (não ataca/esquiva/bloqueia, a guarda cai) e o golpe que quebrou passa
  com dano CHEIO. Recompensa quem pressiona um defensor passivo.
- A regeneração de stamina continua como hoje (40/s após ~1 s sem gastar); recuperar do guard break
  exige recuar/esquivar.

### DoD
- [ ] Segurar bloqueio drena stamina visível no HUD.
- [ ] Aparar golpes esvazia a stamina mais rápido que segurar parado.
- [ ] Stamina a zero no bloqueio = guard break (herói cambaleia ~0,5 s, leva o golpe cheio).
- [ ] Ataque leve continua sem custo de stamina (responsividade preservada).

### Casos de uso
- CU1: jogador turtla contra 3 inimigos; a stamina escorre; um golpe quebra a guarda -> punição.
- CU2: jogador alterna bloqueio e parry para poupar stamina (parry é de graça e ainda cambaleia).

---

## 2. Bônus de flanco / backstab

### Objetivo
`[DESIGN]` Os inimigos guardam frontalmente (ensina a flanquear), mas o herói não ganha NADA por
acertar pelo lado/costas. As plantas (corredor, colunata, floresta de pilares) já incentivam o
posicionamento; o dano deve recompensá-lo.

### Mecânica
`[NORMATIVO]`
- O golpe melee lê a posição do herói em relação à ORIENTAÇÃO do inimigo:
  - pelas COSTAS: x1.5 de dano e +50% de poise (backstab: facilita interromper de trás).
  - pelo FLANCO: x1.2 de dano.
  - de FRENTE: x1.0 (e ainda sujeito à guarda frontal dos tipos com escudo).
- Vale para os golpes diretos (leve/finalizadora/pesado) e o respingo do cleave. Não vale para
  Queimadura (tick) nem para o ember (cone frontal, área).
- O chefe vira-se constantemente para o herói: na prática quase sempre frontal (backstab é raro,
  proposital).

### DoD
- [ ] Acertar um inimigo pelas costas causa mais dano que de frente (x1.5) e ajuda a cambaleá-lo.
- [ ] Acertar pelo flanco dá um bônus menor (x1.2).
- [ ] Queimadura e ember não recebem o bônus posicional.

### Casos de uso
- CU1: jogador rola por trás de um warrior e bate -> backstab forte + cambaleio fácil.
- CU2: numa colunata, o jogador usa os pilares para chegar ao flanco do conjurador -> dano extra.

---

## 3. Validação
`[NORMATIVO]` `npm run build` (tsc + vite) limpo; DoD sim/não honesto; sem travessão/emoji.
Tuning (dreno 12/s, chip 50%, guard break 0,5 s, multiplicadores 1.2/1.5) é ponto de partida,
ajustável em playtest.
