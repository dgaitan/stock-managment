import { Suspense } from "react";
import { DashboardLayout } from "@/components/templates/dashboard-layout";
import { CalculateButton } from "@/components/organisms/calculate-button";
import { OrderTable } from "@/components/organisms/order-table";
import { UserMenu } from "@/components/organisms/user-menu";
import { WhySheet } from "@/components/organisms/why-sheet";
import { requireSession } from "@/lib/auth/session";
import { formatMonthRangeLabel } from "@/lib/engine/explain";
import { formatIsoDate } from "@/lib/format";
import { getLatestOrderRun } from "@/lib/orders/queries";

// La sesión y la base se leen al servir la petición: van dentro de Suspense
// (cacheComponents no permite acceso dinámico fuera de él).
async function Dashboard() {
  const [session, run] = await Promise.all([requireSession(), getLatestOrderRun()]);

  const subtitle = run
    ? `Ventana ${formatMonthRangeLabel([run.window])}: cierra el ${formatIsoDate(run.windowCloses)} y llega en ${formatMonthRangeLabel([run.arrivalMonth])} · datos al ${formatIsoDate(run.cutoffDate)}`
    : "Importa los datos y calcula el primer análisis.";

  return (
    <DashboardLayout
      userMenu={<UserMenu email={session.email} />}
      title="¿Cuánto pedir a fábrica este ciclo?"
      subtitle={subtitle}
    >
      <OrderTable
        run={run}
        calculateAction={<CalculateButton />}
        renderWhy={(line) => (run ? <WhySheet line={line} run={{ version: run.version, createdAt: run.createdAt, cutoffDate: run.cutoffDate }} /> : null)}
      />
    </DashboardLayout>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-8 text-sm text-muted-foreground">
          Cargando el pedido…
        </p>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
