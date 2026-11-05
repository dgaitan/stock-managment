"use client";

import { FileTextIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { InfoTip } from "@/components/molecules/info-tip";
import { BulletinEditor } from "@/components/organisms/bulletin-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const active = bulletins.filter((b) => !b.archived).length;
  const editing = view.kind === "edit" ? (bulletins.find((b) => b.id === view.id) ?? null) : null;

  return (
    <Sheet onOpenChange={(isOpen) => (isOpen ? undefined : setView({ kind: "list" }))}>
      <SheetTrigger render={<Button variant="ghost" size="sm" />}>
        <FileTextIcon data-icon="inline-start" />
        Comunicados
      </SheetTrigger>
      <SheetContent className="data-[side=right]:sm:max-w-[680px]">
        <SheetHeader className="border-b p-6">
          <SheetTitle className="text-lg">Comunicados de fábrica</SheetTitle>
          <SheetDescription>De aquí salen las reglas del ciclo</SheetDescription>
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
          <div className="flex flex-1 flex-col gap-4 overflow-auto px-6 pb-6">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
                {active} activos · {bulletins.length - active} archivados
                <InfoTip label="Cómo funcionan los comunicados">
                  Importar un Excel solo agrega los comunicados que no existen (fecha y asunto). Archivar no borra: sus
                  reglas dejan de aplicarse en cálculos nuevos.
                </InfoTip>
              </span>
              <Button size="sm" onClick={() => open(null)}>
                <PlusIcon data-icon="inline-start" />
                Nuevo comunicado
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-3">Fecha</TableHead>
                    <TableHead>Asunto</TableHead>
                    <TableHead className="text-right">Reglas</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulletins.map((b) => (
                    <TableRow key={b.id} className={b.archived ? "opacity-60" : undefined}>
                      <TableCell className="pl-3 whitespace-nowrap text-muted-foreground tabular-nums">{formatIsoDate(b.date)}</TableCell>
                      <TableCell className="whitespace-normal py-2.5">
                        <div className="font-medium">{b.subject}</div>
                        {b.issuer ? <div className="text-xs text-muted-foreground">{b.issuer}</div> : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{b.rules.length}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={b.scope === "cycle" ? "border-blue-200 bg-blue-100 text-blue-900" : undefined}>
                          {b.archived ? "Archivado" : vigenciaLabel(b.scope, b.cycle)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" aria-label={`Editar: ${b.subject}`} onClick={() => open(b.id)}>
                          <PencilIcon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
