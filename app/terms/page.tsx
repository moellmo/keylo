export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Terms of Use
          </p>

          <h1 className="mt-3 text-5xl font-black tracking-tight">
            Terms of Use
          </h1>

          <div className="mt-8 space-y-6 leading-8 text-slate-600">
            <p>
              These Terms of Use are a Phase 1 placeholder and should be
              reviewed by legal counsel before public launch.
            </p>

            <p>
              Keylo provides tools for landlords to post rental listings and for
              tenants to browse listings and submit applications. Keylo does not
              guarantee listing accuracy, tenant approval, lease execution, or
              rental availability.
            </p>

            <p>
              Users are responsible for providing accurate information and
              complying with applicable housing, rental, privacy, and fair
              housing laws.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}