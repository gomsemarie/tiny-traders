import { create } from 'zustand';

interface GameState {
  /** 현재 선택된 캐릭터 슬롯 인덱스 */
  selectedSlot: number | null;
  /** 관리자 모드 여부 */
  isAdminMode: boolean;
  /** UI 모달 상태 */
  activeModal: string | null;

  // Actions
  selectSlot: (slot: number | null) => void;
  toggleAdminMode: () => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  selectedSlot: null,
  isAdminMode: false,
  activeModal: null,

  selectSlot: (slot) => set({ selectedSlot: slot }),
  toggleAdminMode: () => set((s) => ({ isAdminMode: !s.isAdminMode })),
  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),
}));
