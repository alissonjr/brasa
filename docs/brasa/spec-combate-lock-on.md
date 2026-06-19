# Brasa - Spec: lock-on e soft-target (mira de combate)

Última nuance de combate da auditoria de 2026-06-16: a mira é relativa à câmera e, na turba,
acertar o inimigo pretendido é incerto (a hitbox é uma esfera à frente do herói). Lock-on +
soft-target resolvem a ERGONOMIA da mira sem mudar o moveset.

Convenção: pt-BR, sem travessões, sem emojis. Procedência: `[DESIGN]`/`[CÓDIGO]`. Exigência:
`[NORMATIVO]`/`[ASPIRACIONAL]`.

Snapshot: 2026-06-17.

---

## 1. Soft-target (assist de mira, sempre ligado)

### Objetivo
`[DESIGN]` Sem nenhum modo nem tecla, o golpe deve "grudar" no inimigo óbvio à frente. Hoje o
herói só reorienta para o yaw da câmera na antecipação; numa turba isso erra o alvo pretendido.

### Mecânica
`[NORMATIVO]`
- Durante a ANTECIPAÇÃO do golpe leve/pesado e do ember, se houver inimigo num cone frontal
  apertado da câmera (dot > 0,5) e perto (<= 7 m), o herói encara ESSE inimigo em vez do yaw cru.
- Não muda nada quando não há inimigo no cone (mira pela câmera, como antes). Não trava nada.

### DoD
- [ ] Atacar com um inimigo logo à frente faz o golpe cair sobre ele (não passa ao lado).
- [ ] Sem inimigo no cone, a mira segue a câmera (comportamento antigo).

---

## 2. Lock-on (trava manual, tecla T)

### Objetivo
`[DESIGN]` Em duelos e contra alvos prioritários (conjurador, chefe), travar a mira num inimigo
específico dá controle. A ação `lockOn` (tecla T) já existia no input, sem efeito; agora funciona.

### Mecânica
`[NORMATIVO]`
- T alterna o lock: trava no MELHOR inimigo à frente da câmera (menor distância x desalinhamento,
  dentro do cone e <= 16 m). T de novo destrava.
- Travado: durante o golpe/ember o herói encara o alvo travado (a mira gruda nele, mesmo que a
  câmera vagueie). Um RETÍCULO marca o alvo na tela (projeção do tronco).
- O lock SALTA para o próximo inimigo quando o alvo travado morre (reacquire automático); some
  quando não há mais ninguém. Solta ao trocar de sala.
- Não força a locomoção a strafe-lockar (o herói ainda corre na direção do movimento); o lock
  age na MIRA do golpe, não na navegação - escolha deliberada para não brigar com o controller.

### DoD
- [ ] T trava no inimigo à frente; o retículo aparece sobre ele.
- [ ] Travado, os golpes/ember miram o alvo mesmo com a câmera virada para outro lado.
- [ ] Ao matar o alvo travado, o lock salta para o próximo; sem inimigos, some.
- [ ] Trocar de sala solta o lock. T de novo destrava manualmente.

### Casos de uso
- CU1: 1x1 com o Guardião: trava nele; ember e pesados miram certo enquanto a câmera ajusta o enquadramento.
- CU2: conjurador no fundo: trava nele para fechar espaço com o golpe sempre na direção certa.
- CU3: turba sem travar: o soft-target já faz o golpe cair no mais próximo à frente.

---

## 3. Implementação
`[CÓDIGO]` `thirdPersonCamera.getForward`; `Acendedora.setAimTarget` + orientação na antecipação;
`CombatDirector.toggleLock`/`getLockedPos`/`acquireTarget`/`softAimPos`, alimentando
`hero.setAimTarget` a cada frame; `main.ts` consome a tecla `lockOn` e projeta o retículo
(`Vector3.Project`). Solto em `clearEnemies` (troca de sala).

## 4. Validação
`[NORMATIVO]` `npm run build` (tsc + vite) limpo; DoD sim/não honesto; sem travessão/emoji.
Tuning (cones 0,2/0,5, alcances 16/7 m) é ponto de partida, ajustável em playtest.
