export function applyPendingNotificationsToTables(tables, notifications) {
  const pendingByTable = new Map(
    (notifications?.tables ?? []).map((table) => [
      Number(table.tableNumber),
      Number(table.pendingOrders ?? 0),
    ]),
  );

  return tables.map((table) => {
    const pendingOrders = pendingByTable.get(Number(table.number)) ?? 0;

    return {
      ...table,
      hasPendingOrders: pendingOrders > 0,
      pendingOrders,
    };
  });
}

export function subscribeToPendingOrderNotifications(onUpdate, onError) {
  if (typeof window === "undefined") return () => {};

  const eventSource = new EventSource("/api/orders/notifications");

  eventSource.addEventListener("pending-orders", (event) => {
    onUpdate(JSON.parse(event.data));
  });

  eventSource.addEventListener("error", () => {
    onError?.();
  });

  return () => eventSource.close();
}
