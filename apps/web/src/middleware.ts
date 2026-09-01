import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get("skynav_token")?.value;
  const role = request.cookies.get("skynav_role")?.value;

  // Protect Admin operations
  if (pathname.startsWith("/admin")) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Role check: Normal customers cannot access /admin
    if (role === "CUSTOMER") {
      return NextResponse.redirect(new URL("/customer", request.url));
    }
  }

  // Protect Customer portal
  if (pathname.startsWith("/customer")) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/customer/:path*"]
};
