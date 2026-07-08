"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Conversation = {
  id: string;
  application_id: string | null;
  property_id: string | null;
  tenant_id: string;
  landlord_id: string;
  subject: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  properties:
    | {
        id: string;
        title: string | null;
        city: string | null;
        state: string | null;
      }
    | {
        id: string;
        title: string | null;
        city: string | null;
        state: string | null;
      }[]
    | null;
};

type MessageRow = {
  conversation_id: string;
};

function getProperty(conversation: Conversation) {
  if (Array.isArray(conversation.properties)) {
    return conversation.properties[0] || null;
  }

  return conversation.properties;
}

export default function TenantMessagesPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadConversationIds, setUnreadConversationIds] = useState<string[]>(
    []
  );

  useEffect(() => {
    loadMessages();
  }, []);

  async function loadMessages() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in as a tenant.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "tenant" && profile?.role !== "admin") {
      setMessage("Only tenants can view this page.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: conversationRows, error: conversationError } = await supabase
      .from("conversations")
      .select(
        `
        *,
        properties (
          id,
          title,
          city,
          state
        )
      `
      )
      .eq("tenant_id", user.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (conversationError) {
      setMessage(conversationError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: unreadRows, error: unreadError } = await supabase
      .from("messages")
      .select("conversation_id")
      .eq("recipient_id", user.id)
      .eq("is_read", false);

    if (unreadError) {
      setMessage(unreadError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    const unreadIds = Array.from(
      new Set(
        ((unreadRows || []) as MessageRow[]).map(
          (row) => row.conversation_id
        )
      )
    );

    setConversations((conversationRows || []) as Conversation[]);
    setUnreadConversationIds(unreadIds);
    setAllowed(true);
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Loading messages...</h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Messages unavailable</h1>

          <p className="mt-3 text-slate-600">{message}</p>

          <Link
            href="/dashboard/tenant"
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
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/dashboard/tenant"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Tenant Dashboard
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 pb-6">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Keylo Messages
            </p>

            <h1 className="mt-3 text-5xl font-black tracking-tight">
              Tenant Messages
            </h1>

            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
              View conversations with landlords about your applications and
              rentals.
            </p>
          </div>

          {conversations.length > 0 ? (
            <div className="mt-8 divide-y divide-slate-200 rounded-3xl border border-slate-200">
              {conversations.map((conversation) => {
                const property = getProperty(conversation);
                const hasUnread = unreadConversationIds.includes(
                  conversation.id
                );

                return (
                  <Link
                    key={conversation.id}
                    href={`/dashboard/messages/${conversation.id}`}
                    className="block p-5 transition hover:bg-slate-50"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="text-xl font-black">
                            {conversation.subject ||
                              property?.title ||
                              "Conversation"}
                          </h2>

                          {hasUnread && (
                            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
                              New
                            </span>
                          )}
                        </div>

                        <p className="mt-2 font-bold text-slate-600">
                          {property?.title || "Rental"}
                          {property?.city && property?.state
                            ? ` · ${property.city}, ${property.state}`
                            : ""}
                        </p>

                        <p className="mt-2 line-clamp-2 text-sm font-bold text-slate-500">
                          {conversation.last_message || "No messages yet."}
                        </p>
                      </div>

                      <p className="text-sm font-bold text-slate-500">
                        {conversation.last_message_at
                          ? new Date(
                              conversation.last_message_at
                            ).toLocaleString()
                          : new Date(conversation.created_at).toLocaleString()}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mt-8 rounded-3xl bg-[#f7f4ef] p-8 text-center">
              <h2 className="text-2xl font-black">No messages yet</h2>

              <p className="mt-3 text-slate-600">
                When a landlord messages you about an application, it will
                appear here.
              </p>

              <Link
                href="/listings"
                className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
              >
                Browse Rentals
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}