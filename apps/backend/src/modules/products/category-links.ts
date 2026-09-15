/**
 * The product's category links for a save that replaces them (product edit,
 * CSV import), keeping where the product already sits in each category.
 *
 * `ProductCategory.position` is the per-category order the storefront's
 * category listings and homepage category tabs follow. The save deletes and
 * recreates the links, and a recreated link used to fall back to the column
 * default 0 — so merely editing a product moved it to the front of every
 * category it was in.
 *
 * A category the product newly joins puts it last there. The exception is a
 * category nobody has arranged yet (every position still 0): 0 keeps it on
 * the same newest-first tiebreak as its neighbours.
 */
export function categoryLinks(
  categoryIds: number[],
  currentPosition: Map<number, number>,
  highestPositionInCategory: Map<number, number>,
): { categoryId: number; position: number }[] {
  return [...new Set(categoryIds)].map((categoryId) => {
    const kept = currentPosition.get(categoryId);
    if (kept !== undefined) return { categoryId, position: kept };
    const highest = highestPositionInCategory.get(categoryId) ?? 0;
    return { categoryId, position: highest > 0 ? highest + 1 : 0 };
  });
}
