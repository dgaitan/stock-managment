import { DownloadIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

const EXPORT_URL = "/api/pedido/export";

/** Descarga el último pedido sugerido en Excel; deshabilitado si aún no hay análisis. */
export function ExportOrderButton({ disabled }: { disabled: boolean }) {
  if (disabled) {
    return (
      <Button variant="secondary" disabled>
        <DownloadIcon data-icon="inline-start" />
        Exportar pedido sugerido
      </Button>
    );
  }
  return (
    <a href={EXPORT_URL} download className={buttonVariants({ variant: "secondary" })}>
      <DownloadIcon data-icon="inline-start" />
      Exportar pedido sugerido
    </a>
  );
}
