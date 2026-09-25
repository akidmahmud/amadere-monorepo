/**
 * Whether the current user may do a transfer step that belongs to `sideStoreId`
 * (dispatch = source, receive = destination). `myStoreId` is the store the
 * user is working at — for store staff that's their assigned store.
 */
export function canActFor(
  me: { allStores: boolean; myStoreId: number | undefined },
  sideStoreId: number,
): boolean {
  return (
    me.allStores || (me.myStoreId !== undefined && me.myStoreId === sideStoreId)
  );
}

/** Accounts expense form: pre-select the user's store's cost centre ("" = none). */
export function defaultCostCentre(
  myStoreId: number | null | undefined,
  stores: { id: number; costCentreId: number | null }[],
): string {
  const cc = stores.find((s) => s.id === myStoreId)?.costCentreId;
  return cc ? String(cc) : "";
}
