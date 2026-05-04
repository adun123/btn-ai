import type { Channel, WorkflowStep } from '../types/ocr';

export const stepItems: Array<{ id: WorkflowStep; title: string }> = [
  { id: 1, title: 'Create Case' },
  { id: 2, title: 'Upload Documents' },
  { id: 3, title: 'Start OCR' },
  { id: 4, title: 'OCR Result' },
];

export const docsByChannel: Record<Channel, string[]> = {
  bale: ['ktp', 'kk', 'npwp', 'slip_gaji', 'rekening_koran'],
  branch: ['application_form', 'supporting_document', 'salary_slip', 'other'],
};
