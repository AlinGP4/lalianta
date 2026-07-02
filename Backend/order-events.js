const store = globalThis.__tpvOrderEvents ?? {
  listeners: new Set(),
};

globalThis.__tpvOrderEvents = store;

export function subscribeToOrderChanges(listener) {
  store.listeners.add(listener);

  return () => {
    store.listeners.delete(listener);
  };
}

export function notifyOrderChanged(payload = {}) {
  store.listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch {
      // Keep one broken client from interrupting other realtime subscribers.
    }
  });
}
