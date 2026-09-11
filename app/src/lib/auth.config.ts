import type { NextAuthConfig } from 'next-auth';

/**
 * NextAuth shared configuration.
 * Primarily used by the Middleware to handle route protection and redirects.
 */
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isApiRoute = nextUrl.pathname.startsWith('/api');
      const isAuthPage = nextUrl.pathname.startsWith('/login');

      if (!isAuthPage && !isApiRoute && !isLoggedIn) {
        return false;
      }

      if (isLoggedIn && isAuthPage) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
