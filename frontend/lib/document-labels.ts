const DOCUMENT_LABELS: Record<string, string> = {
  ktp: 'KTP',
  kk: 'KK',
  npwp: 'NPWP',
  slip_gaji: 'Slip Gaji (Payslip)',
  rekening_koran: 'Rekening Koran (Bank Statement)',
  application_form: 'Application Form',
  supporting_document: 'Supporting Document',
  salary_slip: 'Salary Slip',
  other: 'Other',
};

export function getDocumentLabel(documentType: string): string {
  const normalized = documentType.trim().toLowerCase();
  return DOCUMENT_LABELS[normalized] || documentType;
}
