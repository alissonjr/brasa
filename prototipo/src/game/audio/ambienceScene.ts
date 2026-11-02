/**
 * CAMADA JOGO (Brasa). CENA DE AMBIÊNCIA de um andar: o fundo que não se percebe, só se sente.
 * Uma cena é um conjunto de nós (vento fundo, respiração do poço) mais agendadores de eventos
 * esparsos (gotas, estalos de brasa, rangidos de ferro). Trocar de andar = criar a cena nova
 * com fade-in e `dispose(fade)` na antiga: ao fim do fade todas as fontes são paradas e
 * desconectadas (nenhum nó vaza; ver audioStats no audioBus).
 *
 * Sem zumbido por construção: nada de osciladores graves sustentados, só ruído filtrado cuja
 * cor e volume variam devagar (LFOs de 0,06 a 0,11 Hz).
 */
import { audioContext, groupOut, groupVolume, rand, rr, trackSource, type AudioGroup } from "./audioBus";
import type { AmbienceProfile, MusicState } from "./floorAudio";
import { noise, noiseLoop, tone } from "./synth";

const LOOKAHEAD = 0.7;

const MOOD_MUL: Record<MusicState, { wind: number; breath: number; drip: number; ember: number; creak: number }> = {
  frio: { wind: 1, breath: 1, drip: 1, ember: 1, creak: 1 },
  combate: { wind: 0.5, breath: 0.45, drip: 0.25, ember: 0.5, creak: 0.5 },
  quente: { wind: 0.7, breath: 0.7, drip: 0.7, ember: 2.4, creak: 0.6 }, // o silêncio recua, o crepitar entra
};

function expGap(ratePerMin: number): number {
  return -Math.log(1 - rand() * 0.999) / (ratePerMin / 60);
}

export class AmbienceScene {
  private readonly a: BaseAudioContext;
  private readonly fader: GainNode;
  private readonly exit: GainNode;
  private readonly profile: AmbienceProfile;
  private mood: MusicState = "frio";
  private windGain: GainNode;
  private windFilter: BiquadFilterNode;
  private breathGain: GainNode;
  private breathFilter: BiquadFilterNode;
  private stoppers: Array<(t: number) => void> = [];
  private nextBreath = 0;
  private nextDrip = 0;
  private nextEmber = 0;
  private nextCreak = 0;
  private disposed = false;
  private readonly group: AudioGroup;

  constructor(profile: AmbienceProfile, fadeIn = 3, group: AudioGroup = "ambience") {
    const a = audioContext();
    const out = groupOut(group);
    if (!a || !out) throw new Error("sem WebAudio");
    this.a = a;
    this.group = group;
    this.profile = profile;
    const t = a.currentTime;
    this.fader = a.createGain();
    this.fader.gain.setValueAtTime(0.0001, t);
    this.fader.gain.linearRampToValueAtTime(profile.trim, t + fadeIn);
    this.exit = a.createGain();
    this.fader.connect(this.exit).connect(out);

    const w = profile.wind;
    const mid = (w.lo + w.hi) / 2;
    const wind = noiseLoop(a, this.fader, "pink", [
      { type: "bandpass", f: mid, q: w.q },
      { type: "lowpass", f: w.hi * 1.9, q: 0.5 },
    ], w.level);
    this.windGain = wind.gain;
    this.windFilter = wind.filters[0]!;
    this.stoppers.push(wind.stop);
    // Respiração lenta do vento: cor e volume oscilam em frequências de 0,06 a 0,11 Hz.
    const lfoF = a.createOscillator();
    lfoF.frequency.value = rr(0.05, 0.08);
    const lfoFD = a.createGain();
    lfoFD.gain.value = (w.hi - w.lo) / 2;
    lfoF.connect(lfoFD).connect(this.windFilter.frequency);
    lfoF.start();
    trackSource(lfoF, lfoFD);
    this.stoppers.push((tt) => lfoF.stop(tt));
    const lfoG = a.createOscillator();
    lfoG.frequency.value = rr(0.08, 0.12);
    const lfoGD = a.createGain();
    lfoGD.gain.value = w.level * 0.3;
    lfoG.connect(lfoGD).connect(this.windGain.gain);
    lfoG.start();
    trackSource(lfoG, lfoGD);
    this.stoppers.push((tt) => lfoG.stop(tt));

    const b = noiseLoop(a, this.fader, "brown", [{ type: "lowpass", f: 180, q: 0.5 }], 0.0001);
    this.breathGain = b.gain;
    this.breathFilter = b.filters[0]!;
    this.stoppers.push(b.stop);

    this.nextBreath = t + rr(1, 4);
    this.nextDrip = t + expGap(Math.max(0.1, profile.drip.rate));
    this.nextEmber = t + expGap(Math.max(0.1, profile.ember.rate));
    this.nextCreak = t + rr(6, 18);
    this.applyMood(0.01);
  }

  setMood(m: MusicState): void {
    if (m === this.mood) return;
    this.mood = m;
    this.applyMood(1.2);
  }

  private applyMood(tc: number): void {
    // o vento muda por multiplicador no fader do LFO de ganho: ajusta o ganho-base
    const t = this.a.currentTime;
    this.windGain.gain.setTargetAtTime(this.profile.wind.level * MOOD_MUL[this.mood].wind, t, tc);
  }

  /** Agenda os eventos esparsos até `now + LOOKAHEAD`. Chamada a cada tique do áudio. */
  tick(): void {
    if (this.disposed) return;
    const a = this.a;
    const now = a.currentTime;
    const horizon = now + LOOKAHEAD;
    const p = this.profile;
    const mul = MOOD_MUL[this.mood];
    const out = this.fader;
    const audible = groupVolume(this.group) > 0;

    // respiração do poço (um ciclo: inspira 40%, solta 60%)
    while (this.nextBreath < horizon) {
      const P = rr(p.breath.period[0], p.breath.period[1]);
      const t0 = Math.max(now, this.nextBreath);
      if (p.breath.level > 0 && audible) {
        const peak = p.breath.level * mul.breath;
        const g = this.breathGain.gain;
        g.setValueAtTime(0.0001, t0);
        g.linearRampToValueAtTime(peak, t0 + P * 0.4);
        g.linearRampToValueAtTime(0.0001, t0 + P);
        const f = this.breathFilter.frequency;
        f.setValueAtTime(130, t0);
        f.linearRampToValueAtTime(260, t0 + P * 0.4);
        f.linearRampToValueAtTime(150, t0 + P);
      }
      this.nextBreath = t0 + P + rr(0.5, 3);
    }
    // gotas: plink ascendente curto e dois ecos
    while (p.drip.rate > 0 && this.nextDrip < horizon) {
      const t0 = Math.max(now, this.nextDrip);
      if (audible) {
        const f = rr(900, 2300);
        const lv = p.drip.level * mul.drip * rr(0.6, 1);
        const pan = rr(-0.7, 0.7);
        tone(a, out, t0, { f, f1: f * 1.35, dur: 0.14, gain: lv, attack: 0.002, pan });
        tone(a, out, t0 + 0.21, { f: f * 0.99, f1: f * 1.3, dur: 0.12, gain: lv * 0.3, attack: 0.002, pan: -pan * 0.5 });
        tone(a, out, t0 + 0.44, { f, f1: f * 1.3, dur: 0.1, gain: lv * 0.12, attack: 0.002, pan });
      }
      this.nextDrip = t0 + Math.max(0.4, expGap(p.drip.rate * Math.max(0.15, mul.drip)));
    }
    // estalos de brasa: ticks secos, às vezes em cacho
    while (p.ember.rate > 0 && this.nextEmber < horizon) {
      const t0 = Math.max(now, this.nextEmber);
      if (audible) {
        const n = rand() < 0.3 ? 2 + Math.floor(rand() * 3) : 1;
        for (let k = 0; k < n; k++) {
          noise(a, out, t0 + k * rr(0.02, 0.09), {
            dur: rr(0.008, 0.03),
            gain: p.ember.level * rr(0.4, 1) * Math.min(1.6, mul.ember),
            filters: [{ type: "bandpass", f: rr(2200, 5200), q: 1.2 }],
            pan: rr(-0.5, 0.5),
          });
        }
      }
      this.nextEmber = t0 + Math.max(0.12, expGap(p.ember.rate * mul.ember));
    }
    // rangido de ferro: gemido filtrado e lento, raro
    while (p.creak.rate > 0 && this.nextCreak < horizon) {
      const t0 = Math.max(now, this.nextCreak);
      if (audible) {
        const d = rr(0.9, 1.7);
        const f = rr(320, 520);
        noise(a, out, t0, {
          dur: d,
          gain: p.creak.level * mul.creak,
          kind: "pink",
          attack: d * 0.35,
          filters: [{ type: "bandpass", f, f1: f * rr(1.15, 1.5), q: 9 }],
          pan: rr(-0.6, 0.6),
        });
      }
      this.nextCreak = t0 + Math.max(4, expGap(p.creak.rate * mul.creak));
    }
  }

  /** Encerra com fade e solta todos os nós ao final. Idempotente. */
  dispose(fade = 2.5): void {
    if (this.disposed) return;
    this.disposed = true;
    const t = this.a.currentTime;
    this.exit.gain.setValueAtTime(1, t);
    this.exit.gain.linearRampToValueAtTime(0.0001, t + fade);
    for (const s of this.stoppers) s(t + fade + 0.05);
    this.stoppers = [];
    // As fontes disparam "ended" e se desconectam sozinhas (trackSource); os faders soltam depois.
    const nodes: AudioNode[] = [this.fader, this.exit];
    if (typeof window !== "undefined" && this.a instanceof AudioContext) window.setTimeout(() => nodes.forEach((n) => n.disconnect()), (fade + 0.4) * 1000);
  }
}
