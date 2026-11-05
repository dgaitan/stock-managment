// Nombre visible de cada hoja de la importación (drawer, CLI y advertencias).

import type { ImportDiff } from "@/lib/import/diff";

export const SHEET_LABELS: Record<keyof ImportDiff, string> = {
  sales: "Ventas",
  inventory: "Inventario",
  leads: "Leads",
  factoryOrders: "Pedidos a fábrica",
  economics: "Economía por modelo",
  bulletins: "Comunicados",
};
