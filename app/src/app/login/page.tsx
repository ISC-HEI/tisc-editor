import { signIn } from '@/lib/auth';

const ERRORS: Record<string, { title: string; message: string; code: string; retry: boolean }> = {
  AccountDisabled: {
    title: 'Account disabled',
    message:
      'Your account has been disabled. Please contact an administrator if you think this is a mistake.',
    code: 'account disabled',
    retry: false,
  },
  AccessDenied: {
    title: 'Access denied',
    message: 'You do not have permission to sign in.',
    code: 'access denied',
    retry: true,
  },
};

const DEFAULT_ERROR = {
  title: 'Sign-in failed',
  message: 'Something went wrong while signing in. Please try again.',
  code: 'sign-in failed',
  retry: true,
};

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

  // No error: auto-redirect to Keycloak
  if (!error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <form action={login} className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          <p className="mt-4 text-sm text-slate-500">Redirecting to sign in…</p>
          {/* Fallback if JavaScript is disabled */}
          <button
            type="submit"
            id="sso-button"
            className="mt-6 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Sign in
          </button>
          <script
            dangerouslySetInnerHTML={{
              __html: `document.getElementById('sso-button').click();`,
            }}
          />
        </form>
      </main>
    );
  }

  const { title, message, code, retry } = ERRORS[error] ?? DEFAULT_ERROR;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-lg text-center">
        <p className="font-mono text-sm tracking-widest text-slate-400">AUTH</p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>

        <p role="alert" className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">
          {message}
        </p>

        <div className="mx-auto mt-8 max-w-xs rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left font-mono text-xs shadow-sm">
          <div className="flex gap-2">
            <span className="select-none text-slate-300">1</span>
            <span>
              <span className="text-violet-500">#error</span>
              <span className="text-slate-400">:</span>{' '}
              <span className="text-slate-600">{code}</span>
            </span>
          </div>
        </div>

        {retry && (
          <form action={login}>
            <button
              type="submit"
              className="mt-8 inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Try again
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
