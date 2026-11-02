/**
 * Medições de áudio em JS puro (sem dependências), para o teste de regressão do Brasa.
 * Entrada: Float32Array por canal. Saída: números em dBFS / LUFS / porcentagens.
 * Referências: ITU-R BS.1770-4 (LUFS, filtro K, gate -70/-10), Welch para o espectro.
 */

export const db = (x) => 20 * Math.log10(Math.max(x, 1e-12));
export const dbp = (p) => 10 * Math.log10(Math.max(p, 1e-24));

// --- biquad (forma direta II transposta) -------------------------------------------------
function biquad(x, b0, b1, b2, a1, a2) {
  const y = new Float64Array(x.length);
  let z1 = 0, z2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    const o = b0 * v + z1;
    z1 = b1 * v - a1 * o + z2;
    z2 = b2 * v - a2 * o;
    y[i] = o;
  }
  return y;
}

/** Filtro K (BS.1770): shelf de agudos + passa-altas de 38 Hz. */
export function kWeight(x, fs) {
  {
    const G = 3.999843853973347, Q = 0.7071752369554196, fc = 1681.9744509555319;
    const K = Math.tan((Math.PI * fc) / fs);
    const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
    const a0 = 1 + K / Q + K * K;
    x = biquad(x, (Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0);
  }
  {
    const Q = 0.5003270373253953, fc = 38.13547087613982;
    const K = Math.tan((Math.PI * fc) / fs);
    const a0 = 1 + K / Q + K * K;
    x = biquad(x, 1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0);
  }
  return x;
}

function butter2(x, fs, fc, type) {
  const K = Math.tan((Math.PI * fc) / fs), Q = Math.SQRT1_2, n = 1 / (1 + K / Q + K * K);
  const a1 = 2 * (K * K - 1) * n, a2 = (1 - K / Q + K * K) * n;
  if (type === "low") return biquad(x, K * K * n, 2 * K * K * n, K * K * n, a1, a2);
  return biquad(x, n, -2 * n, n, a1, a2);
}

/** Loudness: integrada (gate), momentânea máx (400 ms) e curto prazo máx (3 s). Em LUFS. */
export function loudness(chs, fs) {
  const w = chs.map((c) => kWeight(c, fs));
  const n = w[0].length;
  const blk = Math.round(0.4 * fs), hop = Math.round(0.1 * fs);
  const cum = w.map((c) => {
    const a = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) a[i + 1] = a[i] + c[i] * c[i];
    return a;
  });
  const energy = (i0, len) => {
    let z = 0;
    for (const a of cum) z += (a[Math.min(n, i0 + len)] - a[i0]) / len;
    return z;
  };
  const blocks = [];
  for (let i = 0; i + blk <= n; i += hop) blocks.push(energy(i, blk));
  const lk = (z) => -0.691 + dbp(z);
  const abs = blocks.filter((z) => lk(z) > -70);
  let integrated = -Infinity;
  if (abs.length) {
    const rel = lk(abs.reduce((s, z) => s + z, 0) / abs.length) - 10;
    const gated = abs.filter((z) => lk(z) > rel);
    if (gated.length) integrated = lk(gated.reduce((s, z) => s + z, 0) / gated.length);
  }
  const momentary = blocks.length ? lk(Math.max(...blocks)) : -Infinity;
  let shortTerm = -Infinity;
  const st = Math.round(3 * fs);
  if (n >= st) for (let i = 0; i + st <= n; i += hop) shortTerm = Math.max(shortTerm, lk(energy(i, st)));
  const lkb = blocks.map(lk).filter((v) => v > -70);
  return { integrated, momentary, shortTerm, momRange: lkb.length ? Math.max(...lkb) - Math.min(...lkb) : 0 };
}

// --- FFT ---------------------------------------------------------------------------------
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

/** PSD de Welch (potência por bin, janela de Hann). Retorna {freqs, psd, df}. */
export function welch(x, fs, nfft = 8192) {
  const win = new Float64Array(nfft);
  let wp = 0;
  for (let i = 0; i < nfft; i++) {
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / nfft);
    wp += win[i] * win[i];
  }
  const half = nfft / 2 + 1;
  const psd = new Float64Array(half);
  let cnt = 0;
  const re = new Float64Array(nfft), im = new Float64Array(nfft);
  for (let s = 0; s + nfft <= x.length; s += nfft / 2) {
    for (let i = 0; i < nfft; i++) {
      re[i] = x[s + i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < half; k++) psd[k] += (re[k] * re[k] + im[k] * im[k]) / wp;
    cnt++;
  }
  if (cnt) for (let k = 0; k < half; k++) psd[k] /= cnt * 1; // potência média por bin (soma = mean(x²) com fator 2 nos bins internos)
  const df = fs / nfft;
  return { psd, df, cnt };
}

export const BANDS = [
  ["<60", 0, 60],
  ["60-150", 60, 150],
  ["150-300", 150, 300],
  ["300-1k", 300, 1000],
  ["1k-3k", 1000, 3000],
  ["3k-8k", 3000, 8000],
  [">8k", 8000, 24000],
];

/** Energia por faixa (dB relativos ao total e fração em %). */
export function bandEnergy(x, fs) {
  const { psd, df, cnt } = welch(x, fs);
  if (!cnt) return { total: -Infinity, bands: {} };
  let total = 0;
  const bands = {};
  for (const [name] of BANDS) bands[name] = 0;
  for (let k = 1; k < psd.length - 1; k++) {
    const f = k * df;
    total += psd[k];
    for (const [name, lo, hi] of BANDS) if (f >= lo && f < hi) bands[name] += psd[k];
  }
  const out = {};
  for (const [name] of BANDS) out[name] = total > 0 ? (100 * bands[name]) / total : 0;
  return { total: dbp(total), pct: out };
}

/**
 * Modulação rápida (8 a 30 Hz) do envelope da banda 20-300 Hz, relativa à média: tremolo e
 * batimento rápido (acima de ~30 Hz o ouvido lê altura, não aspereza; abaixo de 8 Hz é só
 * respiração). Seno puro ~0; dois senos a 18 Hz de distância ~0,7. Informativa: o critério
 * de aprovação é beatPairs.
 */
export function roughness(x, fs) {
  let b = butter2(butter2(x, fs, 20, "high"), fs, 300, "low");
  b = butter2(b, fs, 300, "low");
  let rms = 0;
  for (let i = 0; i < b.length; i++) rms += b[i] * b[i];
  rms = Math.sqrt(rms / Math.max(1, b.length));
  const sq = new Float64Array(b.length);
  for (let i = 0; i < b.length; i++) sq[i] = 2 * b[i] * b[i];
  const e2 = butter2(butter2(sq, fs, 110, "low"), fs, 110, "low");
  const env = new Float64Array(e2.length);
  let mean = 0;
  for (let i = 0; i < env.length; i++) {
    env[i] = Math.sqrt(Math.max(0, e2[i]));
    mean += env[i];
  }
  mean /= Math.max(1, env.length);
  if (mean < 1e-7 || env.length < 40000) return { rough: 0, bandDb: db(rms) };
  for (let i = 0; i < env.length; i++) env[i] -= mean;
  const nfft = 32768;
  const { psd, df, cnt } = welch(env, fs, nfft);
  if (!cnt) return { rough: 0, bandDb: db(rms) };
  let p = 0;
  for (let k = 1; k < psd.length - 1; k++) {
    const f = k * df;
    if (f >= 8 && f <= 30) p += psd[k];
  }
  const varBand = (2 / nfft) * p; // variância do envelope na faixa 15-70 Hz
  return { rough: Math.sqrt(2 * varBand) / mean, bandDb: db(rms) };
}

/** Proeminência tonal (dB) de uma linha espectral estreita entre 20 e 300 Hz vs vizinhança. */
export function lowTonalProminence(x, fs) {
  const { psd, df, cnt } = welch(x, fs, 16384);
  if (!cnt) return { prominence: 0, atHz: 0 };
  const kLo = Math.ceil(20 / df), kHi = Math.floor(300 / df);
  const w = Math.round(25 / df); // vizinhança de ±25 Hz
  let best = 0, at = 0;
  for (let k = kLo; k <= kHi; k++) {
    const peak = Math.max(psd[k - 1], psd[k], psd[k + 1]);
    const nb = [];
    for (let j = Math.max(1, k - w); j <= Math.min(psd.length - 1, k + w); j++) if (Math.abs(j - k) > 3) nb.push(psd[j]);
    nb.sort((a, b) => a - b);
    const med = nb[Math.floor(nb.length / 2)] || 1e-24;
    const pr = dbp(peak) - dbp(med);
    if (pr > best) {
      best = pr;
      at = k * df;
    }
  }
  return { prominence: best, atHz: at };
}

/**
 * PARES EM BATIMENTO: em quadros de 0,34 s (sem sobreposição, resolução 2,9 Hz), picos
 * espectrais estreitos e proeminentes (>= 18 dB acima da mediana local de +-40 Hz) entre 20 e
 * 300 Hz, com os dois dentro de 20 dB um do outro e separados por 5 a 22 Hz: dois tons
 * sustentados quase iguais ao mesmo tempo, o "besouro". Linhas mais próximas fundem-se
 * (respiração lenta, inofensiva); acima de 22 Hz é intervalo musical. Quadros curtos evitam o
 * falso positivo de notas diferentes tocadas em tempos diferentes no mesmo espectro médio.
 * Retorna uma lista de {t, f1, f2, delta, prom}.
 */
export function beatPairs(x, fs) {
  const nfft = 16384;
  const win = new Float64Array(nfft);
  for (let i = 0; i < nfft; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / nfft);
  const df = fs / nfft;
  const kLo = Math.ceil(20 / df), kHi = Math.floor(300 / df), w = Math.round(40 / df);
  const re = new Float64Array(nfft), im = new Float64Array(nfft), psd = new Float64Array(nfft / 2 + 1);
  const found = [];
  let prevPeaks = [], prev2 = [];
  for (let s = 0; s + nfft <= x.length; s += nfft) {
    for (let i = 0; i < nfft; i++) {
      re[i] = x[s + i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < psd.length; k++) psd[k] = re[k] * re[k] + im[k] * im[k];
    const peaks = [];
    for (let k = kLo; k <= kHi; k++) {
      if (!(psd[k] > psd[k - 1] && psd[k] >= psd[k + 1])) continue;
      const nb = [];
      for (let j = Math.max(1, k - w); j <= Math.min(psd.length - 1, k + w); j++) nb.push(psd[j]);
      nb.sort((a, b) => a - b);
      const med = nb[Math.floor(nb.length / 2)] || 1e-24;
      const prom = dbp(psd[k]) - dbp(med);
      if (prom >= 18) peaks.push({ f: k * df, prom, level: dbp(psd[k]) });
    }
    // só conta linhas SUSTENTADAS (presentes nos 2 quadros anteriores, ~1 s): batidas de tambor e glissandos passam
    const near = (list, p) => list.some((q) => Math.abs(q.f - p.f) <= 1.5 * df);
    const sustained = peaks.filter((p) => near(prevPeaks, p) && near(prev2, p));
    for (let i = 0; i < sustained.length; i++)
      for (let j = i + 1; j < sustained.length; j++) {
        const d = Math.abs(sustained[j].f - sustained[i].f);
        if (d >= 5 && d <= 22 && Math.abs(sustained[i].level - sustained[j].level) <= 20)
          found.push({ t: +(s / fs).toFixed(2), f1: +sustained[i].f.toFixed(1), f2: +sustained[j].f.toFixed(1), delta: +d.toFixed(1), prom: +Math.min(sustained[i].prom, sustained[j].prom).toFixed(1) });
      }
    prev2 = prevPeaks;
    prevPeaks = peaks;
  }
  return found;
}

/** Resumo completo de um trecho estéreo. */
export function analyze(L, R, fs, t0 = 0, t1 = Infinity) {
  const i0 = Math.max(0, Math.floor(t0 * fs)), i1 = Math.min(L.length, Math.floor(t1 * fs));
  const l = L.subarray(i0, i1), r = R.subarray(i0, i1);
  const n = l.length;
  let peak = 0, sum = 0, clipped = 0, dc = 0;
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.abs(l[i]), b = Math.abs(r[i]);
    peak = Math.max(peak, a, b);
    sum += l[i] * l[i] + r[i] * r[i];
    if (a >= 0.999 || b >= 0.999) clipped++;
    dc += l[i] + r[i];
    mono[i] = 0.5 * (l[i] + r[i]);
  }
  const rms = Math.sqrt(sum / (2 * n));
  const ld = loudness([l, r], fs);
  const be = bandEnergy(mono, fs);
  const ro = roughness(mono, fs);
  const tp = lowTonalProminence(mono, fs);
  const bp = beatPairs(mono, fs);
  return {
    peakDb: db(peak),
    rmsDb: db(rms),
    crestDb: db(peak) - db(rms),
    clipped,
    dcPct: (100 * Math.abs(dc / (2 * n))) / Math.max(peak, 1e-9),
    lufsI: ld.integrated,
    lufsM: ld.momentary,
    lufsS: ld.shortTerm,
    momRange: ld.momRange,
    bands: be.pct,
    above150: 100 - be.pct["<60"] - be.pct["60-150"],
    rough: ro.rough,
    lowBandDb: ro.bandDb,
    tonalProm: tp.prominence,
    tonalAt: tp.atHz,
    beatPairs: bp.length,
    beatDetail: bp.slice(0, 3),
    beatFrames: new Set(bp.map((p) => p.t)).size,
  };
}

