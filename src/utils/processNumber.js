export function normalizeStudentProcessNumber(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 32);
}

/**
 * Valida o formato IPIZ de número de processo.
 *   Interno: X001 … X9999       (inicial da área + 1-4 dígitos)
 *   Externo: X001A … X9999A     (idem + sufixo 'A', aluno de outra instituição)
 * Exemplos válidos: I723, I735A, T45, C1001A
 */
export function validateIpizProcessNumber(value) {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!normalized) {
    return { valid: false, error: "Número de processo obrigatório." };
  }
  const match = normalized.match(/^([A-Z])(\d{1,4})(A?)$/);
  if (!match) {
    return {
      valid: false,
      error:
        "Formato inválido. Use a inicial da área seguida do número (ex: I723 para interno, I735A para externo de outra instituição).",
    };
  }
  const seq = Number(match[2]);
  if (seq < 1 || seq > 9999) {
    return { valid: false, error: "O número de sequência deve estar entre 1 e 9999." };
  }
  return { valid: true, error: null };
}

/**
 * Constrói um número de processo no padrão IPIZ.
 * @param {string} areaInitial - Inicial da área de formação (ex: "I" para Informática)
 * @param {number} sequence    - Número de sequência entre 1 e 9999
 * @param {boolean} isExternal - Se verdadeiro, adiciona sufixo 'A' (aluno externo)
 */
export function buildIpizProcessNumber(areaInitial, sequence, isExternal = false) {
  const initial = String(areaInitial ?? "").trim().toUpperCase().charAt(0);
  if (!initial || !/[A-Z]/.test(initial)) return "";
  const seq = Math.max(1, Math.min(9999, Number(sequence) || 1));
  return `${initial}${seq}${isExternal ? "A" : ""}`;
}
