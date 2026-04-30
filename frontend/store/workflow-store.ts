'use client';

import { create } from 'zustand';
import type { Channel, WorkflowStep } from '../types/ocr';

type WorkflowState = {
  caseId: string;
  channel: Channel;
  currentStep: WorkflowStep;
  setCase: (payload: { caseId: string; channel: Channel }) => void;
  setStep: (step: WorkflowStep) => void;
  reset: () => void;
};

const initialState = {
  caseId: '',
  channel: 'bale' as Channel,
  currentStep: 1 as WorkflowStep,
};

export const useWorkflowStore = create<WorkflowState>()((set) => ({
  ...initialState,
  setCase: ({ caseId, channel }) => set({ caseId, channel }),
  setStep: (currentStep) => set({ currentStep }),
  reset: () => set(initialState),
}));
