export default function GlobalErrorPage({ error, reset }) {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold text-red-800 mb-4">Something went wrong</h1>
      <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded border">
        {error?.message || 'An unexpected error occurred.'}
      </pre>
      <button
        onClick={reset}
        className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Try again
      </button>
    </div>
  );
}
