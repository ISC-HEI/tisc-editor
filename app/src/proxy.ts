import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

/**
 * Middleware Configuration.
 * The 'matcher' array defines which routes the middleware should run on.
 * It is configured to protect all routes EXCEPT:
 * - API routes (/api)
 * - Static files (_next/static, _next/image)
 * - Metadata (favicon.ico)
 * - Public auth pages (login, signup)
 */
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|signup).*)"],
};