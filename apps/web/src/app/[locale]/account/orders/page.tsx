import type { Metadata } from "next";
import { OrdersList } from "@/components/OrdersList";

export function generateMetadata(): Metadata {
  return { title: "My Orders" };
}

export default function AccountOrdersPage() {
  return <OrdersList />;
}
