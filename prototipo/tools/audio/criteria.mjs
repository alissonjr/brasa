/**
 * Critérios de aprovação do áudio (espelham docs/brasa/biblia-audio.md, seção Mixagem).
 * Os limiares foram fixados depois da primeira bateria de medições; mexer neles exige
 * atualizar a bíblia.
 */
export const CRITERIA = {
  /** pico máximo de qualquer render (barramento tem teto em -3,2 dBFS) */
  picoMaxDb: -3.0,
  /** nenhuma amostra em clipping */
  clipMax: 0,
  /** camadas contínuas (ambiência/música): pares em batimento 20-300 Hz */
  paresMax: 0,
  /** ambiência: loudness integrada (LUFS aprox.) por andar */
  ambLufsI: [-34, -28],
  /** música (cada estado): loudness integrada */
  musLufsI: [-28, -20],
  /** efeitos: momentânea máxima (400 ms) */
  sfxLufsM: [-34, -12],
  /** música tem de ficar abaixo dos efeitos no jogo (dB mínimos de folga entre SFX momentâneo médio e música) */
  folgaSfxMusicaDb: 3,
  /** ambiência: variação do nível momentâneo (dB, max-min) sem sustos */
  ambAmplitudeMaxDb: 14,
  /** fontes vivas ao descer: o último andar não pode ter mais que o primeiro + folga */
  vazamentoFolga: 6,
  /** mix de jogo: loudness integrada alvo */
  mixLufsI: [-24, -14],
};

const lo = (r) => r[0], hi = (r) => r[1];

export function evaluate(rep) {
  const out = [];
  const ok = (caso, regra, cond, detalhe) => out.push({ caso, regra, ok: !!cond, detalhe });
  for (const [name, c] of Object.entries(rep.cases)) {
    const w = c.whole;
    ok(name, "pico <= -3 dBFS", w.peakDb <= CRITERIA.picoMaxDb, `${w.peakDb.toFixed(1)} dBFS`);
    ok(name, "sem clipping", w.clipped <= CRITERIA.clipMax, `${w.clipped} amostras`);
    if (c.kind === "ambiencia") {
      const s = c.segs.frio ?? w;
      ok(name, "sem pares em batimento", s.beatFrames <= CRITERIA.paresMax, `${s.beatFrames} quadros ${JSON.stringify(s.beatDetail)}`);
      ok(name, "loudness integrada (frio)", s.lufsI >= lo(CRITERIA.ambLufsI) && s.lufsI <= hi(CRITERIA.ambLufsI), `${s.lufsI.toFixed(1)} LUFS`);
      ok(name, "sem sustos de nível", s.momRange <= CRITERIA.ambAmplitudeMaxDb, `${s.momRange.toFixed(1)} dB`);
    }
    if (c.kind === "musica") {
      for (const [seg, s] of Object.entries(c.segs)) {
        ok(`${name}/${seg}`, "sem pares em batimento", s.beatFrames <= CRITERIA.paresMax, `${s.beatFrames} quadros ${JSON.stringify(s.beatDetail)}`);
        ok(`${name}/${seg}`, "loudness integrada", s.lufsI >= lo(CRITERIA.musLufsI) && s.lufsI <= hi(CRITERIA.musLufsI), `${s.lufsI.toFixed(1)} LUFS`);
      }
    }
    if (c.kind === "sfx" && !name.startsWith("stingers")) {
      ok(name, "momentânea na faixa", w.lufsM >= lo(CRITERIA.sfxLufsM) && w.lufsM <= hi(CRITERIA.sfxLufsM), `${w.lufsM.toFixed(1)} LUFS-M`);
    }
    if (name === "descida_7_andares") {
      const p = c.probes;
      const first = p.find((x) => x.label === "andar1")?.alive ?? 0;
      const last = p.find((x) => x.label === "andar6")?.alive ?? 0;
      ok(name, "sem vazamento de fontes", last <= first + CRITERIA.vazamentoFolga, `vivas andar2=${first} andar7=${last}`);
      const end = p.find((x) => x.label === "parado")?.alive ?? 99;
      ok(name, "tudo solto ao parar", end <= 2, `${end} vivas após stop`);
    }
    if (name === "mix_jogo_andar2") {
      ok(name, "loudness integrada do mix", w.lufsI >= lo(CRITERIA.mixLufsI) && w.lufsI <= hi(CRITERIA.mixLufsI), `${w.lufsI.toFixed(1)} LUFS`);
    }
  }
  return out;
}
