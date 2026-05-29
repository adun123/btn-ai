/**
 * Document Classification Service
 *
 * Classifies OCR text into document types using rule-based keyword/pattern matching.
 * Falls back to LLM (Gemini) for ambiguous cases.
 *
 * Supported document types:
 *   ktp, kk, slip_gaji, npwp, rekening_koran, sertifikat_tanah,
 *   imb, pbb, ajb, akta_nikah, akta_cerai, spt_pajak,
 *   surat_keterangan_kerja, foto_properti, denah, unknown
 */

const DOCUMENT_TYPES = {
  kk: {
    keywords: ['kartu keluarga', 'kepala keluarga', 'nomor kk', 'no. kk', 'anggota keluarga', 'hubungan keluarga', 'desa/kelurahan', 'kabupaten/kota', 'status hubungan', 'dalam keluarga', 'nama orang tua'],
    exclusiveKeywords: ['kartu keluarga', 'kepala keluarga', 'status hubungan', 'dalam keluarga', 'nama orang tua'],
    negativeKeywords: ['kartu tanda penduduk', 'berlaku hingga'],
    patterns: [/KARTU KELUARGA/i, /No\.?\s*KK/i, /Kepala Keluarga/i, /KEPALA KELUARGA/i, /Status Hubungan.*Dalam Keluarga/is, /ANAK|ISTERI|ISTRI|KEPALA KELU?ARGA/i],
    weight: 1.2,
    priority: 10,
  },
  ktp: {
    keywords: ['kartu tanda penduduk', 'berlaku hingga', 'tempat/tgl lahir', 'gol. darah'],
    exclusiveKeywords: ['kartu tanda penduduk', 'berlaku hingga', 'gol. darah'],
    negativeKeywords: ['kartu keluarga', 'kepala keluarga', 'status hubungan dalam keluarga', 'nama orang tua'],
    patterns: [/KARTU TANDA PENDUDUK/i, /berlaku\s*hingga/i, /gol\.?\s*darah/i],
    weight: 1.0,
    priority: 5,
  },
  slip_gaji: {
    keywords: ['slip gaji', 'gaji pokok', 'tunjangan', 'potongan', 'take home pay', 'netto', 'bruto', 'upah', 'honorarium', 'lembur', 'bpjs', 'pph 21', 'periode gaji'],
    patterns: [/gaji\s*pokok/i, /take\s*home\s*pay/i, /tunjangan/i, /potongan/i, /slip\s*gaji/i, /payslip/i],
    weight: 1.0,
  },
  npwp: {
    keywords: ['npwp', 'nomor pokok wajib pajak', 'direktorat jenderal pajak', 'terdaftar'],
    patterns: [/NPWP/i, /\d{2}\.\d{3}\.\d{3}\.\d[\-\.]\d{3}\.\d{3}/, /Nomor Pokok Wajib Pajak/i],
    weight: 1.0,
  },
  rekening_koran: {
    keywords: ['rekening koran', 'bank statement', 'saldo', 'debit', 'kredit', 'mutasi', 'tanggal transaksi', 'nomor rekening', 'saldo awal', 'saldo akhir'],
    patterns: [/rekening\s*koran/i, /bank\s*statement/i, /saldo\s*(awal|akhir)/i, /mutasi/i],
    weight: 1.0,
  },
  sertifikat_tanah: {
    keywords: ['sertifikat', 'badan pertanahan nasional', 'hak milik', 'hak guna bangunan', 'surat ukur', 'luas tanah', 'bpn', 'agraria'],
    patterns: [/Badan Pertanahan/i, /Hak (Milik|Guna Bangunan)/i, /Sertifikat/i, /surat\s*ukur/i],
    weight: 1.0,
  },
  imb: {
    keywords: ['izin mendirikan bangunan', 'imb', 'persetujuan bangunan gedung', 'pbg', 'mendirikan bangunan'],
    patterns: [/IMB/i, /izin\s*mendirikan\s*bangunan/i, /PBG/i, /persetujuan\s*bangunan/i],
    weight: 1.0,
  },
  pbb: {
    keywords: ['pajak bumi dan bangunan', 'pbb', 'sppt', 'nop', 'objek pajak', 'tahun pajak'],
    patterns: [/PBB/i, /SPPT/i, /pajak\s*bumi/i, /NOP\s*[:\-]?\s*\d/i],
    weight: 1.0,
  },
  ajb: {
    keywords: ['akta jual beli', 'ppat', 'penjual', 'pembeli', 'notaris', 'jual beli'],
    patterns: [/Akta Jual Beli/i, /PPAT/i, /penjual.*pembeli/i],
    weight: 1.0,
  },
  akta_nikah: {
    keywords: ['akta nikah', 'kutipan akta nikah', 'kantor urusan agama', 'kua', 'suami', 'isteri', 'perkawinan'],
    patterns: [/akta\s*nikah/i, /Kantor Urusan Agama/i, /KUA/i, /perkawinan/i],
    weight: 1.0,
  },
  akta_cerai: {
    keywords: ['akta cerai', 'perceraian', 'pengadilan agama', 'putusan'],
    patterns: [/akta\s*cerai/i, /perceraian/i, /pengadilan\s*agama/i],
    weight: 1.0,
  },
  spt_pajak: {
    keywords: ['spt', 'surat pemberitahuan', 'pajak penghasilan', 'formulir 1770', 'tahun pajak', 'dirjen pajak'],
    patterns: [/SPT/i, /1770/i, /surat\s*pemberitahuan/i, /pajak\s*penghasilan/i],
    weight: 1.0,
  },
  surat_keterangan_kerja: {
    keywords: ['surat keterangan', 'menerangkan bahwa', 'karyawan', 'jabatan', 'sejak tanggal', 'perusahaan'],
    patterns: [/surat\s*keterangan/i, /menerangkan\s*bahwa/i],
    weight: 0.8,
  },
  formulir_aplikasi_kredit: {
    keywords: ['formulir aplikasi', 'aplikasi kredit', 'permohonan kredit', 'pengajuan kredit', 'data pemohon', 'fasilitas kredit'],
    patterns: [/formulir\s*aplikasi/i, /aplikasi\s*kredit/i, /permohonan\s*kredit/i],
    weight: 1.0,
  },
  pas_foto: {
    keywords: ['pas foto', 'photo', 'pas photo'],
    patterns: [/pas\s*foto/i],
    weight: 0.6,
  },
  surat_pemesanan_rumah: {
    keywords: ['surat pemesanan', 'pemesanan rumah', 'booking', 'unit rumah', 'kavling', 'developer', 'perumahan'],
    patterns: [/surat\s*pemesanan/i, /pemesanan\s*rumah/i],
    weight: 1.0,
  },
  nib: {
    keywords: ['nomor induk berusaha', 'nib', 'oss', 'online single submission', 'perizinan berusaha'],
    patterns: [/NIB/i, /nomor\s*induk\s*berusaha/i, /OSS/i],
    weight: 1.0,
  },
  laporan_keuangan_usaha: {
    keywords: ['laporan keuangan', 'catatan keuangan', 'neraca', 'laba rugi', 'pendapatan usaha', 'omzet'],
    patterns: [/laporan\s*keuangan/i, /laba\s*rugi/i, /neraca/i],
    weight: 1.0,
  },
  dokumen_informasi_usaha: {
    keywords: ['informasi usaha', 'profil usaha', 'alamat usaha', 'lokasi usaha', 'waktu operasional', 'foto usaha'],
    patterns: [/informasi\s*usaha/i, /profil\s*usaha/i, /lokasi\s*usaha/i],
    weight: 1.0,
  },
  siup_tdp: {
    keywords: ['siup', 'tdp', 'surat izin usaha', 'tanda daftar perusahaan', 'izin usaha perdagangan'],
    patterns: [/SIUP/i, /TDP/i, /surat\s*izin\s*usaha/i, /tanda\s*daftar\s*perusahaan/i],
    weight: 1.0,
  },
  izin_praktik: {
    keywords: ['izin praktik', 'surat izin praktik', 'str', 'sip', 'asosiasi profesi', 'profesi'],
    patterns: [/izin\s*praktik/i, /surat\s*izin\s*praktik/i],
    weight: 1.0,
  },
  akte_pendirian: {
    keywords: ['akte pendirian', 'akta pendirian', 'pengesahan', 'depkumham', 'kemenkumham', 'badan hukum'],
    patterns: [/akt[ae]\s*pendirian/i, /DEPKUMHAM/i, /KEMENKUMHAM/i],
    weight: 1.0,
  },
};

/**
 * Classify a single page's OCR text.
 * @param {string} ocrText - Full OCR text of the page
 * @returns {{ documentType: string, confidence: number, method: string, matchedKeywords: string[] }}
 */
function classifyText(ocrText) {
  const results = classifyTextMulti(ocrText);
  return results[0] || { documentType: 'unknown', confidence: 0, method: 'empty_text', matchedKeywords: [] };
}

/**
 * Score all document types against OCR text.
 * @returns {Array<[string, { score: number, matchedKeywords: string[], priority: number }]>} sorted by score desc
 */
function scoreDocumentTypes(ocrText) {
  const textLower = ocrText.toLowerCase();
  const scores = {};

  for (const [docType, config] of Object.entries(DOCUMENT_TYPES)) {
    let score = 0;
    const matchedKeywords = [];

    const negatives = config.negativeKeywords || [];
    let negativePenalty = 0;
    for (const neg of negatives) {
      if (textLower.includes(neg.toLowerCase())) {
        negativePenalty += 5;
      }
    }

    const exclusives = config.exclusiveKeywords || [];
    for (const keyword of exclusives) {
      if (textLower.includes(keyword.toLowerCase())) {
        score += 4;
        matchedKeywords.push(keyword);
      }
    }

    for (const keyword of config.keywords) {
      if (exclusives.includes(keyword)) continue;
      if (textLower.includes(keyword.toLowerCase())) {
        score += 1;
        matchedKeywords.push(keyword);
      }
    }

    for (const pattern of config.patterns) {
      if (pattern.test(ocrText)) {
        score += 2;
      }
    }

    score = (score * (config.weight || 1.0)) - negativePenalty;

    if (score > 0) {
      scores[docType] = { score, matchedKeywords, priority: config.priority || 0 };
    }
  }

  return Object.entries(scores).sort((a, b) => {
    if (b[1].score !== a[1].score) return b[1].score - a[1].score;
    return b[1].priority - a[1].priority;
  });
}

/** Minimum score for a type to be considered detected on a multi-doc page */
const MULTI_DOC_THRESHOLD = 3;

/**
 * Classify a page's OCR text, returning ALL document types detected above threshold.
 * Handles cases where one scanned page contains multiple physical documents (e.g. 2 KTP + 1 NPWP).
 * @param {string} ocrText
 * @returns {Array<{ documentType: string, confidence: number, method: string, matchedKeywords: string[] }>}
 */
function classifyTextMulti(ocrText) {
  if (!ocrText || ocrText.trim().length < 10) {
    return [{ documentType: 'unknown', confidence: 0, method: 'empty_text', matchedKeywords: [] }];
  }

  const sorted = scoreDocumentTypes(ocrText);

  if (sorted.length === 0) {
    return [{ documentType: 'unknown', confidence: 0, method: 'rule_based', matchedKeywords: [] }];
  }

  // Collect all types above threshold
  const detected = [];
  for (const [docType, data] of sorted) {
    if (data.score >= MULTI_DOC_THRESHOLD) {
      const config = DOCUMENT_TYPES[docType];
      const maxPossibleScore = (config.exclusiveKeywords?.length || 0) * 4
        + (config.keywords.length - (config.exclusiveKeywords?.length || 0))
        + (config.patterns.length * 2);
      const confidence = Math.min(1, data.score / Math.max(maxPossibleScore * 0.4, 1));

      detected.push({
        documentType: docType,
        confidence: Math.round(confidence * 100) / 100,
        method: 'rule_based',
        matchedKeywords: data.matchedKeywords,
      });
    }
  }

  // If nothing above threshold, take the best one anyway
  if (detected.length === 0) {
    const [bestType, bestData] = sorted[0];
    const config = DOCUMENT_TYPES[bestType];
    const maxPossibleScore = (config.exclusiveKeywords?.length || 0) * 4
      + (config.keywords.length - (config.exclusiveKeywords?.length || 0))
      + (config.patterns.length * 2);
    const confidence = Math.min(1, bestData.score / Math.max(maxPossibleScore * 0.4, 1));

    return [{
      documentType: bestType,
      confidence: Math.round(confidence * 100) / 100,
      method: 'rule_based',
      matchedKeywords: bestData.matchedKeywords,
    }];
  }

  return detected;
}

/**
 * Extract fields from OCR text based on document type.
 * Each document type has its own set of relevant fields.
 * @param {string} ocrText
 * @param {string} documentType
 * @returns {object} key-value pairs of extracted fields
 */
function extractIdentifiers(ocrText, documentType) {
  if (!ocrText) return {};

  const extractors = {
    ktp: extractKtp,
    kk: extractKk,
    npwp: extractNpwp,
    slip_gaji: extractSlipGaji,
    rekening_koran: extractRekeningKoran,
    sertifikat_tanah: extractSertifikatTanah,
    imb: extractImb,
    akta_nikah: extractAktaNikah,
    surat_keterangan_kerja: extractSuratKeteranganKerja,
    nib: extractNib,
    spt_pajak: extractSpt,
  };

  const extractor = extractors[documentType];
  if (extractor) return extractor(ocrText);

  // Fallback: try to get nama and NIK
  return extractGeneric(ocrText);
}

function match(text, pattern) {
  const m = text.match(pattern);
  return m ? (m[1] || '').trim() : '';
}

function extractKtp(text) {
  const r = {};
  r.nik = match(text, /NIK\s*[:\-]?\s*(\d{16})/i) || match(text, /(\d{16})/);
  r.nama = match(text, /(?:Nama|NAMA)\s*[:\-]?\s*([A-Z][A-Z\s\.,']+?)(?:\s*$|\s*\n|\s*(?:Tempat|NIK|Jenis|Alamat))/m);
  r.tempatTanggalLahir = match(text, /(?:Tempat\/?Tgl\.?\s*Lahir|TEMPAT\/TGL LAHIR)\s*[:\-]?\s*([^\n]+)/i);
  r.jenisKelamin = match(text, /(?:Jenis\s*Kelamin|JENIS KELAMIN)\s*[:\-]?\s*(LAKI-LAKI|PEREMPUAN|Laki-laki|Perempuan)/i);
  r.alamat = match(text, /(?:Alamat|ALAMAT)\s*[:\-]?\s*([^\n]{5,100})/i);
  r.agama = match(text, /(?:Agama|AGAMA)\s*[:\-]?\s*(\S+)/i);
  r.statusPerkawinan = match(text, /(?:Status\s*Perkawinan|STATUS PERKAWINAN)\s*[:\-]?\s*([^\n]+)/i);
  r.pekerjaan = match(text, /(?:Pekerjaan|PEKERJAAN)\s*[:\-]?\s*([^\n]+)/i);
  r.kewarganegaraan = match(text, /(?:Kewarganegaraan|KEWARGANEGARAAN)\s*[:\-]?\s*(\S+)/i);
  r.berlakuHingga = match(text, /(?:Berlaku\s*Hingga|BERLAKU HINGGA)\s*[:\-]?\s*([^\n]+)/i);
  return clean(r);
}

function extractKk(text) {
  const r = {};
  r.noKK = match(text, /(?:No\.?\s*KK|Nomor\s*KK)\s*[:\-]?\s*(\d{16})/i) || match(text, /(\d{16})/);
  r.kepalaKeluarga = match(text, /(?:Kepala Keluarga|KEPALA KELUARGA)\s*[:\-]?\s*([A-Z][A-Z\s\.,']+?)(?:\s*$|\s*\n)/m);
  r.alamat = match(text, /(?:Alamat|ALAMAT)\s*[:\-]?\s*([^\n]{5,100})/i);
  r.kelurahan = match(text, /(?:Desa\/?Kelurahan|Kel\.?)\s*[:\-]?\s*([^\n]+)/i);
  r.kecamatan = match(text, /(?:Kecamatan|Kec\.?)\s*[:\-]?\s*([^\n]+)/i);
  r.kabupatenKota = match(text, /(?:Kabupaten\/?Kota|Kab\.?)\s*[:\-]?\s*([^\n]+)/i);
  r.provinsi = match(text, /(?:Provinsi|PROVINSI)\s*[:\-]?\s*([^\n]+)/i);
  return clean(r);
}

function extractNpwp(text) {
  const r = {};
  r.noNpwp = match(text, /(\d{2}\.\d{3}\.\d{3}\.\d[\-\.]\d{3}\.\d{3})/) || match(text, /NPWP\s*[:\-]?\s*([^\n]+)/i);
  r.nama = match(text, /(?:Nama|NAMA)\s*[:\-]?\s*([A-Z][A-Z\s\.,']+?)(?:\s*$|\s*\n)/m);
  r.alamat = match(text, /(?:Alamat|ALAMAT)\s*[:\-]?\s*([^\n]{5,100})/i);
  return clean(r);
}

function extractSlipGaji(text) {
  const r = {};
  r.nama = match(text, /(?:Nama|NAMA|Name)\s*[:\-]?\s*([^\n]+)/i);
  r.periode = match(text, /(?:Periode|PERIODE|Period|Bulan)\s*[:\-]?\s*([^\n]+)/i);
  r.gajiPokok = match(text, /(?:Gaji\s*Pokok|GAJI POKOK|Basic\s*Salary)\s*[:\-]?\s*([^\n]+)/i);
  r.tunjangan = match(text, /(?:Tunjangan|TUNJANGAN|Allowance)\s*[:\-]?\s*([^\n]+)/i);
  r.potongan = match(text, /(?:Potongan|POTONGAN|Deduction)\s*[:\-]?\s*([^\n]+)/i);
  r.takeHomePay = match(text, /(?:Take\s*Home\s*Pay|THP|Netto|NET|Diterima)\s*[:\-]?\s*([^\n]+)/i);
  return clean(r);
}

function extractRekeningKoran(text) {
  const r = {};
  r.namaBank = match(text, /(Bank\s*[A-Z][A-Za-z\s]+)/i);
  r.noRekening = match(text, /(?:No\.?\s*Rekening|Nomor\s*Rekening|Account\s*No)\s*[:\-]?\s*([0-9\-\s]+)/i);
  r.nama = match(text, /(?:Nama|NAMA|Name|Atas\s*Nama)\s*[:\-]?\s*([^\n]+)/i);
  r.periode = match(text, /(?:Periode|PERIODE|Period|Statement\s*Period)\s*[:\-]?\s*([^\n]+)/i);
  r.saldoAwal = match(text, /(?:Saldo\s*Awal|Opening\s*Balance)\s*[:\-]?\s*([^\n]+)/i);
  r.saldoAkhir = match(text, /(?:Saldo\s*Akhir|Closing\s*Balance|Ending\s*Balance)\s*[:\-]?\s*([^\n]+)/i);
  return clean(r);
}

function extractSertifikatTanah(text) {
  const r = {};
  r.noSertifikat = match(text, /(?:No\.?\s*Sertifikat|Nomor)\s*[:\-]?\s*([^\n]+)/i);
  r.jenisHak = match(text, /(?:Hak\s*Milik|Hak\s*Guna\s*Bangunan|HGB|HM)\s*[:\-]?\s*([^\n]*)/i) || match(text, /(Hak Milik|Hak Guna Bangunan)/i);
  r.atasNama = match(text, /(?:Atas\s*Nama|Pemegang\s*Hak)\s*[:\-]?\s*([^\n]+)/i);
  r.luasTanah = match(text, /(?:Luas\s*Tanah|Luas)\s*[:\-]?\s*([^\n]+)/i);
  r.lokasi = match(text, /(?:Terletak|Lokasi|Alamat)\s*[:\-]?\s*([^\n]+)/i);
  return clean(r);
}

function extractImb(text) {
  const r = {};
  r.noImb = match(text, /(?:No\.?\s*IMB|Nomor\s*IMB|No\.?\s*PBG)\s*[:\-]?\s*([^\n]+)/i);
  r.atasNama = match(text, /(?:Atas\s*Nama|Nama\s*Pemohon|Nama)\s*[:\-]?\s*([^\n]+)/i);
  r.lokasiBangunan = match(text, /(?:Lokasi|Alamat|Terletak)\s*[:\-]?\s*([^\n]+)/i);
  r.fungsi = match(text, /(?:Fungsi|Peruntukan|Jenis\s*Bangunan)\s*[:\-]?\s*([^\n]+)/i);
  return clean(r);
}

function extractAktaNikah(text) {
  const r = {};
  r.noAkta = match(text, /(?:No\.?\s*Akta|Nomor)\s*[:\-]?\s*([^\n]+)/i);
  r.suami = match(text, /(?:Suami|SUAMI)\s*[:\-]?\s*([^\n]+)/i);
  r.istri = match(text, /(?:Ist[e|ri]+|ISTERI|ISTRI)\s*[:\-]?\s*([^\n]+)/i);
  r.tanggalNikah = match(text, /(?:Tanggal|Hari|Pada\s*Tanggal)\s*[:\-]?\s*([^\n]+)/i);
  r.kua = match(text, /(?:KUA|Kantor\s*Urusan\s*Agama)\s*[:\-]?\s*([^\n]+)/i);
  return clean(r);
}

function extractSuratKeteranganKerja(text) {
  const r = {};
  r.nama = match(text, /(?:Nama|NAMA)\s*[:\-]?\s*([^\n]+)/i);
  r.jabatan = match(text, /(?:Jabatan|JABATAN|Position)\s*[:\-]?\s*([^\n]+)/i);
  r.perusahaan = match(text, /(?:Perusahaan|PT\.?|CV\.?)\s*[:\-]?\s*([^\n]+)/i);
  r.sejak = match(text, /(?:Sejak|Mulai\s*Bekerja|Tanggal\s*Masuk)\s*[:\-]?\s*([^\n]+)/i);
  r.statusKaryawan = match(text, /(?:Status\s*Karyawan|Status)\s*[:\-]?\s*([^\n]+)/i);
  return clean(r);
}

function extractNib(text) {
  const r = {};
  r.noNib = match(text, /(?:NIB|Nomor\s*Induk\s*Berusaha)\s*[:\-]?\s*([0-9\s]+)/i);
  r.namaUsaha = match(text, /(?:Nama\s*Usaha|Nama\s*Perusahaan)\s*[:\-]?\s*([^\n]+)/i);
  r.alamatUsaha = match(text, /(?:Alamat\s*Usaha|Alamat)\s*[:\-]?\s*([^\n]+)/i);
  return clean(r);
}

function extractSpt(text) {
  const r = {};
  r.tahunPajak = match(text, /(?:Tahun\s*Pajak|TAHUN PAJAK)\s*[:\-]?\s*(\d{4})/i);
  r.nama = match(text, /(?:Nama|NAMA)\s*[:\-]?\s*([^\n]+)/i);
  r.npwp = match(text, /(\d{2}\.\d{3}\.\d{3}\.\d[\-\.]\d{3}\.\d{3})/);
  r.penghasilanNetto = match(text, /(?:Penghasilan\s*Netto|Netto)\s*[:\-]?\s*([^\n]+)/i);
  return clean(r);
}

function extractGeneric(text) {
  const r = {};
  r.nik = match(text, /NIK\s*[:\-]?\s*(\d{16})/i) || match(text, /(\d{16})/);
  r.nama = match(text, /(?:Nama|NAMA)\s*[:\-]?\s*([A-Z][A-Z\s\.,']+?)(?:\s*$|\s*\n)/m);
  r.alamat = match(text, /(?:Alamat|ALAMAT)\s*[:\-]?\s*([^\n]{5,100})/i);
  return clean(r);
}

/** Remove empty string values */
function clean(obj) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v) result[k] = v;
  }
  return result;
}

/**
 * Classify multiple pages and group consecutive pages of the same document type from same source file.
 * Supports multi-document-per-page: if a page has 2 KTP + 1 NPWP, it produces 3 document records sharing that pageId.
 * @param {Array<{ pageId: string, ocrText: string, sourceFilename: string, pageNumber: number }>} pages
 * @returns {Array<{ documentType: string, confidence: number, method: string, sourceFilename: string, pageIds: string[], extractedFields: object }>}
 */
function classifyAndGroupPages(pages) {
  // Classify each page (may produce multiple types per page)
  const classified = []; // flat list of { ...page, documentType, confidence, ... }

  for (const page of pages) {
    const types = classifyTextMulti(page.ocrText);
    const identifiers = extractIdentifiers(page.ocrText, types[0]?.documentType || 'unknown');

    for (const classification of types) {
      classified.push({
        ...page,
        ...classification,
        identifiers: { ...identifiers },
      });
    }
  }

  // Group consecutive entries from the same file with the same document type
  const documents = [];
  let current = null;

  for (const page of classified) {
    const isSameDocument =
      current &&
      current.sourceFilename === page.sourceFilename &&
      current.documentType === page.documentType &&
      page.pageNumber === current.lastPageNumber + 1 &&
      // Don't merge if the same page produced multiple types
      !current.pageIds.includes(page.pageId);

    if (isSameDocument) {
      current.pageIds.push(page.pageId);
      current.lastPageNumber = page.pageNumber;
      current.allText += '\n' + page.ocrText;
      // Merge identifiers: later pages fill in missing fields
      for (const [k, v] of Object.entries(page.identifiers)) {
        if (v && !current.identifiers[k]) current.identifiers[k] = v;
      }
      current.confidence = Math.max(current.confidence, page.confidence);
    } else {
      if (current) {
        documents.push(finalizeDocument(current));
      }
      current = {
        documentType: page.documentType,
        confidence: page.confidence,
        method: page.method,
        sourceFilename: page.sourceFilename,
        pageIds: [page.pageId],
        lastPageNumber: page.pageNumber,
        allText: page.ocrText || '',
        identifiers: { ...page.identifiers },
        matchedKeywords: page.matchedKeywords,
      };
    }
  }

  if (current) {
    documents.push(finalizeDocument(current));
  }

  return documents;
}

function finalizeDocument(doc) {
  return {
    documentType: doc.documentType,
    confidence: doc.confidence,
    method: doc.method,
    sourceFilename: doc.sourceFilename,
    pageIds: doc.pageIds,
    extractedFields: doc.identifiers,
    matchedKeywords: doc.matchedKeywords,
  };
}

module.exports = {
  classifyText,
  classifyTextMulti,
  extractIdentifiers,
  classifyAndGroupPages,
  DOCUMENT_TYPES,
};
