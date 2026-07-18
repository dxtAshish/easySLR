import { Navbar } from "@/components/layout/navbar";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}
