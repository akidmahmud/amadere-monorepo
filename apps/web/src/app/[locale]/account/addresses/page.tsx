import type { Metadata } from "next";
import { AddressesManager } from "@/components/AddressesManager";

export function generateMetadata(): Metadata {
  return { title: "My Addresses" };
}

export default function AccountAddressesPage() {
  return <AddressesManager />;
}
