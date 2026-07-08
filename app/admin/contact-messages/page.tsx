"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ContactMessage = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: "new" | "reviewed" | "closed";
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

type StatusFilter = "all" | "new" | "reviewed" | "closed";

const PAGE_SIZE = 25;

function statusClass(status: string) {
  if (status === "new") return "bg-yellow-50 text-yellow-700";
  if (status === "reviewed") return "bg-blue-50 text-blue-700";
  if (status === "closed") return "bg-green-50 text-green-700";

  return "bg-slate-100 text-slate-600";
}

function formatStatus(status: string) {
  if (status === "new") return "New";
  if (status === "reviewed") return "Reviewed";
  if (status === "closed") return "Closed";

  return status.replaceAll("_", " ");
}

export default function AdminContactMessagesPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");

  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const [savingId, setSavingId] = useState("");
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  useEffect(() => {
    loadMessages();
  }, []);

  async function loadMessages() {
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

    const { data: currentProfile, error: currentProfileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (currentProfileError || currentProfile?.role !== "admin") {
      setMessage("You do not have permission to view contact messages.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("contact_messages")
      .select(
        `
        id,
        user_id,
        name,
        email,
        phone,
        subject,
        message,
        status,
        admin_notes,
        created_at,
        updated_at
      `
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      setMessage(error.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    const rows = (data || []) as ContactMessage[];

    const notes: Record<string, string> = {};
    rows.forEach((row) => {
      notes[row.id] = row.admin_notes || "";
    });

    setMessages(rows);
    setNotesById(notes);
    setAllowed(true);
    setLoading(false);
  }

  const filteredMessages = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return messages.filter((contactMessage) => {
      const matchesStatus =
        statusFilter === "all" ? true : contactMessage.status === statusFilter;

      const matchesSearch =
        !cleanSearch ||
        contactMessage.name.toLowerCase().includes(cleanSearch) ||
        contactMessage.email.toLowerCase().includes(cleanSearch) ||
        (contactMessage.phone || "").toLowerCase().includes(cleanSearch) ||
        contactMessage.subject.toLowerCase().includes(cleanSearch) ||
        contactMessage.message.toLowerCase().includes(cleanSearch) ||
        (contactMessage.admin_notes || "").toLowerCase().includes(cleanSearch);

      return matchesStatus && matchesSearch;
    });
  }, [messages, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMessages.length / PAGE_SIZE));

  const visibleMessages = filteredMessages.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateStatus(value: StatusFilter) {
    setStatusFilter(value);
    setPage(1);
  }

  async function updateMessageStatus(id: string, status: ContactMessage["status"]) {
    setSavingId(id);
    setMessage("");

    const { error } = await supabase
      .from("contact_messages")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      setSavingId("");
      return;
    }

    setMessages((current) =>
      current.map((row) => (row.id === id ? { ...row, status } : row))
    );

    setSavingId("");
  }

  async function saveNotes(id: string) {
    setSavingId(id);
    setMessage("");

    const admin_notes = notesById[id] || "";

    const { error } = await supabase
      .from("contact_messages")
      .update({
        admin_notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      setSavingId("");
      return;
    }

    setMessages((current) =>
      current.map((row) => (row.id === id ? { ...row, admin_notes } : row))
    );

    setSavingId("");
  }

  const newCount = messages.filter((row) => row.status === "new").length;
  const reviewedCount = messages.filter(
    (row) => row.status === "reviewed"
  ).length;
  const closedCount = messages.filter((row) => row.status === "closed").length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black sm:text-3xl">
            Loading contact messages...
          </h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6">
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

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-bold text-slate-600">
              ← Back to Admin
            </Link>

            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Contact Messages
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Review messages submitted from the Contact Us page, mark them
              reviewed or closed, and add admin notes.
            </p>
          </div>

          <button
            type="button"
            onClick={loadMessages}
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

        <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total" value={messages.length} />
          <StatCard title="New" value={newCount} />
          <StatCard title="Reviewed" value={reviewedCount} />
          <StatCard title="Closed" value={closedCount} />
        </section>

        <section className="mt-8 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <div className="grid gap-5">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Search messages
              </span>

              <input
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search by name, email, subject, message, or notes..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-slate-500"
              />
            </label>

            <div>
              <p className="mb-2 text-sm font-black text-slate-700">Status</p>

              <div className="flex flex-wrap gap-2">
                <FilterButton
                  active={statusFilter === "all"}
                  label="All"
                  onClick={() => updateStatus("all")}
                />
                <FilterButton
                  active={statusFilter === "new"}
                  label="New"
                  onClick={() => updateStatus("new")}
                />
                <FilterButton
                  active={statusFilter === "reviewed"}
                  label="Reviewed"
                  onClick={() => updateStatus("reviewed")}
                />
                <FilterButton
                  active={statusFilter === "closed"}
                  label="Closed"
                  onClick={() => updateStatus("closed")}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-5 sm:p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black">Messages</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Showing {visibleMessages.length} of {filteredMessages.length} messages.
                </p>
              </div>

              <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
                Page {page} of {totalPages}
              </span>
            </div>
          </div>

          {visibleMessages.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {visibleMessages.map((contactMessage) => (
                <ContactMessageRow
                  key={contactMessage.id}
                  contactMessage={contactMessage}
                  saving={savingId === contactMessage.id}
                  notesValue={notesById[contactMessage.id] || ""}
                  onNotesChange={(value) =>
                    setNotesById((current) => ({
                      ...current,
                      [contactMessage.id]: value,
                    }))
                  }
                  onSaveNotes={() => saveNotes(contactMessage.id)}
                  onStatusChange={(status) =>
                    updateMessageStatus(contactMessage.id, status)
                  }
                />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-2xl font-black">No messages found</h3>
              <p className="mt-3 text-slate-600">
                Try a different search or status filter.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black disabled:opacity-50"
            >
              Previous
            </button>

            <p className="text-center text-sm font-bold text-slate-500">
              Page {page} of {totalPages}
            </p>

            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page === totalPages}
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function ContactMessageRow({
  contactMessage,
  saving,
  notesValue,
  onNotesChange,
  onSaveNotes,
  onStatusChange,
}: {
  contactMessage: ContactMessage;
  saving: boolean;
  notesValue: string;
  onNotesChange: (value: string) => void;
  onSaveNotes: () => void;
  onStatusChange: (status: ContactMessage["status"]) => void;
}) {
  return (
    <div className="grid gap-5 p-5 lg:grid-cols-[1fr_320px] sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-black">{contactMessage.subject}</h3>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
              contactMessage.status
            )}`}
          >
            {formatStatus(contactMessage.status)}
          </span>
        </div>

        <p className="mt-2 font-bold text-slate-500">
          {contactMessage.name} ·{" "}
          <a href={`mailto:${contactMessage.email}`} className="underline">
            {contactMessage.email}
          </a>
        </p>

        {contactMessage.phone && (
          <p className="mt-1 text-sm font-bold text-slate-500">
            Phone:{" "}
            <a href={`tel:${contactMessage.phone}`} className="underline">
              {contactMessage.phone}
            </a>
          </p>
        )}

        <div className="mt-4 rounded-2xl bg-[#f7f4ef] p-4">
          <p className="text-sm font-black uppercase tracking-[0.15em] text-slate-500">
            Message
          </p>

          <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">
            {contactMessage.message}
          </p>
        </div>

        <p className="mt-3 text-xs font-bold text-slate-400">
          Sent {new Date(contactMessage.created_at).toLocaleString()}
        </p>
      </div>

      <div className="rounded-3xl bg-[#f7f4ef] p-4">
        <p className="text-sm font-black uppercase tracking-[0.15em] text-slate-500">
          Admin
        </p>

        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-black text-slate-700">
            Notes
          </span>

          <textarea
            value={notesValue}
            onChange={(event) => onNotesChange(event.target.value)}
            rows={5}
            placeholder="Add internal admin notes..."
            className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold leading-6 outline-none focus:border-slate-500"
          />
        </label>

        <button
          type="button"
          onClick={onSaveNotes}
          disabled={saving}
          className="mt-3 w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Notes"}
        </button>

        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={() => onStatusChange("new")}
            disabled={saving}
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black disabled:opacity-60"
          >
            Mark New
          </button>

          <button
            type="button"
            onClick={() => onStatusChange("reviewed")}
            disabled={saving}
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black disabled:opacity-60"
          >
            Mark Reviewed
          </button>

          <button
            type="button"
            onClick={() => onStatusChange("closed")}
            disabled={saving}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            Close Message
          </button>
        </div>
      </div>
    </div>
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

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-5 py-3 text-sm font-black ${
        active
          ? "bg-slate-950 text-white"
          : "border border-slate-300 bg-white text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}