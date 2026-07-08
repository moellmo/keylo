"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  target_url: string;
  is_read: boolean;
  created_at: string;
};

export default function NotificationBell() {
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadNotifications();

    const handleClick = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, []);

  async function loadNotifications() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, message, type, target_url, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error(error.message);
      setNotifications([]);
      setLoading(false);
      return;
    }

    setNotifications((data || []) as Notification[]);
    setLoading(false);
  }

  async function markAsRead(notificationId: string) {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, is_read: true }
          : notification
      )
    );
  }

  async function markAllAsRead() {
    const unreadIds = notifications
      .filter((notification) => !notification.is_read)
      .map((notification) => notification.id);

    if (unreadIds.length === 0) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds);

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: true,
      }))
    );
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-xl shadow-sm transition hover:bg-slate-50"
        aria-label="Notifications"
      >
        🔔

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-[340px] overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                Notifications
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {unreadCount} unread
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-sm font-black text-slate-950"
              >
                Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-5 text-sm font-bold text-slate-500">
              Loading...
            </div>
          ) : notifications.length > 0 ? (
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.target_url}
                  onClick={() => {
                    markAsRead(notification.id);
                    setOpen(false);
                  }}
                  className={`block border-b border-slate-100 px-5 py-4 transition hover:bg-slate-50 ${
                    notification.is_read ? "bg-white" : "bg-red-50/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!notification.is_read && (
                      <span className="mt-2 h-2.5 w-2.5 rounded-full bg-red-600" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-950">
                        {notification.title}
                      </p>

                      <p className="mt-1 line-clamp-2 text-sm font-bold leading-6 text-slate-600">
                        {notification.message}
                      </p>

                      <p className="mt-2 text-xs font-bold text-slate-400">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-lg font-black text-slate-950">
                No notifications
              </p>
              <p className="mt-2 text-sm font-bold text-slate-500">
                You’re all caught up.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}