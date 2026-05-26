/**
 * AI Classification & Extraction Service
 *
 * Uses Gemini to classify document type AND extract relevant fields
 * from OCR text. Replaces regex-based extraction with AI-driven approach.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createHttpError } = require('../../utils/httpError');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function getModel() {
  if (!process.env.GEMINI_API_KEY) {
    throw createHttpError(503, 'GEMINI_API_KEY is not configured');
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: DEFAULT_MODEL,
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  });
}

const PROMPT = `Kamu adalah sistem klasifikasi dan ekstraksi dokumen KPR Indonesia.

Dari teks OCR berikut, tentukan:
1. Semua tipe dokumen yang ada di halaman ini (bisa lebih dari 1 jika halaman berisi beberapa dokumen fisik yang di-scan bersamaan).
2. Untuk setiap dokumen yang terdeteksi, extract semua field/data yang terlihat.

Tipe dokumen yang dikenali:
- ktp: KTP (Kartu Tanda Penduduk)
- kk: Kartu Keluarga
- npwp: NPWP
- slip_gaji: Slip Gaji / Surat Keterangan Penghasilan
- rekening_koran: Rekening Koran / Bank Statement
- sertifikat_tanah: Sertifikat Tanah
- imb: IMB / PBG
- pbb: PBB / SPPT
- ajb: Akta Jual Beli
- akta_nikah: Akta Nikah / Buku Nikah
- akta_cerai: Akta Cerai
- spt_pajak: SPT Pajak
- surat_keterangan_kerja: Surat Keterangan Kerja
- formulir_aplikasi_kredit: Formulir Aplikasi Kredit
- surat_pemesanan_rumah: Surat Pemesanan Rumah
- nib: NIB (Nomor Induk Berusaha)
- laporan_keuangan_usaha: Laporan Keuangan Usaha
- dokumen_informasi_usaha: Dokumen Informasi Usaha
- siup_tdp: SIUP / TDP
- izin_praktik: Izin Praktik
- akte_pendirian: Akte Pendirian Perusahaan
- unknown: Tidak dikenali

Return ONLY valid JSON array:
[
  {
    "documentType": "ktp",
    "confidence": 0.95,
    "fields": {
      "field_name": "value extracted from text"
    }
  }
]

Rules:
- Jika 1 halaman berisi beberapa dokumen (misal 2 KTP dan 1 NPWP), return array dengan 3 elemen.
- Field names gunakan camelCase bahasa Indonesia (misal: nik, nama, tempatLahir, tanggalLahir, alamat, agama, dll).
- Jangan mengarang nilai. Jika tidak terlihat, jangan masukkan field tersebut.
- Untuk angka/nomor, pertahankan format asli dari teks.
- Confidence antara 0 dan 1.`;

/**
 * Classify and extract fields from OCR text using Gemini AI.
 * @param {string} ocrText - OCR text from a single page
 * @returns {Array<{ documentType: string, confidence: number, fields: object }>}
 */
async function classifyAndExtractWithAI(ocrText) {
  if (!ocrText || ocrText.trim().length < 10) {
    return [{ documentType: 'unknown', confidence: 0, fields: {} }];
  }

  const model = getModel();
  let result;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `${PROMPT}\n\n--- TEKS OCR ---\n${ocrText}` }] }],
      });
      break;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (attempt === 3 || (!msg.includes('503') && !msg.includes('429'))) {
        console.error('[AI-Classify] Gemini error:', msg);
        return fallbackClassify(ocrText);
      }
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }

  try {
    const text = result.response.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed) || parsed.length === 0) return fallbackClassify(ocrText);

    return parsed.map((item) => ({
      documentType: item.documentType || 'unknown',
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.5,
      fields: item.fields && typeof item.fields === 'object' ? item.fields : {},
    }));
  } catch {
    return fallbackClassify(ocrText);
  }
}

/**
 * Fallback to rule-based classification if AI fails.
 */
function fallbackClassify(ocrText) {
  const { classifyTextMulti, extractIdentifiers } = require('./classification.service');
  const types = classifyTextMulti(ocrText);
  return types.map((t) => ({
    documentType: t.documentType,
    confidence: t.confidence,
    fields: extractIdentifiers(ocrText, t.documentType),
  }));
}

module.exports = { classifyAndExtractWithAI };
