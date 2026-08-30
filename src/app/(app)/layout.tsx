"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CognosProvider, useCognos } from "@/lib/cognos-context";
import AppShell from "@/components/AppShell";

function ProtectedApp({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoadingAuth } = useCognos();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isLoadingAuth, router, pathname]);

  if (isLoadingAuth || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "#05070f" }}>
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <CognosProvider>
      <ProtectedApp>{children}</ProtectedApp>
    </CognosProvider>
  );
}
