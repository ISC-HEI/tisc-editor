import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafafa] px-6">
      <div className="w-full max-w-lg text-center">
        {/* 404 */}
        <p className="font-mono text-sm tracking-widest text-neutral-400">404</p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">
          Document not found
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-neutral-500">
          This page does not exist or has been moved. Please check the URL or return to the editor.
        </p>

        <div className="mx-auto mt-8 max-w-xs rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left font-mono text-xs shadow-sm">
          <div className="flex gap-2">
            <span className="select-none text-neutral-300">1</span>
            <span>
              <span className="text-violet-500">#error</span>
              <span className="text-neutral-400">:</span>{' '}
              <span className="text-neutral-600">page not found</span>
            </span>
          </div>
        </div>

        <Link
          href="/"
          className="mt-8 inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
        >
          Go back to the editor
        </Link>
      </div>
    </main>
  );
}
