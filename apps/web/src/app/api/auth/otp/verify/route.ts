import { NextRequest } from "next/server";
import { proxyTokenIssuingCall } from "@/lib/auth-proxy";

export async function POST(req: NextRequest) {
  return proxyTokenIssuingCall("/auth/otp/verify", await req.json());
}
