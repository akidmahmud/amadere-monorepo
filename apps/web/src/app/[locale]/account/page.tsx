import type { Metadata } from "next";
import { ProfileForm } from "@/components/ProfileForm";

export function generateMetadata(): Metadata {
  return { title: "My Profile" };
}

export default function AccountProfilePage() {
  return <ProfileForm />;
}
