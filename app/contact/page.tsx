"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setSuccessMessage("");
    setErrorMessage("");

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (!cleanName || !cleanEmail || !cleanSubject || !cleanMessage) {
      setErrorMessage("Please fill out your name, email, subject, and message.");
      setSaving(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("contact_messages").insert({
      user_id: user?.id || null,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone || null,
      subject: cleanSubject,
      message: cleanMessage,
      status: "new",
    });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setName("");
    setEmail("");
    setPhone("");
    setSubject("");
    setMessage("");
    setSuccessMessage(
      "Thanks — your message was sent to the Keylo admin team."
    );
    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-16">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Contact
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Contact Keylo
            </h1>

            <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Have a question about listings, applications, landlord tools,
              tenant tools, payments, maintenance, or your account? Send a
              message to the Keylo admin team.
            </p>

            {successMessage && (
              <div className="mt-6 rounded-2xl bg-green-50 px-5 py-4 font-bold text-green-700 ring-1 ring-green-200">
                {successMessage}
              </div>
            )}

            {errorMessage && (
              <div className="mt-6 rounded-2xl bg-red-50 px-5 py-4 font-bold text-red-700 ring-1 ring-red-200">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">
                    Name *
                  </span>

                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    required
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-slate-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">
                    Email *
                  </span>

                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    type="email"
                    required
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-slate-500"
                  />
                </label>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">
                    Phone
                  </span>

                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-slate-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">
                    Subject *
                  </span>

                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="How can we help?"
                    required
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-slate-500"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">
                  Message *
                </span>

                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write your message here..."
                  required
                  rows={7}
                  className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 font-bold leading-7 outline-none focus:border-slate-500"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-slate-950 px-6 py-4 text-center font-black text-white disabled:opacity-60"
                >
                  {saving ? "Sending..." : "Send Message"}
                </button>

                <Link
                  href="/"
                  className="rounded-full border border-slate-300 bg-white px-6 py-4 text-center font-black text-slate-950"
                >
                  Back to Home
                </Link>
              </div>
            </form>
          </div>

          <aside className="grid gap-5">
            <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Support
              </p>

              <h2 className="mt-3 text-2xl font-black">Admin Message</h2>

              <p className="mt-3 leading-7 text-slate-600">
                Messages sent here are saved for the Keylo admin team to review.
              </p>
            </div>

            <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <p className="font-black">Email</p>
              <p className="mt-2 text-slate-600">support@keylo.com</p>
            </div>

            <div className="rounded-[2rem] bg-[#07101f] p-6 text-white shadow-sm">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#f5c76a]">
                Need help faster?
              </p>

              <p className="mt-3 leading-7 text-white/80">
                Include the listing name, application details, or account email
                so the admin team can help quickly.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}