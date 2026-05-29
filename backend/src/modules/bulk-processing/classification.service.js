/**
 * Document Classification Service
 *
 * Classifies OCR text into document types using rule-based keyword/pattern matching.
 *
 * Supported document types (22 tipe):
 *   ktp, kk, slip_gaji, npwp, rekening_koran, sertifikat_tanah,
 *   imb, pbb, ajb, akta_nikah, akta_cerai, spt_pajak,
 *   surat_keterangan_kerja, formulir_aplikasi, pas_foto,
 *   surat_pemesanan_rumah, nib, laporan_keuangan, info_usaha,
 *   siup_tdp, akta_pendirian, izin_praktik, unknown
 */

const DOCUMENT_TYPES = {
  ktp: {
    keywords: ['ktp', 'kartu tanda penduduk', 'nik', 'provinsi', 'kabupaten', 'kecamatan', 'kelurahan', 'berlaku hingga', 'tempat/tgl lahir', 'jenis kelamin', 'gol. darah', 'agama', 'status perkawinan', 'pekerjaan', 'kewarganegaraan', 'rt/rw'],
    patterns: [/\bKTP\b/i, /\b\d{16}\b/, /NIK\s*[:\-]?\s*\d{16}/i, /berlaku\s*hingga/i, /KARTU TANDA PENDUDUK/i],
    weight: 1.0,
  },
  kk: {
    keywords: ['kk', 'kartu keluarga', 'kepala keluarga', 'nomor kk', 'no. kk', 'anggota keluarga', 'hubungan keluarga', 'desa/kelurahan', 'kabupaten/kota'],
    patterns: [/\bKK\b/i, /KARTU KELUARGA/i, /No\.?\s*KK/i, /Kepala Keluarga/i, /\b\d{16}\b/],
    weight: 1.0,
  },
  slip_gaji: {
    keywords: ['slip gaji', 'gaji pokok', 'tunjangan', 'potongan', 'take home pay', 'netto', 'bruto', 'upah', 'honorarium', 'lembur', 'bpjs', 'pph 21', 'periode gaji', 'surat keterangan penghasilan'],
    patterns: [/gaji\s*pokok/i, /take\s*home\s*pay/i, /tunjangan/i, /potongan/i, /slip\s*gaji/i, /payslip/i, /keterangan\s*penghasilan/i],
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
    keywords: ['akta nikah', 'kutipan akta nikah', 'kantor urusan agama', 'kua', 'suami', 'isteri', 'perkawinan', 'buku nikah', 'akta perkawinan'],
    patterns: [/akta\s*nikah/i, /Kantor Urusan Agama/i, /KUA/i, /perkawinan/i, /buku\s*nikah/i],
    weight: 1.0,
  },
  akta_cerai: {
    keywords: ['akta cerai', 'perceraian', 'pengadilan agama', 'putusan', 'cerai talak', 'cerai gugat'],
    patterns: [/akta\s*cerai/i, /perceraian/i, /pengadilan\s*agama/i, /cerai\s*(talak|gugat)/i],
    weight: 1.0,
  },
  spt_pajak: {
    keywords: ['spt', 'surat pemberitahuan', 'pajak penghasilan', 'formulir 1770', 'tahun pajak', 'dirjen pajak'],
    patterns: [/SPT/i, /1770/i, /surat\s*pemberitahuan/i, /pajak\s*penghasilan/i],
    weight: 1.0,
  },
  surat_keterangan_kerja: {
    keywords: ['surat keterangan', 'menerangkan bahwa', 'karyawan', 'jabatan', 'sejak tanggal', 'perusahaan', 'surat keterangan kerja', 'masih aktif bekerja'],
    patterns: [/surat\s*keterangan\s*kerja/i, /menerangkan\s*bahwa/i, /masih\s*aktif\s*bekerja/i],
    weight: 0.9,
  },
  // ─── NEW DOCUMENT TYPES ─────────────────────────────────────────────────────
  formulir_aplikasi: {
    keywords: ['formulir aplikasi', 'aplikasi kredit', 'permohonan kredit', 'data pemohon', 'jenis kredit', 'jangka waktu kredit', 'tujuan penggunaan', 'plafon kredit', 'angsuran', 'kpr', 'kredit pemilikan rumah', 'data pekerjaan', 'data penghasilan'],
    patterns: [/formulir\s*aplikasi/i, /aplikasi\s*kredit/i, /permohonan\s*kredit/i, /kredit\s*pemilikan\s*rumah/i, /plafon\s*kredit/i, /data\s*pemohon/i],
    weight: 1.0,
  },
  pas_foto: {
    keywords: ['pas foto', 'foto pemohon', 'foto pasangan'],
    patterns: [/pas\s*foto/i, /\bfoto\s*(pemohon|pasangan)\b/i],
    weight: 0.6,
  },
  surat_pemesanan_rumah: {
    keywords: ['surat pemesanan rumah', 'pemesanan unit', 'booking', 'kavling', 'tipe rumah', 'lokasi perumahan', 'developer', 'pengembang', 'harga jual', 'uang muka', 'down payment', 'surat pesanan'],
    patterns: [/surat\s*pemesanan\s*rumah/i, /pemesanan\s*unit/i, /surat\s*pesanan/i, /harga\s*jual/i, /uang\s*muka/i, /down\s*payment/i],
    weight: 1.0,
  },
  nib: {
    keywords: ['nomor induk berusaha', 'nib', 'oss', 'online single submission', 'perizinan berusaha', 'lembaga oss', 'kbli', 'klasifikasi baku lapangan usaha'],
    patterns: [/NIB/i, /Nomor Induk Berusaha/i, /Online Single Submission/i, /OSS/i, /\b\d{13}\b/],
    weight: 1.0,
  },
  laporan_keuangan: {
    keywords: ['laporan keuangan', 'neraca', 'laba rugi', 'arus kas', 'pendapatan', 'beban', 'aset', 'kewajiban', 'modal', 'catatan keuangan', 'omzet', 'penjualan', 'pembelian', 'laba bersih', 'laba kotor'],
    patterns: [/laporan\s*keuangan/i, /laba\s*rugi/i, /neraca/i, /arus\s*kas/i, /catatan\s*keuangan/i, /laba\s*(bersih|kotor)/i],
    weight: 1.0,
  },
  info_usaha: {
    keywords: ['informasi usaha', 'profil usaha', 'alamat usaha', 'lokasi usaha', 'jam operasional', 'waktu operasional', 'foto usaha', 'titik lokasi', 'jenis usaha', 'bidang usaha'],
    patterns: [/informasi\s*usaha/i, /profil\s*usaha/i, /lokasi\s*usaha/i, /jam\s*operasional/i, /waktu\s*operasional/i],
    weight: 0.9,
  },
  siup_tdp: {
    keywords: ['siup', 'surat izin usaha perdagangan', 'tdp', 'tanda daftar perusahaan', 'izin usaha', 'perdagangan', 'menengah', 'kecil', 'besar'],
    patterns: [/SIUP/i, /TDP/i, /Surat Izin Usaha Perdagangan/i, /Tanda Daftar Perusahaan/i],
    weight: 1.0,
  },
  akta_pendirian: {
    keywords: ['akta pendirian', 'pendirian perseroan', 'notaris', 'anggaran dasar', 'depkumham', 'kemenkumham', 'kementerian hukum', 'pengesahan', 'badan hukum', 'perseroan terbatas'],
    patterns: [/akta\s*pendirian/i, /pendirian\s*perseroan/i, /DEPKUMHAM/i, /KEMENKUMHAM/i, /anggaran\s*dasar/i, /pengesahan\s*badan\s*hukum/i],
    weight: 1.0,
  },
  izin_praktik: {
    keywords: ['izin praktik', 'surat izin praktik', 'str', 'surat tanda registrasi', 'profesi', 'asosiasi', 'ikatan', 'perhimpunan', 'praktik mandiri', 'sip'],
    patterns: [/izin\s*praktik/i, /surat\s*izin\s*praktik/i, /SIP/i, /STR/i, /Surat Tanda Registrasi/i],
    weight: 1.0,
  },
};

/**
 * Classify a single page's OCR text.
 * @param {string} ocrText - Full OCR text of the page
 * @returns {{ documentType: string, confidence: number, method: string, matchedKeywords: string[] }}
 */
function classifyText(ocrText) {
  const trimmedText = ocrText?.trim();
  const allowShortTextClassification = /^(ktp|kk|npwp|nib|imb|spt)$/i.test(trimmedText || '') || /pas\s*foto/i.test(trimmedText || '');

  if (!trimmedText || (trimmedText.length < 10 && !allowShortTextClassification)) {
    return { documentType: 'unknown', confidence: 0, method: 'empty_text', matchedKeywords: [] };
  }

  const textLower = trimmedText.toLowerCase();
  const scores = {};

  for (const [docType, config] of Object.entries(DOCUMENT_TYPES)) {
    let score = 0;
    const matchedKeywords = [];

    // Keyword matching
    for (const keyword of config.keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        score += 1;
        matchedKeywords.push(keyword);
      }
    }

    // Pattern matching (weighted higher)
    for (const pattern of config.patterns) {
      if (pattern.test(ocrText)) {
        score += 2;
      }
    }

    // Apply weight
    score *= config.weight;

    if (score > 0) {
      scores[docType] = { score, matchedKeywords };
    }
  }

  if (Object.keys(scores).length === 0) {
    return { documentType: 'unknown', confidence: 0, method: 'rule_based', matchedKeywords: [] };
  }

  // Find best match
  const sorted = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);
  const [bestType, bestData] = sorted[0];
  const maxPossibleScore = DOCUMENT_TYPES[bestType].keywords.length + (DOCUMENT_TYPES[bestType].patterns.length * 2);
  const confidence = Math.min(1, bestData.score / Math.max(maxPossibleScore * 0.5, 1));

  return {
    documentType: bestType,
    confidence: Math.round(confidence * 100) / 100,
    method: 'rule_based',
    matchedKeywords: bestData.matchedKeywords,
  };
}

/**
 * Extract key identifiers from OCR text (NIK, nama, alamat).
 * @param {string} ocrText
 * @param {string} documentType
 * @returns {{ nik?: string, fullName?: string, address?: string }}
 */
function extractIdentifiers(ocrText, documentType) {
  const result = {};

  if (!ocrText) return result;

  // Extract NIK (16-digit number)
  const nikPatterns = [
    /NIK\s*[:\-]?\s*(\d{16})/i,
    /(\d{16})/,
  ];

  for (const pattern of nikPatterns) {
    const match = ocrText.match(pattern);
    if (match && match[1]) {
      // Validate NIK format: first 6 digits are area code
      const nik = match[1];
      if (/^\d{16}$/.test(nik)) {
        result.nik = nik;
        break;
      }
    }
  }

  // Extract name
  const namePatterns = [
    /(?:Nama Lengkap|NAMA LENGKAP)\s*[:\-]?\s*([A-Z][A-Z\s\.,']+?)(?:\s*$|\s*\n|\s*(?:Tempat|NIK|Jenis|Alamat|No))/m,
    /(?:Nama|NAMA)\s*[:\-]?\s*([A-Z][A-Z\s\.,']+?)(?:\s*$|\s*\n|\s*(?:Tempat|NIK|Jenis|Alamat|No))/m,
    /(?:Kepala Keluarga|KEPALA KELUARGA)\s*[:\-]?\s*([A-Z][A-Z\s\.,']+?)(?:\s*$|\s*\n)/m,
    /(?:Atas Nama|ATAS NAMA|a\.n\.?)\s*[:\-]?\s*([A-Z][A-Z\s\.,']+?)(?:\s*$|\s*\n)/im,
  ];

  for (const pattern of namePatterns) {
    const match = ocrText.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim().replace(/\s+/g, ' ');
      if (name.length >= 3 && name.length <= 60) {
        result.fullName = name;
        break;
      }
    }
  }

  // Extract address
  const addressPatterns = [
    /(?:Alamat|ALAMAT)\s*[:\-]?\s*([^\n]{10,100})/i,
    /(?:Jl\.|Jalan|JL\.)\s*([^\n]{5,80})/i,
  ];

  for (const pattern of addressPatterns) {
    const match = ocrText.match(pattern);
    if (match && match[1]) {
      result.address = match[1].trim();
      break;
    }
  }

  return result;
}

/**
 * Classify multiple pages and group consecutive pages of the same document type from same source file.
 * @param {Array<{ pageId: string, ocrText: string, sourceFilename: string, pageNumber: number }>} pages
 * @returns {Array<{ documentType: string, confidence: number, method: string, sourceFilename: string, pageIds: string[], extractedFields: object }>}
 */
function classifyAndGroupPages(pages) {
  // First, classify each page
  const classified = pages.map((page) => {
    const classification = classifyText(page.ocrText);
    const identifiers = extractIdentifiers(page.ocrText, classification.documentType);
    return {
      ...page,
      ...classification,
      identifiers,
    };
  });

  // Group consecutive pages from the same file with the same document type
  const documents = [];
  let current = null;

  for (const page of classified) {
    const isSameDocument =
      current &&
      current.sourceFilename === page.sourceFilename &&
      current.documentType === page.documentType &&
      page.pageNumber === current.lastPageNumber + 1;

    if (isSameDocument) {
      current.pageIds.push(page.pageId);
      current.lastPageNumber = page.pageNumber;
      current.allText += '\n' + page.ocrText;
      // Merge identifiers (prefer later pages if they have more data)
      if (page.identifiers.nik) current.identifiers.nik = page.identifiers.nik;
      if (page.identifiers.fullName) current.identifiers.fullName = page.identifiers.fullName;
      if (page.identifiers.address) current.identifiers.address = page.identifiers.address;
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
  extractIdentifiers,
  classifyAndGroupPages,
  DOCUMENT_TYPES,
};
