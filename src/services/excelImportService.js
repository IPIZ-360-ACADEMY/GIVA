import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase.js';
import { registerStudentUnified } from './studentRegistryService.js';
import { createManualClass } from './classesService.js';
import { createTrainingArea, createCourse } from './trainingAreaService.js';

function normalizeString(value) {
  return String(value ?? '').trim();
}

function parseSchoolYear(value) {
  const raw = normalizeString(value);
  const match = raw.match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (!match) return null;
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return null;
  if (endYear !== startYear + 1) return null;
  return { startYear, endYear };
}

function currentSchoolYear() {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
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

  // Expected headers (case insensitive)
  const expectedHeaders = [
    'area_codigo', 'area_nome', 'curso_codigo', 'curso_nome', 'turma_nome',
    'processo', 'nome_completo', 'email', 'telefone', 'data_nascimento', 'bi', 'morada'
  ];

  const headerMap = {};
  for (const expected of expectedHeaders) {
    const index = headers.indexOf(expected);
    if (index === -1) {
      throw new Error(`Cabeçalho obrigatório não encontrado: ${expected}`);
    }
    headerMap[expected] = index;
  }

  const results = {
    areasCreated: 0,
    coursesCreated: 0,
    classesCreated: 0,
    studentsRegistered: 0,
    errors: [],
    warnings: []
  };

  const areaCache = new Map(); // code -> id
  const courseCache = new Map(); // areaId + code -> id
  const classCache = new Map(); // areaId + courseCode + className -> id

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!row || row.length === 0) continue;

    try {
      const areaCode = normalizeString(row[headerMap['area_codigo']]);
      const areaName = normalizeString(row[headerMap['area_nome']]);
      const courseCode = normalizeString(row[headerMap['curso_codigo']]);
      const courseName = normalizeString(row[headerMap['curso_nome']]);
      const className = normalizeString(row[headerMap['turma_nome']]);
      const processNumber = normalizeString(row[headerMap['processo']]);
      const fullName = normalizeString(row[headerMap['nome_completo']]);
      const email = normalizeString(row[headerMap['email']]);
      const phone = normalizeString(row[headerMap['telefone']]);
      const birthDate = row[headerMap['data_nascimento']];
      const bi = normalizeString(row[headerMap['bi']]);
      const address = normalizeString(row[headerMap['morada']]);

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
        dateOfBirth: birthDate ? new Date(birthDate).toISOString().split('T')[0] : null,
        trainingAreaId: areaId,
        courseId,
        address: address || null,
        bi: bi || null,
        className,
        courseCode,
        schoolYear: currentSchoolYear(),
        internshipStatus: 'active'
      };

      await registerStudentUnified(studentInput);
      results.studentsRegistered++;

    } catch (err) {
      results.errors.push(`Linha ${rowIndex + 2}: ${err.message}`);
    }
  }

  return results;
}