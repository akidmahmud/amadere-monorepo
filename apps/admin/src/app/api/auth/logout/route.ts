import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-cookies";

// Purely local — admin JWTs are stateless too; logging out just means
// dropping the cookies here.
export async function POST() {
  await clearAuthCookies();
  return NextResponse.json({ success: true });
}
