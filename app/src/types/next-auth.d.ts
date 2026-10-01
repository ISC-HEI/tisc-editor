import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    error?: 'RefreshTokenError';
    user: {
      id: string;
      groups: string[];
      isAdmin: boolean;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    groups?: string[];
  }

  interface Profile {
    groups?: string[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    groups: string[];
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    error?: 'RefreshTokenError';
  }
}
