import { NextRequest } from "next/server";
import { proxyTokenIssuingCall } from "@/lib/auth-proxy";

export async function POST(req: NextRequest) {
  return proxyTokenIssuingCall("/admin/auth/login", await req.json());
}
