const store = globalThis.__tpvCatalogEvents ?? {
  listeners: new Set(),
};

globalThis.__tpvCatalogEvents = store;

export function subscribeToCatalogChanges(listener) {
  store.listeners.add(listener);

  return () => {
    store.listeners.delete(listener);
  };
}

export function notifyCatalogChanged(payload = {}) {
  store.listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch {
      // Keep one broken client from interrupting other realtime subscribers.
    }
  });
}
