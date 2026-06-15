import { MeshBuilder, Scalar, TransformNode } from "@babylonjs/core";
import type { Scene, StandardMaterial } from "@babylonjs/core";

/**
 * CAMADA JOGO (utilitário de ator). Cadeia de "spring bones" para tecido (manto,
 * barra da túnica), conforme docs/tecnica-deformacao-de-tecidos.md (técnica 3 +
 * Verlet da seção 3). Genérico o bastante para virar engine no futuro; por ora
 * vive no jogo, ao lado de quem usa (o HeroModel).
 *
 * Cada segmento é um osso pendurado no anterior; a ponta atrasa em relação ao
 * corpo (inércia) e cai por gravidade (rest), o que vende "isto é pano". Usamos
 * uma mola-amortecedor angular por segmento (equivalente estável e barato ao
 * Verlet posicional), reagindo à velocidade (lean ao correr) e à aceleração
 * (atraso transiente ao arrancar/parar/virar) do personagem, mais vento senoidal.
 */
export interface ChainOptions {
  count: number;
  segLength: number;
  topWidth: number;
  bottomWidth: number;
  thickness?: number;
  /** Inclinação de repouso do 1o segmento (rad), p.ex. manto drapeando atrás. */
  restX?: number;
  stiffness?: number;
  damping?: number;
  /** Quanto a velocidade horizontal "joga" o tecido para trás. */
  leanGain?: number;
  /** Quanto a aceleração causa atraso transiente. */
  accelGain?: number;
  windAmp?: number;
  /** Limite de desvio angular por segmento (rad). */
  limit?: number;
}

interface SegState {
  ax: number;
  az: number;
  vx: number;
  vz: number;
}

export class SpringBoneChain {
  readonly root: TransformNode;
  private readonly nodes: TransformNode[] = [];
  private readonly state: SegState[] = [];
  private readonly o: Required<ChainOptions>;

  constructor(
    scene: Scene,
    parent: TransformNode,
    pose: { pos: [number, number, number]; rotY?: number },
    material: StandardMaterial,
    options: ChainOptions
  ) {
    this.o = {
      thickness: 0.03,
      restX: 0,
      stiffness: 55,
      damping: 9,
      leanGain: 0.05,
      accelGain: 0.02,
      windAmp: 0.04,
      limit: 0.8,
      ...options,
    };

    this.root = new TransformNode("cloth_root", scene);
    this.root.parent = parent;
    this.root.position.set(...pose.pos);
    if (pose.rotY) this.root.rotation.y = pose.rotY;

    let prev = this.root;
    for (let i = 0; i < this.o.count; i++) {
      const node = new TransformNode(`cloth_seg${i}`, scene);
      node.parent = prev;
      node.position.y = i === 0 ? 0 : -this.o.segLength;
      if (i === 0) node.rotation.x = this.o.restX;

      const t = this.o.count > 1 ? i / (this.o.count - 1) : 0;
      const w = Scalar.Lerp(this.o.topWidth, this.o.bottomWidth, t);
      const panel = MeshBuilder.CreateBox(
        `cloth_panel${i}`,
        { width: w, height: this.o.segLength, depth: this.o.thickness },
        scene
      );
      panel.material = material;
      panel.parent = node;
      panel.position.y = -this.o.segLength / 2;

      this.nodes.push(node);
      this.state.push({ ax: i === 0 ? this.o.restX : 0, az: 0, vx: 0, vz: 0 });
      prev = node;
    }
  }

  /**
   * @param dt segundos
   * @param localVel velocidade horizontal no espaço local do personagem (x lado, z frente)
   * @param localAccel aceleração horizontal no espaço local
   * @param wind fase de vento (acumulador de tempo)
   */
  update(dt: number, localVel: { x: number; z: number }, localAccel: { x: number; z: number }, wind: number): void {
    const o = this.o;
    for (let i = 0; i < this.nodes.length; i++) {
      const st = this.state[i];
      const depth = (i + 1) / this.nodes.length; // segmentos mais baixos reagem mais
      const restX = i === 0 ? o.restX : 0;

      const targetX =
        restX -
        localVel.z * o.leanGain * depth -
        localAccel.z * o.accelGain * depth +
        Math.sin(wind + i * 0.7) * o.windAmp;
      const targetZ =
        localVel.x * o.leanGain * depth * 0.8 +
        localAccel.x * o.accelGain * depth +
        Math.cos(wind * 0.8 + i * 0.5) * o.windAmp * 0.6;

      st.vx += (o.stiffness * (targetX - st.ax) - o.damping * st.vx) * dt;
      st.vz += (o.stiffness * (targetZ - st.az) - o.damping * st.vz) * dt;
      st.ax = Scalar.Clamp(st.ax + st.vx * dt, restX - o.limit, restX + o.limit);
      st.az = Scalar.Clamp(st.az + st.vz * dt, -o.limit, o.limit);

      this.nodes[i].rotation.x = st.ax;
      this.nodes[i].rotation.z = st.az;
    }
  }
}
