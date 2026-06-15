/**
 * CAMADA JOGO (Brasa). Catálogo de conquistas (nomes/descrições) e o mapa de qual
 * objetivo concluído desbloqueia qual conquista. O AchievementService (plataforma) só
 * guarda os ids desbloqueados; o significado mora aqui.
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "primeira-descida", name: "Primeira descida", description: "Entrou na sala-cripta." },
  { id: "primeira-luz", name: "Primeira luz", description: "Aproximou-se do braseiro central." },
  { id: "diante-da-brasa", name: "Diante da Brasa", description: "Alcançou o fundo da câmara." },
];

const BY_OBJECTIVE: Record<string, string> = {
  "entrar-cripta": "primeira-descida",
  "aproximar-braseiro": "primeira-luz",
  "alcancar-fundo": "diante-da-brasa",
};

export function achievementForObjective(objectiveId: string): Achievement | undefined {
  const id = BY_OBJECTIVE[objectiveId];
  return id ? ACHIEVEMENTS.find((a) => a.id === id) : undefined;
}

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
