import { Vector3 } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import { HitStop, overlapSpheres, type EventBus, type ThirdPersonCamera } from "@engine";
import type { Acendedora } from "../actors/acendedora";
import { TrainingDummy } from "../actors/trainingDummy";
import { Skeleton, type SkeletonKind } from "../actors/enemies/skeleton";
import type { CombatTarget } from "./combatTarget";
import { ImpactFx } from "./impactFx";
import { hitThunk, heroHurt, shieldClank } from "./combatSound";

/**
 * CAMADA JOGO. Orquestra o combate (M2.1-M2.3): a cada frame avança o hit stop, resolve os
 * acertos da arma do herói contra os alvos e roda a IA dos inimigos, que podem golpear o
 * herói de volta. No frame de qualquer contato dispara TUDO junto (spec-combate §1):
 * dano + knockback + flash + partícula + screen shake + som, e emite eventos no EventBus
 * (`combat:hit` ao acertar; `hero:hit`/`hero:died` ao apanhar). Devolve o dt de COMBATE
 * (0 no hit stop) para o herói; câmera e partículas usam dt real (seguem no freeze).
 *
 * Morte do herói: TERMINAL. Ao chegar a zero, emite `hero:died` uma vez e PARA (sem
 * respawn). O app trata a derrota (tela + recomeçar o andar). resetHeroDeath() rearma
 * para a retentativa.
 */
const HIT_RADIUS = 0.7; // raio da hitbox à frente do herói (alcance generoso, golpe confiável)

export class CombatDirector {
  private readonly hitStop = new HitStop();
  private readonly fx: ImpactFx;
  private readonly dummies: TrainingDummy[] = [];
  private readonly enemies: Skeleton[] = [];
  private readonly tmpDir = new Vector3();
  private readonly dead = new Set<Skeleton>(); // inimigos já creditados (1 drop de Fagulha cada)
  private heroDead = false;

  constructor(
    private readonly scene: Scene,
    private readonly camera: ThirdPersonCamera,
    private readonly hero: Acendedora,
    private readonly events: EventBus
  ) {
    this.fx = new ImpactFx(scene);
  }

  addDummy(spawn: Vector3): TrainingDummy {
    const d = new TrainingDummy(this.scene, spawn);
    this.dummies.push(d);
    return d;
  }

  addSkeleton(spawn: Vector3, opts?: { kind?: SkeletonKind; respawns?: boolean }): Skeleton {
    const d = new Skeleton(this.scene, spawn, opts);
    this.enemies.push(d);
    return d;
  }

  /** Descarta todos os inimigos atuais (ao trocar de andar da cripta). */
  clearEnemies(): void {
    for (const e of this.enemies) e.dispose();
    this.enemies.length = 0;
    this.dead.clear();
  }

  /** Quantos inimigos ainda estão vivos (a sala "limpa" quando chega a zero). */
  get enemiesAlive(): number {
    let n = 0;
    for (const e of this.enemies) if (e.health.alive) n++;
    return n;
  }

  private get targets(): CombatTarget[] {
    return [...this.dummies, ...this.enemies];
  }

  /**
   * Avança o combate um frame e retorna o dt de combate (0 durante o hit stop) para o
   * herói. Chamar ANTES de hero.update (assim um acerto congela o herói já neste frame).
   */
  update(realDt: number): number {
    this.hitStop.update(realDt);
    const combatDt = this.hitStop.scale(realDt);

    this.detectHeroHits();
    this.detectEmber();

    for (const d of this.dummies) d.update(combatDt);

    const heroPos = this.hero.position;
    for (const e of this.enemies) {
      if (e.update(combatDt, heroPos)) this.onEnemyStrike(e.attackDamage);
    }
    // Credita Fagulha por morto recém-derrotado (uma vez cada).
    for (const e of this.enemies) {
      if (!e.health.alive && !this.dead.has(e)) {
        this.dead.add(e);
        this.events.emit("enemy:died", { reward: e.reward });
      }
    }

    return combatDt;
  }

  /** Acerto da arma do herói contra os alvos (um alvo por golpe). */
  private detectHeroHits(): void {
    const hc = this.hero.combat;
    if (!hc.canHit) return;
    const point = hc.weaponHitPoint();
    const reach = HIT_RADIUS + hc.extraReach; // alcance base + upgrades
    for (const target of this.targets) {
      if (!target.health.alive) continue;
      const hb = target.hurtbox;
      if (!overlapSpheres(point, reach, hb.center, hb.radius)) continue;

      const tuning = hc.strikeTuning;
      this.tmpDir.copyFrom(hb.center).subtractInPlace(this.hero.position);
      this.tmpDir.y = 0;
      if (this.tmpDir.lengthSquared() < 1e-4) this.tmpDir.set(0, 0, 1);
      this.tmpDir.normalize();

      const heavy = tuning.hitStopFrames >= 8; // pesado quebra a guarda frontal
      const { guarded } = target.takeHit(tuning.damage * hc.damageMul, this.tmpDir, tuning.knockback, heavy);
      if (guarded) {
        // Bloqueado pela guarda: feedback metálico curto (ensina a flanquear / usar o pesado).
        this.hitStop.trigger(2 / 60);
        this.camera.shake(0.04);
        this.fx.burst(point, 8);
        shieldClank();
      } else {
        this.hitStop.trigger(tuning.hitStopFrames / 60);
        this.camera.shake(0.05 + tuning.hitStopFrames * 0.004);
        this.fx.burst(point, heavy ? 26 : 16);
        hitThunk(heavy);
      }
      this.events.emit("combat:hit", {
        damage: tuning.damage,
        guarded,
        died: !target.health.alive,
        point: { x: point.x, y: point.y, z: point.z },
      });
      hc.markHit(); // um acerto por golpe
      break;
    }
  }

  /** Resolve o GOLPE DE FOGO (ember): leque/área à frente do herói, vários alvos, ignora escudo. */
  private detectEmber(): void {
    const hc = this.hero.combat;
    if (!hc.canEmber) return;
    const origin = this.hero.position;
    const fwd = hc.weaponHitPoint().subtract(origin);
    fwd.y = 0;
    if (fwd.lengthSquared() < 1e-4) fwd.set(0, 0, 1);
    fwd.normalize();
    const t = hc.emberTuning;
    for (const target of this.targets) {
      if (!target.health.alive) continue;
      const hb = target.hurtbox;
      this.tmpDir.copyFrom(hb.center).subtractInPlace(origin);
      this.tmpDir.y = 0;
      const d = this.tmpDir.length();
      if (d > t.range + hb.radius) continue;
      if (d > 0.05) {
        this.tmpDir.scaleInPlace(1 / d);
        if (Vector3.Dot(fwd, this.tmpDir) < t.arcCos) continue; // fora do cone frontal
      } else {
        this.tmpDir.copyFrom(fwd);
      }
      target.takeHit(t.damage, this.tmpDir, t.knockback, true); // guardBreak: o fogo ignora o escudo
    }
    // Estouro de fogo + feedback (dispara mesmo sem alvo).
    const fxPoint = origin.add(fwd.scale(2.2));
    fxPoint.y = 1.0;
    this.hitStop.trigger(4 / 60);
    this.camera.shake(0.06);
    this.fx.burst(fxPoint, 34);
    hitThunk(true);
    hc.markEmber();
  }

  /** Um inimigo conectou o golpe no herói: aplica o dano DELE (i-frames anulam, bloqueio reduz) + feedback. */
  private onEnemyStrike(damage: number): void {
    const blocking = this.hero.combat.isBlocking;
    const { applied, died } = this.hero.combat.takeDamage(damage);
    if (!applied) return; // esquiva com i-frames anulou: sem feedback de dano (recompensa o timing)
    this.camera.shake(blocking ? 0.05 : 0.1);
    heroHurt(blocking);
    this.events.emit("hero:hit", { blocked: blocking, died });
    if (died && !this.heroDead) {
      this.heroDead = true;
      this.events.emit("hero:died", {}); // TERMINAL: o app mostra a derrota e oferece recomeçar
    }
  }

  /** Rearma a morte do herói (ao recomeçar o andar após a derrota). */
  resetHeroDeath(): void {
    this.heroDead = false;
  }
}
