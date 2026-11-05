import { getSession } from "@/lib/auth/session";
import { buildOrderWorkbook, orderExportFileName } from "@/lib/orders/exportWorkbook";
import { getLatestOrderRun } from "@/lib/orders/queries";

/** Descarga el último «Pedido sugerido» como .xlsx. Verifica la sesión por sí mismo. */
export async function GET() {
  const session = await getSession();
  if (!session.email) return new Response("No autorizado", { status: 401 });

  const run = await getLatestOrderRun();
  if (!run) return new Response("Todavía no hay un análisis para exportar", { status: 404 });

  return new Response(new Uint8Array(buildOrderWorkbook(run)), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${orderExportFileName(run)}"`,
      "Cache-Control": "no-store",
    },
  });
}
