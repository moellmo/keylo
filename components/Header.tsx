"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import LogoutButton from "@/components/LogoutButton";
import NotificationBell from "@/components/NotificationBell";

type Role = "tenant" | "landlord" | "admin" | null;

export default function Header() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<Role>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    async function loadUser() {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (!user) {
        setLoggedIn(false);
        setRole(null);
        setUnreadMessages(0);
        setLoading(false);
        return;
      }

      setLoggedIn(true);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const userRole = (profile?.role as Role) || null;

      setRole(userRole);

      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("is_read", false);

      setUnreadMessages(count || 0);
      setLoading(false);
    }

    loadUser();

    const {
  data: { subscription },
} = supabase.auth.onAuthStateChange(() => {
  loadUser();
});

function refreshUnreadMessages() {
  loadUser();
}

window.addEventListener("keylo-messages-read", refreshUnreadMessages);

const interval = window.setInterval(() => {
  loadUser();
}, 30000);

return () => {
  subscription.unsubscribe();
  window.removeEventListener("keylo-messages-read", refreshUnreadMessages);
  window.clearInterval(interval);
};
  }, []);

  function dashboardHref() {
    if (role === "admin") return "/admin";
    if (role === "landlord") return "/dashboard/landlord";
    if (role === "tenant") return "/dashboard/tenant";

    return "/dashboard";
  }

  function dashboardLabel() {
    if (role === "admin") return "Admin Dashboard";
    if (role === "landlord") return "Landlord Dashboard";
    if (role === "tenant") return "Tenant Dashboard";

    return "Dashboard";
  }

  function messagesHref() {
    if (role === "landlord") return "/dashboard/landlord/messages";
    if (role === "tenant") return "/dashboard/tenant/messages";
    if (role === "admin") return "/admin";

    return "/dashboard";
  }

  const showMessages = role === "tenant" || role === "landlord";

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-6 py-5">
        <Link href="/" className="text-3xl font-black tracking-tight">
          Keylo
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-700 md:flex">
          <Link href="/listings" className="hover:text-slate-950">
            Browse Rentals
          </Link>

          <Link href="/landlords" className="hover:text-slate-950">
            For Landlords
          </Link>

          <Link href="/tenants" className="hover:text-slate-950">
            For Tenants
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-11 w-28 rounded-full bg-slate-100" />
          ) : loggedIn ? (
            <>
              <Link
                href={dashboardHref()}
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
              >
                {dashboardLabel()}
              </Link>

              {role === "landlord" && (
                <Link
                  href="/dashboard/landlord/properties/new"
                  className="hidden rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-950 sm:inline-flex"
                >
                  Post Listing
                </Link>
              )}

              {showMessages && (
                <Link
                  href={messagesHref()}
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-black text-slate-950"
                  aria-label="Messages"
                  title="Messages"
                >
                  ✉

                  {unreadMessages > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-black leading-none text-white">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                </Link>
              )}

              <NotificationBell />

              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="hidden rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-950 sm:inline-flex"
              >
                Login
              </Link>

              <Link
                href="/auth/signup"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}