# Técnica: Internacionalização (i18n)

O lado técnico da localização, que até aqui estava só conceitual (GDD seção 9 e
[`plano-de-producao.md`](plano-de-producao.md) dizem "textos fora do código desde o início, PT
e EN", mas sem o COMO). Cobre: formato da tabela de strings, troca de idioma em runtime,
localização do Ink, fontes e o caso da escrita hebraica, e plurais/formatação. O protótipo é só
PT-BR; este doc garante que o caminho PT -> EN (e além) não exija retrabalho.

Liga-se a [`spec-ui-hud-ux.md`](spec-ui-hud-ux.md) (tipografia, caixa de diálogo),
[`../narrativa/README.md`](../narrativa/README.md) (Ink e tags), [`biblia-audio.md`](biblia-audio.md)
(legendas/captions) e [`tecnica-arquitetura.md`](tecnica-arquitetura.md) (onde o serviço de i18n
vive: uma camada de PLATAFORMA/serviço injetada).

## 1. Princípio: nenhuma string de jogador no código

Toda string que o jogador lê sai do código e vai para uma tabela por idioma, referenciada por
CHAVE. O código nunca concatena texto visível; pede `t("chave")`. Isso vale para UI, HUD, menus,
tooltips, nomes de item, mensagens de erro. A NARRATIVA (diálogos, narração) é caso à parte: vive
no Ink (seção 4).

Duas famílias de texto, dois donos:
- Texto de sistema/UI: tabela de strings própria (seção 2-3).
- Texto narrativo: Ink, com um arquivo por idioma (seção 4).

## 2. Formato da tabela de strings

JSON por idioma, com chaves em `snake_case` hierárquico por namespace. Simples, versionável,
fácil de dar para um tradutor e de diferenciar no git.

```
src/i18n/
  pt-BR.json
  en.json
```

```jsonc
// pt-BR.json
{
  "menu.continuar": "Continuar",
  "menu.novo_jogo": "Novo jogo",
  "menu.opcoes": "Opções",
  "hud.vida": "Vida",
  "combate.bloqueio": "Bloqueio",
  "item.funda": "Funda",
  "objetivo.resgatar_raabe": "Alcance a casa de Raabe",
  "dica.contagem": "{count} inimigo restante | {count} inimigos restantes"
}
```

Convenções:
- Chave = identidade estável; o texto PT é só mais um valor. Nunca usar o texto PT como chave
  (muda quando o copy muda).
- Namespaces: `menu.`, `hud.`, `combate.`, `item.`, `objetivo.`, `dica.`, `erro.`.
- Interpolação por `{nome}`: `t("dica.tempo", { segundos: 12 })`.
- Plural por uma convenção simples (ex.: `singular | plural` separados por `|`, escolhido pelo
  `{count}`); para regras complexas de outras línguas, usar a API `Intl.PluralRules`.
- O `en.json` tem EXATAMENTE as mesmas chaves; um teste de CI compara os conjuntos de chaves e
  acusa chave faltando/sobrando antes do build.

## 3. O serviço de i18n e a troca em runtime

Um serviço enxuto (sem dependência externa pesada; uma lib como `i18next` é opcional e cabível,
mas o jogo precisa de pouco):

```ts
type Dict = Record<string, string>;

class I18n {
  private dict: Dict = {};
  private idioma = "pt-BR";
  private ouvintes = new Set<() => void>();

  async carregar(idioma: string) {
    this.dict = (await import(`./i18n/${idioma}.json`)).default;
    this.idioma = idioma;
    document.documentElement.lang = idioma;       // acessibilidade + fonte
    this.ouvintes.forEach((f) => f());            // re-render da UI
  }

  t(chave: string, vars?: Record<string, string | number>): string {
    let s = this.dict[chave] ?? chave;            // fallback: a própria chave (acha buraco)
    if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, String(vars[k]));
    return s;
  }

  aoTrocar(f: () => void) { this.ouvintes.add(f); }
}
export const i18n = new I18n();
```

Troca em runtime:
- A UI escuta `aoTrocar` e se re-renderiza ao mudar de idioma (sem reload). Em UI do Babylon GUI,
  isso significa reatribuir os `.text` dos controles a partir das chaves.
- O idioma escolhido é uma CONFIGURAÇÃO (settings), separada do save, persistida à parte (ver
  [`spec-fluxo-e-persistencia.md`](spec-fluxo-e-persistencia.md) seção 6). No boot: detectar
  `navigator.language`, cair para `pt-BR` se não houver tabela, e respeitar a escolha salva.
- O JSON de cada idioma é carregado sob demanda (`import()` dinâmico, code-split pelo Vite): o
  bundle inicial leva só o idioma ativo.

## 4. Localização do Ink

A narrativa vive no Ink (jerico.ink, ai.ink). Localizar Ink tem duas abordagens:

1. Um `.ink` (logo um `.json` compilado) por idioma. Mais simples e robusto: `jerico.pt-BR.ink`,
   `jerico.en.ink`. O engine carrega o JSON do idioma ativo. A LÓGICA (knots, escolhas,
   variáveis, tags `#GAMEPLAY`/`#RETOMAR`) é idêntica entre idiomas; só o texto de fala muda.
   Risco: manter a estrutura em sincronia entre os arquivos (um diverge do outro). Mitigação: um
   `.ink` é a fonte e o outro é tradução fiel; teste que ambos compilam e têm os mesmos knots.
2. Ink com chaves + tabela externa. O `.ink` carrega só ids/tags e o texto vem da tabela de
   strings da seção 2. Mantém um único `.ink`, mas perde a legibilidade do roteiro (o escritor vê
   chaves, não falas). Pior para escrever, melhor para traduzir em volume.

Recomendação: um `.ink` por idioma (abordagem 1) para o protótipo e a demo, porque o roteiro
precisa ser LEGÍVEL para quem escreve (Inky) e o volume é pequeno. As variáveis de continuidade
entre capítulos (`extensao_misericordia`, etc.) vivem no `inkState` serializado pelo inkjs
(spec-fluxo-e-persistencia seção 5), que é idioma-agnóstico: trocar de idioma não perde progresso.

As tags de apresentação (`#speaker`, `#emo`, `#cam`) também são idioma-agnósticas (ids
`snake_case` sem acento, como já manda a [`../narrativa/README.md`](../narrativa/README.md)); só
o texto da linha muda. O NOME exibido do falante (`#speaker: Eleazar`) idealmente vem de uma
chave (`personagem.eleazar.nome`) para localizar títulos/epítetos.

## 5. Fontes e a escrita hebraica

O jogo é ambientado no Antigo Oriente Próximo; pode haver uso pontual de hebraico
(inscrições, o nome no cordão, branding, ver [`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md)
seção de key art e [`guia-de-estilo-e-glossario.md`](guia-de-estilo-e-glossario.md)). Pontos
técnicos:
- Subsetting de fonte: a fonte de UI principal cobre PT/EN (Latin). NÃO embutir a fonte hebraica
  inteira no bundle; carregar uma fonte de fallback hebraica só quando uma string hebraica for
  exibida (ou no contexto que a usa), via `@font-face` com `unicode-range`.
- Fallback de glifo: definir uma cadeia de fontes (`font-family`) em que a hebraica entra depois
  da latina; o navegador usa a hebraica só para os caracteres que a latina não tem.
- RTL: hebraico é da direita para a esquerda. Se entrar texto hebraico REAL corrido (não só
  decorativo), o container precisa de `direction: rtl`/`dir="rtl"` e a UI tem que tolerar
  espelhamento. Para uso decorativo/curto (uma inscrição, um símbolo), tratar como elemento de
  arte, não como texto de layout. Recomendação: manter o hebraico como DECORATIVO no protótipo
  (evita a complexidade de layout bidirecional) e reavaliar se virar idioma jogável.
- Babylon GUI x DOM: a UI de menus/HUD pode ser DOM/HTML (mais fácil para i18n, RTL, fontes,
  acessibilidade) com o canvas por baixo; a UI diegética no mundo 3D usa Babylon GUI. Ver
  [`spec-ui-hud-ux.md`](spec-ui-hud-ux.md) seção 9.

## 6. Formatação dependente de locale

Use a API `Intl` do navegador em vez de formatar à mão:
- Números/tempo: `Intl.NumberFormat`, e formatar duração de jogo/cooldowns com a unidade
  localizada.
- Plurais: `Intl.PluralRules` para escolher a forma certa por `{count}` (PT e EN são simples;
  outras línguas têm mais formas).
- Datas (timestamp de save): `Intl.DateTimeFormat` no locale ativo. O timestamp em si é injetado
  pelo engine, nunca pelo Ink (spec-fluxo-e-persistencia: "não usar Date no Ink").

## 7. Recomendação para o projeto

- Já no protótipo (mesmo só PT-BR): tirar 100% das strings de UI/HUD para `pt-BR.json` e acessar
  via `i18n.t`. Custa pouco agora e evita uma caça a strings depois. É a regra "localização desde
  já" do plano de produção.
- Idioma como configuração persistida à parte do save; detectar `navigator.language` no boot.
- Ink: um `.ink` por idioma quando o EN entrar (decisão de idioma do protótipo ainda pendente,
  plano-de-producao seção 7.4); estrutura idêntica, só o texto muda; `inkState` idioma-agnóstico.
- Hebraico: decorativo por ora; fonte de fallback com `unicode-range`, sem embutir tudo; RTL só
  se virar idioma jogável.
- Teste de CI que compara as chaves entre os JSONs de idioma.

## Fontes

- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules
- https://www.i18next.com/ (opcional, se quiser uma lib pronta)
- https://github.com/inkle/ink/blob/master/Documentation/RunningYourInk.md (estado/variáveis do Ink)
- https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range
- https://developer.mozilla.org/en-US/docs/Web/CSS/direction (RTL)
- https://doc.babylonjs.com/features/featuresDeepDive/gui/gui (Babylon GUI x DOM)
