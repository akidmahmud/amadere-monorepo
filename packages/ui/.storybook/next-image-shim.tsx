import { forwardRef } from "react";

// Storybook runs on Vite, not Next.js — there's no image-optimization route
// for next/image to call, and it errors outside a Next.js app. Aliased in
// main.ts to stand in for "next/image" here only; the real app always gets
// the genuine next/image. Covers just the props this package's components
// actually pass (fill/width/height/sizes/priority/style/onLoad/ref) — a
// plain <img> reproduces the same visual result in a story, which is all
// Storybook needs.
interface ShimImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
}

const Image = forwardRef<HTMLImageElement, ShimImageProps>(function Image(
  { src, alt, fill, width, height, className, style, onLoad },
  ref,
) {
  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      className={className}
      style={fill ? { position: "absolute", inset: 0, height: "100%", width: "100%", ...style } : style}
      onLoad={onLoad}
    />
  );
});

export default Image;
