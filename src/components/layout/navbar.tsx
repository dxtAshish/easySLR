import Link from "next/link";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { auth } from "@/server/auth";

export async function Navbar() {
  const session = await auth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="text-sm font-semibold tracking-tight text-slate-900">
          EasySLR <span className="font-normal text-slate-400">/ Article Review</span>
        </Link>
        {session?.user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{session.user.name ?? session.user.email}</span>
            <SignOutButton />
          </div>
        )}
      </div>
    </header>
  );
}
