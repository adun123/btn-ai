const { calculateSimilarity, normalizeName } = require('./grouping.service');

const ROLE_SENSITIVE_DOC_TYPES = new Set(['ktp', 'npwp', 'pas_foto']);
const SPOUSE_TYPE_MAP = {
  ktp: 'ktp_pasangan',
  npwp: 'npwp_pasangan',
  pas_foto: 'pas_foto_pasangan',
};
const FIXED_DOC_TYPES = new Set(['slip_gaji', 'surat_keterangan_kerja']);
const NON_FIXED_DOC_TYPES = new Set(['nib', 'laporan_keuangan_usaha', 'dokumen_informasi_usaha', 'siup_tdp', 'akte_pendirian', 'izin_praktik']);
const SHARED_DOC_TYPES = new Set(['formulir_aplikasi_kredit', 'kk', 'akta_nikah', 'akta_cerai', 'surat_pemesanan_rumah']);
const PERSONAL_NAME_DOC_TYPES = new Set(['ktp', 'npwp', 'slip_gaji', 'rekening_koran', 'surat_keterangan_kerja']);
const UNIDENTIFIED_NAMES = new Set(['tidak teridentifikasi', 'unidentified']);

function evaluateAllNasabahRules(nasabahList, documents) {
  const docMap = new Map(documents.map((document) => [document.id, document]));

  return nasabahList.map((nasabah) => {
    const nasabahDocuments = (nasabah.documentIds || [])
      .map((documentId) => docMap.get(documentId))
      .filter(Boolean);

    return evaluateNasabahRules(nasabah, nasabahDocuments);
  });
}

function evaluateNasabahRules(nasabah, documents) {
  const contexts = documents.map(createDocumentContext);
  const facts = collectFacts(contexts);
  const maritalStatus = inferMaritalStatus(facts);
  const applicant = resolveApplicant(nasabah, facts);
  const spouse = resolveSpouse(applicant, facts, maritalStatus);
  const documentRoles = assignDocumentRoles(contexts, applicant, spouse, maritalStatus);
  const joinIncome = inferJoinIncome(facts, contexts, documentRoles, spouse, maritalStatus);
  const incomeAnalysis = inferIncomeType(facts);
  const typeCounts = buildTypeCounts(contexts, documentRoles, spouse, maritalStatus);
  const unresolvedRoleSensitiveDocs = contexts.filter((context) => {
    if (!ROLE_SENSITIVE_DOC_TYPES.has(context.documentType)) return false;
    return documentRoles[context.id] === 'unknown';
  });

  const warnings = uniqueStrings([
    ...facts.warnings,
    ...incomeAnalysis.warnings,
    ...buildContextWarnings({
      maritalStatus,
      joinIncome,
      incomeType: incomeAnalysis.type,
      spouse,
      applicant,
      facts,
      unresolvedRoleSensitiveDocs,
    }),
  ]);
  const reasons = uniqueStrings(buildReasons({ applicant, spouse, maritalStatus, joinIncome, incomeType: incomeAnalysis.type, facts }));

  const categoryReasons = buildCategoryReasons({ maritalStatus, incomeType: incomeAnalysis.type });
  const activeChecklistKeys = Object.entries(categoryReasons)
    .filter(([, value]) => value.active)
    .map(([key]) => key);
  const inactiveChecklistKeys = Object.entries(categoryReasons)
    .filter(([, value]) => !value.active)
    .map(([key]) => key);

  return {
    nasabahId: nasabah.id,
    applicant,
    spouse,
    maritalStatus,
    joinIncome,
    incomeType: incomeAnalysis.type,
    activeChecklistKeys,
    inactiveChecklistKeys,
    categoryReasons,
    typeCounts,
    warnings,
    reasons,
    facts: summarizeFacts(facts),
  };
}

function createDocumentContext(document) {
  const fields = document.extractedFields && typeof document.extractedFields === 'object'
    ? document.extractedFields
    : {};
  const normalizedFields = normalizeFieldMap(fields);

  return {
    id: document.id,
    documentType: document.documentType,
    sourceFilename: document.sourceFilename || '',
    fields,
    normalizedFields,
  };
}

function collectFacts(contexts) {
  const facts = {
    explicitApplicantNames: [],
    explicitSpouseNames: [],
    applicantNikCandidates: [],
    spouseNikCandidates: [],
    personalCandidates: [],
    marriagePairs: [],
    maritalHints: [],
    joinIncomeHints: [],
    fixedSignals: [],
    nonFixedSignals: [],
    warnings: [],
  };

  for (const context of contexts) {
    const { documentType, fields, normalizedFields } = context;

    pushCandidate(facts.personalCandidates, {
      name: firstTruthy(fields.nama, fields.fullName, fields.kepalaKeluarga, fields.atasNama),
      nik: firstTruthy(fields.nik),
      source: documentType,
    });

    if (PERSONAL_NAME_DOC_TYPES.has(documentType)) {
      pushCandidate(facts.personalCandidates, {
        name: firstTruthy(fields.nama, fields.fullName, fields.atasNama),
        nik: firstTruthy(fields.nik),
        source: documentType,
      });
    }

    if (documentType === 'formulir_aplikasi_kredit') {
      pushCandidate(facts.explicitApplicantNames, {
        name: readField(normalizedFields, ['applicantname', 'namapemohon', 'namadebitur', 'namacalondebitur', 'pemohon', 'debitur']),
        nik: readField(normalizedFields, ['applicantnik', 'nikpemohon', 'nikdebitur', 'noktppemohon']),
        source: documentType,
      });
      pushCandidate(facts.explicitSpouseNames, {
        name: readField(normalizedFields, ['spousename', 'namapasangan', 'namasuamiistri', 'namasuami', 'namaistri', 'pasangan']),
        nik: readField(normalizedFields, ['spousenik', 'nikpasangan', 'noktppasangan']),
        source: documentType,
      });

      const applicantNik = readField(normalizedFields, ['applicantnik', 'nikpemohon', 'nikdebitur', 'noktppemohon']);
      const spouseNik = readField(normalizedFields, ['spousenik', 'nikpasangan', 'noktppasangan']);
      if (applicantNik) facts.applicantNikCandidates.push(applicantNik);
      if (spouseNik) facts.spouseNikCandidates.push(spouseNik);

      const maritalHint = readField(normalizedFields, ['maritalstatus', 'statusperkawinan', 'statuspernikahan', 'statusnikah']);
      if (maritalHint) facts.maritalHints.push(maritalHint);

      const joinIncomeHint = readField(normalizedFields, ['joinincome', 'jointincome', 'penghasilangabungan', 'penghasilanbersama', 'combinedincome']);
      if (joinIncomeHint) facts.joinIncomeHints.push(joinIncomeHint);

      addIncomeSignal(facts, readField(normalizedFields, ['incometype', 'incomecategory', 'jenispenghasilan', 'statuspenghasilan']), documentType);
      addIncomeSignal(facts, readField(normalizedFields, ['spouseincometype', 'jenispenghasilanpasangan', 'statuspenghasilanpasangan']), `${documentType}:pasangan`);
      addIncomeSignal(facts, readField(normalizedFields, ['applicantoccupation', 'pekerjaanpemohon', 'occupation']), `${documentType}:pemohon`);
      addIncomeSignal(facts, readField(normalizedFields, ['spouseoccupation', 'pekerjaanpasangan']), `${documentType}:pasangan`);
    }

    if (documentType === 'akta_nikah') {
      const husband = firstTruthy(fields.suami, readField(normalizedFields, ['suami', 'husbandname']));
      const wife = firstTruthy(fields.istri, readField(normalizedFields, ['istri', 'isteri', 'wifename']));
      if (husband || wife) {
        facts.marriagePairs.push({ husband, wife, source: documentType });
      }
      facts.maritalHints.push('menikah');
      pushCandidate(facts.personalCandidates, { name: husband, source: documentType });
      pushCandidate(facts.personalCandidates, { name: wife, source: documentType });
    }

    if (documentType === 'akta_cerai') {
      facts.maritalHints.push('cerai');
    }

    if (documentType === 'ktp') {
      const maritalHint = firstTruthy(fields.statusPerkawinan, readField(normalizedFields, ['statusperkawinan', 'maritalstatus']));
      if (maritalHint) facts.maritalHints.push(maritalHint);
      addIncomeSignal(facts, firstTruthy(fields.pekerjaan, readField(normalizedFields, ['pekerjaan', 'occupation'])), documentType);
    }

    if (documentType === 'surat_keterangan_kerja') {
      addIncomeSignal(facts, firstTruthy(fields.statusKaryawan, fields.jabatan), documentType);
    }

    if (documentType === 'kk') {
      pushCandidate(facts.personalCandidates, {
        name: firstTruthy(fields.kepalaKeluarga),
        nik: firstTruthy(fields.noKK),
        source: documentType,
      });
    }

    if (FIXED_DOC_TYPES.has(documentType)) {
      facts.fixedSignals.push(documentType);
    }
    if (NON_FIXED_DOC_TYPES.has(documentType)) {
      facts.nonFixedSignals.push(documentType);
    }
  }

  return facts;
}

function resolveApplicant(nasabah, facts) {
  const explicitApplicant = pickBestCandidate(facts.explicitApplicantNames);
  const matchedExplicitCandidate = explicitApplicant?.name
    ? findMatchingCandidate(explicitApplicant.name, facts.personalCandidates)
    : null;
  const nasabahName = isMeaningfulName(nasabah.fullName) ? nasabah.fullName : '';
  const matchedNasabahCandidate = nasabahName
    ? findMatchingCandidate(nasabahName, facts.personalCandidates)
    : null;
  const ktpCandidate = pickBestCandidate(facts.personalCandidates.filter((candidate) => candidate.source === 'ktp'));
  const fallbackCandidate = pickBestCandidate(facts.personalCandidates);

  const candidate = matchedExplicitCandidate || explicitApplicant || matchedNasabahCandidate || ktpCandidate || fallbackCandidate || null;
  const name = firstTruthy(explicitApplicant?.name, candidate?.name, nasabahName);
  const nik = firstTruthy(explicitApplicant?.nik, candidate?.nik, nasabah.nik);

  return {
    name,
    nik,
    source: candidate?.source || (explicitApplicant ? 'formulir_aplikasi_kredit' : (nasabahName ? 'nasabah_grouping' : 'unknown')),
  };
}

function resolveSpouse(applicant, facts, maritalStatus) {
  const explicitSpouse = pickBestCandidate(facts.explicitSpouseNames);
  const matchedExplicitCandidate = explicitSpouse?.name
    ? findMatchingCandidate(explicitSpouse.name, facts.personalCandidates)
    : null;

  if (matchedExplicitCandidate || explicitSpouse) {
    const source = matchedExplicitCandidate?.source || explicitSpouse?.source || 'formulir_aplikasi_kredit';
    return {
      name: firstTruthy(explicitSpouse?.name, matchedExplicitCandidate?.name),
      nik: firstTruthy(explicitSpouse?.nik, matchedExplicitCandidate?.nik),
      source,
    };
  }

  for (const pair of facts.marriagePairs) {
    if (matchesPersonName(pair.husband, applicant.name)) {
      return { name: pair.wife, nik: firstTruthy(facts.spouseNikCandidates[0]), source: pair.source };
    }
    if (matchesPersonName(pair.wife, applicant.name)) {
      return { name: pair.husband, nik: firstTruthy(facts.spouseNikCandidates[0]), source: pair.source };
    }
  }

  if (maritalStatus !== 'married') {
    return { name: '', nik: '', source: 'not_applicable' };
  }

  const secondaryCandidate = facts.personalCandidates.find((candidate) => {
    if (!candidate.name || !applicant.name) return false;
    return !matchesPersonName(candidate.name, applicant.name);
  });

  return {
    name: firstTruthy(secondaryCandidate?.name),
    nik: firstTruthy(secondaryCandidate?.nik, facts.spouseNikCandidates[0]),
    source: secondaryCandidate?.source || 'inferred',
  };
}

function inferMaritalStatus(facts) {
  let marriedCount = 0;
  let notMarriedCount = 0;

  for (const hint of facts.maritalHints) {
    const normalized = parseMaritalStatus(hint);
    if (normalized === 'married') marriedCount += 1;
    if (normalized === 'not_married') notMarriedCount += 1;
  }

  if (facts.marriagePairs.length > 0) marriedCount += 1;

  if (marriedCount > 0 && marriedCount >= notMarriedCount) return 'married';
  if (notMarriedCount > 0) return 'not_married';
  return 'unknown';
}

function inferJoinIncome(facts, contexts, documentRoles, spouse, maritalStatus) {
  const explicit = facts.joinIncomeHints
    .map(parseYesNoUnknown)
    .find((value) => value !== 'unknown');

  if (explicit !== undefined) {
    return explicit;
  }

  if (maritalStatus !== 'married' || !spouse.name) {
    return 'no';
  }

  const spouseIncomeDocs = contexts.filter((context) => {
    const role = documentRoles[context.id];
    if (role !== 'spouse') return false;
    return FIXED_DOC_TYPES.has(context.documentType)
      || NON_FIXED_DOC_TYPES.has(context.documentType)
      || context.documentType === 'rekening_koran';
  });

  if (spouseIncomeDocs.length > 0) {
    return 'yes';
  }

  return 'unknown';
}

function inferIncomeType(facts) {
  const fixedFromHints = facts.fixedSignals.some((signal) => parseIncomeSignal(signal) === 'fixed');
  const nonFixedFromHints = facts.nonFixedSignals.some((signal) => parseIncomeSignal(signal) === 'non_fixed');
  const hasFixedDocs = facts.fixedSignals.some((signal) => FIXED_DOC_TYPES.has(signal));
  const hasNonFixedDocs = facts.nonFixedSignals.some((signal) => NON_FIXED_DOC_TYPES.has(signal));

  const hasFixed = fixedFromHints || hasFixedDocs;
  const hasNonFixed = nonFixedFromHints || hasNonFixedDocs;

  if (hasFixed && hasNonFixed) {
    return {
      type: 'mixed',
      warnings: ['Dokumen penghasilan menunjukkan sinyal fixed dan non-fixed sekaligus. Checklist fixed dan non-fixed diaktifkan bersamaan.'],
    };
  }
  if (hasFixed) {
    return { type: 'fixed', warnings: [] };
  }
  if (hasNonFixed) {
    return { type: 'non_fixed', warnings: [] };
  }
  return {
    type: 'unknown',
    warnings: ['Jenis penghasilan belum dapat ditentukan dari dokumen yang tersedia.'],
  };
}

function assignDocumentRoles(contexts, applicant, spouse, maritalStatus) {
  const roles = {};

  for (const context of contexts) {
    const { documentType, fields } = context;

    if (SHARED_DOC_TYPES.has(documentType)) {
      roles[context.id] = 'shared';
      continue;
    }

    const nameCandidates = [
      fields.nama,
      fields.fullName,
      fields.atasNama,
      fields.kepalaKeluarga,
      fields.suami,
      fields.istri,
      fields.namaUsaha,
      fields.applicantName,
      fields.spouseName,
    ].filter(Boolean);
    const nikCandidates = [fields.nik, fields.applicantNik, fields.spouseNik].filter(Boolean);

    const matchesApplicant = nameCandidates.some((name) => matchesPersonName(name, applicant.name))
      || nikCandidates.some((nik) => applicant.nik && nik === applicant.nik);
    const matchesSpouse = nameCandidates.some((name) => matchesPersonName(name, spouse.name))
      || nikCandidates.some((nik) => spouse.nik && nik === spouse.nik);

    if (matchesApplicant && !matchesSpouse) {
      roles[context.id] = 'applicant';
      continue;
    }
    if (matchesSpouse && !matchesApplicant) {
      roles[context.id] = 'spouse';
      continue;
    }
    if (matchesApplicant && matchesSpouse) {
      roles[context.id] = 'shared';
      continue;
    }

    if (ROLE_SENSITIVE_DOC_TYPES.has(documentType)) {
      if (maritalStatus !== 'married' || !spouse.name) {
        roles[context.id] = 'applicant';
      } else {
        roles[context.id] = 'unknown';
      }
      continue;
    }

    roles[context.id] = 'shared';
  }

  return roles;
}

function buildTypeCounts(contexts, documentRoles, spouse, maritalStatus) {
  const typeCounts = {};

  for (const context of contexts) {
    const role = documentRoles[context.id] || 'unknown';
    const { documentType } = context;

    if (ROLE_SENSITIVE_DOC_TYPES.has(documentType)) {
      if (role === 'spouse') {
        increment(typeCounts, SPOUSE_TYPE_MAP[documentType]);
        continue;
      }
      if (
        role === 'applicant'
        || role === 'shared'
        || role === 'unknown'
        || maritalStatus !== 'married'
        || !spouse.name
      ) {
        increment(typeCounts, documentType);
      }
      continue;
    }

    increment(typeCounts, documentType);
  }

  return typeCounts;
}

function buildCategoryReasons({ maritalStatus, incomeType }) {
  return {
    data_diri: {
      active: true,
      reason: 'Dokumen dasar pemohon selalu diperiksa.',
    },
    data_pasangan: maritalStatus === 'married'
      ? { active: true, reason: 'Aktif karena dokumen menunjukkan status menikah.' }
      : maritalStatus === 'not_married'
        ? { active: false, reason: 'Dinonaktifkan karena dokumen menunjukkan belum menikah / tidak ada pasangan aktif.' }
        : { active: false, reason: 'Status perkawinan belum cukup jelas, sehingga checklist pasangan tidak diaktifkan otomatis.' },
    penghasilan_fixed: incomeType === 'fixed' || incomeType === 'mixed'
      ? { active: true, reason: incomeType === 'mixed' ? 'Aktif karena ada sinyal fixed dan non-fixed sekaligus.' : 'Aktif karena dokumen penghasilan mengarah ke fixed income.' }
      : { active: false, reason: incomeType === 'non_fixed' ? 'Dinonaktifkan karena dokumen penghasilan mengarah ke non-fixed income.' : 'Dinonaktifkan karena jenis penghasilan belum fixed.' },
    penghasilan_non_fixed: incomeType === 'non_fixed' || incomeType === 'mixed'
      ? { active: true, reason: incomeType === 'mixed' ? 'Aktif karena ada sinyal fixed dan non-fixed sekaligus.' : 'Aktif karena dokumen penghasilan mengarah ke non-fixed income.' }
      : { active: false, reason: incomeType === 'fixed' ? 'Dinonaktifkan karena dokumen penghasilan mengarah ke fixed income.' : 'Dinonaktifkan karena jenis penghasilan belum non-fixed.' },
    dokumen_pendukung: {
      active: true,
      reason: 'Dokumen pendukung tetap dicatat bila tersedia.',
    },
  };
}

function buildContextWarnings({ maritalStatus, joinIncome, incomeType, spouse, applicant, facts, unresolvedRoleSensitiveDocs }) {
  const warnings = [];

  if (maritalStatus === 'unknown' && (facts.explicitSpouseNames.length > 0 || facts.marriagePairs.length > 0)) {
    warnings.push('Terdapat sinyal pasangan, tetapi status perkawinan belum dapat dipastikan secara kuat.');
  }
  if (maritalStatus === 'married' && !spouse.name) {
    warnings.push('Status menikah terdeteksi, tetapi identitas pasangan belum bisa dibedakan dari dokumen yang ada.');
  }
  if (!applicant.name) {
    warnings.push('Identitas pemohon utama belum dapat diidentifikasi secara pasti.');
  }
  if (joinIncome === 'unknown' && maritalStatus === 'married') {
    warnings.push('Status join income belum dapat dipastikan dari dokumen yang tersedia.');
  }
  if (incomeType === 'unknown') {
    warnings.push('Checklist penghasilan belum diaktifkan karena jenis penghasilan belum dapat dipastikan.');
  }
  if (Array.isArray(unresolvedRoleSensitiveDocs) && unresolvedRoleSensitiveDocs.length > 0) {
    const docLabels = uniqueStrings(unresolvedRoleSensitiveDocs.map((context) => context.documentType)).join(', ');
    warnings.push(`Ada dokumen personal yang belum bisa dipetakan tegas ke pemohon/pasangan (${docLabels}). Dokumen tersebut tetap dihitung sebagai dokumen dasar pemohon sampai ada bukti pembeda yang lebih kuat.`);
  }

  return warnings;
}

function buildReasons({ applicant, spouse, maritalStatus, joinIncome, incomeType, facts }) {
  const reasons = [];

  if (applicant.name) {
    reasons.push(`Pemohon utama dipilih sebagai "${applicant.name}" dari sumber ${applicant.source}.`);
  }
  if (spouse.name) {
    reasons.push(`Pasangan terdeteksi sebagai "${spouse.name}" dari sumber ${spouse.source}.`);
  }
  reasons.push(`Status perkawinan: ${maritalStatus}.`);
  reasons.push(`Join income: ${joinIncome}.`);
  reasons.push(`Jenis penghasilan: ${incomeType}.`);

  if (facts.marriagePairs.length > 0) {
    reasons.push('Dokumen akta/buku nikah ikut dipakai sebagai sinyal pasangan.');
  }

  return reasons;
}

function summarizeFacts(facts) {
  return {
    explicitApplicantNames: uniqueStrings(facts.explicitApplicantNames.map((candidate) => candidate.name).filter(Boolean)),
    explicitSpouseNames: uniqueStrings(facts.explicitSpouseNames.map((candidate) => candidate.name).filter(Boolean)),
    marriagePairCount: facts.marriagePairs.length,
    fixedSignals: uniqueStrings(facts.fixedSignals),
    nonFixedSignals: uniqueStrings(facts.nonFixedSignals),
  };
}

function addIncomeSignal(facts, rawValue, source) {
  const signal = parseIncomeSignal(rawValue);
  if (signal === 'fixed') {
    facts.fixedSignals.push(source);
  }
  if (signal === 'non_fixed') {
    facts.nonFixedSignals.push(source);
  }
}

function parseIncomeSignal(value) {
  const normalized = normalizeLooseText(value);
  if (!normalized) return 'unknown';

  if (
    normalized.includes('non fixed')
    || normalized.includes('nonfixed')
    || normalized.includes('wiraswasta')
    || normalized.includes('usaha')
    || normalized.includes('pengusaha')
    || normalized.includes('mandiri')
    || normalized.includes('profesi')
  ) {
    return 'non_fixed';
  }

  if (
    normalized.includes('fixed')
    || normalized.includes('tetap')
    || normalized.includes('pegawai')
    || normalized.includes('karyawan')
    || normalized.includes('pns')
  ) {
    return 'fixed';
  }

  return 'unknown';
}

function parseYesNoUnknown(value) {
  const normalized = normalizeLooseText(value);
  if (!normalized) return 'unknown';
  if (
    normalized.includes('tidak join')
    || normalized.includes('tidak gabung')
    || normalized.includes('tidak bersama')
    || normalized.includes('bukan join')
    || normalized.includes('bukan gabung')
    || normalized.includes('sendiri')
    || normalized === 'tidak'
    || normalized === 'no'
    || normalized === 'n'
    || normalized === 'false'
  ) {
    return 'no';
  }
  if (
    normalized === 'ya'
    || normalized === 'yes'
    || normalized === 'y'
    || normalized === 'true'
    || normalized.includes('join income')
    || normalized.includes('joint income')
    || normalized.includes('joinincome')
    || normalized.includes('gabung penghasilan')
    || normalized.includes('penghasilan gabungan')
    || normalized.includes('penghasilan bersama')
    || normalized.includes('join')
    || normalized.includes('gabung')
    || normalized.includes('bersama')
  ) {
    return 'yes';
  }
  return 'unknown';
}

function parseMaritalStatus(value) {
  const normalized = normalizeLooseText(value);
  if (!normalized) return 'unknown';
  if (
    normalized.includes('belum menikah')
    || normalized.includes('belum kawin')
    || normalized.includes('single')
    || normalized.includes('tidak kawin')
    || normalized.includes('cerai')
    || normalized.includes('janda')
    || normalized.includes('duda')
  ) {
    return 'not_married';
  }
  if (normalized.includes('menikah') || normalized.includes('kawin')) return 'married';
  return 'unknown';
}

function normalizeFieldMap(fields) {
  const normalized = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value == null || value === '') continue;
    normalized[normalizeFieldKey(key)] = value;
  }

  return normalized;
}

function normalizeFieldKey(key) {
  return String(key)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function readField(normalizedFields, aliases) {
  for (const alias of aliases) {
    const value = normalizedFields[alias];
    if (value != null && value !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function pushCandidate(target, candidate) {
  if (!candidate || !isMeaningfulName(candidate.name)) return;
  target.push({
    name: candidate.name.trim(),
    nik: firstTruthy(candidate.nik),
    source: candidate.source || 'unknown',
  });
}

function pickBestCandidate(candidates) {
  return candidates.find((candidate) => isMeaningfulName(candidate.name)) || null;
}

function findMatchingCandidate(name, candidates) {
  if (!isMeaningfulName(name)) return null;
  const target = normalizeName(name);
  let best = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    if (!isMeaningfulName(candidate.name)) continue;
    const score = calculateSimilarity(target, normalizeName(candidate.name));
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return bestScore >= 0.8 ? best : null;
}

function matchesPersonName(left, right) {
  if (!isMeaningfulName(left) || !isMeaningfulName(right)) return false;
  return calculateSimilarity(normalizeName(left), normalizeName(right)) >= 0.8;
}

function isMeaningfulName(value) {
  const normalized = normalizeName(firstTruthy(value));
  return Boolean(normalized) && !UNIDENTIFIED_NAMES.has(normalized);
}

function normalizeLooseText(value) {
  return String(firstTruthy(value))
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function increment(object, key) {
  if (!key) return;
  object[key] = (object[key] || 0) + 1;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function firstTruthy(...values) {
  return values.find((value) => value != null && value !== '') || '';
}

module.exports = {
  evaluateAllNasabahRules,
  evaluateNasabahRules,
};
