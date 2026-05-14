import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase.js';
import { registerStudentUnified } from './studentRegistryService.js';
import { normalizeStudentProcessNumber } from '../utils/processNumber.js';

function normalizeString(value) {
  return String(value ?? '').trim();
}

function currentSchoolYear() {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

function normalizeHeader(value) {
  return normalizeString(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const HEADER_ALIASES = {
  processNumber: ['processo', 'nprocesso', 'numprocesso', 'numeroprocesso', 'numerodeprocesso', 'processnumber', 'nproc', 'nrproc', 'noproc'],
  fullName: ['nomecompleto', 'nome', 'fullname', 'name', 'nomecompletodoaluno', 'nomedoaluno'],
  email: ['email', 'correio', 'correioeletronico', 'correioelectronico', 'e-mail', 'mail'],
  phoneNumber: ['telemovel', 'telefone', 'contacto', 'contato', 'phone', 'phonenumber', 'numerodetelemovel', 'numerodetelefone'],
};

function mapHeaders(headerRow) {
  const mapped = {};

  headerRow.forEach((headerValue, index) => {
    const normalized = normalizeHeader(headerValue);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(normalized) && mapped[field] === undefined) {
        mapped[field] = index;
      }
    }
  });

  return mapped;
}

function scoreHeaderMap(map) {
  let score = 0;
  if (map.processNumber !== undefined) score += 2;
  if (map.fullName !== undefined) score += 2;
  if (map.email !== undefined) score += 1;
  if (map.phoneNumber !== undefined) score += 1;
  return score;
}

function detectHeaderRow(rawRows) {
  let best = null;
  const maxScan = Math.min(rawRows.length, 40);

  for (let i = 0; i < maxScan; i++) {
    const row = rawRows[i] ?? [];
    const map = mapHeaders(row);
    const score = scoreHeaderMap(map);
    if (!best || score > best.score) {
      best = { rowIndex: i, map, score };
    }
    if (score >= 4) break;
  }

  if (!best) return null;
  if (best.map.processNumber === undefined || best.map.fullName === undefined) return null;
  return best;
}

export async function parseExcelImportRows(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (rawRows.length < 2) {
    throw new Error('O ficheiro Excel deve conter pelo menos cabeçalho e uma linha de dados.');
  }

  const detectedHeader = detectHeaderRow(rawRows);
  if (!detectedHeader) {
    throw new Error('Não foi possível localizar as colunas de Processo e Nome Completo no ficheiro.');
  }

  const dataRows = [];

  for (let i = detectedHeader.rowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || !row.some((cell) => normalizeString(cell) !== '')) continue;

    const processNumber = normalizeStudentProcessNumber(row[detectedHeader.map.processNumber]);
    const fullName = normalizeString(row[detectedHeader.map.fullName]);
    const email = detectedHeader.map.email !== undefined
      ? normalizeString(row[detectedHeader.map.email]).toLowerCase()
      : '';
    const phoneNumber = detectedHeader.map.phoneNumber !== undefined
      ? normalizeString(row[detectedHeader.map.phoneNumber])
      : '';

    dataRows.push({
      _rowNum: i + 1,
      processNumber,
      fullName,
      email,
      phoneNumber,
    });
  }

  return {
    rows: dataRows,
    headerRowNumber: detectedHeader.rowIndex + 1,
  };
}

export async function importExcelData(file) {
  const parsed = await parseExcelImportRows(file);
  const rows = parsed.rows;

  if (!rows.length) {
    throw new Error('Não foram encontradas linhas válidas para importação.');
  }

  const results = {
    processNumbersRegistered: 0,
    studentsRegistered: 0,
    accountsAlreadyLinked: 0,
    withEmail: 0,
    withPhoneNumber: 0,
    rowsProcessed: 0,
    skipped: 0,
    errors: [],
    warnings: []
  };

  const seenProcessesInFile = new Set();
  const accountExistsCache = new Map();
  const schoolYear = currentSchoolYear();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!row) continue;

    results.rowsProcessed++;

    try {
      const processNumber = normalizeStudentProcessNumber(row.processNumber);
      const fullName = normalizeString(row.fullName);
      const email = normalizeString(row.email).toLowerCase();
      const phoneNumber = normalizeString(row.phoneNumber);
      const rowNumber = row._rowNum ?? rowIndex + 2;

      if (!processNumber || !fullName) {
        results.skipped++;
        results.errors.push(`Linha ${rowNumber}: Processo e Nome Completo são obrigatórios.`);
        continue;
      }

      if (seenProcessesInFile.has(processNumber)) {
        results.skipped++;
        results.warnings.push(`Linha ${rowNumber}: processo ${processNumber} duplicado no ficheiro (linha ignorada).`);
        continue;
      }
      seenProcessesInFile.add(processNumber);

      const studentInput = {
        processNumber,
        fullName,
        email: email || null,
        phoneNumber: phoneNumber || null,
        courseCode: 'GERAL',
        schoolYear,
        internshipStatus: 'active',
      };

      if (!accountExistsCache.has(processNumber)) {
        const { data: accountRow } = await supabase
          .from('student_accounts')
          .select('id')
          .eq('process_number', processNumber)
          .limit(1)
          .maybeSingle();
        accountExistsCache.set(processNumber, Boolean(accountRow?.id));
      }

      const hasLinkedAccount = accountExistsCache.get(processNumber) === true;
      if (hasLinkedAccount) {
        results.accountsAlreadyLinked++;
        results.warnings.push(`Linha ${rowNumber}: processo ${processNumber} já tem conta criada; foi atualizado apenas o pré-registo académico.`);
      }

      await registerStudentUnified(studentInput);

      results.studentsRegistered++;
      results.processNumbersRegistered++;
  if (email) results.withEmail++;
  if (phoneNumber) results.withPhoneNumber++;

    } catch (err) {
      results.errors.push(`Linha ${rowIndex + 2}: ${err.message}`);
    }
  }

  return results;
}