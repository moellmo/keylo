"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

type Profile = {
  id: string;
  role: string | null;
  full_name: string | null;
  email: string | null;
};

function getProperty(conversation: Conversation) {
  if (Array.isArray(conversation.properties)) {
    return conversation.properties[0] || null;
  }

  return conversation.properties;
}

export default function MessageThreadPage() {
  const params = useParams();
  const conversationId = String(params.id);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");

  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");

  useEffect(() => {
    loadThread();
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function loadThread() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Please log in to view messages.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, full_name, email")
      .eq("id", user.id)
      .single();

    if (profileError || !profileRow) {
      setMessage("Could not load your profile.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    setProfile(profileRow as Profile);

    const { data: conversationRow, error: conversationError } = await supabase
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
      .eq("id", conversationId)
      .single();

    if (conversationError || !conversationRow) {
      setMessage("Conversation not found.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const conversationData = conversationRow as unknown as Conversation;

    const isAdmin = profileRow.role === "admin";
    const isTenant = conversationData.tenant_id === user.id;
    const isLandlord = conversationData.landlord_id === user.id;

    if (!isAdmin && !isTenant && !isLandlord) {
      setMessage("You do not have permission to view this conversation.");
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: messageRows, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      setMessage(messagesError.message);
      setAllowed(false);
      setLoading(false);
      return;
    }

    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .eq("recipient_id", user.id);

      window.dispatchEvent(new Event("keylo-messages-read"));

    setConversation(conversationData);
    setMessages((messageRows || []) as Message[]);
    setAllowed(true);
    setLoading(false);
  }

  async function sendMessage() {
    if (!conversation || !userId) return;

    const cleanBody = body.trim();

    if (!cleanBody) {
      setMessage("Please type a message.");
      return;
    }

    const recipientId =
      userId === conversation.tenant_id
        ? conversation.landlord_id
        : conversation.tenant_id;

    setSending(true);
    setMessage("");

    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: userId,
      recipient_id: recipientId,
      body: cleanBody,
    });

    if (insertError) {
      setMessage(insertError.message);
      setSending(false);
      return;
    }

    await supabase
      .from("conversations")
      .update({
        last_message: cleanBody,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);

    setBody("");
    setSending(false);
    await loadThread();
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

  if (!allowed || !conversation) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Messages unavailable</h1>

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

  const property = getProperty(conversation);
  const backHref =
    profile?.role === "landlord"
      ? "/dashboard/landlord/messages"
      : profile?.role === "admin"
      ? "/admin"
      : "/dashboard/tenant/messages";

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-950">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link href={backHref} className="text-sm font-bold text-slate-600">
          ← Back to Messages
        </Link>

        <div className="mt-6 overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-6">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              Keylo Messages
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight">
              {conversation.subject || property?.title || "Conversation"}
            </h1>

            {property && (
              <p className="mt-3 font-bold text-slate-600">
                {property.title || "Rental"}{" "}
                {property.city && property.state
                  ? `· ${property.city}, ${property.state}`
                  : ""}
              </p>
            )}
          </div>

          {message && (
            <div className="mx-6 mt-6 rounded-2xl bg-slate-100 px-5 py-4 font-bold text-slate-800">
              {message}
            </div>
          )}

          <div className="max-h-[520px] space-y-4 overflow-y-auto bg-[#f7f4ef] p-6">
            {messages.length > 0 ? (
              messages.map((item) => {
                const isMine = item.sender_id === userId;

                return (
                  <div
                    key={item.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-3xl px-5 py-4 ${
                        isMine
                          ? "bg-slate-950 text-white"
                          : "bg-white text-slate-950 ring-1 ring-slate-200"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-7">
                        {item.body}
                      </p>

                      <p
                        className={`mt-2 text-xs font-bold ${
                          isMine ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200">
                <h2 className="text-2xl font-black">No messages yet</h2>
                <p className="mt-3 text-slate-600">
                  Start the conversation below.
                </p>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-200 p-6">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Message
              </span>

              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={4}
                placeholder="Type your message..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-500"
              />
            </label>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={sendMessage}
                disabled={sending}
                className="rounded-full bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-60"
              >
                {sending ? "Sending..." : "Send Message"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}