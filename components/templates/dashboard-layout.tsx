import type { ReactNode } from "react";
import { BrandMark } from "@/components/molecules/brand-mark";

type DashboardLayoutProps = {
  headerActions: ReactNode;
  userMenu: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function DashboardLayout({ headerActions, userMenu, title, subtitle, children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-subtle">
      <header className="flex min-h-16 flex-wrap items-center gap-4 border-b border-border bg-background px-8 py-3">
        <BrandMark size="header" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {headerActions}
          {userMenu}
        </div>
      </header>
      <main className="mx-auto flex max-w-[1120px] flex-col gap-5 p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">{title}</h1>
          <p className="mt-1 text-muted-foreground">{subtitle}</p>
        </div>
        {children}
        <p className="py-2 text-center text-xs text-muted-foreground">Datos ficticios — prueba técnica</p>
      </main>
    </div>
  );
}
