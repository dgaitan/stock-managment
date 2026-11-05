"use client";

import { SparklesIcon } from "lucide-react";
import { RunNarrative } from "@/components/molecules/run-narrative";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** La lectura redactada por IA no ocupa la pantalla: se abre como enlace desde la línea de total. */
export function NarrativeDialog({ narrative }: { narrative: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="link" size="inline" className="font-normal" />}>Lectura de IA</DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon aria-hidden className="size-4 text-primary" />
            Lectura generada por IA
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="pt-0">
          <RunNarrative narrative={narrative} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
