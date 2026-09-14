import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      groups: string[];
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
  }
}
