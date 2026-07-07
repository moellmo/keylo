export default function FairHousingPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Fair Housing
          </p>

          <h1 className="mt-3 text-5xl font-black tracking-tight">
            Fair Housing Statement
          </h1>

          <div className="mt-8 space-y-6 leading-8 text-slate-600">
            <p>
              Keylo supports equal housing opportunity and expects landlords,
              tenants, and all users to follow applicable fair housing laws.
            </p>

            <p>
              Landlords should not discriminate based on protected classes under
              federal, state, or local law.
            </p>

            <p>
              This page is a Phase 1 placeholder and should be reviewed by legal
              counsel before public launch.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}