export type ReturnLine = {
  name: string;
  quantity: number;
  restock: number;
  writeOff: number;
};

/** Same rule as the server: null = OK, else the message to show. */
export function returnLinesError(
  lines: ReturnLine[],
  status: "RETURNED" | "PARTIALLY_RETURNED",
): string | null {
  for (const l of lines) {
    if (l.restock < 0 || l.writeOff < 0)
      return `${l.name}: numbers can't be negative`;
    if (l.restock + l.writeOff > l.quantity)
      return `${l.name}: more than ${l.quantity} returned`;
    if (status === "RETURNED" && l.restock + l.writeOff !== l.quantity)
      return `${l.name}: a full return must account for all ${l.quantity}`;
  }
  if (
    status === "PARTIALLY_RETURNED" &&
    lines.every((l) => l.restock + l.writeOff === 0)
  )
    return "Nothing came back: enter what was returned";
  return null;
}

export type ShelfWriteOff = {
  name: string;
  /** Already written off on this line. */
  prevOff: number;
  /** Units of this line back on the shelf now. */
  onShelf: number;
  /** Written off in total after this change. */
  writeOff: number;
};

/** Returned again while the stock is already back: only damage is entered. */
export function shelfWriteOffError(lines: ShelfWriteOff[]): string | null {
  for (const l of lines) {
    if (l.writeOff < l.prevOff)
      return `${l.name}: ${l.prevOff} already written off`;
    if (l.writeOff - l.prevOff > l.onShelf)
      return `${l.name}: only ${l.onShelf} back in stock to write off`;
  }
  return null;
}
