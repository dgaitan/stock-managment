"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col items-start gap-3 p-8">
      <h1 className="text-lg font-semibold">No se pudo cargar el pedido</h1>
      <p className="text-sm text-muted-foreground">Revisa la conexión a la base de datos e intenta de nuevo.</p>
      <Button onClick={reset}>Reintentar</Button>
    </main>
  );
}
