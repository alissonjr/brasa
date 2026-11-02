import { Color3, DirectionalLight, Mesh, Vector3 } from "@babylonjs/core";
import type { AbstractMesh, Node, Scene } from "@babylonjs/core";

/**
 * CAMADA ENGINE (genérica). Luz de ARO dos atores: uma DirectionalLight quente, sem sombra,
 * restrita por `includedOnlyMeshes` às malhas dos atores (herói, inimigos, chefe). O cenário
 * não a recebe (não entra no orçamento de luzes dos materiais toon do mundo), então ela
 * separa figura de fundo do alto sem lavar a sala: o ator fica sempre uns passos de valor
 * acima das lajes, em qualquer andar, independentemente de tochas e braseiro.
 *
 * `renderPriority` alta garante que ela entre entre as primeiras luzes de cada malha (os
 * materiais limitam as luzes simultâneas; sem isso uma tocha distante podia ocupar a vaga).
 */
export interface ActorLightOptions {
  /** Cor da luz (hex). Default: âmbar pálido. */
  color?: string;
  /** Intensidade. Default 1.5 (a sala e escura: ambiente ~0,4 + chave ~0,5). */
  intensity?: number;
  /** Direção (de cima, levemente do lado da câmera). */
  direction?: Vector3;
}

export class ActorLight {
  readonly light: DirectionalLight;
  private readonly dummy: Mesh;

  constructor(scene: Scene, opts: ActorLightOptions = {}) {
    const l = new DirectionalLight("luz_atores", (opts.direction ?? new Vector3(0.15, -1, 0.35)).normalize(), scene);
    l.diffuse = Color3.FromHexString(opts.color ?? "#ffd9ad");
    l.specular = Color3.Black();
    l.intensity = opts.intensity ?? 1.5;
    // Sem gerador de sombra; shadowEnabled fica no padrão (true) de propósito: a ordenação de luzes
    // do Babylon poe as "com sombra" antes das demais e so depois olha o renderPriority. Assim esta
    // luz entra entre as primeiras do orçamento de cada malha (ver Light.CompareLightsPriority).
    // Lista de inclusão VAZIA significaria "todas as malhas": um marcador nunca renderizado
    // mantém a luz restrita desde o primeiro frame.
    this.dummy = new Mesh("luz_atores_marcador", scene);
    this.dummy.setEnabled(false);
    l.includedOnlyMeshes = [this.dummy];
    l.renderPriority = 50;
    this.light = l;
  }

  /** Passa a iluminar todas as malhas (atuais) da hierarquia. Chamar depois de anexar props. */
  include(root: Node): void {
    const list = this.light.includedOnlyMeshes;
    const add = (m: AbstractMesh): void => { if (!list.includes(m)) list.push(m); };
    if ((root as AbstractMesh).getTotalVertices) add(root as AbstractMesh);
    for (const m of root.getChildMeshes(false)) add(m);
  }

  /** Deixa de iluminar a hierarquia (o dispose de uma malha já a tira da lista sozinho). */
  exclude(root: Node): void {
    const list = this.light.includedOnlyMeshes;
    for (const m of root.getChildMeshes(false)) { const i = list.indexOf(m); if (i >= 0) list.splice(i, 1); }
  }

  dispose(): void {
    this.light.dispose();
    this.dummy.dispose();
    perScene.delete(this.light.getScene());
  }
}

const perScene = new WeakMap<Scene, ActorLight>();

/** Luz de aro dos atores da cena (cria na primeira chamada). */
export function getActorLight(scene: Scene): ActorLight {
  let a = perScene.get(scene);
  if (!a) {
    a = new ActorLight(scene);
    perScene.set(scene, a);
  }
  return a;
}
