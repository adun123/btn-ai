'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Search, Eye, FileText, CheckCircle2, AlertTriangle, XCircle,
  X, UserRound, BadgeCheck, Filter, Download, RotateCcw,
  Pencil, Trash2, Plus, Save, Upload, Loader2,
} from 'lucide-react';
import { bulkApi } from '../../lib/api-bulk';
import type { BulkJobDetails, BulkNasabah, BulkDocument, BulkDocumentField } from '../../types/bulk';

// --- Config ---

const DOC_LABELS: Record<string, string> = {
  formulir_aplikasi_kredit: 'Formulir Aplikasi Kredit',
  pas_foto: 'Pas Foto Pemohon', ktp: 'KTP Pemohon', kk: 'Kartu Keluarga',
  npwp: 'NPWP Pemohon', surat_pemesanan_rumah: 'Surat Pemesanan Rumah',
  pas_foto_pasangan: 'Pas Foto Pasangan', ktp_pasangan: 'KTP Pasangan',
  npwp_pasangan: 'NPWP Pasangan', akta_nikah: 'Akta Nikah / Buku Nikah',
  akta_cerai: 'Akta Cerai', rekening_koran: 'Rekening Koran',
  slip_gaji: 'Slip Gaji', surat_keterangan_kerja: 'Surat Keterangan Kerja',
  nib: 'NIB', laporan_keuangan_usaha: 'Laporan Keuangan Usaha',
  dokumen_informasi_usaha: 'Dokumen Informasi Usaha',
  spt_pajak: 'SPT Pajak', siup_tdp: 'SIUP / TDP',
  akte_pendirian: 'Akte Pendirian & Pengesahan', izin_praktik: 'Izin Praktik',
  sertifikat_tanah: 'Sertifikat', imb: 'IMB',
};

const REQUIRED_DOCS = [
  'formulir_aplikasi_kredit', 'pas_foto', 'ktp', 'kk', 'npwp',
  'surat_pemesanan_rumah', 'rekening_koran', 'slip_gaji',
];

type NasabahStatus = 'Verified' | 'Need Review' | 'Incomplete';

function getNasabahStatus(n: BulkNasabah): NasabahStatus {
  if (n.completenessScore >= 0.85 && !n.warnings.length) return 'Verified';
  if (n.completenessScore >= 0.5) return 'Need Review';
  return 'Incomplete';
}

const statusConfig: Record<NasabahStatus, { badgeClass: string; icon: typeof CheckCircle2 }> = {
  Verified: { badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CheckCircle2 },
  'Need Review': { badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200', icon: AlertTriangle },
  Incomplete: { badgeClass: 'bg-rose-50 text-rose-700 ring-rose-200', icon: XCircle },
};


// --- Small components ---

function StatusBadge({ status }: { status: NasabahStatus }) {
  const cfg = statusConfig[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${cfg.badgeClass}`}>
      <Icon className="h-3.5 w-3.5" /> {status}
    </span>
  );
}

function DocStatusBadge({ found, hasWarning }: { found: boolean; hasWarning: boolean }) {
  if (!found) return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 bg-rose-50 text-rose-700 ring-rose-200">Missing</span>;
  if (hasWarning) return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 bg-amber-50 text-amber-700 ring-amber-200">Warning</span>;
  return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 bg-emerald-50 text-emerald-700 ring-emerald-200">Valid</span>;
}

function StatCard({ icon: Icon, label, value, helper }: { icon: typeof UserRound; label: string; value: number; helper: string }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
          <p className="mt-1 text-xs text-muted">{helper}</p>
        </div>
        <div className="rounded-2xl p-3" style={{ background: 'var(--primary-soft)' }}>
          <Icon className="h-5 w-5" style={{ color: 'var(--primary)' }} />
        </div>
      </div>
    </div>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-20 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--primary)' }} />
      </div>
      <span className="text-sm font-bold">{pct}%</span>
    </div>
  );
}


// --- Document Card with Edit/Delete ---

function DocumentCard({
  doc, docType, hasWarning, onEdit, onDelete,
}: {
  doc: BulkDocument;
  docType: string;
  hasWarning: boolean;
  onEdit: (doc: BulkDocument, fields: BulkDocumentField[]) => void;
  onDelete: (docId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<BulkDocumentField[]>(doc.fields || []);

  const handleFieldChange = (idx: number, value: string) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, value } : f));
  };

  const handleSave = () => {
    onEdit(doc, fields);
    setEditing(false);
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2" style={{ background: 'var(--primary-soft)' }}>
            <FileText className="h-5 w-5" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h3 className="font-bold uppercase text-sm">{DOC_LABELS[docType] || docType}</h3>
            <p className="text-xs text-muted">{doc.filename}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DocStatusBadge found={true} hasWarning={hasWarning} />
          <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'var(--primary-soft)' }}>
            {Math.round(doc.confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Fields */}
      {fields.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 mb-3">
          {fields.map((f, idx) => (
            <div key={f.key} className="rounded-xl border px-3 py-2" style={{ borderColor: 'var(--border)', background: editing ? 'var(--card)' : 'var(--primary-soft)' }}>
              <p className="text-xs font-semibold uppercase text-muted">{f.key}</p>
              {editing ? (
                <input
                  value={f.value}
                  onChange={e => handleFieldChange(idx, e.target.value)}
                  className="mt-1 w-full text-sm font-medium bg-transparent outline-none border-b"
                  style={{ borderColor: 'var(--border)' }}
                />
              ) : (
                <p className="mt-1 text-sm font-medium">{f.value}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        {editing ? (
          <>
            <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: 'var(--primary)' }}>
              <Save className="h-3.5 w-3.5" /> Simpan
            </button>
            <button onClick={() => { setFields(doc.fields || []); setEditing(false); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted">
              Batal
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-80" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button onClick={() => onDelete(doc.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 transition hover:bg-red-100">
              <Trash2 className="h-3.5 w-3.5" /> Hapus
            </button>
          </>
        )}
      </div>
    </div>
  );
}


// --- Add Document Form ---

function AddDocumentForm({ onAdd, onCancel }: { onAdd: (docType: string, file: File) => void; onCancel: () => void }) {
  const [docType, setDocType] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const allDocTypes = Object.entries(DOC_LABELS);

  return (
    <div className="glass-card p-5 border-2 border-dashed" style={{ borderColor: 'var(--primary)' }}>
      <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
        <Plus className="h-4 w-4" style={{ color: 'var(--primary)' }} /> Tambah Dokumen
      </h4>
      <div className="space-y-3">
        <select
          value={docType}
          onChange={e => setDocType(e.target.value)}
          className="input-base text-sm"
        >
          <option value="">Pilih tipe dokumen...</option>
          {allDocTypes.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <div
          className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition"
          style={{ borderColor: 'var(--border)' }}
          onClick={() => document.getElementById('add-doc-input')?.click()}
        >
          {file ? (
            <p className="text-sm font-medium">{file.name}</p>
          ) : (
            <p className="text-sm text-muted"><Upload className="h-4 w-4 inline mr-1" />Pilih file (PDF/gambar)</p>
          )}
        </div>
        <input
          id="add-doc-input"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
        />
        <div className="flex gap-2">
          <button
            onClick={() => { if (docType && file) onAdd(docType, file); }}
            disabled={!docType || !file}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40"
            style={{ background: 'var(--primary)' }}
          >
            <Plus className="h-3.5 w-3.5" /> Tambah
          </button>
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-xs font-semibold text-muted">
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}


// --- Validation Checklist (matches backend KPR_CHECKLIST) ---

const VALIDATION_CHECKLIST = {
  data_diri: {
    label: 'Data Diri',
    items: [
      { type: 'formulir_aplikasi_kredit', label: 'Formulir Aplikasi Kredit', required: true },
      { type: 'pas_foto', label: 'Pas Foto Pemohon', required: true },
      { type: 'ktp', label: 'KTP Pemohon', required: true },
      { type: 'kk', label: 'Kartu Keluarga', required: true },
      { type: 'npwp', label: 'NPWP Pemohon', required: true },
      { type: 'surat_pemesanan_rumah', label: 'Surat Pemesanan Rumah', required: true },
    ],
  },
  data_pasangan: {
    label: 'Data Pasangan (Jika Menikah)',
    items: [
      { type: 'pas_foto_pasangan', label: 'Pas Foto Pasangan', required: true },
      { type: 'ktp_pasangan', label: 'KTP Pasangan', required: true },
      { type: 'npwp_pasangan', label: 'NPWP Pasangan', required: true },
      { type: 'akta_nikah', label: 'Akta Nikah / Buku Nikah', required: false },
      { type: 'akta_cerai', label: 'Akta Cerai', required: false },
    ],
  },
  penghasilan_fixed: {
    label: 'Penghasilan (Fixed Income)',
    items: [
      { type: 'rekening_koran', label: 'Rekening Koran (3 bulan)', required: true },
      { type: 'slip_gaji', label: 'Slip Gaji', required: true },
      { type: 'surat_keterangan_kerja', label: 'Surat Keterangan Kerja', required: false },
    ],
  },
  penghasilan_non_fixed: {
    label: 'Penghasilan (Non Fixed Income)',
    items: [
      { type: 'nib', label: 'NIB', required: true },
      { type: 'laporan_keuangan_usaha', label: 'Laporan Keuangan Usaha', required: true },
      { type: 'dokumen_informasi_usaha', label: 'Dokumen Informasi Usaha', required: true },
    ],
  },
  dokumen_pendukung: {
    label: 'Dokumen Pendukung',
    items: [
      { type: 'spt_pajak', label: 'SPT Pajak', required: false },
      { type: 'siup_tdp', label: 'SIUP / TDP', required: false },
      { type: 'akte_pendirian', label: 'Akte Pendirian', required: false },
      { type: 'izin_praktik', label: 'Izin Praktik', required: false },
      { type: 'sertifikat_tanah', label: 'Sertifikat', required: false },
      { type: 'imb', label: 'IMB', required: false },
    ],
  },
};


// --- Detail Modal ---

function DetailModal({
  nasabah, documents, onClose, onEditDoc, onDeleteDoc, onAddDoc, onEditNasabah,
}: {
  nasabah: BulkNasabah | null;
  documents: BulkDocument[];
  onClose: () => void;
  onEditDoc: (doc: BulkDocument, fields: BulkDocumentField[]) => void;
  onDeleteDoc: (docId: string) => void;
  onAddDoc: (nasabahId: string, docType: string, file: File) => void;
  onEditNasabah: (nasabahId: string, updates: { fullName?: string; nik?: string }) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingDoc, setAddingDoc] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingNik, setEditingNik] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nikValue, setNikValue] = useState('');

  if (!nasabah) return null;

  const nasabahDocs = documents.filter(d => d.nasabahId === nasabah.id);
  const foundTypes = [...new Set(nasabahDocs.map(d => d.documentType))];
  const allTypes = [...new Set([...REQUIRED_DOCS, ...foundTypes])];
  const status = getNasabahStatus(nasabah);

  const handleStartEditName = () => { setNameValue(nasabah.fullName); setEditingName(true); };
  const handleSaveName = () => { onEditNasabah(nasabah.id, { fullName: nameValue }); setEditingName(false); };
  const handleStartEditNik = () => { setNikValue(nasabah.nik); setEditingNik(true); };
  const handleSaveNik = () => { onEditNasabah(nasabah.id, { nik: nikValue }); setEditingNik(false); };

  const handleAddDoc = async (docType: string, file: File) => {
    setAddingDoc(true);
    setShowAddForm(false);
    await onAddDoc(nasabah.id, docType, file);
    setAddingDoc(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl shadow-2xl" style={{ background: 'var(--card)' }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold">Detail Extraction</h2>
              <StatusBadge status={status} />
            </div>
            <p className="mt-1 text-sm text-muted">{nasabah.fullName} • NIK: {nasabah.nik}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 transition hover:opacity-70" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[calc(90vh-88px)] overflow-y-auto p-6">
          {/* Summary cards — editable nama & NIK */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="rounded-2xl p-4 group relative" style={{ background: 'var(--primary-soft)' }}>
              <p className="text-xs font-semibold uppercase text-muted">Nama</p>
              {editingName ? (
                <div className="flex items-center gap-2 mt-1">
                  <input value={nameValue} onChange={e => setNameValue(e.target.value)} className="flex-1 font-semibold bg-white rounded-lg px-2 py-1 text-sm border" style={{ borderColor: 'var(--border)' }} autoFocus />
                  <button onClick={handleSaveName} className="text-xs font-bold px-2 py-1 rounded-lg text-white" style={{ background: 'var(--primary)' }}>✓</button>
                  <button onClick={() => setEditingName(false)} className="text-xs font-bold px-2 py-1 rounded-lg text-muted">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-semibold">{nasabah.fullName || '-'}</p>
                  <button onClick={handleStartEditName} className="opacity-0 group-hover:opacity-100 transition"><Pencil className="h-3.5 w-3.5 text-muted" /></button>
                </div>
              )}
            </div>
            <div className="rounded-2xl p-4 group relative" style={{ background: 'var(--primary-soft)' }}>
              <p className="text-xs font-semibold uppercase text-muted">NIK</p>
              {editingNik ? (
                <div className="flex items-center gap-2 mt-1">
                  <input value={nikValue} onChange={e => setNikValue(e.target.value)} className="flex-1 font-semibold bg-white rounded-lg px-2 py-1 text-sm border" style={{ borderColor: 'var(--border)' }} autoFocus />
                  <button onClick={handleSaveNik} className="text-xs font-bold px-2 py-1 rounded-lg text-white" style={{ background: 'var(--primary)' }}>✓</button>
                  <button onClick={() => setEditingNik(false)} className="text-xs font-bold px-2 py-1 rounded-lg text-muted">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-semibold">{nasabah.nik || '-'}</p>
                  <button onClick={handleStartEditNik} className="opacity-0 group-hover:opacity-100 transition"><Pencil className="h-3.5 w-3.5 text-muted" /></button>
                </div>
              )}
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'var(--primary-soft)' }}>
              <p className="text-xs font-semibold uppercase text-muted">Completeness</p>
              <p className="mt-1 font-semibold">{Math.round(nasabah.completenessScore * 100)}%</p>
            </div>
          </div>

          {/* AI processing indicator */}
          {addingDoc && (
            <div className="glass-card p-5 mb-6 flex items-center gap-4">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--primary)' }} />
              <div>
                <p className="font-semibold text-sm">Memproses dokumen dengan AI...</p>
                <p className="text-xs text-muted">Mengklasifikasi dan mengekstrak data</p>
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            {/* Documents - left column */}
            <div className="space-y-4">
              {allTypes.map(docType => {
                const docs = nasabahDocs.filter(d => d.documentType === docType);
                const hasWarning = nasabah.warnings.some(w => w.toLowerCase().includes(docType.replace('_', ' ')));

                if (!docs.length) {
                  return (
                    <div key={docType} className="glass-card p-5 opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl p-2" style={{ background: 'var(--primary-soft)' }}>
                            <FileText className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                          </div>
                          <h3 className="font-bold uppercase text-sm">{DOC_LABELS[docType] || docType}</h3>
                        </div>
                        <DocStatusBadge found={false} hasWarning={false} />
                      </div>
                      <p className="text-xs text-red-500 mt-2">Dokumen belum tersedia</p>
                    </div>
                  );
                }

                return docs.map(doc => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    docType={docType}
                    hasWarning={hasWarning}
                    onEdit={onEditDoc}
                    onDelete={onDeleteDoc}
                  />
                ));
              })}

              {/* Add document */}
              {showAddForm ? (
                <AddDocumentForm
                  onAdd={(docType, file) => handleAddDoc(docType, file)}
                  onCancel={() => setShowAddForm(false)}
                />
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm font-semibold transition hover:opacity-80"
                  style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
                >
                  <Plus className="h-4 w-4" /> Tambah Dokumen
                </button>
              )}
            </div>

            {/* Validation sidebar - right column */}
            <div className="space-y-4">
              {Object.entries(VALIDATION_CHECKLIST).map(([catKey, category]) => {
                const catItems = category.items;
                const foundCount = catItems.filter(item => nasabahDocs.some(d => d.documentType === item.type)).length;
                const requiredCount = catItems.filter(i => i.required).length;
                const requiredFound = catItems.filter(i => i.required && nasabahDocs.some(d => d.documentType === i.type)).length;

                return (
                  <div key={catKey} className="glass-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-sm">{category.label}</h3>
                      <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: requiredFound === requiredCount ? 'rgb(220 252 231)' : 'rgb(254 226 226)', color: requiredFound === requiredCount ? 'rgb(22 101 52)' : 'rgb(153 27 27)' }}>
                        {foundCount}/{catItems.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {catItems.map(item => {
                        const doc = nasabahDocs.find(d => d.documentType === item.type);
                        const found = !!doc;
                        return (
                          <div key={item.type} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: found ? 'rgb(240 253 244)' : item.required ? 'rgb(254 242 242)' : 'var(--primary-soft)' }}>
                            <div className="flex items-center gap-2 min-w-0">
                              {found ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" /> : item.required ? <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" /> : <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2" style={{ borderColor: 'var(--border)' }} />}
                              <span className="text-xs truncate">{item.label}</span>
                            </div>
                            {found && doc && <span className="text-[10px] font-semibold text-green-700">{Math.round(doc.confidence * 100)}%</span>}
                            {!found && item.required && <span className="text-[10px] font-semibold text-red-500">WAJIB</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {nasabah.warnings.length > 0 && (
                <div className="glass-card p-5">
                  <h3 className="flex items-center gap-2 font-bold text-sm mb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> Warnings
                  </h3>
                  {nasabah.warnings.map((w, i) => <p key={i} className="text-xs text-amber-600 mb-1">{w}</p>)}
                </div>
              )}

              {nasabah.missing.length > 0 && (
                <div className="glass-card p-5">
                  <h3 className="flex items-center gap-2 font-bold text-sm mb-3">
                    <XCircle className="h-4 w-4 text-red-400" /> Dokumen Missing
                  </h3>
                  {nasabah.missing.map((m, i) => <p key={i} className="text-xs text-red-500 mb-1">• {m}</p>)}
                </div>
              )}

              <button className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white" style={{ background: 'var(--primary)' }}>
                <Download className="h-4 w-4" /> Export JSON
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// --- Main Component ---

export function BulkResultStep({ jobId, onReset }: { jobId: string; onReset: () => void }) {
  const [data, setData] = useState<BulkJobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | NasabahStatus>('All');
  const [selectedNasabah, setSelectedNasabah] = useState<BulkNasabah | null>(null);

  useEffect(() => {
    bulkApi.getJobDetails(jobId).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [jobId]);

  // --- Edit/Delete/Add handlers (local state for now, will hit API later) ---

  const handleEditDoc = useCallback((doc: BulkDocument, fields: BulkDocumentField[]) => {
    setData(prev => {
      if (!prev) return prev;
      return { ...prev, documents: prev.documents.map(d => d.id === doc.id ? { ...d, fields } : d) };
    });
  }, []);

  const handleDeleteDoc = useCallback((docId: string) => {
    if (!confirm('Hapus dokumen ini?')) return;
    setData(prev => {
      if (!prev) return prev;
      return { ...prev, documents: prev.documents.filter(d => d.id !== docId) };
    });
  }, []);

  const handleAddDoc = useCallback(async (nasabahId: string, docType: string, file: File) => {
    // Upload to backend for AI processing
    try {
      const form = new FormData();
      form.append('files', file);
      const base = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000').replace(/\/+$/, '').replace(/\/api$/, '');
      const res = await fetch(`${base}/api/bulk/upload`, { method: 'POST', body: form });
      if (res.ok) {
        const { data: uploadResult } = await res.json();
        // Wait for processing then fetch the new doc details
        const details = await bulkApi.getJobDetails(uploadResult.jobId);
        const newDocs = details.documents.map((d: BulkDocument) => ({ ...d, nasabahId, documentType: docType }));
        setData(prev => {
          if (!prev) return prev;
          return { ...prev, documents: [...prev.documents, ...newDocs] };
        });
        return;
      }
    } catch { /* fallback below */ }

    // Fallback: add without AI processing
    setData(prev => {
      if (!prev) return prev;
      const newDoc: BulkDocument = {
        id: `new-${Date.now()}`,
        jobId: prev.id,
        nasabahId,
        documentType: docType,
        filename: file.name,
        pageCount: 1,
        confidence: 0,
        fields: [],
      };
      return { ...prev, documents: [...prev.documents, newDoc] };
    });
  }, []);

  const handleEditNasabah = useCallback((nasabahId: string, updates: { fullName?: string; nik?: string }) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        result: {
          ...prev.result,
          nasabah: prev.result.nasabah.map(n =>
            n.id === nasabahId ? { ...n, ...updates } : n
          ),
        },
      };
    });
  }, []);

  const handleDeleteNasabah = useCallback(async (nasabahId: string) => {
    if (!confirm('Hapus nasabah ini beserta semua dokumennya?')) return;
    try {
      await bulkApi.deleteNasabah(jobId, nasabahId);
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          result: {
            ...prev.result,
            totalNasabah: prev.result.totalNasabah - 1,
            nasabah: prev.result.nasabah.filter(n => n.id !== nasabahId),
          },
          documents: prev.documents.filter(d => d.nasabahId !== nasabahId),
        };
      });
    } catch (err) {
      console.error('[BulkResult] deleteNasabah failed:', err);
      alert(`Gagal menghapus: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [jobId]);

  // --- Derived data ---

  const nasabahWithStatus = useMemo(() => {
    if (!data) return [];
    return data.result.nasabah.map(n => ({ ...n, _status: getNasabahStatus(n) }));
  }, [data]);

  const filtered = useMemo(() => {
    return nasabahWithStatus.filter(n => {
      const matchQuery = [n.fullName, n.nik].join(' ').toLowerCase().includes(query.toLowerCase());
      const matchStatus = statusFilter === 'All' || n._status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [nasabahWithStatus, query, statusFilter]);

  if (loading) return <div className="text-center py-12 text-muted">Memuat hasil...</div>;
  if (!data) return <div className="text-center py-12 text-red-500">Gagal memuat hasil.</div>;

  const verified = nasabahWithStatus.filter(n => n._status === 'Verified').length;
  const needReview = nasabahWithStatus.filter(n => n._status === 'Need Review').length;
  const incomplete = nasabahWithStatus.filter(n => n._status === 'Incomplete').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
            <FileText className="h-3.5 w-3.5" /> Bulk Processing Result
          </div>
          <h1 className="mt-3 text-2xl font-bold">Hasil Pemrosesan Dokumen</h1>
          <p className="mt-1 text-sm text-muted">
            {data.result.totalNasabah} nasabah • {data.documents.length} dokumen • {data.result.totalPages} halaman
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onReset} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition hover:opacity-80" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
            <RotateCcw className="w-4 h-4" /> Upload Baru
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--primary)' }}>
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={UserRound} label="Total Nasabah" value={data.result.totalNasabah} helper="teridentifikasi otomatis" />
        <StatCard icon={CheckCircle2} label="Verified" value={verified} helper="dokumen lengkap" />
        <StatCard icon={AlertTriangle} label="Need Review" value={needReview} helper="perlu pengecekan" />
        <StatCard icon={XCircle} label="Incomplete" value={incomplete} helper="dokumen kurang" />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-center lg:justify-between" style={{ borderColor: 'var(--border)' }}>
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama atau NIK..." className="input-base pl-11" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted hidden sm:block" />
            {(['All', 'Verified', 'Need Review', 'Incomplete'] as const).map(item => (
              <button
                key={item}
                onClick={() => setStatusFilter(item)}
                className="rounded-full px-4 py-2 text-sm font-semibold transition"
                style={{ background: statusFilter === item ? 'var(--primary)' : 'var(--primary-soft)', color: statusFilter === item ? 'white' : 'var(--primary)' }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted" style={{ background: 'var(--primary-soft)' }}>
              <tr>
                <th className="px-5 py-4 font-bold">Nasabah</th>
                <th className="px-5 py-4 font-bold">NIK</th>
                <th className="px-5 py-4 font-bold">Dokumen</th>
                <th className="px-5 py-4 font-bold">Status</th>
                <th className="px-5 py-4 font-bold">Completeness</th>
                <th className="px-5 py-4 text-right font-bold">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filtered.map(n => (
                <tr key={n.id} className="transition hover:bg-[var(--primary-soft)]">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl font-bold" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                        {n.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold">{n.fullName}</p>
                        <p className="text-xs text-muted">{n.documentCount} dokumen</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-medium">{n.nik}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1">
                      {REQUIRED_DOCS.map(dt => {
                        const found = data.documents.some(d => d.nasabahId === n.id && d.documentType === dt);
                        return <div key={dt} title={DOC_LABELS[dt]} className="w-2.5 h-2.5 rounded-full" style={{ background: found ? '#22c55e' : '#ef4444' }} />;
                      })}
                    </div>
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={n._status} /></td>
                  <td className="px-5 py-4"><ConfidenceBar score={n.completenessScore} /></td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setSelectedNasabah(n)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:opacity-80" style={{ borderColor: 'var(--border)' }}>
                        <Eye className="h-4 w-4" /> View
                      </button>
                      <button onClick={() => handleDeleteNasabah(n.id)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 bg-red-50 transition hover:bg-red-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold">Data tidak ditemukan</p>
            <p className="mt-1 text-sm text-muted">Coba ubah keyword atau filter status.</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedNasabah && (
        <DetailModal
          nasabah={selectedNasabah}
          documents={data.documents}
          onClose={() => setSelectedNasabah(null)}
          onEditDoc={handleEditDoc}
          onDeleteDoc={handleDeleteDoc}
          onAddDoc={handleAddDoc}
          onEditNasabah={handleEditNasabah}
        />
      )}
    </div>
  );
}
