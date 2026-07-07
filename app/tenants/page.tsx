import Link from "next/link";

export default function TenantsPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="grid gap-10 md:grid-cols-[1.05fr_0.95fr] md:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              For Tenants
            </p>

            <h1 className="mt-4 max-w-4xl text-5xl font-black leading-tight tracking-tight md:text-7xl">
              Search rentals, save favorites, and apply online.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700 md:text-xl">
              Keylo helps tenants browse rental listings, save homes they like,
              apply online, and track application status from one dashboard.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/listings"
                className="rounded-full bg-slate-950 px-7 py-4 text-center text-base font-black text-white"
              >
                Browse Rentals
              </Link>

              <Link
                href="/auth/signup"
                className="rounded-full border border-slate-300 bg-white px-7 py-4 text-center text-base font-black text-slate-950"
              >
                Create Tenant Account
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-6 shadow-xl ring-1 ring-slate-200">
            <div className="rounded-[1.5rem] bg-slate-950 p-6 text-white">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
                Tenant Tools
              </p>

              <div className="mt-6 space-y-4">
                {[
                  "Browse published rentals",
                  "Search by city, rent, and beds",
                  "Save listings",
                  "Apply online",
                  "Track application status",
                  "Manage your rental profile",
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
            A cleaner way to apply.
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                title: "Find",
                text: "Browse available rentals and filter by location, max rent, and bedrooms.",
              },
              {
                title: "Save",
                text: "Keep track of rentals you like inside your tenant dashboard.",
              },
              {
                title: "Apply",
                text: "Submit your application online and check the status anytime.",
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