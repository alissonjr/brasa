/**
 * CAMADA JOGO (Brasa). MOTOR DE MÚSICA MÍNIMA. Uma música de poucas notas, gerada em tempo
 * real a partir de um perfil modal (raiz, escala, progressão; ver floorAudio.ts):
 *  - PAD: acordes de senoides puras, um por 14-22 s. Na troca de acorde só as notas que mudam
 *    saem (fade de 3 s) e entram (fade de 4,5 s); as notas comuns seguem sustentadas. Uma nota
 *    nova NUNCA começa enquanto uma nota a menos de 3 semitons dela ainda está saindo: assim
 *    não há batimento áspero entre 20 e 300 Hz durante o crossfade.
 *  - MELODIA esparsa: frases de 3-5 notas "de sino" (senoide + oitava + quinta suave) que
 *    caminham por graus vizinhos da escala; longos silêncios entre frases.
 *  - Estados: frio (pad aberto + melodia rara), combate (quinta vazia + tensão em nona menor,
 *    pulso grave lento no lugar da melodia; SEM tremolo), quente (acorde maior, melodia que
 *    sobe, mais frequente). A troca de estado dispara um acorde novo com fade de 2 s.
 *
 * Roda no contexto compartilhado (audioBus) e é dirigido por tique: o runtime chama `tick()` a
 * cada 250 ms (onAudioTick); o teste offline chama à mão. Todos os eventos são agendados com
 * tempos absolutos, então o resultado independe do relógio de parede.
 */
import { audioContext, groupOut, groupVolume, rand, rr, jit, trackSource, type AudioGroup } from "./audioBus";
import type { MusicProfile, MusicState } from "./floorAudio";
import { midiHz, noise, tone } from "./synth";

const LOOKAHEAD = 0.7;

interface PadVoice {
  midi: number;
  /** envelope de entrada (nunca lido de volta: o getter de AudioParam.value não reflete a automação) */
  atk: GainNode;
  /** envelope de saída (fica em 1 até a liberação) */
  rel: GainNode;
  oscs: OscillatorNode[];
  /** instante em que a nota termina de sair (Infinity enquanto sustentada) */
  fadeEnd: number;
}

interface NoteEvent {
  t: number;
  midi: number;
  gain: number;
  dur: number;
  kind: "sino" | "pulso";
}

function degreeMidi(p: MusicProfile, deg: number): number {
  const oct = Math.floor(deg / 7);
  const i = ((deg % 7) + 7) % 7;
  return p.root + 12 * oct + p.scale[i]!;
}

/** Ajusta uma lista de notas: crescente e sem vizinhos a menos de 3 semitons abaixo de MIDI 66. */
function spread(notes: number[]): number[] {
  const out: number[] = [];
  for (const n of notes) {
    let m = n;
    const prev = out[out.length - 1];
    if (prev !== undefined) {
      while (m <= prev) m += 12;
      if (prev < 72 && m - prev < 3) m += 12;
    }
    out.push(m);
  }
  return out;
}

export class MusicEngine {
  private readonly a: BaseAudioContext;
  private readonly fader: GainNode;
  private readonly exit: GainNode;
  private readonly lp: BiquadFilterNode;
  private readonly group: AudioGroup;
  private profile: MusicProfile;
  private state: MusicState = "frio";
  private voices: PadVoice[] = [];
  private queue: NoteEvent[] = [];
  private chordIdx = 0;
  private nextChordAt = 0;
  private nextPhraseAt = 0;
  private lastDeg = 3;
  private running = true;
  private fixedState: MusicState | null;

  constructor(profile: MusicProfile, opts: { group?: AudioGroup; fadeIn?: number; fixedState?: MusicState } = {}) {
    const a = audioContext();
    this.group = opts.group ?? "music";
    const out = groupOut(this.group);
    if (!a || !out) throw new Error("sem WebAudio");
    this.a = a;
    this.profile = profile;
    this.fixedState = opts.fixedState ?? null;
    const t = a.currentTime;
    this.fader = a.createGain();
    this.fader.gain.setValueAtTime(0.0001, t);
    this.fader.gain.linearRampToValueAtTime(1, t + (opts.fadeIn ?? 2.5));
    this.lp = a.createBiquadFilter();
    this.lp.type = "lowpass";
    this.lp.frequency.value = profile.bright;
    this.lp.Q.value = 0.5;
    this.exit = a.createGain();
    this.lp.connect(this.fader).connect(this.exit).connect(out);
    this.nextChordAt = t;
    this.nextPhraseAt = t + rr(2, 5);
    this.applyBright(0.01);
  }

  private effState(): MusicState {
    return this.fixedState ?? this.state;
  }

  private applyBright(tc: number): void {
    const k = { frio: 1, combate: 0.62, quente: 1.35 }[this.effState()];
    this.lp.frequency.setTargetAtTime(this.profile.bright * k, this.a.currentTime, tc);
  }

  setState(s: MusicState): void {
    if (this.fixedState || s === this.state || !this.running) return;
    this.state = s;
    this.restart(2.0);
    this.applyBright(0.8);
  }

  setProfile(p: MusicProfile): void {
    if (p === this.profile || !this.running) return;
    this.profile = p;
    this.chordIdx = 0;
    this.restart(3.2);
    this.applyBright(1);
  }

  /** Troca de estado ou de andar: acorde novo agora, com as notas que mudam saindo em `fade` s. */
  private restart(fade: number): void {
    const t = this.a.currentTime;
    this.queue = [];
    this.setChord(t, fade, fade > 2.5 ? 4.5 : 2.2);
    this.nextChordAt = t + (this.effState() === "combate" ? rr(10, 14) : rr(14, 20));
    this.nextPhraseAt = t + (this.effState() === "combate" ? 0.8 : rr(fade, fade + 3));
  }

  private chordNotes(): Array<{ midi: number; level: number }> {
    const p = this.profile;
    const st = this.effState();
    const deg = p.prog[this.chordIdx % p.prog.length]!;
    // Grave pedal: a tônica do modo fica sustentada; só as vozes de cima mudam de acorde.
    // (Troca de baixo entre graus vizinhos soava como dois tons a poucos Hz, o "besouro".)
    let bass = p.root;
    while (bass < 41) bass += 12;
    while (bass > 52) bass -= 12;
    if (st === "combate") {
      const tension = degreeMidi(p, deg + 1) + 12; // nona (menor no frígio), distante: sem aspereza
      const notes = spread([bass, bass + 7, Math.max(tension, bass + 13)]);
      return [
        { midi: notes[0]!, level: 0.5 },
        { midi: notes[1]!, level: 0.3 },
        { midi: notes[2]!, level: 0.16 },
      ];
    }
    if (st === "quente") {
      const notes = spread([bass, bass + 7, bass + 16, bass + 23]);
      return [
        { midi: notes[0]!, level: 0.5 },
        { midi: notes[1]!, level: 0.32 },
        { midi: notes[2]!, level: 0.26 },
        { midi: notes[3]!, level: 0.13 },
      ];
    }
    const third = degreeMidi(p, deg + 2);
    const fifth = degreeMidi(p, deg + 4);
    const ninth = degreeMidi(p, deg + 8);
    const notes = spread([bass, third + 12, fifth + 12, ninth + 12]);
    return [
      { midi: notes[0]!, level: 0.5 },
      { midi: notes[1]!, level: 0.28 },
      { midi: notes[2]!, level: 0.28 },
      { midi: notes[3]!, level: 0.14 },
    ];
  }

  /** Aplica o acorde atual do estado: sai o que não está nele, entra o que falta, mantém o comum. */
  private setChord(t0: number, release: number, attack: number): void {
    const a = this.a;
    const st = this.effState();
    const base = st === "combate" ? 0.022 : st === "quente" ? 0.022 : 0.024;
    const want = this.chordNotes();
    const keep = new Set(want.map((n) => n.midi));
    for (const v of this.voices) {
      if (v.fadeEnd !== Infinity || keep.has(v.midi)) continue;
      v.rel.gain.setValueAtTime(1, t0);
      v.rel.gain.linearRampToValueAtTime(0.0001, t0 + release);
      for (const o of v.oscs) o.stop(t0 + release + 0.05);
      v.fadeEnd = t0 + release;
    }
    const have = new Set(this.voices.filter((v) => v.fadeEnd === Infinity).map((v) => v.midi));
    for (const n of want) {
      if (have.has(n.midi)) continue;
      let start = t0;
      let midi = n.midi;
      const clash = (m: number): boolean => this.voices.some((v) => v.fadeEnd !== Infinity && Math.abs(v.midi - m) < 3 && Math.min(v.midi, m) < 72);
      if (clash(midi) && !clash(midi + 12) && midi + 12 <= 88) midi += 12; // oitava acima evita o encontro com a nota que sai
      for (const v of this.voices) {
        if (v.fadeEnd !== Infinity && Math.abs(v.midi - midi) < 3 && Math.min(v.midi, midi) < 72) start = Math.max(start, v.fadeEnd + 0.8);
      }
      const atk = a.createGain();
      const peak = base * n.level * 2;
      atk.gain.setValueAtTime(0.0001, start);
      atk.gain.linearRampToValueAtTime(peak, start + attack);
      const rel = a.createGain();
      rel.gain.value = 1;
      atk.connect(rel).connect(this.lp);
      const oscs: OscillatorNode[] = [];
      const f = midiHz(midi);
      const add = (freq: number, gain: number): void => {
        const o = a.createOscillator();
        o.type = "sine";
        o.frequency.value = freq;
        const og = a.createGain();
        og.gain.value = gain;
        o.connect(og).connect(atk);
        o.start(start);
        oscs.push(o);
        trackSource(o, og);
      };
      add(f, 1);
      if (midi >= 52) add(f * 2, 0.22); // brilho por oitava exata (sem batimento)
      this.voices.push({ midi, atk, rel, oscs, fadeEnd: Infinity });
    }
    this.chordIdx++;
  }

  private phrase(t0: number): void {
    const p = this.profile;
    const st = this.effState();
    const q = this.queue;
    if (st === "combate") {
      // pulso grave e lento (tum ... tum), sem ritmo rápido
      const beat = rr(1.0, 1.15);
      const bars = 4;
      for (let b = 0; b < bars; b++) {
        q.push({ t: t0 + b * beat * 2, midi: 0, gain: 0.07, dur: 0.4, kind: "pulso" });
        q.push({ t: t0 + b * beat * 2 + beat * 0.75, midi: 0, gain: 0.035, dur: 0.3, kind: "pulso" });
      }
      this.nextPhraseAt = t0 + bars * beat * 2 + 0.2;
      return;
    }
    const warm = st === "quente";
    const n = warm ? 4 + Math.floor(rand() * 2) : 3 + Math.floor(rand() * 2);
    let deg = warm ? 7 : this.lastDeg;
    let t = t0;
    for (let k = 0; k < n; k++) {
      const stepChoice = rand();
      if (warm) deg += [1, 1, 2, 2][Math.floor(rand() * 4)]!;
      else deg += stepChoice < 0.4 ? -1 : stepChoice < 0.75 ? 1 : stepChoice < 0.88 ? -2 : 2;
      let midi = degreeMidi(p, deg);
      while (midi > p.motifHi) {
        deg -= 7;
        midi = degreeMidi(p, deg);
      }
      while (midi < p.motifLo) {
        deg += 7;
        midi = degreeMidi(p, deg);
      }
      q.push({ t, midi, gain: (warm ? 0.038 : 0.03) * rr(0.85, 1.1), dur: warm ? 2.4 : 3.2, kind: "sino" });
      t += warm ? rr(0.45, 0.8) : rr(0.95, 1.7);
    }
    this.lastDeg = deg;
    const gap = warm ? [p.phraseGap[0] * 0.5, p.phraseGap[1] * 0.5] : p.phraseGap;
    this.nextPhraseAt = t + rr(gap[0]!, gap[1]!);
  }

  private playEvent(e: NoteEvent): void {
    const a = this.a;
    const out = this.lp;
    if (e.kind === "sino") {
      const f = midiHz(e.midi) * jit(0.0015);
      tone(a, out, e.t, { f, dur: e.dur, gain: e.gain, attack: 0.008, pan: rr(-0.25, 0.25) });
      tone(a, out, e.t, { f: f * 2, dur: e.dur * 0.5, gain: e.gain * 0.22, attack: 0.006 });
      tone(a, out, e.t, { f: f * 3, dur: e.dur * 0.25, gain: e.gain * 0.07, attack: 0.006 });
    } else if (e.kind === "pulso") {
      tone(a, this.fader, e.t, { f: 68 * jit(0.04), f1: 44, dur: e.dur, gain: e.gain, attack: 0.01 });
      noise(a, this.fader, e.t, { dur: 0.12, gain: e.gain * 0.35, kind: "brown", filters: [{ type: "lowpass", f: 180 }] });
    }
  }

  /** Agenda acordes, frases e notas até `now + LOOKAHEAD`. */
  tick(): void {
    if (!this.running) return;
    const a = this.a;
    const now = a.currentTime;
    const horizon = now + LOOKAHEAD;
    this.voices = this.voices.filter((v) => v.fadeEnd > now);
    if (groupVolume(this.group) <= 0) {
      // mudo: não agenda nada novo; ao voltar o som, recomeça limpo
      this.queue = [];
      this.nextChordAt = Math.max(this.nextChordAt, now);
      this.nextPhraseAt = Math.max(this.nextPhraseAt, now + 1);
      return;
    }
    const st = this.effState();
    if (this.voices.length === 0 || this.nextChordAt < horizon) {
      const t0 = Math.max(now, this.nextChordAt);
      this.setChord(t0, 3, st === "combate" ? 2.2 : 4.5);
      this.nextChordAt = t0 + (st === "combate" ? rr(10, 14) : rr(14, 20));
    }
    if (this.queue.length === 0 && this.nextPhraseAt < horizon) this.phrase(Math.max(now, this.nextPhraseAt));
    while (this.queue.length > 0 && this.queue[0]!.t < horizon) {
      const e = this.queue.shift()!;
      this.playEvent({ ...e, t: Math.max(now, e.t) });
    }
  }

  stop(fade = 1.5): void {
    if (!this.running) return;
    this.running = false;
    const t = this.a.currentTime;
    this.exit.gain.setValueAtTime(1, t);
    this.exit.gain.linearRampToValueAtTime(0.0001, t + fade);
    for (const v of this.voices) for (const o of v.oscs) o.stop(t + fade + 0.05);
    this.voices = [];
    this.queue = [];
    const nodes: AudioNode[] = [this.lp, this.fader, this.exit];
    if (typeof window !== "undefined" && this.a instanceof AudioContext) {
      window.setTimeout(() => nodes.forEach((n) => n.disconnect()), (fade + 0.4) * 1000);
    }
  }
}
