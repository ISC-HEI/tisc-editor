import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Keycloak from 'next-auth/providers/keycloak';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

const ADMIN_GROUP = 'app-isc3-prod-tisc-admin';
const ISSUER = process.env.AUTH_KEYCLOAK_ISSUER!;

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const res = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AUTH_KEYCLOAK_ID!,
        client_secret: process.env.AUTH_KEYCLOAK_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw data;

    const userinfo = await fetch(`${ISSUER}/protocol/openid-connect/userinfo`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    }).then((r) => r.json());

    return {
      ...token,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      refreshToken: data.refresh_token ?? token.refreshToken,
      groups: userinfo.groups ?? [],
      error: undefined,
    };
  } catch {
    return { ...token, groups: [], error: 'RefreshTokenError' };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  pages: {
    signIn: '/login',
  },
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
      issuer: ISSUER,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account && user?.id) {
        return {
          ...token,
          id: user.id,
          groups: profile?.groups ?? [],
          accessToken: account.access_token!,
          refreshToken: account.refresh_token!,
          expiresAt: account.expires_at!,
        };
      }

      if (Date.now() < token.expiresAt * 1000 - 10_000) return token;

      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.groups = token.groups;
        session.user.isAdmin = token.groups?.includes(ADMIN_GROUP) ?? false;
      }
      session.error = token.error;
      return session;
    },
  },
});
