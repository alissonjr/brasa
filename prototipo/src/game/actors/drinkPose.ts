import { Color3, Matrix, Mesh, MeshBuilder, Quaternion, StandardMaterial, Vector3, VertexBuffer } from "@babylonjs/core";
import type { AbstractMesh, Material, Scene, TransformNode } from "@babylonjs/core";
import type { DrinkInfo } from "../combat/heroCombat";
import type { PotionKind } from "../combat/tuning";

/**
 * CAMADA JOGO. A pose do GOLE (redesenho 4.1), por código. A biblioteca UAL não tem clipe que leve a mão à
 * boca (o `Consume` da UAL2 estende a palma à frente; o `Interact` e o `PickUp_Table` não sobem ao rosto:
 * medido em Blender, a mão mais perto da boca fica a 20 cm), então a pose é procedural: depois que o Babylon
 * avalia as animações do quadro (`onAfterAnimationsObservable`), o braço livre (esquerdo: a direita guarda a
 * lâmina) é levado à boca por IK de dois ossos, e o pescoço e a cabeça inclinam para trás.
 *
 * Por que não é um AnimationGroup: a locomoção continua rodando por baixo (as pernas seguem correndo a 60% da
 * velocidade, sem deslizar) e NENHUMA animação a mais entra na mistura, então o limite de duas animações ativas
 * por osso de `heroModel.ts` segue valendo. A pose é uma sobrescrita por rotação, com envelope de entrada e saída.
 *
 * O frasco é uma peça fundida (1 malha, 1 material, cor por vértice), desabilitada fora do gesto (custo zero) e
 * posta no mundo a cada quadro: no corpo da mão enquanto sobe e na boca quando inclina. Não depende dos eixos
 * locais do osso da mão.
 */

const SEC = { reach: 0.2, holdEnd: 0.42, end: 0.6 } as const; // alcance: sobe até 0,20 s, segura, desce até 0,60 s
const HEAD_TILT_RAD = (15 * Math.PI) / 180; // spec: cabeça 15 graus para trás a partir de 0,20 s
const FLASK_TILT_RAD = (135 * Math.PI) / 180; // quanto o frasco gira da vertical até a boca
const MOUTH = { up: -0.045, fwd: 0.105 } as const; // boca em relação ao osso da cabeça (m; fwd ao longo do rosto inclinado)
const WRIST = { fwd: 0.04, up: -0.09, out: 0.035 } as const; // pulso em relação à boca
const FLASK_SCALE = 1.3; // maior que o frasco real: precisa ler da câmera alta
const POLE = { up: -0.15, out: 0.9, fwd: -0.25 } as const; // cotovelo aberto para o lado: a câmera alta (por trás) lê o braço erguido
const FADE_SEC = 0.1; // saída por cancelamento (esquiva)
const LIQUID: Record<PotionKind, Color3> = {
  vida: new Color3(0.55, 0.9, 0.4), // verde-ouro
  furia: new Color3(1.0, 0.42, 0.1), // brasa
  unguento: new Color3(0.95, 0.76, 0.32), // ouro
};
const CORK = new Color3(0.32, 0.2, 0.1);
const FURY_EMISSIVE = new Color3(0.9, 0.38, 0.08); // somado ao emissivo da lâmina (+40%) enquanto a Fúria dura

const smooth = (v: number): number => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
const ramp = (e: number, a: number, b: number): number => smooth((e - a) / (b - a));

/** 0 a 1: a mão sobe (ease-out), segura e desce (ease-in). */
function reachAt(e: number): number {
  if (e <= 0 || e >= SEC.end) return 0;
  if (e < SEC.reach) return 1 - (1 - e / SEC.reach) ** 2;
  if (e < SEC.holdEnd) return 1;
  return 1 - ramp(e, SEC.holdEnd, SEC.end) ** 1.5;
}
/** 0 a 1: a cabeça inclina para trás a partir de 0,20 s (segura até o gole e devolve). */
function headAt(e: number): number {
  return ramp(e, 0.2, 0.32) * (1 - ramp(e, 0.44, 0.58));
}
/** 0 a 1: o frasco inclina até a boca (o gole é aos 0,30 s). */
function flaskAt(e: number): number {
  return ramp(e, 0.16, 0.3) * (1 - ramp(e, 0.44, 0.54));
}

// Temporários (o gancho roda todo quadro durante o gole: sem alocação).
const qa = new Quaternion();
const tn0 = new Vector3(), tn1 = new Vector3();
const v2 = new Vector3(), v3 = new Vector3(), v4 = new Vector3();

function wpos(n: TransformNode, out: Vector3): Vector3 {
  return n.getWorldMatrix().getTranslationToRef(out);
}
function refresh(chain: readonly TransformNode[]): void {
  for (const n of chain) n.computeWorldMatrix(true);
}
/** Cadeia do nó mais alto da hierarquia até `n` (inclusive), para recalcular as matrizes de cima para baixo. */
function pathTo(n: TransformNode): TransformNode[] {
  const out: TransformNode[] = [];
  for (let c: TransformNode | null = n; c; c = c.parent as TransformNode | null) out.unshift(c);
  return out;
}
/** `v` inclinado para cima (em direção a `up`) por `ang` rad: o rosto olhando para o alto. */
function tilted(v: Vector3, up: Vector3, ang: number): Vector3 {
  return v.scale(Math.cos(ang)).addInPlace(up.scale(Math.sin(ang))).normalize();
}
/** Menor rotação que leva a direção `a` à `b` (unitárias). */
function arc(a: Vector3, b: Vector3, out: Quaternion): Quaternion {
  const d = Vector3.Dot(a, b);
  if (d < -0.9999) return out.copyFromFloats(0, 0, 0, 1);
  const c = Vector3.Cross(a, b);
  out.copyFromFloats(c.x, c.y, c.z, 1 + d);
  return out.normalize();
}
/**
 * Gira um osso pelo menor arco que leva a direção de mundo `from` à `to`, SEM extrair rotações de mundo: o arco é
 * calculado no espaço do PAI (as duas direções passam pela inversa da matriz de mundo do pai) e pré-multiplicado
 * na rotação local. Assim vale mesmo com o espelho (escala Z negativa) que o carregador glTF põe no `__root__`.
 */
function swing(node: TransformNode, from: Vector3, to: Vector3): void {
  const parent = node.parent as TransformNode | null;
  const inv = parent ? parent.getWorldMatrix().clone().invert() : Matrix.Identity();
  Vector3.TransformNormalToRef(from, inv, tn0).normalize();
  Vector3.TransformNormalToRef(to, inv, tn1).normalize();
  arc(tn0, tn1, qa);
  if (!node.rotationQuaternion) node.rotationQuaternion = Quaternion.FromEulerVector(node.rotation);
  qa.multiplyToRef(node.rotationQuaternion, node.rotationQuaternion);
}

/** Frasco fundido: corpo, gargalo e rolha numa malha só, cor por vértice (a forma lê o tipo para daltônicos). */
function buildFlask(scene: Scene, kind: PotionKind, mat: StandardMaterial): Mesh {
  const parts: Mesh[] = [];
  const paint = (m: Mesh, c: Color3): Mesh => {
    const n = m.getTotalVertices();
    const cols: number[] = [];
    for (let i = 0; i < n; i++) cols.push(c.r, c.g, c.b, 1);
    m.setVerticesData(VertexBuffer.ColorKind, cols);
    parts.push(m);
    return m;
  };
  const liquid = LIQUID[kind];
  if (kind === "vida") {
    // redondo: bojo esférico, gargalo curto
    paint(MeshBuilder.CreateSphere("f_b", { diameter: 0.075, segments: 8 }, scene), liquid);
    const neck = paint(MeshBuilder.CreateCylinder("f_n", { height: 0.045, diameter: 0.026, tessellation: 8 }, scene), liquid.scale(0.8));
    neck.position.y = 0.05;
    const cork = paint(MeshBuilder.CreateCylinder("f_c", { height: 0.02, diameter: 0.03, tessellation: 8 }, scene), CORK);
    cork.position.y = 0.083;
  } else if (kind === "furia") {
    // alto: cilindro esguio, gargalo longo
    paint(MeshBuilder.CreateCylinder("f_b", { height: 0.1, diameter: 0.04, tessellation: 8 }, scene), liquid);
    const neck = paint(MeshBuilder.CreateCylinder("f_n", { height: 0.05, diameter: 0.02, tessellation: 8 }, scene), liquid.scale(0.8));
    neck.position.y = 0.075;
    const cork = paint(MeshBuilder.CreateCylinder("f_c", { height: 0.02, diameter: 0.026, tessellation: 8 }, scene), CORK);
    cork.position.y = 0.11;
  } else {
    // pote: cilindro baixo e largo, tampa
    paint(MeshBuilder.CreateCylinder("f_b", { height: 0.05, diameter: 0.07, tessellation: 10 }, scene), liquid);
    const lid = paint(MeshBuilder.CreateCylinder("f_c", { height: 0.016, diameter: 0.076, tessellation: 10 }, scene), CORK);
    lid.position.y = 0.033;
  }
  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, false)!;
  merged.name = `gole_frasco_${kind}`;
  merged.material = mat;
  merged.isPickable = false;
  merged.metadata = { noOutline: true };
  merged.setEnabled(false);
  merged.rotationQuaternion = new Quaternion();
  return merged;
}

export interface DrinkPoseOptions {
  /** Esfera da brasa na mão esquerda: some enquanto o frasco ocupa a mão (a luz-fagulha continua no osso). */
  emberOrb?: AbstractMesh | null;
  /** Materiais da lâmina: ganham emissivo (+40% rumo à brasa) enquanto a Fúria dura. */
  swordMats?: readonly Material[];
}

export class DrinkPose {
  private readonly scene: Scene;
  private readonly root: TransformNode;
  private readonly clav?: TransformNode;
  private readonly up?: TransformNode;
  private readonly low?: TransformNode;
  private readonly hand?: TransformNode;
  private readonly neck?: TransformNode;
  private readonly head?: TransformNode;
  private readonly pathHand: TransformNode[] = [];
  private readonly pathHead: TransformNode[] = [];
  private readonly flasks = new Map<PotionKind, Mesh>();
  private readonly flaskMat: StandardMaterial;
  private readonly orb?: AbstractMesh | null;
  private readonly swordMats: StandardMaterial[];
  private readonly swordBase: Color3[];
  private fury = 0; // 0..1 suavizado
  private furyOn = false;
  private info: DrinkInfo | null = null;
  private k = 0; // peso global (1 durante o gole; decai ao cancelar)
  private eLast = 0;
  private kindLast: PotionKind = "vida";
  private orbHidden = false;
  /** Posição de mundo do frasco no último quadro (para o VFX do fim do gesto). */
  readonly flaskPos = new Vector3();
  /** Visível e com escala cheia? (falso quando o frasco já não existe) */
  flaskVisible = false;

  constructor(scene: Scene, root: TransformNode, nos: Map<string, TransformNode>, opts: DrinkPoseOptions = {}) {
    this.scene = scene;
    this.root = root;
    this.clav = nos.get("clavicle_l");
    this.up = nos.get("upperarm_l");
    this.low = nos.get("lowerarm_l");
    this.hand = nos.get("hand_l");
    this.neck = nos.get("neck_01");
    this.head = nos.get("Head");
    if (this.hand) this.pathHand = pathTo(this.hand);
    if (this.head) this.pathHead = pathTo(this.head);
    this.orb = opts.emberOrb;
    this.swordMats = (opts.swordMats ?? []).filter((m): m is StandardMaterial => m instanceof StandardMaterial);
    this.swordBase = this.swordMats.map((m) => m.emissiveColor.clone());
    const mat = new StandardMaterial("gole_frasco_mat", scene);
    mat.disableLighting = true; // cor por vértice x emissivo branco: a cor do líquido, sem depender da luz da câmara
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.emissiveColor = Color3.White();
    this.flaskMat = mat;
    scene.onAfterAnimationsObservable.add(() => this.apply());
  }

  /** O estado do gole do quadro (null fora dele). Chamar antes da avaliação das animações (já é o caso). */
  setState(info: DrinkInfo | null): void {
    this.info = info;
    if (info) {
      this.k = 1;
      this.eLast = info.elapsed;
      this.kindLast = info.kind;
    }
  }

  /** Elixir de Fúria ativo: a lâmina esquenta (o emissivo sobe 40% rumo à brasa). */
  setFury(on: boolean): void {
    this.furyOn = on;
  }

  /** Quanto do gesto está valendo agora (0 a 1), para quem precisa saber se a mão está ocupada. */
  get weight(): number {
    return this.k * reachAt(this.eLast);
  }

  private flask(kind: PotionKind): Mesh {
    let m = this.flasks.get(kind);
    if (!m) {
      m = buildFlask(this.scene, kind, this.flaskMat);
      this.flasks.set(kind, m);
      this.scene.getGlowLayerByName("glow")?.addIncludedOnlyMesh(m); // o frasco ganha o halo da cor do líquido
    }
    return m;
  }

  private setOrb(hidden: boolean): void {
    if (!this.orb || hidden === this.orbHidden) return;
    this.orbHidden = hidden;
    this.orb.setEnabled(!hidden);
  }

  private updateFury(dt: number): void {
    const target = this.furyOn ? 1 : 0;
    this.fury += (target - this.fury) * (1 - Math.exp(-8 * dt));
    if (this.fury < 1e-3 && target === 0) {
      if (this.fury === 0) return;
      this.fury = 0;
    }
    const pulse = 0.85 + 0.15 * Math.sin(performance.now() * 0.012);
    this.swordMats.forEach((m, i) => {
      const b = this.swordBase[i]!;
      m.emissiveColor.set(
        b.r + FURY_EMISSIVE.r * 0.4 * this.fury * pulse,
        b.g + FURY_EMISSIVE.g * 0.4 * this.fury * pulse,
        b.b + FURY_EMISSIVE.b * 0.4 * this.fury * pulse,
      );
    });
  }

  /** Roda depois das animações do quadro: sobrescreve o braço livre e a cabeça e posiciona o frasco. */
  private apply(): void {
    const dt = Math.min(0.1, this.scene.getEngine().getDeltaTime() / 1000);
    this.updateFury(dt);
    if (!this.info) {
      if (this.k <= 0) return;
      this.k = Math.max(0, this.k - dt / FADE_SEC);
    }
    const e = this.eLast;
    const kind = this.kindLast;
    const chest = kind === "unguento";
    const r = reachAt(e) * this.k;
    const headA = chest ? 0 : headAt(e) * this.k;
    const flaskA = chest ? 0 : flaskAt(e) * this.k;
    if (r < 0.01) {
      this.setOrb(false);
      this.hideFlasks();
      return;
    }
    const { up, low, hand, clav } = this;
    if (!up || !low || !hand || !clav) return;

    // Eixos do herói no mundo.
    const right = new Vector3();
    const fwd = new Vector3();
    this.root.getDirectionToRef(Vector3.Right(), right);
    this.root.getDirectionToRef(Vector3.Forward(), fwd);
    right.normalize();
    fwd.normalize();
    const upAxis = Vector3.Up();

    // 1) Cabeça para trás: pescoço (40%) e cabeça (60%), em torno do eixo lateral do herói.
    if (headA > 1e-3 && this.neck && this.head) {
      refresh(this.pathHead);
      swing(this.neck, fwd, tilted(fwd, upAxis, HEAD_TILT_RAD * headA * 0.4));
      refresh(this.pathHead);
      swing(this.head, fwd, tilted(fwd, upAxis, HEAD_TILT_RAD * headA * 0.6));
    }
    refresh(this.pathHead.length ? this.pathHead : this.pathHand);
    refresh(this.pathHand);

    // 2) Alvo da mão: a boca (rosto inclinado) ou o peito (Unguento).
    const headPos = this.head ? wpos(this.head, new Vector3()) : wpos(up, new Vector3()).addInPlace(new Vector3(0, 0.2, 0));
    const faceFwd = tilted(fwd, upAxis, HEAD_TILT_RAD * headA);
    const side = Math.sign(Vector3.Dot(wpos(up, new Vector3()).subtract(wpos(this.root, new Vector3())), right)) || -1; // lado do braço livre
    const mouth = chest
      ? headPos.add(upAxis.scale(-0.3)).addInPlace(fwd.scale(0.16))
      : headPos.add(upAxis.scale(MOUTH.up)).addInPlace(faceFwd.scale(MOUTH.fwd));
    // O pulso fica abaixo e ao lado da boca (o frasco sobe da palma): o antebraço não cobre os olhos.
    const wristGoal = chest ? mouth : mouth.add(faceFwd.scale(WRIST.fwd)).addInPlace(upAxis.scale(WRIST.up)).addInPlace(right.scale(side * WRIST.out));

    // 3) IK de dois ossos do ombro ao alvo, com o cotovelo para baixo e para fora.
    const aU = (up.rotationQuaternion ?? Quaternion.Identity()).clone();
    const aL = (low.rotationQuaternion ?? Quaternion.Identity()).clone();
    const S = wpos(up, v2).clone();
    const E = wpos(low, v3).clone();
    const W = wpos(hand, v4).clone();
    const goal = Vector3.Lerp(W, wristGoal, r);
    const l1 = Vector3.Distance(S, E);
    const l2 = Vector3.Distance(E, W);
    const toGoal = goal.subtract(S);
    let d = toGoal.length();
    const dir = toGoal.scale(1 / Math.max(d, 1e-4));
    d = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.02), (l1 + l2) * 0.985);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const pole0 = upAxis.scale(POLE.up).addInPlace(right.scale(side * POLE.out)).addInPlace(fwd.scale(chest ? 0 : POLE.fwd));
    const pole = pole0.subtractInPlace(dir.scale(Vector3.Dot(pole0, dir))).normalize();
    const elbow = S.add(dir.scale(a)).addInPlace(pole.scale(h));
    swing(up, E.subtract(S), elbow.subtract(S));
    refresh([up, low, hand]);
    const E2 = wpos(low, new Vector3());
    const W2 = wpos(hand, new Vector3());
    const reachPt = S.add(dir.scale(d));
    swing(low, W2.subtract(E2), reachPt.subtract(E2));
    // O IK entra por inteiro quando o alcance passa de 25%: no começo o cotovelo vem do clipe e cede ao polo.
    const wb = smooth(r * 4);
    if (wb < 1) {
      Quaternion.SlerpToRef(aU, up.rotationQuaternion!, wb, up.rotationQuaternion!);
      Quaternion.SlerpToRef(aL, low.rotationQuaternion!, wb, low.rotationQuaternion!);
    }
    refresh([up, low, hand]);

    // 4) Frasco no mundo: na palma enquanto sobe, na boca ao inclinar.
    this.placeFlask(kind, r, flaskA, mouth, fwd, upAxis, chest);
    this.setOrb(true);
  }

  private hideFlasks(): void {
    this.flaskVisible = false;
    for (const m of this.flasks.values()) if (m.isEnabled(false)) m.setEnabled(false);
  }

  private placeFlask(kind: PotionKind, r: number, tilt: number, mouth: Vector3, fwd: Vector3, upAxis: Vector3, chest: boolean): void {
    const m = this.flask(kind);
    for (const [k, other] of this.flasks) if (k !== kind && other.isEnabled(false)) other.setEnabled(false);
    const hand = this.hand!;
    const low = this.low!;
    const W = wpos(hand, new Vector3());
    const fore = W.subtract(wpos(low, new Vector3())).normalize();
    // Eixo do frasco (da base à tampa): vertical na mão; gira até a tampa apontar para o rosto (-fwd) e um pouco para baixo.
    const ang = FLASK_TILT_RAD * tilt;
    const axis = upAxis.scale(Math.cos(ang)).addInPlace(fwd.scale(-Math.sin(ang)));
    // Segurar: o frasco está na palma, um palmo adiante do pulso, de pé. Beber: a tampa encosta na boca.
    const carry = W.add(fore.scale(0.06)).addInPlace(upAxis.scale(0.03));
    const half = (kind === "vida" ? 0.06 : kind === "furia" ? 0.085 : 0.03) * FLASK_SCALE; // do centro à ponta
    const drink = mouth.subtract(axis.scale(half));
    const t = smooth(tilt);
    const pos = chest ? carry : Vector3.Lerp(carry, drink, t);
    m.position.copyFrom(pos);
    arc(upAxis, axis, m.rotationQuaternion!);
    const s = smooth(Math.min(1, r * 5)); // o frasco "aparece" na mão quando o braço começa a subir
    m.scaling.setAll(Math.max(0.001, s * FLASK_SCALE));
    if (!m.isEnabled(false)) m.setEnabled(true);
    this.flaskVisible = true;
    this.flaskPos.copyFrom(pos);
  }
}
