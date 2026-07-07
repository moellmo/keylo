import Link from "next/link";

export default function LandlordsPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="grid gap-10 md:grid-cols-[1.05fr_0.95fr] md:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              For Landlords
            </p>

            <h1 className="mt-4 max-w-4xl text-5xl font-black leading-tight tracking-tight md:text-7xl">
              List rentals, review tenants, and stay in control.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700 md:text-xl">
              Keylo helps landlords post rentals, collect tenant applications,
              and manage listing approvals from one simple dashboard.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/signup"
                className="rounded-full bg-slate-950 px-7 py-4 text-center text-base font-black text-white"
              >
                Create Landlord Account
              </Link>

              <Link
                href="/auth/login"
                className="rounded-full border border-slate-300 bg-white px-7 py-4 text-center text-base font-black text-slate-950"
              >
                Login
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-6 shadow-xl ring-1 ring-slate-200">
            <div className="rounded-[1.5rem] bg-slate-950 p-6 text-white">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
                Landlord Tools
              </p>

              <div className="mt-6 space-y-4">
                {[
                  "Post rental listings",
                  "Upload property photos",
                  "Submit listings for admin approval",
                  "Review tenant applications",
                  "Track listing status",
                  "Resubmit rejected listings",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl bg-white/10 p-5 font-black"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Phase 1
          </p>

          <h2 className="mt-3 text-4xl font-black tracking-tight">
            Built for a clean listing approval flow.
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                title: "Create",
                text: "Add the rental details, photos, rent, availability, and property description.",
              },
              {
                title: "Submit",
                text: "New listings can be sent to admin review before appearing publicly.",
              },
              {
                title: "Manage",
                text: "Track applications, update listings, preview rentals, and respond to admin feedback.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-slate-200 bg-[#f7f4ef] p-6"
              >
                <h3 className="text-2xl font-black">{item.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}