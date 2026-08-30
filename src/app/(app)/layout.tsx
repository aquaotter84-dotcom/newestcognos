"use client";

import type { ReactNode } from "react";
import { CognosProvider } from "@/lib/cognos-context";
import AppShell from "@/components/AppShell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <CognosProvider>
      <AppShell>{children}</AppShell>
    </CognosProvider>
  );
}
