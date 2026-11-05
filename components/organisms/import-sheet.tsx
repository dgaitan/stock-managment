"use client";

import { CheckIcon, FileSpreadsheetIcon, InfoIcon, UploadIcon } from "lucide-react";
import { useRef } from "react";
import { ImportDiffTable } from "@/components/molecules/import-diff-table";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useImportSheet } from "@/hooks/use-import-sheet";
import { formatInt, formatIsoDate, formatTimestamp } from "@/lib/format";
import type { ImportPreviewView } from "@/lib/import/types";

function cleaningLines(c: ImportPreviewView["cleaning"]): string[] {
  return [
    `Modelos normalizados a ${formatInt(c.models)}`,
    `${formatInt(c.duplicateInvoices)} facturas duplicadas eliminadas`,
    `${formatInt(c.creditNotes)} notas de crédito aplicadas`,
    `${formatInt(c.duplicateLeads)} leads duplicados eliminados`,
  ];
}

export function ImportSheet() {
  const { state, pending, choose, confirm, reset } = useImportSheet();
  const input = useRef<HTMLInputElement>(null);
  const { file, preview, error, done } = state;

  return (
    <Sheet onOpenChange={(isOpen) => (isOpen ? undefined : reset())}>
      <SheetTrigger render={<Button variant="ghost" size="sm" />}>
        <UploadIcon data-icon="inline-start" />
        Importar Excel
      </SheetTrigger>
      <SheetContent className="data-[side=right]:sm:max-w-[560px]">
        <SheetHeader className="border-b p-6">
          <SheetTitle className="text-lg">Importar Excel</SheetTitle>
          <SheetDescription>Revisa qué cambia antes de confirmar</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-auto p-6">
          <div className="flex items-center gap-3.5 rounded-lg border border-dashed bg-muted/40 p-4">
            <span className="flex size-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
              <FileSpreadsheetIcon aria-hidden className="size-5" />
            </span>
            <div className="flex-1">
              <div className="font-medium">{file?.name ?? "Ningún archivo"}</div>
              {preview ? (
                <div className="text-xs text-muted-foreground">
                  {preview.cutoffDate ? `Corte detectado: ${formatIsoDate(preview.cutoffDate)}` : "Sin inventario"}
                </div>
              ) : null}
            </div>
            <input
              ref={input}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                if (chosen) choose(chosen);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" disabled={pending} onClick={() => input.current?.click()}>
              {file ? "Cambiar archivo" : "Elegir archivo"}
            </Button>
          </div>

          {pending && !preview ? (
            <p role="status" className="text-sm text-muted-foreground">
              Revisando…
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {preview ? (
            <>
              {preview.previousImportAt ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-3 text-[13px]">
                  <InfoIcon aria-hidden className="mt-0.5 size-4 text-primary" />
                  <span>
                    <b>Este archivo ya se importó el {formatTimestamp(new Date(preview.previousImportAt))}.</b>
                    {preview.noop ? " No hay cambios." : null}
                  </span>
                </div>
              ) : null}
              <ImportDiffTable diff={preview.diff} />
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Limpieza aplicada</h3>
                <ul className="flex flex-col gap-2">
                  {cleaningLines(preview.cleaning).map((line) => (
                    <li key={line} className="flex items-center gap-2 text-[13px]">
                      <CheckIcon aria-hidden className="size-3.5 text-green-700" />
                      {line}
                    </li>
                  ))}
                </ul>
                {preview.cleaning.unmappedModels.length > 0 ? (
                  <p role="alert" className="text-xs text-destructive">
                    Modelos sin mapear: {preview.cleaning.unmappedModels.join(", ")}
                  </p>
                ) : null}
              </section>
            </>
          ) : null}
          {done ? (
            <p role="status" className="flex items-center gap-2 text-sm font-medium text-green-700">
              <CheckIcon aria-hidden className="size-4" />
              {done.noop ? "Sin cambios: no se escribió nada" : "Importación confirmada"}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t bg-background p-4 px-6">
          <Button variant="outline" onClick={reset} disabled={pending || !file}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={pending || !preview || preview.noop || done !== null}>
            {pending && preview ? "Importando…" : "Confirmar importación"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
