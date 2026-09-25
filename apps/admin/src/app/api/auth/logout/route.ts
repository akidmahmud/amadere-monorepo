import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-cookies";
import { expireHostOnlyCookies } from "@/lib/cookie-expiry";

// Purely local — admin JWTs are stateless too; logging out just means
// dropping the cookies here.
export async function POST() {
  await clearAuthCookies();
  return expireHostOnlyCookies(NextResponse.json({ success: true }));
}
