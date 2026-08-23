import { useQuery } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

// GET /customers/me/downloads returns Prisma rows directly (no response DTO
// on DownloadsService.listForCustomer), so openapi-typescript resolves it to
// `Record<string, never>[]` and the generated schema is of no use here. The
// shape is declared by hand instead — keep it in step with that method's
// `select`, which deliberately never includes Product.digitalFileKey: the R2
// bucket is public, so that key alone would be a permanent unauthenticated
// download URL for a paid file.
export interface DigitalDownloadItem {
  id: number;
  orderId: number;
  /** The only credential the download endpoint needs — it works without a
   *  session so the emailed link opens for a buyer who never signs in. */
  token: string;
  downloadCount: number;
  lastDownloadAt: string | null;
  unlockedAt: string | null;
  createdAt: string;
  product: {
    id: number;
    slug: string;
    digitalFileName: string | null;
    digitalFileSize: number | null;
    digitalPageCount: number | null;
    translations: { locale: "EN" | "BN"; name: string }[];
    media: { media: { url: string } }[];
  };
}

const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// A direct backend link, not a /api/backend proxy path: the proxy parses
// every response as JSON, which would destroy a PDF stream. The endpoint is
// token-gated rather than session-gated precisely so a plain link works.
export function downloadUrl(token: string): string {
  return `${backendBaseUrl}/api/v1/downloads/${token}`;
}

export function useDownloads() {
  return useQuery({
    queryKey: ["my-downloads"],
    queryFn: () => proxyFetch<DigitalDownloadItem[]>("/customers/me/downloads"),
  });
}
