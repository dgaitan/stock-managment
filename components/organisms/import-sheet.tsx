"use client";

import { AlertTriangleIcon, CheckIcon, FileSpreadsheetIcon, InfoIcon, UploadIcon } from "lucide-react";
import { useRef } from "react";
import { ImportDiffTable } from "@/components/molecules/import-diff-table";
import { InfoTip } from "@/components/molecules/info-tip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useImportSheet } from "@/hooks/use-import-sheet";
import { formatInt, formatShortDate, formatTimestamp, formatWindow } from "@/lib/format";
import type { ImportPreviewView } from "@/lib/import/types";

function cleaningLines(c: ImportPreviewView["cleaning"]): string[] {
  return [
    `Nombres de modelo normalizados a ${formatInt(c.models)} modelos`,
    `${formatInt(c.duplicateInvoices)} facturas duplicadas eliminadas`,
    `${formatInt(c.creditNotes)} notas de crédito aplicadas`,
    `${formatInt(c.duplicateLeads)} leads duplicados eliminados`,
  ];
}

function cutoffLine(preview: ImportPreviewView): string {
  if (!preview.cutoffDate) return "Sin inventario";
  const window = preview.window ? ` · ventana ${formatWindow(preview.window)}` : "";
  return `Corte detectado: ${formatShortDate(preview.cutoffDate)}${window}`;
}

export function ImportSheet() {
  const { state, pending, choose, confirm, reset, acceptWarnings, setReplace } = useImportSheet();
  const input = useRef<HTMLInputElement>(null);
  const { file, preview, error, done, acceptedWarnings, replace } = state;
  const blockedByWarnings = (preview?.warnings.length ?? 0) > 0 && !acceptedWarnings;

  return (
    <Sheet onOpenChange={(isOpen) => (isOpen ? undefined : reset())}>
      <SheetTrigger render={<Button variant="ghost" />}>
        <UploadIcon data-icon="inline-start" />
        Importar Excel
      </SheetTrigger>
      <SheetContent className="sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>Importar Excel</SheetTitle>
          <SheetDescription>Revisa qué cambia en la base antes de confirmar.</SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div className="flex items-center gap-3.5 rounded-[10px] border-[1.5px] border-dashed border-zinc-300 bg-subtle p-4">
            <span className="flex size-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
              <FileSpreadsheetIcon aria-hidden className="size-5" />
            </span>
            <div className="flex-1">
              <div className="font-medium">{file?.name ?? "Ningún archivo"}</div>
              {preview ? <div className="text-xs text-muted-foreground">{cutoffLine(preview)}</div> : null}
            </div>
            <input
              ref={input}
              type="file"
              accept=".xlsx"
              className="sr-only"
              tabIndex={-1}
              aria-label="Archivo Excel"
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

          <div className="flex items-center gap-2 text-[13px] font-medium">
            <label className="flex items-center gap-2">
              <Checkbox checked={replace} disabled={pending || done !== null} onCheckedChange={(checked) => setReplace(checked === true)} />
              Reemplazar datos
            </label>
            <InfoTip label="Qué hace «Reemplazar datos»">
              Cada hoja del archivo reemplaza esa hoja en la base: lo que el archivo ya no trae se elimina. Las hojas que no
              trae, los comunicados y los análisis no se tocan. Desmárcalo para solo agregar y actualizar (el inventario igual se
              reemplaza en los meses que trae el archivo).
            </InfoTip>
          </div>

          {pending && !preview ? (
            <p role="status" className="text-[13px] text-muted-foreground">
              Revisando…
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-[13px] text-destructive">
              {error}
            </p>
          ) : null}

          {preview ? (
            <>
              {preview.previousImportAt ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-info-surface px-3.5 py-3 text-[13px]">
                  <InfoIcon aria-hidden className="size-4 shrink-0 text-primary" />
                  <div>
                    <b>Este archivo ya se importó el {formatTimestamp(new Date(preview.previousImportAt))}.</b>
                    {preview.noop ? " No hay cambios: no se duplicará ni se borrará ninguna fila." : null}
                  </div>
                </div>
              ) : null}
              <ImportDiffTable diff={preview.diff} />
              {preview.warnings.length > 0 ? (
                <section role="alert" className="flex flex-col gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px]">
                  <ul className="flex flex-col gap-1.5">
                    {preview.warnings.map((warning) => (
                      <li key={warning} className="flex items-start gap-2">
                        <AlertTriangleIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-center gap-2 font-medium">
                    <Checkbox
                      checked={acceptedWarnings}
                      disabled={pending || done !== null}
                      onCheckedChange={(checked) => acceptWarnings(checked === true)}
                    />
                    Importar de todos modos
                  </label>
                </section>
              ) : null}
              <section>
                <h3 className="mb-2 text-sm font-semibold">Limpieza aplicada</h3>
                <ul className="flex flex-col gap-2">
                  {cleaningLines(preview.cleaning).map((line) => (
                    <li key={line} className="flex items-center gap-2 text-[13px]">
                      <CheckIcon aria-hidden className="size-3.5 text-green-700" />
                      {line}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}
          {done ? (
            <p role="status" className="flex items-center gap-2 text-sm font-medium text-green-700">
              <CheckIcon aria-hidden className="size-4" />
              {done.noop ? "Sin cambios: no se escribió nada" : "Importación confirmada"}
            </p>
          ) : null}
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" onClick={reset} disabled={pending || !file}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={pending || !preview || preview.noop || done !== null || blockedByWarnings}>
            {pending && preview ? "Importando…" : "Confirmar importación"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
