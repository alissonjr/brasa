import { Color3, Color4, DynamicTexture, MeshBuilder, ParticleSystem, StandardMaterial, Vector3 } from "@babylonjs/core";
import type { Texture } from "@babylonjs/core";
import type { AntessalaKit, Peca } from "./types";
import { ancoras } from "./planta";

/**
 * CAMADA JOGO (Brasa). BRASEIRO do patamar (docs/brasa/redesenho-da-descida.md, 2.1 e 2.2): a bacia
 * de pedra no eixo da sala, um pouco ao sul. Nasce FRIA (brasas negras, sem chama); ao acender, as
 * brasas ganham cor, as faíscas sobem e a chama da sala (`brazierFlame` de `cryptRoom`, com a luz
 * pontual e a poça de luz) acompanham a coreografia 0..1 de `setLit`. O gesto (segurar [R] 1,2 s) e o
 * efeito (cura, checkpoint, chama) são do `main.ts`; aqui só mora o objeto.
 */
export function construirBraseiro(kit: AntessalaKit): Peca {
  const a = ancoras(kit.def.index);
  const { x, z } = a.braseiro;
  const pedra = kit.flatMaterial("braseiroPedra", "#6b6f78");
  const pedraEscura = kit.flatMaterial("braseiroPedraEscura", "#43474f");
  const parte = (nome: string, o: { dTop: number; dBot: number; h: number; y: number }, mat: StandardMaterial): void => {
    const m = MeshBuilder.CreateCylinder(nome, { diameterTop: o.dTop, diameterBottom: o.dBot, height: o.h, tessellation: 14 }, kit.scene);
    m.material = mat;
    m.position.set(x, o.y, z);
    m.isPickable = false;
    m.receiveShadows = true;
    kit.ctx.shadow.addShadowCaster(m);
    kit.track(m);
  };
  parte("braseiro_base", { dTop: 2.3, dBot: 2.5, h: 0.16, y: 0.08 }, pedraEscura);
  parte("braseiro_pe", { dTop: 0.9, dBot: 1.1, h: 0.55, y: 0.435 }, pedra);
  parte("braseiro_bacia", { dTop: 1.6, dBot: 0.85, h: 0.36, y: 0.89 }, pedra);
  kit.collider(x, z, 1.5, 1.5, 1.1);

  // Brasas: disco emissivo no fundo da bacia. Frio: cinza quase negra; aceso: laranja viva (glow).
  const brasaMat = new StandardMaterial("braseiro_brasas_mat", kit.scene);
  brasaMat.disableLighting = true;
  brasaMat.diffuseColor = Color3.Black();
  brasaMat.specularColor = Color3.Black();
  const frio = Color3.FromHexString("#1d1a18");
  const quente = Color3.FromHexString("#ff7a1c");
  brasaMat.emissiveColor = frio.clone();
  const brasas = MeshBuilder.CreateDisc("braseiro_brasas", { radius: 0.66, tessellation: 18 }, kit.scene);
  brasas.rotation.x = Math.PI / 2;
  brasas.position.set(x, 1.05, z);
  brasas.material = brasaMat;
  brasas.isPickable = false;
  brasas.metadata = { noOutline: true, noDepth: true };
  kit.ctx.glow.addIncludedOnlyMesh(brasas);
  kit.track(brasas);

  // Faíscas subindo da bacia (1 emissor; só emite aceso).
  const tex = new DynamicTexture("braseiro_ponto", { width: 32, height: 32 }, kit.scene, false);
  const c = tex.getContext() as unknown as CanvasRenderingContext2D;
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 32, 32);
  tex.update();
  tex.hasAlpha = true;
  const ps = new ParticleSystem("braseiro_faiscas", 36, kit.scene);
  ps.particleTexture = tex as Texture;
  ps.emitter = new Vector3(x, 1.15, z);
  ps.minEmitBox = new Vector3(-0.3, 0, -0.3);
  ps.maxEmitBox = new Vector3(0.3, 0, 0.3);
  ps.direction1 = new Vector3(-0.15, 1, -0.15);
  ps.direction2 = new Vector3(0.15, 1, 0.15);
  ps.minEmitPower = 0.5;
  ps.maxEmitPower = 1.1;
  ps.minLifeTime = 1.2;
  ps.maxLifeTime = 2.6;
  ps.minSize = 0.05;
  ps.maxSize = 0.12;
  ps.color1 = new Color4(1, 0.65, 0.25, 1);
  ps.color2 = new Color4(1, 0.4, 0.12, 0.8);
  ps.colorDead = new Color4(0.5, 0.1, 0.05, 0);
  ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  ps.gravity = new Vector3(0, 0.25, 0);
  ps.emitRate = 0;
  ps.isLocal = false;
  ps.start();

  let k = 0;
  return {
    interativos: [{ id: "braseiro", x, z, radius: 2.3, y: 1.9, action: "interact", icon: "brazier", name: "antBraseiro" }],
    setLit(v: number): void {
      k = v;
      const s = Math.min(1, Math.max(0, v / 0.45)); // as brasas pegam primeiro (o chão)
      brasaMat.emissiveColor = Color3.Lerp(frio, quente, s);
      ps.emitRate = v > 0.2 ? 11 : 0;
    },
    update(t: number): void {
      if (k > 0.2) {
        const f = 0.85 + 0.15 * Math.sin(t * 9) + 0.05 * Math.sin(t * 17);
        brasaMat.emissiveColor = Color3.Lerp(frio, quente, Math.min(1, k / 0.45)).scale(f);
      }
    },
    dispose(): void {
      kit.ctx.glow.removeIncludedOnlyMesh(brasas);
      ps.dispose(true);
    },
  };
}
