import type { Metadata } from "next";
import { MyReviewsList } from "@/components/MyReviewsList";

export function generateMetadata(): Metadata {
  return { title: "My Reviews" };
}

export default function AccountReviewsPage() {
  return <MyReviewsList />;
}
