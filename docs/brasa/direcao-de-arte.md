# Direção de Arte: Brasa

Direção de arte do jogo Brasa: a descida de uma Acendedora por um poço-cripta de pedra,
reacendendo braseiros para empurrar o escuro andar abaixo antes que a superfície
congele. Plataforma alvo: web 3D (navegador), com empacotamento Electron. Contexto de
produção: solo/indie. Ver o canon em [`projeto-brasa.md`](../projeto-brasa.md) e a régua
de detalhe em [`padrao-de-detalhe.md`](../padrao-de-detalhe.md).

Resumo executivo: a direção de Brasa é **low-poly estilizado coerente com o ecossistema
KayKit (CC0)**, lido pela ASSINATURA cromática frio-contra-quente: a cripta nasce azul,
fria e quase escura (morte, pedra úmida); a Acendedora a transforma em laranja-quente ao
acender o braseiro (vida, Brasa). A luz não é enfeite, é a personagem silenciosa e o
verbo do laço de jogo. Tudo é cor chapada e vertex color sobre formas geométricas
simples, com emissivo reservado ao fogo, dentro do orçamento técnico normativo da
seção 4 do canon (< 60 draw calls por sala). Realismo e PBR pesado estão fora de escopo:
quebram a leveza no navegador e o casamento de estilo com o KayKit.

Marcação herdada do canon: PROCEDÊNCIA `[DESIGN]` (decisão nossa), `[ASSET]` (procede de
pacote existente), `[CÓDIGO]` (observado no protótipo); EXIGÊNCIA `[NORMATIVO]` (entra no
aceite, verificável), `[ASPIRACIONAL]` (mood, não bloqueia), `[A DEFINIR]` (pendente).
Convenção de escrita: pt-BR, sem travessões, sem emojis.

Snapshot: 2026-06-14.

---

## 1. Pilar visual: low-poly KayKit, legível e barato no navegador

`[DESIGN]` `[NORMATIVO]` Brasa adota um único registro: **low-poly estilizado de cor
chapada**, o mesmo idioma dos pacotes KayKit de Kay Lousberg que já entraram no projeto
(`Mage.glb`, `Rogue_Hooded.glb`, `AnimationLibrary_Godot_Standard.gltf`). A escolha não
é estética por capricho: é o eixo que satisfaz simultaneamente os pilares de design do
canon (seção 2): rodar leve no navegador, construir com o que já existe, entregar um
slice completo.

Por que low-poly KayKit e não outra coisa:
- **Peso na web:** o mais leve possível. Geometria de centenas a poucos milhares de tris
  por ator, atlas único por pacote, vertex color no lugar de mapas grandes. Casa direto
  com o teto de < 60 draw calls por sala.
- **Já existe pronto e coeso:** o elenco (Acendedora, esqueletos, Guardião) e o cenário
  (cripta modular, braseiros, baús, barris, tochas) vêm de pacotes CC0 num só estilo, com
  esqueleto e biblioteca de animação compartilhados. O trabalho de direção de arte é
  **curar, iluminar e colorir**, não esculpir.
- **Envelhece bem:** cor chapada e silhueta forte não dependem de fidelidade de textura;
  não "parecem datadas" como um PBR de orçamento baixo pareceria.

`[ASPIRACIONAL]` O risco do low-poly barato é parecer barato. A defesa não é mais
polígono nem mais textura: é **direção de cor e de luz**. Um cubo de pedra cinza vira
cripta opressora quando a luz é fria e rasante; o mesmo cubo vira refúgio quando o
braseiro o lambe de laranja. A seção 4 trata a luz como o investimento de qualidade que
substitui o orçamento de geometria.

`[DESIGN]` Mood em uma frase: **mítico, sóbrio, melancólico mas com esperança.** Não é
terror de susto nem dungeon crawler cínico; é a solenidade de descer a um lugar antigo
que está apagando, carregando a última fagulha.

---

## 2. A assinatura cromática: frio-azul contra laranja-quente

`[DESIGN]` `[NORMATIVO]` A identidade visual de Brasa É o contraste de temperatura. Toda
sala existe em dois estados e a transição entre eles é o clímax visual do laço:

- **Estado FRIO (sala selada, mortos despertando):** dominância azul-acinzentada, valor
  baixo, saturação baixa. Morte, escuro, pedra úmida, ausência da Brasa.
- **Estado QUENTE (braseiro aceso, sala limpa):** o laranja invade a partir do braseiro;
  o azul recua para as bordas e sombras. Vida, calor, a Brasa empurrando o escuro abaixo.

A regra de ouro cromática: **azul e laranja quase nunca aparecem na mesma saturação ao
mesmo tempo.** Quando a sala é fria, o laranja só existe como a fagulha que a Acendedora
carrega (um único ponto quente num mar azul). Quando a sala é quente, o azul vira só a
memória nas frestas. É o jogo de gangorra que conta a história sem uma linha de texto.

### 2.1 Paleta normativa (valores HEX)

`[DESIGN]` `[NORMATIVO]` Estas são as âncoras de cor. Vertex color e materiais devem
ficar dentro destas gamas. Ferramentas de autoria e validação de cena conferem contra
elas.

Frio-azul (morte, escuro, pedra úmida) - dominante no estado selado:
- Azul-cripta profundo (ambiente/fog da sala fria): `#0E1A2B`
- Azul-ardósia (sombra de pedra): `#1F3247`
- Azul-aço frio (luz fria de preenchimento, rim azulado): `#3E5C7E`
- Ciano-espectral (brilho dos olhos/runas dos mortos, gélido): `#5FB7C9`

Laranja-quente (Brasa, braseiro aceso, fagulha) - dominante no estado aceso:
- Laranja-brasa núcleo (centro do fogo, emissivo mais intenso): `#FF7A1A`
- Âmbar-chama (corpo da chama, luz quente da sala): `#FFA63D`
- Ouro-fagulha (realce, partículas, ponta da faísca): `#FFD27A`
- Vermelho-tiço (base do braseiro, brasa que esfria nas bordas): `#C8401C`

Pedra (a cripta modular KayKit, neutra que recebe a temperatura da luz):
- Pedra-base média: `#6B6660`
- Pedra-clara (faces iluminadas, degradê superior em vertex color): `#8A847C`
- Pedra-escura (juntas, base, oclusão pintada): `#43403B`
- Musgo/úmido (acento esverdecido raro em pedra molhada): `#4A5A47`

Esqueleto e mortos:
- Osso-base: `#D8CFB8`
- Osso-encardido (sombra, sujeira nas cavidades): `#A39A82`
- Tecido apodrecido (mortalha, capuz): `#3A3530`

Metal (armas, fechos, partes do Guardião):
- Ferro frio (lâmina/elmo no estado frio): `#5A6470`
- Bronze patinado (detalhe antigo, braseiros, fechaduras): `#7A5A2E`
- Realce de metal aquecido (gume pegando a luz do braseiro): `#C98A3A`

Sangue e poeira (combate, ambiente):
- Sangue-seco (impacto, respingo low-poly): `#6E1B16`
- Poeira/cinza (partícula de impacto, chão pisado): `#7C746A`

`[A DEFINIR]` Verificar os HEX exatos da pedra e do osso contra os atlas reais dos
pacotes KayKit Dungeon e Skeletons após o download; ajustar as âncoras para casar com o
atlas em vez de repintar (preservar atlas é normativo na seção 4.5 do canon). As gamas de
fogo e de fog/luz, por serem nossas (luz e emissivo, não atlas), ficam fixas.

`[ASPIRACIONAL]` Os santuários do braseiro (recompensa) podem permitir um único acento de
cor fria saturada (ciano-espectral) como "presença" antiga e sagrada, para diferenciar o
ritmo desses andares sem quebrar a regra da gangorra.

---

## 3. Linguagem de silhueta

`[DESIGN]` `[NORMATIVO]` Em low-poly de cor chapada, a silhueta carrega quase toda a
leitura. Cada classe de elemento precisa ser reconhecível em preto sólido, em movimento,
a média distância e sob luz baixa (a cripta é escura por design).

- **Acendedora (herói):** silhueta vertical, esguia, com um único ponto de assimetria
  reconhecível: a fagulha/fonte de luz que ela carrega (tocha, lampião ou mão acesa). Em
  preto, lê-se "pessoa de pé com uma luz". KayKit Mage (capuz, cajado) ou Rogue Hooded
  (capuz, silhueta enxuta) servem; a presença da luz é o que a torna a Acendedora.
- **Esqueletos (inimigo comum):** silhueta angular, vazada, "lacunosa": espaços entre os
  ossos quebram o contorno e os distinguem de um humano vivo mesmo em preto. Variantes
  por arma (espada, escudo, arco, lança) e por porte, todas sobre o mesmo esqueleto e
  animação compartilhados.
- **Guardião (chefe):** silhueta maior, mais larga e mais pesada que qualquer inimigo
  comum, com uma marca de fase legível no contorno (porte, arma grande, ou braseiro
  apagado embutido). Tem que dar para dizer "isto é o chefe" antes de ver qualquer cor.
- **Props da cripta:** o braseiro é a silhueta mais importante do jogo e precisa gritar
  "acenda-me": tigela elevada sobre pedestal, lida instantaneamente como ponto focal e
  alvo de interação, distinta de baús (caixa baixa), barris (cilindro), tochas de parede
  (haste curta na parede) e da porta de pedra (retângulo selável). Cada prop interativo
  tem silhueta diferente dos decorativos.

### 3.1 Teste de silhueta em preto `[NORMATIVO]`

Critério verificável: renderizar cada ator e cada prop interativo em preto chapado sobre
fundo neutro. Aprova se um observador identifica a classe (Acendedora / esqueleto /
Guardião / braseiro / porta / baú) sem cor nem textura. Esqueletos não podem ser
confundidos com a Acendedora; o braseiro não pode ser confundido com baú ou barril; o
Guardião não pode ser confundido com um esqueleto comem aumentado. Reprovou, ajusta-se
porte, pose-base ou acessório de silhueta antes de seguir.

---

## 4. A luz como direção de arte

`[DESIGN]` `[NORMATIVO]` A luz é o sistema artístico central de Brasa e o verbo do laço.
Ela faz o trabalho de qualidade que o orçamento de geometria não paga.

### 4.1 A sala nasce fria e escura

- `[NORMATIVO]` Toda sala de jogo carrega no **estado frio**: luz ambiente baixa e
  azulada (gama `#0E1A2B` a `#3E5C7E`), uma única luz-chave fria e rasante que esculpe os
  volumes de pedra e deixa os cantos no escuro. A leitura emocional é opressão e
  ausência. O jogador entra e os mortos despertam nesse breu azul.
- `[NORMATIVO]` A fagulha que a Acendedora carrega é o único ponto quente no estado frio:
  um pequeno halo laranja (`#FFA63D`) que viaja com ela, suficiente para combater por
  perto sem dissolver a tensão do escuro. É a promessa visual do que virá.

### 4.2 O braseiro aceso transforma a sala

- `[NORMATIVO]` Acender o braseiro é a transição mais importante do jogo: a luz quente
  (`#FFA63D` chave, `#FF7A1A` no núcleo) cresce a partir do centro, o ambiente azul recua,
  os volumes de pedra ganham faces quentes e sombras longas e vivas. A sala "respira" e
  vira refúgio. A recompensa (recurso/upgrade) e a abertura da porta acompanham essa
  virada para que o jogador associe luz a progresso.
- `[ASPIRACIONAL]` A transição é animada, não instantânea: a luz cresce em ~1-2 s com a
  chama, como fogo pegando de verdade. O contraste antes/depois é o "momento foto" de
  cada sala.

### 4.3 Custo e regra técnica `[NORMATIVO]`

Herda a seção 4.4 do canon, dito como direção de arte:
- No máximo **1-2 luzes dinâmicas por sala**. Padrão: 1 luz-chave da sala (pode projetar
  sombra) + 1 luz pontual do braseiro (sombra DESLIGADA), seguindo o padrão já usado em
  `gilgal.ts:259-266` e `gilgal.ts:324-330`.
- O fogo é vendido por **material emissivo + partículas + a luz pontual**, não por
  iluminação realista. Emissivo carrega a cor mesmo quando a luz está barata.
- Sem skydome e sem terreno aberto: a cripta é fechada, então não há sol nem céu para
  iluminar; toda luz é interna e motivada por braseiro, tocha ou fagulha.

### 4.4 Leitura de profundidade no poço

`[DESIGN]` `[ASPIRACIONAL]` A ficção é uma descida a um poço fundo demais para a luz do
sol. A direção de arte vende essa profundidade:
- Quanto mais fundo o andar, mais frio e escuro o estado-base da sala, e mais o azul
  domina antes de acender. O fundo do poço (andar do Guardião) é o mais gélido.
- Quando útil, mostrar verticalidade: aberturas, frestas ou poços internos por onde o
  olhar (ou um fio de luz) cai para o andar de baixo, reforçando "estou descendo".
- `[NORMATIVO]` Mesmo aspiracional o mood, vale a regra dura: nenhuma dessas leituras de
  profundidade pode introduzir uma terceira sala carregada nem estourar o teto de luzes
  e draw calls. Profundidade é pintada com fog, valor e enquadramento, não com geometria
  extra carregada.

---

## 5. Materiais e shading low-poly

`[DESIGN]` `[NORMATIVO]` Um só vocabulário de material para o jogo inteiro, casando com
os atlas KayKit:

O que FAZER:
- **Cor chapada / flat e vertex color.** A cor vem do atlas do pacote e de vertex color
  para degradês baratos (face superior da pedra mais clara, base mais escura, oclusão
  pintada nas juntas). Vertex color é praticamente de graça em performance e é o que dá
  "calor" e "frio" sem textura nova.
- **Normal suave / shading liso** nos volumes low-poly; nada de microdetalhe. A forma já
  é a informação.
- **Emissivo APENAS para o fogo e o que brilha por conta própria:** núcleo do braseiro,
  chama, fagulha da Acendedora, runas/olhos espectrais dos mortos (ciano `#5FB7C9`), gume
  metálico só quando deve "pegar" a luz do braseiro. Emissivo é o recurso premium da
  paleta; usar com parcimônia para que o fogo seja sempre o ponto mais quente da tela.
- **Atlas único por pacote**, um material por atlas, para instanciar peças e inimigos sem
  multiplicar draw calls.

O que NÃO fazer:
- `[NORMATIVO]` **Sem PBR pesado:** nada de metalness/roughness com mapas grandes,
  parallax, microsuperfície ou reflexos de tempo real. Quebra a leveza e brigam com o
  estilo chapado do KayKit.
- **Sem realismo:** nada de fotogrametria, materiais físicos calibrados, subsurface, etc.
- **Sem texturas 2K/4K novas por asset:** o atlas do pacote basta; textura nova só por
  exceção registrada `[A DEFINIR]`.
- **Sem mistura de estilos:** nenhum asset realista, nenhum cartoon de outro registro,
  nenhum pacote de estilo divergente entra na cena. Coerência de estilo é normativa.

`[NORMATIVO]` Todo `.glb` novo passa por `optimize_asset.py` + `validate_gltf.py` (skill
blender-python): escala aplicada, Y-up, dentro do teto de tris da seção 4.2 do canon,
atlas preservado, KTX2/Basis + Draco quando compensar.

---

## 6. Referências de mood (em palavras)

`[ASPIRACIONAL]` Painel descrito sem depender de links externos. Servem de bússola de
sensação, não de cópia.

- **A descida com uma única luz no escuro.** A imagem-mãe: uma figura pequena segurando
  fogo, descendo uma escada de pedra para o breu azul, com o calor desenhando só o que
  está perto dela. Tudo o que está fora do alcance da luz é insinuado, não mostrado.
- **O braseiro que devolve a sala à vida.** O instante em que um espaço morto e azul vira
  laranja vivo, sombras dançando nas paredes de pedra. A memória de uma fogueira numa
  noite fria, ampliada a sagrado.
- **Pedra antiga, úmida, esquecida.** Cripta abaixo do alcance do sol: juntas escuras,
  musgo raro, ferro frio, bronze patinado. Solene, não imundo; antigo, não gótico
  carregado.
- **Os mortos que pertencem ao escuro.** Silhuetas vazadas de osso com um único brilho
  ciano-gélido nos olhos, lendo "errado" e frio contra qualquer calor. Ameaça pela
  ausência de vida, não pelo gore.
- **Esperança contida.** O tom geral é melancólico, mas cada braseiro aceso é uma
  pequena vitória de luz. A paleta nunca é desesperadora: o laranja sempre pode voltar.

`[ASPIRACIONAL]` Famílias de sensação de jogos/obras (referência de tom, não de cópia de
asset): a solenidade de luz e silhueta de Journey; a melancolia de descer um lugar antigo
que apaga; o aconchego perigoso de uma fogueira como único ponto seguro num mundo frio.

---

## 7. Coerência com os assets KayKit (tudo do mesmo mundo)

`[ASSET]` `[NORMATIVO]` Para que Acendedora, esqueletos, Guardião e cripta pareçam do
mesmo mundo, e não um Frankenstein de pacotes, regras de coerência:

- **Mesma escala e proporção.** Todos os humanoides usam o mesmo esqueleto e a mesma
  biblioteca de animação KayKit (`AnimationLibrary_Godot_Standard.gltf`); a proporção
  estilizada (cabeça relativamente grande, membros simplificados) é a do pacote, mantida
  em todos os atores. Props e arquitetura na grade modular do Dungeon Kit.
- **Mesma densidade de polígono e de detalhe.** Não misturar uma peça muito mais
  detalhada com o resto chapado. Se uma peça de reforço (Kenney/Quaternius) destoar em
  densidade ou estilo, ela é reduzida/repintada para o registro KayKit antes de entrar,
  ou não entra.
- **Mesma família de material.** Todos sob o vocabulário da seção 5: cor chapada, atlas
  único, emissivo só no fogo. A unidade vem da luz e da paleta (seção 2), que envolvem
  tudo na mesma temperatura por sala.
- **KayKit primeiro, reforço só por necessidade.** Fonte primária KayKit (Adventurers,
  Skeletons, Dungeon Remastered). Kenney (Dungeon/Castle Kit) e Quaternius (Ultimate
  Monsters) só entram para tapar buraco de peça específica, sempre alinhados ao estilo.
- **A cor é nossa camada de unidade.** Mesmo com pacotes diferentes, a luz fria/quente e
  o fog por sala (autoria nossa, não do atlas) banham tudo na mesma assinatura cromática.
  É a costura que faz pacotes distintos lerem como um só mundo.

`[A DEFINIR]` Confirmar a heroína (KayKit Mage com cajado vs. Rogue Hooded com silhueta
enxuta) e como a fagulha/fonte de luz é anexada ao modelo (mão, tocha, ou prop separado).
Critério de desempate: qual silhueta carrega melhor a luz e passa no teste da seção 3.1.

---

## 8. Checklist de aceite (Definition of Done)

`[NORMATIVO]` Cada item recebe sim/não honesto. `[ASPIRACIONAL]` orienta mas não bloqueia;
`[A DEFINIR]` em aberto impede o "pronto" ou vira adiamento registrado.

Estilo e coerência
- [ ] Toda a cena de jogo está em um único registro low-poly de cor chapada coerente com
      KayKit; nenhum asset realista, PBR pesado ou de estilo divergente aparece. [DESIGN][NORMATIVO]
- [ ] Todos os humanoides (Acendedora, esqueletos, Guardião) compartilham esqueleto e
      biblioteca de animação KayKit, na mesma escala e proporção. [ASSET][NORMATIVO]
- [ ] Pacotes de reforço (Kenney/Quaternius), se usados, foram reduzidos/repintados ao
      registro KayKit antes de entrar. [ASSET][NORMATIVO]

Assinatura cromática (HEX)
- [ ] A paleta da seção 2.1 está aplicada: frio-azul (`#0E1A2B`, `#1F3247`, `#3E5C7E`,
      `#5FB7C9`) e laranja-quente (`#FF7A1A`, `#FFA63D`, `#FFD27A`, `#C8401C`). [DESIGN][NORMATIVO]
- [ ] Pedra (`#6B6660`/`#8A847C`/`#43403B`), esqueleto (`#D8CFB8`/`#A39A82`), metal
      (`#5A6470`/`#7A5A2E`), sangue/poeira (`#6E1B16`/`#7C746A`) dentro das âncoras. [DESIGN][NORMATIVO]
- [ ] A regra da gangorra é visível: na sala fria o laranja existe só na fagulha; na sala
      acesa o azul recua para bordas/sombras. [DESIGN][NORMATIVO]
- [ ] HEX de pedra e osso conferidos contra os atlas reais do KayKit (ajustar âncora ao
      atlas, não repintar). [A DEFINIR]

Silhueta
- [ ] Teste de silhueta em preto (seção 3.1) aprovado para Acendedora, esqueleto, Guardião,
      braseiro, porta e baú; nenhuma classe confundível com outra. [DESIGN][NORMATIVO]
- [ ] A Acendedora tem um ponto de luz assimétrico reconhecível (a fagulha). [DESIGN][NORMATIVO]
- [ ] O braseiro lê instantaneamente como alvo de interação, distinto de baús/barris. [DESIGN][NORMATIVO]

Luz como direção de arte
- [ ] A sala carrega no estado frio (ambiente azul baixo, 1 luz-chave fria rasante) e os
      mortos despertam nesse breu. [DESIGN][NORMATIVO]
- [ ] Acender o braseiro transforma a sala em quente (azul recua, faces de pedra
      esquentam) e isso acompanha recompensa + abertura da porta. [DESIGN][NORMATIVO]
- [ ] Transição da luz animada em ~1-2 s ao acender. [ASPIRACIONAL]
- [ ] Profundidade do poço é pintada com fog/valor/enquadramento, sem carregar sala extra
      nem estourar tetos. [DESIGN][NORMATIVO]

Materiais e shading
- [ ] Materiais em cor chapada/vertex color, normal suave, atlas único por pacote. [DESIGN][NORMATIVO]
- [ ] Emissivo restrito a fogo, fagulha, olhos/runas espectrais e gume aquecido. [DESIGN][NORMATIVO]
- [ ] Nenhuma textura 2K/4K nova por asset fora de exceção registrada. [DESIGN][NORMATIVO]

Orçamento técnico (da seção 4 do canon)
- [ ] < 60 draw calls por sala carregada. [NORMATIVO]
- [ ] No máximo 1-2 luzes dinâmicas por sala; luz do braseiro com sombra desligada. [NORMATIVO]
- [ ] Tris por elemento dentro dos tetos da seção 4.2 do canon (peça modular 100-400; prop
      100-500; Acendedora 1k-5k; esqueleto 1k-3k; Guardião 3k-6k). [NORMATIVO]
- [ ] Cada `.glb` novo passou por `optimize_asset.py` + `validate_gltf.py` (escala, Y-up,
      atlas preservado, KTX2/Draco quando compensar). [NORMATIVO]
- [ ] 60 fps desktop / 30 fps mobile médio mantidos. [NORMATIVO]

Higiene
- [ ] Nenhum asset, prop ou paleta de Josué/deserto/bíblico aparece na cena de Brasa. [DESIGN][NORMATIVO]
- [ ] Sem travessões, sem emojis em qualquer texto exibido (guia de estilo 1.2). [NORMATIVO]
- [ ] Itens [A DEFINIR] (heroína e anexo da fagulha na seção 7; HEX vs. atlas na 2.1)
      resolvidos ou adiados com registro. [A DEFINIR]
