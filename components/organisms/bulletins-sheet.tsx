"use client";

import { FileTextIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { BulletinEditor } from "@/components/organisms/bulletin-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { vigenciaLabel } from "@/lib/bulletins/labels";
import type { BulletinView } from "@/lib/bulletins/types";
import { formatIsoDate } from "@/lib/format";

type BulletinsSheetProps = {
  bulletins: BulletinView[];
  aiEnabled: boolean;
  today: string;
};

// session identifica la edición abierta: no cambia al guardar un comunicado nuevo (conserva mensajes y vista previa).
type View = { kind: "list" } | { kind: "edit"; id: number | null; session: number };

export function BulletinsSheet({ bulletins, aiEnabled, today }: BulletinsSheetProps) {
  const [view, setView] = useState<View>({ kind: "list" });
  const [sessions, setSessions] = useState(0);
  const open = (id: number | null) => {
    setSessions((n) => n + 1);
    setView({ kind: "edit", id, session: sessions + 1 });
  };
  const editing = view.kind === "edit" ? (bulletins.find((b) => b.id === view.id) ?? null) : null;

  return (
    <Sheet onOpenChange={(isOpen) => (isOpen ? undefined : setView({ kind: "list" }))}>
      <SheetTrigger render={<Button variant="ghost" size="sm" />}>
        <FileTextIcon data-icon="inline-start" />
        Comunicados
      </SheetTrigger>
      <SheetContent className="data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b p-6">
          <SheetTitle className="text-lg">Comunicados de fábrica</SheetTitle>
          <SheetDescription>
            De aquí salen los lotes y las reglas del ciclo. Archivar no borra: las reglas dejan de aplicarse.
          </SheetDescription>
        </SheetHeader>
        {view.kind === "edit" ? (
          <BulletinEditor
            key={view.session}
            bulletin={editing}
            today={today}
            aiEnabled={aiEnabled}
            onBack={() => setView({ kind: "list" })}
            onSaved={(id) => setView({ kind: "edit", id, session: view.session })}
          />
        ) : (
          <div className="flex flex-1 flex-col gap-3 overflow-auto px-6 pb-6">
            <Button className="self-start" size="sm" onClick={() => open(null)}>
              <PlusIcon data-icon="inline-start" />
              Nuevo comunicado
            </Button>
            <ul className="flex flex-col gap-2">
              {bulletins.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => open(b.id)}
                    className="flex w-full flex-col gap-1.5 rounded-lg border bg-background p-3 text-left hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="text-sm font-medium">{b.subject}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {formatIsoDate(b.date)}
                      <Badge variant="outline">{vigenciaLabel(b.scope, b.cycle)}</Badge>
                      <Badge variant="outline">{b.rules.length} reglas</Badge>
                      {b.archived ? <Badge variant="secondary">Archivado</Badge> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
