"use client";

import { SparklesIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { calculateOrder } from "@/lib/orders/actions";

export function CalculateButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await calculateOrder();
        if (result.error) setError(result.error);
      } catch {
        setError("No se pudo calcular el pedido. Intenta de nuevo.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={onClick} disabled={pending}>
        <SparklesIcon data-icon="inline-start" />
        {pending ? "Calculando…" : "Calcular pedido"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
