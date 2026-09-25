'use server';

import { signOut } from '@/lib/auth';
import { redirect } from 'next/navigation';

/**
 * Signs the current user out locally, then redirects them to the Keycloak
 * end-session endpoint to fully log out.
 */
export async function handleSignOut() {
  const issuer = process.env.AUTH_KEYCLOAK_ISSUER;
  const postLogoutRedirectUri = process.env.AUTH_URL ?? 'http://localhost:3000';

  await signOut({ redirect: false });

  const logoutUrl = `${issuer}/protocol/openid-connect/logout?post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}&client_id=${process.env.AUTH_KEYCLOAK_ID}`;

  redirect(logoutUrl);
}
