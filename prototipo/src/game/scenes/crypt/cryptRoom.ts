import {
  Animation,
  Color3,
  ColorCurves,
  DefaultRenderingPipeline,
  DirectionalLight,
  DynamicTexture,
  GlowLayer,
  HemisphericLight,
  Matrix,
  Mesh,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  PointLight,
  Quaternion,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import type { AbstractMesh, AssetContainer, Camera, IDisposable, Material, Node as BNode, Observer, Scene } from "@babylonjs/core";
import { createLightPool, flatColorOf, isCachedToon, loadContainer, toonifyHierarchy, toonMaterialFor } from "@engine";
import { CellMaterial } from "@babylonjs/materials/cell";
import { mergeStaticByMaterial } from "./staticMerge";
import { pickLayout } from "./cryptLayouts";
import { buildSideDoor } from "./cryptDoor";
import { ROTA, type NodeKind } from "../../run/rota";
import { buildFloorScape, buildPoolGroup } from "./cryptDecor";
import { buildCave } from "./cryptCave";
import { applyGrade, createAtmosphere, themeFor } from "./cryptTheme";
import type { EnemyBounds } from "../../actors/enemies/skeleton";

/**
 * CAMADA JOGO (Brasa). Sala-cripta de referencia (KayKit Dungeon, CC0) montada para o
 * regime SALA-A-SALA: o "look" da cena (glow, nevoa, luzes globais, sombra, pos-proc)
 * e criado UMA vez em setupCryptScene(); cada ANDAR e um Room descartavel construido por
 * buildCryptRoom() e jogado fora (dispose) quando a Acendedora desce. Assim so uma sala
 * existe por vez (leveza). Cada Room rastreia tudo que cria (malhas, luzes, fisica,
 * casters de sombra, chamas, observer de tremulacao) para um descarte limpo.
 *
 * Pecas repetidas (piso, paredes, pilares E dressing repetido: caveiras, barris, caixas,
 * estandartes, escombros, etc.) por THIN INSTANCES (1 draw call por tipo, via batch()/
 * flushBatches()); props unicos por clone (placeProp). O DRESSING varia por TIPO DE SALA
 * (RoomDef.kind: guarda/salao/cisterna/santuario/guardiao) ligando clusters tematicos
 * diferentes sobre o mesmo layout-base. Ver docs/brasa/*.
 */

const K = "/assets/dungeon_kit/"; // KayKit Dungeon Remastered (mesmo atlas)
const KH = "/assets/halloween_kit/"; // KayKit Halloween Bits (atlas proprio, mesmo estilo)
// PROTOTIPO camera alta (diorama): sem teto, sem as duas paredes do lado da camera, sem candelabros
// pendentes, pilares baixos. Desliga com ?cam=terceira (volta a sala fechada de antes).
const ALTA = typeof location === "undefined" || !/[?&]cam=terceira\b/.test(location.search);
// Camera alta: o santuario fica DENTRO de uma caverna. As paredes viram muros baixos e estaticos
// (nada sobe nem desce) e a rocha da caverna sobe em rampa por fora, sempre abaixo da linha de
// visao da camera orbital, entao a camera gira livre e nada atravessa a tela.
const PARAPET = 0.3; // fracao da altura da parede (4 m -> 1,2 m)
const WALL_H = 4;
const ROOM_H = WALL_H * 2; // 8: sala alta (catedral-cripta) com teto e candelabros

export interface CryptCtx {
  shadow: ShadowGenerator;
  glow: GlowLayer;
  ambient: HemisphericLight; // luz fria ambiente (modulada na virada frio->quente)
  key: DirectionalLight; // luz-chave (sombra); cai um pouco ao acender o braseiro
  pipe: DefaultRenderingPipeline; // etalonagem/vinheta (a identidade de cada andar troca a etalonagem)
}

export type RoomKind = "guarda" | "salao" | "cisterna" | "santuario" | "guardiao";

export interface RoomDef {
  index: number; // 0..N-1 (numa antecâmara: o andar de ORIGEM, que dá tema e semente)
  kind: RoomKind;
  enemies: number; // quantos mortos despertos a sala spawna
  boss?: boolean;
  /** Antecâmara lateral (nó) em vez de andar: planta 12x12 própria, sem inimigos nem altar de estilha. */
  node?: NodeKind;
  /** Andar de origem da antecâmara (igual a `index`; a planta e o tema vêm dele). */
  fromIndex?: number;
  /** Este andar tem uma porta lateral para esta antecâmara (spec-exploracao-portas-e-salas, R5). */
  sideDoor?: NodeKind;
}

/** Porta lateral montada na sala: gatilho colado à parede leste. */
export interface RoomDoor {
  kind: NodeKind;
  x: number;
  z: number;
  radius: number;
}

/** Prop interativo atingivel pela arma do heroi: vaso/pote QUEBRA, cadeira TOMBA. O
 *  CombatDirector testa a lista a cada golpe e chama strike() ao acertar dentro do raio. */
export interface StrikeProp {
  pos: Vector3;
  r: number;
  kind: "break" | "kick";
  strike: () => void;
}

/** Ponto de leitura (pergaminho/inscricao/tumulo): [R] perto -> mostra a lore (uma vez). */
export interface Readable {
  x: number;
  z: number;
  text: string;
}

export interface Room {
  def: RoomDef;
  strikeProps: StrikeProp[]; // vasos quebraveis / cadeiras chutaveis (interacao por golpe)
  readables: Readable[]; // pergaminhos/inscricoes legiveis por proximidade + [R]
  spawn: Vector3; // onde a Acendedora entra
  exit: { x: number; z: number; radius: number }; // a PASSAGEM (alçapão): pisar = descer
  /** Portas laterais (0 ou 1): só existem em andares com `def.sideDoor`. Abrem junto do alçapão. */
  doors: RoomDoor[];
  enemyAnchor: { x: number; z: number }; // centro em torno do qual os inimigos surgem
  /** Terreno andável dos inimigos: dentro das paredes e à frente do estrado do altar (que tem
   *  colisão e barra o herói). Impede que um inimigo ranged recue para um ponto inalcançável. */
  enemyBounds: EnemyBounds;
  brazier: Vector3;
  inscriptionPos: { x: number; z: number } | null; // nicho de parede: ponto de leitura por proximidade (null na antecâmara)
  /** Vira a luz da sala de fria (t=0) para quente (t=1): acende o braseiro + reaquece a cena. */
  setBrazierLit(t: number): void;
  /** Abre a passagem (alçapão): chamado após a Brasa ser acesa. */
  setCleared(open: boolean): void;
  /**
   * ARENA DO GUARDIÃO (só quando def.kind === "guardiao"): controles da gangorra de luz e dos
   * hazards de chão. Ausente nas salas comuns. O chefe (guardiao.ts) é a fonte de verdade dos
   * dois medidores; a arena só REAGE: escurece/esfria a câmara conforme a Brasa apaga e telegrafa
   * as zonas de frio da fase 3. Ver spec-chefe-guardiao §3, §4, §5.6.
   */
  arena?: ArenaControls;
  dispose(): void;
}

export interface ArenaControls {
  /**
   * Lê a LUZ da Brasa (0..1) no mundo: a luz-chave da câmara segue o medidor. light=1 -> arena
   * quente/laranja e clara (Guardião exposto); light=0 -> breu azul cerrado (Guardião perigoso).
   * Chamado todo frame com `boss.brasaLightFraction`. Não toca a geometria, só luz/névoa/decalque.
   */
  setBrasaLight(light: number): void;
  /**
   * Maré de breu (fase 3, spec §5.6): liga/desliga o adensamento das bordas. Sutil, nunca cegante
   * (a luz central da Brasa sempre ilumina o entorno). `on` deriva de o chefe estar na fase 3.
   */
  setMareDeBreu(on: boolean): void;
  /**
   * Frio que morde (fase 3, spec §5.6): planta uma zona de gelo telegrafada em (x,z). A zona
   * cresce (telegrafia azul), fica ativa por `activeSec` e some. O chefe consulta `inActiveFrost`
   * por frame para punir quem fica parado nela. Limite interno de zonas simultâneas (perf).
   */
  spawnFrostZone(x: number, z: number, radius: number, telegraphSec: number, activeSec: number): void;
  /** true se (x,z) está dentro de uma zona de gelo ATIVA agora (o chefe pune quem fica parado nela). */
  inActiveFrost(x: number, z: number): boolean;
}

// CellMaterials do kit, PERSISTENTES entre salas (um por material equivalente: nome+cor+textura).
// Sala nova reaproveita os mesmos materiais (sem vazamento de material/textura ao descer) e o
// cenário estático se funde por material (ver staticMerge.ts). A sala NUNCA os descarta.
const KIT_TOON = new Map<string, CellMaterial>();
/** Paleta do kit: o vermelho puro do KayKit (estandartes, bau, cadeira) gritava contra a pedra fria. */
function kitRecolor(name: string, c0: Color3): Color3 {
  // As cores do glTF do kit sao LINEARES; o CellMaterial le diffuseColor como esta (sem a curva de
  // gamma), entao a pedra saia escura demais (paredes quase pretas). Levanta de leve (expoente 0,62).
  const c = new Color3(Math.pow(c0.r, 0.62), Math.pow(c0.g, 0.62), Math.pow(c0.b, 0.62));
  if (name === "Red") {
    const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
    return new Color3(c.r * 0.28 + l * 0.72, c.g * 0.28 + l * 0.72, c.b * 0.28 + l * 0.72).scale(0.58); // tijolo apagado: o quente da tela e o fogo
  }
  return c;
}

/** Material UNICO e branco do cenario de cor chapada: a cor de cada peca vai nos vertices, entao
 *  pedra, madeira, metal e ouro caem na mesma malha fundida (2 malhas em vez de ~12 por sala). */
const KIT_FLAT_BASE = 0.4;
function kitFlatMaterial(scene: Scene): CellMaterial {
  let m = KIT_TOON.get("__flat");
  if (!m) {
    m = new CellMaterial("kitFlat", scene);
    m.computeHighLevel = true;
    // O shader do CellMaterial faz clamp(luz * diffuseColor) * corDoVertice: com diffuseColor
    // branco o clamp cortava a luz azulada acima de 1 e a pedra perdia o azul (medido). Com
    // diffuseColor = KIT_FLAT_BASE e a cor dividida por ele nos vertices, o resultado casa com o
    // CellMaterial por cor de antes (clamp(luz * cor)) para qualquer luz abaixo de ~2.
    m.diffuseColor = new Color3(KIT_FLAT_BASE, KIT_FLAT_BASE, KIT_FLAT_BASE);
    m.maxSimultaneousLights = 6;
    KIT_TOON.set("__flat", m);
  }
  return m;
}

// Containers do kit (carregados uma vez, compartilhados por todos os andares).
let cache: Record<string, AssetContainer> | null = null;
const PIECES = [
  "wall", "wall_broken", "wall_corner", "pillar", "pillar_broken", "torch_wall", "door", "torch",
  "floor", "floor_alt", "floor_deco", "floor_wood", "bookcase", "table", "bench", "chair",
  "banner", "rubble", "barrel", "crate", "chest", "weapon_rack", "skull", "pots", "bucket", "coins", "wall_deco_a", "trapdoor",
  // Lote 2026-06-14 (mesmo pacote Dungeon Remastered/atlas): enriquecimento de cenario.
  "bottle_A_green", "bottle_B_green", "bottle_C_brown", "candle_triple", "shelf_small_candles",
  "chest_gold", "coin_stack_large", "coin_stack_medium", "key", "sword_shield", "keg", "plate_food_A",
  // Passagem clara entre andares (escada + portao): troca "so uma luz" por alcapao legivel.
  "stairs_wide", "wall_gate_door", "stairs_wood",
];
// KayKit Halloween Bits (CC0, mesmo autor/estilo): reforco de tom de cripta/catacumba.
const HALL = [
  "coffin", "coffin_decorated", "gravestone", "grave_A", "gravemarker_A",
  "bone_A", "bone_B", "bone_C", "ribcage", "skull_candle", "shrine_candles",
  "lantern_standing", "plaque_candles",
];
// BICHOS de cripta (modelos reais low-poly CC0/Tripo). Carregados de forma opcional: se o
// arquivo nao existir, o jogo segue sem aquele bicho (ver ensurePieces/scatterCritters).
const CR = "/models/critters/";
const CRITTERS = ["rat", "spider", "roach"];

async function ensurePieces(scene: Scene): Promise<Record<string, AssetContainer>> {
  if (cache) return cache;
  const [du, ha] = await Promise.all([
    Promise.all(PIECES.map((n) => loadContainer(scene, K + n + ".glb"))),
    Promise.all(HALL.map((n) => loadContainer(scene, KH + n + ".glb"))),
  ]);
  cache = {};
  PIECES.forEach((n, i) => (cache![n] = du[i]!));
  HALL.forEach((n, i) => (cache![n] = ha[i]!));
  // BICHOS (opcionais): carrega se o asset existir; ausencia nao quebra (try/catch por arquivo).
  await Promise.all(
    CRITTERS.map(async (n) => {
      try {
        cache![n] = await loadContainer(scene, CR + n + ".glb");
      } catch {
        /* sem o modelo do bicho: scatterCritters simplesmente nao o desenha */
      }
    })
  );
  return cache;
}

/** Cria o "look" global da cena (uma vez): nevoa, glow, luz ambiente+direcional p/ sombra. */
export function setupCryptScene(scene: Scene, camera: Camera): CryptCtx {
  scene.clearColor = Color3.FromHexString("#05070b").toColor4(1);
  scene.collisionsEnabled = true;

  scene.fogMode = 2; // EXP2
  scene.fogColor = Color3.FromHexString("#1a2636");
  scene.fogDensity = 0.006;

  // GlowLayer (só acende os EMISSIVOS incluídos: brasa, chamas, feixe) = o brilho quente
  // sobre os itens coloridos. É determinístico e não lava a sala. O bloom do pipeline
  // (que lavava a tela toda, intermitente) fica DESLIGADO; o drama vem daqui.
  const glow = new GlowLayer("glow", scene, { blurKernelSize: 40 });
  glow.intensity = 0.85;

  const ambient = new HemisphericLight("luz_fria", new Vector3(0, 1, 0), scene);
  // Camera alta: ambiente mais baixo e azulado (a sala nasce fria e escura) para que o fogo
  // (tochas, lanterna, braseiro) seja a unica fonte quente e o contraste faca a cena.
  ambient.intensity = ALTA ? 0.4 : 0.62;
  ambient.diffuse = Color3.FromHexString(ALTA ? "#6f86ad" : "#8aa6c6");
  ambient.groundColor = Color3.FromHexString(ALTA ? "#0c1119" : "#141b26");
  ambient.specular = Color3.Black();

  const key = new DirectionalLight("luz_sombra", ALTA ? new Vector3(-0.5, -0.85, -0.4) : new Vector3(-0.25, -1, -0.18), scene);
  key.position = new Vector3(4, 16, -2);
  key.intensity = ALTA ? 0.5 : 0.62; // ambient+key somam ~1: a pedra mantém cor, não entra no bloom
  key.diffuse = Color3.FromHexString(ALTA ? "#8fa3c4" : "#aebfd2");
  key.specular = Color3.Black();
  const shadow = new ShadowGenerator(2048, key);
  // PCF (não ESM): o Exponential Shadow Map vazava/estourava branco de forma intermitente
  // com a geometria mais alta + mais casters (candelabros, 2a fileira). PCF é estável.
  shadow.usePercentageCloserFiltering = true;
  shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadow.darkness = 0.4;
  shadow.bias = 0.005;
  shadow.normalBias = 0.01;

  // Pos-processamento (bloom da Brasa, vignette, grao); sem ACES (esmaga low-poly).
  const pipe = new DefaultRenderingPipeline("criptaPipe", true, scene, [camera]);
  pipe.fxaaEnabled = true;
  pipe.bloomEnabled = false; // DESLIGADO: era ele que lavava a tela toda de branco (intermitente).
  pipe.bloomThreshold = 0.85; // (sem efeito com bloom off; mantido para referência)
  pipe.bloomWeight = 0.5;
  pipe.bloomKernel = 64;
  pipe.bloomScale = 0.5;
  pipe.imageProcessingEnabled = true;
  pipe.imageProcessing.toneMappingEnabled = false;
  pipe.imageProcessing.exposure = 1.05;
  pipe.imageProcessing.contrast = ALTA ? 1.2 : 1.12;
  pipe.imageProcessing.vignetteEnabled = true;
  pipe.imageProcessing.vignetteWeight = ALTA ? 2.1 : 1.1;
  if (ALTA) {
    // Etalonagem: sombras azuis, luzes alaranjadas (a "gangorra" frio contra brasa).
    const cc = new ColorCurves();
    cc.shadowsHue = 214;
    cc.shadowsDensity = 22;
    cc.shadowsSaturation = 6;
    cc.highlightsHue = 34;
    cc.highlightsDensity = 42;
    cc.highlightsSaturation = 28;
    cc.globalSaturation = 8;
    pipe.imageProcessing.colorCurves = cc;
    pipe.imageProcessing.colorCurvesEnabled = true;
  }
  pipe.imageProcessing.vignetteColor = new Color3(0.03, 0.04, 0.07).toColor4(1);
  pipe.grainEnabled = true;
  pipe.grain.intensity = 4;
  pipe.grain.animated = true;

  return { shadow, glow, ambient, key, pipe };
}

/**
 * Junta as malhas de uma peça do kit num único mesh, contornando um BUG do
 * Mesh.MergeMeshes(multiMultiMaterial): às vezes ele devolve um MultiMaterial VAZIO
 * (subMaterials.length 0) enquanto os subMeshes ainda apontam para o índice 0, e as malhas
 * caem no MATERIAL DEFAULT BRANCO -> a cripta inteira fica esbranquiçada (chão/paredes
 * sem a pedra escura StoneDark/Stone). Captura os materiais-fonte ANTES do merge (o merge
 * descarta as malhas-fonte, mas NÃO os materiais) e, se o resultado vier vazio, reatribui
 * um material real (PBR), que o passe toon depois converte em CellMaterial.
 */
function mergeKitMeshes(src: Mesh[]): Mesh | null {
  const srcMats: Material[] = [];
  for (const m of src) {
    const mat = m.material;
    if (mat && !srcMats.includes(mat)) srcMats.push(mat);
  }
  const merged = Mesh.MergeMeshes(src, true, true, undefined, false, true);
  if (!merged) return null;
  const mat = merged.material;
  // Rede de segurança: se mesmo assim vier um MultiMaterial vazio, reaproveita um material-fonte.
  const empty =
    !mat || (mat.getClassName() === "MultiMaterial" && (mat as unknown as { subMaterials: unknown[] }).subMaterials.length === 0);
  if (empty && srcMats.length > 0) {
    if (mat && mat.getClassName() === "MultiMaterial") mat.dispose();
    merged.material = srcMats[0]!;
  }
  return merged;
}

/** Constroi UM andar (descartavel). Precisa que ensureCryptPieces tenha rodado antes. */
export function buildCryptRoom(scene: Scene, ctx: CryptCtx, def: RoomDef): Room {
  const P = cache!;
  // PLANTA do andar (forma/dimensoes). A geometria abaixo deriva dela; o dressing por
  // tipo (clusters) se ajusta a HALFX/HALFZ e ao z do altar (AZ).
  const L = pickLayout(def);
  const HALFX = L.halfX;
  const HALFZ = L.halfZ;
  const AZ = L.altar.z; // z do altar/braseiro (fundo da sala)
  // Texturas dinamicas criadas durante a montagem desta sala (grao da pedra, ondas, caverna, poças,
  // particulas): a sala as descarta no dispose, senao crescem a cada andar.
  const texturasAntes = new Set<unknown>(scene.textures);
  const roomRoot = new TransformNode("room_" + def.index, scene);
  const lights: IDisposable[] = [];
  const aggregates: PhysicsAggregate[] = [];
  const casters: AbstractMesh[] = [];
  // ignite (0..1): fator de aceso. Tochas de parede nascem 1 (sempre acesas); o BRASEIRO
  // nasce 0 (apagado) e sobe na virada frio->quente ao ser aceso.
  const flames: { pos: Vector3; scale: number; light: PointLight | null; base: number; seed: number; ignite: number }[] = [];
  let arenaDispose: (() => void) | undefined; // descarte extra da arena do Guardião (observer/glow)
  let decayWebMat: StandardMaterial | null = null; // teia de aranha (reuso por sala)
  let decayMossMat: StandardMaterial | null = null; // musgo/trepadeira (reuso por sala)
  let critterMat: StandardMaterial | null = null; // material escuro dos bichos (sem textura)
  const strikeProps: StrikeProp[] = []; // vasos/potes (quebram) e cadeiras (tombam) por golpe
  const readables: Readable[] = []; // pergaminhos/inscricoes/tumulos legiveis ([R] perto)
  const rng = (i: number) => Math.abs((Math.sin((i + def.index * 100) * 12.9898) * 43758.5453) % 1);

  // VARIACAO DO DRESSING POR ANDAR: enquanto `dressing` esta ligado (durante o dispatch de
  // clusters), todo placeProp/batch ganha um ESPELHO horizontal (por andar) + jitter de
  // posicao/rotacao. Assim dois andares do mesmo tipo (ex.: 1 e 3 = salao) nao saem
  // identicos: a mesma "mesa+barril" aparece espelhada e deslocada. Estrutura (paredes,
  // altar, pilares, alcapao, tochas) e colocada FORA desse flag, entao nao se mexe.
  let dressing = false;
  let dressN = 0;
  const dressMirror = rng(7) < 0.5 ? -1 : 1;
  // CAMERA ALTA: as paredes sao muros baixos, entao pecas ALTAS (estante, estandarte, placa)
  // flutuariam no ar ou tapariam o heroi. `tall` marca essas pecas: na camera alta, somem.
  const dressVar = <T extends { x: number; z: number; rotY?: number; tall?: boolean }>(o: T): T | null => {
    let r: T = o;
    if (dressing) {
      const j = dressN++;
      r = {
        ...o,
        x: o.x * dressMirror + (rng(j * 3 + 1) - 0.5) * 0.7,
        z: o.z + (rng(j * 3 + 2) - 0.5) * 0.7,
        rotY: (o.rotY ?? 0) * dressMirror + (rng(j * 3 + 3) - 0.5) * 0.5,
      };
    }
    if (ALTA && o.tall) return null;
    return r;
  };

  const track = (m: AbstractMesh): AbstractMesh => {
    m.parent = roomRoot;
    return m;
  };

  function kitBase(container: AssetContainer, mode: "base" | "floor"): Mesh | null {
    // cloneMaterials=TRUE: cada andar recebe CÓPIAS dos materiais do kit, isoladas do cache.
    // Sem isso, os andares COMPARTILHAM os materiais do container em cache; ao descartar um
    // andar, o dispose mata esses materiais compartilhados e o PRÓXIMO andar nasce com as
    // malhas sem material -> cai no material default BRANCO (cripta esbranquiçada).
    const entries = container.instantiateModelsToScene(undefined, false);
    const root = entries.rootNodes[0] as TransformNode | undefined;
    if (!root) return null;
    root.computeWorldMatrix(true);
    const src = root.getChildMeshes(false).filter((m) => m.getTotalVertices() > 0) as Mesh[];
    src.forEach((m) => m.computeWorldMatrix(true));
    const merged = mergeKitMeshes(src);
    root.dispose();
    if (!merged) return null;
    const bb = merged.getBoundingInfo().boundingBox;
    const cx = (bb.minimum.x + bb.maximum.x) / 2;
    const cz = (bb.minimum.z + bb.maximum.z) / 2;
    merged.bakeTransformIntoVertices(Matrix.Translation(-cx, mode === "floor" ? -bb.maximum.y : -bb.minimum.y, -cz));
    merged.refreshBoundingInfo();
    merged.isPickable = false;
    merged.receiveShadows = true;
    merged.parent = roomRoot;
    return merged;
  }

  function kitInstances(base: Mesh, placements: { x: number; z: number; rotY?: number }[], y = 0, pitch = 0): void {
    base.thinInstanceAdd(
      placements.map((p) => Matrix.Compose(Vector3.One(), Quaternion.RotationYawPitchRoll(p.rotY ?? 0, pitch, 0), new Vector3(p.x, y, p.z)))
    );
  }

  function colliderBox(root: TransformNode, shrink: number): void {
    root.computeWorldMatrix(true);
    const { min, max } = root.getHierarchyBoundingVectors(true);
    const size = max.subtract(min);
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) return;
    const box = MeshBuilder.CreateBox("colisor", { width: size.x * shrink, height: size.y, depth: size.z * shrink }, scene);
    box.position = min.add(max).scale(0.5);
    box.isVisible = false;
    box.isPickable = false;
    box.checkCollisions = true;
    track(box);
    aggregates.push(new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0 }, scene));
  }

  function placeProp(
    container: AssetContainer,
    oIn: { x: number; z: number; y?: number; rotY?: number; scale?: number; targetH?: number; collider?: boolean; cast?: boolean; tall?: boolean; dyn?: boolean }
  ): TransformNode | null {
    const o = dressVar(oIn); // espelho/jitter por andar (no-op fora do dressing)
    if (!o) return null; // peca alta no lado da camera: descartada
    // cloneMaterials=TRUE: cada andar recebe CÓPIAS dos materiais do kit, isoladas do cache.
    // Sem isso, os andares COMPARTILHAM os materiais do container em cache; ao descartar um
    // andar, o dispose mata esses materiais compartilhados e o PRÓXIMO andar nasce com as
    // malhas sem material -> cai no material default BRANCO (cripta esbranquiçada).
    const entries = container.instantiateModelsToScene(undefined, false);
    const root = entries.rootNodes[0] as TransformNode | undefined;
    if (!root) return null;
    root.rotationQuaternion = null;
    root.position.setAll(0);
    root.rotation = new Vector3(0, o.rotY ?? 0, 0);
    root.scaling.setAll(o.scale ?? 1);
    root.computeWorldMatrix(true);
    // targetH: normaliza a ALTURA do modelo (assets do Tripo vem em escala arbitraria, ex.: bichos).
    if (o.targetH) {
      const m0 = root.getHierarchyBoundingVectors(true);
      const h = Math.max(0.001, m0.max.y - m0.min.y);
      root.scaling.setAll((o.targetH / h) * (o.scale ?? 1));
      root.computeWorldMatrix(true);
    }
    const b = root.getHierarchyBoundingVectors(true);
    const cx = (b.min.x + b.max.x) / 2;
    const cz = (b.min.z + b.max.z) / 2;
    root.position.set(o.x - cx, (o.y ?? 0) - b.min.y, o.z - cz);
    root.parent = roomRoot;
    // dyn: a peca se mexe/some depois (alcapao, vaso, cadeira, bicho): fica FORA da fusao estatica.
    if (oIn.dyn) root.metadata = { dyn: true };
    if (o.collider) colliderBox(root, 0.65); // pegada enxuta: mais espaço de caminhada entre props
    if (o.cast !== false) for (const m of root.getChildMeshes(false)) { ctx.shadow.addShadowCaster(m as AbstractMesh); casters.push(m as AbstractMesh); }
    return root;
  }

  // VASO/POTE QUEBRAVEL: ao ser atingido pela arma, some + estilhaca (o burst/som vem do
  // CombatDirector). Registra um StrikeProp; sem colisor (atravessavel) p/ leitura limpa.
  function placeBreakable(container: AssetContainer, o: { x: number; z: number; rotY?: number; scale?: number }): void {
    const root = placeProp(container, { x: o.x, z: o.z, rotY: o.rotY, scale: o.scale, cast: false, dyn: true });
    if (!root) return;
    strikeProps.push({
      pos: new Vector3(o.x, 0.6, o.z),
      r: 0.95,
      kind: "break",
      strike: () => root.dispose(),
    });
  }

  // CADEIRA CHUTAVEL: ao ser atingida/empurrada, TOMBA (anima a queda) e fica caida. Mantem o
  // colisor enquanto em pe; ao tombar, vira deco (sem colisor novo). Um StrikeProp por cadeira.
  function placeKickable(container: AssetContainer, o: { x: number; z: number; rotY?: number }): void {
    const root = placeProp(container, { x: o.x, z: o.z, rotY: o.rotY, collider: true, cast: true, dyn: true });
    if (!root) return;
    let down = false;
    strikeProps.push({
      pos: new Vector3(o.x, 0.5, o.z),
      r: 1.0,
      kind: "kick",
      strike: () => {
        if (down) return;
        down = true;
        const dir = (o.rotY ?? 0) + Math.PI / 2;
        // tomba: gira ~85 graus em torno de um eixo horizontal e afunda um tico (assenta no chao)
        Animation.CreateAndStartAnimation("tomba_rot", root, "rotation.x", 60, 16, root.rotation.x, Math.sin(dir) * 1.5, 0);
        Animation.CreateAndStartAnimation("tomba_rotz", root, "rotation.z", 60, 16, root.rotation.z, Math.cos(dir) * 1.5, 0);
        Animation.CreateAndStartAnimation("tomba_y", root, "position.y", 60, 16, root.position.y, root.position.y + 0.1, 0);
      },
    });
  }

  function wallCollider(cx: number, cz: number, w: number, d: number): void {
    const box = MeshBuilder.CreateBox("colisor_parede", { width: w, height: ROOM_H, depth: d }, scene);
    box.position.set(cx, ROOM_H / 2, cz);
    box.isVisible = false;
    box.isPickable = false;
    box.checkCollisions = true;
    track(box);
    aggregates.push(new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0 }, scene));
  }

  // --- INSTANCIAMENTO de dressing repetido (1 draw call por tipo) ---
  // Em vez de clonar cada copia de um prop (cada clone custa draw calls), acumulamos as
  // posicoes por tipo em batch() e, no flushBatches(), criamos UMA malha-base mesclada +
  // thin instances. Colisores (invisiveis, sem custo de draw call) sao criados a parte para
  // os props solidos. Props unicos (1 copia) continuam por placeProp() (clone).
  type Spot = { x: number; z: number; y?: number; rotY?: number; scale?: number; collider?: boolean; tall?: boolean };
  const batches = new Map<string, { cast: boolean; spots: Spot[] }>();
  function batch(name: string, spot: Spot, cast = false): void {
    let b = batches.get(name);
    if (!b) { b = { cast, spots: [] }; batches.set(name, b); }
    b.cast = b.cast || cast;
    const v = dressVar(spot); // espelho/jitter por andar (no-op fora do dressing)
    if (v) b.spots.push(v);
  }
  function propBase(container: AssetContainer, cast: boolean): Mesh | null {
    // cloneMaterials=TRUE: cada andar recebe CÓPIAS dos materiais do kit, isoladas do cache.
    // Sem isso, os andares COMPARTILHAM os materiais do container em cache; ao descartar um
    // andar, o dispose mata esses materiais compartilhados e o PRÓXIMO andar nasce com as
    // malhas sem material -> cai no material default BRANCO (cripta esbranquiçada).
    const entries = container.instantiateModelsToScene(undefined, false);
    const root = entries.rootNodes[0] as TransformNode | undefined;
    if (!root) return null;
    root.computeWorldMatrix(true);
    const src = root.getChildMeshes(false).filter((m) => m.getTotalVertices() > 0) as Mesh[];
    src.forEach((m) => m.computeWorldMatrix(true));
    const merged = mergeKitMeshes(src);
    root.dispose();
    if (!merged) return null;
    const bb = merged.getBoundingInfo().boundingBox;
    const cx = (bb.minimum.x + bb.maximum.x) / 2;
    const cz = (bb.minimum.z + bb.maximum.z) / 2;
    merged.bakeTransformIntoVertices(Matrix.Translation(-cx, -bb.minimum.y, -cz));
    merged.refreshBoundingInfo();
    merged.isPickable = false;
    merged.receiveShadows = true;
    merged.parent = roomRoot;
    if (cast) { ctx.shadow.addShadowCaster(merged); casters.push(merged); }
    return merged;
  }
  function flushBatches(): void {
    for (const [name, b] of batches) {
      if (b.spots.length === 0) continue;
      const base = propBase(P[name]!, b.cast);
      if (!base) continue;
      if (ALTA && name === "pillar") base.scaling.y = 0.45; // coluna inteira vira meia-coluna (nao tapa o heroi)
      // CRITICO: medir o bbox de UMA peca ANTES do thinInstanceAdd. Depois de adicionar as
      // instancias, getBoundingInfo passa a abranger TODAS as instancias (ex.: todos os
      // pilares de -8 a +8) -> colisores gigantes que travavam o herao em meia sala.
      const cb = base.getBoundingInfo().boundingBox;
      const ex = cb.maximum.x - cb.minimum.x;
      const ez = cb.maximum.z - cb.minimum.z;
      const ey = cb.maximum.y - cb.minimum.y;
      base.thinInstanceAdd(
        b.spots.map((p) =>
          Matrix.Compose(
            new Vector3(p.scale ?? 1, p.scale ?? 1, p.scale ?? 1),
            Quaternion.RotationYawPitchRoll(p.rotY ?? 0, 0, 0),
            new Vector3(p.x, p.y ?? 0, p.z)
          )
        )
      );
      // Colisores invisiveis (so para os spots solidos): caixa AABB a partir do bbox local.
      for (const p of b.spots) {
        if (!p.collider) continue;
        const s = p.scale ?? 1;
        const swap = Math.abs(Math.round((p.rotY ?? 0) / (Math.PI / 2))) % 2 === 1;
        const w = (swap ? ez : ex) * s * 0.65;
        const d = (swap ? ex : ez) * s * 0.65;
        const h = ey * s;
        if (w <= 0 || h <= 0 || d <= 0) continue;
        const box = MeshBuilder.CreateBox("colisor", { width: w, height: h, depth: d }, scene);
        box.position.set(p.x, (p.y ?? 0) + h / 2, p.z);
        box.isVisible = false;
        box.isPickable = false;
        box.checkCollisions = true;
        track(box);
        aggregates.push(new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0 }, scene));
      }
    }
  }

  // CHAMAS: UMA malha com thin instances para todas (antes 1 malha + 1 material por chama: cada uma
  // custava draw call no passe principal, na profundidade e no glow). O tremular reescreve as
  // matrizes a cada quadro; chama apagada vira matriz degenerada.
  type Flame = (typeof flames)[number];
  let flameBase: Mesh | null = null;
  function makeFlame(pos: Vector3, scale: number, lightInt: number, withLight: boolean): Flame {
    if (!flameBase) {
      const mat = new StandardMaterial("flameMat", scene);
      mat.emissiveColor = Color3.FromHexString("#ff7a1c");
      mat.diffuseColor = Color3.Black();
      mat.specularColor = Color3.Black();
      mat.disableLighting = true;
      const base = MeshBuilder.CreateCylinder("chamas", { diameterTop: 0, diameterBottom: 0.32, height: 0.7, tessellation: 8 }, scene);
      base.material = mat;
      base.isPickable = false;
      base.parent = roomRoot;
      base.alwaysSelectAsActiveMesh = true; // as instancias vivem fora da caixa do cilindro-base
      base.metadata = { noOutline: true };
      ctx.glow.addIncludedOnlyMesh(base);
      flameBase = base;
    }
    let light: PointLight | null = null;
    if (withLight) {
      light = new PointLight("luz_chama", pos.add(new Vector3(0, 0.2, 0)), scene);
      light.diffuse = Color3.FromHexString("#ffa24c");
      light.intensity = lightInt;
      light.range = 34;
      light.shadowEnabled = false;
      lights.push(light);
    }
    const entry: Flame = { pos: pos.clone(), scale, light, base: lightInt, seed: flames.length * 1.7, ignite: 1 };
    flames.push(entry);
    return entry;
  }

  // --- Piso fisico invisivel ---
  const ground = MeshBuilder.CreateGround("piso_fisico", { width: HALFX * 2 + 2, height: HALFZ * 2 + 2 }, scene);
  ground.isVisible = false;
  ground.checkCollisions = true;
  ground.parent = roomRoot;
  aggregates.push(new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene));

  // --- PISO 3D (cryptFloor): lajes reais com juntas fundas, algumas erguidas/afundadas, e a cenografia
  //     de apoio como geometria (ossos, entulho, fendas, musgo, tapete, água rebaixada com ondulação).
  //     Tudo em poucas malhas (laje+detalhes fundidos, água, brasas). A superfície caminhável segue em y=0. ---
  const floorArt = buildFloorScape(scene, L, def.kind, def.index, P);
  for (const m of floorArt.meshes) { m.parent = roomRoot; track(m); }
  ctx.shadow.addShadowCaster(floorArt.floor); // detalhes em relevo (ossos, entulho, bordas) projetam sombra no piso
  casters.push(floorArt.floor);
  // O chão físico é plano: bacias e lagoa ganham colisor invisível (sem custo de desenho).
  for (const c of floorArt.colliders) {
    const box = MeshBuilder.CreateBox("colisor_agua", { width: c.x1 - c.x0, height: 1, depth: c.z1 - c.z0 }, scene);
    box.position.set((c.x0 + c.x1) / 2, 0.5, (c.z0 + c.z1) / 2);
    box.isVisible = false;
    box.isPickable = false;
    box.checkCollisions = true;
    track(box);
    aggregates.push(new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0 }, scene));
  }

  // --- CAVERNA em volta do santuario (camera alta): rampa de rocha por fora dos muros baixos ---
  // IDENTIDADE POR ANDAR (cryptTheme): rocha, luz, neblina, etalonagem e particulas pelo INDICE.
  const THEME = themeFor(def.index);
  applyGrade(ctx.pipe, THEME);
  ctx.key.diffuse = Color3.FromHexString(THEME.key.diffuse);
  const cave = ALTA ? buildCave(scene, { halfX: HALFX, halfZ: HALFZ, seed: def.index + 1, theme: THEME, doorX: 2, altarZ: AZ, layout: L }) : null;
  if (cave && def.node) {
    // Antecamara (orcamento de 60 draw calls): sem o espelho d'agua da borda, que e so enfeite externo.
    const i = cave.meshes.findIndex((m) => m.name === "caverna_agua");
    if (i >= 0) cave.meshes.splice(i, 1)[0]!.dispose();
  }
  if (cave) {
    for (const m of cave.meshes) track(m);
    for (const m of cave.glow) ctx.glow.addIncludedOnlyMesh(m);
    for (const k of cave.colliders) wallCollider(k.cx, k.cz, k.w, k.d); // pecas de cena solidas (tumulo)
  }
  const atmosphere = ALTA ? createAtmosphere(scene, THEME) : null;

  // --- Piso ladrilhado (xadrez + rotacao) + medalhao + tabuas ---
  const tilesA: { x: number; z: number; rotY: number }[] = [];
  const tilesB: { x: number; z: number; rotY: number }[] = [];
  const coordsX = L.floorX;
  const coordsZ = L.floorZ;
  for (let ix = 0; ix < coordsX.length; ix++)
    for (let iz = 0; iz < coordsZ.length; iz++) {
      const t = { x: coordsX[ix]!, z: coordsZ[iz]!, rotY: ((ix * 7 + iz * 3) % 4) * (Math.PI / 2) };
      ((ix + iz) % 2 === 0 ? tilesA : tilesB).push(t);
    }
  // PISO: a laje base solida (acima) E o piso visivel. NAO instanciamos mais os ladrilhos
  // recuados do KayKit (floor/floor_alt) no chao: os recessos escuros liam como BURACOS/
  // celulas pretas em angulo rasante. Mantemos so o medalhao e as tabuas como ACENTOS, e a
  // grelha sutil de juntas (abaixo) da textura ao piso sem o efeito de grade-sobre-o-vazio.
  // --- W4: DECALQUE DE CHÃO por tipo de sala (poça / círculo ritual / rachaduras) ---
  // Malha plana fina logo acima do piso (sem z-fight). 1 draw call cada (malha única).
  // O material e a cor-base ficam capturados para a coreografia de luz (brilham ao acender).
  const decalMat: StandardMaterial | null = floorArt.emissive?.mat ?? null;
  const decalBaseEmissive = decalMat ? decalMat.emissiveColor.clone() : Color3.Black();

  // --- W4: NICHO/ALCOVA de parede (>= 1 por sala): recuo escuro com ossada + ponto de
  //     inscrição (lido por proximidade, item 5). Recesso = caixa escura encostada na
  //     parede leste; uma lápide e caveiras dentro. Posição exposta como inscriptionPos. ---
  const NICHE_Z = -(HALFZ - 5); // canto sudeste, longe do altar e da pista central
  const inscriptionPos = def.node ? null : { x: HALFX - 1.5, z: NICHE_Z };
  if (!def.node) {
    const nm = new StandardMaterial("nichoMat", scene);
    nm.diffuseColor = Color3.FromHexString("#0a0d12");
    nm.specularColor = Color3.Black();
    const recess = MeshBuilder.CreateBox("nicho", { width: 0.45, height: ALTA ? 1.0 : 2.4, depth: 2.3 }, scene);
    recess.material = nm;
    recess.position.set(HALFX - 0.28, ALTA ? 0.6 : 1.5, NICHE_Z);
    recess.isPickable = false;
    recess.receiveShadows = true;
    recess.parent = roomRoot;
    placeProp(P.gravestone!, { x: HALFX - 0.95, z: NICHE_Z, rotY: -Math.PI / 2 });
    batch("skull", { x: HALFX - 1.1, z: NICHE_Z + 0.55, rotY: 0.5, scale: 0.34 });
    batch("skull", { x: HALFX - 1.2, z: NICHE_Z - 0.55, rotY: 1.2, scale: 0.3 });
  }

  // --- Paredes (thin instances) + variacao quebrada (da planta) ---
  const wallsV = L.walls;
  const brokenV = L.broken;
  const wallBase = kitBase(P.wall!, "base");
  const brokenBase = kitBase(P.wall_broken!, "base");
  if (wallBase) kitInstances(wallBase, wallsV);
  if (brokenBase && brokenV.length) kitInstances(brokenBase, brokenV);
  if (ALTA) {
    if (wallBase) wallBase.scaling.y = PARAPET;
    if (brokenBase) brokenBase.scaling.y = PARAPET;
  }
  // 2a fileira de parede (sala alta): leva a parede de 4m para 8m (ROOM_H). Na camera alta
  // a parede de fundo fica baixa (1 fileira) para nao esconder o chao.
  if (!ALTA && wallBase) kitInstances(wallBase, wallsV, WALL_H);
  if (!ALTA && brokenBase && brokenV.length) kitInstances(brokenBase, brokenV, WALL_H);
  if (wallBase) { ctx.shadow.addShadowCaster(wallBase); casters.push(wallBase); }

  // --- TETO: lajes de piso INVERTIDAS no topo (pedra de verdade, não vazio preto) ---
  const ceilBase = ALTA ? null : kitBase(P.floor!, "floor");
  if (ceilBase) {
    kitInstances(ceilBase, [...tilesA, ...tilesB], ROOM_H, Math.PI);
    ceilBase.receiveShadows = false;
  }
  // Colisor de teto: impede a câmera de escapar por cima ao dar zoom out.
  const ceilCol = MeshBuilder.CreateBox("colisor_teto", { width: HALFX * 2, height: 0.6, depth: HALFZ * 2 }, scene);
  ceilCol.position.set(0, ROOM_H + 0.3, 0);
  ceilCol.isVisible = false;
  ceilCol.isPickable = false;
  ceilCol.checkCollisions = true;
  track(ceilCol);
  if (ALTA) ceilCol.checkCollisions = false;

  for (const c of L.wallColliders) wallCollider(c.cx, c.cz, c.w, c.d);
  // Cantoneiras: duas fileiras (acompanham a parede dupla até ROOM_H).
  for (const c of L.corners) {
    const corner = placeProp(P.wall_corner!, { x: c.x, z: c.z });
    if (ALTA && corner) corner.scaling.y *= PARAPET;
    if (!ALTA) placeProp(P.wall_corner!, { x: c.x, z: c.z, y: WALL_H, cast: false });
  }
  if (!ALTA) placeProp(P.door!, { x: 2, z: -HALFZ + 0.4 }); // (camera alta: o vao da porta fica aberto)

  // --- Pilares: coluna INTEIRA até o teto (2 cortes empilhados nos inteiros) ---
  for (const p of L.pillars) {
    batch(p.broken ? "pillar_broken" : "pillar", { x: p.x, z: p.z, rotY: p.rotY, collider: true }, true);
    // Pilar inteiro vai do chão ao teto: segundo corte em cima (sem colisor extra; o de
    // baixo já barra). Os quebrados ficam baixos de propósito (ruína).
    if (!p.broken && !ALTA) batch("pillar", { x: p.x, z: p.z, rotY: p.rotY, y: WALL_H }, true);
  }

  // --- Altar ao fundo (norte): estrado + degrau + braseiro (a Brasa). Antecamara: sem altar. ---
  if (!def.node) {
  const daisMat = new StandardMaterial("matEstrado", scene);
  daisMat.diffuseColor = Color3.FromHexString("#363b43");
  daisMat.specularColor = Color3.Black();
  const daisScale = L.daisScale;
  const dais = MeshBuilder.CreateBox("estrado", { width: 8 * daisScale, height: 0.9, depth: 4.5 }, scene);
  dais.position.set(0, 0.45, AZ);
  dais.material = daisMat;
  dais.checkCollisions = true;
  dais.receiveShadows = true;
  dais.parent = roomRoot;
  aggregates.push(new PhysicsAggregate(dais, PhysicsShapeType.BOX, { mass: 0 }, scene));
  ctx.shadow.addShadowCaster(dais);
  casters.push(dais);
  const stepM = MeshBuilder.CreateBox("degrau", { width: 4.5, height: 0.45, depth: 1.3 }, scene);
  stepM.position.set(0, 0.225, AZ - 2.6);
  stepM.material = daisMat;
  stepM.checkCollisions = true;
  stepM.receiveShadows = true;
  stepM.parent = roomRoot;
  aggregates.push(new PhysicsAggregate(stepM, PhysicsShapeType.BOX, { mass: 0 }, scene));
  }

  if (!def.node) placeProp(P.torch!, { x: 0, z: AZ, y: 0.9, collider: true });
  const brazier = new Vector3(0, 0.9, AZ);
  // A BRASA do altar nasce APAGADA: só acende (frio->quente) quando a sala é limpa e a
  // Acendedora a reacende (setBrazierLit). As duas chamas laterais (offering) acompanham.
  const brazierFlame = makeFlame(new Vector3(0, 2.2, AZ), def.boss ? 2.1 : 1.6, def.boss ? 3.0 : 2.4, true);
  // Anel de caveiras do altar (sempre presente; instanciado via clusterGrime no flush).
  for (let i = 0; i < (def.node ? 0 : 8); i++) {
    const a = (i / 8) * Math.PI * 2;
    batch("skull", { x: Math.cos(a) * 1.7, z: AZ + Math.sin(a) * 1.1, y: 0.9, rotY: a + 1.2, scale: 0.32 });
  }
  const offerL = makeFlame(new Vector3(-2.7, 1.05, AZ), 0.4, 0, false);
  const offerR = makeFlame(new Vector3(2.7, 1.05, AZ), 0.4, 0, false);
  // Braseiro e oferendas começam apagados (a sala nasce fria).
  brazierFlame.ignite = 0;
  offerL.ignite = 0;
  offerR.ignite = 0;

  // --- A PASSAGEM em frente ao altar: pisar nela (sala limpa) desce de andar. Agora LEGIVEL
  //     como alcapao: poco escuro recuado + escada descendo + portao de pedra emoldurando +
  //     alcapao por cima (selado enquanto ha inimigos). O feixe e so o realce ao limpar.
  const EX = L.exit.x, EZ = L.exit.z;
  const HOLE = 2.6; // lado do alcapao
  // Poco escuro afundado (le como "buraco que desce"): topo logo abaixo do piso.
  const shaftMat = new StandardMaterial("pocoMat", scene);
  shaftMat.diffuseColor = Color3.Black();
  shaftMat.specularColor = Color3.Black();
  shaftMat.emissiveColor = Color3.FromHexString("#0a0805");
  const shaft = MeshBuilder.CreateBox("poco_descida", { width: HOLE, height: 4.0, depth: HOLE }, scene);
  shaft.material = shaftMat;
  shaft.position.set(EX, -2.05, EZ); // topo do poco ~ -0.05 (logo abaixo do piso)
  shaft.isPickable = false;
  shaft.parent = roomRoot;
  track(shaft);
  // BORDA de pedra erguida em volta do buraco (4 vigas): emoldura e deixa claro que e um vao.
  const rimMat = new StandardMaterial("bordaPocoMat", scene);
  rimMat.diffuseColor = Color3.FromHexString("#3a4048");
  rimMat.specularColor = Color3.FromHexString("#6a5a3a");
  const rimH = 0.35, rimT = 0.45, half = HOLE / 2 + rimT / 2;
  const rimSpots: [number, number, number, number][] = [
    [EX, EZ + half, HOLE + rimT * 2, rimT], [EX, EZ - half, HOLE + rimT * 2, rimT],
    [EX + half, EZ, rimT, HOLE + rimT * 2], [EX - half, EZ, rimT, HOLE + rimT * 2],
  ];
  const rimBars: Mesh[] = [];
  for (let i = 0; i < rimSpots.length; i++) {
    const [rx, rz, rw, rd] = rimSpots[i]!;
    const bar = MeshBuilder.CreateBox(`borda_poco_${i}`, { width: rw, height: rimH, depth: rd }, scene);
    bar.position.set(rx, rimH / 2, rz);
    bar.bakeCurrentTransformIntoVertices();
    rimBars.push(bar);
  }
  const rim = Mesh.MergeMeshes(rimBars, true, true); // as 4 vigas viram 1 malha (cada malha custa varias passadas de desenho)
  if (rim) {
    rim.name = "borda_poco";
    rim.material = rimMat;
    rim.isPickable = false;
    rim.receiveShadows = true;
    rim.parent = roomRoot;
    track(rim);
  }
  // Alcapao (tampa) por cima do buraco: visivel enquanto ha inimigos; ABRE (some) ao limpar.
  const hatch = placeProp(P.trapdoor!, { x: EX, z: EZ, y: 0.05, scale: HOLE / 2.2, cast: false, dyn: true });
  const beamMat = new StandardMaterial("feixe", scene);
  beamMat.emissiveColor = Color3.FromHexString("#ffd089");
  beamMat.diffuseColor = Color3.Black();
  beamMat.specularColor = Color3.Black();
  beamMat.alpha = 0.18; // discreto: o feixe indica a passagem, não domina a vitória
  beamMat.disableLighting = true;
  const beam = MeshBuilder.CreateCylinder("feixe_passagem", { diameterTop: 0.5, diameterBottom: 1.7, height: 3.8, tessellation: 14 }, scene);
  beam.material = beamMat;
  beam.position.set(L.exit.x, 1.9, L.exit.z);
  beam.isPickable = false;
  beam.parent = roomRoot;
  beam.setEnabled(false);
  ctx.glow.addIncludedOnlyMesh(beam);

  // --- PORTA LATERAL (andares com def.sideDoor): portao de pedra na parede leste (peca do kit,
  //     fundida com o resto do cenario estatico) + veu e poca de luz na cor da antecamara, que
  //     acendem junto do alcapao. Sem luz pontual (o teto de 6 luzes da cena e do alcapao/tochas).
  const sideDoors: RoomDoor[] = [];
  let sideDoorFx: ReturnType<typeof buildSideDoor> | null = null;
  if (def.sideDoor && L.doors[0]) {
    const d = L.doors[0];
    const gate = placeProp(P.wall_gate_door!, { x: d.x + 0.4, z: d.z, rotY: d.rotY, cast: false });
    if (gate && ALTA) gate.scaling.y *= PARAPET; // muro baixo da camera alta: o portao nao pode tapar o heroi
    sideDoorFx = buildSideDoor(scene, ctx.glow, roomRoot, d, def.sideDoor);
    sideDoors.push({ kind: def.sideDoor, x: d.x, z: d.z, radius: ROTA.doorRadius });
  }

  // --- Tochas/luminárias de parede: fileira baixa + alta (parede dupla). As 2 sconces mais
  //     perto da pista (lado da entrada) ganham LUZ QUENTE REAL de curto alcance (candelabro
  //     que ilumina a parede/chão, não só emissivo). Limitado a 2 p/ caber no teto de 6 luzes
  //     da cena (ambiente + chave + fagulha + braseiro). As demais ficam emissivas (glow). ---
  // POCAS DE LUZ por tipo de sala (paleta propria). Fundidas por cor/alpha: 1 draw call por grupo
  // (antes: 1 por tocha). O alpha de cada grupo acompanha a gangorra frio->quente (applyPools).
  const poolCol = THEME.pool; // por andar (antes: por RoomKind, que repete salao e cisterna)
  type PoolGroup = { mesh: Mesh; base: number; mode: "torch" | "warm" | "cold" | "brazier" };
  const poolGroups: PoolGroup[] = [];
  const addPools = (spots: { x: number; z: number; r: number }[], color: string, alpha: number, mode: PoolGroup["mode"]): void => {
    const m = buildPoolGroup(scene, spots, color, alpha, 0.19);
    if (!m) return;
    m.parent = roomRoot;
    track(m);
    poolGroups.push({ mesh: m, base: alpha, mode });
  };
  const torchPoolsLit: { x: number; z: number; r: number }[] = [];
  const torchPoolsDim: { x: number; z: number; r: number }[] = [];
  const torchesV = L.torches;
  // As duas tochas com luz real seguem o criterio de antes (fora das paredes sul e oeste), para a
  // iluminacao nao mudar; as demais so desenham o suporte e a chama.
  const litTorches = L.torches
    .filter((t) => !(ALTA && (t.z < -HALFZ + 1 || t.x < -HALFX + 1)))
    .sort((a, b) => a.z - b.z)
    .slice(0, 2); // mais ao sul (entrada)
  const TORCH_Y = ALTA ? 0.45 : 2.4; // no muro baixo, o suporte fica rente ao topo
  for (const t of torchesV) {
    const ix = Math.abs(t.x) >= HALFX - 0.6 ? -Math.sign(t.x) * 0.25 : 0;
    const iz = Math.abs(t.z) >= HALFZ - 0.6 ? -Math.sign(t.z) * 0.25 : 0;
    const realLight = litTorches.includes(t);
    batch("torch_wall", { x: t.x, z: t.z, y: TORCH_Y, rotY: t.rotY });
    const fl = makeFlame(new Vector3(t.x + ix, TORCH_Y + 0.35, t.z + iz), 0.7, realLight ? (ALTA ? 1.5 : 0.6) : 0, realLight);
    if (ALTA) {
      // Poça quente no chão, no lado de dentro da parede (as tochas apagadas ganham halo fraco).
      const inX = Math.abs(t.x) >= HALFX - 0.6 ? -Math.sign(t.x) * 2.2 : 0;
      const inZ = Math.abs(t.z) >= HALFZ - 0.6 ? -Math.sign(t.z) * 2.2 : 0;
      (realLight ? torchPoolsLit : torchPoolsDim).push({ x: t.x + inX, z: t.z + inZ, r: realLight ? 4.6 : 3.2 });
    }
    if (realLight && fl.light) {
      fl.light.range = ALTA ? 14 : 9; // curto: ilumina o entorno do candelabro sem lavar a sala
      fl.light.diffuse = Color3.FromHexString("#f0b878"); // candeia quente suave (sem estourar vermelho)
    }
    if (ALTA) continue;
    batch("torch_wall", { x: t.x, z: t.z, y: 6.0, rotY: t.rotY });
    makeFlame(new Vector3(t.x + ix, 6.35, t.z + iz), 0.6, 0, false);
  }

  addPools(torchPoolsLit, poolCol.torch, 0.42, "torch");
  addPools(torchPoolsDim, poolCol.torch, 0.24, "torch");
  // Pool do BRASEIRO: nasce apagada e cresce/acende com o aquecimento (gangorra frio -> quente).
  if (!def.node) {
    const bp = createLightPool(scene, { radius: 7.5, color: "#ffb870", alpha: 0.5, y: 0.19 });
    bp.position.set(0, 0.19, AZ - 3.2);
    bp.parent = roomRoot;
    track(bp);
    poolGroups.push({ mesh: bp, base: 0.5, mode: "brazier" });
  }
  // ACENTOS por tipo de sala (assinatura de luz), apoiados nas pecas pintadas no piso.
  {
    const zc = Math.min(0, AZ - 6);
    if (def.kind === "salao") {
      addPools([{ x: -7.5 * dressMirror, z: -3, r: 3.6 }, { x: 7 * dressMirror, z: 4, r: 3.2 }], poolCol.accent, 0.26, "warm");
    } else if (def.kind === "cisterna") {
      addPools(floorArt.puddles.map((p) => ({ x: p.x, z: p.z, r: p.r * 1.4 })), poolCol.accent, 0.08, "cold");
    } else if (def.kind === "santuario") {
      addPools(floorArt.candles, poolCol.accent, 0.4, "warm");
      addPools([{ x: 0, z: zc, r: 5.6 }], "#7a6cc8", 0.16, "cold");
    } else if (def.kind === "guardiao") {
      addPools(floorArt.embers, poolCol.accent, 0.24, "warm");
      addPools([{ x: 0, z: zc, r: 6.5 }], "#a01810", 0.14, "warm");
    }
  }
  // --- CANDELABROS de ferro pendentes do teto: cubo central + braços radiais + aro +
  //     6 grupos de velas acesas + luz quente. Fixtura de verdade, não um ponto de luz. ---
  const chandMat = new StandardMaterial("matCandelabro", scene);
  chandMat.diffuseColor = Color3.FromHexString("#241f18");
  chandMat.specularColor = Color3.FromHexString("#7a6638"); // brilho de ferro forjado
  const ARMS = 6;
  const R = 1.15; // raio do candelabro
  const hangChandelier = (cxp: number, czp: number): void => {
    const ringY = ROOM_H - 1.7; // ~6.3: acima da câmera de jogo, mas claramente visível ao olhar pra cima
    const part = (m: Mesh): void => { m.material = chandMat; m.isPickable = false; track(m); ctx.shadow.addShadowCaster(m); casters.push(m); };
    // corrente do teto ao cubo central
    const chain = MeshBuilder.CreateCylinder("corrente", { diameter: 0.07, height: ROOM_H - ringY, tessellation: 6 }, scene);
    chain.position.set(cxp, (ROOM_H + ringY) / 2, czp); part(chain);
    // cubo/eixo central
    const hub = MeshBuilder.CreateCylinder("eixo_candelabro", { diameter: 0.28, height: 0.5, tessellation: 8 }, scene);
    hub.position.set(cxp, ringY, czp); part(hub);
    // aro de ferro
    const ring = MeshBuilder.CreateTorus("aro_candelabro", { diameter: R * 2, thickness: 0.09, tessellation: 22 }, scene);
    ring.position.set(cxp, ringY - 0.1, czp); part(ring);
    for (let i = 0; i < ARMS; i++) {
      const a = (i / ARMS) * Math.PI * 2;
      const ex = cxp + Math.cos(a) * R;
      const ez = czp + Math.sin(a) * R;
      // braço radial (barra fina) do cubo ao aro
      const arm = MeshBuilder.CreateBox("braco_candelabro", { width: R, height: 0.06, depth: 0.06 }, scene);
      arm.position.set(cxp + Math.cos(a) * R / 2, ringY + 0.05, czp + Math.sin(a) * R / 2);
      arm.rotation.y = -a; part(arm);
      // copo + vela acesa na ponta do braço
      placeProp(P.candle_triple!, { x: ex, z: ez, y: ringY + 0.05, rotY: a, scale: 0.7, cast: false });
      makeFlame(new Vector3(ex, ringY + 0.45, ez), 0.34, 0, false); // chama da vela (emissiva, sem luz própria)
    }
    makeFlame(new Vector3(cxp, ringY + 0.2, czp), 0.8, 0, false); // brilho central (emissivo; sem point-light p/ não estourar a sala)
  };
  // Eixo central, espaçados; densidade cresce com a profundidade da sala.
  if (ALTA) chandMat.dispose(); // sem candelabros na camera alta: o material nao seria usado (vazava 1 por sala)
  if (!ALTA) {
    hangChandelier(0, -(HALFZ - 6));
    hangChandelier(0, Math.min(2, AZ - 4));
    if (HALFZ >= 16) hangChandelier(0, -(HALFZ - 13));
  }

  // --- DRESSING por TIPO DE SALA (def.kind) ---
  // Clusters tematicos; cada tipo de sala (RoomDef.kind) liga um subconjunto. Pecas
  // repetidas vao por batch() (instanciadas no flush); pecas unicas por placeProp() (clone).
  // Reusa as coordenadas ja testadas: a variacao e QUAIS clusters aparecem, nao o layout-base.
  const seedRot = (i: number): number => rng(i) * Math.PI * 2;

  // Os clusters referenciam HALFX/HALFZ (paredes) e AZ (z do altar). Calibrados para que a
  // planta quadrada 24x24 (HALFX=HALFZ=12, AZ=9.2) fique IDENTICA a versao anterior; nas
  // demais formas os props seguem as paredes/altar reais em vez de coordenadas fixas.
  function clusterBanners(count: number): void {
    if (ALTA) return; // estandartes pendem de parede alta; nos muros baixos nao ha onde pendurar
    const spots: Spot[] = [
      { x: -3.8, z: HALFZ - 0.5, y: 1.4, tall: true }, { x: 3.8, z: HALFZ - 0.5, y: 1.4, tall: true },
      { x: -HALFX + 0.5, z: 2, y: 1.4, rotY: Math.PI / 2, tall: true }, { x: HALFX - 0.5, z: -6, y: 1.4, rotY: -Math.PI / 2, tall: true },
    ];
    spots.slice(0, count).forEach((s) => batch("banner", s));
    batch("wall_deco_a", { x: -4, z: HALFZ - 0.3, tall: true });
    if (count > 2) batch("wall_deco_a", { x: HALFX - 2, z: -HALFZ + 0.3, tall: true });
  }

  function clusterMess(): void {
    // Refeitorio/guarnicao: mesa, banco, cadeiras, suporte de armas, refeicao, espada.
    placeProp(P.table!, { x: -7.5, z: -3, rotY: 0.3, collider: true });
    placeProp(P.bench!, { x: -7.5, z: -4.4, rotY: 0.2, collider: true });
    batch("chair", { x: -6, z: -2.2, rotY: -1.2, collider: true }, true);
    batch("chair", { x: -8.8, z: -2, rotY: 0.6, collider: true }, true);
    placeProp(P.weapon_rack!, { x: -2, z: -HALFZ + 0.7, collider: true });
    placeProp(P.bucket!, { x: -6.6, z: -1.2, rotY: 0.4 });
    placeProp(P.plate_food_A!, { x: -7.2, z: -3.1, cast: false });
    placeProp(P.sword_shield!, { x: -3.0, z: -6.5, rotY: -0.6, cast: false });
  }

  function clusterStorage(keg: boolean): void {
    // Armazem: barris, caixas, potes (encostados na parede sul, qualquer que seja seu z).
    const zS = -(HALFZ - 4);
    batch("barrel", { x: -HALFX + 1.2, z: zS, collider: true }, true);
    batch("barrel", { x: -HALFX + 2.1, z: zS - 0.4, collider: true }, true);
    batch("barrel", { x: -HALFX + 1.6, z: zS + 0.8, y: 1.0 }, true);
    batch("crate", { x: HALFX - 1.4, z: zS + 1, rotY: 0.4, collider: true }, true);
    batch("crate", { x: HALFX - 1.5, z: zS - 0.5, rotY: -0.3, collider: true }, true);
    batch("crate", { x: HALFX - 1.4, z: zS + 0.6, y: 1.0, rotY: 0.9 }, true);
    batch("pots", { x: 7, z: 3, rotY: 0.5 });
    batch("pots", { x: -3, z: 4, rotY: 1.4 });
    if (keg) placeProp(P.keg!, { x: -HALFX + 1.1, z: zS + 2, rotY: 0.3, collider: true });
  }

  function clusterAlchemy(): void {
    // Estantes + pocoes (parede leste, na faixa entre o centro e o altar).
    const zb = Math.min(AZ - 3.7, HALFZ - 4.5);
    placeProp(P.bookcase!, { x: HALFX - 0.7, z: zb, rotY: -Math.PI / 2, collider: true, tall: true });
    placeProp(P.bookcase!, { x: HALFX - 0.7, z: zb - 3, rotY: -Math.PI / 2, collider: true, tall: true });
    if (!ALTA) placeProp(P.bookcase!, { x: -HALFX + 0.7, z: zb - 1.5, rotY: Math.PI / 2, collider: true }); // (camera alta: lado da camera, vazio)
    placeProp(P.shelf_small_candles!, { x: HALFX - 0.7, z: zb + 1.9, rotY: -Math.PI / 2, collider: true, tall: true });
    placeProp(P.bottle_A_green!, { x: HALFX - 1.0, z: zb + 0.7, cast: false, tall: true });
    placeProp(P.bottle_B_green!, { x: HALFX - 1.0, z: zb + 0.45, cast: false, tall: true });
    placeProp(P.bottle_C_brown!, { x: HALFX - 1.0, z: zb + 0.95, cast: false, tall: true });
  }

  function clusterCatacomb(full: boolean): void {
    // Caixoes e tumulos encostados na parede oeste (le a sala como catacumba).
    placeProp(P.coffin!, { x: -HALFX + 1.0, z: 1.4, rotY: Math.PI / 2, collider: true });
    placeProp(P.coffin_decorated!, { x: -HALFX + 1.0, z: -1.4, rotY: Math.PI / 2, collider: true });
    placeProp(P.gravestone!, { x: -HALFX + 0.9, z: AZ - 0.6, rotY: Math.PI / 2 });
    placeProp(P.grave_A!, { x: -HALFX + 1.6, z: AZ + 1.2, rotY: Math.PI / 2, cast: false });
    if (full) placeProp(P.gravemarker_A!, { x: -HALFX + 1.1, z: -(HALFZ - 3.8), rotY: Math.PI / 2 });
  }

  function clusterRitual(): void {
    // Candelabros sobre o estrado, relicario, placa votiva, lanterna (relativos ao altar).
    batch("candle_triple", { x: -2.3, z: AZ + 0.2, y: 0.9 });
    batch("candle_triple", { x: 2.3, z: AZ + 0.2, y: 0.9 });
    placeProp(P.skull_candle!, { x: 1.3, z: AZ - 0.7, y: 0.9, scale: 0.9, cast: false });
    placeProp(P.shrine_candles!, { x: -5.2, z: AZ + 0.2, rotY: 0.4, collider: true });
    placeProp(P.plaque_candles!, { x: 4.0, z: HALFZ - 0.3, y: 1.6, cast: false, tall: true });
    placeProp(P.lantern_standing!, { x: -(HALFX - 4), z: 2.6 });
  }

  function clusterTreasure(gold: boolean): void {
    placeProp(P.chest!, { x: 3, z: AZ - 2.2, rotY: -0.5, collider: true });
    batch("coins", { x: 3.6, z: AZ - 2.9, rotY: 0.3 });
    batch("coins", { x: -2.6, z: AZ - 2.0, rotY: 1.1 });
    if (gold) {
      // Recompensa do chefe: bau dourado + pilhas de moeda + chave (lado leste do estrado).
      placeProp(P.chest_gold!, { x: 6.0, z: AZ - 1.0, rotY: -0.5, collider: true });
      placeProp(P.coin_stack_large!, { x: 6.9, z: AZ - 1.6, rotY: 0.5 });
      placeProp(P.coin_stack_medium!, { x: 5.2, z: AZ - 1.7, rotY: -0.3 });
      placeProp(P.key!, { x: 6.2, z: AZ - 2.3, rotY: 0.2 });
    }
  }

  function clusterGrime(density: number): void {
    // Pilha de caveiras junto ao estrado (o entulho e as ossadas soltas do chão vivem em cryptFloor).
    const pile = Math.round(density * 7);
    for (let i = 0; i < pile; i++)
      batch("skull", { x: -(HALFX - 2.6) + rng(i + 30) * 1.6, z: (AZ - 0.6) + rng(i + 40) * 1.6, y: rng(i + 50) * 0.25, rotY: seedRot(i), scale: 0.3 + rng(i + 10) * 0.1 });
  }

  // Espalha BICHOS (modelos reais low-poly) rente as paredes/cantos, se os assets existirem
  // no cache (carregados em ensurePieces com try/catch). Sem asset, nao faz nada (a regra
  // proibe esculpir bicho com primitiva). Pequenos, baixos, encostados nas bordas.
  function scatterCritters(): void {
    const kinds = (["rat", "spider", "roach"] as const).filter((k) => cache && cache[k]);
    if (kinds.length === 0) return;
    if (!critterMat) {
      // Modelos do Tripo vem SEM textura (gerados --no-texture p/ evitar o crash de RGBD do
      // loader): dar um material escuro de vermina (le no breu sem virar branco default).
      const cm = new StandardMaterial("vermeMat", scene);
      cm.diffuseColor = Color3.FromHexString("#2a2622");
      cm.emissiveColor = Color3.FromHexString("#0c0a08");
      cm.specularColor = Color3.Black();
      critterMat = cm;
    }
    const n = 3 + Math.round(rng(120) * 5);
    for (let i = 0; i < n; i++) {
      const k = kinds[Math.floor(rng(i + 130) * kinds.length)]!;
      const onX = rng(i + 131) > 0.5;
      const wallSign = rng(i + 132) > 0.5 ? 1 : -1;
      const x = onX ? wallSign * (HALFX - 1.0 - rng(i + 133) * 1.5) : (rng(i + 134) - 0.5) * (HALFX * 1.5);
      const z = onX ? (rng(i + 135) - 0.5) * (HALFZ * 1.5) : wallSign * (HALFZ - 1.0 - rng(i + 136) * 1.5);
      // Tripo gera ~1-2u; bicho e pequeno. Normaliza pela altura-alvo (placeProp aterra os pes).
      const targetH = k === "spider" ? 0.35 : k === "roach" ? 0.22 : 0.45; // m
      const root = placeProp(cache![k]!, { x, z, rotY: rng(i + 137) * Math.PI * 2, targetH, cast: false, dyn: true });
      if (!root) continue;
      for (const m of root.getChildMeshes(false)) (m as AbstractMesh).material = critterMat;
      // BICHO MATAVEL: um golpe o esmaga (some + estilhaco), reusando o sistema de StrikeProp.
      strikeProps.push({ pos: new Vector3(x, 0.25, z), r: 0.7, kind: "break", strike: () => root.dispose() });
    }
  }

  // Abandono/decadencia: TEIAS de aranha nos cantos altos e MUSGO/trepadeira pendente nas
  // paredes. Geometria de ambiente (nao sao "props de biblioteca"), seeded por andar para
  // nao repetir. Os BICHOS (ratos/aranhas) entram via modelos reais (critterPieces), abaixo.
  function clusterDecay(): void {
    if (!decayWebMat) {
      const w = new StandardMaterial("teiaMat", scene);
      w.diffuseColor = Color3.FromHexString("#11151c");
      w.emissiveColor = Color3.FromHexString("#3a4452"); // leve cinza-frio p/ ler no escuro
      w.specularColor = Color3.Black();
      w.alpha = 0.5;
      w.backFaceCulling = false;
      decayWebMat = w;
    }
    if (!decayMossMat) {
      const m = new StandardMaterial("musgoMat", scene);
      m.diffuseColor = Color3.FromHexString("#2a3322"); // verde-escuro envelhecido
      m.emissiveColor = Color3.FromHexString("#10160d");
      m.specularColor = Color3.Black();
      m.backFaceCulling = false;
      decayMossMat = m;
    }
    // Teias triangulares nos cantos superiores LONGE da camera (os do lado da camera perderam a
    // parede). Todas fundidas numa malha so (1 draw call), em vez de um plano por teia.
    const webParts: Mesh[] = [];
    const webAt = (x: number, z: number, sx: number, sz: number, y: number, i: number): void => {
      const web = MeshBuilder.CreatePlane(`teia_${i}`, { size: 1, sideOrientation: Mesh.DOUBLESIDE }, scene);
      web.position.set(x, y, z);
      web.scaling.set(sx, sz, 1);
      web.rotation.set(Math.PI / 2.6, Math.atan2(x, z) + Math.PI, rng(i) * 0.4);
      web.bakeCurrentTransformIntoVertices();
      webParts.push(web);
    };
    const corners: [number, number][] = [[-HALFX + 1, HALFZ - 1], [HALFX - 1, HALFZ - 1], [-HALFX + 1, -HALFZ + 1], [HALFX - 1, -HALFZ + 1]];
    corners.forEach(([cx, cz], i) => {
      const wy = ALTA ? WALL_H * PARAPET - 0.35 + rng(i + 3) * 0.2 : WALL_H - 1.2 + rng(i + 3);
      const wk = ALTA ? 0.55 : 1;
      if (rng(i + 60) > 0.35) webAt(cx, cz, (1.6 + rng(i + 1) * 1.4) * wk, (1.6 + rng(i + 2) * 1.2) * wk, wy, i);
    });
    const webMesh = webParts.length ? Mesh.MergeMeshes(webParts, true, true) : null;
    if (webMesh) { webMesh.material = decayWebMat!; webMesh.isPickable = false; webMesh.parent = roomRoot; track(webMesh); }
    // Trepadeira/musgo pendente: tiras finas escorrendo do topo das paredes (so as do fundo/leste),
    // fundidas numa malha so.
    const vineParts: Mesh[] = [];
    const vineN = 5 + Math.round(rng(70) * 5);
    for (let i = 0; i < vineN; i++) {
      const onX = rng(i + 80) > 0.5;
      const wallSign = rng(i + 81) > 0.5 ? 1 : -1;
      const len = ALTA ? 0.35 + rng(i + 82) * 0.5 : 1.2 + rng(i + 82) * 2.4;
      const inset = ALTA ? 0.55 : 0.4;
      const px = onX ? wallSign * (HALFX - inset) : (rng(i + 83) - 0.5) * (HALFX * 1.6);
      const pz = onX ? (rng(i + 84) - 0.5) * (HALFZ * 1.6) : wallSign * (HALFZ - inset);
      const vine = MeshBuilder.CreateBox(`trepadeira_${i}`, { width: 0.12 + rng(i + 85) * 0.12, height: len, depth: 0.04 }, scene);
      vine.position.set(px, ALTA ? WALL_H * PARAPET - 0.1 - len / 2 : WALL_H + 1 - len / 2 + rng(i + 86), pz);
      vine.rotation.y = onX ? Math.PI / 2 : 0;
      vine.bakeCurrentTransformIntoVertices();
      vineParts.push(vine);
    }
    const vineMesh = vineParts.length ? Mesh.MergeMeshes(vineParts, true, true) : null;
    if (vineMesh) { vineMesh.material = decayMossMat!; vineMesh.isPickable = false; vineMesh.parent = roomRoot; track(vineMesh); }
    // BICHOS: ratos/aranhas/baratas (modelos reais CC0/Tripo, se presentes). Espalha alguns
    // rente as paredes/cantos. Sem modelo disponivel, nao desenha (nada de primitiva p/ bicho).
    scatterCritters();
  }

  // PROPS INTERATIVOS (sem jitter, p/ a hitbox casar com o visual): cadeiras que tombam ao
  // chute/golpe e vasos/garrafas que estilhacam. Colocados em pontos sensatos (mesa/paredes).
  function clusterInteractive(): void {
    // Tudo na METADE SUL (entrada), longe da catacumba (oeste-meio), biblioteca (leste-meio)
    // e altar (norte) -> nada se sobrepoe. Duas cadeiras chutaveis e quatro vasos quebraveis.
    placeKickable(P.chair!, { x: -4, z: -7, rotY: 0.5 });
    placeKickable(P.chair!, { x: 4, z: -7, rotY: -0.5 });
    placeBreakable(P.pots!, { x: HALFX - 1.6, z: -5, rotY: 0.3 });
    placeBreakable(P.pots!, { x: -HALFX + 1.6, z: -5, rotY: 1.1 });
    placeBreakable(P.bottle_A_green!, { x: HALFX - 2.0, z: -8, scale: 1.5 });
    placeBreakable(P.bottle_C_brown!, { x: -HALFX + 2.0, z: -8, scale: 1.5 });
    // PERGAMINHOS/INSCRICOES legiveis ([R] perto): lore ligada a descida e as estilhas.
    // (com porta lateral o tratado sai da frente dela: o gatilho da porta tem raio 1,8)
    readables.push({ x: HALFX - 1.8, z: def.sideDoor ? -2.5 : 3.5, text: "Tratado das Acendedoras: \"Desce. Recolhe cada estilha. So no fundo, com todas, a Brasa volta a arder.\"" });
    readables.push({ x: -HALFX + 1.8, z: 0.0, text: "Inscricao na lapide: \"Aqui jaz a guarda da chama. Foram teu povo, antes do frio.\"" });
    readables.push({ x: 0, z: AZ - 3.4, text: "Sobre o relicario: \"A estilha nao aquece - lembra. Leva o que o fogo foi ate onde ele pode ser de novo.\"" });
  }

  // ANDAR 1 (guarda) e CURADO a mao (sem espelho/jitter): cada coisa num lugar com proposito.
  // Os demais andares variam (dressing on) para nao repetir.
  // Antecamara: so a planta e a luz (o conteudo de cada uma entra em cryptNodes, nas fases seguintes).
  dressing = def.kind !== "guarda";
  switch (def.node ? "node" : def.kind) {
    case "node": // antecamara vazia: so a planta e a luz do andar (o nome vem no HUD; o conteudo, em cryptNodes)
      break;
    case "guarda": // SALA-CRIPTA DE REFERENCIA, curada e SEM amontoado: cada zona numa parede.
      clusterBanners(3); // estandartes na parede norte (sem pegada no chao)
      clusterCatacomb(true); // tumulos/caixoes na parede OESTE (catacumba)
      clusterAlchemy(); // estantes + frascos na parede LESTE (biblioteca)
      clusterRitual(); // candelabros/relicario/lanterna em volta do altar (norte)
      clusterTreasure(false); // bau perto do estrado
      clusterGrime(0.25); // pouquissimo escombro (evita sobrepor as zonas)
      // (sem clusterMess: a mesa+bancos+cadeiras amontoavam no oeste e batiam na catacumba)
      break;
    case "salao": // grande salao: estandartes, banquete, alquimia, ritual leve
      clusterBanners(4); clusterMess(); clusterAlchemy(); clusterRitual();
      clusterTreasure(false); clusterGrime(0.4);
      break;
    case "cisterna": // cisterna em ruinas: armazem + muitos escombros e ossadas, pouco mobiliario
      clusterBanners(1); clusterStorage(true); clusterCatacomb(false);
      clusterTreasure(false); clusterGrime(1.0);
      break;
    case "santuario": // santuario: ritual + catacumba + alquimia, reverente
      clusterBanners(2); clusterRitual(); clusterCatacomb(true); clusterAlchemy();
      clusterTreasure(false); clusterGrime(0.6);
      break;
    case "guardiao": // arena do chefe: catacumba imponente, ritual, tesouro dourado, chao limpo
      clusterBanners(4); clusterRitual(); clusterCatacomb(true);
      clusterTreasure(true); clusterGrime(0.3);
      break;
  }
  if (!def.node) clusterDecay(); // abandono: teias, mofo/vegetacao envelhecida e bichos (varia por andar)
  dressing = false;
  // Velas votivas do santuario (reais, 1 batch ja usado pelo ritual) sobre as pintadas no piso.
  if (def.kind === "santuario" && !def.node) for (const c of floorArt.candles) batch("candle_triple", { x: c.x, z: c.z, scale: 1.15 });
  if (!def.node) clusterInteractive(); // cadeiras/vasos interativos (fora do jitter: hitbox = visual)

  // Instancia todo o dressing repetido acumulado (1 draw call por tipo) + colisores.
  flushBatches();

  // ESTILO (Bloco 1, spec-estilo-visual-render §4.1a): cenário em faixas toon. Converte só as
  // malhas do MUNDO (roomRoot) que são LIT; chamas/feixe/decalques (disableLighting) ficam
  // lisos e os atores não estão em roomRoot, então o emissivo de combate deles fica intacto.
  // Materiais do kit PERSISTENTES (KIT_TOON) e cenario estatico fundido por material: a sala
  // inteira (props avulsos + bases de thin instances) vira ~1 malha por material em vez de
  // dezenas de props. Alcapao, vasos, cadeiras e bichos (metadata.dyn) ficam independentes.
  // So os materiais que VEM dos glb do kit (compartilhados entre salas) entram no cache persistente;
  // piso pintado, caverna, nicho etc. sao da sala e seguem com CellMaterial proprio (descartado com ela).
  const stoneTint = Color3.FromHexString(THEME.stone); // pedra de muros e pilares no tom do andar (vai nos vertices)
  const kitMats = new Set<Material>();
  for (const c of Object.values(P)) for (const mt of c.materials) kitMats.add(mt);
  const toonOpts = { skipDisableLighting: true, maxLights: 6, cache: KIT_TOON, recolor: kitRecolor, accept: (m: Material) => kitMats.has(m) };
  {
    const casterSet = new Set<AbstractMesh>(casters);
    const isDyn = (m: AbstractMesh): boolean => {
      for (let n: BNode | null = m; n && n !== roomRoot; n = n.parent) if ((n.metadata as { dyn?: boolean } | null)?.dyn) return true;
      return false;
    };
    const res = mergeStaticByMaterial(scene, roomRoot, {
      parent: roomRoot,
      eligible: (m) => !isDyn(m),
      resolve: (src) => {
        if (!kitMats.has(src)) return null;
        const flat = flatColorOf(src);
        if (flat) {
          const col = kitRecolor(src.name, flat).scale(1 / KIT_FLAT_BASE); // cor chapada: 1 material, cor nos vertices
          return { material: kitFlatMaterial(scene), color: /^Stone/.test(src.name) ? col.multiply(stoneTint) : col };
        }
        const mt = toonMaterialFor(scene, src, toonOpts); // com textura (HalloweenBits): CellMaterial proprio
        return mt ? { material: mt } : null;
      },
      casts: (m) => casterSet.has(m),
    });
    for (const r of res.removed) {
      if (casterSet.has(r)) {
        ctx.shadow.removeShadowCaster(r);
        const i = casters.indexOf(r);
        if (i >= 0) casters.splice(i, 1);
      }
    }
    for (const mm of res.merged) if (mm.casts) { ctx.shadow.addShadowCaster(mm.mesh); casters.push(mm.mesh); }
  }
  toonifyHierarchy(roomRoot, toonOpts); // kit que ficou independente (alcapao, vasos, cadeiras): materiais persistentes
  toonifyHierarchy(roomRoot, { skipDisableLighting: true, maxLights: 6 }); // o resto da sala: CellMaterial proprio

  // Materiais aceitam ate 6 luzes (evita a ambiente ser descartada). Os atores pedem mais (8,
  // heroModel/skeleton/guardiao: luz de aro + fagulha + tochas); nao rebaixar o que ja e maior.
  for (const m of scene.materials) {
    const mm = m as unknown as { maxSimultaneousLights?: number };
    if (typeof mm.maxSimultaneousLights === "number" && mm.maxSimultaneousLights < 6) mm.maxSimultaneousLights = 6;
  }

  // Tremular das chamas (escala por `ignite`: apagada some, acesa tremula normal).
  let flameBuf: Float32Array | null = null;
  const flicker: Observer<Scene> = scene.onBeforeRenderObservable.add(() => {
    const t = performance.now() / 1000;
    if (flameBase) {
      if (!flameBuf) { flameBuf = new Float32Array(flames.length * 16); flameBase.thinInstanceSetBuffer("matrix", flameBuf, 16, false); }
      let anyOn = false;
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i]!;
        const fl = 0.85 + 0.15 * Math.sin(t * 11 + f.seed) + 0.06 * Math.sin(t * 23 + f.seed * 2);
        if (f.light) f.light.intensity = f.base * fl * f.ignite;
        const on = f.ignite > 0.02;
        const o = i * 16;
        const sx = on ? f.scale : 0; // apagada: matriz degenerada
        const sy = on ? f.scale * (0.9 + 0.18 * Math.sin(t * 13 + f.seed)) * (0.4 + 0.6 * f.ignite) : 0;
        flameBuf.fill(0, o, o + 16);
        flameBuf[o] = sx; flameBuf[o + 5] = sy; flameBuf[o + 10] = sx; flameBuf[o + 15] = 1;
        flameBuf[o + 12] = f.pos.x; flameBuf[o + 13] = f.pos.y; flameBuf[o + 14] = f.pos.z;
        if (on) anyOn = true;
      }
      flameBase.thinInstanceBufferUpdated("matrix");
      if (flameBase.isEnabled() !== anyOn) flameBase.setEnabled(anyOn);
    }
    floorArt.update(t);
    if (beam.isEnabled()) {
      beam.rotation.y = t * 0.5;
      const s = 1 + 0.07 * Math.sin(t * 3);
      beam.scaling.x = s;
      beam.scaling.z = s;
    }
  });

  // W4: IDENTIDADE POR ZONA. Quanto mais fundo a câmara, mais frio/escuro/denso o ar (sem
  // tocar a geometria nem a câmera). 0 = raso (claro), 1 = fundo (monumental, gélido).
  // Alvos de cor da virada frio->quente: vem do TEMA do andar (cryptTheme), nao mais da profundidade.
  const COLD_FOG = Color3.FromHexString(THEME.fog.cold);
  const WARM_FOG = Color3.FromHexString(THEME.fog.warm);
  const COLD_AMB = Color3.FromHexString(THEME.amb.cold);
  const WARM_AMB = Color3.FromHexString(THEME.amb.warm);
  const COLD_INTENSITY = THEME.amb.intensity;
  // W4: COREOGRAFIA de baixo para cima. A virada frio->quente nao e um lerp uniforme: a luz
  // quente NASCE no chao (braseiro + decalque), SOBE pelas paredes (oferendas + nevoa) e por
  // fim alcanca a abobada (luz ambiente do "ceu"). t e fatiado em tres estagios sobrepostos.
  const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
  // Gangorra das POCAS DE LUZ: tochas ganham forca ao aquecer, o braseiro nasce apagado, acentos
  // quentes crescem e acentos frios (agua, runas) recuam. floorK/wallK como em setBrazierLit.
  const applyPools = (floorK: number, wallK: number): void => {
    for (const g of poolGroups) {
      const mat = g.mesh.material as StandardMaterial | null;
      if (!mat) continue;
      let a = g.base;
      if (g.mode === "torch") a *= 0.55 + 0.45 * wallK;
      else if (g.mode === "warm") a *= 0.4 + 0.6 * wallK;
      else if (g.mode === "cold") a *= 1 - 0.5 * floorK;
      else a *= floorK;
      mat.alpha = a;
      g.mesh.setEnabled(a > 0.01);
      if (g.mode === "brazier") g.mesh.scaling.setAll(0.65 + 0.35 * floorK);
    }
  };
  const setBrazierLit = (t: number): void => {
    const k = clamp01(t);
    const floorK = clamp01(t / 0.45); // 1o: chao (braseiro + decalque)
    const wallK = clamp01((t - 0.35) / 0.45); // 2o: paredes (oferendas + nevoa)
    const vaultK = clamp01((t - 0.6) / 0.4); // 3o: abobada (luz ambiente)
    brazierFlame.ignite = floorK;
    applyPools(floorK, wallK);
    offerL.ignite = wallK;
    offerR.ignite = wallK;
    if (decalMat) {
      // o decalque do chao "pega" a luz primeiro (brilha ao acender).
      const g = 0.45 + 0.55 * floorK;
      decalMat.emissiveColor.set(decalBaseEmissive.r * g, decalBaseEmissive.g * g, decalBaseEmissive.b * g);
    }
    scene.fogColor = Color3.Lerp(COLD_FOG, WARM_FOG, wallK);
    ctx.ambient.intensity = COLD_INTENSITY - THEME.amb.warmDrop * vaultK; // a abobada esfria por ultimo
    ctx.ambient.diffuse = Color3.Lerp(COLD_AMB, WARM_AMB, vaultK);
    ctx.key.intensity = THEME.key.intensity - THEME.key.warmDrop * k;
    cave?.setLit(k);
    atmosphere?.setLit(k);
  };
  setBrazierLit(0); // a sala nasce FRIA (braseiro apagado)
  scene.fogDensity = THEME.fog.density; // por andar (não tocado pela virada)

  // ===========================================================================================
  // ARENA DO GUARDIÃO (só def.kind === "guardiao"): a gangorra de luz lida no MUNDO + os hazards
  // de chão da fase 3. O chefe é a fonte de verdade; aqui só REAGIMOS aos medidores dele.
  // Tudo é descartável (rastreado em roomRoot/observers/aggregates) e barato (poucas malhas).
  // ===========================================================================================
  let arena: ArenaControls | undefined;
  if (def.kind === "guardiao") {
    // --- Luz-chave da Brasa lida no mundo (spec §3, §4.1): a Brasa central é a luz-chave;
    //     sua intensidade VARIA com o estágio (forte/bruxulejando/quase morta). Reusa a chama
    //     do braseiro central como medidor visível: light alta -> arena clara e quente; light
    //     baixa -> breu azul cerrado. Não acende a virada de vitória (essa é setBrazierLit). ---
    const ARENA_COLD_FOG = Color3.FromHexString("#0e1a2b"); // breu azul (§3)
    const ARENA_WARM_FOG = Color3.FromHexString("#3e5c7e");
    const ARENA_COLD_AMB = Color3.FromHexString("#3e5c7e"); // azul-frio quando apaga
    const ARENA_WARM_AMB = Color3.FromHexString("#ffa63d"); // laranja-quente quando arde (§3)
    let brasaShown = -1; // último valor aplicado (evita recomputar quando estável)

    const setBrasaLight = (light: number): void => {
      const v = clamp01(light);
      if (Math.abs(v - brasaShown) < 0.004) return; // estável: nada a fazer
      brasaShown = v;
      cave?.setBrasaLight(v);
      // A chama central da Brasa moribunda acompanha o medidor (some quase de todo no breu).
      brazierFlame.ignite = 0.15 + 0.85 * v;
      applyPools(v, v);
      brazierFlame.base = 1.0 + 2.4 * v; // a luz pontual cresce com a luz da Brasa
      // Névoa + ambiente: arde -> claro/quente; apaga -> breu azul (a luz é a leitura de fase).
      scene.fogColor = Color3.Lerp(ARENA_COLD_FOG, ARENA_WARM_FOG, v);
      scene.fogDensity = 0.012 - 0.006 * v; // breu mais denso quando apaga (sem cegar)
      ctx.ambient.intensity = 0.16 + 0.34 * v; // câmara escura no breu, exposta na luz
      ctx.ambient.diffuse = Color3.Lerp(ARENA_COLD_AMB, ARENA_WARM_AMB, v);
      ctx.key.intensity = 0.22 + 0.5 * v;
      if (decalMat) {
        // as rachaduras do chão brilham em tiço quando a Brasa está fraca (leitura redundante).
        const g = 0.4 + 0.9 * (1 - v);
        decalMat.emissiveColor.set(decalBaseEmissive.r * g, decalBaseEmissive.g * g, decalBaseEmissive.b * g);
      }
    };

    // --- Maré de breu (§5.6): um anel escuro semitransparente nas BORDAS da arena que adensa
    //     na fase 3. Sutil (alpha baixo), nunca cegante; a fagulha do herói sempre ilumina o
    //     entorno imediato (não mexemos no centro). 1 draw call (toro plano emissivo escuro). ---
    const breuMat = new StandardMaterial("mareBreuMat", scene);
    breuMat.diffuseColor = Color3.Black();
    breuMat.specularColor = Color3.Black();
    breuMat.emissiveColor = Color3.FromHexString("#05080f");
    breuMat.disableLighting = true;
    breuMat.alpha = 0;
    const breuRing = MeshBuilder.CreateTorus(
      "mare_breu",
      { diameter: Math.min(HALFX, HALFZ) * 1.7, thickness: Math.min(HALFX, HALFZ) * 0.85, tessellation: 40 },
      scene
    );
    breuRing.rotation.x = Math.PI / 2;
    breuRing.position.set(0, 0.5, AZ - 6);
    breuRing.material = breuMat;
    breuRing.isPickable = false;
    breuRing.parent = roomRoot;
    breuRing.setEnabled(false);
    let breuTarget = 0; // alpha-alvo da maré (0 desligada; ~0.5 ligada na fase 3)
    const setMareDeBreu = (on: boolean): void => {
      breuTarget = on ? 0.5 : 0;
      if (on && !breuRing.isEnabled()) breuRing.setEnabled(true);
    };

    // --- Frio que morde (§5.6): zonas de gelo telegrafadas. Cada zona é UM disco azul que
    //     CRESCE na telegrafia, fica ATIVA (cor saturada + cristais) e some. Pool fixo (perf):
    //     no máximo MAX_FROST zonas; reciclamos a mais antiga. Cristais = 3 prismas finos por
    //     zona (1 draw call por zona via merge), girando devagar. ---
    const MAX_FROST = 4;
    const frostMat = new StandardMaterial("geloMat", scene);
    frostMat.diffuseColor = Color3.Black();
    frostMat.specularColor = Color3.Black();
    frostMat.emissiveColor = Color3.FromHexString("#3fa9c9");
    frostMat.disableLighting = true;
    frostMat.alpha = 0.5;
    interface FrostZone {
      x: number;
      z: number;
      radius: number;
      telegraph: number; // segundos de antecipação restantes
      active: number; // segundos de janela ativa restantes (após a telegrafia)
      disc: Mesh;
      crystals: Mesh;
      alive: boolean;
    }
    const frostZones: FrostZone[] = [];
    const makeFrostMeshes = (): { disc: Mesh; crystals: Mesh } => {
      const disc = MeshBuilder.CreateDisc("gelo", { radius: 1, tessellation: 28 }, scene);
      disc.rotation.x = Math.PI / 2;
      disc.material = frostMat;
      disc.isPickable = false;
      disc.parent = roomRoot;
      ctx.glow.addIncludedOnlyMesh(disc); // leve halo frio (leitura no breu)
      // cristais: 3 prismas finos, mesclados (1 draw call), levantados do chão.
      const prisms: Mesh[] = [];
      for (let i = 0; i < 3; i++) {
        const c = MeshBuilder.CreateCylinder("cristal", { diameterTop: 0, diameterBottom: 0.22, height: 0.7 + 0.2 * i, tessellation: 4 }, scene);
        c.position.set(Math.cos(i * 2.1) * 0.4, 0.35, Math.sin(i * 2.1) * 0.4);
        c.bakeCurrentTransformIntoVertices();
        prisms.push(c);
      }
      const crystals = Mesh.MergeMeshes(prisms, true, true)!;
      crystals.material = frostMat;
      crystals.isPickable = false;
      crystals.parent = roomRoot;
      return { disc, crystals };
    };
    const spawnFrostZone = (x: number, z: number, radius: number, telegraphSec: number, activeSec: number): void => {
      let zone = frostZones.find((f) => !f.alive);
      if (!zone && frostZones.length < MAX_FROST) {
        const { disc, crystals } = makeFrostMeshes();
        zone = { x, z, radius, telegraph: telegraphSec, active: activeSec, disc, crystals, alive: true };
        frostZones.push(zone);
      } else if (!zone) {
        zone = frostZones[0]!; // recicla a mais antiga (pool cheio)
      }
      zone.x = x;
      zone.z = z;
      zone.radius = radius;
      zone.telegraph = telegraphSec;
      zone.active = activeSec;
      zone.alive = true;
      zone.disc.position.set(x, 0.07, z);
      zone.crystals.position.set(x, 0.07, z);
      zone.disc.setEnabled(true);
      zone.crystals.setEnabled(false); // os cristais sobem só quando a zona fica ativa
    };
    const inActiveFrost = (x: number, z: number): boolean => {
      for (const f of frostZones) {
        if (!f.alive || f.telegraph > 0) continue;
        const dx = x - f.x;
        const dz = z - f.z;
        if (dx * dx + dz * dz <= f.radius * f.radius) return true;
      }
      return false;
    };

    // Observer próprio da arena (separado do flicker para descarte limpo): anima a maré de
    // breu e o ciclo de vida das zonas de gelo. Roda só na arena do chefe.
    const arenaObs: Observer<Scene> = scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
      const t = performance.now() / 1000;
      // Maré de breu: aproxima o alpha do alvo (transição suave) + pulsar lento.
      if (breuRing.isEnabled()) {
        breuMat.alpha += (breuTarget - breuMat.alpha) * Math.min(1, dt * 2.5);
        breuRing.rotation.y = t * 0.05;
        if (breuMat.alpha < 0.01 && breuTarget === 0) breuRing.setEnabled(false);
      }
      // Zonas de gelo: telegrafia (cresce, pulsa azul-claro) -> ativa (cor saturada + cristais)
      // -> some. Quem fica parado dentro de uma zona ativa é punido pelo chefe (inActiveFrost).
      for (const f of frostZones) {
        if (!f.alive) continue;
        if (f.telegraph > 0) {
          f.telegraph = Math.max(0, f.telegraph - dt);
          const grow = 1 - Math.min(1, f.telegraph / 0.6); // 0..1 conforme telegrafa
          f.disc.scaling.setAll(f.radius * (0.3 + 0.7 * grow));
          frostMat.alpha = 0.28 + 0.18 * Math.sin(t * 14); // pisca na antecipação (leitura)
          if (f.telegraph === 0) {
            f.disc.scaling.setAll(f.radius);
            f.crystals.position.set(f.x, 0.07, f.z);
            f.crystals.setEnabled(true);
          }
        } else if (f.active > 0) {
          f.active = Math.max(0, f.active - dt);
          frostMat.alpha = 0.5;
          f.crystals.rotation.y = t * 0.8;
          if (f.active === 0) {
            f.alive = false;
            f.disc.setEnabled(false);
            f.crystals.setEnabled(false);
          }
        }
      }
    });

    arena = { setBrasaLight, setMareDeBreu, spawnFrostZone, inActiveFrost };
    // No descarte da sala, removemos o observer da arena (o resto pende de roomRoot/glow/aggr).
    arenaDispose = () => {
      scene.onBeforeRenderObservable.remove(arenaObs);
      for (const f of frostZones) ctx.glow.removeIncludedOnlyMesh(f.disc);
      ctx.glow.removeIncludedOnlyMesh(breuRing);
    };
  }

  // Terreno andável dos inimigos. Inset das paredes (espessura 0,8 + raio do inimigo ~0,8 +
  // folga) e teto ao NORTE à frente do estrado: o degrau do altar (z = AZ-2,6, prof. 1,3 ->
  // frente em AZ-3,25) e o estrado têm colisão e BARRAM o herói; um inimigo atrás deles fica
  // imatável. maxZ os mantém em piso aberto que o herói alcança. Ver spec-combate / skeleton.ts.
  const WALL_INSET = 1.5;
  const enemyBounds: EnemyBounds = {
    minX: -(HALFX - WALL_INSET),
    maxX: HALFX - WALL_INSET,
    minZ: -(HALFZ - WALL_INSET),
    maxZ: AZ - 3.4,
  };

  return {
    def,
    strikeProps,
    readables,
    spawn: L.spawn,
    exit: L.exit, // a passagem (alçapão): pisar nela = descer
    doors: sideDoors,
    enemyAnchor: L.enemyAnchor,
    enemyBounds,
    brazier,
    inscriptionPos,
    setBrazierLit,
    setCleared(open: boolean): void {
      // ESTILO (Bloco 2, §4.2b): o feixe da passagem ACENDE com fade+scale, não liga seco.
      if (open && !beam.isEnabled() && !def.node) { // (antecâmara: a escada já nasce aberta, sem feixe)
        beam.setEnabled(true);
        beam.scaling.y = 0.12;
        Animation.CreateAndStartAnimation("feixe_in", beam, "scaling.y", 60, 22, 0.12, 1, 0);
        Animation.CreateAndStartAnimation("feixe_alpha", beamMat, "alpha", 60, 22, 0, 0.18, 0);
      } else if (!open) {
        beam.setEnabled(false);
      }
      // ALCAPAO: aberto = some a tampa (revela a escada/poço); selado = tampa visível.
      hatch?.setEnabled(!open);
      sideDoorFx?.setOpen(open); // a porta lateral abre junto (R1: uma condição de abertura)
    },
    arena,
    dispose(): void {
      scene.onBeforeRenderObservable.remove(flicker);
      atmosphere?.dispose();
      arenaDispose?.();
      sideDoorFx?.dispose();
      if (flameBase) ctx.glow.removeIncludedOnlyMesh(flameBase);
      for (const c of casters) ctx.shadow.removeShadowCaster(c);
      for (const a of aggregates) a.dispose();
      for (const l of lights) l.dispose();
      // Os CellMaterials do kit sao PERSISTENTES (KIT_TOON): solta-os das malhas antes de
      // descartar a sala com materiais, senao o dispose os mataria e a proxima sala nasceria branca.
      for (const m of roomRoot.getChildMeshes(false)) if (isCachedToon(m.material, KIT_TOON)) m.material = null;
      roomRoot.dispose(false, true);
      for (const t of [...scene.textures]) if (!texturasAntes.has(t) && t instanceof DynamicTexture && !t.name.startsWith("hpbar")) t.dispose();
    },
  };
}

/** Garante que as pecas do kit estao carregadas (chamar uma vez no boot). */
export async function ensureCryptPieces(scene: Scene): Promise<void> {
  await ensurePieces(scene);
}
