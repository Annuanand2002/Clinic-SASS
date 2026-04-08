export type InventoryCategory = 'consumable' | 'medicine' | 'equipment';

export interface InventoryMetaDto {
  categories: Array<{ value: string; label: string }>;
  units: Array<{ value: string; label: string }>;
}

export interface InventoryItemDto {
  id: number;
  name: string;
  category: InventoryCategory;
  description?: string;
  unit: string;
  minStock: number;
  isActive: boolean;
  totalQuantity?: number;
}

export interface InventoryItemAvailabilityDto {
  itemId: number;
  available: number;
  totalRemainingAllBatches: number;
  nearestUsableExpiry: string | null;
  expiringWithinDays: boolean;
  hasOnlyExpiredRemaining: boolean;
}

export interface InventoryBatchRowDto {
  stockId: number;
  itemId: number;
  itemName: string;
  batchNumber: string;
  remainingQuantity: number;
  purchaseDate: string | null;
  expiryDate: string | null;
}

export interface InventorySummaryRow {
  itemId: number;
  name: string;
  category: string;
  unit: string;
  minStock: number;
  totalQuantity: number;
  isLowStock: boolean;
}

export interface BillLinePayload {
  itemName: string;
  quantity: number;
  price: number;
  inventoryItemId?: number | null;
}
