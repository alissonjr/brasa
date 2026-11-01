import { Color3, MeshBuilder, StandardMaterial, Vector3 } from "@babylonjs/core";
import type { Mesh, Scene } from "@babylonjs/core";
import { HitStop, Tweens, Easings, type EventBus, type ThirdPersonCamera } from "@engine";
import type { Acendedora } from "../actors/acendedora";
import { TrainingDummy } from "../actors/trainingDummy";
import { Skeleton, type SkeletonKind, type ShotSpec, type EnemyBounds } from "../actors/enemies/skeleton";
import { Guardiao } from "../actors/enemies/guardiao";
import { ABSORB, BURN } from "./tuning";
import type { CombatTarget } from "./combatTarget";
import { ImpactFx } from "./impactFx";
import { hitThunk, heroHurt, shieldClank, healChime, perfectDodgeChime } from "./combatSound";

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

/** Armas que o herói pode capturar de mortos (cada familia larga a sua). */
type WeaponKind = "clava" | "cajado" | "espada";

export class CombatDirector {
  private readonly hitStop = new HitStop();
  private readonly fx: ImpactFx;
  private readonly dummies: TrainingDummy[] = [];
  private readonly enemies: Skeleton[] = [];
  private readonly tmpDir = new Vector3();
  private readonly dead = new Set<Skeleton>(); // inimigos já creditados (1 drop de Fagulha cada)
  private heroDead = false;
  private enemyBounds: EnemyBounds | null = null; // terreno andável do andar atual (mantém inimigos alcançáveis)
  private boss: Guardiao | null = null; // chefe Guardião (andar final); slot próprio
  private bossCredited = false;
  private wakeTimer = 0; // "despertar": inimigos ficam parados (erguendo-se) por um instante ao entrar
  // Projeteis em voo (conjuradores): esfera emissiva que viaja e fere o herói ao alcançá-lo.
  private readonly projectiles: { mesh: Mesh; pos: Vector3; vel: Vector3; life: number; damage: number; friendly: boolean }[] = [];
  private projMat: StandardMaterial | null = null;
  private deflectMat: StandardMaterial | null = null; // bola DEVOLVIDA (parry): azul-branca
  private readonly tmpFacing = new Vector3();
  private readonly tmpFwd = new Vector3();
  private lockedTarget: CombatTarget | null = null; // alvo do lock-on (T)
  // Essencias: orbes de cura que dropam do morto e curam ao serem coletadas (absorcao).
  private readonly essences: { mesh: Mesh; pos: Vector3; life: number }[] = [];
  private essMat: StandardMaterial | null = null;
  // W2: Queimadura por alvo (status do ember). time = segundos restantes; stacks = pilha.
  private readonly burns = new Map<CombatTarget, { time: number; stacks: number; tick: number }>();
  // CAPTURA DE ARMA: drops no chão (mesh + tipo) e a arma EQUIPADA (buff temporário/cargas).
  private readonly drops: { mesh: Mesh; pos: Vector3; kind: WeaponKind; life: number }[] = [];
  private heroWeapon: { kind: WeaponKind; timer: number; charges: number; mesh: Mesh } | null = null;
  // Props interativos do andar (vasos quebram, cadeiras tombam ao golpe). Setados por sala.
  private strikeProps: { pos: Vector3; r: number; kind: "break" | "kick"; strike: () => void }[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly camera: ThirdPersonCamera,
    private readonly hero: Acendedora,
    private readonly events: EventBus,
    private readonly tweens: Tweens // ESTILO (Bloco 2): juice de spawn/coleta
  ) {
    this.fx = new ImpactFx(scene);
  }

  /** ESTILO (Bloco 2, §4.2b): pop-in de escala (0 -> 1) num mesh recém-criado. */
  private popIn(mesh: Mesh, durMs = 240): void {
    mesh.scaling.setAll(0.01);
    this.tweens.to(mesh.scaling as unknown as Record<string, number>, { x: 1, y: 1, z: 1 }, durMs, Easings.easeOutBack);
  }

  addDummy(spawn: Vector3): TrainingDummy {
    const d = new TrainingDummy(this.scene, spawn);
    this.dummies.push(d);
    return d;
  }

  /** Terreno andável aplicado aos inimigos deste andar (chamado ao montar a sala). */
  setEnemyBounds(b: EnemyBounds): void {
    this.enemyBounds = b;
    for (const e of this.enemies) e.setBounds(b);
  }

  addSkeleton(spawn: Vector3, opts?: { kind?: SkeletonKind; respawns?: boolean }): Skeleton {
    const d = new Skeleton(this.scene, spawn, opts);
    if (this.enemyBounds) d.setBounds(this.enemyBounds);
    this.enemies.push(d);
    return d;
  }

  /** Props interativos do andar (vasos/cadeiras): substituidos a cada sala montada. */
  setStrikeProps(list: { pos: Vector3; r: number; kind: "break" | "kick"; strike: () => void }[]): void {
    this.strikeProps = list;
  }

  /** Despertar: segura a IA dos inimigos por `seconds` ao entrar na câmara (encenação). */
  wake(seconds: number): void {
    this.wakeTimer = seconds;
  }

  // --- Lock-on / soft-target (mira em alvo) ---
  /** Alterna o lock-on: trava no melhor inimigo à frente da câmera; destrava se já travado. */
  toggleLock(): void {
    if (this.lockedTarget && this.lockedTarget.health.alive) this.lockedTarget = null;
    else this.lockedTarget = this.acquireTarget();
  }
  clearLock(): void {
    this.lockedTarget = null;
  }

  /** Posição (tronco) do alvo travado para o retículo do HUD; null se não há. Reacquire ao morrer. */
  getLockedPos(): { x: number; y: number; z: number } | null {
    if (this.lockedTarget && !this.lockedTarget.health.alive) this.lockedTarget = this.acquireTarget();
    if (!this.lockedTarget) return null;
    const c = this.lockedTarget.hurtbox.center;
    return { x: c.x, y: c.y, z: c.z };
  }

  /** Melhor alvo à frente da câmera: menor (distância x desalinhamento) dentro do cone e alcance. */
  private acquireTarget(): CombatTarget | null {
    this.camera.getForward(this.tmpFwd);
    const o = this.hero.position;
    let best: CombatTarget | null = null;
    let bestScore = Infinity;
    for (const t of this.targets) {
      if (!t.health.alive) continue;
      const c = t.hurtbox.center;
      const dx = c.x - o.x;
      const dz = c.z - o.z;
      const dist = Math.hypot(dx, dz) || 1e-3;
      if (dist > 16) continue;
      const dot = (dx / dist) * this.tmpFwd.x + (dz / dist) * this.tmpFwd.z;
      if (dot < 0.2) continue; // fora do cone frontal da câmera
      const score = dist * (1.2 - dot);
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }

  /** Soft-target: inimigo mais próximo num cone frontal apertado (assist de mira no golpe). */
  private softAimPos(): { x: number; y: number; z: number } | null {
    this.camera.getForward(this.tmpFwd);
    const o = this.hero.position;
    let best: CombatTarget | null = null;
    let bd = Infinity;
    for (const t of this.targets) {
      if (!t.health.alive) continue;
      const c = t.hurtbox.center;
      const dx = c.x - o.x;
      const dz = c.z - o.z;
      const dist = Math.hypot(dx, dz) || 1e-3;
      if (dist > 7) continue;
      const dot = (dx / dist) * this.tmpFwd.x + (dz / dist) * this.tmpFwd.z;
      if (dot < 0.5) continue;
      if (dist < bd) {
        bd = dist;
        best = t;
      }
    }
    if (!best) return null;
    const c = best.hurtbox.center;
    return { x: c.x, y: c.y, z: c.z };
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

  /** ESTILO (Bloco 4): inimigos despertos vivos (para a camada de PERIGO da ambiência). */
  get aliveEnemyCount(): number {
    let n = 0;
    for (const e of this.enemies) if (e.health.alive) n++;
    return n;
  }

  /** ESTILO (Bloco 4): luz da Brasa do chefe (0..1); 1 (calmo) quando não há chefe ativo. */
  get bossBrasaLight(): number {
    return this.boss && this.boss.health.alive ? this.boss.brasaLightFraction : 1;
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
    this.events.emit("hero:heal", {}); // feedback positivo (brilho verde + carrilhão)
    healChime();
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

  // --- Captura de arma (drop -> [G] pegar -> buff/munição temporária) ---
  private spawnDrop(kind: WeaponKind, at: Vector3): void {
    const mesh =
      kind === "clava"
        ? MeshBuilder.CreateBox("drop_clava", { width: 0.5, height: 0.5, depth: 1.1 }, this.scene)
        : kind === "espada"
          ? MeshBuilder.CreateBox("drop_espada", { width: 0.14, height: 0.14, depth: 1.5 }, this.scene)
          : MeshBuilder.CreateCylinder("drop_cajado", { diameter: 0.18, height: 1.4, tessellation: 8 }, this.scene);
    const mat = new StandardMaterial("dropMat", this.scene);
    mat.emissiveColor = Color3.FromHexString(kind === "clava" ? "#caa45a" : kind === "espada" ? "#cfe2ff" : "#ff8a2c");
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.disableLighting = true;
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.position.set(at.x, 0.7, at.z);
    this.popIn(mesh, 260); // ESTILO (Bloco 2): a arma "salta" ao cair
    this.drops.push({ mesh, pos: new Vector3(at.x, 0.7, at.z), kind, life: 20 });
  }

  private nearestDrop(): { mesh: Mesh; pos: Vector3; kind: WeaponKind; life: number } | null {
    const hp = this.hero.position;
    let best: { mesh: Mesh; pos: Vector3; kind: WeaponKind; life: number } | null = null;
    let bd = 2.2 * 2.2;
    for (const d of this.drops) {
      const dd = (d.pos.x - hp.x) * (d.pos.x - hp.x) + (d.pos.z - hp.z) * (d.pos.z - hp.z);
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    return best;
  }

  /** Nome da arma dropada ao alcance (prompt "[G] Pegar X"); null = nenhuma. */
  nearbyDrop(): string | null {
    const d = this.nearestDrop();
    return d ? (d.kind === "clava" ? "Clava" : d.kind === "espada" ? "Espada" : "Cajado") : null;
  }

  /** Equipa a arma dropada mais próxima (tecla G). true se pegou. */
  pickupNearby(): boolean {
    const d = this.nearestDrop();
    if (!d) return false;
    this.equipWeapon(d.kind);
    d.mesh.dispose();
    this.drops.splice(this.drops.indexOf(d), 1);
    return true;
  }

  private equipWeapon(kind: WeaponKind): void {
    this.heroWeapon?.mesh.dispose();
    const mesh =
      kind === "clava"
        ? MeshBuilder.CreateBox("arma_clava", { width: 0.45, height: 0.45, depth: 1.2 }, this.scene)
        : kind === "espada"
          ? MeshBuilder.CreateBox("arma_espada", { width: 0.12, height: 0.12, depth: 1.5 }, this.scene)
          : MeshBuilder.CreateCylinder("arma_cajado", { diameter: 0.14, height: 1.3, tessellation: 8 }, this.scene);
    const mat = new StandardMaterial("armaMat", this.scene);
    mat.emissiveColor = Color3.FromHexString(kind === "clava" ? "#caa45a" : kind === "espada" ? "#cfe2ff" : "#ff8a2c");
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.disableLighting = true;
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.parent = this.hero.model.root;
    mesh.position.set(0.45, 1.0, 0.5);
    if (kind === "cajado") mesh.rotation.x = Math.PI / 2;
    // clava: forte mas breve. espada: golpe forte e durador (cargas por acerto). cajado: 3 bolas.
    const stats =
      kind === "clava" ? { timer: 10, charges: 5 } : kind === "espada" ? { timer: 999, charges: 12 } : { timer: 999, charges: 3 };
    this.heroWeapon = { kind, timer: stats.timer, charges: stats.charges, mesh };
  }

  private removeWeapon(): void {
    this.heroWeapon?.mesh.dispose();
    this.heroWeapon = null;
  }

  private updateWeapon(dt: number): void {
    if (!this.heroWeapon) return;
    if (this.heroWeapon.kind === "clava") this.heroWeapon.timer -= dt;
    if (this.heroWeapon.charges <= 0 || this.heroWeapon.timer <= 0) this.removeWeapon();
    // mantém os drops no chão por um tempo (some sozinho)
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]!;
      d.life -= dt;
      d.mesh.rotation.y += dt * 1.5; // gira para chamar atenção
      if (d.life <= 0) {
        d.mesh.dispose();
        this.drops.splice(i, 1);
      }
    }
  }

  /** Arma equipada (HUD): "Clava (4)" / "Cajado (2x)" ou null. */
  get weaponHud(): string | null {
    if (!this.heroWeapon) return null;
    const w = this.heroWeapon;
    return w.kind === "clava" ? `Clava (${w.charges})` : w.kind === "espada" ? `Espada (${w.charges})` : `Cajado (${w.charges}x)`;
  }

  /** Bola de fogo AMIGA disparada pelo cajado capturado (fere inimigos). */
  private spawnFriendlyFireball(target: Vector3): void {
    if (!this.projMat) {
      const mat = new StandardMaterial("projMat", this.scene);
      mat.emissiveColor = Color3.FromHexString("#ff8a2c");
      mat.diffuseColor = Color3.Black();
      mat.specularColor = Color3.Black();
      mat.disableLighting = true;
      this.projMat = mat;
    }
    const o = this.hero.position;
    const dx = target.x - o.x;
    const dz = target.z - o.z;
    const len = Math.hypot(dx, dz) || 1;
    const mesh = MeshBuilder.CreateSphere("fireball_amiga", { diameter: 0.5, segments: 10 }, this.scene);
    mesh.material = this.projMat;
    mesh.isPickable = false;
    mesh.position.set(o.x, o.y + 1.0, o.z);
    this.projectiles.push({
      mesh,
      pos: new Vector3(o.x, o.y + 1.0, o.z),
      vel: new Vector3((dx / len) * 12, 0, (dz / len) * 12),
      life: 2.0,
      damage: 18,
      friendly: true,
    });
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
    for (const d of this.drops) d.mesh.dispose();
    this.drops.length = 0;
    this.removeWeapon();
    this.burns.clear();
    this.lockedTarget = null; // troca de sala: solta o lock-on
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
          this.events.emit("hero:block", {}); // parry: tinta de bronze (bloqueio bem-sucedido)
          continue; // não consome a bola: ela volta voando
        }
        if (hc.isBlocking && frontal) {
          // BLOQUEIO frontal: a bola some sem dano (escudo). Feedback metálico.
          this.fx.burst(p.pos, 10);
          this.camera.shake(0.03);
          shieldClank();
          this.events.emit("hero:block", {}); // bloqueio bem-sucedido (tinta de bronze)
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
      if (sleeping) {
        e.emerge(combatDt); // despertar: sobe rasgando o chão enquanto a IA está suspensa
        continue;
      }
      if (e.update(combatDt, heroPos)) {
        // PARRY de melee: bloqueio no timing exato cambaleia o atacante e anula o dano.
        if (!this.tryMeleeParry(e)) this.onEnemyStrike(e.attackDamage, e.attackUnblockable);
      }
      const shot = e.takeShot();
      if (shot) this.spawnProjectile(shot);
    }
    this.updateProjectiles(combatDt, heroPos);
    // Chefe Guardião (slot próprio): avança, resolve seu golpe e credita ao morrer.
    if (this.boss) {
      if (!sleeping && this.boss.update(combatDt, heroPos)) {
        if (!this.tryMeleeParry(this.boss)) this.onEnemyStrike(this.boss.attackDamage, this.boss.attackUnblockable);
      }
      if (!this.boss.health.alive && !this.bossCredited) {
        this.bossCredited = true;
        this.hero.combat.gainSparkCharge(1); // matar repõe Fagulha (mantém o fogo na turba)
        this.events.emit("enemy:died", { reward: this.boss.reward });
      }
    }
    // Credita Fagulha por morto recém-derrotado (uma vez cada) + chance de soltar essência/arma.
    for (const e of this.enemies) {
      if (!e.health.alive && !this.dead.has(e)) {
        this.dead.add(e);
        this.hero.combat.gainSparkCharge(1); // matar repõe 1 carga de Fagulha
        this.events.emit("enemy:died", { reward: e.reward });
        this.maybeDropEssence(e);
        const wd = e.weaponDrop;
        if (wd) this.spawnDrop(wd, e.torsoPos);
      }
    }
    this.updateEssences(combatDt, heroPos);
    this.updateWeapon(combatDt);
    this.tickBurns(combatDt);

    // Mira do herói: alvo travado (lock-on) ou, durante a antecipação do golpe/ember, o
    // inimigo mais próximo no cone (soft-target). Senão, sem alvo (mira pela câmera).
    const lockedPos = this.getLockedPos();
    if (lockedPos) this.hero.setAimTarget(lockedPos);
    else if (this.hero.combat.aiming || this.hero.combat.casting) this.hero.setAimTarget(this.softAimPos());
    else this.hero.setAimTarget(null);

    return combatDt;
  }

  /** Acerto da arma do herói contra os alvos (um alvo por golpe). */
  private detectHeroHits(): void {
    const hc = this.hero.combat;
    if (!hc.canHit) return;
    const point = hc.weaponHitPoint();
    const reach = HIT_RADIUS + hc.extraReach; // alcance base + upgrades
    // PROPS INTERATIVOS: golpe quebra vaso / tomba cadeira ao alcance (antes dos inimigos).
    for (let i = this.strikeProps.length - 1; i >= 0; i--) {
      const sp = this.strikeProps[i]!;
      const ddx = sp.pos.x - point.x;
      const ddz = sp.pos.z - point.z;
      const rr = reach + sp.r;
      if (ddx * ddx + ddz * ddz > rr * rr) continue;
      sp.strike();
      if (sp.kind === "break") {
        this.fx.burst(sp.pos, 22); // estilhaco
        this.hitStop.trigger(3 / 60);
        this.camera.shake(0.04);
        hitThunk(false);
        if (Math.random() < 0.5) this.spawnEssenceAt(sp.pos); // as vezes solta essencia (cura)
        this.strikeProps.splice(i, 1); // quebrado: sai da lista
      } else {
        this.camera.shake(0.05);
        hitThunk(true); // baque da cadeira tombando
        this.strikeProps.splice(i, 1); // tombou: nao reage mais
      }
    }
    for (const target of this.targets) {
      if (!target.health.alive) continue;
      const hb = target.hurtbox;
      // Acerto melee resolvido no PLANO (XZ), igual ao Golpe de Fogo: o combate é todo no
      // chão, então a ALTURA do ponto de golpe (baixo, ~0.2) NÃO pode fazer o golpe passar
      // por baixo do torso do alvo (hurtbox ~0.9 a 1.1). Era esse desalinhamento vertical no
      // overlapSpheres 3D que fazia o golpe "errar" mesmo colado no inimigo/Guardião. Banda
      // vertical larga só barra acerto absurdo (alvo muito acima/abaixo).
      const rr = reach + hb.radius;
      const dxh = hb.center.x - point.x;
      const dzh = hb.center.z - point.z;
      if (dxh * dxh + dzh * dzh > rr * rr) continue;
      if (Math.abs(hb.center.y - point.y) > rr + 1.5) continue;

      const tuning = hc.strikeTuning;
      this.tmpDir.copyFrom(hb.center).subtractInPlace(this.hero.position);
      this.tmpDir.y = 0;
      if (this.tmpDir.lengthSquared() < 1e-4) this.tmpDir.set(0, 0, 1);
      this.tmpDir.normalize();

      const heavy = tuning.hitStopFrames >= 8; // pesado quebra a guarda frontal
      const burning = this.burns.has(target); // alvo queimado: leva mais dano e mais knockback
      const dmgMul = hc.damageMul * (burning ? 1 + BURN.dmgTakenBonus : 1);
      const kb = tuning.knockback * (burning ? 1 + BURN.knockbackBonus : 1);
      const clavaHeavy = this.heroWeapon?.kind === "clava" && heavy; // clava capturada: pesado = smash de área
      const espada = this.heroWeapon?.kind === "espada"; // espada capturada: todo golpe corta mais forte
      const wMul = clavaHeavy ? 2 : espada ? 1.5 : 1;
      const { guarded } = target.takeHit(tuning.damage * dmgMul * wMul, this.tmpDir, kb, heavy, tuning.poise ?? 0, true);
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
        // CAJADO capturado: cada acerto lança uma bola de fogo (amiga) no alvo (3 cargas).
        if (this.heroWeapon?.kind === "cajado" && this.heroWeapon.charges > 0) {
          this.spawnFriendlyFireball(hb.center);
          this.heroWeapon.charges -= 1;
        }
        // ESPADA capturada: gasta uma carga por golpe conectado (dura ~12 acertos).
        if (espada && this.heroWeapon) this.heroWeapon.charges -= 1;
      }
      this.events.emit("combat:hit", {
        damage: tuning.damage,
        guarded,
        died: !target.health.alive,
        point: { x: point.x, y: point.y, z: point.z },
      });
      hc.markHit(); // um acerto por golpe
      // CLAVA capturada: o smash do pesado atinge TAMBÉM os inimigos próximos do impacto.
      if (clavaHeavy && this.heroWeapon) {
        this.heroWeapon.charges -= 1;
        for (const o of this.targets) {
          if (o === target || !o.health.alive) continue;
          const ob = o.hurtbox;
          const ax = ob.center.x - point.x;
          const az = ob.center.z - point.z;
          if (ax * ax + az * az < 3 * 3) {
            this.tmpDir.set(ax, 0, az);
            if (this.tmpDir.lengthSquared() < 1e-4) this.tmpDir.set(0, 0, 1);
            this.tmpDir.normalize();
            o.takeHit(tuning.damage * dmgMul * 2, this.tmpDir, kb, true, tuning.poise ?? 0);
          }
        }
        this.fx.burst(point, 30);
        this.camera.shake(0.1);
      }
      // CLEAVE (finalizadora/pesado): respinga nos inimigos próximos do impacto (resposta de
      // horda). Dano e poise parciais; não acumula com o smash da clava (que já é AoE maior).
      if (tuning.cleave && tuning.cleave > 0 && !clavaHeavy) {
        const r2 = tuning.cleave * tuning.cleave;
        for (const o of this.targets) {
          if (o === target || !o.health.alive) continue;
          const ob = o.hurtbox;
          const ax = ob.center.x - point.x;
          const az = ob.center.z - point.z;
          if (ax * ax + az * az > r2) continue;
          this.tmpDir.set(ax, 0, az);
          if (this.tmpDir.lengthSquared() < 1e-4) this.tmpDir.set(0, 0, 1);
          this.tmpDir.normalize();
          o.takeHit(tuning.damage * hc.damageMul * 0.55, this.tmpDir, tuning.knockback, heavy, (tuning.poise ?? 0) * 0.5);
        }
        this.fx.burst(point, heavy ? 20 : 12);
      }
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
      target.takeHit(t.damage, this.tmpDir, t.knockback, true, t.poise ?? 0); // guardBreak: o fogo ignora o escudo
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
    this.popIn(mesh, 200); // ESTILO (Bloco 2): a essência brota com um pop
    this.essences.push({ mesh, pos, life: ABSORB.essencia.lifeSec });
  }

  /** Spawna uma essência de cura num ponto (usado pelos vasos quebrados). */
  private spawnEssenceAt(at: { x: number; y: number; z: number }): void {
    if (!this.essMat) {
      const mat = new StandardMaterial("essMat", this.scene);
      mat.emissiveColor = Color3.FromHexString("#ffd27a");
      mat.diffuseColor = Color3.Black();
      mat.specularColor = Color3.Black();
      mat.disableLighting = true;
      this.essMat = mat;
    }
    const mesh = MeshBuilder.CreateSphere("essencia", { diameter: 0.5, segments: 8 }, this.scene);
    mesh.material = this.essMat;
    mesh.isPickable = false;
    const pos = new Vector3(at.x, 0.8, at.z);
    mesh.position.copyFrom(pos);
    this.popIn(mesh, 200);
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
        this.events.emit("hero:heal", {}); // feedback positivo de cura
        healChime();
        this.fx.burst(e.pos, 10);
      }
      if (got || e.life <= 0) {
        e.mesh.dispose();
        this.essences.splice(i, 1);
      }
    }
  }

  /** Um inimigo conectou o golpe no herói: aplica o dano DELE (i-frames anulam, bloqueio reduz) + feedback. */
  private onEnemyStrike(damage: number, unblockable = false): void {
    const blocking = this.hero.combat.isBlocking;
    const wasInvuln = this.hero.combat.invulnerable; // i-frames ativos no instante do golpe?
    const { applied, died, guardBroken } = this.hero.combat.takeDamage(damage, unblockable);
    if (!applied) {
      // ESQUIVA PERFEITA: anulado pelos i-frames na janela inicial -> recompensa (uma por rolamento).
      if (wasInvuln && this.hero.combat.consumePerfectDodge()) this.rewardPerfectDodge();
      return; // esquiva com i-frames anulou: sem feedback de dano (recompensa o timing)
    }
    // Bloqueio só conta se foi bloqueável E a guarda não quebrou por falta de stamina (Tier 3).
    const blocked = blocking && !unblockable && !guardBroken;
    this.camera.shake(blocked ? 0.05 : guardBroken ? 0.14 : 0.1);
    heroHurt(blocked);
    if (blocked) this.events.emit("hero:block", {}); // aparou o golpe: tinta de bronze
    this.events.emit("hero:hit", { blocked, died });
    if (died && !this.heroDead) {
      this.heroDead = true;
      this.events.emit("hero:died", {}); // TERMINAL: o app mostra a derrota e oferece recomeçar
    }
  }

  /** Recompensa da ESQUIVA PERFEITA: freeze breve + 1 carga de Fagulha + feedback (ciano + som). */
  private rewardPerfectDodge(): void {
    this.hitStop.trigger(10 / 60); // quase-colisão congela um instante (sensação de slow-mo)
    this.camera.shake(0.04);
    this.hero.combat.gainSparkCharge(1);
    this.fx.burst(this.hero.position.add(new Vector3(0, 1.2, 0)), 14);
    perfectDodgeChime();
    this.events.emit("hero:perfect", {}); // flash ciano no HUD
  }

  /**
   * PARRY de melee: se o herói está na JANELA de parry (bloqueio recém-iniciado), encara o
   * atacante e o golpe é BLOQUEÁVEL, apara: cambaleia o atacante, anula o dano, devolve
   * stamina e dá feedback de bronze. Inquebrável e golpe pelas costas não se aparam.
   */
  private tryMeleeParry(e: { attackUnblockable: boolean; hurtbox: { center: Vector3 }; stagger: (s?: number) => void }): boolean {
    const hc = this.hero.combat;
    if (!hc.parryActive || e.attackUnblockable) return false;
    this.hero.getFacing(this.tmpFacing);
    const c = e.hurtbox.center;
    const dx = c.x - this.hero.position.x;
    const dz = c.z - this.hero.position.z;
    const len = Math.hypot(dx, dz) || 1;
    if ((this.tmpFacing.x * dx + this.tmpFacing.z * dz) / len < 0.3) return false; // não está de frente
    e.stagger(0.8);
    hc.rewardParry();
    this.fx.burst(c, 18);
    this.hitStop.trigger(6 / 60);
    this.camera.shake(0.05);
    shieldClank();
    this.events.emit("hero:block", {}); // tinta de bronze (parry bem-sucedido)
    return true;
  }

  /** Rearma a morte do herói (ao recomeçar o andar após a derrota). */
  resetHeroDeath(): void {
    this.heroDead = false;
  }
}
