import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Contact
          </p>

          <h1 className="mt-3 text-5xl font-black tracking-tight">
            Contact Keylo
          </h1>

          <p className="mt-5 text-lg leading-8 text-slate-600">
            Have a question about listings, applications, landlord tools, or
            your account? Contact the Keylo team.
          </p>

          <div className="mt-8 rounded-3xl bg-[#f7f4ef] p-6">
            <p className="font-black">Email</p>
            <p className="mt-2 text-slate-600">support@keylo.com</p>
          </div>

          <Link
            href="/"
            className="mt-8 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}