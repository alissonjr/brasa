import { Color3, Constants, DynamicTexture, Mesh, MeshBuilder, StandardMaterial } from "@babylonjs/core";
import type { Observer, Scene, TransformNode } from "@babylonjs/core";

/**
 * CAMADA ENGINE (genérica). Sombra de contato dos atores: UM disco achatado com gradiente
 * radial e thin instances (1 draw call para todos os atores, em vez de 1 por sombra). Cada
 * ator registrado ganha uma instância cuja matriz é reescrita a cada frame a partir do nó
 * dele (posição XZ no chão; y fixo logo acima do piso). Não entra na lista de casters da
 * sombra da luz-chave: é um "aterramento" barato que lê bem da câmera alta, onde a sombra
 * projetada some sob o próprio corpo.
 *
 * `handle.scale` (0..1) encolhe a sombra: o ator a usa ao emergir do chão e ao dissolver.
 */
export interface ContactShadowHandle {
  /** 0..1: multiplica o raio (emergir/dissolver). */
  scale: number;
  /** Raio base em metros. */
  radius: number;
  dispose(): void;
}

const CAPACITY = 32;
const Y = 0.075;

export class ContactShadows {
  private readonly mesh: Mesh;
  private readonly mat: StandardMaterial;
  private readonly tex: DynamicTexture;
  private readonly buf = new Float32Array(CAPACITY * 16);
  private readonly items: { node: TransformNode; h: ContactShadowHandle }[] = [];
  private readonly obs: Observer<Scene>;

  constructor(private readonly scene: Scene, opts: { color?: string; alpha?: number } = {}) {
    this.tex = new DynamicTexture("sombraContatoTex", { width: 64, height: 64 }, scene, false);
    const ctx = this.tex.getContext() as CanvasRenderingContext2D;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.85)");
    g.addColorStop(0.75, "rgba(255,255,255,0.3)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    this.tex.update();
    this.tex.hasAlpha = true;

    this.mat = new StandardMaterial("sombraContatoMat", scene);
    this.mat.disableLighting = true;
    this.mat.diffuseColor = Color3.Black();
    this.mat.emissiveColor = Color3.FromHexString(opts.color ?? "#020308");
    this.mat.specularColor = Color3.Black();
    this.mat.opacityTexture = this.tex;
    this.mat.alpha = opts.alpha ?? 0.62;
    this.mat.alphaMode = Constants.ALPHA_COMBINE;
    this.mat.backFaceCulling = false;
    this.mat.zOffset = -1;

    this.mesh = MeshBuilder.CreateDisc("sombra_de_contato", { radius: 1, tessellation: 20 }, scene);
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.bakeCurrentTransformIntoVertices();
    this.mesh.material = this.mat;
    this.mesh.isPickable = false;
    this.mesh.receiveShadows = false;
    this.mesh.alphaIndex = 0; // antes das poças de luz aditivas (que ficam por cima)
    this.mesh.alwaysSelectAsActiveMesh = true; // as instâncias vivem fora da caixa do disco-base
    this.mesh.metadata = { noOutline: true };
    this.mesh.thinInstanceSetBuffer("matrix", this.buf, 16, false);
    this.mesh.thinInstanceCount = 0;
    this.obs = scene.onBeforeRenderObservable.add(() => this.update());
  }

  /** Registra um ator; devolve o handle (chamar dispose() quando o ator sair). */
  add(node: TransformNode, radius: number): ContactShadowHandle {
    const self = this;
    const h: ContactShadowHandle = {
      scale: 1,
      radius,
      dispose(): void {
        const i = self.items.findIndex((it) => it.h === h);
        if (i >= 0) self.items.splice(i, 1);
      },
    };
    if (this.items.length < CAPACITY) this.items.push({ node, h });
    return h;
  }

  private update(): void {
    const n = this.items.length;
    const b = this.buf;
    for (let i = 0; i < n; i++) {
      const { node, h } = this.items[i]!;
      if (node.isDisposed()) continue;
      const p = node.getAbsolutePosition();
      const r = h.radius * Math.max(0.001, h.scale);
      const o = i * 16;
      b.fill(0, o, o + 16);
      b[o] = r; b[o + 5] = 1; b[o + 10] = r; b[o + 15] = 1;
      b[o + 12] = p.x; b[o + 13] = Y; b[o + 14] = p.z;
    }
    this.mesh.thinInstanceCount = n;
    if (n > 0) this.mesh.thinInstanceBufferUpdated("matrix");
  }

  dispose(): void {
    this.scene.onBeforeRenderObservable.remove(this.obs);
    this.mesh.dispose(false, true);
    this.tex.dispose();
  }
}

const perScene = new WeakMap<Scene, ContactShadows>();
/** Uma instância por cena (criada sob demanda). */
export function getContactShadows(scene: Scene): ContactShadows {
  let c = perScene.get(scene);
  if (!c) {
    c = new ContactShadows(scene);
    perScene.set(scene, c);
  }
  return c;
}
