"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

type PropertyForConversation = {
  id: string;
  title: string | null;
  city: string | null;
  state: string | null;
  landlord_id: string | null;
  landlord_company_id: string | null;
};

function getProperty(conversation: Conversation) {
  if (Array.isArray(conversation.properties)) {
    return conversation.properties[0] || null;
  }

  return conversation.properties;
}

function getConversationTime(conversation: Conversation) {
  const rawDate = conversation.last_message_at || conversation.created_at;

  if (!rawDate) return "";

  return new Date(rawDate).toLocaleString();
}

function TenantMessagesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const propertyId = searchParams.get("propertyId");
  const landlordId = searchParams.get("landlordId");

  const [loading, setLoading] = useState(true);
  const [openingConversation, setOpeningConversation] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadConversationIds, setUnreadConversationIds] = useState<string[]>(
    []
  );

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, landlordId]);

  async function openOrCreateListingConversation(userId: string) {
    if (!propertyId || !landlordId) return false;

    setOpeningConversation(true);

    const { data: propertyData, error: propertyError } = await supabase
      .from("properties")
      .select("id, title, city, state, landlord_id, landlord_company_id")
      .eq("id", propertyId)
      .eq("status", "published")
      .single();

    if (propertyError || !propertyData) {
      setMessage("Could not open a conversation for this listing.");
      setOpeningConversation(false);
      return false;
    }

    const property = propertyData as PropertyForConversation;

    if (!property.landlord_id || property.landlord_id !== landlordId) {
      setMessage("This listing is not available for landlord messaging.");
      setOpeningConversation(false);
      return false;
    }

    const { data: existingConversation, error: existingError } = await supabase
      .from("conversations")
      .select("id")
      .eq("tenant_id", userId)
      .eq("landlord_id", landlordId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (existingError) {
      setMessage(existingError.message);
      setOpeningConversation(false);
      return false;
    }

    if (existingConversation?.id) {
      router.replace(`/dashboard/messages/${existingConversation.id}`);
      return true;
    }

    const subject = property.title
      ? `Question about ${property.title}`
      : "Question about this rental";

    const { data: newConversation, error: createError } = await supabase
      .from("conversations")
      .insert({
        tenant_id: userId,
        landlord_id: landlordId,
        landlord_company_id: property.landlord_company_id,
        property_id: propertyId,
        application_id: null,
        subject,
        last_message: null,
        last_message_at: null,
      })
      .select("id")
      .single();

    if (createError || !newConversation) {
      setMessage(
        createError?.message || "Could not create a conversation for this listing."
      );
      setOpeningConversation(false);
      return false;
    }

    router.replace(`/dashboard/messages/${newConversation.id}`);
    return true;
  }

  async function loadMessages() {
    setLoading(true);
    setMessage("");

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

    if (profile?.role !== "admin" && propertyId && landlordId) {
      const opened = await openOrCreateListingConversation(user.id);

      if (opened) return;
    }

    let conversationQuery = supabase
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
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (profile?.role !== "admin") {
      conversationQuery = conversationQuery.eq("tenant_id", user.id);
    }

    const { data: conversationRows, error: conversationError } =
      await conversationQuery;

    if (conversationError) {
      setMessage(conversationError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    const loadedConversations =
      (conversationRows || []) as unknown as Conversation[];

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
    setOpeningConversation(false);
  }

  if (loading || openingConversation) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black sm:text-3xl">
            {openingConversation ? "Opening conversation..." : "Loading messages..."}
          </h1>

          {openingConversation && (
            <p className="mt-3 font-bold text-slate-600">
              Connecting you with the landlord for this rental.
            </p>
          )}
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
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/dashboard/tenant"
          className="text-sm font-bold text-slate-600"
        >
          ← Back to Tenant Dashboard
        </Link>

        <div className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div className="border-b border-slate-200 pb-6">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Keylo Messages
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Tenant Messages
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              View conversations with landlords about listings, applications,
              and rentals.
            </p>
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

                          {conversation.landlord_company_id && (
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
                        {getConversationTime(conversation)}
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
                When you message a landlord about a rental, the conversation
                will appear here.
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
export default function TenantMessagesPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
          <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h1 className="text-2xl font-black sm:text-3xl">
              Loading messages...
            </h1>
          </div>
        </main>
      }
    >
      <TenantMessagesPageContent />
    </Suspense>
  );
}