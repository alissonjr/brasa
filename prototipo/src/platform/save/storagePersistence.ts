/**
 * CAMADA PLATAFORMA. Persistência do armazenamento do navegador.
 *
 * Por padrão o storage é "best-effort" (o navegador pode apagar sob pressão de disco,
 * e o Safari poda storage de script após ~7 dias sem interação). Pedir modo
 * persistente reduz esse risco. Mitigação completa inclui PWA + export/import de save
 * (ver docs/plataforma-roadmap.md seção 2). Requer origem segura (HTTPS/localhost).
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

/** Estimativa de uso/cota (valores podem ser "acolchoados" por privacidade). */
export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
}
