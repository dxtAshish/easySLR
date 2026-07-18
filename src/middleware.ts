import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/server/auth/edge-config";

// Uses the edge-safe config directly (not `@/server/auth`) so the Node-only
// Credentials provider (bcrypt + Prisma) never gets bundled for the Edge
// runtime that middleware.ts runs on.
const { auth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = ["/dashboard", "/org"];

export default auth((req) => {
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    req.nextUrl.pathname.startsWith(prefix),
  );
  if (isProtected && !req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/org/:path*"],
};
