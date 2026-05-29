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
  formulir_aplikasi_kredit: 'Formulir Aplikasi Kredit',
  pas_foto: 'Pas Foto Pemohon',
  surat_pemesanan_rumah: 'Surat Pemesanan Rumah',
  ktp_pasangan: 'KTP Pasangan',
  npwp_pasangan: 'NPWP Pasangan',
  pas_foto_pasangan: 'Pas Foto Pasangan',
  akta_nikah: 'Akta Nikah / Buku Nikah',
  akta_cerai: 'Akta Cerai',
  surat_keterangan_kerja: 'Surat Keterangan Kerja',
  nib: 'NIB',
  laporan_keuangan_usaha: 'Laporan Keuangan Usaha',
  dokumen_informasi_usaha: 'Dokumen Informasi Usaha',
  siup_tdp: 'SIUP / TDP',
  izin_praktik: 'Izin Praktik',
  akte_pendirian: 'Akte Pendirian & Pengesahan',
  sertifikat_tanah: 'Sertifikat Tanah',
  imb: 'IMB / PBG',
  pbb: 'PBB',
  ajb: 'Akta Jual Beli',
  spt_pajak: 'SPT Pajak',
};

export function getDocumentLabel(documentType: string): string {
  const normalized = documentType.trim().toLowerCase();
  return DOCUMENT_LABELS[normalized] || documentType;
}
