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
  CombatDirector,
  CombatHud,
  DIFFICULTY_DAMAGE_TAKEN,
  type UiContext,
  type CharacterSave,
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
  let fagulhas = 0; // moeda: cinza quente dos mortos, gasta nas dádivas do braseiro
  let defeated = false; // derrota: a fagulha apagou (vida zerou)
  const CLEAR_BONUS = 6;

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

  // Aviso na tela quando a câmara é limpa e a passagem abre.
  const promptEl = document.createElement("div");
  promptEl.style.cssText =
    "position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:35;padding:10px 20px;border-radius:8px;" +
    "background:rgba(12,17,24,0.8);color:#ffcf8a;font:600 16px Cinzel,serif;border:1px solid #6e5a3a;opacity:0;" +
    "transition:opacity .3s ease;pointer-events:none;text-shadow:0 1px 2px #000;white-space:nowrap;";
  promptEl.textContent = "Câmara limpa — pise no feixe de luz para acender o braseiro e descer";
  document.body.appendChild(promptEl);

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
    roomCleared = false; // passagem selada até limpar a câmara
    hero.teleport(currentRoom.spawn);
    hero.combat.refillSpark(); // entra no andar com a fagulha cheia
    // Mortos despertos do andar: mistura de tipos que endurece com a profundidade
    // (morte permanente: a sala "limpa" ao derrotá-los). Bestiário: minion/warrior/rogue/heavy.
    // Composição que endurece com a profundidade (teto ~8 esqueletos/sala, spec-vertical-slice §3).
    const ROSTER: SkeletonKind[][] = [
      ["minion"], // 0 abertura: 1 fraco (ensina o laço)
      ["minion", "rogue", "warrior"], // 1
      ["warrior", "minion", "rogue", "minion", "warrior"], // 2 pico (5)
      ["warrior", "rogue", "antigo", "minion", "warrior", "minion"], // 3 pico (6) - surge o Antigo
      ["heavy", "antigo", "rogue", "minion"], // 4 santuário (4)
      ["sentinela", "rogue", "warrior", "minion", "rogue"], // 5 (5) - Sentinela elite pré-chefe
      ["heavy", "antigo", "warrior", "rogue"], // 6 Guardião placeholder (4)
    ];
    const kinds = ROSTER[i] ?? ["warrior"];
    kinds.forEach((kind, e) => {
      const a = (e / Math.max(1, kinds.length)) * Math.PI * 2;
      combat.addSkeleton(new Vector3(Math.cos(a) * 4.5, 0, 2.5 + Math.sin(a) * 3), { kind, respawns: false });
    });
    platform.events.emit("crypt:floor", { index: i, kind: def.kind });
    console.log(`[descida] andar ${i + 1}/${DESCENT.length} (${def.kind}): ${kinds.join(", ")}`);
  };

  // Dádivas da Brasa: compradas no braseiro (custam Fagulha). Cada descida oferece 3 do
  // acervo + a "Lasca de Brasa" GRÁTIS (garante progresso mesmo com a bolsa vazia).
  interface Boon { name: string; desc: string; cost: number; apply: () => void; }
  const BOONS: Boon[] = [
    { name: "Brasa Ardente", desc: "+35% de dano em cada golpe.", cost: 9, apply: () => hero.combat.addDamageMul(0.35) },
    { name: "Coração de Brasa", desc: "+25 de vida máxima (e cura).", cost: 9, apply: () => hero.combat.addMaxHealth(25) },
    { name: "Alcance da Chama", desc: "+0,3 m no alcance do golpe.", cost: 7, apply: () => hero.combat.addReach(0.3) },
    { name: "Vigor", desc: "+20% de dano e +10 de vida.", cost: 11, apply: () => { hero.combat.addDamageMul(0.2); hero.combat.addMaxHealth(10); } },
    { name: "Fôlego da Acendedora", desc: "+15 de vida e +0,15 m de alcance.", cost: 8, apply: () => { hero.combat.addMaxHealth(15); hero.combat.addReach(0.15); } },
  ];
  const FREE_BOON: Boon = { name: "Lasca de Brasa", desc: "+10 de vida. Sempre disponível.", cost: 0, apply: () => hero.combat.addMaxHealth(10) };

  const chooseBoon = (): Promise<void> =>
    new Promise((resolve) => {
      const offer = [...[...BOONS].sort(() => Math.random() - 0.5).slice(0, 3), FREE_BOON];
      const cards = offer.map((bn) => {
        const afford = fagulhas >= bn.cost;
        const priceTxt = bn.cost === 0 ? "grátis" : `✦ ${bn.cost}`;
        const c = el(
          "button",
          { class: "choice" },
          el("strong", { text: bn.name }),
          el("span", { text: bn.desc }),
          el("span", { text: afford ? priceTxt : `${priceTxt} (sem Fagulha)`, style: `color:${afford ? "#ffcf8a" : "#8c9aa8"};font-weight:600` })
        );
        if (!afford) {
          c.style.opacity = "0.45";
        } else {
          c.addEventListener("click", () => {
            fagulhas -= bn.cost;
            bn.apply();
            updateFagulhaHud();
            document.body.removeChild(overlay);
            resolve();
          });
        }
        return c;
      });
      const overlay = el(
        "div",
        { class: "menu-backdrop" },
        el(
          "div",
          { class: "menu-panel" },
          el("h2", { class: "menu-title", text: "Acender o braseiro" }),
          el("p", { class: "menu-subtitle", text: `A chama curou suas feridas. Gaste a Fagulha (você tem ✦ ${fagulhas}):` }),
          el("div", { class: "choice-group" }, ...cards)
        )
      );
      overlay.style.zIndex = "60";
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
    } else {
      hero.combat.healByMax(0.4); // acender o braseiro cura (respiro)
      await chooseBoon(); // gasta Fagulha numa dádiva (tela preta atrás)
      enterRoom(floorIndex + 1);
    }
    await fadeTo(0);
    gameActive = true;
    descending = false;
  };

  /** Chamado no loop: desce quando a sala está limpa e a Acendedora alcança o braseiro. */
  const tryDescend = (): void => {
    if (descending || descentDone || defeated || !currentRoom) return;
    if (combat.enemiesAlive > 0) return;
    const ex = currentRoom.exit;
    if (Math.hypot(hero.position.x - ex.x, hero.position.z - ex.z) <= ex.radius) void advance();
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

  enterRoom(0);

  let gameActive = false;

  scene.onAfterPhysicsObservable.add(() => {
    if (!gameActive) return;
    const dt = (scene.deltaTime ?? 0) / 1000;
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
    ui.clear();
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
    if (gameActive) combatHud.update(hero.combat.healthFraction, hero.combat.staminaFraction, hero.combat.sparkFraction, dt / 1000);
    if (acc > 250) {
      fpsEl.textContent = `${engine.getFps().toFixed(0)} fps`;
      acc = 0;
    }
    if (gameActive && hudAcc > 90) {
      checkObjectives();
      // Câmara limpa: abre a passagem (acende o feixe de luz do alçapão).
      if (currentRoom && !roomCleared && combat.enemiesAlive === 0) {
        roomCleared = true;
        currentRoom.setCleared(true);
        fagulhas += CLEAR_BONUS; // recompensa por limpar a câmara
        updateFagulhaHud();
      }
      tryDescend();
      if (descentDone && !winShown) {
        winShown = true;
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
