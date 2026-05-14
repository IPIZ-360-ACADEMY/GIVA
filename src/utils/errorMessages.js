const DEFAULT_USER_ERROR = "Não foi possível concluir esta ação agora. Tente novamente em instantes.";

function normalizeRawMessage(input) {
  if (!input) return "";

  if (input instanceof Error) {
    return String(input.message ?? "").trim();
  }

  if (typeof input === "object") {
    return String(input.message ?? input.error_description ?? input.error ?? "").trim();
  }

  return String(input).trim();
}

export function toUserErrorMessage(input, fallback = DEFAULT_USER_ERROR) {
  const raw = normalizeRawMessage(input);
  if (!raw) return fallback;

  const lower = raw.toLowerCase();

  if (
    lower.includes("failed to fetch")
    || lower.includes("networkerror")
    || lower.includes("network request failed")
    || lower.includes("timeout")
    || lower.includes("erro de ligação")
  ) {
    return "Estamos com instabilidade de ligação. Verifique a internet e tente novamente.";
  }

  if (
    lower.includes("chunk")
    || lower.includes("dynamically imported module")
    || lower.includes("importing a module script failed")
    || lower.includes("loading css chunk")
    || lower.includes("loading chunk")
  ) {
    return "O sistema foi atualizado durante a sua sessão. Recarregue a página para continuar.";
  }

  if (lower.includes("jwt") || lower.includes("token") || lower.includes("session")) {
    return "A sua sessão expirou ou ficou inválida. Entre novamente para continuar.";
  }

  if (lower.includes("permission") || lower.includes("not allowed") || lower.includes("insufficient") || lower.includes("forbidden")) {
    return "Você não tem permissão para executar esta ação.";
  }

  if (lower.includes("already registered") || lower.includes("already exists") || lower.includes("duplicate")) {
    return "Este registo já existe no sistema.";
  }

  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "Credenciais inválidas. Verifique os dados e tente novamente.";
  }

  if (lower.includes("email") && lower.includes("invalid")) {
    return "O email informado não é válido. Revise o endereço e tente novamente.";
  }

  // Não expor detalhes técnicos em excesso para o utilizador final.
  if (raw.length > 180) {
    return fallback;
  }

  return raw;
}
