import { ArcRotateCamera, Scene, Vector3 } from "@babylonjs/core";
import { createEngine, enableHavokPhysics, InputState, ThirdPersonCamera } from "@engine";
import { WORLD_GRAVITY, Acendedora, Skeleton, buildCryptRoom, setupCryptScene, ensureCryptPieces } from "@game";

/**
 * CAMADA DEV (Brasa). Fatia mínima jogável: monta uma sala-cripta graybox e põe a
 * Acendedora (KayKit Mage CC0, já em disco) controlável com câmera em 3a pessoa e
 * física, no MESMO motor que o jogo usa. Valida o herói novo + o regime de sala
 * fechada antes de baixar o KayKit Dungeon/Skeletons. Não faz parte do jogo final;
 * é a página de validação da cripta. Controles: WASD + mouse (pointer lock).
 */
async function main(): Promise<void> {
  const canvas = document.getElementById("c") as HTMLCanvasElement;
  const engine = await createEngine(canvas);
  const scene = new Scene(engine);
  await enableHavokPhysics(scene, WORLD_GRAVITY);

  const spawn = new Vector3(0, 1.5, -9);
  const camera = new ThirdPersonCamera(scene, canvas, spawn);
  const ctx = setupCryptScene(scene, camera.camera);
  await ensureCryptPieces(scene);
  let room = buildCryptRoom(scene, ctx, { index: 0, kind: "guarda", enemies: 0 });
  room.setBrazierLit(1); // preview mostra a sala já acesa (estado quente)
  room.setCleared(true); // mostra a passagem aberta (sem gerenciador no preview)
  let floorIdx = 0;
  const KINDS = ["guarda", "salao", "cisterna", "santuario", "guardiao"] as const;
  const hero = new Acendedora(scene, spawn, WORLD_GRAVITY);
  const input = new InputState();
  input.attach(window);

  // Os 4 tipos de morto desperto em fila (minion/guerreiro/ladino/pesado), p/ ver a
  // variedade de modelo/escala. No preview ficam parados em idle (nao sao atualizados).
  const skeletons = [
    new Skeleton(scene, new Vector3(-4.5, 0, 0.5), { kind: "minion" }),
    new Skeleton(scene, new Vector3(-1.5, 0, 0.5), { kind: "warrior" }),
    new Skeleton(scene, new Vector3(1.5, 0, 0.5), { kind: "rogue" }),
    new Skeleton(scene, new Vector3(4.5, 0, 0.5), { kind: "heavy" }),
    // Fileira Quaternius (verificacao de orientacao/escala vs KayKit). Idle, parados.
    new Skeleton(scene, new Vector3(-4.5, 0, 4.0), { kind: "demonio" }),
    new Skeleton(scene, new Vector3(-1.5, 0, 4.0), { kind: "brutamonte" }),
    new Skeleton(scene, new Vector3(1.5, 0, 4.0), { kind: "espreitador" }),
    new Skeleton(scene, new Vector3(4.5, 0, 4.0), { kind: "conjurador" }),
  ];

  // Herói projeta sombra assim que o modelo termina de carregar (async).
  let shadowsReg = false;
  scene.onBeforeRenderObservable.add(() => {
    if (shadowsReg) return;
    const meshes = hero.model.root.getChildMeshes(false);
    if (meshes.length > 0) {
      for (const m of meshes) ctx.shadow.addShadowCaster(m);
      shadowsReg = true;
    }
  });

  scene.onAfterPhysicsObservable.add(() => {
    const dt = (scene.deltaTime ?? 0) / 1000;
    if (dt > 0) {
      hero.update(dt, input, camera);
      for (const s of skeletons) s.update(dt, hero.position);
    }
  });
  scene.onBeforeRenderObservable.add(() => {
    camera.update(hero.position, engine.getDeltaTime() / 1000);
  });

  // Câmera-orbital de inspeção (não controlada): usada por tools/shoot_crypt.cjs para
  // enquadrar peças/esqueletos. A câmera de jogo (3a pessoa) segue sendo a ativa.
  const orbit = new ArcRotateCamera("orbit", -Math.PI / 2, 1.0, 16, new Vector3(0, 1, 1), scene);
  orbit.minZ = 0.1;
  orbit.maxZ = 200;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  w.__scene = scene;
  w.__engine = engine;
  w.__orbit = orbit;
  w.__setLit = (t: number) => room.setBrazierLit(t); // dev: ver a virada frio<->quente
  // Testa o descarte: joga a sala atual fora e constroi a proxima (uma sala por vez).
  w.__rebuild = () => {
    room.dispose();
    floorIdx = (floorIdx + 1) % KINDS.length;
    room = buildCryptRoom(scene, ctx, { index: floorIdx, kind: KINDS[floorIdx]!, enemies: 0, boss: floorIdx === 4 });
    room.setBrazierLit(1);
    room.setCleared(true);
  };

  engine.runRenderLoop(() => scene.render());
  window.addEventListener("resize", () => engine.resize());
}

void main();
