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
  landlord_company_id: string | null;
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

type CompanyMembership = {
  company_id: string;
  role: "owner" | "admin" | "manager" | "maintenance" | "accounting" | "viewer";
};

function getProperty(conversation: Conversation) {
  if (Array.isArray(conversation.properties)) {
    return conversation.properties[0] || null;
  }

  return conversation.properties;
}

function canUseCompanyMessages(role: string) {
  return role === "owner" || role === "admin" || role === "manager";
}

function sortConversations(conversations: Conversation[]) {
  return [...conversations].sort((a, b) => {
    const aDate = a.last_message_at || a.created_at;
    const bDate = b.last_message_at || b.created_at;

    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

export default function LandlordMessagesPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadConversationIds, setUnreadConversationIds] = useState<string[]>(
    []
  );
  const [companyCount, setCompanyCount] = useState(0);

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
      setMessage("Please log in as a landlord.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "landlord" && profile?.role !== "admin") {
      setMessage("Only landlords can view this page.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const isAdmin = profile?.role === "admin";

    const { data: membershipRows, error: membershipError } = await supabase
      .from("landlord_company_members")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (membershipError) {
      setMessage(membershipError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    const companyIds = ((membershipRows || []) as CompanyMembership[])
      .filter((membership) => canUseCompanyMessages(membership.role))
      .map((membership) => membership.company_id);

    setCompanyCount(companyIds.length);

    let conversationQuery = supabase.from("conversations").select(`
      *,
      properties (
        id,
        title,
        city,
        state
      )
    `);

    if (!isAdmin) {
      const filters = [`landlord_id.eq.${user.id}`];

      if (companyIds.length > 0) {
        filters.push(`landlord_company_id.in.(${companyIds.join(",")})`);
      }

      conversationQuery = conversationQuery.or(filters.join(","));
    }

    const { data: conversationRows, error: conversationError } =
      await conversationQuery
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

    if (conversationError) {
      setMessage(conversationError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    const loadedConversations = sortConversations(
      (conversationRows || []) as unknown as Conversation[]
    );

    const visibleConversationIds = loadedConversations.map(
      (conversation) => conversation.id
    );

    let unreadIds: string[] = [];

    if (visibleConversationIds.length > 0) {
      const { data: unreadRows, error: unreadError } = await supabase
        .from("messages")
        .select("conversation_id")
        .eq("recipient_id", user.id)
        .eq("is_read", false)
        .in("conversation_id", visibleConversationIds);

      if (unreadError) {
        setMessage(unreadError.message);
        setAllowed(false);
        setLoading(false);
        return;
      }

      unreadIds = Array.from(
        new Set(
          ((unreadRows || []) as MessageRow[]).map(
            (row) => row.conversation_id
          )
        )
      );
    }

    setConversations(loadedConversations);
    setUnreadConversationIds(unreadIds);
    setAllowed(true);
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black sm:text-3xl">
            Loading messages...
          </h1>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Messages unavailable</h1>

          <p className="mt-3 text-slate-600">{message}</p>

          <Link
            href="/dashboard/landlord"
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
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/dashboard/landlord"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Landlord Dashboard
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="border-b border-slate-200 pb-6">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Keylo Messages
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Landlord Messages
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              View conversations with applicants and tenants.
            </p>

            {companyCount > 0 && (
              <p className="mt-4 w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">
                Showing personal and company conversations
              </p>
            )}
          </div>

          {message && (
            <div className="mt-6 rounded-2xl bg-red-50 px-5 py-4 font-bold text-red-700 ring-1 ring-red-200">
              {message}
            </div>
          )}

          {conversations.length > 0 ? (
            <div className="mt-8 divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200">
              {conversations.map((conversation) => {
                const property = getProperty(conversation);
                const hasUnread = unreadConversationIds.includes(
                  conversation.id
                );
                const isCompanyConversation =
                  !!conversation.landlord_company_id &&
                  conversation.landlord_id !== userId;

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

                          {isCompanyConversation && (
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                              Company
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
                Open an application and click Message Tenant to start a
                conversation.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}