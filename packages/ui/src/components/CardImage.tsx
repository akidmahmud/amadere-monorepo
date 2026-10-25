import Image from "next/image";
import { cn } from "../lib/cn";

/**
 * A product card's photo. With `cssImage` it is drawn as a CSS background
 * instead of an <img>: Google Images doesn't index CSS images, so a product
 * page's recommendation cards (Related, You may also like, Frequently bought
 * together) aren't filed under that page in image search — a search for
 * "aman rice" was showing Jober Chal and Isabgul photos labelled with the
 * Aman Rice page. Pass an already-sized URL then (no next/image loader runs).
 * role="img" + aria-label keep it readable to screen readers.
 */
export function CardImage({
  src,
  name,
  cssImage,
  className,
}: {
  src: string;
  name: string;
  cssImage?: boolean;
  className?: string;
}) {
  if (cssImage)
    return (
      <div
        role="img"
        aria-label={name}
        className={cn("absolute inset-0 bg-cover bg-center bg-no-repeat", className)}
        style={{ backgroundImage: `url("${src.replace(/"/g, "%22")}")` }}
      />
    );
  return (
    <Image
      src={src}
      alt={name}
      fill
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
      className={cn("object-cover", className)}
    />
  );
}
