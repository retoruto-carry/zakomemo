"use client";

import { WigglyEditor } from "@/ui/WigglyEditor";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-sky-50 to-white text-slate-900">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-12 sm:px-10 sm:py-16">
        <WigglyEditor />
      </main>
    </div>
  );
}
