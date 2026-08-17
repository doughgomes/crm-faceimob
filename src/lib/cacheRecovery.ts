/**
 * Recuperação de cache persistente (tela preta).
 *
 * Alguns navegadores mantêm um Service Worker antigo registrado (de versões
 * anteriores do app / PWA) que continua servindo assets JS/CSS que não existem
 * mais no deploy atual — resultando em tela preta mesmo depois de "limpar o
 * cache" pelo navegador. Aqui removemos qualquer Service Worker e todos os
 * Cache Storage na inicialização, e forçamos um reload único quando algo foi
 * efetivamente removido ou quando a versão do build mudou.
 */

const VERSION_KEY = "faceimob-app-build";
const RELOAD_GUARD = "faceimob-cache-reload";

function hardReload() {
  // Evita loop: só recarrega uma vez por sessão de aba.
  if (sessionStorage.getItem(RELOAD_GUARD) === "1") return;
  sessionStorage.setItem(RELOAD_GUARD, "1");
  const url = new URL(window.location.href);
  url.searchParams.set("_v", Date.now().toString(36));
  window.location.replace(url.toString());
}

async function unregisterServiceWorkers(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (!regs.length) return false;
    await Promise.all(regs.map((r) => r.unregister()));
    return true;
  } catch {
    return false;
  }
}

async function clearCacheStorage(): Promise<boolean> {
  if (!("caches" in window)) return false;
  try {
    const keys = await caches.keys();
    if (!keys.length) return false;
    await Promise.all(keys.map((k) => caches.delete(k)));
    return true;
  } catch {
    return false;
  }
}

/** Limpeza total sob demanda: /?reset=1 ou botão de recuperação. */
export async function fullCacheReset() {
  await unregisterServiceWorkers();
  await clearCacheStorage();
  try {
    sessionStorage.removeItem(RELOAD_GUARD);
    localStorage.removeItem(VERSION_KEY);
  } catch {
    /* noop */
  }
  // Mantém a rota atual (links públicos de diretor/daily não podem cair na home).
  const url = new URL(window.location.href);
  url.searchParams.delete("reset");
  url.searchParams.set("_v", Date.now().toString(36));
  window.location.replace(url.toString());
}

export function initCacheRecovery() {
  if (typeof window === "undefined") return;

  // Rota de emergência: qualquer usuário pode abrir <app>/?reset=1
  if (new URLSearchParams(window.location.search).has("reset")) {
    void fullCacheReset();
    return;
  }

  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  void (async () => {
    const removedSw = isLocal ? false : await unregisterServiceWorkers();
    const removedCaches = isLocal ? false : await clearCacheStorage();

    let versionChanged = false;
    try {
      const current = document.querySelector<HTMLScriptElement>('script[src*="/assets/"]')?.src ?? "dev";
      const stored = localStorage.getItem(VERSION_KEY);
      if (stored && stored !== current) versionChanged = true;
      localStorage.setItem(VERSION_KEY, current);
    } catch {
      /* noop */
    }

    if (removedSw || removedCaches || versionChanged) hardReload();
  })();
}

/** Erros de chunk (assets antigos que não existem mais) → reset automático. */
export function initChunkErrorRecovery() {
  if (typeof window === "undefined") return;
  const isChunkError = (msg: string) =>
    /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk .* failed|error loading dynamically imported module/i.test(
      msg,
    );

  const handle = (msg: string) => {
    if (!isChunkError(msg)) return;
    if (sessionStorage.getItem("faceimob-chunk-reset") === "1") return;
    sessionStorage.setItem("faceimob-chunk-reset", "1");
    void fullCacheReset();
  };

  window.addEventListener("error", (e) => handle(String((e as ErrorEvent).message || "")));
  window.addEventListener("unhandledrejection", (e) =>
    handle(String((e as PromiseRejectionEvent).reason?.message ?? (e as PromiseRejectionEvent).reason ?? "")),
  );
}
