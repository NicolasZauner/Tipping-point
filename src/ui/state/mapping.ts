import { create } from "zustand";
import type { MappingRow } from "../../model/classMapping";

export type ConfirmedMapping = { rows: MappingRow[]; aiRows: number; editedRows: number };

/** The mapping a person confirmed this visit. Volumes by class (TP P9) read it from here. */
export const useConfirmedMapping = create<{
  confirmed: ConfirmedMapping | null;
  confirm: (m: ConfirmedMapping) => void;
  clear: () => void;
}>((set) => ({
  confirmed: null,
  confirm: (confirmed) => set({ confirmed }),
  clear: () => set({ confirmed: null }),
}));
