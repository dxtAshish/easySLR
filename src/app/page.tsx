import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { auth } from "@/server/auth";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          EasySLR Article Review Workspace
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Import research articles into a project and screen them with your team —
          search, filter, sort, and track include/exclude decisions in one table.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/login">
          <Button variant="secondary">Sign in</Button>
        </Link>
        <Link href="/register">
          <Button>Get started</Button>
        </Link>
      </div>
    </main>
  );
}
