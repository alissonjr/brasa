# Corpus de documentação - Brasa

Índice do corpo documental do jogo **Brasa** (dungeon crawler de fantasia low-poly,
foco em rodar leve no navegador). Espelha, doc por doc, a profundidade que o projeto
Josué tinha, no padrão de [`../padrao-de-detalhe.md`](../padrao-de-detalhe.md).

Documento mestre (canon): [`../projeto-brasa.md`](../projeto-brasa.md) - premissa,
mundo, loop sala-a-sala, orçamento de performance NORMATIVO, plano de assets KayKit,
mapeamento sobre o motor e roadmap.

Aprofundamento e roadmap de elevação: [`00-aprofundamento-e-roadmap.md`](00-aprofundamento-e-roadmap.md)
- auditoria doc x código, decisões de canon a fechar, aprofundamento por área (poderes,
inimigos/chefe, história, personagens, chão/teto/paredes, progressão, UI/áudio) e roadmap
em ondas (W1-W6) com DoD. Comece por aqui para a próxima fase de qualidade.

Convenção de todo o corpus: pt-BR, sem travessões, sem emojis. Procedência
`[DESIGN]`/`[CÓDIGO]`/`[ASSET]`; exigência `[NORMATIVO]`/`[ASPIRACIONAL]`/`[A DEFINIR]`;
cada doc de elemento termina com checklist de aceite (DoD).

## Visão e narrativa
- [`narrativa-e-historia.md`](narrativa-e-historia.md) - lore, premissa, arco da Acendedora, estrutura da descida.
- [`guia-de-estilo-e-glossario.md`](guia-de-estilo-e-glossario.md) - voz, grafia, glossário canônico de termos de Brasa.
- [`direcao-de-arte.md`](direcao-de-arte.md) - estilo visual, paleta frio/quente, referências.
- [`game-design-e-sistemas.md`](game-design-e-sistemas.md) - pilares, laço de jogo, sistemas macro.

## Bíblias de domínio
- [`biblia-ambientes.md`](biblia-ambientes.md) - a cripta, tipos de sala, kit modular, vocabulário espacial.
- [`biblia-iluminacao.md`](biblia-iluminacao.md) - luz fria vs quente, o braseiro, regime de luzes por sala.
- [`biblia-audio.md`](biblia-audio.md) - leitmotifs, trilha adaptativa, SFX da descida e do fogo.
- [`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md) - a chama, fagulhas, dissolução dos mortos, telegrafia.
- [`biblia-vestuario.md`](biblia-vestuario.md) - traje da Acendedora e leitura dos esqueletos.
- [`biblia-bestiario.md`](biblia-bestiario.md) - os mortos despertos (esqueletos e variantes); substitui a bíblia de fauna.

## Personagens
- [`personagens.md`](personagens.md) - a Acendedora (herói), o Guardião (chefe) e eventuais NPCs.

## Specs de sistema
- [`spec-combate.md`](spec-combate.md) - moveset, hitboxes, hitstop, telegrafia.
- [`spec-chefe-guardiao.md`](spec-chefe-guardiao.md) - o Guardião da Brasa apagada (chefe do slice).
- [`spec-progressao-e-economia.md`](spec-progressao-e-economia.md) - a fagulha, upgrades por braseiro, economia.
- [`spec-fluxo-e-persistencia.md`](spec-fluxo-e-persistencia.md) - estados, save, fluxo de telas.
- [`spec-ui-hud-ux.md`](spec-ui-hud-ux.md) - HUD, menus, acessibilidade.
- [`spec-set-pieces.md`](spec-set-pieces.md) - momentos roteirizados (acender a Brasa, despertares, queda).
- [`spec-vertical-slice-cripta.md`](spec-vertical-slice-cripta.md) - a descida jogável de 5-7 salas + chefe; substitui o spec do protótipo de Jericó.

## Processo
- [`plano-de-producao.md`](plano-de-producao.md) - etapas, marcos, ordem de construção.

## Reaproveitado sem reescrever (tema-neutro)
Estes docs do projeto antigo são genéricos e valem para Brasa por referência, sem cópia:
[`../padrao-de-detalhe.md`](../padrao-de-detalhe.md) (processo), todos os
[`../tecnica-*`](../) (engine, arquitetura, animação Babylon, assets, build/deploy,
gráficos/física, locomoção, i18n, performance, input/debug),
[`../plataforma-roadmap.md`](../plataforma-roadmap.md) e
[`../plano-m2-combate.md`](../plano-m2-combate.md) onde a mecânica for neutra.
