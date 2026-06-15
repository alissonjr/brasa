/**
 * CAMADA PLATAFORMA. Identidade do jogador (perfil local).
 *
 * Hoje: perfil local persistido no navegador. Futuro: conta remota com a mesma
 * interface. Não conhece o jogo.
 *
 * Persistência em localStorage de propósito (dado pequeno, lido no boot). Dados
 * grandes ficam no IndexedDB via SaveStore (ver save/saveStore.ts).
 */
export interface Profile {
  id: string;
  name: string;
  createdAt: number;
}

const KEY = "brasa.profile";

export class ProfileService {
  private profile: Profile;

  constructor() {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      this.profile = JSON.parse(raw) as Profile;
    } else {
      this.profile = { id: crypto.randomUUID(), name: "Jogador", createdAt: Date.now() };
      localStorage.setItem(KEY, JSON.stringify(this.profile));
    }
  }

  current(): Profile {
    return this.profile;
  }

  rename(name: string): void {
    this.profile = { ...this.profile, name };
    localStorage.setItem(KEY, JSON.stringify(this.profile));
  }
}
