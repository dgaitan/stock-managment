import { PackageIcon } from "lucide-react";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/app";

type DashboardLayoutProps = {
  userMenu: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function DashboardLayout({ userMenu, title, subtitle, children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="flex min-h-16 items-center gap-4 border-b bg-background px-8 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PackageIcon aria-hidden className="size-4" />
          </span>
          <span className="font-semibold">{APP_NAME}</span>
        </div>
        <div className="ml-auto">{userMenu}</div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-5 p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
        <p className="py-2 text-center text-xs text-muted-foreground">Datos ficticios — prueba técnica</p>
      </main>
    </div>
  );
}
