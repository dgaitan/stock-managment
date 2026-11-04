import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-8 dark:bg-black">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Pedido Inteligente</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Setup inicial listo (Fase 0). El dashboard, login e importador de
          Excel se construyen en las fases siguientes — ver{" "}
          <code className="rounded bg-black/[.06] px-1 py-0.5 dark:bg-white/[.08]">
            docs/PLAN.md
          </code>
          .
        </CardContent>
      </Card>
    </div>
  );
}
