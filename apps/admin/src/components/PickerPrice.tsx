// Right-aligned price for the product relation pickers (Related, Cross-sell,
// Frequently Bought Together). Picking a bundle partner from names alone is
// guesswork — the price is the thing that decides whether a pairing makes
// sense — so every one of those lists shows it.
//
// Sale price wins when set, with the original struck through beside it, so a
// discounted item is not mistaken for a cheap one.
//
// Callers must give the name span `min-w-0 flex-1 truncate`: without min-w-0 a
// flex item will not shrink below its content width, so a long product name
// pushes this price clean out of the row instead of being ellipsised.
export function PickerPrice({
  price,
  salePrice,
}: {
  price?: string | null;
  salePrice?: string | null;
}) {
  // Products with no priced variant yet render nothing rather than "৳null".
  if (!price && !salePrice) return null;
  const onSale = !!salePrice && salePrice !== price;
  return (
    <span className="ml-auto shrink-0 pl-2 text-[0.72rem] font-bold tabular-nums text-secondary">
      {onSale && price ? (
        <>
          <span className="mr-1 font-normal text-muted line-through">৳{price}</span>
          <span className="text-text">৳{salePrice}</span>
        </>
      ) : (
        <span className="text-text">৳{salePrice ?? price}</span>
      )}
    </span>
  );
}
