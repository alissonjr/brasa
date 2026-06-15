# Padrão de Detalhe e Definition of Done

Documento normativo de processo. Estabelece a RÉGUA TRANSVERSAL de detalhamento que
faltava ao conjunto de bíblias e specs: quão detalhado cada tipo de elemento precisa
ser, o que é obrigatório (entra no aceite) e o que é liberdade autoral. Resolve a
ambiguidade apontada na revisão de documentação: as bíblias DEMONSTRAVAM alto detalhe
em alguns domínios e ficavam vagas em outros, sem uma estratégia explícita.

Em caso de conflito sobre nível de detalhe e critérios de aceite, este documento
prevalece. Para grafia, voz e marcação de procedência, prevalece
[`guia-de-estilo-e-glossario.md`](guia-de-estilo-e-glossario.md).

Convenção de escrita: pt-BR, sem travessões (usar hífen, dois-pontos, vírgula ou
parênteses), sem emojis. Ver guia de estilo seção 1.2.

---

## 1. As duas marcações e como elas se combinam

A documentação já usa a marcação de PROCEDÊNCIA (de onde vem a afirmação):
- `[TEXTO]`: vem do Livro de Josué / Tanakh.
- `[HISTÓRICO]`: vem da arqueologia / contexto do Bronze tardio.
- `[DESIGN]`: decisão criativa nossa.

Este documento adiciona a marcação de EXIGÊNCIA (quanto a afirmação obriga a
implementação). Ela é ortogonal à de procedência: uma frase pode ser `[DESIGN]` e
`[NORMATIVO]` ao mesmo tempo.

- `[NORMATIVO]`: requisito. TEM que ser cumprido para o elemento ser aceito. Vai para o
  checklist de aceite (Definition of Done). Deve ser verificável (contável, mensurável
  ou visualmente inequívoco). Ex.: "Gilgal tem as doze pedras memoriais em círculo".
- `[ASPIRACIONAL]`: alvo de qualidade, mood ou intenção. Orienta, mas NÃO bloqueia o
  aceite e deixa liberdade ao autor/artista. Ex.: "a clareira deve transmitir lar e
  segurança". Não tente quantificar o inquantificável: mood fica aspiracional de
  propósito.
- `[A DEFINIR]`: lacuna conhecida que precisa de decisão autoral antes de virar
  normativo. É melhor marcar explicitamente do que fingir que está fechado. Toda
  ocorrência de `[A DEFINIR]` é uma tarefa pendente de decisão, não de implementação.

Regra de ouro: se algo é `[NORMATIVO]` mas não dá para verificar objetivamente, ou
reescreva para ser verificável, ou rebaixe para `[ASPIRACIONAL]`. Um checklist só vale
se cada item puder receber um "sim/não" honesto.

---

## 2. Régua de detalhe por tipo de elemento

Quão minucioso um elemento precisa ser depende do que ele é. A tabela abaixo é a régua.
Números entre `**negrito**` vêm de docs existentes (com a fonte citada); números marcados
`(proposta)` são defaults derivados do âncora mais próximo, pendentes de ratificação
autoral (tratar como `[A DEFINIR]` até confirmados); o resto é orientação de campo.

### 2.1 Orçamento técnico (alvo de performance)

Âncoras globais já documentados:
- Web: **60 fps desktop / 30 fps mobile médio**; **< 100 draw calls** por cena
  (`plano-de-producao.md` 165, `biblia-fauna-e-acampamento.md` 184).
- Estilo: low-poly estilizado quente; KTX2/Basis para textura, Draco para geometria,
  baked light onde der (`spec-prototipo-jerico.md` 247).
- Densidade (multidão, vegetação, props repetidos): thin instances / merge
  (`biblia-ambientes.md` 222, `biblia-fauna-e-acampamento.md` 170).

| Tipo de elemento | Tris-alvo | Origem do número | Detalhe mínimo exigido |
|---|---|---|---|
| Peça de muralha / fortificação (modular) | **~200-400** | `biblia-ambientes.md` 132 | grid de 4 m, vertex color para degradê, normal map suave |
| Casa / edificação | **~300-600** | `biblia-ambientes.md` 150 | grid de 2 m, agrupável em ilhas |
| Herói / personagem principal | **1k-5k** | `tecnica-anatomia-humana.md` 141 | topologia limpa, loops para deformar dobras |
| NPC nomeado | 1k-3k (proposta) | derivado do herói | silhueta reconhecível, rosto legível de perto |
| NPC de multidão / figurante | 300-800 (proposta) | derivado | reaproveitar base, variar por cor/atlas |
| Inimigo comum | 1k-3k (proposta) | derivado do herói | telegrafia legível na silhueta e na animação |
| Chefe | 3k-6k (proposta) | derivado | leitura de fases por silhueta/cor (ver spec do chefe) |
| Criatura de fauna (vista de longe) | **centenas** + LOD | `biblia-vfx-e-shaders.md` 142 | formas em planos limpos, não realismo anatômico |
| Tufo de grama / junco (card cruzado) | 20-80 (proposta) | derivado | cards em cruz, alpha-test, thin instance, sem colisor |
| Arbusto (cards) | 50-200 (proposta) | derivado | cards alpha-test, thin instance, sem colisor |
| Árvore comum instanciada (tamareira, oliveira) | 200-500 (proposta) + LOD | derivado de `biblia-ambientes.md` 211-224 | tronco low-poly + copa em cards alpha; thin instance; billboard ao longe |
| Árvore hero (carvalho/terebinto sagrado) | 600-1200 (proposta) + LOD | derivado | isolada (Mambré, Siquém), não instanciada em massa; colisor de tronco |
| Prop pequeno (jarro, tocha, banner) | 100-400 (proposta) | derivado | colisor quando sólido; cor chapada |
| VFX (partículas, shader de milagre) | orçamento de draw call, não de tris | `spec-set-pieces.md` 51 | parcimônia, telegrafia antes do estouro |

Os números `(proposta)` existem para a doc deixar de ser omissa: marque-os como decididos
quando o autor ratificar, ou ajuste. O ponto não é o número exato e sim que TODO tipo de
elemento tenha um teto explícito.

### 2.2 Campos mínimos por ficha (o que toda especificação de elemento deve conter)

| Domínio | Campos `[NORMATIVO]` na ficha |
|---|---|
| Local / cenário | gancho de gameplay; relevo; paleta (hex); dimensão aproximada (m); lista de props obrigatórios; condição de luz; checklist de aceite |
| Personagem (herói/NPC/inimigo) | papel; biotipo e medidas; paleta; silhueta (teste em preto); vestuário (link); moveset ou comportamento; voz (link guia de estilo) |
| Vestuário | peças enumeradas de dentro para fora; material; paleta (hex); como deforma (link tecnica-deformacao); tradução low-poly |
| Set piece | gatilho; participação do jogador; construção de tensão; técnica; critério de aceite |
| VFX | quando dispara; orçamento; leitura/telegrafia; fallback de performance |
| UI / HUD | estados; tipografia; acessibilidade; responsivo |
| Áudio | leitmotif/instrumentos; por cena; adaptativo; SFX-chave |

Onde uma ficha existente não tiver um desses campos, ou se preenche derivando do texto
que já existe, ou se marca `[A DEFINIR]`. Não deixar o campo simplesmente ausente: a
ausência silenciosa foi a causa de elementos saírem incompletos sem ninguém notar.

---

## 3. Template de ficha de elemento

Copiar e preencher ao documentar um elemento novo. Cada linha leva marcação de
procedência e de exigência.

```
### <Nome do elemento> (id: <id_snake_case>)
- Resumo [DESIGN]: o que é, em uma frase.
- Procedência: [TEXTO/HISTÓRICO/DESIGN] das afirmações abaixo.
- Orçamento técnico [NORMATIVO]: <tris-alvo>, colisor <sim/não/tipo>.
- Paleta [NORMATIVO]: <cores em hex>.
- Dimensão [NORMATIVO]: <medidas em m>.
- Elementos obrigatórios [NORMATIVO]: <lista contável>.
- Intenção / mood [ASPIRACIONAL]: <o que deve transmitir>.
- Pendências [A DEFINIR]: <decisões autorais que faltam>.
- Ver também: <links para bíblias/specs relacionadas>.
- Checklist de aceite: ver seção 4.
```

---

## 4. Template de Definition of Done (checklist de aceite)

Todo elemento ou cena implementável deve terminar com um checklist em que cada item é
um `[NORMATIVO]` verificável. Formato:

```
## Checklist de aceite (Definition of Done)
- [ ] <item verificável 1>
- [ ] <item verificável 2>
- [ ] Orçamento técnico dentro do alvo (tris e draw calls da seção 2.1).
- [ ] Sem travessões, sem emojis em qualquer texto exibido (guia de estilo 1.2).
- [ ] Itens [A DEFINIR] resolvidos ou explicitamente adiados com registro.
```

Regra: um elemento só está "pronto" quando todos os `[NORMATIVO]` do seu checklist
recebem "sim". `[ASPIRACIONAL]` não bloqueia o "pronto", mas vale como meta de
polimento. `[A DEFINIR]` em aberto IMPEDE o "pronto" (ou vira adiamento registrado).

Exemplo aplicado (Gilgal), para mostrar a régua funcionando. Ver a versão canônica e
mantida em [`spec-prototipo-jerico.md`](spec-prototipo-jerico.md):

```
## Checklist de aceite - Gilgal (hub do protótipo)
- [ ] Doze pedras memoriais em círculo, visitáveis (Js 4) [TEXTO][NORMATIVO]
- [ ] Tabernáculo + Arca presentes e tratados com reverência [TEXTO][NORMATIVO]
- [ ] Tendas por tribo (anel/fileiras) voltadas ao centro [DESIGN][NORMATIVO]
- [ ] Fogueiras (ao menos uma com luz quente) [DESIGN][NORMATIVO]
- [ ] Palmeiras de oásis na borda [HISTÓRICO][NORMATIVO]
- [ ] Currais presentes no hub [DESIGN][NORMATIVO]
- [ ] Ferreiro / armeiro presente no hub [DESIGN][NORMATIVO]
- [ ] Oráculo (Urim/Tumim) presente no hub [TEXTO][NORMATIVO]
- [ ] NPC Eleazar com diálogo de briefing [TEXTO][NORMATIVO]
- [ ] Terreno plano na clareira; Jericó visível ao longe (objetivo) [DESIGN][NORMATIVO]
```

---

## 5. Como as bíblias e specs se conectam a este padrão

- Cada bíblia/spec de elemento deve TERMINAR com uma seção "Checklist de aceite
  (Definition of Done)" no formato da seção 4, derivada do próprio conteúdo.
- Ao escrever conteúdo novo, marcar cada afirmação implementável como `[NORMATIVO]` ou
  `[ASPIRACIONAL]`, e cada lacuna como `[A DEFINIR]`.
- Este documento NÃO substitui as bíblias: ele dá a régua e os templates; o conteúdo
  específico continua em cada doc de domínio.

## 6. Status de adoção (o que já recebeu checklist)

Atualizar esta lista conforme as seções de aceite forem adicionadas aos docs:
- [x] biblia-ambientes (13 blocos: 11 locais + kit modular + vegetação como elemento)
- [x] spec-prototipo-jerico (Gilgal + frente de Jericó + fluxo + HUD)
- [x] spec-combate
- [x] spec-set-pieces (7 set pieces + transversal)
- [x] spec-chefe-rei-jerico
- [x] spec-chefe-jabim
- [x] biblia-vestuario
- [x] biblia-vfx-e-shaders (consolidou a antiga seção de critérios)
- [x] biblia-iluminacao
- [x] biblia-audio
- [x] biblia-fauna-e-acampamento
- [x] spec-ui-hud-ux
- [x] spec-progressao-e-economia
- [x] spec-fluxo-e-persistencia
- [x] personagens (líderes, apoio, antagonistas)

Pendentes de checklist próprio (cobertos indiretamente ou de natureza não-elemento):
tecnica-* (docs técnicos de referência), direcao-de-arte (decisão de estilo),
narrativa-e-historia e game-design-e-sistemas (visão), plano-de-producao e
plataforma-roadmap (processo). Adicionar DoD se vierem a especificar elementos novos.
</content>
