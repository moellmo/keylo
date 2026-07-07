export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Privacy Policy
          </p>

          <h1 className="mt-3 text-5xl font-black tracking-tight">
            Privacy Policy
          </h1>

          <div className="mt-8 space-y-6 leading-8 text-slate-600">
            <p>
              This Privacy Policy is a Phase 1 placeholder and should be
              reviewed by legal counsel before public launch.
            </p>

            <p>
              Keylo may collect account information, profile information,
              listing information, saved listing activity, and application
              information submitted by users.
            </p>

            <p>
              Tenant application information may be shared with the landlord
              associated with the listing the tenant applied to.
            </p>

            <p>
              Users should not submit sensitive documents or financial records
              unless Keylo has added secure document handling in a later phase.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}