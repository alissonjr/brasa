/**
 * CAMADA PLATAFORMA. Opções/configurações (áudio, idioma, etc.), persistidas.
 *
 * Genérico e independente do jogo. Cresce com controles (remapeamento) e
 * acessibilidade conforme os specs (ver docs/spec-ui-hud-ux.md).
 *
 * Persistência em localStorage de propósito: é um punhado de campos pequenos,
 * lidos no boot de forma síncrona. Dados grandes/estruturados (save) ficam no
 * IndexedDB via SaveStore (ver save/saveStore.ts).
 */
export type Quality = "baixo" | "medio" | "alto";
export type DialogueSpeed = "lento" | "normal" | "rapido" | "instantaneo";

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  language: "pt" | "en";
  uiScale: number; // escala da interface (1 = 100%)
  reducedMotion: boolean; // reduz animações/transições (acessibilidade vestibular)
  highContrast: boolean; // reforça contraste de texto/painéis
  quality: Quality; // qualidade gráfica (resolução de render + sombras)
  dialogueSpeed: DialogueSpeed; // velocidade do typewriter da caixa de diálogo
  /** Remapeamento de controles: ação -> lista de KeyboardEvent.code. Vazio = padrão da engine. */
  keyBindings: Record<string, string[]>;
}

const KEY = "brasa.settings";

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const DEFAULTS: Settings = {
  masterVolume: 1,
  musicVolume: 0.8,
  sfxVolume: 1,
  language: "pt",
  uiScale: 1,
  reducedMotion: prefersReducedMotion(), // respeita a preferência do SO por padrão
  highContrast: false,
  quality: "alto",
  dialogueSpeed: "normal",
  keyBindings: {}, // vazio = usa o DEFAULT_BINDINGS da engine
};

export class SettingsService {
  private settings: Settings;

  constructor() {
    const raw = localStorage.getItem(KEY);
    this.settings = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  }

  /** Cópia (para o chamador não mutar o estado interno sem persistir via set). */
  get(): Settings {
    return { ...this.settings };
  }

  set(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    localStorage.setItem(KEY, JSON.stringify(this.settings));
  }
}
