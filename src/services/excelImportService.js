import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase.js';
import { registerStudentUnified } from './studentRegistryService.js';
import { createManualClass } from './classesService.js';
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
  processNumber: ['processo', 'nprocesso', 'numprocesso', 'numeroprocesso', 'numerodeprocesso', 'processnumber'],
  fullName: ['nomecompleto', 'nome', 'fullname', 'name'],
  className: ['turma', 'class', 'classname', 'nomedaturma', 'turmanome'],
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

export async function importExcelData(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (jsonData.length < 2) {
    throw new Error('O ficheiro Excel deve conter pelo menos uma linha de cabeçalho e uma linha de dados.');
  }

  const headers = jsonData[0].map(h => normalizeString(h).toLowerCase());
  const rows = jsonData.slice(1);

  const headerMap = mapHeaders(headers);
  if (
    headerMap.processNumber === undefined
    || headerMap.fullName === undefined
    || headerMap.className === undefined
  ) {
    throw new Error('Cabeçalhos obrigatórios: Processo, Nome Completo e Turma.');
  }

  const results = {
    areasCreated: 0,
    coursesCreated: 0,
    classesCreated: 0,
    studentsRegistered: 0,
    rowsProcessed: 0,
    skipped: 0,
    errors: [],
    warnings: []
  };

  const classCache = new Set();
  const schoolYear = currentSchoolYear();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!row || row.length === 0) continue;

    results.rowsProcessed++;

    try {
      const processNumber = normalizeStudentProcessNumber(row[headerMap.processNumber]);
      const fullName = normalizeString(row[headerMap.fullName]);
      const className = normalizeString(row[headerMap.className]);

      if (!processNumber || !fullName || !className) {
        results.skipped++;
        results.errors.push(`Linha ${rowIndex + 2}: Processo, Nome Completo e Turma são obrigatórios.`);
        continue;
      }

      const classKey = `${schoolYear}|GERAL|${className.toUpperCase()}`;
      if (!classCache.has(classKey)) {
        const { data: existingClasses } = await supabase
          .from('manual_classes')
          .select('id')
          .eq('ano_letivo', schoolYear)
          .eq('curso', 'GERAL')
          .eq('turma', className)
          .limit(1);

        if (!existingClasses?.length) {
          await createManualClass({
            anoLetivo: schoolYear,
            curso: 'GERAL',
            turma: className,
            supervisor: '',
            areaId: null,
            total: 0,
            ativos: 0,
            monitoramento: 0,
            risco: 0,
            mediaNota: '0.0'
          });
          results.classesCreated++;
        }
        classCache.add(classKey);
      }

      const studentInput = {
        processNumber,
        fullName,
        className,
        courseCode: 'GERAL',
        schoolYear,
        internshipStatus: 'active',
      };

      const registerResult = await registerStudentUnified(studentInput);
      if (registerResult?.authAlreadyExists) {
        results.warnings.push(`Linha ${rowIndex + 2}: conta de acesso já existente para ${processNumber}.`);
      }

      results.studentsRegistered++;

    } catch (err) {
      results.errors.push(`Linha ${rowIndex + 2}: ${err.message}`);
    }
  }

  return results;
}