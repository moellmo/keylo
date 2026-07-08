"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type EmailLog = {
  id: string;
  user_id: string;
  notification_type: string;
  recipient_email: string;
  subject: string;
  body: string;
  target_url: string | null;
  status:
    | "queued"
    | "sent"
    | "skipped_preferences"
    | "skipped_missing_email"
    | "failed";
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
};

function statusClass(status: string) {
  if (status === "sent") return "bg-green-50 text-green-700";
  if (status === "failed") return "bg-red-50 text-red-700";
  if (status.startsWith("skipped")) return "bg-yellow-50 text-yellow-700";
  return "bg-slate-100 text-slate-600";
}

function formatStatus(status: string) {
  if (status === "sent") return "Sent";
  if (status === "failed") return "Failed";
  if (status === "skipped_preferences") return "Skipped: Preferences";
  if (status === "skipped_missing_email") return "Skipped: Missing Email";
  if (status === "queued") return "Queued";
  return status.replaceAll("_", " ");
}

export default function AdminEmailLogsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<EmailLog[]>([]);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in as an admin.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      setMessage("You do not have permission to view email logs.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("email_notification_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setMessage(error.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    setLogs((data || []) as EmailLog[]);
    setAllowed(true);
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading email logs...</h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Admin access required</h1>
          <p className="mt-3 text-slate-600">{message}</p>

          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const sentCount = logs.filter((log) => log.status === "sent").length;
  const failedCount = logs.filter((log) => log.status === "failed").length;
  const skippedCount = logs.filter((log) =>
    log.status.startsWith("skipped")
  ).length;

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-bold text-slate-600">
              ← Back to Admin
            </Link>

            <h1 className="mt-4 text-5xl font-black tracking-tight">
              Email Logs
            </h1>

            <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
              Review Keylo email attempts, delivery status, skipped preferences,
              and failures.
            </p>
          </div>

          <button
            type="button"
            onClick={loadLogs}
            className="rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            Refresh
          </button>
        </div>

        {message && (
          <div className="mt-6 rounded-2xl bg-white px-5 py-4 font-bold text-red-700 shadow-sm ring-1 ring-red-200">
            {message}
          </div>
        )}

        <section className="mt-8 grid gap-5 md:grid-cols-4">
          <StatCard title="Total" value={logs.length} />
          <StatCard title="Sent" value={sentCount} />
          <StatCard title="Skipped" value={skippedCount} />
          <StatCard title="Failed" value={failedCount} />
        </section>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-2xl font-black">Recent Email Attempts</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Showing the latest 100 rows.
            </p>
          </div>

          {logs.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {logs.map((log) => (
                <div key={log.id} className="p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-black">{log.subject}</h3>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
                            log.status
                          )}`}
                        >
                          {formatStatus(log.status)}
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                          {log.notification_type}
                        </span>
                      </div>

                      <p className="mt-2 font-bold text-slate-500">
                        To: {log.recipient_email}
                      </p>

                      <p className="mt-3 max-w-4xl whitespace-pre-wrap leading-7 text-slate-700">
                        {log.body}
                      </p>

                      {log.error_message && (
                        <div className="mt-4 rounded-2xl bg-red-50 p-4 font-bold text-red-700 ring-1 ring-red-200">
                          {log.error_message}
                        </div>
                      )}

                      {log.target_url && (
                        <p className="mt-3 break-all text-sm font-bold text-slate-500">
                          Link: {log.target_url}
                        </p>
                      )}
                    </div>

                    <div className="text-sm font-bold text-slate-500 md:text-right">
                      <p>{new Date(log.created_at).toLocaleString()}</p>
                      {log.sent_at && (
                        <p className="mt-1">
                          Sent {new Date(log.sent_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No email logs yet</h3>
              <p className="mt-3 text-slate-600">
                Email attempts will appear here after notifications trigger.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p className="mt-3 text-4xl font-black">{value}</p>
    </div>
  );
}