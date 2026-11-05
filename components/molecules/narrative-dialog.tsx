"use client";

import { SparklesIcon } from "lucide-react";
import { RunNarrative } from "@/components/molecules/run-narrative";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** La lectura redactada por IA no ocupa la pantalla: se abre desde la línea de total. */
export function NarrativeDialog({ narrative }: { narrative: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="xs" className="text-primary" />}>
        <SparklesIcon data-icon="inline-start" />
        Lectura de IA
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lectura generada por IA</DialogTitle>
        </DialogHeader>
        <RunNarrative narrative={narrative} />
      </DialogContent>
    </Dialog>
  );
}
