import { Color3, MeshBuilder, StandardMaterial, Vector3 } from "@babylonjs/core";
import type { Mesh, Scene } from "@babylonjs/core";
import { HitStop, overlapSpheres, type EventBus, type ThirdPersonCamera } from "@engine";
import type { Acendedora } from "../actors/acendedora";
import { TrainingDummy } from "../actors/trainingDummy";
import { Skeleton, type SkeletonKind, type ShotSpec } from "../actors/enemies/skeleton";
import { Guardiao } from "../actors/enemies/guardiao";
import { ABSORB, BURN } from "./tuning";
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
  private boss: Guardiao | null = null; // chefe Guardião (andar final); slot próprio
  private bossCredited = false;
  private wakeTimer = 0; // "despertar": inimigos ficam parados (erguendo-se) por um instante ao entrar
  // Projeteis em voo (conjuradores): esfera emissiva que viaja e fere o herói ao alcançá-lo.
  private readonly projectiles: { mesh: Mesh; pos: Vector3; vel: Vector3; life: number; damage: number; friendly: boolean }[] = [];
  private projMat: StandardMaterial | null = null;
  private deflectMat: StandardMaterial | null = null; // bola DEVOLVIDA (parry): azul-branca
  private readonly tmpFacing = new Vector3();
  // Essencias: orbes de cura que dropam do morto e curam ao serem coletadas (absorcao).
  private readonly essences: { mesh: Mesh; pos: Vector3; life: number }[] = [];
  private essMat: StandardMaterial | null = null;
  // W2: Queimadura por alvo (status do ember). time = segundos restantes; stacks = pilha.
  private readonly burns = new Map<CombatTarget, { time: number; stacks: number; tick: number }>();

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

  /** Despertar: segura a IA dos inimigos por `seconds` ao entrar na câmara (encenação). */
  wake(seconds: number): void {
    this.wakeTimer = seconds;
  }

  /** Instancia o chefe Guardião na arena (andar final). */
  addBoss(spawn: Vector3): Guardiao {
    this.boss = new Guardiao(this.scene, spawn);
    this.bossCredited = false;
    return this.boss;
  }

  /** Fração de vida do chefe (barra de chefe no HUD); -1 se não há chefe ativo. */
  get bossFraction(): number {
    return this.boss && this.boss.health.alive ? this.boss.fraction : -1;
  }
  get bossActive(): boolean {
    return !!this.boss && this.boss.health.alive;
  }

  // --- Execução (finisher) ---
  private nearestExecutable(): Skeleton | null {
    const hp = this.hero.position;
    let best: Skeleton | null = null;
    let bd = 2.8 * 2.8; // alcance da execução
    for (const e of this.enemies) {
      if (!e.executable) continue;
      const c = e.torsoPos;
      const d = (c.x - hp.x) * (c.x - hp.x) + (c.z - hp.z) * (c.z - hp.z);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** Há um inimigo em vacilo ao alcance? Posição do tronco para o prompt "[F] Executar". */
  executePromptPos(): { x: number; y: number; z: number } | null {
    const e = this.nearestExecutable();
    if (!e) return null;
    const c = e.torsoPos;
    return { x: c.x, y: c.y, z: c.z };
  }

  /** Executa o inimigo em vacilo mais próximo: dano letal + cura + Fagulha + VFX. true se executou. */
  executeNearest(): boolean {
    const e = this.nearestExecutable();
    if (!e) return false;
    const c = e.torsoPos.clone();
    this.tmpDir.set(c.x - this.hero.position.x, 0, c.z - this.hero.position.z);
    if (this.tmpDir.lengthSquared() < 1e-4) this.tmpDir.set(0, 0, 1);
    this.tmpDir.normalize();
    e.takeHit(99999, this.tmpDir, 2, true); // golpe letal: dispara morte + dissolução
    // Recompensa do finisher (loop do Doom: executar = sobreviver): cura + estouro + freeze + tremor.
    this.hero.combat.heal(this.hero.combat.maxHealth * 0.15);
    this.fx.burst(c, 40);
    this.hitStop.trigger(8 / 60);
    this.camera.shake(0.12);
    hitThunk(true);
    return true;
  }

  /** ULTIMATE "Erupção": chuva de fogo na arena - dano forte a TODOS os inimigos (ignora guarda) + VFX. */
  unleashUltimate(): void {
    const origin = this.hero.position;
    for (const target of this.targets) {
      if (!target.health.alive) continue;
      const c = target.hurtbox.center;
      this.tmpDir.set(c.x - origin.x, 0, c.z - origin.z);
      if (this.tmpDir.lengthSquared() < 1e-4) this.tmpDir.set(0, 0, 1);
      this.tmpDir.normalize();
      target.takeHit(60, this.tmpDir, 6, true); // o fogo da Erupção ignora escudo
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      this.fx.burst(new Vector3(origin.x + Math.cos(a) * 4, 1.2, origin.z + Math.sin(a) * 4), 22);
    }
    this.fx.burst(new Vector3(origin.x, 1.6, origin.z), 40);
    this.hitStop.trigger(10 / 60);
    this.camera.shake(0.18);
    hitThunk(true);
  }

  /** Descarta todos os inimigos atuais (ao trocar de andar da cripta). */
  clearEnemies(): void {
    for (const e of this.enemies) e.dispose();
    this.enemies.length = 0;
    this.dead.clear();
    this.boss?.dispose();
    this.boss = null;
    this.bossCredited = false;
    for (const p of this.projectiles) p.mesh.dispose();
    this.projectiles.length = 0;
    for (const e of this.essences) e.mesh.dispose();
    this.essences.length = 0;
    this.burns.clear();
  }

  /** Cria um projetil (esfera de fogo) viajando na direcao do disparo do conjurador. */
  private spawnProjectile(s: ShotSpec): void {
    if (!this.projMat) {
      const mat = new StandardMaterial("projMat", this.scene);
      mat.emissiveColor = Color3.FromHexString("#ff8a2c");
      mat.diffuseColor = Color3.Black();
      mat.specularColor = Color3.Black();
      mat.disableLighting = true;
      this.projMat = mat;
    }
    const mesh = MeshBuilder.CreateSphere("projetil", { diameter: 0.6, segments: 10 }, this.scene);
    mesh.material = this.projMat;
    mesh.isPickable = false;
    mesh.position.set(s.ox, s.oy, s.oz);
    this.projectiles.push({
      mesh,
      pos: new Vector3(s.ox, s.oy, s.oz),
      vel: new Vector3(s.dx * s.speed, 0, s.dz * s.speed),
      life: 3.5,
      damage: s.damage,
      friendly: false,
    });
  }

  /**
   * Move os projeteis e resolve contatos. Bola inimiga: o herói pode ESQUIVAR (i-frames, já
   * em takeDamage), BLOQUEAR de frente (cone ~120 graus -> some sem dano) ou dar PARRY
   * (bloqueio recém-iniciado -> DEVOLVE a bola, agora "amiga", que fere o conjurador). Bola
   * amiga (devolvida): ignora o herói e atinge inimigos.
   */
  private updateProjectiles(dt: number, heroPos: Vector3): void {
    if (dt <= 0 || this.projectiles.length === 0) return;
    const hc = this.hero.combat;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]!;
      p.pos.addInPlace(p.vel.scale(dt));
      p.mesh.position.copyFrom(p.pos);
      p.life -= dt;

      if (p.friendly) {
        // Bola devolvida: fere o primeiro inimigo que tocar.
        let struck = false;
        for (const target of this.targets) {
          if (!target.health.alive) continue;
          const hb = target.hurtbox;
          const ddx = hb.center.x - p.pos.x;
          const ddz = hb.center.z - p.pos.z;
          if (ddx * ddx + ddz * ddz < (hb.radius + 0.4) * (hb.radius + 0.4)) {
            this.tmpDir.set(p.vel.x, 0, p.vel.z).normalize();
            target.takeHit(p.damage, this.tmpDir, 4, true);
            this.fx.burst(p.pos, 18);
            this.hitStop.trigger(3 / 60);
            hitThunk(true);
            struck = true;
            break;
          }
        }
        if (struck || p.life <= 0) {
          p.mesh.dispose();
          this.projectiles.splice(i, 1);
        }
        continue;
      }

      const dxh = heroPos.x - p.pos.x;
      const dzh = heroPos.z - p.pos.z;
      const hit = dxh * dxh + dzh * dzh < 0.7 * 0.7 && Math.abs(p.pos.y - (heroPos.y + 1.0)) < 1.2;
      if (hit) {
        // Frontal? hero encara CONTRA a direção de voo (toward a origem da bola).
        this.hero.getFacing(this.tmpFacing);
        const vlen = Math.hypot(p.vel.x, p.vel.z) || 1;
        const frontal = (this.tmpFacing.x * p.vel.x + this.tmpFacing.z * p.vel.z) / vlen < -0.5;
        if (hc.isBlocking && frontal && hc.parryActive) {
          // PARRY: devolve a bola (azul-branca), mais rápida e com mais dano. Vira "amiga".
          if (!this.deflectMat) {
            const m = new StandardMaterial("deflectMat", this.scene);
            m.emissiveColor = Color3.FromHexString("#bfe6ff");
            m.diffuseColor = Color3.Black();
            m.specularColor = Color3.Black();
            m.disableLighting = true;
            this.deflectMat = m;
          }
          p.mesh.material = this.deflectMat;
          p.vel.scaleInPlace(-1.8);
          p.damage = p.damage * 2 + 10;
          p.friendly = true;
          p.life = 2.5;
          this.fx.burst(p.pos, 20);
          this.hitStop.trigger(5 / 60);
          this.camera.shake(0.06);
          shieldClank();
          continue; // não consome a bola: ela volta voando
        }
        if (hc.isBlocking && frontal) {
          // BLOQUEIO frontal: a bola some sem dano (escudo). Feedback metálico.
          this.fx.burst(p.pos, 10);
          this.camera.shake(0.03);
          shieldClank();
        } else {
          this.fx.burst(p.pos, 14);
          this.onEnemyStrike(p.damage); // esquiva (i-frames) ainda anula em takeDamage
        }
        p.mesh.dispose();
        this.projectiles.splice(i, 1);
        continue;
      }
      if (p.life <= 0) {
        p.mesh.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  /** Quantos inimigos ainda estão vivos (a sala "limpa" quando chega a zero). */
  get enemiesAlive(): number {
    let n = 0;
    for (const e of this.enemies) if (e.health.alive) n++;
    if (this.boss && this.boss.health.alive) n++;
    return n;
  }

  private get targets(): CombatTarget[] {
    const t: CombatTarget[] = [...this.dummies, ...this.enemies];
    if (this.boss) t.push(this.boss);
    return t;
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
    // Despertar: enquanto o timer corre, os inimigos ficam parados (erguendo-se).
    if (this.wakeTimer > 0) this.wakeTimer = Math.max(0, this.wakeTimer - combatDt);
    const sleeping = this.wakeTimer > 0;
    for (const e of this.enemies) {
      if (!sleeping && e.update(combatDt, heroPos)) this.onEnemyStrike(e.attackDamage);
      const shot = sleeping ? null : e.takeShot();
      if (shot) this.spawnProjectile(shot);
    }
    this.updateProjectiles(combatDt, heroPos);
    // Chefe Guardião (slot próprio): avança, resolve seu golpe e credita ao morrer.
    if (this.boss) {
      if (!sleeping && this.boss.update(combatDt, heroPos)) this.onEnemyStrike(this.boss.attackDamage);
      if (!this.boss.health.alive && !this.bossCredited) {
        this.bossCredited = true;
        this.events.emit("enemy:died", { reward: this.boss.reward });
      }
    }
    // Credita Fagulha por morto recém-derrotado (uma vez cada) + chance de soltar essência.
    for (const e of this.enemies) {
      if (!e.health.alive && !this.dead.has(e)) {
        this.dead.add(e);
        this.events.emit("enemy:died", { reward: e.reward });
        this.maybeDropEssence(e);
      }
    }
    this.updateEssences(combatDt, heroPos);
    this.tickBurns(combatDt);

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
      const burning = this.burns.has(target); // alvo queimado: leva mais dano e mais knockback
      const dmgMul = hc.damageMul * (burning ? 1 + BURN.dmgTakenBonus : 1);
      const kb = tuning.knockback * (burning ? 1 + BURN.knockbackBonus : 1);
      const { guarded } = target.takeHit(tuning.damage * dmgMul, this.tmpDir, kb, heavy);
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
        hc.lifestealHeal(tuning.damage * hc.damageMul); // "Sede da Brasa": golpe rouba vida
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
      this.applyBurn(target); // o fogo deixa Queimadura
      // W3: o fogo REACENDE a Brasa no Guardião -> cambaleio + dano dobrado (gangorra de luz).
      (target as { reignite?: () => void }).reignite?.();
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

  /** Aplica/renova Queimadura num alvo (Golpe de Fogo). Dádiva Queimador estende. */
  private applyBurn(target: CombatTarget): void {
    const hc = this.hero.combat;
    const dur = BURN.durationSec + hc.burnDurationBonus;
    const maxStacks = BURN.maxStacks + hc.burnStackBonus;
    const cur = this.burns.get(target);
    if (cur) {
      cur.time = dur;
      cur.stacks = Math.min(maxStacks, cur.stacks + 1);
    } else {
      this.burns.set(target, { time: dur, stacks: 1, tick: 0 });
      this.setBurning(target, true);
    }
  }

  /** Tick da Queimadura: a cada 1 s aplica dano (dps * stacks), sem knockback, ignora escudo. */
  private tickBurns(dt: number): void {
    if (dt <= 0 || this.burns.size === 0) return;
    for (const [target, b] of this.burns) {
      if (!target.health.alive) {
        this.setBurning(target, false);
        this.burns.delete(target);
        continue;
      }
      b.time -= dt;
      b.tick += dt;
      if (b.tick >= 1) {
        b.tick -= 1;
        this.tmpDir.set(0, 0, 1);
        target.takeHit(BURN.dps * b.stacks, this.tmpDir, 0, true);
        this.fx.burst(target.hurtbox.center, 6);
      }
      if (b.time <= 0) {
        this.setBurning(target, false);
        this.burns.delete(target);
      }
    }
  }

  /** Liga/desliga o brilho de Queimadura no ator, se ele suportar (Skeleton). */
  private setBurning(target: CombatTarget, on: boolean): void {
    (target as { setBurning?: (on: boolean) => void }).setBurning?.(on);
  }

  /** Chance de o morto soltar uma essência (orbe de cura), escalada pelo seu valor. */
  private maybeDropEssence(e: Skeleton): void {
    const chance = Math.min(0.9, ABSORB.essencia.dropChanceBase + e.reward * 0.02);
    if (Math.random() > chance) return;
    if (!this.essMat) {
      const mat = new StandardMaterial("essMat", this.scene);
      mat.emissiveColor = Color3.FromHexString("#ffd27a");
      mat.diffuseColor = Color3.Black();
      mat.specularColor = Color3.Black();
      mat.disableLighting = true;
      this.essMat = mat;
    }
    const c = e.hurtbox.center;
    const mesh = MeshBuilder.CreateSphere("essencia", { diameter: 0.5, segments: 8 }, this.scene);
    mesh.material = this.essMat;
    mesh.isPickable = false;
    const pos = new Vector3(c.x, 0.8, c.z);
    mesh.position.copyFrom(pos);
    this.essences.push({ mesh, pos, life: ABSORB.essencia.lifeSec });
  }

  /** Coleta de essência por proximidade (cura) + expiração. */
  private updateEssences(dt: number, heroPos: Vector3): void {
    if (dt <= 0 || this.essences.length === 0) return;
    const rr = ABSORB.essencia.pickupRadius * ABSORB.essencia.pickupRadius;
    for (let i = this.essences.length - 1; i >= 0; i--) {
      const e = this.essences[i]!;
      e.life -= dt;
      e.mesh.position.y = 0.8 + 0.12 * Math.sin(e.life * 6); // leve flutuacao
      const dx = heroPos.x - e.pos.x;
      const dz = heroPos.z - e.pos.z;
      const got = dx * dx + dz * dz < rr;
      if (got) {
        this.hero.combat.heal(this.hero.combat.maxHealth * ABSORB.essencia.healFrac);
        this.fx.burst(e.pos, 10);
      }
      if (got || e.life <= 0) {
        e.mesh.dispose();
        this.essences.splice(i, 1);
      }
    }
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
