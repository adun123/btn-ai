const { v4: uuidv4 } = require('uuid');

const JOB_ID = '550e8400-e29b-41d4-a716-446655440000';

const nasabah = [
  {
    id: uuidv4(),
    fullName: 'BUDI SANTOSO',
    nik: '3201234567890001',
    documentCount: 7,
    completenessScore: 0.88,
    missing: ['Surat Pemesanan Rumah', 'Pas Foto Pemohon'],
    warnings: ['Slip Gaji: baru 2 bulan, butuh minimal 3'],
  },
  {
    id: uuidv4(),
    fullName: 'SITI RAHAYU',
    nik: '3202345678901234',
    documentCount: 4,
    completenessScore: 0.5,
    missing: ['Rekening Koran Tabungan', 'NPWP Pemohon', 'Kartu Keluarga'],
    warnings: [],
  },
  {
    id: uuidv4(),
    fullName: 'AHMAD FAUZI',
    nik: '3203456789012345',
    documentCount: 6,
    completenessScore: 0.75,
    missing: ['Surat Keterangan Kerja', 'IMB'],
    warnings: ['Rekening Koran: baru 2 bulan, butuh minimal 3'],
  },
];

const documents = [
  // Budi
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[0].id, documentType: 'ktp', filename: 'budi_ktp.png', pageCount: 1, confidence: 0.95, fields: [
    { key: 'Nama Lengkap', value: 'BUDI SANTOSO', confidence: 0.98 },
    { key: 'NIK', value: '3201234567890001', confidence: 0.99 },
    { key: 'Tempat/Tgl Lahir', value: 'Bogor, 15-03-1990', confidence: 0.95 },
    { key: 'Alamat', value: 'Jl. Raya Pajajaran No. 12, Bogor', confidence: 0.93 },
    { key: 'Pekerjaan', value: 'Karyawan Swasta', confidence: 0.97 },
  ]},
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[0].id, documentType: 'kk', filename: 'budi_kk.pdf', pageCount: 2, confidence: 0.91, fields: [
    { key: 'Nomor KK', value: '3201010101200001', confidence: 0.96 },
    { key: 'Kepala Keluarga', value: 'BUDI SANTOSO', confidence: 0.94 },
    { key: 'Alamat', value: 'Jl. Raya Pajajaran No. 12, Bogor', confidence: 0.91 },
  ]},
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[0].id, documentType: 'npwp', filename: 'budi_npwp.png', pageCount: 1, confidence: 0.93, fields: [
    { key: 'NPWP', value: '09.876.543.2-123.000', confidence: 0.95 },
    { key: 'Nama', value: 'BUDI SANTOSO', confidence: 0.97 },
  ]},
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[0].id, documentType: 'slip_gaji', filename: 'budi_slip1.pdf', pageCount: 1, confidence: 0.89, fields: [
    { key: 'Nama Karyawan', value: 'BUDI SANTOSO', confidence: 0.92 },
    { key: 'Periode', value: 'April 2026', confidence: 0.95 },
    { key: 'Gaji Pokok', value: 'Rp 8.500.000', confidence: 0.88 },
    { key: 'Total Diterima', value: 'Rp 10.200.000', confidence: 0.86 },
  ]},
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[0].id, documentType: 'slip_gaji', filename: 'budi_slip2.pdf', pageCount: 1, confidence: 0.87, fields: [
    { key: 'Nama Karyawan', value: 'BUDI SANTOSO', confidence: 0.91 },
    { key: 'Periode', value: 'Maret 2026', confidence: 0.94 },
    { key: 'Gaji Pokok', value: 'Rp 8.500.000', confidence: 0.87 },
    { key: 'Total Diterima', value: 'Rp 9.800.000', confidence: 0.85 },
  ]},
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[0].id, documentType: 'rekening_koran', filename: 'budi_rekening.pdf', pageCount: 5, confidence: 0.85, fields: [
    { key: 'Nama Pemilik', value: 'BUDI SANTOSO', confidence: 0.93 },
    { key: 'No. Rekening', value: '1234567890', confidence: 0.96 },
    { key: 'Bank', value: 'Bank BTN', confidence: 0.99 },
    { key: 'Periode', value: 'Maret - April 2026', confidence: 0.88 },
    { key: 'Saldo Akhir', value: 'Rp 45.320.000', confidence: 0.84 },
  ]},
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[0].id, documentType: 'sertifikat_tanah', filename: 'budi_sertifikat.pdf', pageCount: 3, confidence: 0.82, fields: [
    { key: 'Jenis Hak', value: 'Hak Milik', confidence: 0.90 },
    { key: 'No. Sertifikat', value: '01234/2020', confidence: 0.85 },
    { key: 'Luas', value: '120 m²', confidence: 0.88 },
  ]},
  // Siti
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[1].id, documentType: 'ktp', filename: 'siti_ktp.png', pageCount: 1, confidence: 0.94, fields: [
    { key: 'Nama Lengkap', value: 'SITI RAHAYU', confidence: 0.97 },
    { key: 'NIK', value: '3202345678901234', confidence: 0.99 },
    { key: 'Tempat/Tgl Lahir', value: 'Jakarta, 22-07-1992', confidence: 0.94 },
    { key: 'Alamat', value: 'Jl. Mawar No. 5, Jakarta Selatan', confidence: 0.91 },
  ]},
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[1].id, documentType: 'slip_gaji', filename: 'siti_slip.pdf', pageCount: 1, confidence: 0.88, fields: [
    { key: 'Nama Karyawan', value: 'SITI RAHAYU', confidence: 0.93 },
    { key: 'Periode', value: 'April 2026', confidence: 0.95 },
    { key: 'Total Diterima', value: 'Rp 7.500.000', confidence: 0.87 },
  ]},
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[1].id, documentType: 'akta_nikah', filename: 'siti_akta_nikah.pdf', pageCount: 2, confidence: 0.90, fields: [
    { key: 'Nama Suami', value: 'AHMAD WIJAYA', confidence: 0.92 },
    { key: 'Nama Istri', value: 'SITI RAHAYU', confidence: 0.95 },
    { key: 'Tanggal Nikah', value: '10-01-2020', confidence: 0.89 },
  ]},
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[1].id, documentType: 'spt_pajak', filename: 'siti_spt.pdf', pageCount: 3, confidence: 0.86, fields: [
    { key: 'Tahun Pajak', value: '2025', confidence: 0.97 },
    { key: 'Nama WP', value: 'SITI RAHAYU', confidence: 0.94 },
    { key: 'Penghasilan Neto', value: 'Rp 90.000.000', confidence: 0.85 },
  ]},
  // Ahmad
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[2].id, documentType: 'ktp', filename: 'ahmad_ktp.png', pageCount: 1, confidence: 0.96, fields: [
    { key: 'Nama Lengkap', value: 'AHMAD FAUZI', confidence: 0.98 },
    { key: 'NIK', value: '3203456789012345', confidence: 0.99 },
    { key: 'Tempat/Tgl Lahir', value: 'Bandung, 05-11-1988', confidence: 0.96 },
    { key: 'Alamat', value: 'Jl. Cihampelas No. 88, Bandung', confidence: 0.94 },
  ]},
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[2].id, documentType: 'kk', filename: 'ahmad_kk.pdf', pageCount: 2, confidence: 0.90, fields: [
    { key: 'Nomor KK', value: '3203010505198800', confidence: 0.93 },
    { key: 'Kepala Keluarga', value: 'AHMAD FAUZI', confidence: 0.95 },
  ]},
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[2].id, documentType: 'npwp', filename: 'ahmad_npwp.png', pageCount: 1, confidence: 0.92, fields: [
    { key: 'NPWP', value: '12.345.678.9-012.000', confidence: 0.94 },
    { key: 'Nama', value: 'AHMAD FAUZI', confidence: 0.96 },
  ]},
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[2].id, documentType: 'slip_gaji', filename: 'ahmad_slip.pdf', pageCount: 1, confidence: 0.88, fields: [
    { key: 'Nama Karyawan', value: 'AHMAD FAUZI', confidence: 0.92 },
    { key: 'Periode', value: 'April 2026', confidence: 0.95 },
    { key: 'Total Diterima', value: 'Rp 12.000.000', confidence: 0.87 },
  ]},
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[2].id, documentType: 'rekening_koran', filename: 'ahmad_rekening.pdf', pageCount: 4, confidence: 0.84, fields: [
    { key: 'Nama Pemilik', value: 'AHMAD FAUZI', confidence: 0.93 },
    { key: 'No. Rekening', value: '9876543210', confidence: 0.95 },
    { key: 'Saldo Akhir', value: 'Rp 67.800.000', confidence: 0.83 },
  ]},
  { id: uuidv4(), jobId: JOB_ID, nasabahId: nasabah[2].id, documentType: 'pbb', filename: 'ahmad_pbb.pdf', pageCount: 1, confidence: 0.91, fields: [
    { key: 'NOP', value: '32.03.010.005.001-0001.0', confidence: 0.90 },
    { key: 'Nama WP', value: 'AHMAD FAUZI', confidence: 0.94 },
    { key: 'Luas Tanah', value: '150 m²', confidence: 0.88 },
  ]},
];

const pages = documents.flatMap((doc) =>
  Array.from({ length: doc.pageCount }, (_, i) => ({
    id: uuidv4(),
    jobId: JOB_ID,
    documentId: doc.id,
    pageNumber: i + 1,
    ocrText: `[Mock OCR text for ${doc.filename} page ${i + 1}]`,
    confidence: doc.confidence - (i * 0.02),
    createdAt: '2026-05-25T09:30:00.000Z',
  }))
);

const completedJob = {
  id: JOB_ID,
  status: 'completed',
  uploadType: 'zip',
  totalFiles: 3,
  totalPages: pages.length,
  processedPages: pages.length,
  failedPages: 0,
  batchCount: 3,
  batchSize: 20,
  createdAt: '2026-05-25T09:30:00.000Z',
  completedAt: '2026-05-25T09:30:32.000Z',
};

module.exports = { JOB_ID, nasabah, documents, pages, completedJob };
