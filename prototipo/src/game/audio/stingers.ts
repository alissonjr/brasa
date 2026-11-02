/**
 * CAMADA JOGO (Brasa). STINGERS: pontuações musicais curtas para os momentos-chave da
 * descida (biblia-audio 3.7), sintetizadas via WebAudio (sem assets, coerente com
 * musicManager/titleAmbience). São MUSICAIS (acordes/varreduras), por isso gated pelo
 * volume de MÚSICA (grupo "stinger" do barramento, não ducked). Contexto compartilhado e
 * preguiçoso (política de autoplay): só soam após o primeiro gesto do usuário.
 *  - despertar: os mortos acordam ao entrar na câmara (grave dissonante + sopro frio).
 *  - guardiao:  avistar o Guardião (queda grave e ominosa).
 *  - reavivar:  a Brasa volta a arder (arpejo maior ascendente, esperança).
 *  - fagulha:   um braseiro pega (dois tons brilhantes ascendentes, curto).
 *  - limpa:     a câmara foi limpa (alívio curto, quinta ascendente morna).
 *  - derrota:   a fagulha apagou (queda menor fria, esmaecendo).
 *  - saidaAlcapao / saidaEstante / saidaBancada: assinatura sonora de cada saida do andar, tocada
 *    quando elas abrem (o ouvido aprende qual icone e qual: brasa grave, folhear + sino, vidro).
 */
import { audioContext, groupOut, groupVolume, setGroupVolume, duckPulse } from "./audioBus";
import { noise, tone as synthTone } from "./synth";

export type Stinger = "despertar" | "guardiao" | "reavivar" | "fagulha" | "limpa" | "derrota" | "saidaAlcapao" | "saidaEstante" | "saidaBancada";

export function configureStingers(volume: () => number): void {
  setGroupVolume("stinger", volume);
}

type Wave = OscillatorType;

/** Tom com envelope (ataque rápido, decaimento exponencial), opcionalmente com glissando. */
function tone(a: BaseAudioContext, out: AudioNode, t: number, f0: number, f1: number, dur: number, gain: number, type: Wave = "sine"): void {
  synthTone(a, out, t, { f: f0, f1: f1 !== f0 ? f1 : undefined, dur, gain, type, attack: 0.02 });
}

/** Sopro de ruído filtrado (passa-banda móvel) com decaimento, para texturas frias. */
function sweep(a: BaseAudioContext, out: AudioNode, t: number, dur: number, gain: number, f0: number, f1: number): void {
  noise(a, out, t, { dur, gain, attack: 0.01, filters: [{ type: "bandpass", f: f0, f1: Math.max(60, f1), q: 1.2 }] });
}

export function playStinger(name: Stinger): void {
  if (groupVolume("stinger") <= 0) return;
  const a = audioContext();
  const out = groupOut("stinger");
  if (!a || !out) return;
  const vol = 0.7;
  const t = a.currentTime + 0.005;
  switch (name) {
    case "despertar": // grave dissonante crescente + sopro frio (os mortos erguem-se)
      tone(a, out, t, 58, 58, 0.9, 0.16 * vol, "sine");
      tone(a, out, t + 0.05, 87, 87, 0.9, 0.1 * vol, "sine"); // quinta aberta (a segunda menor antiga batia a 3,7 Hz)
      tone(a, out, t + 0.1, 164, 164, 0.8, 0.05 * vol, "sine"); // trítono acima da oitava: tensão sem aspereza
      sweep(a, out, t, 0.9, 0.1 * vol, 400, 1600);
      break;
    case "guardiao": // queda grave e ominosa (duas vozes batendo, glissando para baixo)
      tone(a, out, t, 120, 60, 1.2, 0.2 * vol, "sine"); // (era dente de serra a 120/127 Hz: batia a 7 Hz)
      tone(a, out, t, 180, 90, 1.2, 0.1 * vol, "sine");
      tone(a, out, t, 60, 40, 1.4, 0.1 * vol, "triangle");
      sweep(a, out, t + 0.1, 0.6, 0.08 * vol, 300, 120);
      duckPulse(1.0);
      break;
    case "reavivar": { // arpejo MAIOR ascendente (calor/esperança): tônica, terça, quinta, oitava
      const notes = [220, 277.18, 329.63, 440];
      notes.forEach((f, i) => tone(a, out, t + i * 0.14, f, f, 0.7, 0.13 * vol, "sine"));
      sweep(a, out, t, 0.5, 0.05 * vol, 800, 2400);
      break;
    }
    case "fagulha": // dois tons brilhantes ascendentes, curto (o braseiro pega)
      tone(a, out, t, 660, 680, 0.18, 0.09 * vol, "triangle");
      tone(a, out, t + 0.07, 990, 1010, 0.22, 0.08 * vol, "triangle");
      break;
    case "limpa": // câmara limpa: alívio curto (quinta ascendente, morno)
      tone(a, out, t, 330, 330, 0.5, 0.11 * vol, "sine");
      tone(a, out, t + 0.1, 494, 494, 0.6, 0.09 * vol, "sine"); // quinta acima
      sweep(a, out, t, 0.4, 0.04 * vol, 600, 1400);
      break;
    case "saidaAlcapao": // brasa grave e estalo seco (o alcapao, o caminho de sempre)
      tone(a, out, t, 82, 61, 0.55, 0.16 * vol, "triangle");
      sweep(a, out, t + 0.02, 0.12, 0.09 * vol, 2600, 900);
      break;
    case "saidaEstante": // folhear de paginas (ruido curto em leque) e um sino curto
      sweep(a, out, t, 0.18, 0.07 * vol, 3200, 5200);
      sweep(a, out, t + 0.11, 0.16, 0.06 * vol, 2800, 4600);
      tone(a, out, t + 0.26, 880, 880, 0.55, 0.08 * vol, "sine");
      tone(a, out, t + 0.26, 1318.5, 1318.5, 0.4, 0.04 * vol, "sine");
      break;
    case "saidaBancada": // tilintar de vidro: tres agudos rapidos e desiguais
      tone(a, out, t, 2093, 2093, 0.22, 0.05 * vol, "sine");
      tone(a, out, t + 0.08, 2637, 2637, 0.2, 0.045 * vol, "sine");
      tone(a, out, t + 0.17, 3136, 3136, 0.26, 0.04 * vol, "sine");
      break;
    case "derrota": // a fagulha apaga: terça menor descendo, fria, esmaecendo
      tone(a, out, t, 196, 130, 1.4, 0.18 * vol, "sine");
      tone(a, out, t + 0.08, 233, 155, 1.4, 0.12 * vol, "sine");
      sweep(a, out, t + 0.2, 1.0, 0.07 * vol, 1200, 200);
      break;
  }
}
