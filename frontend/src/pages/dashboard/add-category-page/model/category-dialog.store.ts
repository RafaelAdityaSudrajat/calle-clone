import { create } from "zustand";
import type { Category } from "@/entities/category";

type DialogState =
  | { type: "closed" }
  | { type: "create" }
  | { type: "edit"; category: Category }
  | { type: "delete"; category: Category };

interface CategoryDialogStore {
  dialog: DialogState;
  openCreate: () => void;
  openEdit: (category: Category) => void;
  openDelete: (category: Category) => void;
  close: () => void;
}

export const useCategoryDialogStore = create<CategoryDialogStore>()((set) => ({
  dialog: { type: "closed" },
  openCreate: () => set({ dialog: { type: "create" } }),
  openEdit: (category) => set({ dialog: { type: "edit", category } }),
  openDelete: (category) => set({ dialog: { type: "delete", category } }),
  close: () => set({ dialog: { type: "closed" } }),
}));
