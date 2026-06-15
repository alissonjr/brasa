/**
 * CAMADA JOGO (Brasa). Ambiente sonoro PROCEDURAL da tela-título (sem assets): um drone
 * quente e grave de brasa, com leve respiração (LFO no corte do filtro) e estalos
 * ocasionais de ember. Dá o "mood" de título que as franquias campeãs apoiam na música,
 * sem depender de um arquivo de áudio (coerente com uiSound.ts).
 *
 * Gated pelo volume de MÚSICA das opções (master x música), lido ao vivo. O AudioContext
 * nasce preguiçosamente e só toca após o primeiro gesto do usuário (política de autoplay),
 * então a tela-título fica muda até o primeiro hover/clique e então o ambiente entra.
 */

let ctx: AudioContext | null = null;
let getVolume: () => number = () => 0; // master x música; 0 até ser configurado

let master: GainNode | null = null;
let nodes: AudioNode[] = [];
let crackleTimer = 0;
let volTimer = 0;
let running = false;
let gestureHooked = false;

/** Liga o volume vivo (lido das opções). Chamado no boot do app. */
export function configureTitleAmbience(volume: () => number): void {
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

/** Resume o contexto no primeiro gesto (navegadores bloqueiam áudio antes disso). */
function hookGesture(): void {
  if (gestureHooked) return;
  gestureHooked = true;
  const kick = (): void => {
    if (running) void ctx?.resume();
  };
  for (const ev of ["pointerdown", "keydown"]) {
    window.addEventListener(ev, kick, { once: false, passive: true });
  }
}

function targetGain(): number {
  return 0.22 * Math.max(0, Math.min(1, getVolume()));
}

/** Inicia (ou retoma) o ambiente da tela-título. Idempotente. */
export function startTitleAmbience(): void {
  if (running) return;
  const a = audio();
  if (!a) return;
  running = true;
  hookGesture();

  const t = a.currentTime;
  master = a.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.linearRampToValueAtTime(targetGain(), t + 1.4); // fade-in suave
  master.connect(a.destination);

  // Filtro grave comum: deixa o drone "abafado" como brasa numa câmara de pedra.
  const lp = a.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(320, t);
  lp.Q.value = 0.7;
  lp.connect(master);

  // Respiração: LFO lento varia o corte do filtro (o fogo "pulsa").
  const lfo = a.createOscillator();
  const lfoGain = a.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 120;
  lfo.connect(lfoGain).connect(lp.frequency);
  lfo.start(t);

  // Drone: fundamentais graves levemente desafinadas (calor) + um pad médio baixo.
  const voices: Array<{ f: number; type: OscillatorType; g: number }> = [
    { f: 55, type: "sine", g: 0.6 },
    { f: 55 * 1.003, type: "sine", g: 0.5 },
    { f: 82.4, type: "triangle", g: 0.28 },
    { f: 164.8, type: "sine", g: 0.12 },
  ];
  for (const v of voices) {
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = v.type;
    osc.frequency.value = v.f;
    g.gain.value = v.g;
    osc.connect(g).connect(lp);
    osc.start(t);
    nodes.push(osc, g);
  }
  nodes.push(lp, lfo, lfoGain);

  scheduleCrackle();
  // Acompanha o slider de música ao vivo (e silencia em 0).
  volTimer = window.setInterval(() => {
    if (master && ctx) master.gain.setTargetAtTime(targetGain(), ctx.currentTime, 0.2);
  }, 400);
}

/** Estala um "ember" curto: ruído filtrado com envelope rápido. */
function crackle(): void {
  const a = ctx;
  if (!a || !master) return;
  const vol = getVolume();
  if (vol <= 0) return;
  const t = a.currentTime;
  const dur = 0.03 + Math.random() * 0.06;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1400 + Math.random() * 1800;
  bp.Q.value = 0.8;
  const g = a.createGain();
  g.gain.value = 0.06 * vol;
  src.connect(bp).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function scheduleCrackle(): void {
  const next = 700 + Math.random() * 2600; // estalos esparsos
  crackleTimer = window.setTimeout(() => {
    if (!running) return;
    crackle();
    scheduleCrackle();
  }, next);
}

/** Para o ambiente com fade-out e desmonta o grafo. Idempotente. */
export function stopTitleAmbience(): void {
  if (!running) return;
  running = false;
  window.clearTimeout(crackleTimer);
  window.clearInterval(volTimer);
  const a = ctx;
  if (a && master) {
    const t = a.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0.0001, t + 0.5);
  }
  const toStop = nodes;
  const oldMaster = master;
  nodes = [];
  master = null;
  // Desliga osciladores e libera o grafo após o fade.
  window.setTimeout(() => {
    for (const n of toStop) {
      const osc = n as OscillatorNode;
      if (typeof osc.stop === "function") {
        try {
          osc.stop();
        } catch {
          /* já parado */
        }
      }
      n.disconnect();
    }
    oldMaster?.disconnect();
  }, 560);
}
