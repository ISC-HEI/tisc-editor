import { signIn } from '@/lib/auth';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <form
      action={async () => {
        'use server';
        await signIn('keycloak', { redirectTo: callbackUrl || '/' });
      }}
    >
      <button type="submit" id="sso-button" style={{ display: 'none' }}>
        Se connecter
      </button>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.getElementById('sso-button').click();`,
        }}
      />
    </form>
  );
}
