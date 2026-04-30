import type { Channel, WorkflowStep } from '../types/ocr';

export const stepItems: Array<{ id: WorkflowStep; title: string }> = [
  { id: 1, title: 'Create Case' },
  { id: 2, title: 'Location Input' },
  { id: 3, title: 'Upload Documents' },
  { id: 4, title: 'Start OCR' },
  { id: 5, title: 'OCR Result' },
];

export const docsByChannel: Record<Channel, string[]> = {
  bale: ['ktp', 'kk', 'slip_gaji'],
  branch: ['application_form', 'supporting_document', 'salary_slip', 'other'],
};
