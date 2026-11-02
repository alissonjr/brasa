/**
 * CAMADA JOGO (Brasa). STINGERS: pontuações musicais curtas para os momentos-chave da
 * descida (biblia-audio 3.7), sintetizadas via WebAudio (sem assets, coerente com
 * musicManager/titleAmbience). São MUSICAIS (acordes/varreduras), por isso gated pelo
 * volume de MÚSICA (não o de sfx). AudioContext próprio, preguiçoso (política de autoplay):
 * só soam após o primeiro gesto do usuário.
 *  - despertar: os mortos acordam ao entrar na câmara (grave dissonante + sopro frio).
 *  - guardiao:  avistar o Guardião (queda grave e ominosa).
 *  - reavivar:  a Brasa volta a arder (arpejo maior ascendente, esperança).
 *  - fagulha:   um braseiro pega (dois tons brilhantes ascendentes, curto).
 *  - limpa:     a câmara foi limpa (alívio curto, quinta ascendente morna).
 *  - derrota:   a fagulha apagou (queda menor fria, esmaecendo).
 *  - saidaAlcapao / saidaEstante / saidaBancada: assinatura sonora de cada saida do andar, tocada
 *    quando elas abrem (o ouvido aprende qual icone e qual: brasa grave, folhear + sino, vidro).
 */
export type Stinger = "despertar" | "guardiao" | "reavivar" | "fagulha" | "limpa" | "derrota" | "saidaAlcapao" | "saidaEstante" | "saidaBancada";

let ctx: AudioContext | null = null;
let getVolume: () => number = () => 0;

export function configureStingers(volume: () => number): void {
  getVolume = volume;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Tom com envelope (ataque rápido, decaimento exponencial), opcionalmente com glissando. */
function tone(a: AudioContext, t: number, f0: number, f1: number, dur: number, gain: number, type: OscillatorType = "sine"): void {
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

/** Sopro de ruído filtrado (passa-banda) com decaimento, para texturas frias. */
function sweep(a: AudioContext, t: number, dur: number, gain: number, f0: number, f1: number): void {
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t + dur);
  bp.Q.value = 1.2;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(a.destination);
  src.start(t);
}

export function playStinger(name: Stinger): void {
  const vol = 0.7 * Math.max(0, Math.min(1, getVolume()));
  if (vol <= 0) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  switch (name) {
    case "despertar": // grave dissonante crescente + sopro frio (os mortos erguem-se)
      tone(a, t, 58, 58, 0.9, 0.16 * vol, "sine");
      tone(a, t + 0.05, 61.7, 61.7, 0.9, 0.12 * vol, "sine"); // segunda menor (tensão)
      sweep(a, t, 0.9, 0.1 * vol, 400, 1600);
      break;
    case "guardiao": // queda grave e ominosa (duas vozes batendo, glissando para baixo)
      tone(a, t, 120, 60, 1.2, 0.2 * vol, "sawtooth");
      tone(a, t, 127, 63, 1.2, 0.13 * vol, "sawtooth");
      sweep(a, t + 0.1, 0.6, 0.08 * vol, 300, 120);
      break;
    case "reavivar": { // arpejo MAIOR ascendente (calor/esperança): tônica, terça, quinta, oitava
      const notes = [220, 277.18, 329.63, 440];
      notes.forEach((f, i) => tone(a, t + i * 0.14, f, f, 0.7, 0.13 * vol, "sine"));
      sweep(a, t, 0.5, 0.05 * vol, 800, 2400);
      break;
    }
    case "fagulha": // dois tons brilhantes ascendentes, curto (o braseiro pega)
      tone(a, t, 660, 680, 0.18, 0.09 * vol, "triangle");
      tone(a, t + 0.07, 990, 1010, 0.22, 0.08 * vol, "triangle");
      break;
    case "limpa": // câmara limpa: alívio curto (quinta ascendente, morno)
      tone(a, t, 330, 330, 0.5, 0.11 * vol, "sine");
      tone(a, t + 0.1, 494, 494, 0.6, 0.09 * vol, "sine"); // quinta acima
      sweep(a, t, 0.4, 0.04 * vol, 600, 1400);
      break;
    case "saidaAlcapao": // brasa grave e estalo seco (o alcapao, o caminho de sempre)
      tone(a, t, 82, 61, 0.55, 0.16 * vol, "triangle");
      sweep(a, t + 0.02, 0.12, 0.09 * vol, 2600, 900);
      break;
    case "saidaEstante": // folhear de paginas (ruido curto em leque) e um sino curto
      sweep(a, t, 0.18, 0.07 * vol, 3200, 5200);
      sweep(a, t + 0.11, 0.16, 0.06 * vol, 2800, 4600);
      tone(a, t + 0.26, 880, 880, 0.55, 0.08 * vol, "sine");
      tone(a, t + 0.26, 1318.5, 1318.5, 0.4, 0.04 * vol, "sine");
      break;
    case "saidaBancada": // tilintar de vidro: tres agudos rapidos e desiguais
      tone(a, t, 2093, 2093, 0.22, 0.05 * vol, "sine");
      tone(a, t + 0.08, 2637, 2637, 0.2, 0.045 * vol, "sine");
      tone(a, t + 0.17, 3136, 3136, 0.26, 0.04 * vol, "sine");
      break;
    case "derrota": // a fagulha apaga: terça menor descendo, fria, esmaecendo
      tone(a, t, 196, 130, 1.4, 0.18 * vol, "sine");
      tone(a, t + 0.08, 233, 155, 1.4, 0.12 * vol, "sine");
      sweep(a, t + 0.2, 1.0, 0.07 * vol, 1200, 200);
      break;
  }
}
