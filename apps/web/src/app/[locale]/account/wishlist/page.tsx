import type { Metadata } from "next";
import { WishlistGrid } from "@/components/WishlistGrid";

export function generateMetadata(): Metadata {
  return { title: "My Wishlist" };
}

export default function AccountWishlistPage() {
  return <WishlistGrid />;
}
