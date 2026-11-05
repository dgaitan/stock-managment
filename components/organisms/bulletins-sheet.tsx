"use client";

import { ArchiveIcon, ArchiveRestoreIcon, FileTextIcon, InfoIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { BulletinEditor } from "@/components/organisms/bulletin-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBulletinsDrawer } from "@/hooks/use-bulletins-drawer";
import { archiveBulletinAction } from "@/lib/bulletins/actions";
import { vigenciaLabel } from "@/lib/bulletins/labels";
import type { BulletinView } from "@/lib/bulletins/types";
import { formatShortDate } from "@/lib/format";

type BulletinsSheetProps = {
  bulletins: BulletinView[];
  aiEnabled: boolean;
  today: string;
};

// session identifica la edición abierta: no cambia al guardar un comunicado nuevo (conserva mensajes y vista previa).
type View = { kind: "list" } | { kind: "edit"; id: number | null; session: number };

export function BulletinsSheet({ bulletins, aiEnabled, today }: BulletinsSheetProps) {
  const drawer = useBulletinsDrawer();
  const [view, setView] = useState<View>({ kind: "list" });
  const [sessions, setSessions] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const edit = (id: number | null) => {
    setSessions((n) => n + 1);
    setView({ kind: "edit", id, session: sessions + 1 });
  };
  const archive = (b: BulletinView) =>
    startTransition(async () => {
      const result = await archiveBulletinAction(b.id, !b.archived);
      setError(result.ok ? null : result.error);
    });
  const active = bulletins.filter((b) => !b.archived).length;
  const editing = view.kind === "edit" ? (bulletins.find((b) => b.id === view.id) ?? null) : null;

  const onOpenChange = (isOpen: boolean) => {
    drawer.setOpen(isOpen);
    if (!isOpen) setView({ kind: "list" });
  };

  return (
    <Sheet open={drawer.open} onOpenChange={onOpenChange}>
      <SheetTrigger render={<Button variant="ghost" />}>
        <FileTextIcon data-icon="inline-start" />
        Comunicados
      </SheetTrigger>
      <SheetContent className="sm:max-w-[680px]">
        <SheetHeader>
          <SheetTitle>Comunicados</SheetTitle>
          <SheetDescription>De aquí salen las reglas del ciclo. La IA las extrae; tú decides cuáles aplican.</SheetDescription>
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
          <SheetBody className="gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-muted-foreground">
                {active} comunicados activos · {bulletins.length - active} archivados
              </span>
              <Button size="sm" onClick={() => edit(null)}>
                <PlusIcon className="size-[15px]" />
                Nuevo comunicado
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <Table size="sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
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
                      <TableCell className="text-muted-foreground tabular-nums">{formatShortDate(b.date)}</TableCell>
                      <TableCell className="py-2.5 whitespace-normal">
                        <div className="font-medium">{b.subject}</div>
                        {b.issuer ? <div className="text-xs text-muted-foreground">{b.issuer}</div> : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{b.rules.length}</TableCell>
                      <TableCell>
                        <Badge variant={b.archived ? "outline" : b.scope === "cycle" ? "blue" : "secondary"}>
                          {b.archived ? "Archivado" : vigenciaLabel(b.scope, b.cycle)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" aria-label={`Editar: ${b.subject}`} onClick={() => edit(b.id)}>
                          <PencilIcon className="size-[15px]" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${b.archived ? "Restaurar" : "Archivar"}: ${b.subject}`}
                          disabled={pending}
                          onClick={() => archive(b)}
                        >
                          {b.archived ? <ArchiveRestoreIcon className="size-[15px]" /> : <ArchiveIcon className="size-[15px]" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {error ? (
              <p role="alert" className="text-[13px] text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex items-start gap-2 rounded-lg border border-border bg-subtle px-3 py-2.5 text-xs text-zinc-600">
              <InfoIcon aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>
                Importar un Excel agrega los comunicados que no existan (por fecha y asunto); nunca borra ni sobrescribe los que
                ya editaste. Archivar no borra: el comunicado deja de aplicar en cálculos nuevos.
              </span>
            </div>
          </SheetBody>
        )}
        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Cerrar</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
