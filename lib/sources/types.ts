// Registros normalizados que entregan los adaptadores de entrada
// (Excel, manual y a futuro ERP) al pipeline. Todos los adaptadores
// producen esta misma forma para que el resto del sistema no sepa de
// dónde vino el dato.

// businessKey identifica la fila entre importaciones; lineHash, su contenido
// (si cambia, la fila se actualiza en vez de duplicarse).
export interface NormalizedSale {
  invoice: string;
  businessKey: string;
  lineHash: string;
  date: string; // ISO yyyy-mm-dd
  branchNameRaw: string | null;
  branchName: string | null;
  seller: string | null;
  customerType: string | null;
  customer: string | null;
  modelNameRaw: string;
  modelName: string | null; // null si no se pudo normalizar contra el catálogo
  version: string | null;
  color: string | null;
  units: number;
  unitPrice: number | null;
  note: string | null;
  isCreditNote: boolean;
  isFleetOutlier: boolean;
}

export interface NormalizedInventorySnapshot {
  monthEnd: string; // ISO yyyy-mm-dd, último día del mes
  modelNameRaw: string;
  modelName: string | null;
  version: string | null;
  color: string | null;
  units: number;
  avgAgeDays: number | null;
}

export interface NormalizedLead {
  externalId: string;
  lineHash: string;
  createdAt: string | null;
  closedAt: string | null;
  branchNameRaw: string | null;
  branchName: string | null;
  seller: string | null;
  customerType: string | null;
  modelNameRaw: string;
  modelName: string | null;
  version: string | null;
  units: number;
  result: string | null;
  lossReasonRaw: string | null;
  lossReasonCategory: string | null;
  boughtModelNameRaw: string | null;
  boughtModelName: string | null;
  boughtVersion: string | null;
}

export interface NormalizedFactoryOrder {
  orderNo: string;
  businessKey: string;
  lineHash: string;
  orderDate: string | null;
  modelNameRaw: string;
  modelName: string | null;
  version: string | null;
  color: string | null;
  units: number;
  eta: string | null;
  status: string | null;
  receivedAt: string | null;
}

export interface NormalizedBulletin {
  date: string | null;
  issuer: string | null;
  subject: string | null;
  body: string | null;
}

export interface NormalizedModelEconomics {
  modelNameRaw: string;
  modelName: string | null;
  avgPrice: number | null;
  marginPct: number | null;
  avgUnitCost: number | null;
  monthlyFinCostPerUnit: number | null;
  agingDiscountPolicyRaw: string | null;
}

export interface ImportStats {
  modelosDetectados: number;
  modelosNoMapeados: string[];
  filasModeloSinMapear: number; // filas de cualquier hoja cuyo modelo no se pudo mapear (quedan fuera del cálculo)
  motivosNoMapeados: string[];
  leadsMotivoSinMapear: number; // leads con un motivo de pérdida que no está en el diccionario
  ventasFilasLeidas: number;
  ventasDuplicadosEliminados: number;
  ventasNotasCreditoAplicadas: number;
  leadsDuplicadosEliminados: number;
}

/** Qué hojas trae el archivo, con las mismas claves que `NormalizedImport`. Una hoja ausente no se toca. */
export type PresentSheets = Record<"sales" | "inventory" | "leads" | "factoryOrders" | "bulletins" | "economics", boolean>;

export interface NormalizedImport {
  present: PresentSheets;
  sales: NormalizedSale[];
  inventory: NormalizedInventorySnapshot[];
  leads: NormalizedLead[];
  factoryOrders: NormalizedFactoryOrder[];
  bulletins: NormalizedBulletin[];
  economics: NormalizedModelEconomics[];
  stats: ImportStats;
}
