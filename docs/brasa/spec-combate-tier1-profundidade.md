# Brasa - Spec: profundidade de combate Tier 1 (poise, inquebrável, parry)

Spec das 3 nuances de combate de maior retorno apontadas na auditoria de 2026-06-16. Fecha a
decisão central que faltava ao moveset: hoje todo confronto é "espere o tell -> esquive/bloqueie
-> puna na recuperação", sem a opção de PRESSIONAR (interromper) nem o risco de TURTLAR. Estes
três sistemas criam o triângulo aço-pedra-papel do action-combat: interromper vs. esquivar vs.
aparar.

Convenção: pt-BR, sem travessões, sem emojis. Procedência: `[DESIGN]`/`[CÓDIGO]`. Exigência:
`[NORMATIVO]`/`[ASPIRACIONAL]`.

Snapshot: 2026-06-16.

---

## 1. Poise / interrupção (interromper a antecipação)

### Objetivo
`[DESIGN]` Hoje `skeleton.takeHit` não interrompe o estado `attacking`: bater num inimigo em plena
antecipação só pinta flash/knockback/dano, o golpe sai igual. Falta a decisão "corro para
interromper vs. recuo". Poise resolve.

### Mecânica
`[NORMATIVO]`
- Cada inimigo tem POISE máximo por tipo. Leves drenam pouco, pesado drena muito.
- Cada golpe do herói reduz o poise (campo `poise` no tuning do ataque). Ao chegar a zero, o
  inimigo CAMBALEIA: o ataque em curso é cancelado (`AttackState.cancel`), toca a reação de hit,
  e ele fica parado/exposto por ~0,6 s; o poise regenera ao recuperar.
- Inimigo cambaleado leva +30% de dano (recompensa de quebra de guarda de postura).
- Poise por tipo (ponto de partida): minion 12, rogue 14, espreitador 14, warrior 25, demônio 25,
  conjurador 18, antigo 45, heavy 65, brutamonte 75, sentinela 95.
- Poise dano por golpe do herói: leve 10, finalizadora 14, pesado 34, ember 16.
- Consequência de design: 1 pesado cambaleia um minion/warrior/rogue; um heavy/sentinela exige
  vários golpes ou simplesmente não cambaleia numa janela curta (você RESPEITA o golpe dele).

### DoD
- [ ] Bater num inimigo leve durante a antecipação cancela o golpe e abre punição.
- [ ] Inimigos pesados não cambaleiam com um golpe leve (poise alto).
- [ ] Cambaleado leva +30% de dano; o poise regenera depois.

### Casos de uso
- CU1: minion ergue o braço -> 2 golpes leves rápidos cancelam o ataque -> punição livre.
- CU2: sentinela ergue o golpão -> golpes leves NÃO interrompem -> tem que esquivar.

---

## 2. Ataque inquebrável telegrafado

### Objetivo
`[DESIGN]` Tudo é bloqueável hoje, então turtlar é seguro demais. Um golpe inquebrável força a
decisão bloquear vs. esquivar e dá identidade aos brutos.

### Mecânica
`[NORMATIVO]`
- Tipos pesados (heavy, sentinela, brutamonte) têm CHANCE (~40%) de a investida ser INQUEBRÁVEL.
- O inquebrável IGNORA o bloqueio (sem redução de dano); só a ESQUIVA (i-frames) salva.
- Telegrafia OBRIGATÓRIA: tinta vermelha pulsante no inimigo durante a antecipação + som de tell
  distinto (perfil "unblock"). Sem leitura clara, não é justo.

### DoD
- [ ] Heavy/sentinela/brutamonte às vezes fazem um golpe que o bloqueio NÃO segura.
- [ ] O inquebrável é telegrafado por cor (vermelho) E som distintos, na antecipação.
- [ ] Esquivar (i-frames) anula o inquebrável.

### Casos de uso
- CU1: brutamonte fica vermelho + som grave de aviso -> jogador solta o bloqueio e esquiva.
- CU2: jogador tenta bloquear o inquebrável -> toma o dano cheio (aprende a ler o vermelho).

---

## 3. Parry de melee

### Objetivo
`[DESIGN]` O parry hoje só devolve projétil (`parryActive`/`parryTimer`). Estender ao melee é a
alavanca clássica de profundidade e reaproveita a janela já existente (~0,18 s ao iniciar o bloqueio).

### Mecânica
`[NORMATIVO]`
- Bloquear na JANELA DE PARRY (logo ao apertar bloqueio) contra um golpe melee FRONTAL e BLOQUEÁVEL
  = PARRY: anula o dano, CAMBALEIA o atacante (abre punição), e recompensa (devolve stamina + tinta
  de bronze + som agudo).
- Inquebrável NÃO pode ser aparado (tem que esquivar) - reforça o item 2.
- Vale para esqueletos e para o Guardião (golpes overhead/sweep; o sopro AoE não é aparável).

### DoD
- [ ] Bloquear no timing exato de um golpe melee frontal anula o dano e cambaleia o atacante.
- [ ] Bloquear FORA da janela continua só reduzindo o dano (não cambaleia).
- [ ] Inquebrável e AoE do chefe não podem ser aparados.
- [ ] Parry dá feedback próprio (bronze + som + leve hit stop) e devolve stamina.

### Casos de uso
- CU1: warrior desce o golpe -> jogador aperta bloqueio no instante -> parry: warrior cambaleia,
  jogador puna.
- CU2: jogador segura bloqueio cedo demais -> janela fechou -> só amortece (sem parry).
- CU3: Guardião faz overhead -> parry abre janela de dano dobrado (soma com a gangorra de luz).

---

## 4. Validação
`[NORMATIVO]` `npm run build` (tsc + vite) limpo; DoD marcados sim/não honesto; sem travessão/emoji.
Tuning (poise, chance de inquebrável, janelas) é ponto de partida, ajustável em playtest.
