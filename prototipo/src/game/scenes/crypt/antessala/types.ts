import type { AbstractMesh, AssetContainer, Mesh, Scene, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import type { CryptCtx } from "../cryptRoom";
import type { Layout } from "../cryptLayouts";
import type { FloorTheme } from "../cryptTheme";
import type { AntessalaDef } from "../../../content/descida";
import type { StringKey } from "../../../ui/strings";
import type { Chama } from "../../../run/rota";
import type { FrascoTipo } from "../../../content/saveData";

/**
 * CAMADA JOGO (Brasa). Contratos entre a sala-cripta (`cryptRoom.ts`) e as peças da antessala
 * (`scenes/crypt/antessala/*`, docs/brasa/redesenho-da-descida.md 2.1). `cryptRoom` monta o casco
 * (piso, muros, caverna, luz, fusão estática) e entrega às peças um `AntessalaKit` com as
 * ferramentas internas da sala; cada peça devolve o que o jogo precisa para interagir com ela.
 */

/** Tipo de objeto interativo da antessala. */
export type InteracaoId = "braseiro" | "armario" | "estante" | "bancada" | "mural" | "porta";

/** Objeto com que a Acendedora interage (ícone + tecla, sem texto longo). O `main.ts` projeta o marcador e decide o gesto. */
export interface Interativo {
  id: InteracaoId;
  /** Ponto de interação no plano e raio de alcance em m. */
  x: number;
  z: number;
  radius: number;
  /** Altura do marcador sobre o objeto. */
  y: number;
  /** `interact` = [R] (segurar no braseiro, tocar no mural); `ember` = [E] (armário e ofício). */
  action: "interact" | "ember";
  /** Nome em `ds/icons`. */
  icon: string;
  /** Nome curto exibido perto do objeto. */
  name: StringKey;
}

/** Um clone do kit, posicionado pela sala (mesmos parâmetros de `placeProp` de `cryptRoom`). */
export interface PropOpts {
  x: number;
  z: number;
  y?: number;
  rotY?: number;
  scale?: number;
  /** Escala por eixo, multiplicada à uniforme (ex.: achatar a escada). */
  sv?: [number, number, number];
  collider?: boolean;
  cast?: boolean;
  /** Fora da fusão estática (aparece e some por banco ou por animação). */
  dyn?: boolean;
  bank?: number;
}

/** Uma chama do pool da sala (uma malha de instâncias): `ignite` 0 = apagada, 1 = acesa. */
export interface ChamaRef {
  ignite: number;
  pos: Vector3;
  scale: number;
}

/** Ferramentas internas da sala-cripta entregues às peças da antessala. */
export interface AntessalaKit {
  scene: Scene;
  ctx: CryptCtx;
  theme: FloorTheme;
  layout: Layout;
  def: AntessalaDef;
  /** Peças carregadas do kit (KayKit), por nome de arquivo sem extensão. */
  pieces: Record<string, AssetContainer>;
  root: TransformNode;
  halfX: number;
  halfZ: number;
  /** Sobe a malha para o `roomRoot` (descartada com a sala). */
  track<T extends AbstractMesh>(m: T): T;
  /** Clone único de uma peça do kit (entra na fusão estática, salvo `dyn`). */
  placeProp(name: string, o: PropOpts): TransformNode | null;
  /** Peça repetida em thin instance (1 draw call por tipo). */
  batch(name: string, o: { x: number; z: number; y?: number; rotY?: number; scale?: number; collider?: boolean }, cast?: boolean): void;
  /** Material liso (cor nos vértices) que entra na fusão estática da sala. */
  flatMaterial(name: string, hex: string): StandardMaterial;
  /** Colisor invisível (caixa) em (cx, cz) com largura w (x), profundidade d (z) e altura h. */
  collider(cx: number, cz: number, w: number, d: number, h: number): void;
  /** Chama emissiva do pool da sala (opcionalmente com luz pontual: contam no teto de luzes da cena). */
  flame(pos: Vector3, scale: number, lightIntensity: number, withLight: boolean): ChamaRef;
  /** Reserva um banco de peças que aparecem e somem (frascos): `bankSet` liga e desliga sem draw call extra. */
  bankReserve(): number;
  bankSet(id: number, visible: boolean): void;
  /** Poça de luz no chão, fundida na malha única de poças da sala. Devolve o índice para `poolAlpha`. */
  pool(x: number, z: number, r: number, color: string, alpha: number, mode: "torch" | "warm" | "cold" | "porta"): number;
  /** Opacidade viva (0..1 do alfa-base) de uma poça de modo `porta`. */
  poolGain(index: number, gain: number): void;
}

/** O que a antessala montada oferece ao jogo. */
export interface AntessalaHandle {
  interativos: Interativo[];
  /** Coreografia de luz 0..1 (chamada por `room.setBrazierLit`): braseiro, mural, ofício. */
  setLit(k: number): void;
  /** A chama do andar foi gasta em `chama` ("" = ainda no braseiro): acende a vela da Estante ou os pavios da Bancada. */
  setChama(chama: Chama): void;
  /** A porta de pedra abre (véu e poça de luz) ou fica fechada. */
  setPorta(open: boolean): void;
  /** Frascos nos 4 nichos do armário (gancho da fase R3): "" = nicho vazio. */
  setFrascos(tipos: (FrascoTipo | "")[]): void;
  /** Quadro a quadro (tremular das velas, brasas); `t` em s. */
  update(t: number): void;
  dispose(): void;
}

/** Atributos de uma peça entregue ao `index.ts` (cada arquivo devolve o seu pedaço). */
export interface Peca {
  interativos: Interativo[];
  setLit?(k: number): void;
  setChama?(chama: Chama): void;
  setPorta?(open: boolean): void;
  setFrascos?(tipos: (FrascoTipo | "")[]): void;
  update?(t: number): void;
  dispose?(): void;
}

export type { Mesh };
