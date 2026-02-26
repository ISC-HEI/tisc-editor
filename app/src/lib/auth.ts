import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from 'bcrypt';

/**
 * Main NextAuth configuration and initialization.
 * This file handles the database adapter, credential validation, 
 * and session augmentation (JWT/Session callbacks).
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
            return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: String(credentials.email) }
          })
          
          if (user && user.password) {
            const passwordsMatch = await bcrypt.compare(
              String(credentials.password), 
              user.password
            );

            if (passwordsMatch) {
              return {
                id: user.id.toString(),
                email: user.email,
              };
            }
          }
          console.log("Invalid credentials");
          return null
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({token, user}) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({session, token}) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
    authorized({auth, request: { nextUrl }}) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = !nextUrl.pathname.startsWith("/login")

      if (isOnDashboard) {
        if (isLoggedIn) return true
        return false
      }
      return true
    }
  }
})