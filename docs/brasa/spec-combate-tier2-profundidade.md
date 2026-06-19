# Brasa - Spec: profundidade de combate Tier 2 (esquiva perfeita, cleave, Ressonância visível)

Segue o [Tier 1](spec-combate-tier1-profundidade.md) (poise, inquebrável, parry). O Tier 1 criou
o triângulo interromper/esquivar/aparar. O Tier 2 recompensa a execução precisa, conserta o
"whack-a-mole" da horda e torna LEGÍVEL a profundidade que já existia escondida no código.

Convenção: pt-BR, sem travessões, sem emojis. Procedência: `[DESIGN]`/`[CÓDIGO]`. Exigência:
`[NORMATIVO]`/`[ASPIRACIONAL]`.

Snapshot: 2026-06-16.

---

## 1. Esquiva perfeita (perfect dodge)

### Objetivo
`[DESIGN]` Hoje a esquiva é só defensiva (i-frames no miolo). Esquivar no INSTANTE do golpe deve
recompensar a leitura precisa, fechando o ciclo com os sons de tell por tipo (agora dá para ouvir
o momento exato). Sem isso, esquivar cedo ou no limite dá o mesmo resultado.

### Mecânica
`[NORMATIVO]`
- Se um golpe inimigo é ANULADO pelos i-frames na JANELA INICIAL do rolamento (logo após os
  i-frames abrirem, ~0,12 s), conta como ESQUIVA PERFEITA (você esquivou no último instante).
- Recompensa: hit stop breve (sensação de slow-mo na quase-colisão) + **+1 carga de Fagulha** +
  flash ciano no HUD + som próprio. Uma recompensa por rolamento (não acumula no mesmo roll).
- Esquivar cedo demais (i-frames anulam tarde, fim da janela) = esquiva NORMAL, sem bônus.
- Vale contra golpe melee E projétil (qualquer dano anulado por i-frames na janela).

### DoD
- [ ] Esquivar no instante do impacto dá hit stop + 1 carga de Fagulha + flash + som.
- [ ] Esquivar cedo demais não dá o bônus (só anula o dano).
- [ ] No máximo uma recompensa por rolamento.

### Casos de uso
- CU1: warrior desce o golpe; o jogador rola no último instante -> freeze + ciano + ganha Fagulha
  -> emenda um ember de graça.
- CU2: jogador rola com folga antecipada -> esquiva normal, sem bônus (incentiva o timing justo).

---

## 2. Cleave na finalizadora e no pesado

### Objetivo
`[DESIGN]` `detectHeroHits` acerta UM alvo e dá `break`. Num jogo de horda (5-6 mortos por sala),
leve/pesado nunca clipam dois -> sensação de whack-a-mole; a única resposta de área é o ember
(cargas limitadas) e a ultimate. Dar CLEAVE à 3a do combo e ao pesado conserta sem inflar o moveset.

### Mecânica
`[NORMATIVO]`
- A finalizadora do combo (3a leve) e o ataque pesado têm RAIO DE CLEAVE: após o alvo primário,
  atingem inimigos próximos do ponto de impacto, com dano PARCIAL (~55%) e poise reduzido.
- O ember (cone) e a clava capturada (smash) continuam como respostas de área mais fortes; o
  cleave base é o "respiro" de horda do moveset normal.
- Tuning de partida: finalizadora cleave raio 2.4 m; pesado 2.8 m; dano secundário 0.55x.

### DoD
- [ ] A 3a do combo e o pesado atingem mais de um inimigo quando há vários encostados.
- [ ] O dano secundário é menor que o do alvo primário (não trivializa a horda).
- [ ] Golpes leves 1 e 2 continuam mono-alvo (o cleave é recompensa do commit).

### Casos de uso
- CU1: 3 minions cercam o herói; a finalizadora os empurra/fere todos de uma vez (alívio de pressão).
- CU2: pesado num grupo encostado distribui dano + knockback (abre espaço).

---

## 3. Ressonância visível no HUD

### Objetivo
`[CÓDIGO]`+`[DESIGN]` A Ressonância já existe (`heroCombat`: acertos encadeados sem apanhar dão
até +30% de dano), mas é INVISÍVEL: o jogador não vê o streak subir nem sente que perdeu ao apanhar.
Surfaçar transforma um número oculto numa mecânica sentida (e ensina a não apanhar).

### Mecânica
`[NORMATIVO]`
- O HUD mostra o streak da Ressonância quando a dádiva está ativa e o streak > 0: marcas/chevrons
  que acendem conforme os acertos encadeados (até o teto de +30%).
- Some/zera ao apanhar (o streak já zera no código); o HUD reflete na hora.
- Discreto: aparece perto dos pips de Fagulha, sem competir com vida/stamina.

### DoD
- [ ] Com a dádiva Ressonância ativa, o HUD mostra o streak crescendo a cada acerto.
- [ ] Apanhar zera o indicador imediatamente.
- [ ] Sem a dádiva, o indicador não aparece.

### Casos de uso
- CU1: jogador encadeia 5 acertos limpos -> vê o indicador encher -> sabe que está no pico de dano.
- CU2: jogador apanha -> indicador some -> sente a perda (reforça a esquiva/parry).

---

## 4. Validação
`[NORMATIVO]` `npm run build` (tsc + vite) limpo; DoD sim/não honesto; sem travessão/emoji.
Tuning (janela da esquiva perfeita, raios e dano de cleave) é ponto de partida, ajustável em playtest.
