/**
 * Entrada do bundle de teste de áudio (esbuild -> IIFE -> página do Chromium).
 * Expõe window.BrasaAudioTest.{cases, run}. Cada caso monta o MESMO código que roda no jogo
 * (src/game/audio/*) sobre um OfflineAudioContext, agenda ações em instantes absolutos
 * (suspend/resume a cada 128 amostras) e devolve os dois canais como Float32 em base64.
 */
import { audioStats, rand, setAudioContext, setAudioSeed, setGroupVolume, tickAudio, setCombatWeight, type AudioGroup } from "../../src/game/audio/audioBus";
import { resetFloorAudio, setFloorAudio } from "../../src/game/audio/floorAudio";
import { setMusicState, startMusic, stopMusic } from "../../src/game/audio/musicManager";
import { playWhisper, setAmbience, startAmbience, stopAmbience, updateAmbience } from "../../src/game/audio/adaptiveAmbience";
import { playStinger, type Stinger } from "../../src/game/audio/stingers";
import * as sfx from "../../src/game/audio/sfx";
import { hitThunk, perfectDodgeChime, healChime, denyBlip, tellSound, shieldClank, heroHurt, swingWhoosh, type TellProfile } from "../../src/game/combat/combatSound";
import { uiClick, uiHover } from "../../src/game/ui/uiSound";
import { startTitleAmbience, stopTitleAmbience } from "../../src/game/ui/titleAmbience";

const SR = 48000;
const GROUPS: AudioGroup[] = ["music", "ambience", "stinger", "sfx", "ui"];

interface Harness {
  /** agenda `fn` para o instante t (s) do áudio */
  at(t: number, fn: () => void): void;
  /** anota um marco (segmento) para a análise */
  mark(label: string, t0: number, t1: number): void;
  /** guarda uma medida (ex.: contagem de fontes vivas) */
  probe(label: string): void;
}

interface CaseDef {
  name: string;
  seconds: number;
  /** categoria para o relatório: sfx | ambiencia | musica | mix */
  kind: "sfx" | "ambiencia" | "musica" | "mix";
  /** tiques de agendador a cada 0,25 s (música/ambiência) */
  ticks?: boolean;
  /** atualiza updateAmbience(dt) a cada 1/30 s (batida) */
  frames?: boolean;
  run(h: Harness): void;
}

const cases: CaseDef[] = [];
const def = (c: CaseDef): void => {
  cases.push(c);
};

/** Repete `fn` n vezes a cada `gap` s a partir de t0. */
function rep(h: Harness, t0: number, n: number, gap: number, fn: (i: number) => void): void {
  for (let i = 0; i < n; i++) h.at(t0 + i * gap, () => fn(i));
}

// --- efeitos ---------------------------------------------------------------------------
def({ name: "sfx_passos_laje", seconds: 5, kind: "sfx", run: (h) => rep(h, 0.1, 8, 0.42, (i) => sfx.playFootstep("laje", 1, i)) });
def({ name: "sfx_passos_agua", seconds: 5, kind: "sfx", run: (h) => rep(h, 0.1, 8, 0.42, (i) => sfx.playFootstep("agua", 1, i)) });
def({ name: "sfx_passos_cinza", seconds: 5, kind: "sfx", run: (h) => rep(h, 0.1, 8, 0.42, (i) => sfx.playFootstep("cinza", 1, i)) });
def({
  name: "sfx_pulo_aterrissagem",
  seconds: 6,
  kind: "sfx",
  run: (h) => {
    h.at(0.1, () => sfx.playJump());
    h.at(0.9, () => sfx.playLand(0.15));
    h.at(1.8, () => sfx.playJump());
    h.at(2.7, () => sfx.playLand(0.6));
    h.at(3.5, () => sfx.playLand(1));
    h.at(4.3, () => sfx.playLand(0.15)); // o que o heroModel manda numa queda curta
    h.at(4.8, () => sfx.playLand(0.02)); // degrau: mudo
  },
});
def({ name: "sfx_golpe_ar", seconds: 4, kind: "sfx", run: (h) => rep(h, 0.1, 6, 0.6, (i) => sfx.playSwing(i % 2 === 1)) });
for (const m of ["osso", "carne", "armadura"] as const) {
  def({
    name: `sfx_acerto_${m}`,
    seconds: 5,
    kind: "sfx",
    run: (h) => rep(h, 0.1, 6, 0.75, (i) => sfx.playHit(i % 2 === 1, m)),
  });
}
def({ name: "sfx_esquiva_bloqueio", seconds: 5, kind: "sfx", run: (h) => {
  h.at(0.1, () => sfx.playDodge());
  h.at(1.0, () => sfx.playDodge());
  h.at(2.0, () => sfx.playBlock(false));
  h.at(3.0, () => sfx.playBlock(true));
  h.at(4.0, () => perfectDodgeChime());
} });
def({ name: "sfx_pocao", seconds: 4, kind: "sfx", run: (h) => {
  h.at(0.1, () => sfx.playDrink("vida", "cork"));
  h.at(0.4, () => sfx.playDrink("vida", "sip"));
  h.at(1.6, () => sfx.playDrink("furia", "cork"));
  h.at(1.9, () => sfx.playDrink("furia", "sip"));
  h.at(2.8, () => sfx.playDrink("unguento", "cork"));
  h.at(3.0, () => sfx.playDrink("unguento", "sip"));
} });
def({ name: "sfx_item", seconds: 3, kind: "sfx", run: (h) => {
  h.at(0.1, () => sfx.playPickup("item"));
  h.at(1.0, () => sfx.playPickup("essencia"));
  h.at(1.9, () => sfx.playPickup("chave"));
} });
def({ name: "sfx_porta_pedra", seconds: 4, kind: "sfx", run: (h) => h.at(0.1, () => sfx.playDoor("pedra")) });
def({ name: "sfx_alcapao", seconds: 3, kind: "sfx", run: (h) => h.at(0.1, () => sfx.playDoor("alcapao")) });
def({ name: "sfx_braseiro", seconds: 3, kind: "sfx", run: (h) => h.at(0.1, () => sfx.playBrazierLit()) });
def({ name: "sfx_escada", seconds: 4, kind: "sfx", run: (h) => h.at(0.1, () => sfx.playStairs(7)) });
def({ name: "sfx_morte_inimigo", seconds: 5, kind: "sfx", run: (h) => rep(h, 0.1, 3, 1.5, () => sfx.playEnemyDeath()) });
def({ name: "sfx_guardiao", seconds: 7, kind: "sfx", run: (h) => {
  h.at(0.1, () => sfx.playGuardianVoice("fala"));
  h.at(2.3, () => sfx.playGuardianVoice("rugido"));
  h.at(5.0, () => sfx.playGuardianPulse(0.7));
  h.at(5.9, () => sfx.playGuardianPulse(1));
} });
def({ name: "sfx_dano_heroi", seconds: 3, kind: "sfx", run: (h) => {
  h.at(0.1, () => heroHurt(false));
  h.at(1.0, () => heroHurt(true));
  h.at(1.9, () => shieldClank());
} });
def({ name: "sfx_tells", seconds: 6, kind: "sfx", run: (h) => {
  (["swift", "heavy", "cast", "boss", "unblock", "basic"] as TellProfile[]).forEach((p, i) => h.at(0.1 + i * 0.9, () => tellSound(p)));
} });
def({ name: "sfx_cura_ui", seconds: 4, kind: "sfx", run: (h) => {
  h.at(0.1, () => healChime());
  h.at(0.8, () => denyBlip());
  h.at(1.5, () => uiHover());
  h.at(2.0, () => uiClick());
  h.at(2.6, () => hitThunk(false, "osso"));
} });
def({ name: "stingers", seconds: 18, kind: "sfx", run: (h) => {
  (["despertar", "guardiao", "reavivar", "fagulha", "limpa", "derrota", "saidaAlcapao", "saidaEstante", "saidaBancada"] as Stinger[]).forEach((s, i) => h.at(0.1 + i * 2, () => playStinger(s)));
} });

// --- ambiência por andar ---------------------------------------------------------------
for (let f = 0; f < 7; f++) {
  def({
    name: `amb_andar${f}`,
    seconds: 45,
    kind: "ambiencia",
    ticks: true,
    run: (h) => {
      setFloorAudio(f);
      startAmbience();
      setAmbience({ floor: f, danger: 0, urgency: 0 });
      h.mark("frio", 8, 22);
      h.mark("quente", 32, 44);
      h.at(24, () => setMusicState("quente")); // o estado é da música; a ambiência escuta o humor
    },
  });
}

// --- música por andar -------------------------------------------------------------------
for (let f = 0; f < 7; f++) {
  def({
    name: `musica_andar${f}`,
    seconds: 80,
    kind: "musica",
    ticks: true,
    run: (h) => {
      setFloorAudio(f);
      startMusic();
      h.mark("frio", 8, 36);
      h.mark("combate", 40, 58);
      h.mark("quente", 62, 80);
      h.at(36, () => setMusicState("combate"));
      h.at(58, () => setMusicState("quente"));
    },
  });
}

// --- tela-título ------------------------------------------------------------------------
def({ name: "titulo", seconds: 40, kind: "musica", ticks: true, run: (h) => { startTitleAmbience(); h.mark("tudo", 6, 40); h.at(39, () => stopTitleAmbience()); } });

// --- descida de 7 andares (vazamento de nós) ---------------------------------------------
def({
  name: "descida_7_andares",
  seconds: 7 * 14 + 8,
  kind: "mix",
  ticks: true,
  frames: true,
  run: (h) => {
    startMusic();
    startAmbience();
    for (let f = 0; f < 7; f++) {
      h.at(f * 14, () => setAmbience({ floor: f, danger: 0, urgency: 0 }));
      h.at(f * 14 + 6, () => setMusicState("combate"));
      h.at(f * 14 + 6, () => setAmbience({ floor: f, danger: 0.7, urgency: 0.2 }));
      h.at(f * 14 + 11, () => setMusicState("frio"));
      h.at(f * 14 + 11, () => setAmbience({ floor: f, danger: 0, urgency: 0 }));
      h.at(f * 14 + 13.5, () => h.probe(`andar${f}`));
    }
    h.at(7 * 14 + 2, () => h.probe("fim"));
    h.at(7 * 14 + 3, () => { stopMusic(); stopAmbience(); });
    h.at(7 * 14 + 7.5, () => h.probe("parado"));
  },
});

// --- ducking sustentado: música/ambiência abaixam quando o combate pesa -----------------------
def({
  name: "ducking_combate",
  seconds: 40,
  kind: "mix",
  ticks: true,
  run: (h) => {
    setFloorAudio(3);
    startMusic();
    startAmbience();
    setAmbience({ floor: 3, danger: 0, urgency: 0 });
    h.mark("antes", 8, 18);
    h.mark("depois", 26, 38);
    h.at(20, () => setCombatWeight(1));
  },
});

// --- pior caso e mix de jogo -------------------------------------------------------------
def({
  name: "mix_pior_caso",
  seconds: 14,
  kind: "mix",
  ticks: true,
  run: (h) => {
    setFloorAudio(5);
    startMusic();
    startAmbience();
    setAmbience({ floor: 5, danger: 1, urgency: 1 });
    h.at(0.5, () => setMusicState("combate"));
    h.mark("sustentado", 6, 14);
    // tudo ao mesmo tempo em ~50 ms
    h.at(8.0, () => {
      sfx.playGuardianVoice("rugido");
      sfx.playGuardianPulse(1);
      tellSound("boss");
      tellSound("unblock");
      for (let i = 0; i < 5; i++) sfx.playHit(true, i % 2 ? "armadura" : "osso");
      sfx.playBlock(true);
      sfx.playEnemyDeath();
      sfx.playEnemyDeath();
      sfx.playHeroHurt();
      playStinger("guardiao");
      playStinger("despertar");
      sfx.playDoor("pedra");
      sfx.playBrazierLit();
    });
    h.at(10.0, () => { for (let i = 0; i < 10; i++) sfx.playHit(true, "armadura"); });
  },
});

def({
  name: "mix_jogo_andar2",
  seconds: 70,
  kind: "mix",
  ticks: true,
  frames: true,
  run: (h) => {
    setFloorAudio(2);
    startMusic();
    startAmbience();
    setAmbience({ floor: 2, danger: 0, urgency: 0 });
    h.mark("explorando", 4, 22);
    h.mark("combate", 28, 50);
    h.mark("quente", 56, 70);
    // exploração: passos
    rep(h, 2, 40, 0.44, (i) => sfx.playFootstep(i % 9 < 4 ? "laje" : "agua", 1, i));
    h.at(14, () => sfx.playPickup("item"));
    h.at(18, () => sfx.playJump());
    h.at(18.6, () => sfx.playLand(0.4));
    // combate
    h.at(22, () => { playStinger("despertar"); setMusicState("combate"); setAmbience({ floor: 2, danger: 0.5, urgency: 0 }); });
    h.at(30, () => setAmbience({ floor: 2, danger: 0.8, urgency: 0.2 }));
    for (let i = 0; i < 28; i++) {
      const t = 24 + i * 0.85 + rand() * 0.2;
      h.at(t, () => {
        const r = i % 7;
        if (r === 0) tellSound("heavy");
        else if (r === 1) swingWhoosh(false);
        else if (r === 2) sfx.playHit(false, "osso");
        else if (r === 3) sfx.playDodge();
        else if (r === 4) sfx.playHit(true, "osso");
        else if (r === 5) heroHurt(false);
        else sfx.playBlock(false);
      });
    }
    h.at(41, () => sfx.playEnemyDeath());
    h.at(47, () => sfx.playEnemyDeath());
    h.at(50, () => { playStinger("limpa"); setMusicState("quente"); setAmbience({ floor: 2, danger: 0, urgency: 0 }); });
    h.at(52, () => sfx.playBrazierLit());
    h.at(54, () => sfx.playPotion());
    h.at(60, () => sfx.playDoor("pedra"));
    h.at(66, () => sfx.playStairs(6));
  },
});

// --- funções de execução ------------------------------------------------------------------
function b64(f: Float32Array): string {
  const u8 = new Uint8Array(f.buffer, f.byteOffset, f.byteLength);
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode(...u8.subarray(i, i + CH));
  return btoa(s);
}

async function run(name: string, seed = 1, volumes: Partial<Record<AudioGroup, number>> = {}) {
  const c = cases.find((x) => x.name === name);
  if (!c) throw new Error("caso desconhecido: " + name);
  const ctx = new OfflineAudioContext(2, Math.ceil(c.seconds * SR), SR);
  // estado limpo entre casos
  stopMusic();
  stopAmbience();
  stopTitleAmbience();
  resetFloorAudio();
  setCombatWeight(0);
  for (const g of GROUPS) {
    const v = volumes[g] ?? 1;
    setGroupVolume(g, () => v);
  }
  setAudioSeed(seed);
  setAudioContext(ctx);
  const stat0 = audioStats();

  const marks: Array<{ label: string; t0: number; t1: number }> = [];
  const probes: Array<{ label: string; t: number; alive: number; started: number }> = [];
  const events = new Map<number, Array<() => void>>();
  const frameT = (t: number): number => Math.round((t * SR) / 128) * 128 / SR;
  const add = (t: number, fn: () => void): void => {
    const k = frameT(t);
    const list = events.get(k) ?? [];
    list.push(fn);
    events.set(k, list);
  };
  const h: Harness = {
    at: (t, fn) => add(t, fn),
    mark: (label, t0, t1) => marks.push({ label, t0, t1 }),
    // chamado de dentro de um h.at: lê o contador de fontes vivas naquele instante
    probe: (label) => {
      const s = audioStats();
      probes.push({ label, t: ctx.currentTime, alive: s.alive - stat0.alive, started: s.started - stat0.started });
    },
  };
  c.run(h);
  if (c.ticks) for (let k = 1; k * 0.25 < c.seconds; k++) add(k * 0.25, () => tickAudio());
  if (c.frames) for (let k = 1; k / 30 < c.seconds; k++) add(k / 30, () => updateAmbience(1 / 30));
  tickAudio();
  const times = [...events.keys()].filter((t) => t > 0 && t < c.seconds - 0.01).sort((a, b) => a - b);
  const t0 = events.get(0);
  if (t0) for (const fn of t0) fn();
  const waits: Promise<void>[] = [];
  for (const t of times) {
    waits.push(
      ctx.suspend(t).then(() => {
        for (const fn of events.get(t) ?? []) fn();
        void ctx.resume();
      }),
    );
  }
  const buf = await ctx.startRendering();
  await Promise.all(waits);
  const stat1 = audioStats();
  return {
    name: c.name,
    kind: c.kind,
    sr: SR,
    seconds: c.seconds,
    marks,
    probes,
    statsEnd: { alive: stat1.alive - stat0.alive, started: stat1.started - stat0.started, peakAlive: stat1.peakAlive },
    left: b64(buf.getChannelData(0)),
    right: b64(buf.getChannelData(1)),
  };
}

(window as unknown as { BrasaAudioTest: unknown }).BrasaAudioTest = {
  cases: cases.map((c) => ({ name: c.name, seconds: c.seconds, kind: c.kind })),
  run,
};
