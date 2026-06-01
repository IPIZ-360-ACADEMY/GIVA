import { supabase } from '../lib/supabase.js';
import { registerStudentUnified } from './studentRegistryService.js';
import { createManualClass } from './classesService.js';
import { createTrainingArea, createCourse } from './trainingAreaService.js';
import { normalizeStudentProcessNumber } from '../utils/processNumber.js';

const MAX_IMPORT_ROWS = 5000;

function normalizeString(value) {
  return String(value ?? '').trim();
}

function isValidEmailFormat(value) {
  const email = String(value ?? '').trim();
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function currentSchoolYear() {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

function toIsoDate(value) {
  if (!value && value !== 0) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Serial date do Excel (base 1899-12-30)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const parsed = new Date(excelEpoch.getTime() + value * 86400000);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getUTCFullYear();
      const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      const day = String(parsed.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  const raw = normalizeString(value);
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const day = String(Number(slash[1])).padStart(2, '0');
    const month = String(Number(slash[2])).padStart(2, '0');
    const year = slash[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

function buildTemporaryPassword(processNumber, rowNumber) {
  const suffix = String(Math.abs((rowNumber * 7919) % 100000)).padStart(5, '0');
  const cleanProcess = String(processNumber ?? '').replace(/\s+/g, '').slice(-6);
  return `Giva!${cleanProcess}${suffix}`;
}

export async function importExcelData(file) {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (jsonData.length < 2) {
    throw new Error('O ficheiro Excel deve conter pelo menos uma linha de cabeçalho e uma linha de dados.');
  }

  const headers = jsonData[0].map(h => normalizeString(h).toLowerCase());
  const rows = jsonData.slice(1);

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`O ficheiro excede o limite máximo de ${MAX_IMPORT_ROWS} linhas de dados.`);
  }

  // Expected headers (case insensitive)
  const requiredHeaders = [
    'area_codigo', 'area_nome', 'curso_codigo', 'curso_nome', 'turma_nome',
    'processo', 'nome_completo', 'email', 'telefone', 'data_nascimento', 'bi', 'morada'
  ];
  const optionalHeaders = ['password'];

  const headerMap = {};
  for (const expected of requiredHeaders) {
    const index = headers.indexOf(expected);
    if (index === -1) {
      throw new Error(`Cabeçalho obrigatório não encontrado: ${expected}`);
    }
    headerMap[expected] = index;
  }

  for (const optional of optionalHeaders) {
    const index = headers.indexOf(optional);
    if (index !== -1) {
      headerMap[optional] = index;
    }
  }

  const results = {
    areasCreated: 0,
    coursesCreated: 0,
    classesCreated: 0,
    studentsRegistered: 0,
    studentsUpdated: 0,
    generatedCredentials: [],
    errors: [],
    warnings: []
  };

  const areaCache = new Map(); // code -> id
  const courseCache = new Map(); // areaId + code -> id
  const classCache = new Map(); // areaId + courseCode + className -> id
  const seenProcesses = new Set();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!row || row.length === 0) continue;

    try {
      const areaCode = normalizeString(row[headerMap['area_codigo']]);
      const areaName = normalizeString(row[headerMap['area_nome']]);
      const courseCode = normalizeString(row[headerMap['curso_codigo']]);
      const courseName = normalizeString(row[headerMap['curso_nome']]);
      const className = normalizeString(row[headerMap['turma_nome']]);
      const rawProcessNumber = normalizeString(row[headerMap['processo']]);
      const processNumber = normalizeStudentProcessNumber(rawProcessNumber);
      const fullName = normalizeString(row[headerMap['nome_completo']]);
      const email = normalizeString(row[headerMap['email']]);
      const phone = normalizeString(row[headerMap['telefone']]);
      const birthDate = row[headerMap['data_nascimento']];
      const bi = normalizeString(row[headerMap['bi']]);
      const address = normalizeString(row[headerMap['morada']]);
      const providedPassword = headerMap.password !== undefined
        ? normalizeString(row[headerMap.password])
        : '';

      if (!areaCode || !areaName) {
        results.errors.push(`Linha ${rowIndex + 2}: Código e nome da área são obrigatórios.`);
        continue;
      }

      if (!courseCode || !courseName) {
        results.errors.push(`Linha ${rowIndex + 2}: Código e nome do curso são obrigatórios.`);
        continue;
      }

      if (!className) {
        results.errors.push(`Linha ${rowIndex + 2}: Nome da turma é obrigatório.`);
        continue;
      }

      if (!processNumber || !fullName) {
        results.errors.push(`Linha ${rowIndex + 2}: Número de processo e nome completo são obrigatórios.`);
        continue;
      }

      if (!isValidEmailFormat(email)) {
        results.errors.push(`Linha ${rowIndex + 2}: Email inválido (${email}).`);
        continue;
      }

      if (providedPassword && providedPassword.length < 8) {
        results.errors.push(`Linha ${rowIndex + 2}: A password fornecida deve ter pelo menos 8 caracteres.`);
        continue;
      }

      const processKey = processNumber.toUpperCase();
      if (seenProcesses.has(processKey)) {
        results.warnings.push(`Linha ${rowIndex + 2}: Número de processo duplicado no ficheiro (${processNumber}). Linha ignorada.`);
        continue;
      }
      seenProcesses.add(processKey);

      // Ensure area exists
      let areaId = areaCache.get(areaCode);
      if (!areaId) {
        const { data: existingAreas } = await supabase
          .from('training_area')
          .select('id')
          .eq('code', areaCode)
          .limit(1);

        if (existingAreas?.length) {
          areaId = existingAreas[0].id;
        } else {
          const newArea = await createTrainingArea({ code: areaCode, name: areaName });
          if (newArea) {
            areaId = newArea.id;
            results.areasCreated++;
          } else {
            results.errors.push(`Linha ${rowIndex + 2}: Falha ao criar área ${areaCode}.`);
            continue;
          }
        }
        areaCache.set(areaCode, areaId);
      }

      // Ensure course exists
      const courseKey = `${areaId}-${courseCode}`;
      let courseId = courseCache.get(courseKey);
      if (!courseId) {
        const { data: existingCourses } = await supabase
          .from('courses')
          .select('id')
          .eq('training_area_id', areaId)
          .eq('code', courseCode)
          .limit(1);

        if (existingCourses?.length) {
          courseId = existingCourses[0].id;
        } else {
          const newCourse = await createCourse(areaId, { code: courseCode, name: courseName });
          if (newCourse) {
            courseId = newCourse.id;
            results.coursesCreated++;
          } else {
            results.errors.push(`Linha ${rowIndex + 2}: Falha ao criar curso ${courseCode}.`);
            continue;
          }
        }
        courseCache.set(courseKey, courseId);
      }

      // Ensure class exists
      const classKey = `${areaId}-${courseCode}-${className}`;
      let classExists = classCache.has(classKey);
      if (!classExists) {
        const { data: existingClasses } = await supabase
          .from('manual_classes')
          .select('id')
          .eq('area_id', areaId)
          .eq('curso', courseCode)
          .eq('turma', className)
          .limit(1);

        if (!existingClasses?.length) {
          const newClass = await createManualClass({
            anoLetivo: currentSchoolYear(),
            curso: courseCode,
            turma: className,
            supervisor: '',
            areaId,
            total: 0,
            ativos: 0,
            monitoramento: 0,
            risco: 0,
            mediaNota: '0.0'
          });
          if (newClass) {
            results.classesCreated++;
          } else {
            results.errors.push(`Linha ${rowIndex + 2}: Falha ao criar turma ${className}.`);
            continue;
          }
        }
        classCache.set(classKey, true);
      }

      // Register student
      const studentInput = {
        processNumber,
        fullName,
        email: email || null,
        phoneNumber: phone || null,
        dateOfBirth: toIsoDate(birthDate),
        trainingAreaId: areaId,
        courseId,
        address: address || null,
        bi: bi || null,
        className,
        courseCode,
        schoolYear: currentSchoolYear(),
        internshipStatus: 'active',
        loginPassword: providedPassword || buildTemporaryPassword(processNumber, rowIndex + 2),
        requirePasswordChange: !providedPassword,
      };

      const registration = await registerStudentUnified(studentInput);
      results.studentsRegistered++;

      if (registration?.studentAlreadyExists) {
        results.studentsUpdated++;
      }

      if (!providedPassword && registration?.authCreated) {
        results.generatedCredentials.push({
          row: rowIndex + 2,
          processNumber,
          fullName,
          password: studentInput.loginPassword,
          loginEmail: registration?.loginEmail ?? null,
        });
      }

      if (!providedPassword && registration?.authAlreadyExists) {
        results.warnings.push(`Linha ${rowIndex + 2}: conta de acesso já existia para o processo ${processNumber}; password temporária não foi aplicada.`);
      }

    } catch (err) {
      results.errors.push(`Linha ${rowIndex + 2}: ${err.message}`);
    }
  }

  return results;
}