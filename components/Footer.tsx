import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <Link href="/" className="text-3xl font-black tracking-tight">
            Keylo
          </Link>

          <p className="mt-4 max-w-md leading-7 text-slate-600">
            A rental marketplace for landlords and tenants to list, apply, and
            manage the rental process from one clean platform.
          </p>

          <p className="mt-5 text-sm font-bold text-slate-500">
            © {new Date().getFullYear()} Keylo. All rights reserved.
          </p>
        </div>

        <div>
          <h3 className="font-black">Marketplace</h3>

          <div className="mt-4 grid gap-3 text-sm font-bold text-slate-600">
            <Link href="/listings" className="hover:text-slate-950">
              Browse Rentals
            </Link>

            <Link href="/landlords" className="hover:text-slate-950">
              For Landlords
            </Link>

            <Link href="/tenants" className="hover:text-slate-950">
              For Tenants
            </Link>

            <Link href="/auth/signup" className="hover:text-slate-950">
              Get Started
            </Link>
          </div>
        </div>

        <div>
          <h3 className="font-black">Company</h3>

          <div className="mt-4 grid gap-3 text-sm font-bold text-slate-600">
            <Link href="/contact" className="hover:text-slate-950">
              Contact
            </Link>

            <Link href="/fair-housing" className="hover:text-slate-950">
              Fair Housing
            </Link>

            <Link href="/privacy" className="hover:text-slate-950">
              Privacy Policy
            </Link>

            <Link href="/terms" className="hover:text-slate-950">
              Terms of Use
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}