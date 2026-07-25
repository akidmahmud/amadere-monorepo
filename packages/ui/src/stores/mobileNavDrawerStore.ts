"use client";

import { create } from "zustand";

export interface MobileNavDrawerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useMobileNavDrawerStore = create<MobileNavDrawerState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
