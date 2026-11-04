// Puro, sin Next/React/DB. Lo mínimo que el motor lee de cada hecho. Tanto el
// parser del Excel (`Normalized*`) como el cargador de la base producen filas
// que cumplen estos tipos, así el motor no sabe de dónde vino el dato.

import type {
  NormalizedFactoryOrder,
  NormalizedInventorySnapshot,
  NormalizedLead,
  NormalizedSale,
} from "@/lib/sources/types";

export type EngineSale = Pick<NormalizedSale, "date" | "modelName" | "units" | "isFleetOutlier">;

export type EngineLead = Pick<
  NormalizedLead,
  "closedAt" | "modelName" | "units" | "result" | "lossReasonCategory" | "boughtModelName"
>;

export type EngineInventoryRow = Pick<NormalizedInventorySnapshot, "monthEnd" | "modelName" | "units">;

export type EngineFactoryOrder = Pick<
  NormalizedFactoryOrder,
  "modelName" | "orderDate" | "units" | "eta" | "receivedAt"
>;

export interface EngineData {
  sales: EngineSale[];
  leads: EngineLead[];
  inventory: EngineInventoryRow[];
  factoryOrders: EngineFactoryOrder[];
}
