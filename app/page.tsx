import { Dashboard } from "@/components/dashboard/Dashboard";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Page() {
  const bucket = process.env.GCS_BUCKET;
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">sgl-jax dashboard</h1>
          {bucket ? (
            <p className="mt-1 text-sm text-[color:var(--color-fg-muted)]">
              Multi-host TPU CI results from <code>gs://{bucket}</code>
            </p>
          ) : (
            <p className="mt-1 text-sm text-[color:var(--color-fg-muted)]">
              Multi-host TPU CI results
            </p>
          )}
        </div>
        <ThemeToggle />
      </header>
      <div className="mt-8">
        <Dashboard />
      </div>
    </main>
  );
}
