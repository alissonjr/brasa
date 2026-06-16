# Spec: Combate profundo (defesa, ultimate, captura de arma, execução)

Status: [NORMATIVO]. Fundamentado em pesquisa dos campeões do gênero (Hades, Souls/Elden
Ring, Sekiro, Returnal, Doom Eternal, God of War). Resolve a queixa de playtest: "a fase dos
gigantes + bolas de fogo é impossível; falta defesa clara, super/ultimate por tecla, captura
de arma e animação de execução". Conversão: 60 FPS, 1 frame ~= 16,7 ms.

Princípio unificador (push-forward combat do Doom + gestão de poder do Hades): o dano vira
JUSTO (telegrafia honesta + 3 defesas) e o jogador ganha ferramentas de VIRADA (ultimate,
arma roubada, execução que cura). A fase deixa de ser "impossível" e vira "intensa e justa".

## 1. Defesa contra projéteis (bola de fogo do conjurador) [NORMATIVO]

Regra de ouro (Game Developer / Level Design Book): o telegrafe diz "lá vai, dá pra desviar?".
Tomar dano deve ser sempre escolha do jogador, nunca roubo do jogo.

- Telegrafe (já parcialmente feito): cast longo (0,95 s) + projétil LENTO (6,5 u/s, > 400 ms
  até o impacto a média distância, mais que a janela de esquiva) + cadência espaçada (1,8 s) +
  projétil grande/brilhante. Conjuradores NÃO disparam em sincronia.
- Três defesas, em camadas:
  1. ESQUIVA com i-frames (já existe): janela 0,1-0,3 s do rolamento de 0,55 s. Anula o
     projétil (já anula via `invulnerable`). Referência: Souls roll ~215 ms, Hades dash.
  2. BLOQUEIO FRONTAL que PARA o projétil (novo): se bloqueando E o projétil vem do cone
     frontal (~120 graus, dot(forward, dirDoProjetil) < -0.5), o projétil é DESTRUÍDO sem
     dano (não só reduzido). Fora do cone (costas/lado), passa. Referência: escudo de Souls.
  3. PARRY/DEFLECT de fogo (novo): se o bloqueio foi PRESSIONADO nos últimos ~180 ms antes do
     impacto frontal, em vez de só parar, DEVOLVE o projétil ao conjurador (inverte a
     velocidade, dobra, troca a cor para azul-branco) + hit stop + flash. Referência: Athena
     deflect (Hades), Sekiro deflect (~200 ms).

DoD: dá pra rolar, bloquear de frente (some sem dano) e rebater (volta no mago). tsc limpo.

## 2. Ultimate por tecla + gestão de poder [NORMATIVO]

Modelo Hades (God Gauge): além da Fagulha (recurso gastável que já existe no E), uma BARRA DE
BRASA (ultimate) que enche causando E sofrendo dano. Cheia (100%), pisca; tecla dedicada
libera o ultimate.

- Barra de Brasa: 0..100. +dano causado * k1, +dano sofrido * k2. HUD: 4a barra/medidor.
- Ultimate "Erupção" (tecla X): ao acionar com barra cheia, trava input ~1,2 s, herói
  INVULNERÁVEL durante (lição glory kill), chuva de fogo na arena (dano em tick a todos) +
  câmera shake + hit stop inicial. Zera a barra. É o "botão de virada" do pior momento.
- Teclas: E = golpe de fogo (Fagulha), X = ULTIMATE (barra). (Q é bloqueio; 1/2 poções.)

DoD: barra enche em combate; X com barra cheia limpa a arena e dá i-frames; HUD mostra a
barra; sem barra, X não faz nada (feedback de "vazio").

## 3. Captura de arma do inimigo [NORMATIVO]

Honestidade técnica: trocar o moveset inteiro exige animações que não temos. O sweet spot
(Halo + Doom) é pickup TEMPORÁRIO como buff/munição, sem moveset novo.

- Brutamonte dropa CLAVA; conjurador dropa CAJADO em brasa. Surge prompt "[G] Pegar".
- Clava (10 s ou 5 golpes): ataque pesado vira smash de área, dano dobrado, knockback forte
  (reaproveita o pesado com escala maior + VFX). 
- Cajado (3 cargas): bolas de fogo GRÁTIS no E (não gasta Fagulha) - usar o fogo do mago
  contra os gigantes. Cria o loop tático "mate o mago primeiro, roube o fogo".
- Visual: mesh da arma preso à mão (offset fixo); HUD mostra timer/cargas. Acabou, some.

DoD: inimigos dropam arma; pegar com G dá o buff/munição temporária com timer visível.

## 4. Execução / finisher [NORMATIVO]

Modelo glory kill (Doom) + stun finisher (God of War): empurra o jogador para a agressão e
o mantém vivo (cura), o antídoto da "fase impossível".

- Gatilho: inimigo abaixo de ~22% de vida não morre, entra em VACILO (cambaleia, brilha
  laranja - leitura de cor do Doom). Prompt "[F] Executar" por ~2,5 s.
- Execução (F, ~0,8 s): lunge (cola no inimigo), herói INVULNERÁVEL, dissolução exagerada do
  inimigo (já temos dissolve) + burst de cinzas + hit stop ~120 ms + shake + flash.
- Recompensa: +Fagulha, cura ~15% da vida, enche um naco da barra de Brasa. Fecha o loop
  econômico (executar = sobreviver), igual o glory kill.

DoD: inimigo em vida baixa fica executável (prompt); F executa com i-frames, cura e recurso.

## 5. Rebalanceamento da fase dos gigantes [NORMATIVO]

- Bola de fogo justa (feito): cast 0,95 s, 6,5 u/s, recarga 1,8 s, projétil grande.
- Nunca 2 conjuradores em sincronia: escalonar o primeiro disparo por um offset por inimigo.
- Com as 3 defesas + ultimate + execução, a fase fica vencível por habilidade, não por sorte.

## Teclas finais (teclado + mouse)
WASD mover, Mouse0 = ataque leve, Mouse2/Q = bloqueio (segurar = guarda, tap no tempo = parry),
Shift/C = esquiva, E = golpe de fogo, X = ULTIMATE, F = executar, G = pegar arma, 1/2 = poções.

## Notas
- Sem animação dedicada: tudo "fingido" com transform, partículas, hit stop, câmera (a
  pesquisa confirma que isso basta para o feel em low-poly).
- Sem em-dash/emoji; pt-BR; tudo remapeável.
