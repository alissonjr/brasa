# Brasa - Aprofundamento e Roadmap

Documento mestre de elevação de qualidade. Nasce de uma auditoria em 6 frentes (narrativa
e personagens; combate e poderes; progressão e sistemas; ambientação e arte; UI, audio e
producao; e um mapa factual do codigo atual) cruzada com o que o jogo JA FAZ hoje no
`prototipo/`. O objetivo e duplo: deixar a documentacao mais detalhada e elaborada nos
pontos rasos, e dar um roadmap concreto de como levar essas melhorias ao jogo.

Convencao herdada (ver [`guia-de-estilo-e-glossario.md`](guia-de-estilo-e-glossario.md)):
pt-BR, sem travessoes, sem emojis. Procedencia: `[DESIGN]` (decisao nossa), `[CÓDIGO]`
(observado no codigo), `[ASSET]` (de um pacote). Exigencia: `[NORMATIVO]` (entra no aceite),
`[ASPIRACIONAL]` (intencao), `[A DEFINIR]` (pendente). Cada onda do roadmap tem DoD.

Snapshot: 2026-06-15.

---

## 0. Como ler este documento

- A **Parte 1** reconcilia doc x codigo: onde o codigo ja passou a frente da doc, onde a
  doc promete o que o codigo nao tem. Isto reposiciona o trabalho: parte de "melhorar a doc"
  e na verdade DOCUMENTAR o que ja existe; o resto e aprofundar de fato.
- A **Parte 2** fecha as decisoes de canon que estao `[A DEFINIR]` e travam tudo o mais. Cada
  uma vem com recomendacao explicita.
- A **Parte 3** e o aprofundamento por area, com numeros, tabelas e conteudo concreto pronto
  para virar spec. E o coracao do "mais detalhado e elaborado".
- A **Parte 4** e o roadmap em ondas (W1 a W6), cada uma amarrando trabalho de doc + de codigo
  + DoD, na ordem de dependencia.
- A **Parte 5** lista riscos e gates.

---

## 1. Reconciliacao: o que a doc diz x o que o codigo faz

`[CÓDIGO]` Levantamento factual do `prototipo/src` em 2026-06-15.

### 1.1 O codigo JA FAZ (e a doc trata como aspiracao ou nao registra)

| Area | Estado real no codigo | Implicacao para a doc |
|---|---|---|
| Golpe de fogo (Fagulha/ember) | Implementado: `tuning.ts` `ember: {startup .26, active .1, recovery .42, damage 22, knockback 5, range 5.5, arcCos .5}`; custo 0.34 de Fagulha; regen 0.16/s; recarrega no braseiro. | A doc (spec-combate) trata Fagulha como `[A DEFINIR]` sem numeros. Esta DEFASADA. Tarefa: documentar o que existe e so entao estender. |
| Variedade de inimigos | 10 tipos em `skeleton.ts`: minion, warrior, rogue, heavy, antigo, sentinela (KayKit) + demonio, brutamonte, espreitador, conjurador (Quaternius). 3 comportamentos: melee, skirmisher (hit-and-run), ranged (projetil). | bestiario.md descreve 4 tipos genericos sem numeros. O codigo tem mais e com stats. Tarefa: a doc deve REFLETIR e ratificar a tabela real. |
| Chefe Guardiao | `guardiao.ts` (287 l): 3 FASES por faixa de vida (fria 100-66, tiço 66-33, quente 33-0), movesets por fase (overhead, varredura, sopro de escuro AoE com anel no chao), tinta emissiva por fase. | A doc do chefe e forte mas o codigo ja tem fases. Falta a mecanica-assinatura (gangorra de luz). |
| Economia | Fagulha como moeda (drops 3-20 por tipo), 5 dadivas + 1 gratis, 2 pocoes (Recuperacao, Furia), retry de andar, save robusto (Dexie + HMAC + backup). | Doc de progressao propoe muito `[A DEFINIR]`; o nucleo ja roda. Tarefa: documentar e aprofundar. |
| Salas | 5 layouts (guarda, salao, cisterna, santuario, guardiao), 88+ pecas KayKit em thin instances, transicao frio->quente, descarte limpo. Descida de 7 salas. | A doc de ambientes descreve as pecas, mas o codigo ja monta e descarta. |

### 1.2 A doc PROMETE e o codigo NAO TEM (gaps reais)

| Gap | Estado | Onde a doc fala |
|---|---|---|
| **Teto** | Ausente nas salas reais (`cryptRoom` tem ceu aberto; so o graybox antigo tinha teto). | biblia-ambientes 4.4 (aspiracional) |
| **Status (queimadura, etc.)** | Inexistente. O tema e fogo, mas nenhum ailment. | spec-combate (so menciona) |
| **Gangorra de luz do chefe** | O Guardiao usa fases por VIDA, nao a mecanica de reacender a Brasa para enfraquece-lo. | spec-chefe-guardiao 4 |
| **Arvore de poderes** | So 5 dadivas planas, sem tiers/sinergias/ramos. | progressao 5 |
| **Encenacao narrativa** | Codex (texto) + objetivos. Sem inscricoes na sala, sem ecos, sem confronto encenado com o chefe, sem cutscene minima. | narrativa 7, set-pieces |
| **Identidade de personagem** | Heroina sem nome/voz; Guardiao sem passado; sem NPC vivo (Voz do Poco). | personagens |
| **Detalhe tatil de chao/parede** | Piso e xadrez unico; sem variacao por andar, sem desgaste, sem agua, sem nicho de parede. | biblia-ambientes |
| **Audio** | `titleAmbience` existe; sem trilha adaptativa em jogo, sem leitmotifs, sem SFX de combate completos. | biblia-audio |
| **Meta-progressao / rejogabilidade** | Run unica linear; sem desbloqueios entre runs, sem modificadores, sem seed. | game-design 10 |

### 1.3 Veredito

O jogo NAO esta no zero: existe um vertical slice jogavel (7 salas, 5 verbos de combate, 10
inimigos, economia, save, HUD, menus, codex). O salto de qualidade pedido nao e "construir o
basico"; e **profundidade e encenacao**: dar peso ao combate (poderes, status, chefe de
verdade), alma a historia (canon fechado, encenado in-game), e textura ao espaco (teto, chao,
identidade por sala). A doc precisa parar de tratar como `[A DEFINIR]` coisas que o codigo ja
resolveu, e passar a especificar com numeros o que falta.

---

## 2. Decisoes de canon a fechar (com recomendacao)

`[DESIGN]` Estas decisoes travam toda a narrativa e o chefe. Recomendacao explicita em cada;
ao aceitar, viram `[NORMATIVO]` e destravam a producao.

### 2.1 Identidade do Guardiao
Recomendacao: o Guardiao **e a Primeira Acendedora**. Desceu ha geracoes, reacendeu a Brasa,
e descobriu que a chama so arde se alguem fica presa dentro dela alimentando-a com a propria
fagulha. Escolheu ficar. O tempo a consumiu. Ela nao e maldade: testa a heroina porque precisa
saber se deve passar o fardo ou impedi-la de repetir o erro. Isto transforma o combate de
"chefe com HP" em conflito de valores e amarra o final.

### 2.2 Nome e motivacao da heroina
Recomendacao: nome proprio **Cinza** (titulo "a Acendedora", nome "Cinza"). Motivacao concreta:
ela desce porque **a mentora que a criou (Marta) desceu na geracao passada e voltou gasta demais
para descer de novo**; agora Marta esta morrendo do frio na superficie. Cinza desce para reavivar
a Brasa E para entender o que aconteceu com quem desceu antes dela. Isto tira o arco do automatismo.

### 2.3 O final
Recomendacao: **O Sacrificio com ciencia** (a heroina pode escolher). Ato III revela a verdade
(a Brasa exige uma guarda viva). O slice fecha com a heroina aceitando ficar (vira a proxima
Guardia) OU com um corte sobrio que deixa a pergunta. Para o slice, implementar o Sacrificio como
final canonico; a Recusa/Quebra fica `[A DEFINIR]` para expansao.

### 2.4 Lore-raiz (por que o frio, o que e a Brasa)
Recomendacao `[DESIGN]`: o frio eterno e o estado natural do mundo; a Brasa e uma chama que so
existe enquanto uma Acendedora a alimenta de dentro. Os mortos selados sao gente do proprio povo,
sepultada na pedra quente; quando a luz recua, o escuro os reocupa. Nao ha vilao cosmico: a
tragedia e o custo (uma vida por geracao). Isto da peso tematico sem exigir cosmologia pesada.

### 2.5 Escopo do slice
Recomendacao: manter **7 salas** (ja no codigo: `DESCENT`), terminando no Guardiao. Aprofundar a
VARIEDADE das 7 (planta, composicao, identidade visual, beat narrativo) antes de alongar para 9-12.

### 2.6 Parry/postura
Recomendacao: NAO entra no slice base (esquiva + bloqueio bastam). Fica como ramo opcional da
arvore de dadivas (ver 3.1), destravavel, para builds avancadas. Evita inchar o moveset central.

---

## 3. Aprofundamento por area

Conteudo concreto, pronto para virar spec. Numeros sao ponto de partida de tuning, nao sagrados.

### 3.1 Jogabilidade: poderes, ataques e builds

**Fagulha (ratificar o que ja existe + estender).** `[CÓDIGO]` Hoje: recurso 0..1, custo 0.34
por ember, regen 0.16/s, recarrega no braseiro. `[DESIGN]` Migrar para **cargas discretas** (mais
legivel no HUD): 3 cargas no slice, 1 carga por golpe de fogo, recarrega tudo no braseiro + 1 carga
a cada inimigo morto com ember equipado. Mantem a tensao "uso agora ou guardo para a turba".

**Status Queimadura (novo, tematico).** `[DESIGN]` `[NORMATIVO]` quando entrar:
- Aplicado por: golpe de fogo (ember), Elixir (ver abaixo).
- Efeito: 2 de dano/s por 3 s; alvo queimado recebe +15% de knockback e +10% de dano; hesita
  +0.2 s no proximo tell (medo/dor). Empilha ate 2 (4 dano/s).
- Feedback: brilho laranja no esqueleto, particula de brasa. Custo de codigo: um componente de
  status no ator inimigo + tick no `combatDirector`.

**Arvore de dadivas (substitui as 5 dadivas planas).** `[DESIGN]` Tres ramos, escolha de 1 por
braseiro, empilhavel ao longo da descida; custos em Fagulha-moeda:

| Ramo | Dadiva | Efeito | Custo |
|---|---|---|---|
| Agressao | Golpista | +12% dano melee | 8 |
| Agressao | Queimador | ember aplica Queimadura por 5 s (em vez de 3) | 9 |
| Agressao | Sede da Brasa | golpe cura 10% do dano causado | 10 |
| Defesa | Revestimento | dano recebido > 20 e reduzido a 20 | 10 |
| Defesa | Fagulha Perene | +1 carga de Fagulha a cada 15 s em combate | 9 |
| Defesa | Folego | +20 stamina max, esquiva no vazio devolve 30 stamina | 8 |
| Utilidade | Luz da Acendedora | +3 m de raio de luz (le flancos, inimigos mais visiveis) | 7 |
| Utilidade | Ressonancia | 3 acertos sem errar: proximo ataque 50% mais rapido | 9 |
| Utilidade | Braseiro Quente | acender o braseiro cura 50% (em vez de 25%) | 8 |

Curadoria: o braseiro oferece 3 opcoes, nunca 3 do mesmo ramo, sempre 1 ofensiva e 1 defensiva.
Mantem a "Lasca de Brasa" gratis para nunca travar. Sinergia-exemplo: Golpista + Queimador + Sede
= build de queimadura agressiva com sustain.

**Moveset e sinergias.** Manter os 5 verbos (leve combo 3, pesado, esquiva, bloqueio, ember).
Adicionar profundidade SEM novos botoes via Ressonancia (recompensa nao errar) e via Queimadura
(recompensa ember na turba). Ramo opcional Parry destravavel por dadiva pos-slice.

**DoD 3.1:** Fagulha em cargas no HUD; Queimadura aplica, tica e expira com VFX; arvore de 9
dadivas curada no braseiro; pelo menos 1 sinergia visivel em playtest.

### 3.2 Inimigos e o chefe

**Tabela canonica (ratificar o codigo).** `[CÓDIGO]`+`[DESIGN]` Documentar os 10 tipos com stats,
tell e som. Exemplo do nucleo (preencher os demais no spec do bestiario):

| Tipo | HP | Vel (m/s) | Dano | Tell (startup) | Som de tell | Recompensa |
|---|---|---|---|---|---|---|
| minion | 30 | 3.2 | 8 | 0.5 s overhead | swish agudo | 3 |
| warrior (guarda) | 60 | 2.4 | 16 | 0.6 s overhead | swish + bronze ao erguer | 4 |
| rogue | 42 | 3.7 | 11 | 0.4 s investida | corte rapido | 4 |
| heavy (guarda) | 130 | 1.5 | 28 | 1.0 s golpao | THOOM grave | 8 |
| conjurador (ranged) | 70 | 1.8 | 14 | 0.9 s mira | assobio frio | 10 |
| espreitador (skirmisher) | 40 | 4.2 | 12 | 0.3 s dash | sopro | 6 |

**Lacuna real: assinatura SONORA por tell.** `[DESIGN]` Cada tipo precisa de som unico (a sala
e escura/azul; a leitura nao pode depender so de cor). Tabela de som de tell por tipo entra no
bestiario e na biblia de audio.

**Matriz de composicao por sala.** `[DESIGN]` `[NORMATIVO]` Hoje `DESCENT` so define quantidade.
Definir COMPOSICAO e formacao por sala:

| Sala | Tipos | Formacao | Ensina |
|---|---|---|---|
| 1 guarda | 1-2 minion | solta | ler tell, punir |
| 2 salao | 3 minion + 1 warrior | warrior na frente | flanquear a guarda |
| 3 cisterna | 2 minion + 1 conjurador | conjurador em pilar | cobertura, matar o atirador |
| 4 salao | 4 minion + 1 heavy | heavy escolta | paciencia, abrir janela |
| 5 santuario | respiro: 0-1 + dadiva | - | recompensa marcada |
| 6 cisterna | 3 minion + 1 espreitador + 1 conjurador | emboscada | pressao + area (ember) |
| 7 guardiao | Guardiao | duelo | climax |

Regras: max 1 heavy por sala comum; conjurador sempre com cobertura; nao repetir guarda dupla.

**Chefe Guardiao: somar a gangorra de luz ao que ja existe.** `[CÓDIGO]` Ja tem 3 fases por vida +
movesets (overhead, varredura, sopro de escuro AoE). `[DESIGN]` Adicionar a mecanica-assinatura
(spec-chefe-guardiao 4) que falta:
- A Brasa central tem 3 estagios (forte / bruxuleando / morta). O **Sopro de escuro** do Guardiao
  apaga 1 estagio. A heroina pode **reacender** (canalizar 1.5 s perto da Brasa, parada, cancela se
  tomar dano): sobe 1 estagio, devolve 30 stamina, e CAMBALEIA o Guardiao por 0.8 s (lento, nao
  ataca, gume aquecido), abrindo dano x1.5-2.0.
- Quanto mais forte a Brasa, mais lento/legivel o Guardiao; quanto mais apagada, mais rapido e
  escuro (tells -15% a -22%). A fase por vida e a gangorra por luz se somam.
- Feedback do cambaleio `[NORMATIVO]`: estouro laranja + som agudo de "cega" + screenshake leve.

Padroes ratificados (frames por estagio, fria -> escuro), ja parcialmente no `guardiao.ts`:
overhead 1.0->0.7 s startup, dano 26->30; varredura 0.6->0.45 s; gancho 0.5->0.35 s (puxa, quebra
guarda); sopro 0.9->0.6 s (apaga 1 estagio, recovery longa 1.0 s = janela de reacender). Duelo alvo
~90 s (fase1 ~35, fase2 ~32, fase3 ~23). Vida ~340.

**DoD 3.2:** bestiario documenta 10 tipos com stats+tell+som; matriz de composicao aplicada no
`DESCENT`; Guardiao ganha gangorra de luz (reacender + cambaleio + feedback) somada as fases atuais.

### 3.3 Historia e narrativa (encenada, nao so texto)

**Lore fechado** (ver Parte 2): frio natural, Brasa alimentada por guarda viva, mortos = o povo,
Guardiao = Primeira Acendedora, heroina = Cinza movida por Marta.

**Beats por andar** `[DESIGN]` `[NORMATIVO]` (cada sala carrega 1 revelacao, encenada por inscricao
+ eco + visual, sem cutscene pesada):

| Andar | Revelacao | Encenacao na sala |
|---|---|---|
| 1 guarda | os mortos sao o povo | inscricao com nomes nos bancos; um tumulo arrombado |
| 2 salao | alguem desceu antes | manto rasgado de Acendedora, fagulha apagada no chao |
| 3 cisterna | duvida sobre a origem | eco contradiz: "ela ja estava aqui quando desci" |
| 4 salao | o custo: a Brasa pede sangue | inscricao da Primeira confessando a escolha |
| 5 santuario | luto / respiro | restos de duas Acendedoras: uma voltou (ossos na porta), outra desceu mais |
| 6 cisterna | a verdade se monta | tres ecos sobrepostos, a Brasa ja visivel ao fundo |
| 7 guardiao | confronto | o Guardiao fala uma frase antes de atacar; ao cair, sussurra a verdade |

**Encenacao in-game (o que falta no codigo):**
- Inscricoes: texto curto gravado na pedra, lido por proximidade (prompt discreto). Estilo no guia
  de estilo (fragmentario, imperativo ou lamento, uma linha).
- Ecos: audio reverberado + legenda no HUD ao entrar em certos andares (acessibilidade).
- Confronto do chefe: evento de combate (frase antes de atacar, sussurro ao morrer) que injeta
  narrativa sem tirar o controle.
- A Voz do Poco (Marta): audio na superficie marcando o tempo. A cada braseiro aceso, ela relata o
  frio recuando. Cria urgencia. `[A DEFINIR]` se entra inteira no slice ou so 2-3 falas-chave.

**DoD 3.3:** cada andar tem 1 inscricao + (quando previsto) 1 eco legendado; o confronto do chefe
tem frase de entrada e sussurro de morte; o codex referencia os beats descobertos.

### 3.4 Personagens

**Cinza (a Acendedora).** Nome proprio; voz quase muda, com 1 frase rara por andar (ex.: "Outro
braseiro. Mais um andar."). Visual: usa Rogue_Hooded (capuz casa com o tom consumido). Linguagem
corporal cansada mas firme.

**Marta (a Voz do Poco).** Mentora idosa, Acendedora da geracao passada, morrendo do frio na
superficie. So audio. Arco: marca o tempo acima; se a heroina falhar/demorar, sua voz enfraquece.
Da moldura emocional e urgencia sem cutscene.

**O Guardiao (a Primeira).** Ficha antes/depois/agora (ver 2.1). Antes: Acendedora que venceu.
Sacrificio: ficou presa na Brasa. Agora: corpo consumido pelo fogo eterno, espera libertacao ou
sucessora. Frase de entrada e sussurro de morte escritos (ver guia de estilo para o tom).

**Vozes do passado (ecos).** 3-4 arquetipos com frase-assinatura: a Primeira ("Enquanto a Brasa
arder, havera manha."), a que Falhou ("Eu nao consegui voltar."), a Cartografa ("O mapa e a
pedra."), a Ultima-antes-de-voce ("Se vires minha fagulha apagada, sabe que nao voltei.").

**DoD 3.4:** fichas escritas em `personagens.md` (nome, voz, frases-assinatura); strings de Cinza,
Guardiao e Marta no `strings.ts`; codex atualizado.

### 3.5 Ambientacao: chao, teto, paredes, atmosfera (foco do pedido)

**Teto (gap real - hoje as salas sao abertas).** `[DESIGN]` `[NORMATIVO]`
- Pe-direito por profundidade: raso 4 m (opressivo), medio 6-7 m (abobada), fundo 8-10 m
  (monumental, Brasa pequena la embaixo). Usa `crypt_vault`/`crypt_ceiling` do KayKit.
- Peca nova leve `crypt_stalactite` (50-100 tris) usada com parcimonia (2-4 por camara funda).
- Gotejamento: 1 particula lenta (1 gota / 3-5 s) + som de pingo, em 2-4 pontos da cisterna.
- `crypt_opening`: vao no teto de salas com pre-camara abaixo, deixa ver o andar de baixo no escuro
  (profundidade por visual direto, sem renderizar a sala inteira).
- Vertex color de umidade (musgo) nas faces baixas da abobada das cisternas.

**Chao (hoje xadrez unico).** `[DESIGN]`
- 3 variantes por zona: raso (clara, entulho, pegadas), medio (sedimento, junta visivel), fundo
  (escura, padrao ritual gravado em relevo baixo).
- Decalques por tipo de sala: poca/lodo na cisterna (com "linha" de agua historica), circulo ritual
  no santuario, rachaduras irradiando do centro na camara do Guardiao.
- Vertex color de desgaste: canto mais escuro, trilha central mais clara onde se pisa.

**Paredes.** `[DESIGN]`
- 3 superficies por zona (bruta clara / regular escura / ritual com acanalados).
- `crypt_wall_niche`: parede com vao raso (mesma malha, vao cortado) para quebrar a superficie plana
  e abrigar ossada/bau/inscricao. 1-2 por camara.
- Inscricoes em relevo (groove baixo) ou decal com normal map no fundo.

**Coreografia frio->quente (hoje so a luz cresce).** `[DESIGN]` `[NORMATIVO]` Documentar e
implementar a ordem espacial: a PointLight do braseiro nasce no chao, entao a luz quente sobe na
ordem piso -> parede baixa -> abobada (~0.8 s). A sala "respira" de baixo para cima. Sombras das
colunas se alongam. E coreografia, nao so lerp de cor.

**Identidade visual por tipo de sala.** `[DESIGN]` Cada sala le diferente por topografia, nao so por
props: guarda = quadrada, apertada, teto baixo, chao de entulho; cisterna = monumental, pilares
ritmados, agua sugerida, gotejamento; santuario = axial/simetrica, foco central quente, limpa;
camara do Guardiao = arena vazia de props, teto altissimo, chao rachado, so a Brasa e os pilares.

**Paleta por andar.** `[DESIGN]` Trocar SLOT de material (nao a malha) por zona: 3 versoes de atlas
(raso claro / medio / fundo ritual) reaplicadas em `crypt_wall`/`crypt_floor`/`crypt_pillar`. Custo
baixo (3 atlas, nao 27).

**DoD 3.5:** salas reais tem teto com pe-direito por zona; chao tem >=2 variantes + decalque por
tipo de sala; >=1 `crypt_wall_niche` por camara media; coreografia de luz de baixo para cima visivel;
draw calls por sala continuam < 60.

### 3.6 Progressao, economia e rejogabilidade

**Matriz de economia (validar o "nunca trava").** `[DESIGN]` Documentar PF esperado por andar x
custo das dadivas para garantir 2-3 compras por run e nenhum beco de progresso. Tabela-base:

| Andar | PF esperado | Oportunidade |
|---|---|---|
| 1 | 10-15 | braseiro |
| 2 | 12-20 | braseiro + bau opcional |
| 3 | 15-25 | braseiro + cura |
| 4 | 0 + escolha | santuario (dadiva) |
| 5-6 | 20-30 | braseiro + bau |
| Total | ~55-115 | ~2-3 dadivas (custo 7-11 cada) |

**Rejogabilidade (hoje: so refazer com outro build).** `[DESIGN]` Adicionar barato:
- Modificador por seed: mesma planta, posicoes de inimigo variam; ordem das dadivas ofertadas varia;
  bonus "do dia" (ex.: +10% PF, -10% dano recebido).
- Leaderboard local de speedrun (top 5 tempos de descida vencida), offline.
- Meta-progressao leve (pos-slice): "Brasa retida" entre runs destrava 1-2 upgrades permanentes.

**Tipos de sala alem de "mate todos"** (pos-slice): sala de evento (escolha de risco), sala de
desafio (sobreviver a ondas por dadiva extra), sala de descanso.

**DoD 3.6:** matriz de economia no spec; seed por run muda posicoes e ofertas; leaderboard local
de tempo.

### 3.7 UI, HUD, audio e game feel

**Feedback positivo de combate (gap).** `[DESIGN]` Hoje so ha vinheta de dano. Adicionar: flash
breve de borda dourada no acerto sem dano; brilho verde + harmonico na cura; tintado de bronze no
bloqueio bem-sucedido; barra de vida pisca no critico. ~200 ms, sempre som + visual.

**HUD da Fagulha em cargas + estado da sala.** Cargas discretas (3 pips) em vez de barra; indicador
sutil de estado da sala (selada/limpa/acesa).

**Audio (hoje so ambience de titulo).** `[DESIGN]` Trilha adaptativa por sintese WebAudio (sem
samples pesados): `bed_frio` (drone 55/220 Hz + reverb por delay), `combat` (pulso ~60 Hz), `bed_quente`
(crossfade log 0.8-1.2 s ao acender). 3 leitmotifs curtos (Brasa ascendente, Descida descendente que
transpoe a cada porta, Guardiao grave). SFX por acao com assinatura por tipo de inimigo (ver 3.2).
Teto de ~16 vozes. Stingers: despertar dos mortos, fagulha pega, avistar Guardiao, reavivar a Brasa.

**Acessibilidade.** Forma+icone+texto (nao so cor); 3 modos de daltonismo; legendas para ecos/SFX
narrativos; reduzir flashes.

**DoD 3.7:** feedback positivo de acerto/cura/bloqueio; Fagulha em cargas no HUD; pelo menos
`bed_frio` + `bed_quente` + 4 SFX de combate + 2 stingers tocando; legendas para ecos.

---

## 4. Roadmap em ondas

Ordem por dependencia. Cada onda tem trabalho de DOC e de CÓDIGO e um DoD. As ondas W1-W3 sao o
nucleo da "profundidade"; W4-W6 sao textura, alma e retencao. Esforco relativo entre parenteses.

### W1 - Fechar o canon (doc; rapido) (1x)
- Aplicar a Parte 2 nos docs: identidade do Guardiao, nome+motivacao de Cinza, final, lore-raiz,
  escopo. Marcar como `[NORMATIVO]`.
- Atualizar `narrativa-e-historia.md`, `projeto-brasa.md`, `personagens.md` (cuidado: arquivo em
  edicao do usuario; coordenar).
- **DoD:** nenhum `[A DEFINIR]` critico de canon aberto; Ato III tem verdade definida.

### W2 - Combate com profundidade (codigo + doc) (2x)
- Documentar Fagulha real e migrar para cargas (3) no HUD.
- Implementar status Queimadura (componente + tick + VFX).
- Substituir as 5 dadivas planas pela arvore de 9 (3 ramos) com curadoria.
- Atualizar `spec-combate.md` e `spec-progressao-e-economia.md` com os numeros.
- **DoD:** 3.1 cumprido; combate sente mais profundo em playtest (sinergia visivel).

### W3 - Chefe Guardiao de verdade (codigo + doc) (2.5x)
- Somar a gangorra de luz ao `guardiao.ts` (estagios da Brasa, sopro apaga, reacender, cambaleio).
- Ratificar frames/dano por estagio; feedback de cambaleio (VFX+som+shake).
- Confronto encenado: frase de entrada + sussurro de morte.
- Atualizar `spec-chefe-guardiao.md` com numeros ratificados.
- **DoD:** 3.2 (parte chefe) cumprido; duelo ~90 s com a mecanica de luz legivel e satisfatoria.

### W4 - Ambientacao tatil: teto, chao, paredes (codigo + doc + asset leve) (2.5x)
- Implementar teto com pe-direito por zona; `crypt_stalactite`, gotejamento, `crypt_opening`.
- Chao: 2-3 variantes por zona + decalques por tipo de sala; vertex color de desgaste.
- `crypt_wall_niche`; 3 slots de material (paleta por andar); coreografia de luz de baixo para cima.
- Atualizar `biblia-ambientes.md`, `biblia-iluminacao.md`, `direcao-de-arte.md` com tabela de
  identidade por sala e tratamento de chao/teto/parede.
- **DoD:** 3.5 cumprido; draw calls < 60; as 5 plantas leem visualmente distintas.

### W5 - Encenacao narrativa (codigo + doc) (2x)
- Inscricoes por proximidade; ecos legendados por andar; matriz de composicao de inimigos no `DESCENT`.
- A Voz do Poco (Marta): 2-3 falas-chave que marcam o tempo ao acender braseiros.
- Atualizar `spec-set-pieces.md`, `narrativa-e-historia.md`, `personagens.md`, `codex.ts`.
- **DoD:** 3.3 e 3.4 cumpridos; cada andar tem 1 beat encenado; confronto do chefe injeta narrativa.

### W6 - Retencao, audio e polimento (codigo + doc) (2x)
- Audio adaptativo (bed_frio/combat/bed_quente + leitmotifs + SFX por tipo + stingers).
- Feedback positivo de combate; HUD de Fagulha em cargas + estado da sala.
- Seed por run (variacao de posicoes/ofertas) + leaderboard local de tempo.
- Atualizar `biblia-audio.md`, `spec-ui-hud-ux.md` (arquivo em edicao do usuario; coordenar).
- **DoD:** 3.6 e 3.7 cumpridos; jogo polido e com motivo para a 2a run.

---

## 5. Riscos e gates

- **Coordenacao com edicoes do usuario:** `personagens.md` e `spec-ui-hud-ux.md` estao em edicao no
  working tree. W1/W5/W6 tocam neles: combinar antes para nao haver conflito.
- **Retarget de animacao:** novos clipes (cambaleio do chefe, cast de ember) dependem do esqueleto
  KayKit/Quaternius. Validar cedo (gate de W3).
- **Vazamento de memoria no descarte:** medir heap de GPU ao trocar de sala, nao so draw calls
  (gate permanente, ja relevante por causa do teto novo).
- **Orcamento de leveza:** teto + decalques + particulas de gotejamento somam draw calls; medir por
  sala apos W4 (gate: < 60 draw calls, 60 fps desktop / 30 fps mobile).
- **Sintese de audio em mobile:** validar 16 vozes WebAudio + render Babylon a 30 fps antes de
  comprometer W6; fallback: stems pre-renderizados em Opus.

---

## 6. Indice das melhorias por documento de destino

Onde cada aprofundamento deve ser folheado quando virar spec definitiva:

- `spec-combate.md`: Fagulha em cargas, Queimadura, moveset/sinergias (3.1).
- `spec-progressao-e-economia.md`: arvore de dadivas, matriz de economia, rejogabilidade (3.1, 3.6).
- `biblia-bestiario.md`: tabela de 10 tipos com stats+tell+som, matriz de composicao (3.2).
- `spec-chefe-guardiao.md`: gangorra de luz, frames por estagio, confronto encenado (3.2).
- `narrativa-e-historia.md`: lore-raiz, beats por andar, encenacao (2.4, 3.3).
- `personagens.md`: Cinza, Marta, Guardiao, vozes do passado (3.4).
- `biblia-ambientes.md` / `biblia-iluminacao.md` / `direcao-de-arte.md`: teto, chao, paredes,
  coreografia de luz, identidade por sala, paleta por andar (3.5).
- `biblia-audio.md`: trilha adaptativa, leitmotifs, SFX por tipo, stingers (3.7).
- `spec-ui-hud-ux.md`: feedback positivo, HUD de cargas, estado da sala (3.7).
- `spec-set-pieces.md`: inscricoes, ecos, confronto encenado (3.3).
