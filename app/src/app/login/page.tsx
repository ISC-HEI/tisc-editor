import { signIn } from '@/lib/auth';

const ERROR_MESSAGES: Record<string, string> = {
  AccountDisabled:
    'Your account has been disabled. Please contact an administrator if you think this is a mistake.',
  AccessDenied: 'Access denied.',
};

const DEFAULT_ERROR = 'Something went wrong while signing in. Please try again.';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;

  async function login() {
    'use server';
    await signIn('keycloak', { redirectTo: callbackUrl || '/' });
  }

  if (!error) {
    return (
      <form action={login}>
        <p>Redirecting to sign in…</p>
        <button type="submit" id="sso-button">
          Sign in
        </button>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.getElementById('sso-button').click();`,
          }}
        />
      </form>
    );
  }

  const message = ERROR_MESSAGES[error] ?? DEFAULT_ERROR;

  return (
    <main className="mx-auto mt-24 max-w-md p-6 text-center">
      <h1 className="mb-4 text-2xl font-semibold">Sign in</h1>
      <p
        role="alert"
        className="mb-6 rounded border border-red-300 bg-red-50 p-3 text-red-700"
      >
        {message}
      </p>
      {error !== 'AccountDisabled' && (
        <form action={login}>
          <button type="submit" className="rounded border px-4 py-2">
            Try again
          </button>
        </form>
      )}
    </main>
  );
}