import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-cookies";

// Purely local — the backend has no session/token-revocation to call (JWTs
// are stateless); logging out just means dropping the cookies here.
export async function POST() {
  await clearAuthCookies();
  return NextResponse.json({ success: true });
}
