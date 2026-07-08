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
  const [menuOpen, setMenuOpen] = useState(false);

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

  function closeMenu() {
    setMenuOpen(false);
  }

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
    <>
      <header className="sticky top-0 z-50 border-b border-[#ded6c8] bg-[#f7f1e7]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="group flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#07101f] text-lg font-black text-[#f5c76a] shadow-sm">
              K
            </div>

            <div className="min-w-0 leading-none">
              <div className="truncate text-2xl font-black tracking-[-0.04em] text-[#07101f]">
                Keylo
              </div>
              <div className="mt-1 hidden text-[10px] font-black uppercase tracking-[0.22em] text-[#7b6f5f] sm:block">
                Rent smarter
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-black text-[#23314a] lg:flex">
            <Link href="/listings" className="transition hover:text-[#07101f]">
              Browse Rentals
            </Link>

            <Link href="/landlords" className="transition hover:text-[#07101f]">
              For Landlords
            </Link>

            <Link href="/tenants" className="transition hover:text-[#07101f]">
              For Tenants
            </Link>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {loading ? (
              <div className="h-11 w-28 animate-pulse rounded-full bg-white/70" />
            ) : loggedIn ? (
              <>
                <Link
                  href={dashboardHref()}
                  className="rounded-full bg-[#07101f] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {dashboardLabel()}
                </Link>

                {role === "landlord" && (
                  <Link
                    href="/dashboard/landlord/properties/new"
                    className="hidden rounded-full border border-[#d6ccbc] bg-white px-5 py-3 text-sm font-black text-[#07101f] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md xl:inline-flex"
                  >
                    Post Listing
                  </Link>
                )}

                {showMessages && (
                  <Link
                    href={messagesHref()}
                    className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d6ccbc] bg-white text-lg font-black text-[#07101f] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
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
                  className="rounded-full border border-[#d6ccbc] bg-white px-5 py-3 text-sm font-black text-[#07101f] shadow-sm"
                >
                  Login
                </Link>

                <Link
                  href="/auth/signup"
                  className="rounded-full bg-[#07101f] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#07101f] text-2xl font-black text-white shadow-sm md:hidden"
            aria-label="Open menu"
          >
            ☰
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <button
            type="button"
            aria-label="Close menu overlay"
            onClick={closeMenu}
            className="absolute inset-0 bg-slate-950/40"
          />

          <aside className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col overflow-y-auto bg-[#f7f1e7] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <Link
                href="/"
                onClick={closeMenu}
                className="flex items-center gap-3"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#07101f] text-lg font-black text-[#f5c76a] shadow-sm">
                  K
                </div>

                <div>
                  <div className="text-2xl font-black tracking-[-0.04em] text-[#07101f]">
                    Keylo
                  </div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#7b6f5f]">
                    Rent smarter
                  </div>
                </div>
              </Link>

              <button
                type="button"
                onClick={closeMenu}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-black text-[#07101f] shadow-sm ring-1 ring-[#d6ccbc]"
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            <div className="mt-6 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-[#ded6c8]">
              {loading ? (
                <div className="h-12 animate-pulse rounded-full bg-slate-100" />
              ) : loggedIn ? (
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                    Signed in
                  </p>

                  <Link
                    href={dashboardHref()}
                    onClick={closeMenu}
                    className="mt-3 flex w-full items-center justify-between rounded-2xl bg-[#07101f] px-5 py-4 text-base font-black text-white"
                  >
                    {dashboardLabel()}
                    <span>→</span>
                  </Link>
                </div>
              ) : (
                <div className="grid gap-3">
                  <Link
                    href="/auth/signup"
                    onClick={closeMenu}
                    className="rounded-2xl bg-[#07101f] px-5 py-4 text-center text-base font-black text-white"
                  >
                    Get Started
                  </Link>

                  <Link
                    href="/auth/login"
                    onClick={closeMenu}
                    className="rounded-2xl border border-[#d6ccbc] bg-white px-5 py-4 text-center text-base font-black text-[#07101f]"
                  >
                    Login
                  </Link>
                </div>
              )}
            </div>

            <nav className="mt-5 grid gap-3">
              <MobileMenuLink href="/listings" onClick={closeMenu}>
                Browse Rentals
              </MobileMenuLink>

              <MobileMenuLink href="/landlords" onClick={closeMenu}>
                For Landlords
              </MobileMenuLink>

              <MobileMenuLink href="/tenants" onClick={closeMenu}>
                For Tenants
              </MobileMenuLink>

              <MobileMenuLink href="/contact" onClick={closeMenu}>
                Contact Us
              </MobileMenuLink>

              {loggedIn && (
                <>
                  <MobileMenuLink href={dashboardHref()} onClick={closeMenu}>
                    {dashboardLabel()}
                  </MobileMenuLink>

                  {role === "landlord" && (
                    <>
                      <MobileMenuLink
                        href="/dashboard/landlord/properties/new"
                        onClick={closeMenu}
                      >
                        Post New Listing
                      </MobileMenuLink>

                      <MobileMenuLink
                        href="/dashboard/landlord/payments"
                        onClick={closeMenu}
                      >
                        Payments
                      </MobileMenuLink>

                      <MobileMenuLink
                        href="/dashboard/landlord/maintenance"
                        onClick={closeMenu}
                      >
                        Maintenance
                      </MobileMenuLink>

                      <MobileMenuLink
                        href="/dashboard/landlord/lease-builder"
                        onClick={closeMenu}
                      >
                        Lease Builder
                      </MobileMenuLink>
                    </>
                  )}

                  {role === "tenant" && (
                    <>
                      <MobileMenuLink
                        href="/dashboard/tenant/payments"
                        onClick={closeMenu}
                      >
                        Payments
                      </MobileMenuLink>

                      <MobileMenuLink
                        href="/dashboard/tenant/maintenance"
                        onClick={closeMenu}
                      >
                        Maintenance
                      </MobileMenuLink>

                      <MobileMenuLink
                        href="/dashboard/tenant/documents"
                        onClick={closeMenu}
                      >
                        Documents
                      </MobileMenuLink>
                    </>
                  )}

                  {showMessages && (
                    <MobileMenuLink href={messagesHref()} onClick={closeMenu}>
                      <span className="flex w-full items-center justify-between gap-3">
                        <span>Messages</span>

                        {unreadMessages > 0 && (
                          <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-black text-white">
                            {unreadMessages > 9 ? "9+" : unreadMessages}
                          </span>
                        )}
                      </span>
                    </MobileMenuLink>
                  )}

                  <MobileMenuLink
                    href="/dashboard/notifications"
                    onClick={closeMenu}
                  >
                    Notifications
                  </MobileMenuLink>
                </>
              )}
            </nav>

            {loggedIn && (
              <div className="mt-5 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-[#ded6c8]">
                <p className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                  Account
                </p>

                <LogoutButton />
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function MobileMenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex min-h-14 items-center justify-between rounded-2xl bg-white px-5 py-4 text-base font-black text-[#07101f] shadow-sm ring-1 ring-[#ded6c8]"
    >
      {children}
      <span className="ml-3 text-slate-400">→</span>
    </Link>
  );
}