import { Scene, Vector3 } from "@babylonjs/core";
import { createEngine, el, enableHavokPhysics, InputState, ThirdPersonCamera, UiManager } from "@engine";
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
  ProfileScreen,
  WorldMapScreen,
  CharacterCreateScreen,
  GameHud,
  DEFAULT_CHAPTER,
  DEFAULT_CHARACTER,
  allObjectives,
  chapterName,
  progressPercent,
  readGameSave,
  achievementForObjective,
  setLanguage,
  createAutosaveIndicator,
  createPauseButton,
  configureUiSound,
  configureCombatSound,
  configureTitleAmbience,
  startTitleAmbience,
  stopTitleAmbience,
  configureMusic,
  startMusic,
  stopMusic,
  setMusicState,
  CombatDirector,
  CombatHud,
  DIFFICULTY_DAMAGE_TAKEN,
  POTIONS,
  ABSORB,
  type UiContext,
  type CharacterSave,
  type RunSave,
} from "@game";
import { SAVE_SCHEMA_VERSION, requestPersistentStorage } from "@platform";
import type { Quality, SaveData } from "@platform";
import { buildPlatform } from "./services";

/**
 * CAMADA APP - composition root de BRASA. Cria a ENGINE, monta a PLATAFORMA, instancia
 * o JOGO (a Acendedora numa sala-cripta) e liga o fluxo de telas (menu -> jogo -> pausa)
 * com a UI. Único lugar que conhece as três camadas ao mesmo tempo. O protótipo carrega
 * UMA sala-cripta fechada (regime leve, sem mundo aberto nem streaming).
 */
async function main(): Promise<void> {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const loading = document.getElementById("loading")!;
  const hud = document.getElementById("hud")!;
  const fpsEl = document.getElementById("fps")!;
  const stage = (msg: string) => {
    console.log(`[app] ${msg}`);
    loading.textContent = msg;
  };

  // --- ENGINE ---
  stage("Iniciando engine (WebGPU/WebGL2)...");
  const engine = await createEngine(canvas);
  console.log(`[app] engine pronta: ${engine.constructor.name}`);
  const scene = new Scene(engine);

  stage("Carregando física (Havok)...");
  await enableHavokPhysics(scene, WORLD_GRAVITY);

  // --- PLATAFORMA ---
  const platform = buildPlatform();
  setLanguage(platform.settings.get().language); // idioma da UI a partir das preferências
  const sfxVolume = () => {
    const s = platform.settings.get();
    return s.masterVolume * s.sfxVolume;
  };
  configureUiSound(sfxVolume);
  configureCombatSound(sfxVolume);
  configureTitleAmbience(() => {
    const s = platform.settings.get();
    return s.masterVolume * s.musicVolume;
  });
  configureMusic(() => {
    const s = platform.settings.get();
    return s.masterVolume * s.musicVolume;
  });
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

  // --- JOGO: a descida pela cripta (uma sala por vez, com descarte) ---
  stage("Acendendo a fagulha...");
  const spawn = new Vector3(CRYPT_SPAWN.x, 1.5, CRYPT_SPAWN.z);
  const camera = new ThirdPersonCamera(scene, canvas, spawn);
  const cryptCtx = setupCryptScene(scene, camera.camera); // look global (glow/nevoa/luz/sombra/pos)
  stage("Cavando a cripta...");
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

  const combat = new CombatDirector(scene, camera, hero, platform.events);
  const applyDifficulty = (): void =>
    hero.combat.setDamageTakenMultiplier(DIFFICULTY_DAMAGE_TAKEN[character.difficulty] ?? 1);
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
  let floorIndex = 0;
  let descending = false;
  let descentDone = false;
  let roomCleared = false;
  // Acender a Brasa: ao limpar a sala, a Acendedora canaliza no altar (channelT) e a luz
  // vira de fria a quente (lightT); só então o alçapão libera (passageOpen). Ver spec-top5.
  let channelT = 0;
  let lightT = 0;
  let passageOpen = false;
  const CHANNEL_SEC = 1.3; // tempo segurando [R] no altar
  const LIGHT_SEC = 1.0; // duração da virada frio->quente
  let fagulhas = 0; // moeda: cinza quente dos mortos, gasta nas dádivas do braseiro
  let runActive = false; // há uma descida em andamento (para persistência/retomar)
  const purchasedBoons: string[] = []; // nomes das dádivas compradas (reaplicadas ao carregar)
  let defeated = false; // derrota: a fagulha apagou (vida zerou)
  // Declarado cedo: restoreRun() roda no boot e chama updateFagulhaHud/updatePotionHud,
  // que leem gameActive. Se ficasse lá embaixo, daria TDZ ("before initialization").
  let gameActive = false; // simulação ativa (fora de menu/pausa/transição)
  const CLEAR_BONUS = 6;
  // Inventário de poções (cargas; comprado na banca do braseiro, usado com Digit1/Digit2).
  // Persiste na run. Começa com 1 Poção de Recuperação (ensina o recurso).
  const inv = { vida: 1, furia: 0 };

  // Contador de Fagulhas (moeda) no HUD.
  const fagulhaEl = document.createElement("div");
  fagulhaEl.style.cssText =
    "position:fixed;right:16px;top:14px;z-index:35;padding:6px 14px;border-radius:18px;" +
    "background:rgba(12,17,24,0.78);color:#ffcf8a;font:600 16px Cinzel,serif;border:1px solid #6e5a3a;" +
    "pointer-events:none;text-shadow:0 1px 2px #000;display:none;";
  document.body.appendChild(fagulhaEl);
  const updateFagulhaHud = (): void => {
    fagulhaEl.textContent = `✦ ${fagulhas}`;
    fagulhaEl.style.display = gameActive ? "" : "none";
  };
  // Cada morto desperto derrotado credita a Fagulha DELE (cinza quente; varia por tipo).
  platform.events.on<{ reward: number }>("enemy:died", ({ reward }) => {
    fagulhas += reward;
    updateFagulhaHud();
  });

  // Contador de poções no HUD (cargas de cada tipo; esmaece o que estiver em 0).
  const potionsEl = document.createElement("div");
  potionsEl.style.cssText =
    "position:fixed;right:16px;top:48px;z-index:35;padding:6px 14px;border-radius:14px;" +
    "background:rgba(12,17,24,0.78);color:#cfe;font:600 14px Cinzel,serif;border:1px solid #4a5a6e;" +
    "pointer-events:none;text-shadow:0 1px 2px #000;display:none;white-space:nowrap;";
  document.body.appendChild(potionsEl);
  const updatePotionHud = (): void => {
    const dim = (n: number): string => (n > 0 ? "#cfe" : "#5a6a78");
    potionsEl.innerHTML =
      `<span style="color:${dim(inv.vida)}">[1] Recuperação x${inv.vida}</span>` +
      `&nbsp;&nbsp;<span style="color:${dim(inv.furia)}">[2] Fúria x${inv.furia}</span>`;
    potionsEl.style.display = gameActive ? "" : "none";
  };

  // Barra de BRASA (ultimate "Erupção", modelo God Gauge do Hades): enche causando E sofrendo
  // dano; cheia (100), [X] libera a chuva de fogo. Mora aqui (app) para não tocar o heroCombat.
  let brasaMeter = 0;
  const brasaWrap = document.createElement("div");
  brasaWrap.style.cssText =
    "position:fixed;left:16px;bottom:16px;z-index:35;width:200px;pointer-events:none;display:none;";
  const brasaLabel = document.createElement("div");
  brasaLabel.style.cssText = "color:#ffcf8a;font:600 12px Cinzel,serif;text-shadow:0 1px 2px #000;margin-bottom:3px;letter-spacing:1px;";
  brasaLabel.textContent = "BRASA";
  const brasaTrack = document.createElement("div");
  brasaTrack.style.cssText = "height:10px;border-radius:6px;background:rgba(8,10,14,0.8);border:1px solid #6e5a3a;overflow:hidden;";
  const brasaFill = document.createElement("div");
  brasaFill.style.cssText = "height:100%;width:0%;background:linear-gradient(90deg,#ff7a1c,#ffd089);transition:width .12s linear;";
  brasaTrack.appendChild(brasaFill);
  brasaWrap.append(brasaLabel, brasaTrack);
  document.body.appendChild(brasaWrap);
  const updateBrasaHud = (): void => {
    brasaFill.style.width = `${Math.round(brasaMeter)}%`;
    brasaLabel.textContent = brasaMeter >= 100 ? "BRASA - [X] ERUPÇÃO!" : "BRASA";
    brasaLabel.style.color = brasaMeter >= 100 ? "#ffe9c0" : "#ffcf8a";
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
  promptEl.style.cssText =
    "position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:35;padding:10px 20px;border-radius:8px;" +
    "background:rgba(12,17,24,0.8);color:#ffcf8a;font:600 16px Cinzel,serif;border:1px solid #6e5a3a;opacity:0;" +
    "transition:opacity .3s ease;pointer-events:none;text-shadow:0 1px 2px #000;white-space:nowrap;";
  promptEl.textContent = "Câmara limpa: vá ao altar e segure [R] para acender a Brasa";
  document.body.appendChild(promptEl);

  // Barra de progresso da canalização do acender (aparece só enquanto canaliza).
  const channelBar = document.createElement("div");
  channelBar.style.cssText =
    "position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:35;width:220px;height:8px;" +
    "border-radius:6px;background:rgba(12,17,24,0.7);border:1px solid #6e5a3a;overflow:hidden;opacity:0;" +
    "transition:opacity .15s ease;pointer-events:none;";
  const channelFill = document.createElement("div");
  channelFill.style.cssText = "height:100%;width:0%;background:linear-gradient(90deg,#ff7a1c,#ffd089);";
  channelBar.appendChild(channelFill);
  document.body.appendChild(channelBar);

  // Prompt de EXECUÇÃO: aparece quando há inimigo em vacilo (vida baixa) ao alcance.
  const execEl = document.createElement("div");
  execEl.style.cssText =
    "position:fixed;left:50%;bottom:104px;transform:translateX(-50%);z-index:36;padding:7px 16px;border-radius:8px;" +
    "background:rgba(40,12,8,0.82);color:#ffd089;font:700 15px Cinzel,serif;border:1px solid #c8401c;opacity:0;" +
    "transition:opacity .12s ease;pointer-events:none;text-shadow:0 1px 2px #000;white-space:nowrap;";
  execEl.textContent = "[F] Executar";
  document.body.appendChild(execEl);

  // Barra do CHEFE (Guardião): topo-centro, aparece só quando o chefe está ativo.
  const bossWrap = document.createElement("div");
  bossWrap.style.cssText =
    "position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:36;width:440px;max-width:80vw;" +
    "opacity:0;transition:opacity .3s ease;pointer-events:none;text-align:center;";
  const bossName = document.createElement("div");
  bossName.style.cssText = "color:#e7d2b0;font:600 15px Cinzel,serif;text-shadow:0 1px 3px #000;margin-bottom:4px;letter-spacing:1px;";
  bossName.textContent = "O GUARDIÃO";
  const bossTrack = document.createElement("div");
  bossTrack.style.cssText = "height:12px;border-radius:7px;background:rgba(8,10,14,0.8);border:1px solid #7a2a1c;overflow:hidden;";
  const bossFill = document.createElement("div");
  bossFill.style.cssText = "height:100%;width:100%;background:linear-gradient(90deg,#c8401c,#ff8a2c);transition:width .12s linear;";
  bossTrack.appendChild(bossFill);
  bossWrap.append(bossName, bossTrack);
  document.body.appendChild(bossWrap);

  // Texto de cena (set-pieces): abertura, ecos por andar, reavivar. Fade in/out.
  const storyEl = document.createElement("div");
  storyEl.style.cssText =
    "position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:38;max-width:80vw;text-align:center;" +
    "color:#e7d2b0;font:600 26px Cinzel,serif;text-shadow:0 2px 10px #000,0 0 24px rgba(255,138,44,0.35);" +
    "opacity:0;transition:opacity 1s ease;pointer-events:none;letter-spacing:1px;";
  document.body.appendChild(storyEl);
  let storyTimer = 0;
  const showStory = (text: string, holdMs: number, big = true): void => {
    window.clearTimeout(storyTimer);
    storyEl.textContent = text;
    storyEl.style.fontSize = big ? "26px" : "18px";
    storyEl.style.opacity = "1";
    storyTimer = window.setTimeout(() => {
      storyEl.style.opacity = "0";
    }, holdMs);
  };
  // Um eco/memória por andar (sussurro do passado encenado ao entrar; biblia-narrativa).
  const ECHOES = [
    "A última brasa desce ao poço. O frio reclama o que foi nosso.",
    "Aqui dormem os que zelavam a chama. Agora dormem famintos.",
    "A água subiu e a luz desceu. Ninguém mais reacende as lâmpadas.",
    "Eu carreguei fogo por estes salões. Não me lembro de apagá-los.",
    "Reze ao calor, dizia o velho. O calor não responde mais.",
    "Quanto mais fundo, mais antigo o escuro. E mais faminto.",
    "No fundo, algo guarda a primeira Brasa. Não quer devolvê-la.",
  ];

  // Overlay preto para o fade entre andares.
  const fadeEl = document.createElement("div");
  fadeEl.style.cssText =
    "position:fixed;inset:0;background:#05070b;opacity:0;pointer-events:none;transition:opacity .45s ease;z-index:40;";
  document.body.appendChild(fadeEl);
  const fadeTo = (o: number): Promise<void> =>
    new Promise((r) => {
      fadeEl.style.opacity = String(o);
      window.setTimeout(r, 470);
    });

  const enterRoom = (i: number): void => {
    currentRoom?.dispose();
    combat.clearEnemies();
    const def = DESCENT[i]!;
    currentRoom = buildCryptRoom(scene, cryptCtx, def);
    floorIndex = i;
    runActive = true; // há uma descida em andamento (persistível)
    roomCleared = false; // passagem selada até limpar a câmara
    channelT = 0; // canalização do acender (0..1)
    lightT = 0; // virada de luz frio->quente (0..1)
    passageOpen = false; // alçapão só libera após acender a Brasa
    hero.teleport(currentRoom.spawn);
    camera.snap(currentRoom.spawn); // cola a câmera atrás do herói na nova sala (sem varrer o cenário)
    hero.combat.refillSpark(); // entra no andar com a fagulha cheia
    // Mortos despertos do andar: mistura de tipos que endurece com a profundidade
    // (morte permanente: a sala "limpa" ao derrotá-los). Os arquétipos entram em ESCADA,
    // cada um introduzindo um COMPORTAMENTO novo (não só stats): demônio (melee agressivo),
    // espreitador (hit-and-run), conjurador (à distância, força fechar espaço), brutamonte
    // (tanque enorme). Teto ~8 inimigos/sala (spec-vertical-slice §3).
    const ROSTER: SkeletonKind[][] = [
      ["minion"], // 0 abertura: 1 fraco (ensina o laço)
      ["minion", "minion", "demonio"], // 1 estreia o demônio (silhueta nova, pressão leve)
      ["warrior", "espreitador", "rogue", "minion"], // 2 estreia o espreitador (hit-and-run)
      ["warrior", "conjurador", "antigo", "espreitador", "minion"], // 3 pico - estreia o conjurador (à distância)
      ["brutamonte", "conjurador", "rogue", "demonio"], // 4 estreia o brutamonte (tanque enorme)
      ["sentinela", "espreitador", "conjurador", "warrior", "rogue"], // 5 elite + pressão mista
      ["brutamonte", "antigo", "conjurador", "demonio"], // 6 (sobra: o andar 6 é do CHEFE)
    ];
    const anchor = currentRoom.enemyAnchor; // centro do spawn (varia com a planta)
    if (def.boss) {
      // Andar do Guardião: 1 contra 1 na arena (surge à frente do altar).
      combat.addBoss(new Vector3(anchor.x, 0, anchor.z + 4));
      platform.events.emit("crypt:floor", { index: i, kind: def.kind });
      console.log(`[descida] andar ${i + 1}/${DESCENT.length} (${def.kind}): GUARDIÃO`);
    } else {
      const kinds = ROSTER[i] ?? ["warrior"];
      kinds.forEach((kind, e) => {
        const a = (e / Math.max(1, kinds.length)) * Math.PI * 2;
        combat.addSkeleton(new Vector3(anchor.x + Math.cos(a) * 4.5, 0, anchor.z + Math.sin(a) * 3), { kind, respawns: false });
      });
      platform.events.emit("crypt:floor", { index: i, kind: def.kind });
      console.log(`[descida] andar ${i + 1}/${DESCENT.length} (${def.kind}): ${kinds.join(", ")}`);
    }
    combat.wake(0.9); // despertar: os mortos ficam parados por um instante ao entrar
    if (gameActive) showStory(ECHOES[i] ?? "", 4200, false); // eco/memória do andar
  };

  // Dádivas da Brasa: compradas no braseiro (custam Fagulha). Cada descida oferece 3 do
  // acervo + a "Lasca de Brasa" GRÁTIS (garante progresso mesmo com a bolsa vazia).
  // Árvore de dádivas da Brasa (W2): três ramos (Agressão / Defesa / Utilidade). A oferta
  // do braseiro é CURADA: 1 de cada ramo (garante sempre 1 ofensiva + 1 defensiva + 1 de
  // utilidade) + a Lasca grátis. Ver docs/brasa/00-aprofundamento-e-roadmap.md (3.1).
  type Ramo = "agressao" | "defesa" | "utilidade";
  interface Boon { name: string; desc: string; cost: number; ramo: Ramo; apply: () => void; }
  const BOONS: Boon[] = [
    // Agressão
    { name: "Golpista", desc: "+12% de dano em cada golpe.", cost: 8, ramo: "agressao", apply: () => hero.combat.addDamageMul(0.12) },
    { name: "Queimador", desc: "A Queimadura do fogo dura mais e empilha mais.", cost: 9, ramo: "agressao", apply: () => hero.combat.addBurnBoost(2, 1) },
    { name: "Sede da Brasa", desc: `Cada golpe rouba ${Math.round(ABSORB.sedeDaBrasa.lifestealFrac * 100)}% do dano em vida.`, cost: 10, ramo: "agressao", apply: () => hero.combat.addLifesteal(ABSORB.sedeDaBrasa.lifestealFrac) },
    // Defesa
    { name: "Revestimento", desc: "Nenhum golpe tira mais de 22 de vida.", cost: 10, ramo: "defesa", apply: () => hero.combat.setDamageCap(22) },
    { name: "Fôlego", desc: "+25 de stamina máxima.", cost: 8, ramo: "defesa", apply: () => hero.combat.addMaxStamina(25) },
    { name: "Pele de Brasa", desc: "+25 de vida máxima (e cura).", cost: 9, ramo: "defesa", apply: () => hero.combat.addMaxHealth(25) },
    // Utilidade
    { name: "Fagulha Perene", desc: "A Fagulha regenera 60% mais rápido.", cost: 9, ramo: "utilidade", apply: () => hero.combat.addSparkRegenMul(1.6) },
    { name: "Ressonância", desc: "Acertos encadeados sem apanhar dão até +30% de dano.", cost: 9, ramo: "utilidade", apply: () => hero.combat.enableResonance() },
    { name: "Braseiro Quente", desc: "Acender o braseiro cura 60% da vida (em vez de 40%).", cost: 8, ramo: "utilidade", apply: () => hero.combat.setBrazierHealFrac(0.6) },
  ];
  const FREE_BOON: Boon = { name: "Lasca de Brasa", desc: "+10 de vida. Sempre disponível.", cost: 0, ramo: "defesa", apply: () => hero.combat.addMaxHealth(10) };
  const pickFromRamo = (r: Ramo): Boon => {
    const pool = BOONS.filter((b) => b.ramo === r);
    return pool[Math.floor(Math.random() * pool.length)]!;
  };

  const chooseBoon = (): Promise<void> =>
    new Promise((resolve) => {
      // Oferta CURADA e fixa nesta visita: 1 de cada ramo + a Lasca grátis.
      const offer = [pickFromRamo("agressao"), pickFromRamo("defesa"), pickFromRamo("utilidade"), FREE_BOON];
      const panel = el("div", { class: "menu-panel" });
      const overlay = el("div", { class: "menu-backdrop" }, panel);
      overlay.style.zIndex = "60";
      const close = (): void => {
        document.body.removeChild(overlay);
        resolve();
      };

      // Banca do alquimista: comprar cargas de poção (repetível; respeita saldo e capacidade).
      const shopItem = (label: string, cost: number, cap: number, get: () => number, inc: () => void): HTMLElement => {
        const full = get() >= cap;
        const afford = fagulhas >= cost;
        const note = full ? "cheio" : afford ? `✦ ${cost}` : `✦ ${cost} (sem Fagulha)`;
        const b = el(
          "button",
          { class: "choice" },
          el("strong", { text: `${label}  (x${get()}/${cap})` }),
          el("span", { text: note, style: `color:${full ? "#8c9aa8" : afford ? "#ffcf8a" : "#8c9aa8"};font-weight:600` })
        );
        if (full || !afford) b.style.opacity = "0.45";
        else
          b.addEventListener("click", () => {
            fagulhas -= cost;
            inc();
            updateFagulhaHud();
            updatePotionHud();
            render();
          });
        return b;
      };

      const render = (): void => {
        panel.innerHTML = "";
        const boonCards = offer.map((bn) => {
          const afford = fagulhas >= bn.cost;
          const priceTxt = bn.cost === 0 ? "grátis" : `✦ ${bn.cost}`;
          const c = el(
            "button",
            { class: "choice" },
            el("strong", { text: bn.name }),
            el("span", { text: bn.desc }),
            el("span", { text: afford ? priceTxt : `${priceTxt} (sem Fagulha)`, style: `color:${afford ? "#ffcf8a" : "#8c9aa8"};font-weight:600` })
          );
          if (!afford) c.style.opacity = "0.45";
          else
            c.addEventListener("click", () => {
              if (fagulhas < bn.cost) return; // saldo pode ter mudado comprando poções
              fagulhas -= bn.cost;
              bn.apply();
              purchasedBoons.push(bn.name); // persiste a dádiva (reaplicada ao retomar a run)
              updateFagulhaHud();
              close();
            });
          return c;
        });
        panel.append(
          el("h2", { class: "menu-title", text: "Acender o braseiro" }),
          el("p", { class: "menu-subtitle", text: `A chama curou suas feridas. Você tem ✦ ${fagulhas}.` }),
          el("p", { class: "menu-subtitle", text: "Banca do alquimista (poções para a descida):" }),
          el(
            "div",
            { class: "choice-group" },
            shopItem("Poção de Recuperação", POTIONS.vida.cost, POTIONS.vida.cap, () => inv.vida, () => (inv.vida += 1)),
            shopItem("Elixir de Fúria", POTIONS.furia.cost, POTIONS.furia.cap, () => inv.furia, () => (inv.furia += 1))
          ),
          el("p", { class: "menu-subtitle", text: "Escolha uma dádiva para descer:" }),
          el("div", { class: "choice-group" }, ...boonCards)
        );
      };

      render();
      document.body.appendChild(overlay);
    });

  const advance = async (): Promise<void> => {
    descending = true;
    gameActive = false; // pausa a simulação durante a transição/escolha
    promptEl.style.opacity = "0";
    document.exitPointerLock(); // libera o mouse para clicar na escolha de dádiva
    await fadeTo(1);
    if (floorIndex + 1 >= DESCENT.length) {
      descentDone = true; // fim do slice: a Brasa foi reavivada
      runActive = false; // run concluída: não retomar
      void doAutosave();
    } else {
      hero.combat.healByMax(hero.combat.brazierHealFrac); // acender o braseiro cura (respiro; Braseiro Quente sobe)
      await chooseBoon(); // gasta Fagulha numa dádiva (tela preta atrás)
      enterRoom(floorIndex + 1);
      void doAutosave(); // checkpoint = braseiro aceso: grava a run (andar/Fagulha/dádivas)
    }
    await fadeTo(0);
    gameActive = true;
    descending = false;
  };

  /** Chamado no loop: desce quando a sala está limpa e a Acendedora alcança o braseiro. */
  const tryDescend = (): void => {
    if (descending || descentDone || defeated || !currentRoom) return;
    if (!passageOpen) return; // só desce depois de acender a Brasa
    const ex = currentRoom.exit;
    if (Math.hypot(hero.position.x - ex.x, hero.position.z - ex.z) <= ex.radius) void advance();
  };

  // Acender a Brasa: roda TODO frame (não no throttle do HUD) para canalização/virada suaves.
  // Fase 1: limpa a sala -> canaliza segurando [R] perto do altar (channelT). Fase 2: vira a
  // luz de fria a quente (lightT) e abre o alçapão (passageOpen).
  const updateIgnite = (dtSec: number): void => {
    if (!currentRoom || !roomCleared || passageOpen || descending || defeated) {
      channelBar.style.opacity = "0";
      return;
    }
    if (channelT < 1) {
      const b = currentRoom.brazier;
      const near = Math.hypot(hero.position.x - b.x, hero.position.z - b.z) <= 3.2;
      if (near && input.isHeld("interact")) channelT = Math.min(1, channelT + dtSec / CHANNEL_SEC);
      else channelT = Math.max(0, channelT - dtSec / CHANNEL_SEC); // decai se soltar/afastar
      promptEl.textContent = near
        ? "Segure [R] para acender a Brasa"
        : "Vá até o altar para acender a Brasa";
      channelBar.style.opacity = channelT > 0.01 ? "1" : "0";
      channelFill.style.width = `${Math.round(channelT * 100)}%`;
    } else {
      // Virada de luz frio->quente; ao completar, abre a passagem.
      channelBar.style.opacity = "0";
      lightT = Math.min(1, lightT + dtSec / LIGHT_SEC);
      currentRoom.setBrazierLit(lightT);
      if (lightT >= 1) {
        currentRoom.setCleared(true);
        passageOpen = true;
        promptEl.textContent = "A Brasa arde: pise no feixe de luz para descer";
      }
    }
  };

  // Botão simples no estilo do tema (para os overlays raw-DOM de derrota).
  const btnEl = (label: string, onClick: () => void, primary = false): HTMLElement => {
    const b = el("button", { class: "btn" + (primary ? " btn-primary" : "") }, el("span", { class: "btn-label", text: label }));
    b.addEventListener("click", onClick);
    return b;
  };

  // --- Derrota: a fagulha apagou. Tela de fim com recomeço do andar (mantém Fagulha/dádivas). ---
  const retryFloor = (): void => {
    defeated = false;
    combat.resetHeroDeath();
    hero.combat.revive(); // vida cheia
    enterRoom(floorIndex); // recomeça o ANDAR atual (inimigos restaurados; upgrades/Fagulha mantidos)
    gameActive = true;
    gameHud.setVisible(true);
    pauseBtn.style.display = "";
    input.clearPressed();
  };
  const showDefeat = (): void => {
    const overlay = el(
      "div",
      { class: "menu-backdrop" },
      el(
        "div",
        { class: "menu-panel" },
        el("h2", { class: "menu-title", text: "A fagulha apagou" }),
        el("p", { class: "menu-subtitle", text: "O frio tomou a câmara. Mas a Brasa ainda chama." }),
        el(
          "div",
          { class: "menu-actions" },
          btnEl("Tentar novamente", () => { document.body.removeChild(overlay); retryFloor(); }, true),
          btnEl("Sair para o título", () => { document.body.removeChild(overlay); quitToTitle(); })
        )
      )
    );
    overlay.style.zIndex = "60";
    document.body.appendChild(overlay);
  };
  platform.events.on("hero:died", () => {
    if (defeated || !gameActive) return;
    defeated = true;
    gameActive = false;
    document.exitPointerLock();
    showDefeat();
  });

  // Retoma a descida salva (Fagulha, dádivas, poções, andar) ou começa do topo.
  const restoreRun = (run: RunSave): void => {
    fagulhas = run.fagulhas;
    inv.vida = run.pocaoVida;
    inv.furia = run.pocaoFuria;
    purchasedBoons.length = 0;
    const all = [...BOONS, FREE_BOON];
    for (const name of run.upgrades) {
      const bn = all.find((b) => b.name === name);
      if (bn) {
        bn.apply();
        purchasedBoons.push(name);
      }
    }
    hero.combat.revive(); // descanso no braseiro: vida cheia (após reaplicar dádivas)
    enterRoom(Math.min(run.floorIndex, DESCENT.length - 1));
    updateFagulhaHud();
    updatePotionHud();
  };
  // Zera a run (jogo novo): Fagulha, poções, dádivas e o herói voltam ao estado-base.
  const resetRun = (): void => {
    fagulhas = 0;
    inv.vida = 1;
    inv.furia = 0;
    purchasedBoons.length = 0;
    descentDone = false;
    defeated = false;
    hero.combat.resetUpgrades();
    brasaMeter = 0;
    updateFagulhaHud();
    updatePotionHud();
    updateBrasaHud();
  };
  if (gameSave?.run.active) restoreRun(gameSave.run);
  else enterRoom(0);

  // Beber poção (Digit1 = Recuperação, Digit2 = Fúria). Consome o toque sempre; só aplica
  // o efeito se houver carga e o herói puder beber (fora de golpe/conjuração).
  const tryPotions = (): void => {
    if (input.consumePressed("potion1") && inv.vida > 0 && hero.combat.canDrink) {
      inv.vida -= 1;
      hero.combat.heal(hero.combat.maxHealth * POTIONS.vida.healFrac);
      updatePotionHud();
    }
    if (input.consumePressed("potion2") && inv.furia > 0 && hero.combat.canDrink) {
      inv.furia -= 1;
      hero.combat.applyDamageBuff(POTIONS.furia.dmgBonus, POTIONS.furia.durationSec);
      updatePotionHud();
    }
    // Execução (F): mata o inimigo em vacilo (vida baixa) ao alcance, com cura + Fagulha + VFX.
    if (input.consumePressed("execute")) combat.executeNearest();
    // Ultimate (X): só com a barra de Brasa cheia. Limpa a arena (chuva de fogo).
    if (input.consumePressed("ultimate") && brasaMeter >= 100) {
      combat.unleashUltimate();
      brasaMeter = 0;
      updateBrasaHud();
    }
  };

  scene.onAfterPhysicsObservable.add(() => {
    if (!gameActive) return;
    const dt = (scene.deltaTime ?? 0) / 1000;
    tryPotions();
    // O diretor avança hit stop + alvos e devolve o dt de combate (0 no freeze) do herói.
    const combatDt = combat.update(dt);
    hero.update(combatDt, input, camera);
  });
  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000;
    camera.update(hero.position, dt);
  });

  // --- UI (overlay HTML/CSS) + plataforma de save ---
  const ui = new UiManager();
  const prefs = platform.settings.get();
  ui.setUiScale(prefs.uiScale);
  ui.setReducedMotion(prefs.reducedMotion);
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

  const gameHud = new GameHud(
    () => openHudOverlay((back) => new ProfileScreen(ctx, back)),
    () => openHudOverlay((back) => new WorldMapScreen(ctx, back))
  );
  ui.hudLayer.appendChild(gameHud.root);
  gameHud.setVisible(false);

  const combatHud = new CombatHud();
  ui.hudLayer.appendChild(combatHud.vignette);
  ui.hudLayer.appendChild(combatHud.root);
  ui.hudLayer.appendChild(combatHud.hint);
  combatHud.setVisible(false);
  platform.events.on("hero:hit", () => combatHud.flashDamage());
  platform.events.on("combat:hit", () => combatHud.dismissHint());

  let pausedOpen = false;

  const playerYaw = (): number => {
    const root = hero.model.root;
    return root.rotationQuaternion ? root.rotationQuaternion.toEulerAngles().y : root.rotation.y;
  };

  /** Abre uma tela sobre o jogo (Perfil/Mapa) pausando como um modal; Esc/Voltar retoma. */
  function openHudOverlay(make: (back: () => void) => PauseScreen | ProfileScreen | WorldMapScreen): void {
    if (!gameActive) return;
    gameActive = false;
    pausedOpen = true;
    pauseBtn.style.display = "none";
    gameHud.setVisible(false);
    document.exitPointerLock();
    ui.push(make(() => ctx.resume()));
  }

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
      summary: `${chapterName(prog)} · ${progressPercent(prog)}%`,
      game: {
        chapter: prog.chapterId,
        checkpoint: prog.checkpointId,
        objectives: prog.objectivesDone,
        inkState: "",
        achievements: platform.achievements.all(),
        character,
        run: {
          active: runActive,
          floorIndex,
          fagulhas,
          pocaoVida: inv.vida,
          pocaoFuria: inv.furia,
          upgrades: purchasedBoons,
        },
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
      gameHud.notify(ach.name, ach.description);
      console.log(`[conquista] desbloqueada: ${ach.id}`);
    }
  });

  // Gatilhos de objetivo por proximidade na sala.
  const objectives = allObjectives();
  function checkObjectives(): void {
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
    hud.hidden = false;
    pauseBtn.style.display = "";
    gameHud.setVisible(true);
    input.clearPressed();
    stopTitleAmbience(); // o ambiente da tela-título só toca fora do jogo
    startMusic(); // trilha dinâmica da descida (frio/combate/quente)
    ui.clear();
    updateFagulhaHud();
    updatePotionHud(); // semeia o HUD de poções com as cargas atuais
    combat.wake(1.0); // despertar do andar atual ao (re)entrar no jogo
    showStory(ECHOES[floorIndex] ?? "", floorIndex === 0 ? 5200 : 4200, floorIndex === 0);
  }
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
    hud.hidden = true;
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
    score: platform.score,
    achievements: platform.achievements,
    progression: platform.progression,
    hasAutosave: carregado !== null,
    playtimeSec: () => loadedPlaytime + Math.round((performance.now() - startedAt) / 1000),
    playerPos: () => ({ x: hero.position.x, z: hero.position.z }),
    character: () => character,
    continueGame: () => startGame(),
    newGame: () => ui.push(new CharacterCreateScreen(ctx)),
    startNewGame: (c) => {
      character = c;
      applyDifficulty();
      platform.profile.rename(c.name);
      rev = 0;
      platform.score.reset(0);
      platform.progression.load({ chapterId: DEFAULT_CHAPTER, checkpointId: "", objectivesDone: [] });
      platform.achievements.load([]);
      resetRun(); // descida do zero
      enterRoom(0);
      startGame();
    },
    setQuality: (q) => applyQuality(q),
    applyKeyBindings: (b) => input.setBindings(b),
    loadSlot: async (slot) => {
      const d = await platform.save.load(slot);
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
        if (g.run.active) restoreRun(g.run);
        else {
          resetRun();
          enterRoom(0);
        }
      }
      startGame();
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
    saveNow: () => doAutosave(),
    saveToSlot: (slot) => platform.save.save(slot, snapshot()),
  };

  window.addEventListener("keydown", (e) => {
    if (e.code !== "Escape") return;
    if (gameActive) pauseGame();
    else if (ui.depth > 1) ui.back();
    else if (pausedOpen) ctx.resume();
  });

  document.addEventListener("pointerlockchange", () => {
    if (gameActive && document.pointerLockElement === null) pauseGame();
  });

  window.setInterval(() => {
    if (gameActive) void doAutosave();
  }, 30000);
  window.addEventListener("beforeunload", () => {
    if (gameActive) void doAutosave();
  });

  loading.hidden = true;
  fpsEl.hidden = false;
  ui.replaceAll(new MainMenuScreen(ctx));
  startTitleAmbience(); // ambiente de brasa da tela-título (entra após o 1o gesto)

  // Texto de objetivo ao vivo, guiado pela descida (derrotar -> alcançar o braseiro -> descer).
  let winShown = false;
  const descentObjective = (): string => {
    if (descentDone) return "A Brasa foi reavivada. O frio recua.";
    const n = combat.enemiesAlive;
    const andar = `Andar ${floorIndex + 1}/${DESCENT.length}`;
    if (n > 0) return `${andar}: derrote os mortos despertos (${n})`;
    return `${andar}: alcance o braseiro para descer`;
  };

  let acc = 0;
  let hudAcc = 0;
  engine.runRenderLoop(() => {
    scene.render();
    const dt = engine.getDeltaTime();
    acc += dt;
    hudAcc += dt;
    combatHud.setVisible(gameActive);
    promptEl.style.opacity = gameActive && roomCleared && !descending && !descentDone ? "1" : "0";
    fagulhaEl.style.display = gameActive && !descending ? "" : "none";
    potionsEl.style.display = gameActive && !descending ? "" : "none";
    execEl.style.opacity = gameActive && !descending && combat.executePromptPos() ? "1" : "0";
    brasaWrap.style.display = gameActive && !descending ? "" : "none";
    const bf = combat.bossFraction;
    if (gameActive && !descending && bf >= 0) {
      bossWrap.style.opacity = "1";
      bossFill.style.width = `${Math.round(bf * 100)}%`;
    } else {
      bossWrap.style.opacity = "0";
    }
    if (gameActive) {
      // Trilha por estado: combate (inimigos vivos) -> quente (Brasa acesa) -> frio (explorando).
      setMusicState(combat.enemiesAlive > 0 ? "combate" : passageOpen ? "quente" : "frio");
    }
    if (gameActive) combatHud.update(hero.combat.healthFraction, hero.combat.staminaFraction, hero.combat.sparkFraction, dt / 1000);
    if (gameActive) updateIgnite(dt / 1000); // canalização/virada de luz: todo frame
    if (acc > 250) {
      fpsEl.textContent = `${engine.getFps().toFixed(0)} fps`;
      acc = 0;
    }
    if (gameActive && hudAcc > 90) {
      checkObjectives();
      // Câmara limpa: libera a CANALIZAÇÃO do acender (a passagem só abre ao acender a Brasa).
      if (currentRoom && !roomCleared && combat.enemiesAlive === 0) {
        roomCleared = true;
        fagulhas += CLEAR_BONUS; // recompensa por limpar a câmara
        updateFagulhaHud();
      }
      tryDescend();
      if (descentDone && !winShown) {
        winShown = true;
        setMusicState("quente"); // crossfade para o tema morno (reavivar)
        currentRoom?.setBrazierLit(1); // a luz vira plena
        showStory("A Brasa voltou a arder. O frio recua.", 7000, true);
        gameHud.notify("A Brasa foi reavivada", "Você alcançou o fundo do poço e devolveu a luz.");
      }
      gameHud.update({
        name: platform.profile.current().name,
        points: platform.score.total,
        objective: descentObjective(),
        x: hero.position.x,
        z: hero.position.z,
        yaw: playerYaw(),
      });
      hudAcc = 0;
    }
  });

  window.addEventListener("resize", () => engine.resize());
}

main().catch((err) => {
  console.error(err);
  const loading = document.getElementById("loading");
  if (loading) {
    const msg = err instanceof Error ? err.message : String(err);
    loading.textContent = `Erro ao iniciar: ${msg} (veja o console)`;
  }
});
