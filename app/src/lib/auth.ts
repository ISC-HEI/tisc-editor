import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Keycloak from 'next-auth/providers/keycloak';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

const ADMIN_ROLE = 'admin';
const ISSUER = process.env.AUTH_KEYCLOAK_ISSUER!;
const CLIENT_ID = process.env.AUTH_KEYCLOAK_ID!;

function getClientRoles(accessToken?: string): string[] {
  if (!accessToken) return [];
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'),
    );
    return payload.resource_access?.[CLIENT_ID]?.roles ?? [];
  } catch {
    return [];
  }
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const res = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: process.env.AUTH_KEYCLOAK_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw data;

    return {
      ...token,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      refreshToken: data.refresh_token ?? token.refreshToken,
      roles: getClientRoles(data.access_token),
      error: undefined,
    };
  } catch {
    return { ...token, roles: [], error: 'RefreshTokenError' };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  pages: { signIn: '/login' },
  providers: [
    Keycloak({
      clientId: CLIENT_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
      issuer: ISSUER,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account && user?.id) {
        return {
          ...token,
          id: user.id,
          roles: getClientRoles(account.access_token),
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
        session.user.roles = token.roles ?? [];
        session.user.isAdmin = token.roles?.includes(ADMIN_ROLE) ?? false;
      }
      session.error = token.error;
      return session;
    },
    async signIn({ user }) {
      if (!user.email) return false;

      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { disabled: true },
      });

      if (dbUser?.disabled) {
        return '/login?error=AccountDisabled';
      }
      return true;
    },
  },
});
