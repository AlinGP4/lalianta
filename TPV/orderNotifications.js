export function applyPendingNotificationsToTables(tables, notifications) {
  const tableByNumber = new Map(tables.map((table) => [Number(table.number), table]));
  const pendingByTable = new Map(
    (notifications?.tables ?? []).map((table) => [
      Number(table.tableNumber),
      Number(table.pendingOrders ?? 0),
    ]),
  );
  const paymentRequestByTable = new Map(
    (notifications?.paymentRequests ?? []).map((request) => [
      Number(request.tableNumber),
      request,
    ]),
  );
  const waiterCallByTable = new Map(
    (notifications?.waiterCalls ?? []).map((call) => [
      Number(call.tableNumber),
      call,
    ]),
  );
  const hasWaiterCallsSnapshot = Array.isArray(notifications?.waiterCalls);

  pendingByTable.forEach((_, tableNumber) => {
    if (!tableByNumber.has(tableNumber)) {
      tableByNumber.set(tableNumber, {
        id: `notification-${tableNumber}`,
        number: tableNumber,
        name: `Mesa ${tableNumber}`,
        active: false,
      });
    }
  });

  waiterCallByTable.forEach((_, tableNumber) => {
    if (!tableByNumber.has(tableNumber)) {
      tableByNumber.set(tableNumber, {
        id: `waiter-call-${tableNumber}`,
        number: tableNumber,
        name: `Mesa ${tableNumber}`,
        active: false,
      });
    }
  });

  return Array.from(tableByNumber.values()).map((table) => {
    const pendingOrders = pendingByTable.get(Number(table.number)) ?? 0;
    const paymentRequest = paymentRequestByTable.get(Number(table.number)) ?? null;
    const waiterCall = waiterCallByTable.get(Number(table.number)) ?? null;

    return {
      ...table,
      hasPendingOrders: pendingOrders > 0,
      hasWaiterCall: hasWaiterCallsSnapshot ? Boolean(waiterCall) : Boolean(table.hasWaiterCall),
      pendingOrders,
      paymentRequest,
      waiterCall: hasWaiterCallsSnapshot ? waiterCall : table.waiterCall ?? null,
    };
  }).sort((first, second) => Number(first.number) - Number(second.number));
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
