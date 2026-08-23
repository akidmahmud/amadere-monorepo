import type { Metadata } from "next";
import { DownloadsList } from "@/components/DownloadsList";

export function generateMetadata(): Metadata {
  return { title: "My Downloads" };
}

export default function AccountDownloadsPage() {
  return <DownloadsList />;
}
