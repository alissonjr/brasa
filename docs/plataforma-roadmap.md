# Roadmap da Plataforma (dados, save, contas e apresentação)

Como salvar usuários, personagens, customizações, dados de jogo e preferências, do
armazenamento (navegador e/ou nuvem) até a apresentação na interface. É o estudo de
tecnologia da CAMADA PLATAFORMA (ver [`tecnica-arquitetura.md`](tecnica-arquitetura.md)
seções 2.3 e 5.3). Action-RPG 3D web (Babylon.js, TypeScript), web-first com desktop depois
via Tauri, solo/indie, classificação Teen (12+), equipe no Brasil (LGPD).

## 0. Resumo executivo e filosofia

- Local-first por padrão. Para single-player, o save é estado privado do jogador; o jogo
  funciona 100% offline contra um armazenamento local. A nuvem é réplica/backup, não
  pré-requisito.
- Privacy by default + minimização. O que não se coleta não precisa ser protegido,
  justificado nem deletado a pedido. Como o jogo é Teen (acessível a menores) e a equipe é
  brasileira, começar anônimo e local mantém a obrigação legal (LGPD/GDPR/COPPA) praticamente
  nula. Cada degrau rumo a contas/PII adiciona obrigação; só subir quando houver ganho real.
- Tudo atrás da interface SaveStore. O jogo nunca fala com localStorage, IndexedDB, nuvem ou
  Steam diretamente: fala com a interface. Trocar a implementação (local -> Tauri/FS ->
  remoto -> portal) não toca o jogo. Isso já está desenhado na arquitetura.
- Save versionado desde o dia 1. Um envelope com `schemaVersion` e migrações em cadeia
  barateia enormemente toda evolução futura.

Recomendação em uma linha: Fase 1 = save local versionado em IndexedDB (via Dexie) com
checksum/HMAC, escrita atômica + backup, export/import de arquivo, e adaptador Tauri/FS no
desktop; Fase 2 (quando cross-device/conta valer) = adaptador remoto open-source sem
lock-in (recomendado Appwrite; ou PocketBase self-host) com login anônimo -> conta
preservando o id, save em documento JSON e sync pull/push por versão (Supabase está vetado);
camada complementar = cloud save grátis dos portais (CrazyGames/Newgrounds) e Steam Cloud no
desktop; backend de jogo (LootLocker/PlayFab) só se um dia houver leaderboard competitivo,
economia ou multiplayer.

## 1. O que salvar (modelo de dados)

Cinco famílias de dados, com o save versionado como envelope:

- Usuário/perfil: id (UUID local anônimo na Fase 1), nome de exibição, locale, datas. Sem
  PII por padrão.
- Personagem(ns) e customização: nome, classe/atributos, nível/XP, equipamento, aparência
  cosmética (cabelo, cor, etc.). Parte "consultável" (nível, classe) + parte flexível
  (customização) que evolui muito.
- Progresso / dados de jogo: capítulo/checkpoint atual, flags de missão, e o estado da
  narrativa (o JSON do inkjs, `story.state.toJson()`), que carrega a continuidade entre
  capítulos (ex.: `jurou_proteger_raabe`, `extensao_misericordia`).
- Preferências de jogabilidade: áudio (master/música/SFX), idioma (PT/EN), controles
  (remapeamento), acessibilidade (tamanho de fonte, daltonismo, assistências). Podem viver
  separadas do save de progresso (são por dispositivo/conta, não por personagem).
- Telemetria (opcional): métricas de playtest (ver [`spec-combate.md`](spec-combate.md)
  seção 8). Anônima e agregada; não é save.

Envelope de save recomendado (estende o `SaveData` já existente em
`prototipo/src/platform/save/saveStore.ts`):
```ts
interface SaveData {
  schemaVersion: number;  // dirige a migração (formato do save, NÃO a versão do jogo)
  rev: number;            // versão monotônica do save (para LWW/sync e "nunca regredir")
  updatedAt: number;      // timestamp (LWW)
  checksum?: string;      // HMAC do payload (anti-edição casual; ver seção 5)
  profileId: string;
  chapter: string;        // "jerico", "ai", ...
  checkpoint: string;     // knot/cena de retomada
  inkState: string;       // story.state.toJson() do inkjs (continuidade narrativa)
  characters: CharacterSave[];
  preferences: Preferences;
  points: number;
  playtimeSec: number;
}
```
Princípio: separe metadados leves (nome do personagem, nível, timestamp, screenshot) do
payload pesado, para listar slots rápido sem carregar tudo.

## 2. Armazenamento no cliente (Fase 1, o coração agora)

Quando usar cada API do navegador:
- localStorage: só coisas minúsculas e síncronas (flag de "último slot", id de instalação,
  e talvez as preferências, que são poucas). Teto ~5 MiB, bloqueia a thread. NÃO usar para o
  save de RPG.
- sessionStorage: estado efêmero de UI; nunca persistente.
- IndexedDB: o lar do save de RPG. Assíncrono, transacional (escrita atômica), guarda
  objetos estruturados, cota enorme (compartilha um pool grande com Cache/OPFS). Use um
  wrapper: Dexie.js (ergonomia + TypeScript + transações + integra StorageManager) é a
  recomendação; idb se quiser dependência mínima; RxDB só se for fazer sync de verdade
  depois.
- Cache API (+ Service Worker / PWA): cache de assets (.glb, texturas, áudio, .wasm) e
  offline, não de save.
- OPFS (em Web Worker): binários grandes onde a performance importa (snapshots, replays);
  overkill para um save JSON de RPG.
- Web SQL: morto, não usar.

Cota, persistência e o pior caso (Safari):
- Por padrão o storage é "best-effort": o navegador pode apagar sob pressão de disco (LRU,
  apaga a origem inteira de uma vez). Chame `navigator.storage.persist()` cedo (origem
  segura) para pedir modo persistente e trate o `false`.
- Safari/WebKit (crítico): com prevenção de rastreamento, o storage criado por script é
  apagado após ~7 dias sem interação do usuário no site. Mitigações: pedir `persist()`,
  estimular "instalar" como PWA (apps standalone escapam da poda e ganham persistência), e
  oferecer export/import de save em arquivo como backup soberano.
- Modo anônimo/privado: descartável; não confiar.

Robustez de escrita e formato:
- Escrita atômica: gravar dentro de uma única transação do IndexedDB (que é atômica) e/ou
  padrão temp+replace mantendo um backup do save anterior; se o checksum falhar no load,
  recupera do backup.
- Serialização: JSON (ou objetos direto no IndexedDB via structured clone, que preserva
  Map/Set/ArrayBuffer/Date). Nada de binário (MessagePack/CBOR) por ora: no navegador o JSON
  nativo costuma ganhar, e a legibilidade ajuda no debug e no export.
- Export/Import: exportar o save como arquivo .json/.save (via `showSaveFilePicker` ou blob +
  download) e importar de volta. É o backup definitivo no web e migra naturalmente para o
  save em disco no Tauri.

Desktop (Tauri): no app desktop o save vai para o filesystem real do SO, sem eviction de
navegador. Projetar uma implementação `TauriSaveStore` (FS) por trás da mesma interface
resolve de vez o problema de persistência no desktop.

## 3. Versionamento e migração de save

- Envelope versionado: `schemaVersion` + `schema` (id do formato) + `timestamp` + `data`.
- Migrações em cadeia (stepwise): subir uma versão por vez até a atual
  (`while (v < CURRENT) { data = migrate[v](data); v++; }`). Cada migração é pequena,
  isolada e testável.
- Validação/saneamento pós-load: clamp de ranges, checar enums, rejeitar dado quebrado e
  cair em default seguro. Testar com golden files (saves antigos reais) e fuzz de corrupção.
- `schemaVersion` versiona o FORMATO do save, independente do build do jogo.

## 4. Segurança de save (proporcional ao risco)

- Tudo no cliente é editável pelo usuário. Cripto client-side de save é, para single-player,
  "teatro": a chave precisa estar no bundle para o jogo abrir o save. Não protege contra o
  dono da máquina.
- O que de fato detecta adulteração: checksum/HMAC com segredo. HMAC impede recalcular o
  hash após editar (o jogador não tem a chave). Em JS o segredo fica no bundle, então é
  anti-edição-casual (a maioria desiste), não anti-cheat sério. Some sanity checks no load.
- Quando importa: single-player puro = pouco (se o jogador trapaceia no próprio save, o dano
  é só dele); leaderboard competitivo com valor, economia, itens negociáveis = muito, e aí o
  estado relevante precisa viver/ser validado em servidor autoritativo (o cliente vira só
  "view").
- Recomendação: Fase 1 = JSON versionado + HMAC + sanity checks. Servidor autoritativo só se
  e quando houver competitivo/economia (Fase 3).

## 5. Nuvem e contas (Fase 2, quando cross-device/conta valer)

Gatilhos legítimos: continuar no desktop (Tauri) o que jogou no navegador; recuperar
progresso após limpar o navegador ou trocar de máquina; (eventualmente) social/competitivo.
Para single-player solo, esses são os únicos motivos que justificam o custo.

Restrição do projeto: Supabase está VETADO. A escolha recai sobre um backend open-source,
portável e de baixo lock-in, mantendo o mesmo desenho (anônimo -> conta preservando o id).
Como tudo fica atrás da interface SaveStore, a decisão final pode esperar e é trocável.

Stack recomendada: Appwrite (open-source; Cloud gerenciado ou self-host). Por quê: sessão
anônima nativa (`account.createAnonymousSession()`) que depois é convertida em conta
permanente preservando o mesmo id (e-mail/senha via `account.updateEmail`/`updatePassword`,
ou vincular OAuth Google/Apple), bancos de dados (documento) com permissões por documento
(isola o save por usuário), Storage, Functions e Realtime; free tier e Pro acessíveis;
lock-in baixo (open-source, self-hostável). Alternativas: PocketBase (backend open-source de
binário único sobre SQLite, o mais simples para self-host solo; OAuth e contas, anônimo via
conta descartável); Firebase (melhor DX de anônimo->linking e free tier amplo, mas lock-in
alto e custo por operação imprevisível); Nakama (servidor de jogo open-source self-host, se
prever multiplayer/realtime). BaaS de jogo (LootLocker/PlayFab) reservados para a Fase 3.

Modelo de dados na nuvem: um documento de save por usuário. No Appwrite, uma collection
`saves` com um documento por `userId` contendo o objeto de save em JSON, e permissões por
documento isolando cada save por usuário. Campos leves (nome do personagem, nível, capítulo,
timestamp) ficam como atributos consultáveis (para listar slots e, se um dia precisar,
leaderboards); o payload pesado vai como JSON. Em backends relacionais (PocketBase/SQLite ou
um Postgres self-host), o equivalente é colunas para identidade/consulta + uma coluna JSON
para o save, com regra de acesso por usuário. Em ambos, guardar `rev`/`updatedAt` para o sync.

Identidade (o fluxo que não exige cadastro no começo):
1. Fase 1: id local anônimo (UUID em IndexedDB), sem auth.
2. Fase 2 boot: criar uma sessão anônima (no Appwrite, `account.createAnonymousSession()`)
   gera um usuário real sem pedir e-mail; o save passa a sincronizar já vinculado a esse id.
   Proteger o endpoint anônimo (rate limit / verificação) para não inflar o banco e limpar
   anônimos antigos.
3. Em momento de valor ("salve na nuvem / jogue em outro dispositivo"), converter a conta
   anônima em permanente (adicionar e-mail/senha ou vincular OAuth Google/Apple). A conversão
   preserva o id, então o save inteiro continua do jogador, sem migração. Nunca forçar
   cadastro na entrada.

Sincronização (simples basta): para single-player o conflito é raro. Padrão "pull no login,
push no autosave", com resolução last-write-wins por `rev`/`updatedAt` e a regra "nunca
regredir progresso" (mantém o maior). CRDTs (Yjs/Automerge) são overkill aqui. Se um dia
quiser offline robusto e sync transparente sem escrever a lógica à mão, RxDB (web/Tauri,
portável, replicação plugável) entra por baixo da mesma SaveStore.

## 6. Distribuição: cloud save e serviços "de graça" dos canais

A maioria dos portais oferece persistência simples + identidade gerida por eles +
monetização (ads/IAP). Isso é vantajoso: a obrigação de conta/identidade (e parte da
privacidade) fica com o portal, não com você.

- Web:
  - CrazyGames SDK (módulo Data): cloud save por usuário logado, sincroniza entre
    dispositivos, migra dados de convidado (localStorage) para a conta no login. Limite ~1MB
    por usuário (planejar serialização compacta). Tem ainda "Automatic Progress Save".
  - Newgrounds.io: o mais "plataforma" entre os clássicos, gratuito: medals (achievements),
    scoreboards (leaderboards) e cloud save (poucos slots no tier free). Depende de o jogador
    ter conta Newgrounds e estar logado; convidado não persiste na nuvem deles.
  - Playgama Bridge: SDK agregador que publica o mesmo HTML5 em 20+ portais (Yandex,
    CrazyGames, Poki, etc.) com API comum (storage, leaderboards, achievements, ads).
    Escreve uma vez, publica em muitos; a profundidade de cada recurso depende do portal de
    destino.
  - Poki/GameDistribution: fortes em distribuição e monetização (ads), fracos/indefinidos
    como backend de persistência/contas. Tratar como canal de alcance, não como plataforma
    de save.
  - itch.io: ótimo para distribuir (web e desktop) e auto-update (butler), mas NÃO oferece
    cloud save hospedado (você constrói).
- Desktop (Tauri + Steam): Steam Cloud (Auto-Cloud sem código para o save single-player, ou
  Cloud API), achievements e leaderboards via Steamworks (gratuito para o dev). A ponte com
  Tauri é feita no lado Rust (crate comunitário Steamworks) exposto via comandos `invoke`.
- Leaderboards/achievements: por padrão (portais e Steam) são cliente-autoritativos, logo
  forjáveis. Use-os como sociais/cosméticos; competitivo com valor exige stats protegidos
  (Steam Web API) ou backend autoritativo.

## 7. Privacidade e conformidade (LGPD, GDPR, menores)

A distinção que decide tudo: dado anônimo guardado localmente (sem identificador que ligue a
uma pessoa) tem obrigação legal mínima. PII em servidor seu (e-mail, nome, id vinculável, IP
associado a conta), especialmente de menores, ativa LGPD/GDPR e, com crianças, COPPA/GDPR-K.

- Brasil (LGPD art. 14): dados de criança/adolescente sempre no melhor interesse; coleta de
  dado de criança exige consentimento parental específico e em destaque; não condicionar o
  jogo a dado além do necessário. ECA: criança até 12, adolescente 12-18 (capacidade de
  consentir sozinho ainda é debatida). O Enunciado CD/ANPD nº 1 (2023) admite outras bases
  legais além do consentimento parental, sempre no melhor interesse.
- UE (GDPR): idade de consentimento digital de 13 a 16 conforme o país; abaixo, consentimento
  dos pais. UK Children's Code para serviços acessíveis a menores.
- EUA (COPPA): serviços direcionados a menores de 13 exigem consentimento parental
  verificável; amendments de 2025 endurecem (consentimento separado para compartilhar com
  terceiros/ads, programa de segurança, definição ampliada de PII).
- Como o jogo é Teen (acessível a menores): a rota segura e barata é desenhar para NÃO
  precisar de idade nem de PII. Tudo anônimo e local por padrão; sem chat aberto; sem perfis
  públicos com PII; sem ads personalizados (use contextual). Deixar identidade/conta com o
  portal/Steam (eles viram o controlador de identidade, tirando de você o ônus de
  COPPA/GDPR-K/LGPD art. 14). Age gate por autodeclaração é burlável e, se anônimo, nem
  necessário. Política de privacidade curta e honesta: "guardamos o progresso localmente no
  seu dispositivo; não coletamos dados pessoais", mais o que portais/ads coletam por conta
  deles.

## 8. Integração com a arquitetura em camadas

A plataforma já existe como camada (ver [`tecnica-arquitetura.md`](tecnica-arquitetura.md)).
O jogo só fala com interfaces; os adaptadores trocam por baixo:

- SaveStore (já temos `LocalSaveStore`). Adaptadores previstos:
  - `LocalSaveStore` Fase 1: migrar de localStorage para IndexedDB (Dexie), com envelope
    versionado + checksum + escrita atômica + backup + export/import.
  - `TauriSaveStore`: filesystem real no desktop.
  - `RemoteSaveStore` (Fase 2): Appwrite (ou PocketBase self-host); ou um `SyncingSaveStore`
    que envolve local + remoto (local como fonte de verdade offline, nuvem como réplica, sync
    pull/push por `rev`). Supabase está vetado.
  - `PortalSaveStore`: CrazyGames Data / Newgrounds / Playgama Bridge, quando publicado.
- PlatformServices (porta mais ampla, além do save): além de `save`, prever
  `achievements.unlock(id)`, `leaderboard.submit(score)`, com implementações `WebPortal`
  (CrazyGames/Newgrounds/Bridge) e `SteamDesktop` (via Tauri/Rust). O mesmo save (JSON
  versionado) serve aos dois; só muda o transporte e quem é dono da identidade.
- Identidade: `ProfileService` (já temos) evolui de perfil local anônimo para conta
  federada (portal/Steam/Appwrite) preservando o id.
- Eventos: o jogo emite eventos de domínio ("checkpoint", "score", "achievement") no
  EventBus; a plataforma escuta para persistir/pontuar, sem o jogo conhecer o adaptador.
- O `ProgressService` e o `SettingsService` (já temos) continuam: o jogo decide quando
  pontuar/mudar opção; a plataforma acumula e persiste via SaveStore.

## 9. Apresentação na interface (end-to-end)

Onde os dados da plataforma encontram o jogador (ligar a [`spec-ui-hud-ux.md`](spec-ui-hud-ux.md)):
- Tela-título: "Continuar" (carrega o autosave/último slot), "Novo Jogo", "Carregar"
  (lista de slots com nome do personagem, nível, capítulo, tempo, data e thumbnail),
  "Opções", "Perfil", seletor de idioma.
- Save/Load (slots): cada slot mostra os metadados leves; ações salvar/carregar/apagar e
  export/import de arquivo. Indicador de autosave discreto (um ícone que pisca ao salvar,
  sem travar o jogo).
- Criação/customização de personagem: a UI escreve no `CharacterSave` (aparência/atributos);
  é dado de jogo, persistido como parte do save.
- Opções (Settings): áudio, idioma, controles (remapeamento), acessibilidade; gravadas pelo
  `SettingsService` (persistência por dispositivo/conta).
- Perfil/conta: na Fase 1, só nome de exibição local. Na Fase 2, um botão "Salvar na nuvem /
  jogar em outro dispositivo" que dispara o login anônimo->conta (Google/Apple/e-mail), com
  estado de "sincronizado/offline". Mostrar de forma honesta o que é local x nuvem.
- Leaderboards/achievements (se/quando): telas próprias, alimentadas pelo portal/Steam;
  rotular rankings sociais como não competitivos enquanto forem cliente-autoritativos.
- Privacidade: link curto para a política; se algum dia houver coleta, um aviso/opt-in claro
  e proporcional (e, para menores, o cuidado da seção 7).

Princípio de UX: o jogador deve sempre entender o que é salvo, onde (local x nuvem) e como
recuperar (export/import). Nunca perder progresso em silêncio.

## 10. Roadmap faseado (com gates de decisão)

Fase 1 - Local-first robusto (agora). Sem nuvem, sem contas, sem PII.
- [x] Evoluir `LocalSaveStore` para IndexedDB (Dexie), envelope versionado + `schemaVersion`
      + migrações (em cadeia), checksum/HMAC, escrita atômica + backup, saneamento no load.
      Feito em `prototipo/src/platform/save/saveStore.ts`.
- [x] Export/Import de save em arquivo (métodos `exportSlot`/`importSlot` no `SaveStore`).
- [x] `navigator.storage.persist()` (`requestPersistentStorage`, chamado no `app/main.ts`).
      [ ] Caminho PWA (manifest + service worker) ainda pendente.
- [ ] `TauriSaveStore` (FS) para o desktop quando empacotar.
- [x] UI mínima: tela-título (Continuar/Novo/Carregar/Opções), tela Carregar com slots
      (carregar/apagar/exportar/importar), Opções (áudio + idioma), menu de Pausa (Esc:
      retomar/salvar/opções/sair) e indicador de autosave. Framework de UI (overlay HTML/CSS)
      na engine (`engine/ui/uiManager.ts`); telas e tema na camada de jogo (`game/ui/`).
      Liga à [`spec-ui-hud-ux.md`](spec-ui-hud-ux.md). Pendente: HUD de jogo (vida), caixa de
      diálogo do Ink, fonte Cinzel e tradução EN.
- Gate: o núcleo de persistência local segura está pronto (resta UI e empacotamento desktop).

Fase 2 - Nuvem e contas (quando cross-device/recuperação valer). Gatilho: jogadores pedindo
continuar em outro dispositivo / medo de perder o save.
- [ ] `RemoteSaveStore`/`SyncingSaveStore` em Appwrite (ou PocketBase self-host). Supabase vetado.
- [ ] Sessão anônima -> conversão em conta (Google/Apple/e-mail) preservando o id.
- [ ] Sync pull/push por `rev` (LWW + nunca regredir). CAPTCHA + rate limit no anônimo.
- [ ] UI de conta ("salvar na nuvem", status sincronizado/offline).
- Gate/decisão: confirmar que vale o custo de operar/cuidar de dados; manter PII ao mínimo.

Fase complementar - Portais/Steam (ao publicar). Pode vir antes ou junto da Fase 2.
- [ ] Web: CrazyGames Data e/ou Newgrounds.io como cloud save grátis; Playgama Bridge para
      multi-portal; respeitar o limite de ~1MB (serialização compacta).
- [ ] Desktop: Steam Cloud (Auto-Cloud) + achievements/leaderboards via Steamworks (ponte
      Tauri/Rust).
- [ ] `PortalSaveStore`/`PlatformServices` por trás das interfaces.

Fase 3 - Só se o jogo pedir: competitivo/economia/multiplayer. Servidor autoritativo
(funções serverless, ex.: Appwrite Functions ou Cloudflare Workers; ou BaaS de jogo
LootLocker/PlayFab/Nakama), validação server-side,
anti-cheat. Para single-player solo, provavelmente nunca.

O que NÃO fazer: começar pela nuvem; forçar cadastro na entrada; escolher Firestore/PlayFab
por hype (lock-in/custo); investir em CRDT/anti-cheat/criptografia pesada antes de haver
jogadores que sintam falta; coletar qualquer PII sem necessidade estrita (ainda mais sendo
Teen/BR).

## 11. Mapeamento ao código atual (camada `platform/`)

Já existe: `LocalSaveStore` (localStorage), `ProfileService`, `ProgressService`,
`SettingsService`, e `SaveData` com `inkState`. Evolução recomendada:
- `LocalSaveStore`: localStorage -> IndexedDB/Dexie; adicionar `schemaVersion`/migrações,
  `checksum` (HMAC), escrita atômica + backup, export/import. (Manter a interface `SaveStore`
  intacta para não tocar o jogo.)
- Acrescentar `TauriSaveStore` e, na Fase 2, `RemoteSaveStore`/`SyncingSaveStore`.
- `ProfileService`: preparar para o upgrade anônimo->conta (id estável preservado).
- Acrescentar uma porta `PlatformServices` (save + achievements + leaderboard) com
  implementações Web/Steam quando publicar.

## Fontes

Armazenamento no navegador e save:
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
- https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
- https://webkit.org/blog/14403/updates-to-storage-policy/
- https://dexie.org/docs/StorageManager
- https://arcadeonstudios.co.uk/blog/a-practical-save-system-for-indie-games-versioned-portable-testable

Backend, BaaS, identidade e sync:
- https://www.leadr.gg/blog/the-best-backend-service-for-your-game-in-2026
- https://appwrite.io/docs/products/auth/accounts (Appwrite Accounts/Auth, sessão anônima e conversão)
- https://pocketbase.io/docs/ (PocketBase, backend open-source de binário único)
- https://firebase.google.com/docs/auth/web/anonymous-auth (Firebase anônimo + linking, alternativa com lock-in)
- https://heroiclabs.com/docs/nakama/ (Nakama, servidor de jogo open-source self-host)
- https://rxdb.info/alternatives.html
- https://powersync.com/blog/electricsql-vs-powersync
- https://developer.microsoft.com/en-us/games/articles/2025/09/introducing-playfab-game-saves/
- https://lootlocker.com/blog/selecting-the-right-backend-for-your-game

Portais, Steam, segurança e privacidade:
- https://docs.crazygames.com/sdk/data/
- http://www.newgrounds.io/help/components/
- https://wiki.playgama.com/playgama/sdk/getting-started
- https://itch.io/docs/butler/
- https://partner.steamgames.com/doc/features/cloud
- https://partner.steamgames.com/doc/features/leaderboards
- https://gamedevfaqs.com/securing-game-data-techniques-to-prevent-cheating-and-tampering/
- https://medium.com/@aryaklahane/secure-client-side-storage-aes-256-encrypted-cookies-with-hmac-tamper-detection-bcf7579c5961
- https://lgpd-brasil.info/capitulo_02/artigo_14
- https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes
- https://www.didomi.io/blog/privacy-laws-underage-consumers
- https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data
