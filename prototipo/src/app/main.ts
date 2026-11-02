import { Matrix, Scene, Vector3 } from "@babylonjs/core";
import { addFinishingPass, addSceneOutline, createEngine, disposeOrphanSkeletons, enableHavokPhysics, enableSsao, InputState, ThirdPersonCamera, Tweens, UiManager } from "@engine";
import type { KeyBindings } from "@engine";
import {
  WORLD_GRAVITY,
  buildCryptRoom,
  setupCryptScene,
  ensureCryptPieces,
  CRYPT_SPAWN,
  Acendedora,
  type Room,
  type RoomDef,
  type SkeletonKind,
  MainMenuScreen,
  PauseScreen,
  CharacterCreateScreen,
  VictoryScreen,
  DefeatScreen,
  GameHud,
  DEFAULT_CHAPTER,
  DEFAULT_CHARACTER,
  allObjectives,
  progressPercent,
  readGameSave,
  CodexLog,
  FLOOR_ECHOES,
  FLOOR_INSCRIPTIONS,
  MARK_BOSS_DOWN,
  markFloor,
  markRead,
  achievementForObjective,
  setLanguage,
  T,
  F,
  itemText,
  onLanguageChange,
  openBoonShop,
  openArmario,
  MuralPlate,
  markMural,
  markAcendeu,
  markCleared,
  createAutosaveIndicator,
  createPauseButton,
  configureUiSound,
  mountMuteButton,
  installDesktopNotice,
  configureCombatSound,
  healChime,
  denyBlip,
  playDrink,
  DrinkFx,
  type PotionKind,
  configureTitleAmbience,
  startTitleAmbience,
  stopTitleAmbience,
  configureMusic,
  startMusic,
  stopMusic,
  setMusicState,
  configureStingers,
  playStinger,
  configureAmbience,
  startAmbience,
  setAmbience,
  updateAmbience,
  playWhisper,
  playStir,
  bindGameAudio,
  updateFootsteps,
  playPickup,
  playDoor,
  playStairs,
  playGuardianVoice,
  CombatDirector,
  CombatHud,
  Onboarding,
  DamageNumbers,
  DIFFICULTY_DAMAGE_TAKEN,
  POTIONS,
  ABSORB,
  type UiContext,
  type StringKey,
  type CharacterSave,
  type RunSave,
  ANTESSALAS,
  EVT,
  ExploracaoRegistry,
  RouteState,
  Pocoes,
  ROTA,
  stepCommit,
  exploracaoDefaults,
  type Interativo,
  retryPlace,
  type EvtAntessalaEnter,
  type EvtBraseiroLit,
  type EvtMuralRead,
  type EvtArmarioChange,
  type ExitMarkerDef,
  ExitMarkers,
  type Commit,
} from "@game";
import { SAVE_SCHEMA_VERSION, requestPersistentStorage } from "@platform";
import type { Quality, SaveData } from "@platform";
import { buildPlatform } from "./services";
import { PerfHud } from "../dev/perfHud";

/** PRNG determinístico (mulberry32): mesma semente -> mesma sequência (seed por run). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const newSeed = (): number => Math.floor(Math.random() * 0x7fffffff) + 1;

/**
 * CAMADA APP - composition root de BRASA. Cria a ENGINE, monta a PLATAFORMA, instancia
 * o JOGO (a Acendedora numa sala-cripta) e liga o fluxo de telas (menu -> jogo -> pausa)
 * com a UI. Único lugar que conhece as três camadas ao mesmo tempo. O protótipo carrega
 * UMA sala-cripta fechada (regime leve, sem mundo aberto nem streaming).
 */
async function main(): Promise<void> {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const loading = document.getElementById("loading")!;
  const fpsEl = document.getElementById("fps")!;
  // Celular/tablet sem teclado: só o aviso, sem carregar o motor. Janela estreita: o aviso
  // cobre o jogo e some quando a janela alarga.
  if (installDesktopNotice()) {
    loading.hidden = true;
    return;
  }
  const stage = (msg: string) => {
    console.log(`[app] ${msg}`);
    document.getElementById("loading-text")!.textContent = msg;
  };

  // --- ENGINE ---
  stage(T.stageEngine);
  const engine = await createEngine(canvas);
  console.log(`[app] engine pronta: ${engine.constructor.name}`);
  const scene = new Scene(engine);

  stage(T.stageFisica);
  await enableHavokPhysics(scene, WORLD_GRAVITY);

  // --- PLATAFORMA ---
  const platform = buildPlatform();
  setLanguage(platform.settings.get().language); // idioma da UI a partir das preferências
  // Mudo global: multiplica todos os volumes (efeitos e música) sem tocar nos sliders.
  const audible = (): number => (platform.settings.get().muted ? 0 : 1);
  const sfxVolume = () => {
    const s = platform.settings.get();
    return audible() * s.masterVolume * s.sfxVolume;
  };
  const musicVolume = () => {
    const s = platform.settings.get();
    return audible() * s.masterVolume * s.musicVolume;
  };
  configureUiSound(sfxVolume);
  configureCombatSound(sfxVolume);
  configureTitleAmbience(musicVolume);
  configureMusic(musicVolume);
  configureStingers(musicVolume);
  configureAmbience(musicVolume); // ambiência adaptativa (textura musical -> volume de música)
  bindGameAudio(platform.events); // efeitos por evento (morte de inimigo); passos e portas abaixo
  mountMuteButton(platform.settings);
  const persistente = await requestPersistentStorage();
  console.log(`[plataforma] storage persistente: ${persistente}`);
  const profile = platform.profile.current();
  const SLOT = "auto";
  const carregado = await platform.save.load(SLOT);
  const gameSave = carregado ? readGameSave(carregado.game) : null;
  let character: CharacterSave = gameSave?.character ?? { ...DEFAULT_CHARACTER };
  if (carregado) {
    platform.score.reset(carregado.points);
    console.log(`[plataforma] save carregado: ${carregado.points} pts, "${carregado.summary}"`);
  } else {
    console.log(`[plataforma] novo perfil ${profile.id} (${profile.name})`);
  }
  platform.progression.setChapter(gameSave?.chapter || DEFAULT_CHAPTER, gameSave?.checkpoint ?? "");
  for (const id of gameSave?.objectives ?? []) platform.progression.completeObjective(id);
  platform.achievements.load(gameSave?.achievements ?? []);

  // CRÔNICA: marcas do que o jogador já viu (andares alcançados, inscrições lidas, queda do
  // Guardião). Alimentada pelo `crypt:floor`, pela leitura da inscrição e pela queda do chefe;
  // guardada no save. `codexNews` junta os avisos "Nova página" até haver um momento calmo.
  const codex = new CodexLog(gameSave?.codex ?? []);
  const codexNews: string[] = [];
  const markCodex = (id: string): void => {
    const r = codex.mark(id);
    if (!r.added) return;
    codexNews.push(...r.titles);
    if (gameActive) void doAutosave(); // fora do jogo (boot, transição) quem chama já salva
  };
  platform.events.on<{ index: number }>("crypt:floor", ({ index }) => markCodex(markFloor(index + 1)));

  // --- JOGO: a descida pela cripta (uma sala por vez, com descarte) ---
  stage(T.stageFagulha);
  const spawn = new Vector3(CRYPT_SPAWN.x, 1.5, CRYPT_SPAWN.z);
  const camera = new ThirdPersonCamera(scene, canvas, spawn);
  const cryptCtx = setupCryptScene(scene, camera.camera); // look global (glow/nevoa/luz/sombra/pos)
  // ESTILO (Bloco 1, spec-estilo-visual-render §4.1c): SSAO aterra atores e cantos da cripta.
  enableSsao(scene, camera.camera, { strength: 1.0, base: 0.35, radius: 0.0009, area: 0.0075 });
  // ESTILO (Bloco 3, §4.3): edge-detect de cena (linha de tinta no MUNDO). Antes da finalização
  // para a linha ser papelada/posterizada junto. Pulado em WebGPU (GLSL); fica o inverted-hull.
  addSceneOutline(camera.camera, { thickness: 1.4, strength: 0.85 });
  // ESTILO (Bloco 2, §4.2a): passe de finalização (papel + dither + posterize). Em WebGPU é
  // pulado (GLSL); o resto da pilha estilizada segue valendo.
  addFinishingPass(camera.camera, { posterizeLevels: 22, ditherStrength: 0.6, paperStrength: 0.15 });
  // ESTILO (Bloco 2, §4.2b): gerenciador de tween para o juice (atualizado no loop com dt real).
  const tweens = new Tweens();
  stage(T.stageCripta);
  await ensureCryptPieces(scene); // carrega o kit KayKit uma vez
  const hero = new Acendedora(scene, spawn, WORLD_GRAVITY);
  // Herói projeta sombra assim que o modelo termina de carregar (async); persiste entre salas.
  let heroShadowReg = false;
  scene.onBeforeRenderObservable.add(() => {
    if (heroShadowReg) return;
    const meshes = hero.model.root.getChildMeshes(false);
    if (meshes.length > 0) {
      for (const m of meshes) cryptCtx.shadow.addShadowCaster(m);
      heroShadowReg = true;
    }
  });
  const input = new InputState();
  input.setBindings(platform.settings.get().keyBindings as Partial<KeyBindings>);
  input.attach(window);

  const combat = new CombatDirector(scene, camera, hero, platform.events, tweens);
  let devTimeScale = 1; // DEV: câmera lenta do combate para capturas em sequência (sempre 1 em produção)
  // DEV: gancho de depuracao (so em dev) para inspecionar/afinar a cena ao vivo no playtest.
  if (import.meta.env.DEV) {
    (window as unknown as { __brasa?: unknown }).__brasa = {
      scene, camera, hero, combat, input,
      cam: () => {
        const c = camera.camera;
        return { alpha: c.alpha, beta: c.beta, radius: c.radius, posY: c.position.y, targetY: c.target.y };
      },
      hp: () => ({ cur: hero.combat.health.current, max: hero.combat.health.max, frac: hero.combat.health.fraction }),
      pos: () => { const p = hero.position; return { x: p.x, y: p.y, z: p.z }; },
      enemiesAlive: () => combat.enemiesAlive,
      tp: (x: number, z: number, y = 1.5) => hero.teleport(new Vector3(x, y, z)),
      heal: () => hero.combat.health.heal(9999),
      hurt: (n: number) => hero.combat.takeDamage(n),
      drink: (kind: PotionKind = "vida") => hero.combat.requestDrink(kind), // DEV: pede o gole sem gastar o teclado
      slow: (k: number) => { devTimeScale = k; }, // DEV: câmera lenta do combate (0,1 = 10x mais devagar)
      inv: () => ({ ...inv }),
      giveInv: (vida: number, furia: number) => { inv.vida = vida; inv.furia = furia; updatePotionHud(); },
      drinkInfo: () => hero.combat.drinkInfo,
      enterRoom: (i: number) => enterRoom(i), // DEV: pula para o andar i (medição de perf / capturas)
      room: () => (currentRoom ? { brazier: { x: currentRoom.brazier.x, z: currentRoom.brazier.z }, exit: currentRoom.exit } : null),
      enterAntessala: (i: number) => enterAntessala(i, true), // DEV: vai direto à antessala do andar i
      crossDoor: () => crossDoor(), // DEV: cruza a porta da antessala (a câmara começa)
      lightBrazier: () => lightBrazier(), // DEV: acende o braseiro da antessala (cura, checkpoint, painel da chama)
      openArmario: () => openArmarioPanel(), // DEV: abre o armário da antessala
      readMural: () => readMural(), // DEV: abre a placa do mural
      setLight: (k: number) => { lightT = lightGoal = k; currentRoom?.setBrazierLit(k); }, // DEV: luz do braseiro sem gesto (capturas frio/aceso)
      pocoes: () => pocoes.toSave(),
      sparks: (n: number) => { fagulhas += n; updateFagulhaHud(); }, // DEV: ganha Fagulhas
      interativos: () => currentRoom?.antessala?.interativos ?? [],
      route: () => ({ ...route.save(), place: route.current, floor: floorIndex, passageOpen, fragments }),
      takeFragment: () => { if (currentRoom && !fragmentTaken) { const b = currentRoom.brazier; hero.teleport(new Vector3(b.x + 3, 1.5, b.z - 0.6)); } }, // DEV: encosta no relicário (colhe a estilha) fora do gatilho do alçapão
      clear: () => combat.clearEnemies(), // DEV: limpa a sala (libera o relicário)
      die: () => platform.events.emit("hero:died", {}), // DEV: derrota
      win: () => { descentDone = true; }, // DEV: vitória (abre a tela de fim)
    };
  }
  // Gate de performance (NORMATIVO): mede draw calls + fps por sala. Overlay sob ?perf ou F9.
  const perf = new PerfHud(scene, engine);
  window.addEventListener("keydown", (e) => { if (e.code === "F9") perf.toggle(); });
  const applyDifficulty = (): void => {
    hero.combat.setDamageTakenMultiplier(DIFFICULTY_DAMAGE_TAKEN[character.difficulty] ?? 1);
    hero.setMantle(character.manto); // aplica a variante de textura do manto escolhido
  };
  applyDifficulty();

  // Sequência de andares do slice: 5 câmaras + a câmara do Guardião.
  // 7 câmaras (spec-vertical-slice §3): abertura -> 5 de descida -> Guardião. Reusa os 5
  // tipos visuais (RoomKind) enquanto as plantas distintas não existem. enemies = nº por sala.
  const DESCENT: RoomDef[] = [
    { index: 0, kind: "guarda", enemies: 1 }, // abertura (tutorial)
    { index: 1, kind: "salao", enemies: 3 },
    { index: 2, kind: "cisterna", enemies: 5 }, // pico
    { index: 3, kind: "salao", enemies: 6 }, // pico
    { index: 4, kind: "santuario", enemies: 4 },
    { index: 5, kind: "cisterna", enemies: 5 },
    { index: 6, kind: "guardiao", enemies: 4, boss: true }, // clímax (chefe real = feature futura)
  ];
  let currentRoom: Room | null = null;
  let currentBoss: ReturnType<typeof combat.addBoss> | null = null; // Guardião do andar final (se houver)
  let floorIndex = 0;
  let descending = false;
  let descentDone = false;
  let winShown = false; // a tela de vitória desta descida já foi aberta
  let roomCleared = false;
  let floorDepth = 0; // ESTILO (Bloco 4): profundidade do andar atual (0..1) p/ a ambiência
  let ambAcc = 0; // acumulador de throttle do setAmbience
  let stepPx: number | null = null; // posição anterior do herói (passos)
  let stepPy = 0;
  let stepPz = 0;
  let passageOpen = false;
  // NARRATIVA (W8): a Acendedora desce o poço para reacender a GRANDE BRASA no fundo. Cada
  // câmara guarda uma ESTILHA de Brasa (no relicário/altar) que os mortos velam; recuperá-la
  // (limpar a sala + tocar o relicário) libera a descida. Só no FUNDO (andar final), com as
  // estilhas reunidas, o fosso é reaceso. Nada de "acender o fogo" a cada andar.
  let fragments = 0; // estilhas de Brasa recuperadas até agora
  let fragmentTaken = false; // estilha do andar atual já recuperada?
  const readShown = new Set<string>(); // inscrições/pergaminhos já lidos neste andar
  let nearReadable: { x: number; z: number; text: string } | null = null;
  let bossChannelT = 0; // canalização da Brasa central DURANTE o confronto do Guardião
  const BOSS_CHANNEL_SEC = 1.1;
  let fagulhas = 0; // moeda: cinza quente dos mortos, gasta nas dádivas do braseiro
  let runActive = false; // há uma descida em andamento (para persistência/retomar)
  let runSeed = newSeed(); // semente da run: jitter de posição e ordem de oferta determinísticos
  // EXPLORAÇÃO (docs/brasa/spec-exploracao-indice.md): `explor` recebe os sistemas (livros, poções,
  // cenário), cada um com uma linha de registro; `route` é o lugar (antessala ou câmara), o gasto e o braseiro.
  const explor = new ExploracaoRegistry();
  const route = new RouteState();
  let timedRun = false; // a descida foi jogada do começo nesta sessão (vale para o leaderboard)
  let runStartedAt = 0; // performance.now() do início da descida cronometrada
  const purchasedBoons: string[] = []; // nomes das dádivas compradas (reaplicadas ao carregar)
  let defeated = false; // derrota: a fagulha apagou (vida zerou)
  // Declarado cedo: restoreRun() roda no boot e chama updateFagulhaHud/updatePotionHud,
  // que leem gameActive. Se ficasse lá embaixo, daria TDZ ("before initialization").
  let gameActive = false; // simulação ativa (fora de menu/pausa/transição)
  const CLEAR_BONUS = 6;
  // OBJETIVO: fonte única do texto mostrado no HUD e na pausa (guiado pelo andar atual:
  // derrotar -> recuperar a estilha -> descer). `ctx.objective()` devolve isto.
  const descentObjective = (): string => {
    if (descentDone) return T.objVitoria;
    if (route.inAntessala) {
      const a = ANTESSALAS[route.floor]!;
      const aceso = route.braseiros[route.floor]!.aceso;
      return `${T[a.nome]}. ${aceso || !a.prologo ? T.objPorta : T.objAcenda}`;
    }
    const n = combat.enemiesAlive;
    const last = floorIndex >= DESCENT.length - 1;
    if (n > 0) return F("objDerrote", { n });
    if (fragmentTaken) return last ? T.objFosso : T.objAlcapao;
    return last ? T.objUltimaEstilha : F("objEstilha", { n: fragments });
  };
  // Inventário de poções (cargas; comprado na banca do braseiro, usado com Digit1/Digit2).
  // Persiste na run. Começa com 1 Poção de Recuperação (ensina o recurso).
  // O cinto vive no modelo puro (game/run/pocoes.ts); `inv` é o MESMO objeto (alias): nunca reatribuir.
  // Nasce com o legado do perfil (frascos que a Acendedora anterior deixou) e cinto vazio: a Recuperação de
  // Marta mora no nicho do armário de A1. O legado é do PERFIL (sobrevive à descida nova).
  const pocoes = new Pocoes(gameSave?.legado);
  const inv = pocoes.cinto;

  // Contador de Fagulhas (moeda) no HUD.
  const fagulhaEl = document.createElement("div");
  fagulhaEl.className = "hud-fagulha";
  fagulhaEl.style.display = "none";
  document.body.appendChild(fagulhaEl);
  const updateFagulhaHud = (): void => {
    fagulhaEl.textContent = `${fagulhas}`;
    fagulhaEl.style.display = gameActive ? "" : "none";
  };
  // Cada morto desperto derrotado credita a Fagulha DELE (cinza quente; varia por tipo).
  platform.events.on<{ reward: number }>("enemy:died", ({ reward }) => {
    fagulhas += reward;
    updateFagulhaHud();
  });

  // Contador de poções no HUD (cargas de cada tipo; esmaece o que estiver em 0).
  const potionsEl = document.createElement("div");
  potionsEl.className = "hud-potions";
  potionsEl.style.display = "none";
  document.body.appendChild(potionsEl);
  // Feedback do gole no slot (redesenho 4.1): o frasco inclina enquanto bebe, esvazia ao gastar a carga,
  // treme se o gole foi cancelado e a Fúria pulsa em brasa enquanto dura. Estado volátil, repintado por updatePotionHud.
  const potFx = { drinking: null as PotionKind | null, drank: null as PotionKind | null, denied: null as PotionKind | null, furia: false };
  const updatePotionHud = (): void => {
    const pot = (kind: "vida" | "furia", key: string, label: string, n: number): string => {
      const cls = ["hud-pot", n > 0 ? "" : "off", potFx.drinking === kind ? "drinking" : "", potFx.drank === kind ? "drank" : "",
        potFx.denied === kind ? "denied" : "", kind === "furia" && potFx.furia ? "on" : ""].filter(Boolean).join(" ");
      return `<span class="${cls}" data-k="${kind}"><i class="hud-fl hud-fl--${kind}"></i><span class="ds-kbd">${key}</span>${label} ×${n}</span>`;
    };
    potionsEl.innerHTML = pot("vida", "1", T.potRecuperacao, pocoes.quantos("vida")) + pot("furia", "2", T.potFuria, pocoes.quantos("furia"));
    potionsEl.style.display = gameActive ? "" : "none";
  };
  const potPulse = (field: "drank" | "denied", kind: PotionKind, ms: number): void => {
    potFx[field] = kind;
    updatePotionHud();
    window.setTimeout(() => { if (potFx[field] === kind) { potFx[field] = null; updatePotionHud(); } }, ms);
  };

  // Barra de BRASA (ultimate "Erupção", modelo God Gauge do Hades): enche causando E sofrendo
  // dano; cheia (100), [X] libera a chuva de fogo. Mora aqui (app) para não tocar o heroCombat.
  let brasaMeter = 0;
  const brasaWrap = document.createElement("div");
  brasaWrap.className = "ds-bar ds-bar--ember brasa-bar";
  brasaWrap.style.display = "none";
  const brasaLabel = document.createElement("span");
  brasaLabel.className = "ds-bar__label";
  brasaLabel.textContent = T.hudBrasa;
  const brasaFill = document.createElement("div");
  brasaFill.className = "ds-bar__fill";
  brasaFill.style.setProperty("--v", "0%");
  brasaWrap.append(brasaLabel, brasaFill);
  document.body.appendChild(brasaWrap);
  const updateBrasaHud = (): void => {
    brasaFill.style.setProperty("--v", `${Math.round(brasaMeter)}%`);
    brasaLabel.textContent = brasaMeter >= 100 ? `${T.hudBrasa}  ${T.hudErupcao}` : T.hudBrasa;
    brasaWrap.classList.toggle("ready", brasaMeter >= 100);
  };
  // Enche a barra causando dano (combat:hit) e apanhando (hero:hit).
  platform.events.on<{ damage: number }>("combat:hit", ({ damage }) => {
    brasaMeter = Math.min(100, brasaMeter + (damage ?? 8) * 0.7);
    updateBrasaHud();
  });
  platform.events.on("hero:hit", () => {
    brasaMeter = Math.min(100, brasaMeter + 7);
    updateBrasaHud();
  });

  // Aviso na tela quando a câmara é limpa e a passagem abre.
  const promptEl = document.createElement("div");
  promptEl.className = "hud-callout";
  promptEl.textContent = T.promptEstilha;
  document.body.appendChild(promptEl);

  // Marcadores projetados (ícone + anel de compromisso) e o compromisso em curso (porta de pedra). A fase R1 os usa nas peças da antessala.
  const exitMarkers = new ExitMarkers(document.body);
  const commit: Commit = { id: null, t: 0 };
  // ANTESSALA (estado de interação): luz do braseiro (0..1, anima até a meta), porta de pedra, canalização do acender ([R] 1,2 s)
  // e travas que impedem um gesto de repetir sozinho ao voltar de um painel com a tecla ainda apertada.
  let lightT = 0;
  let lightGoal = 0;
  let portaOpen = false;
  let channelT = 0;
  let interactLock = false;
  let interactPrev = false;
  let modalOpen = false; // painel (braseiro, armário, mural) aberto: a simulação está pausada
  let portaAviso = 0; // segundos até poder avisar de novo que a porta de A1 ainda está selada

  // Barra de progresso da canalização do acender (aparece só enquanto canaliza).
  const channelBar = document.createElement("div");
  channelBar.className = "hud-channel";
  const channelFill = document.createElement("div");
  channelFill.className = "hud-channel__fill";
  channelBar.appendChild(channelFill);
  document.body.appendChild(channelBar);

  // Prompt de EXECUÇÃO: aparece quando há inimigo em vacilo (vida baixa) ao alcance.
  const execEl = document.createElement("div");
  execEl.className = "hud-callout hud-callout--danger";
  const paintExec = (): void => {
    execEl.replaceChildren(Object.assign(document.createElement("span"), { className: "ds-kbd", textContent: "F" }), ` ${T.executar}`);
  };
  paintExec();
  document.body.appendChild(execEl);

  // Prompt de PEGAR ARMA (captura de arma): aparece quando há uma arma dropada ao alcance.
  const pickupEl = document.createElement("div");
  pickupEl.className = "hud-callout hud-callout--gold";
  document.body.appendChild(pickupEl);

  // HUD da arma equipada (clava/cajado) com cargas restantes.
  const weaponEl = document.createElement("div");
  weaponEl.className = "hud-weapon";
  weaponEl.style.display = "none";
  document.body.appendChild(weaponEl);

  // Barra do CHEFE (Guardião): topo-centro, aparece só quando o chefe está ativo.
  const bossWrap = document.createElement("div");
  bossWrap.className = "hud-boss";
  const bossName = document.createElement("div");
  bossName.className = "hud-boss__name";
  bossName.textContent = T.guardiao;
  const bossTrack = document.createElement("div");
  bossTrack.className = "hud-boss__track";
  const bossFill = document.createElement("div");
  bossFill.className = "hud-boss__fill";
  bossTrack.appendChild(bossFill);
  bossWrap.append(bossName, bossTrack);
  document.body.appendChild(bossWrap);

  // Retículo de LOCK-ON: marca o alvo travado, projetado na tela a cada frame.
  const reticleEl = document.createElement("div");
  reticleEl.className = "hud-reticle";
  reticleEl.style.display = "none";
  document.body.appendChild(reticleEl);
  const reticleWorld = new Vector3();
  const weaponName = (kind: string): string => (kind === "clava" ? T.armaClava : kind === "espada" ? T.armaEspada : T.armaCajado);
  fagulhaEl.setAttribute("aria-label", T.fagulhaRotulo);
  // Rótulos montados uma vez (barra de Brasa, poções, executar, chefe) acompanham a troca de idioma.
  onLanguageChange(() => {
    updateBrasaHud();
    updatePotionHud();
    paintExec();
    bossName.textContent = T.guardiao;
    fagulhaEl.setAttribute("aria-label", T.fagulhaRotulo);
    exitMarkers.relabel();
  });

  // HUD de jogo (selo de profundidade, objetivo, legendas e toasts). Criado aqui porque o eco
  // do andar e as falas dependem dele; entra na camada de UI mais abaixo.
  const gameHud = new GameHud();
  // Eco (memória ouvida ao ENTRAR) e inscrição (texto GRAVADO na pedra do nicho, lido ao se
  // aproximar) de cada andar. O texto vive em content/codex.ts, junto do decalque da Crônica,
  // para o jogo e a Crônica nunca divergirem. Beats do canon fechado: povo morto -> alguém
  // desceu antes -> o custo -> luto -> a verdade se monta -> confronto (narrativa §0).
  const ECHOES = FLOOR_ECHOES;
  const INSCRIPTIONS = FLOOR_INSCRIPTIONS;

  // Overlay preto para o fade entre andares.
  const fadeEl = document.createElement("div");
  fadeEl.className = "hud-fade";
  document.body.appendChild(fadeEl);
  const fadeTo = (o: number): Promise<void> =>
    new Promise((r) => {
      fadeEl.style.opacity = String(o);
      window.setTimeout(r, 470);
    });

  // Descidas, retry e novo jogo anunciam o andar (eco, stinger, fala do Guardiao) mesmo com a
  // simulacao pausada na transicao; boot e restauracao de save entram em silencio.
  let announceNext = false;
  // Monta a sala `def` no lugar da anterior (câmara ou antessala): descarte, herói na entrada,
  // câmera colada, fagulha cheia e a lista de props/limites que o diretor de combate precisa.
  const mountRoom = (def: RoomDef, perfIndex: number, perfKind: string): Room => {
    currentRoom?.dispose();
    currentBoss = null;
    exitMarkers.clear();
    combat.clearEnemies();
    disposeOrphanSkeletons(scene); // esqueletos/texturas de ossos dos mortos descartados (vazavam por sala)
    const room = buildCryptRoom(scene, cryptCtx, def);
    currentRoom = room;
    perf.logRoom(perfIndex, perfKind); // mede draw calls da sala recem-montada (gate de performance)
    hero.teleport(room.spawn);
    camera.snap(room.spawn); // cola a câmera atrás do herói na nova sala (sem varrer o cenário)
    hero.combat.refillSpark(); // entra com a fagulha cheia
    combat.setEnemyBounds(room.enemyBounds); // inimigos não recuam para trás do altar/paredes
    combat.setStrikeProps(room.strikeProps); // vasos quebráveis / cadeiras chutáveis desta sala
    commit.id = null;
    commit.t = 0;
    return room;
  };

  const enterRoom = (i: number): void => {
    const announce = gameActive || announceNext;
    announceNext = false;
    route.enterCamara(i); // a câmara do andar i começa (a porta de pedra da antessala selou atrás)
    const def: RoomDef = { ...DESCENT[i]! };
    const room = mountRoom(def, i, def.kind);
    floorIndex = i;
    runActive = true; // há uma descida em andamento (persistível)
    roomCleared = false; // passagem selada até limpar a câmara
    passageOpen = false; // alçapão só libera após recuperar a estilha
    fragmentTaken = false; // a estilha deste andar ainda está no relicário
    readShown.clear(); // inscrições do andar anterior não contam mais
    // Mortos despertos do andar: mistura de tipos que endurece com a profundidade
    // (morte permanente: a sala "limpa" ao derrotá-los). Os arquétipos entram em ESCADA,
    // cada um introduzindo um COMPORTAMENTO novo (não só stats): demônio (melee agressivo),
    // espreitador (hit-and-run), conjurador (à distância, força fechar espaço), brutamonte
    // (tanque enorme). Teto ~8 inimigos/sala (spec-vertical-slice §3).
    const ROSTER: SkeletonKind[][] = [
      ["minion"], // 0 abertura: 1 fraco (ensina o laço)
      ["minion", "minion", "demonio"], // 1 estreia o demônio (silhueta nova, pressão leve)
      ["warrior", "arqueiro", "espreitador", "minion"], // 2 estreia o ARQUEIRO (ranged ágil; usa cobertura dos pilares)
      ["warrior", "conjurador", "antigo", "espreitador", "minion"], // 3 pico - estreia o conjurador (à distância)
      ["brutamonte", "arqueiro", "rogue", "demonio"], // 4 brutamonte (tanque) + arqueiro pressionando de longe
      ["sentinela", "espreitador", "arqueiro", "warrior", "rogue"], // 5 elite + pressão mista (ranged + melee)
      ["brutamonte", "antigo", "conjurador", "demonio"], // 6 (sobra: o andar 6 é do CHEFE)
    ];
    const anchor = currentRoom!.enemyAnchor; // centro do spawn (varia com a planta)
    if (def.boss) {
      // Andar do Guardião: 1 contra 1 na arena (surge à frente do altar).
      currentBoss = combat.addBoss(new Vector3(anchor.x, 0, anchor.z + 4));
      currentBoss.bindArena(room.arena); // a arena reage à gangorra de luz da Brasa
      platform.events.emit("crypt:floor", { index: i, kind: def.kind });
      console.log(`[descida] andar ${i + 1}/${DESCENT.length} (${def.kind}): GUARDIÃO`);
      if (announce) { playStinger("guardiao"); window.setTimeout(() => playGuardianVoice("rugido"), 600); } // avistar o Guardião (stinger grave + rugido)
      // Confronto encenado: a Primeira Acendedora fala antes de atacar (canon, narrativa §0).
      if (announce) window.setTimeout(() => { if (combat.bossActive) gameHud.say("voz", T.falaGuardiao1, 5000); }, 1400);
    } else {
      const kinds = ROSTER[i] ?? ["warrior"];
      // W6/Item5: variação por run DETERMINÍSTICA. O jitter de ângulo/raio vem de um PRNG
      // semeado por (runSeed + andar): a mesma run reproduz as mesmas posições (retomar/morrer
      // não embaralha), mas runs diferentes variam. Rejogabilidade barata e estável.
      const rand = mulberry32(runSeed + i * 1009);
      kinds.forEach((kind, e) => {
        const a = (e / Math.max(1, kinds.length)) * Math.PI * 2 + (rand() - 0.5) * 0.9;
        const rx = 4.5 + (rand() - 0.5) * 1.6;
        const rz = 3 + (rand() - 0.5) * 1.2;
        combat.addSkeleton(new Vector3(anchor.x + Math.cos(a) * rx, 0, anchor.z + Math.sin(a) * rz), { kind, respawns: false });
      });
      platform.events.emit("crypt:floor", { index: i, kind: def.kind });
      console.log(`[descida] andar ${i + 1}/${DESCENT.length} (${def.kind}): ${kinds.join(", ")}`);
    }
    combat.wake(0.9); // despertar: os mortos ficam parados por um instante ao entrar
    // ESTILO (Bloco 4, §4.4): profundidade do andar p/ a ambiência; agitação dos mortos no
    // despertar; sussurro espacial do eco pelo lado do nicho. startAmbience é idempotente.
    floorDepth = i / Math.max(1, DESCENT.length - 1);
    startAmbience();
    setAmbience({ depth: floorDepth, danger: 0, urgency: 0 });
    if (announce) {
      if (!def.boss) playStinger("despertar"); // os mortos da câmara acordam (stinger frio)
      playStir(def.boss ? 1 : (ROSTER[i]?.length ?? 1)); // os mortos se agitam ao acordar
      gameHud.say("eco", ECHOES[i] ?? "", 4200); // eco/memória do andar
      playWhisper(Math.sign(currentRoom!.inscriptionPos?.x ?? 0) * 0.6); // o eco sussurra do nicho
    }
    explor.onEnterFloor(i);
  };

  // ANTESSALA: o patamar entre duas câmaras (docs/brasa/redesenho-da-descida.md, seção 2). Sem inimigos, sem eco,
  // sem `crypt:floor` e sem estilha: casa de guarda da ordem, com braseiro, armário, ofício, mural e a porta de pedra
  // (scenes/crypt/antessala). Nasce "limpa". A única saída é a porta de pedra para a câmara `i`.
  // `fresh`: chegada nova (gasto zerado); retomar (Continuar) e recomeçar (derrota) mantêm o gasto, o braseiro e a chama (R7, R8).
  const enterAntessala = (i: number, fresh: boolean): void => {
    const announce = gameActive || announceNext;
    announceNext = false;
    const def = ANTESSALAS[i]!;
    const room = mountRoom({ index: i, kind: "guarda", enemies: 0, antessala: true }, 10 + i, "antessala"); // perf: índices 10+ ficam fora do 1..7 das câmaras
    route.enterAntessala(i, fresh);
    floorIndex = i; // o andar (save, HUD, retry): A(i) e C(i) compartilham o índice
    runActive = true;
    roomCleared = true;
    fragmentTaken = true;
    passageOpen = false; // o alçapão é da câmara; aqui a saída é a porta de pedra (`portaOpen`)
    fragments = i; // uma estilha por câmara já deixada para trás
    readShown.clear();
    promptEl.textContent = "";
    floorDepth = i / Math.max(1, DESCENT.length - 1);
    startAmbience();
    setAmbience({ depth: floorDepth, danger: 0, urgency: 0 });
    // Estado do braseiro e da chama: aceso (derrota, Continuar) nasce já quente; frio nasce frio.
    const st = route.braseiros[i]!;
    lightT = lightGoal = st.aceso ? 1 : 0;
    room.setBrazierLit(lightT);
    room.antessala?.setChama(st.chama);
    room.antessala?.setFrascos(pocoes.nichos[i]!.map((n) => n?.tipo ?? ""));
    portaOpen = false;
    channelT = 0;
    room.antessala?.setPorta(false);
    exitMarkers.set(markerDefs(room.antessala?.interativos ?? []));
    platform.events.emit<EvtAntessalaEnter>(EVT.antessalaEnter, { index: i, id: def.id, fresh });
    if (announce) gameHud.toast(T[def.nome]);
    console.log(`[descida] antessala ${def.id} (antes da câmara ${i + 1}/${DESCENT.length})`);
    explor.onEnterAntessala(i);
  };

  // Dádivas da Brasa: compradas no relicário (custam Fagulha). Cada descida oferece 3 do
  // acervo + a "Lasca de Brasa" GRÁTIS (garante progresso mesmo com a bolsa vazia).
  // Árvore de dádivas da Brasa (W2): três ramos (Agressão / Defesa / Utilidade). A oferta
  // é CURADA: 1 de cada ramo (garante sempre 1 ofensiva + 1 defensiva + 1 de
  // utilidade) + a Lasca grátis. Ver docs/brasa/00-aprofundamento-e-roadmap.md (3.1).
  // O save guarda o `id` (estável entre idiomas); `legacy` é o nome PT de saves antigos.
  type Ramo = "agressao" | "defesa" | "utilidade";
  interface Boon { id: string; legacy: string; cost: number; ramo: Ramo; apply: () => void; }
  const BOONS: Boon[] = [
    // Agressão
    { id: "golpista", legacy: "Golpista", cost: 8, ramo: "agressao", apply: () => hero.combat.addDamageMul(0.12) },
    { id: "queimador", legacy: "Queimador", cost: 9, ramo: "agressao", apply: () => hero.combat.addBurnBoost(2, 1) },
    { id: "sedeDaBrasa", legacy: "Sede da Brasa", cost: 10, ramo: "agressao", apply: () => hero.combat.addLifesteal(ABSORB.sedeDaBrasa.lifestealFrac) },
    // Defesa
    { id: "revestimento", legacy: "Revestimento", cost: 10, ramo: "defesa", apply: () => hero.combat.setDamageCap(22) },
    { id: "folego", legacy: "Fôlego", cost: 8, ramo: "defesa", apply: () => hero.combat.addMaxStamina(25) },
    { id: "peleDeBrasa", legacy: "Pele de Brasa", cost: 9, ramo: "defesa", apply: () => hero.combat.addMaxHealth(25) },
    // Utilidade
    { id: "fagulhaPerene", legacy: "Fagulha Perene", cost: 9, ramo: "utilidade", apply: () => hero.combat.addSparkRegenMul(1.6) },
    { id: "ressonancia", legacy: "Ressonância", cost: 9, ramo: "utilidade", apply: () => hero.combat.enableResonance() },
    { id: "reliquarioQuente", legacy: "Braseiro Quente", cost: 8, ramo: "utilidade", apply: () => hero.combat.setBrazierHealFrac(0.6) },
  ];
  const FREE_BOON: Boon = { id: "lasca", legacy: "Lasca de Brasa", cost: 0, ramo: "defesa", apply: () => hero.combat.addMaxHealth(10) };
  const boonName = (b: Boon): string => T[`boon_${b.id}_n` as StringKey];
  const boonDesc = (b: Boon): string =>
    F(`boon_${b.id}_d` as StringKey, { p: Math.round(ABSORB.sedeDaBrasa.lifestealFrac * 100) });
  const pickFromRamo = (r: Ramo, rand: () => number): Boon => {
    const pool = BOONS.filter((b) => b.ramo === r);
    return pool[Math.floor(rand() * pool.length)]!;
  };

  // --- ANTESSALA: gestos e painéis ---------------------------------------------------------------------------

  const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));
  /** Abre um painel pausando a simulação (sem o mouse preso); ao fechar, retoma e trava o gesto até soltar a tecla. */
  const withModal = async (open: () => Promise<void>): Promise<void> => {
    modalOpen = true;
    gameActive = false;
    document.exitPointerLock();
    try {
      await open();
    } finally {
      modalOpen = false;
      gameActive = true;
      input.clearPressed();
      interactLock = true;
      channelT = 0;
      void doAutosave();
    }
  };

  /** Oferta de dádivas do andar: 1 de cada ramo, determinística pela semente da run (mesma run, mesma oferta). */
  const offerFor = (i: number): Boon[] => {
    const rand = mulberry32(runSeed + (i + 1) * 7919 + 13);
    return [pickFromRamo("agressao", rand), pickFromRamo("defesa", rand), pickFromRamo("utilidade", rand)];
  };
  /** Ofícios que ainda não têm sistema (Estante: livros e Sabedoria; Bancada: preparos). Os sistemas se registram aqui. */
  const oficioUsar: Partial<Record<"estante" | "bancada", (i: number) => void>> = {};

  /** O painel do braseiro: entrega a UMA chama do andar (dádiva, vela da Estante ou pavios da Bancada). */
  const openBraseiroPanel = (): Promise<void> => {
    const i = route.floor;
    const def = ANTESSALAS[i]!;
    const offer = offerFor(i);
    const showBoon = (b: Boon) => ({ id: b.id, cost: b.cost, name: boonName(b), desc: boonDesc(b) });
    return openBoonShop({
      fagulhas: () => fagulhas,
      estado: () => ({ chama: route.braseiros[i]!.chama, estante: def.oficios.includes("estante"), bancada: def.oficios.includes("bancada"), lascaGasta: route.isSpent("lasca") }),
      labels: () => ({ boons: offer.map(showBoon), lasca: showBoon(FREE_BOON) }),
      buyBoon: (id) => {
        const bn = offer.find((b) => b.id === id);
        if (!bn || fagulhas < bn.cost || !route.chamaDisponivel(i)) return false;
        route.gastarChama(i, "dadiva");
        fagulhas -= bn.cost;
        bn.apply();
        purchasedBoons.push(bn.id); // persiste a dádiva (reaplicada ao retomar a run)
        updateFagulhaHud();
        currentRoom?.antessala?.setChama("dadiva");
        return true;
      },
      takeLasca: () => {
        if (route.isSpent("lasca")) return;
        route.markSpent("lasca");
        FREE_BOON.apply();
        purchasedBoons.push(FREE_BOON.id);
      },
      gastarChama: (em) => {
        if (!route.gastarChama(i, em)) return false;
        currentRoom?.antessala?.setChama(em);
        return true;
      },
    });
  };

  /** Acender o braseiro: cura, fecha a Ferida, grava o checkpoint, aquece o mural e abre o painel da chama. */
  const lightBrazier = async (): Promise<void> => {
    const i = route.floor;
    if (!route.inAntessala || route.braseiros[i]!.aceso) return;
    route.acender(i);
    hero.combat.healByMax(hero.combat.brazierHealFrac); // 40% (Braseiro Quente sobe)
    combatHud.flashHeal();
    healChime();
    playStinger("fagulha");
    explor.onBrazierLit(i); // a Ferida fecha por inteiro (sistema de poções)
    lightGoal = 1; // a luz sobe de baixo para cima (coreografia de setBrazierLit)
    platform.events.emit<EvtBraseiroLit>(EVT.braseiroLit, { index: i });
    markCodex(markAcendeu(i + 1));
    updatePotionHud();
    await doAutosave(); // checkpoint: o braseiro aceso
    await sleep(1000); // o jogador vê a luz subir antes do painel
    if (route.inAntessala && route.floor === i && !descending && !defeated && !modalOpen && gameActive) await withModal(openBraseiroPanel);
  };

  /** O armário da ordem (R3): pausa a simulação e espera o painel fechar. Salva a cada mudança. */
  const openArmarioPanel = (): Promise<void> => {
    const i = route.floor;
    return withModal(async () => {
      const h = openArmario({
        pocoes,
        andar: i,
        fagulhas: () => fagulhas,
        gastarFagulhas: (n) => {
          fagulhas -= n;
          updateFagulhaHud();
        },
        onChange: () => {
          updatePotionHud();
          updateFagulhaHud();
          currentRoom?.antessala?.setFrascos(pocoes.nichos[i]!.map((n) => n?.tipo ?? ""));
          platform.events.emit<EvtArmarioChange>(EVT.armarioChange, { index: i });
          void doAutosave();
        },
        deny: denyBlip,
      });
      await h.closed;
    });
  };

  /** O mural (R5): abre a placa DOM com os dois painéis; pausa a simulação enquanto está aberta. */
  let muralPlate: MuralPlate | null = null;
  const readMural = (): void => {
    muralPlate ??= new MuralPlate(ui.hudLayer, {
      isToggleKey: (e) => input.getBindings().interact.includes(e.code),
      onOpen: (andar) => {
        markCodex(markMural(andar));
        platform.events.emit<EvtMuralRead>(EVT.muralRead, { index: andar - 1 });
        playWhisper(0);
      },
      onClose: () => {
        modalOpen = false;
        gameActive = true;
        input.clearPressed();
        interactLock = true;
      },
    });
    modalOpen = true;
    gameActive = false;
    document.exitPointerLock();
    muralPlate.open(route.floor + 1, route.braseiros[route.floor]!.aceso);
  };

  /** Texto da tecla de uma ação (a primeira ligação), para o marcador. */
  const keyText = (action: "interact" | "ember"): string => {
    const code = input.getBindings()[action][0] ?? "";
    return code.startsWith("Key") ? code.slice(3) : code.startsWith("Digit") ? code.slice(5) : code;
  };
  const MARK_COLOR: Record<string, string> = { braseiro: "var(--ember-300)", mural: "var(--gold-300)", armario: "var(--life-400)", estante: "var(--gold-300)", bancada: "var(--life-400)" };
  const markerDefs = (list: Interativo[]): ExitMarkerDef[] =>
    list.map((it) => ({
      id: it.id,
      icon: it.icon,
      color: MARK_COLOR[it.id] ?? "var(--gold-300)",
      name: () => T[it.name],
      promise: () => "",
      key: () => keyText(it.action),
      showWithin: it.radius + 4.5,
      x: it.x,
      y: it.y,
      z: it.z,
    }));

  /**
   * Quadro a quadro na antessala (antes de o herói ler o input): luz do braseiro, porta de pedra, canalização do
   * acender ([R] 1,2 s) e os gestos de cada objeto. [E] também é o golpe de fogo: perto do armário e do ofício
   * o toque de [E] é consumido aqui e abre o objeto (o armário também abre com [R]).
   */
  const updateAntessala = (dt: number): void => {
    const room = currentRoom;
    const ant = room?.antessala;
    if (!room || !ant || !route.inAntessala || modalOpen || descending || defeated) return;
    const i = route.floor;
    const def = ANTESSALAS[i]!;
    const st = route.braseiros[i]!;
    const hx = hero.position.x;
    const hz = hero.position.z;

    if (lightT !== lightGoal) {
      lightT = lightT < lightGoal ? Math.min(lightGoal, lightT + dt / 1.8) : Math.max(lightGoal, lightT - dt / 1.8);
      room.setBrazierLit(lightT);
    }

    // Porta de pedra: abre ao aproximar (em A1, só depois do primeiro acender); 0,4 s diante dela cruza.
    const ex = room.exit;
    const dPorta = Math.hypot(hx - ex.x, hz - ex.z);
    const liberada = !def.prologo || st.aceso;
    const quer = liberada && dPorta <= 5.2;
    if (quer !== portaOpen) {
      portaOpen = quer;
      ant.setPorta(quer);
    }
    portaAviso -= dt;
    if (!liberada && dPorta <= ex.radius + 0.8 && portaAviso <= 0) {
      gameHud.toast(T.antPortaFechada, 2600);
      portaAviso = 5;
    }
    if (portaOpen && stepCommit(commit, dPorta <= ex.radius ? "porta" : null, dt, ROTA.portaSec)) {
      playStinger("fagulha");
      void crossDoor();
      return;
    }

    // Gestos: o objeto mais perto dentro do alcance.
    const heldRaw = input.isHeld("interact");
    if (interactLock && !heldRaw) interactLock = false;
    const held = heldRaw && !interactLock;
    const pressed = held && !interactPrev;
    interactPrev = held;
    let near: Interativo | null = null;
    let best = Infinity;
    for (const it of ant.interativos) {
      const d = Math.hypot(hx - it.x, hz - it.z);
      if (d <= it.radius && d < best) {
        near = it;
        best = d;
      }
    }
    if (near?.id === "braseiro" && !st.aceso) {
      if (held) {
        channelT += dt / ROTA.acenderSec;
        if (channelT >= 1) {
          channelT = 0;
          interactLock = true;
          void lightBrazier();
        }
      } else channelT = 0; // soltou: cancela
    } else channelT = 0;
    if (!near) return;
    switch (near.id) {
      case "braseiro":
        if (st.aceso && pressed) void withModal(openBraseiroPanel); // aceso: [R] reabre o painel (com a chama, ou só mostrando o que cada opção faria)
        break;
      case "mural":
        if (pressed) readMural();
        break;
      case "armario":
        if ((input.consumePressed("ember") || pressed) && !modalOpen) void openArmarioPanel();
        break;
      case "estante":
      case "bancada":
        if ((input.consumePressed("ember") || pressed) && !modalOpen) {
          const usar = oficioUsar[near.id];
          if (usar) usar(i);
          else gameHud.toast(T.antOficioPendente, 2600);
        }
        break;
    }
  };

  /** Desce do alçapão para a antessala do andar seguinte (escada em caracol: o mesmo fade da `transition`), ou fecha a descida no último andar. */
  const advance = async (): Promise<void> => {
    if (floorIndex + 1 >= DESCENT.length) {
      descending = true;
      gameActive = false;
      promptEl.style.opacity = "0";
      document.exitPointerLock();
      await fadeTo(1);
      descentDone = true; // fim do slice: a Brasa foi reavivada
      runActive = false; // run concluída: não retomar
      void doAutosave();
      await fadeTo(0);
      gameActive = true;
      descending = false;
      return;
    }
    playStairs(); // a descida pelo alçapão (passos de pedra descendo)
    await transition(() => enterAntessala(floorIndex + 1, true)); // checkpoint = chegada à antessala (gravado dentro do fade)
  };

  // Troca de lugar com fade, simulação pausada e checkpoint gravado DENTRO do fade (a gravação
  // acabar antes do recarregar da página: o autosave do beforeunload é "dispare e esqueça").
  const transition = async (swap: () => void, save = true): Promise<void> => {
    descending = true;
    gameActive = false;
    promptEl.style.opacity = "0";
    exitMarkers.clear();
    document.exitPointerLock();
    await fadeTo(1);
    announceNext = true;
    swap();
    if (save) await doAutosave();
    await fadeTo(0);
    gameActive = true;
    descending = false;
  };
  /**
   * Porta de pedra da antessala: a câmara do andar começa e sela atrás. Grava o legado do armário (os frascos marcados
   * "para quem descer" só valem ao cruzar). A câmara nunca salva no meio de verdade: Continuar sempre volta à antessala.
   */
  const crossDoor = (): Promise<void> =>
    transition(() => {
      pocoes.cruzarPorta(route.floor);
      enterRoom(route.floor);
    });

  /** Leitura de inscrições/pergaminhos: perto + [R] mostra a lore (uma vez por texto). */
  const updateReadables = (): void => {
    nearReadable = null;
    if (!currentRoom || descending || defeated || !gameActive) return;
    for (const rd of currentRoom.readables) {
      if (readShown.has(rd.text)) continue;
      if (Math.hypot(hero.position.x - rd.x, hero.position.z - rd.z) <= 2.3) { nearReadable = rd; break; }
    }
    if (nearReadable && input.isHeld("interact")) {
      gameHud.say("inscricao", nearReadable.text, 6500);
      readShown.add(nearReadable.text);
      markCodex(markRead(floorIndex + 1)); // inscrição lida: o decalque cai na Crônica
      nearReadable = null;
    }
  };

  /** Chamado no loop: desce quando a sala está limpa e a Acendedora alcança o braseiro. */
  const tryDescend = (): void => {
    if (descending || descentDone || defeated || !currentRoom) return;
    if (!passageOpen) return; // só desce depois de acender a Brasa
    const ex = currentRoom.exit;
    const hx = hero.position.x;
    const hz = hero.position.z;
    const onHatch = Math.hypot(hx - ex.x, hz - ex.z) <= ex.radius;
    if (route.inAntessala) return; // a saída da antessala é a porta de pedra (`updateAntessala`)
    if (onHatch) void advance(); // câmara: pisar no alçapão basta (escada em caracol para a antessala seguinte)
  };

  // Acender a Brasa: roda TODO frame (não no throttle do HUD) para canalização/virada suaves.
  // Fase 1: limpa a sala -> canaliza segurando [R] perto do altar (channelT). Fase 2: vira a
  // luz de fria a quente (lightT) e abre o alçapão (passageOpen).
  const updateIgnite = (dtSec: number): void => {
    if (route.inAntessala) return; // na antessala a barra de canalização é do braseiro (`updateAntessala`)
    // Confronto do Guardião: canalizar a Brasa central (segurar [R] no altar) reacende a
    // chama e EXPÕE o chefe (cambaleio/dano dobrado). Counterplay repetível; a sala do
    // chefe só "limpa" quando ele cai, então isto roda antes do fluxo normal.
    if (currentBoss && combat.bossActive && !descending && !defeated && currentRoom) {
      const b = currentRoom.brazier;
      const near = Math.hypot(hero.position.x - b.x, hero.position.z - b.z) <= 3.4;
      if (near && input.isHeld("interact")) {
        bossChannelT = Math.min(1, bossChannelT + dtSec / BOSS_CHANNEL_SEC);
        if (bossChannelT >= 1) {
          currentBoss.reigniteFromBrazier();
          bossChannelT = 0;
        }
      } else {
        bossChannelT = Math.max(0, bossChannelT - (dtSec / BOSS_CHANNEL_SEC) * 1.5);
      }
      channelBar.style.opacity = bossChannelT > 0.01 ? "1" : "0";
      channelFill.style.width = `${Math.round(bossChannelT * 100)}%`;
      return;
    }
    channelBar.style.opacity = "0"; // sem mais "segurar [R]": recuperar a estilha é por toque
    if (!currentRoom || !roomCleared || passageOpen || descending || defeated) return;
    // RECUPERAR A ESTILHA: sala limpa -> ir ao relicário (altar). Ao tocar, a estilha é colhida,
    // o relicário lampeja e MORRE (não fica um fogo aceso no andar), e o alçapão abre.
    const b = currentRoom.brazier;
    const near = Math.hypot(hero.position.x - b.x, hero.position.z - b.z) <= 3.2;
    if (!fragmentTaken) {
      promptEl.textContent = near ? "" : T.promptEstilha;
      if (near) {
        fragmentTaken = true;
        fragments += 1;
        passageOpen = true;
        explor.onFragmentTaken();
        currentRoom.setCleared(true); // abre o alçapão + acende o feixe da passagem
        currentRoom.setBrazierLit(1); // lampejo do relicário ao ceder a estilha (não permanece)
        window.setTimeout(() => currentRoom?.setBrazierLit(0), 900); // e some logo (sem fogo no andar)
        playStinger("fagulha");
        promptEl.textContent = T.objAlcapao;
        gameHud.toast(F("estilhaRecuperada", { n: fragments }));
        window.setTimeout(() => playDoor("alcapao"), 380); // o alçapão cede
      }
    } else {
      promptEl.textContent = T.objAlcapao;
    }
  };

  // --- Derrota: a fagulha apagou. Tela de fim com recomeço do andar (mantém Fagulha/dádivas). ---
  const retryFloor = (): void => {
    defeated = false;
    combat.resetHeroDeath();
    hero.combat.revive(); // vida cheia
    announceNext = true;
    // Derrota: volta à ANTESSALA do andar (o gasto e a chama ficam como estavam); a câmara é remontada
    // ao cruzar a porta, com os mortos de volta (docs/brasa/redesenho-da-descida.md, 2.5).
    enterAntessala(retryPlace(route.current).index, false);
    gameActive = true;
    gameHud.setVisible(true);
    pauseBtn.style.display = "";
    input.clearPressed();
  };
  const showDefeat = (): void => {
    // Fica acima do HUD (anexada ao body); a própria tela se remove ao escolher.
    const overlay = new DefeatScreen(ctx, { onRetry: retryFloor, onQuit: quitToTitle }).element;
    overlay.style.zIndex = "60";
    document.body.appendChild(overlay);
    overlay.querySelector("button")?.focus();
  };
  // --- Vitória: a Brasa foi reavivada. Tela temática com leaderboard (top 5).
  // VictoryScreen grava o tempo (só se timedRun) e mostra o ranking; consistente com os
  // demais menus (UiManager) em vez do overlay raw-DOM antigo. ---
  const showVictory = (elapsedSec: number): void => {
    ui.replaceAll(new VictoryScreen(ctx, elapsedSec, timedRun));
  };
  platform.events.on("hero:died", () => {
    if (defeated || !gameActive) return;
    defeated = true;
    gameActive = false;
    explor.onHeroDied();
    playStinger("derrota"); // a fagulha apagou (queda menor fria)
    document.exitPointerLock();
    showDefeat();
  });

  // Retoma a descida salva (Fagulha, dádivas, poções, andar) ou começa do topo.
  const restoreRun = (run: RunSave, legadoPerfil: unknown = pocoes.toSaveLegado()): void => {
    fagulhas = run.fagulhas;
    // Cinto, armário e reserva (modelo de poções). Save sem armário (descida antiga): só as cargas legadas.
    pocoes.carregar(
      run.nichos.length ? { cinto: [run.cinto.vida, run.cinto.furia, run.cinto.unguento], nichos: run.nichos, reserva: run.reserva } : undefined,
      legadoPerfil,
      { pocaoVida: run.pocaoVida, pocaoFuria: run.pocaoFuria, unguento: run.unguento }
    );
    runSeed = run.seed > 0 ? run.seed : newSeed(); // legado (seed 0): gera uma para esta retomada
    const place = route.load(run); // Continuar: sempre na antessala do andar salvo (nunca no meio de uma luta)
    explor.restore(run);
    timedRun = false; // run retomada não conta para o leaderboard (tempo não é justo)
    purchasedBoons.length = 0;
    const all = [...BOONS, FREE_BOON];
    for (const name of run.upgrades) {
      const bn = all.find((b) => b.id === name || b.legacy === name); // saves antigos guardavam o nome PT
      if (bn) {
        bn.apply();
        purchasedBoons.push(bn.id);
      }
    }
    hero.combat.revive(); // descanso no braseiro: vida cheia (após reaplicar dádivas)
    enterAntessala(Math.min(place.index, DESCENT.length - 1), false);
    updateFagulhaHud();
    updatePotionHud();
  };
  // Zera a run (jogo novo): Fagulha, poções, dádivas e o herói voltam ao estado-base.
  const resetRun = (): void => {
    fagulhas = 0;
    pocoes.reiniciar(); // cinto, armário e reserva de descida nova (o legado do perfil fica)
    purchasedBoons.length = 0;
    runSeed = newSeed(); // nova run: nova semente
    route.reset(); // de volta à antessala A1, sem histórico
    explor.forget();
    fragments = 0;
    timedRun = true; // jogada do começo nesta sessão: vale para o leaderboard
    runStartedAt = performance.now();
    descentDone = false;
    winShown = false;
    defeated = false;
    hero.combat.resetUpgrades();
    brasaMeter = 0;
    updateFagulhaHud();
    updatePotionHud();
    updateBrasaHud();
  };
  if (gameSave?.run.active) restoreRun(gameSave.run, gameSave.legado);
  else enterAntessala(0, true);

  // Beber poção (Digit1 = Recuperação, Digit2 = Fúria). O toque vira um PEDIDO de gole (HeroCombat.requestDrink,
  // com o mesmo buffer de entrada do combate); a carga só é gasta, e o efeito aplicado, no commit do gesto (0,30 s).
  const drinkFx = new DrinkFx(scene, () => platform.settings.get().reducedMotion);
  hero.combat.setDrinkHandlers({
    start: (kind) => {
      potFx.drinking = kind;
      updatePotionHud();
      playDrink(kind, "cork");
    },
    commit: (kind) => {
      if (kind === "vida") {
        // Guarda de desperdício também no commit: se a vida encheu no meio do gesto, a carga NÃO é gasta.
        if (inv.vida <= 0 || hero.combat.healthFraction >= 0.999) return false;
        inv.vida -= 1;
        hero.combat.heal(hero.combat.maxHealth * POTIONS.vida.healFrac);
        combatHud.flashHeal();
      } else if (kind === "furia") {
        if (inv.furia <= 0) return false;
        inv.furia -= 1;
        hero.combat.applyDamageBuff(POTIONS.furia.dmgBonus, POTIONS.furia.durationSec);
      } else {
        return false; // Unguento: só existe com a Ferida (redesenho 4.3)
      }
      potFx.drinking = null;
      potPulse("drank", kind, 650);
      playDrink(kind, "sip");
      drinkFx.play(kind);
      return true;
    },
    cancel: (kind, reason) => {
      potFx.drinking = null;
      if (reason === "dodge" || reason === "gate") {
        denyBlip();
        potPulse("denied", kind, 400);
      } else updatePotionHud();
    },
  });
  const tryPotions = (): void => {
    if (input.consumePressed("potion1") && inv.vida > 0) {
      if (hero.combat.healthFraction >= 0.999) {
        // Guarda contra desperdício: com a vida cheia o gole nem começa (negativo curto + aviso).
        gameHud.toast(T.potVidaCheia, 1400);
        denyBlip();
      } else {
        hero.combat.requestDrink("vida");
      }
    }
    if (input.consumePressed("potion2") && inv.furia > 0) hero.combat.requestDrink("furia");
    // Execução (F): mata o inimigo em vacilo (vida baixa) ao alcance, com cura + Fagulha + VFX.
    if (input.consumePressed("execute")) combat.executeNearest();
    // Ultimate (X): só com a barra de Brasa cheia. Limpa a arena (chuva de fogo).
    if (input.consumePressed("ultimate") && brasaMeter >= 100) {
      combat.unleashUltimate();
      brasaMeter = 0;
      updateBrasaHud();
    }
    // Pegar arma (G): equipa a arma dropada (clava do gigante / cajado do mago) ao alcance.
    if (input.consumePressed("pickup") && combat.pickupNearby()) playPickup("item");
    // Lock-on (T): trava/destrava o alvo à frente da câmera (mira gruda; retículo no HUD).
    if (input.consumePressed("lockOn")) combat.toggleLock();
  };

  scene.onAfterPhysicsObservable.add(() => {
    if (!gameActive) return;
    const dt = (scene.deltaTime ?? 0) / 1000;
    tryPotions();
    updateAntessala(dt); // antes do herói ler o input: [E] perto do armário abre o armário, não dispara o golpe de fogo
    // O diretor avança hit stop + alvos e devolve o dt de combate (0 no freeze) do herói.
    const combatDt = combat.update(dt * devTimeScale);
    hero.update(combatDt, input, camera);
    drinkFx.update(dt, hero.position);
    if (hero.combat.buffActive !== potFx.furia) { potFx.furia = hero.combat.buffActive; updatePotionHud(); }
    explor.update(combatDt); // sistemas de exploração (livros, poções, cenário) avançam com o dt de combate
  });
  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000;
    camera.update(hero.position, dt);
    // ÁUDIO: passos pela distância percorrida (velocidade plana do herói; pula teletransporte).
    {
      const hp = hero.position;
      if (gameActive && !descending && dt > 0 && stepPx !== null) {
        const sp = Math.hypot(hp.x - stepPx, hp.z - stepPz) / dt;
        if (sp < 14) updateFootsteps(dt, sp, Math.abs(hp.y - stepPy) / dt < 1.5, floorIndex);
      }
      stepPx = hp.x;
      stepPy = hp.y;
      stepPz = hp.z;
    }
    // ESTILO (Bloco 4, §4.4a): ambiência adaptativa. updateAmbience todo frame (batida da
    // Brasa); setAmbience throttled (4x/s) para não agendar rampas demais.
    if (gameActive) {
      updateAmbience(dt);
      ambAcc += dt;
      if (ambAcc >= 0.25) {
        ambAcc = 0;
        const danger = combat.bossActive
          ? 0.55 + 0.45 * (1 - combat.bossFraction)
          : Math.min(1, combat.aliveEnemyCount / 4);
        const urgency = combat.bossActive ? 1 - combat.bossBrasaLight : 0;
        setAmbience({ depth: floorDepth, danger, urgency });
      }
    }
  });

  // --- UI (overlay HTML/CSS) + plataforma de save ---
  const ui = new UiManager();
  const prefs = platform.settings.get();
  ui.setUiScale(prefs.uiScale);
  ui.setHighContrast(prefs.highContrast);
  const applyQuality = (q: Quality): void => {
    engine.setHardwareScalingLevel(q === "alto" ? 1 : q === "medio" ? 1.25 : 1.6);
    scene.shadowsEnabled = q !== "baixo";
  };
  applyQuality(prefs.quality);
  const autosave = createAutosaveIndicator();
  ui.hudLayer.appendChild(autosave.element);
  const pauseBtn = createPauseButton(() => pauseGame());
  pauseBtn.style.display = "none";
  ui.hudLayer.appendChild(pauseBtn);

  ui.hudLayer.appendChild(gameHud.root);
  gameHud.setVisible(false);

  const combatHud = new CombatHud();
  // Acessibilidade: "reduzir movimento" vale para a UI (classe no <html>), o shake da câmera e
  // as molduras de flash do combate, no boot e ao vivo (Opções).
  const applyReducedMotion = (on: boolean): void => {
    ui.setReducedMotion(on);
    camera.setShakeEnabled(!on);
    combatHud.setReducedFlashes(on);
  };
  applyReducedMotion(prefs.reducedMotion);
  ui.hudLayer.appendChild(combatHud.vignette);
  ui.hudLayer.appendChild(combatHud.feedback);
  ui.hudLayer.appendChild(combatHud.root);
  ui.hudLayer.appendChild(combatHud.hint);
  combatHud.setVisible(false);
  platform.events.on("hero:hit", () => {
    combatHud.flashDamage();
    if (channelT > 0) {
      channelT = 0; // levou um golpe: o acender cancela
      interactLock = true;
    }
  });
  // Feedback POSITIVO (W6): acerto sem bloqueio -> dourado; bloqueio/parry -> bronze; cura -> verde.
  // Dicas curtas de controle nas duas primeiras salas da primeira partida (uma vez por instalação).
  const onboarding = new Onboarding({ hud: combatHud, bindings: () => input.getBindings(), isActive: () => gameActive && !pausedOpen && !ui.hasScreens });
  platform.events.on<{ guarded?: boolean }>("combat:hit", ({ guarded }) => {
    if (!guarded) combatHud.flashHit();
  });
  platform.events.on("hero:block", () => combatHud.flashBlock());
  platform.events.on("hero:heal", () => combatHud.flashHeal());
  platform.events.on("hero:perfect", () => combatHud.flashPerfect());
  // Numeros de dano flutuantes (inimigos via `combat:damage`; herói pela variação de vida em update()).
  const damageNumbers = new DamageNumbers({ scene, engine, reducedMotion: () => platform.settings.get().reducedMotion }).bindEvents(platform.events);

  let pausedOpen = false;

  const startedAt = performance.now();
  let rev = carregado?.rev ?? 0;
  const snapshot = (): SaveData => {
    const prog = platform.progression.state();
    return {
      schemaVersion: SAVE_SCHEMA_VERSION,
      rev: ++rev,
      updatedAt: Date.now(),
      profileId: profile.id,
      points: platform.score.total,
      playtimeSec: Math.round((performance.now() - startedAt) / 1000),
      summary: `${T.nomeCapitulo} · ${progressPercent(prog)}%`,
      game: {
        chapter: prog.chapterId,
        checkpoint: prog.checkpointId,
        objectives: prog.objectivesDone,
        inkState: "",
        achievements: platform.achievements.all(),
        codex: codex.all(),
        character,
        run: {
          active: runActive,
          floorIndex,
          fagulhas,
          pocaoVida: inv.vida,
          pocaoFuria: inv.furia,
          upgrades: purchasedBoons,
          seed: runSeed,
          // exploração: padrão, depois o que os sistemas registrados possuem, por fim a rota
          ...exploracaoDefaults(),
          ...explor.snapshot(),
          ...route.save(),
          // poções: o modelo (cinto, armário, reserva) é o dono; `pocaoVida`, `pocaoFuria` e `unguento` seguem como espelho legado
          cinto: { vida: inv.vida, furia: inv.furia, unguento: inv.unguento },
          nichos: pocoes.toSaveRun().nichos,
          reserva: pocoes.toSaveRun().reserva,
          unguento: inv.unguento,
        },
        legado: pocoes.toSaveLegado(),
      },
    };
  };
  const doAutosave = async (): Promise<void> => {
    await platform.save.save(SLOT, snapshot());
    autosave.flash();
  };

  platform.events.on<{ id: string }>("objective:done", ({ id }) => {
    const ach = achievementForObjective(id);
    if (ach && platform.achievements.unlock(ach.id)) {
      const t = itemText("ach_", ach);
      gameHud.notify(t.name, t.description);
      console.log(`[conquista] desbloqueada: ${ach.id}`);
    }
  });

  // Gatilhos de objetivo por proximidade na sala.
  const objectives = allObjectives();
  function checkObjectives(): void {
    if (route.inAntessala) return; // os pontos de objetivo são coordenadas das câmaras; a antessala tem outra planta
    const px = hero.position.x;
    const pz = hero.position.z;
    for (const o of objectives) {
      if (!o.near || platform.progression.isDone(o.id)) continue;
      if (Math.hypot(px - o.near.x, pz - o.near.z) <= o.near.radius) {
        if (platform.progression.completeObjective(o.id)) {
          platform.score.add(o.points);
          platform.events.emit("objective:done", { id: o.id, points: o.points });
          console.log(`[progressão] objetivo concluído: ${o.id} (+${o.points} pts)`);
          void doAutosave();
        }
      }
    }
  }

  function startGame(): void {
    gameActive = true;
    pausedOpen = false;
    pauseBtn.style.display = "";
    gameHud.setVisible(true);
    input.clearPressed();
    stopTitleAmbience(); // o ambiente da tela-título só toca fora do jogo
    startMusic(); // trilha dinâmica da descida (frio/combate/quente)
    ui.clear();
    updateFagulhaHud();
    updatePotionHud(); // semeia o HUD de poções com as cargas atuais
    combat.wake(1.0); // despertar do andar atual ao (re)entrar no jogo
    if (!route.inAntessala) gameHud.say("eco", ECHOES[floorIndex] ?? "", floorIndex === 0 ? 5200 : 4200); // a antessala não tem eco
  }
  // Do título (ou de um save) para a descida SEM corte seco: escurece por cima do menu, monta a
  // sala atrás do preto e revela com o herói já no quadro. A simulação só liga depois do preto.
  let enteringGame = false;
  const intoGame = async (setup?: () => void | Promise<void>): Promise<void> => {
    if (enteringGame) return;
    enteringGame = true;
    try {
      await fadeTo(1);
      await setup?.();
      startGame();
      await fadeTo(0);
    } finally {
      enteringGame = false;
    }
  };
  function pauseGame(): void {
    if (pausedOpen) return;
    gameActive = false;
    pausedOpen = true;
    pauseBtn.style.display = "none";
    gameHud.setVisible(false);
    document.exitPointerLock();
    ui.push(new PauseScreen(ctx));
  }
  function quitToTitle(): void {
    gameActive = false;
    pausedOpen = false;
    pauseBtn.style.display = "none";
    gameHud.setVisible(false);
    document.exitPointerLock();
    void doAutosave();
    stopMusic(); // a trilha da descida só toca em jogo
    ui.replaceAll(new MainMenuScreen(ctx));
    startTitleAmbience(); // retoma o ambiente ao voltar para o título
  }

  const loadedPlaytime = carregado?.playtimeSec ?? 0;
  const ctx: UiContext = {
    ui,
    save: platform.save,
    settings: platform.settings,
    profile: platform.profile,
    achievements: platform.achievements,
    progression: platform.progression,
    codex,
    hasAutosave: carregado !== null,
    playtimeSec: () => loadedPlaytime + Math.round((performance.now() - startedAt) / 1000),
    character: () => character,
    continueGame: () => intoGame(),
    newGame: () => ui.push(new CharacterCreateScreen(ctx)),
    startNewGame: (c) =>
      intoGame(() => {
        character = c;
        applyDifficulty();
        // O nome da heroína (Cinza por padrão) é do personagem; o perfil do jogador fica como está.
        rev = 0;
        platform.score.reset(0);
        platform.progression.load({ chapterId: DEFAULT_CHAPTER, checkpointId: "", objectivesDone: [] });
        platform.achievements.load([]);
        codex.load([]); // Crônica nova junto com a jornada nova
        resetRun(); // descida do zero
        announceNext = true;
        enterAntessala(0, true);
      }),
    relocalize: (reopen) => {
      ui.clear();
      ui.push(pausedOpen ? new PauseScreen(ctx) : new MainMenuScreen(ctx));
      ui.push(reopen());
    },
    setReducedMotion: (on) => applyReducedMotion(on),
    setQuality: (q) => applyQuality(q),
    applyKeyBindings: (b) => input.setBindings(b),
    loadSlot: async (slot) => {
      const d = await platform.save.load(slot);
      await intoGame(() => {
        if (d) {
          rev = d.rev;
          platform.score.reset(d.points);
          const g = readGameSave(d.game);
          character = g.character;
          applyDifficulty();
          platform.progression.load({
            chapterId: g.chapter || DEFAULT_CHAPTER,
            checkpointId: g.checkpoint,
            objectivesDone: g.objectives,
          });
          platform.achievements.load(g.achievements);
          codex.load(g.codex);
          if (g.run.active) restoreRun(g.run, g.legado);
          else {
            resetRun();
            announceNext = true;
            enterAntessala(0, true);
          }
        }
      });
    },
    resume: () => {
      ui.clear();
      gameActive = true;
      pausedOpen = false;
      pauseBtn.style.display = "";
      gameHud.setVisible(true);
      input.clearPressed();
    },
    quitToTitle: () => quitToTitle(),
    objective: () => descentObjective(),
    saveNow: () => doAutosave(),
    saveToSlot: (slot) => platform.save.save(slot, snapshot()),
  };

  window.addEventListener("keydown", (e) => {
    if (e.code !== "Escape") return;
    if (gameActive) pauseGame();
    else if (ui.depth > 1) ui.back();
    else if (pausedOpen) ctx.resume();
  });

  // --- Atalhos de DEBUG (só em `npm run dev`; o Vite remove em produção) ---
  // Pra caçar soft-locks e testar a descida sem jogar tudo: pular andar, ir ao chefe,
  // limpar a sala e curar. Não conflitam com o input de jogo (teclas livres).
  if (import.meta.env.DEV) {
    window.addEventListener("keydown", (e) => {
      if (!gameActive) return;
      const last = DESCENT.length - 1;
      switch (e.code) {
        case "BracketRight": // ] -> próximo andar
          enterRoom(Math.min(floorIndex + 1, last));
          break;
        case "BracketLeft": // [ -> andar anterior
          enterRoom(Math.max(0, floorIndex - 1));
          break;
        case "Backslash": // \ -> pula direto pro Guardião
          enterRoom(last);
          break;
        case "KeyK": // limpa a sala (mata todos) -> abre a canalização do braseiro
          combat.clearEnemies();
          break;
        case "KeyH": // cura cheia
          hero.combat.healByMax(1);
          break;
        default:
          return;
      }
      e.preventDefault();
      console.log(`[debug] ${e.code} -> andar ${floorIndex + 1}/${DESCENT.length}`);
    });
  }

  document.addEventListener("pointerlockchange", () => {
    if (gameActive && document.pointerLockElement === null) pauseGame();
  });

  window.setInterval(() => {
    if (gameActive) void doAutosave();
  }, 30000);
  window.addEventListener("beforeunload", () => {
    if (gameActive) void doAutosave();
  });

  loading.classList.add("ld-out"); // dissolve a tela de carregamento (index.html) em vez de cortá-la
  window.setTimeout(() => { loading.hidden = true; }, 700);
  fpsEl.hidden = false;
  ui.replaceAll(new MainMenuScreen(ctx));
  startTitleAmbience(); // ambiente de brasa da tela-título (entra após o 1o gesto)

  let acc = 0;
  let hudAcc = 0;
  let hudAccGame = 0;
  engine.runRenderLoop(() => {
    scene.render();
    perf.update(); // gate de performance: draw calls/fps por frame + log por sala
    const dt = engine.getDeltaTime();
    tweens.update(dt / 1000); // ESTILO (Bloco 2): avança o juice com o dt real
    acc += dt;
    hudAcc += dt;
    hudAccGame += dt;
    // Qualquer tela de UI aberta (pilha do UiManager ou overlay anexado ao body: derrota,
    // braseiro) esconde o texto de história, avisos e contadores do jogo (ver theme.css).
    document.documentElement.classList.toggle("ui-open", ui.hasScreens || document.body.querySelector(":scope > .menu-backdrop") !== null);
    combatHud.setVisible(gameActive);
    promptEl.style.opacity = gameActive && roomCleared && !descending && !descentDone && !route.inAntessala ? "1" : "0";
    fagulhaEl.style.display = gameActive && !descending ? "" : "none";
    potionsEl.style.display = gameActive && !descending ? "" : "none";
    execEl.style.opacity = gameActive && !descending && combat.executePromptPos() ? "1" : "0";
    brasaWrap.style.display = gameActive && !descending ? "" : "none";
    const dropName = gameActive && !descending ? combat.nearbyDrop() : null;
    if (dropName) {
      pickupEl.replaceChildren(Object.assign(document.createElement("span"), { className: onboarding.pending("pickup") ? "ds-kbd ob-pulse" : "ds-kbd", textContent: "G" }), ` ${F("pegar", { nome: weaponName(dropName) })}`);
      pickupEl.style.opacity = "1";
    } else {
      pickupEl.style.opacity = "0";
    }
    const wpn = gameActive && !descending ? combat.weaponHud : null;
    if (wpn) {
      weaponEl.textContent = `${weaponName(wpn.kind)} (${wpn.charges}${wpn.kind === "cajado" ? "x" : ""})`;
      weaponEl.style.display = "";
    } else {
      weaponEl.style.display = "none";
    }
    // Inscrição por proximidade: ao chegar perto do nicho, a pedra "se lê".
    const insc = currentRoom?.inscriptionPos; // nulo na antessala
    if (gameActive && !descending && insc &&
      Math.hypot(hero.position.x - insc.x, hero.position.z - insc.z) <= 3.0) {
      gameHud.setInscription(INSCRIPTIONS[floorIndex] ?? "");
      markCodex(markRead(floorIndex + 1)); // a pedra se lê ao chegar perto: o decalque cai na Crônica
    } else {
      gameHud.setInscription(null);
    }
    // Retículo de lock-on: projeta o alvo travado para a tela.
    const lockPos = gameActive && !descending ? combat.getLockedPos() : null;
    const lockCam = scene.activeCamera;
    if (lockPos && lockCam) {
      reticleWorld.set(lockPos.x, lockPos.y, lockPos.z);
      const v = Vector3.Project(
        reticleWorld,
        Matrix.IdentityReadOnly,
        scene.getTransformMatrix(),
        lockCam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
      );
      if (v.z > 0 && v.z < 1) {
        reticleEl.style.left = `${v.x}px`;
        reticleEl.style.top = `${v.y}px`;
        reticleEl.style.display = "";
      } else {
        reticleEl.style.display = "none";
      }
    } else {
      reticleEl.style.display = "none";
    }
    const bf = combat.bossFraction;
    if (gameActive && !descending && bf >= 0) {
      bossWrap.style.opacity = "1";
      bossFill.style.width = `${Math.round(bf * 100)}%`;
    } else {
      bossWrap.style.opacity = "0";
    }
    if (gameActive) {
      // Trilha por estado: combate (inimigos vivos) -> quente (Brasa acesa) -> frio (explorando).
      setMusicState(combat.enemiesAlive > 0 ? "combate" : (route.inAntessala ? route.braseiros[floorIndex]!.aceso : passageOpen) ? "quente" : "frio");
    }
    if (gameActive) {
      combatHud.update(hero.combat.healthFraction, hero.combat.staminaFraction, hero.combat.sparkCharges, hero.combat.sparkChargeMax, dt / 1000);
      combatHud.setResonance(hero.combat.resonanceStreak, hero.combat.resonanceActive);
      onboarding.update(dt / 1000, { floor: floorIndex, enemiesAlive: combat.enemiesAlive, nearDrop: !!dropName, nearReadable: !!nearReadable });
    }
    const hc = hero.combat;
    damageNumbers.update(dt / 1000, gameActive && !descending ? { hp: hc.healthFraction * hc.maxHealth, max: hc.maxHealth, x: hero.position.x, y: hero.position.y, z: hero.position.z } : null);
    if (gameActive) {
      updateIgnite(dt / 1000); // recuperar estilha / abrir passagem
      tryDescend(); // o alçapão da câmara (a porta de pedra da antessala é de `updateAntessala`)
    }
    if (exitMarkers.active) {
      const cam = scene.activeCamera;
      const show = gameActive && !descending && !modalOpen && cam;
      exitMarkers.update(
        (x, y, z) => {
          if (!show || !cam) return null;
          reticleWorld.set(x, y, z);
          const v = Vector3.Project(reticleWorld, Matrix.IdentityReadOnly, scene.getTransformMatrix(), cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
          const k = engine.getHardwareScalingLevel(); // render px -> px CSS
          return v.z > 0 && v.z < 1 ? { x: v.x * k, y: v.y * k } : null;
        },
        hero.position,
        commit,
        (id) => (id === "braseiro" ? channelT : commit.id === id ? Math.min(1, commit.t / ROTA.portaSec) : 0)
      );
    }
    if (gameActive && !descending && codexNews.length) {
      // Aviso "Nova página na Crônica" num momento calmo (nunca durante o fade entre andares).
      gameHud.notifyCodex(codexNews.splice(0).join(", "));
    }
    if (gameActive) {
      updateReadables(); // ler inscrições/pergaminhos ([R] perto)
      if (nearReadable) { promptEl.textContent = T.promptLer; promptEl.style.opacity = "1"; }
      promptEl.classList.toggle("ob-pulse", !!nearReadable && onboarding.pending("read"));
    }
    if (acc > 250) {
      fpsEl.textContent = `${engine.getFps().toFixed(0)} fps`;
      acc = 0;
    }
    if (hudAcc > 90) {
      hudAcc = 0;
      gameHud.update({ floor: floorIndex, total: DESCENT.length, objective: descentObjective(), antessala: route.inAntessala });
    }
    if (gameActive && hudAccGame > 90) {
      hudAccGame = 0;
      checkObjectives();
      // Câmara limpa: libera a CANALIZAÇÃO do acender (a passagem só abre ao acender a Brasa).
      if (currentRoom && !roomCleared && combat.enemiesAlive === 0) {
        roomCleared = true;
        markCodex(markCleared(floorIndex + 1)); // o que enfrentou (a linha "o que vem" do decalque)
        fagulhas += CLEAR_BONUS; // recompensa por limpar a câmara
        updateFagulhaHud();
        if (!DESCENT[floorIndex]?.boss) playStinger("limpa"); // alívio curto da câmara limpa

        // Confronto encenado: ao cair, o Guardião (a Primeira) sussurra a verdade (canon §0).
        if (DESCENT[floorIndex]?.boss) {
          gameHud.say("voz", T.falaGuardiao2, 6500);
          markCodex(MARK_BOSS_DOWN); // o Guardião sussurrou a verdade: a Primeira entra na Crônica
        }
      }
      if (descentDone && !winShown) {
        winShown = true;
        setMusicState("quente"); // crossfade para o tema morno (reavivar)
        playStinger("reavivar"); // a Brasa volta a arder (arpejo ascendente)
        currentRoom?.setBrazierLit(1); // a luz vira plena
        gameHud.scene(T.brasaVoltou, 3600);
        const elapsed = (performance.now() - runStartedAt) / 1000; // tempo da descida (leaderboard)
        // Após o texto de vitória, abre o painel com o tempo + o ranking local.
        window.setTimeout(() => {
          gameActive = false;
          document.exitPointerLock();
          showVictory(elapsed);
        }, 3200);
      }
    }
  });

  window.addEventListener("resize", () => engine.resize());
}

main().catch((err) => {
  console.error(err);
  const loading = document.getElementById("loading");
  const text = document.getElementById("loading-text");
  if (loading && text) {
    const msg = err instanceof Error ? err.message : String(err);
    text.textContent = F("erroIniciar", { msg });
    loading.classList.add("ld-error");
  }
});
