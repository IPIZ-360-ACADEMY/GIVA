import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { getCurrentSession, getRequiredScope } from "./authService.js";

const DOCUMENTS_TABLE = "documents";
const DOCUMENTS_BUCKET = "documents";
const ALLOWED_TYPES = new Set(["PDF", "DOCX", "XLSX", "PPTX", "CSV"]);
const ALLOWED_STATUS = new Set(["review", "published", "pending", "archived"]);
const ALLOWED_CONTEXT_TYPES = new Set(["general", "class", "company"]);
const FALLBACK_AREA_ID = "11111111-1111-1111-1111-111111111111";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? "").trim());
}

function normalizeAreaId(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  return isUuid(normalized) ? normalized : null;
}

function resolveAreaIdFromSession(session) {
  const appAreaId = normalizeAreaId(session?.user?.app_metadata?.area_id);
  if (appAreaId) {
    return appAreaId;
  }

  const userAreaId = normalizeAreaId(session?.user?.user_metadata?.area_id);
  if (userAreaId) {
    return userAreaId;
  }

  const configuredFallback = normalizeAreaId(import.meta.env.VITE_DEFAULT_AREA_ID);
  if (configuredFallback) {
    return configuredFallback;
  }

  return FALLBACK_AREA_ID;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeUrl(value) {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }

  if (raw.startsWith("https://") || raw.startsWith("http://")) {
    return raw;
  }

  return null;
}

function sanitizeStoragePath(value) {
  const raw = String(value ?? "").trim().replace(/\\/g, "/");
  if (!raw) return "";
  if (raw.startsWith("/") || raw.includes("..") || raw.includes("://")) return "";
  return raw;
}

function sanitizeFileName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function sanitizeFolderSegment(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function sanitizeFolderPath(value) {
  const segments = String(value ?? "")
    .split(/[\\/]+/)
    .map((segment) => sanitizeFolderSegment(segment))
    .filter(Boolean)
    .slice(0, 8);

  return segments.join("/");
}

function splitFolderPath(path) {
  return sanitizeFolderPath(path).split("/").filter(Boolean);
}

function buildLegacyPath(folderName, subfolderName) {
  return sanitizeFolderPath([folderName, subfolderName].filter(Boolean).join("/"));
}

function normalizeContextType(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ALLOWED_CONTEXT_TYPES.has(normalized) ? normalized : "general";
}

function normalizeUuidOrNull(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function buildStorageFolder(scope, contextType, classGroupId, partnerId) {
  const areaPrefix = scope.area_id ?? "global";

  if (contextType === "class" && classGroupId) {
    return `${areaPrefix}/classes/${classGroupId}`;
  }

  if (contextType === "company" && partnerId) {
    return `${areaPrefix}/companies/${partnerId}`;
  }

  return `${areaPrefix}/general`;
}

function buildStorageFolderWithHierarchy(basePath, folderPath, folderName, subfolderName) {
  const cleanPath = sanitizeFolderPath(folderPath);
  if (cleanPath) {
    return `${basePath}/${cleanPath}`;
  }

  const fallbackPath = buildLegacyPath(folderName, subfolderName);
  return fallbackPath ? `${basePath}/${fallbackPath}` : basePath;
}

function normalizePayload(input) {
  const type = normalizeText(input?.tipo || "PDF").toUpperCase();
  const contextType = normalizeContextType(input?.contextType);
  const classGroupId = normalizeUuidOrNull(input?.classGroupId);
  const partnerId = normalizeUuidOrNull(input?.partnerId);
  const requestedFolderPath = sanitizeFolderPath(input?.folderPath);
  const fallbackPath = buildLegacyPath(input?.folderName, input?.subfolderName);
  const effectiveFolderPath = requestedFolderPath || fallbackPath;
  const pathSegments = splitFolderPath(effectiveFolderPath);
  const folderName = pathSegments[0] ?? "";
  const subfolderName = pathSegments[1] ?? "";

  return {
    titulo: normalizeText(input?.titulo),
    tipo: ALLOWED_TYPES.has(type) ? type : "PDF",
    versao: normalizeText(input?.versao) || "v1.0",
    categoria: normalizeText(input?.categoria) || "geral",
    descricao: normalizeText(input?.descricao),
    arquivo_url: normalizeUrl(input?.arquivoUrl),
    arquivo_path: normalizeText(input?.arquivoPath) || null,
    context_type: contextType,
    class_group_id: contextType === "class" ? classGroupId : null,
    partner_id: contextType === "company" ? partnerId : null,
    is_pinned: Boolean(input?.isPinned),
    folder_path: effectiveFolderPath || null,
    folder_name: folderName || null,
    subfolder_name: subfolderName || null,
  };
}

function normalizeRow(row) {
  const normalizedFolderPath = sanitizeFolderPath(row.folder_path ?? "") || buildLegacyPath(row.folder_name, row.subfolder_name);
  const pathSegments = splitFolderPath(normalizedFolderPath);

  return {
    id: row.id,
    titulo: row.titulo,
    tipo: row.tipo,
    versao: row.versao,
    categoria: row.categoria ?? "geral",
    descricao: row.descricao ?? "",
    arquivoUrl: row.arquivo_url ?? null,
    arquivoPath: row.arquivo_path ?? null,
    estado: row.estado ?? "review",
    contextType: row.context_type ?? "general",
    classGroupId: row.class_group_id ?? null,
    partnerId: row.partner_id ?? null,
    isPinned: Boolean(row.is_pinned),
    folderPath: normalizedFolderPath,
    folderName: row.folder_name ?? pathSegments[0] ?? "",
    subfolderName: row.subfolder_name ?? pathSegments[1] ?? "",
    archivedAt: row.archived_at ?? null,
    areaId: row.area_id ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

async function getScopedFields() {
  try {
    const { session, profile } = await getRequiredScope();
    return {
      area_id: normalizeAreaId(profile.areaId) ?? resolveAreaIdFromSession(session),
      created_by: session?.user?.id ?? null,
    };
  } catch {
    // Fallback: sessão válida mas metadata incompleta/intermitente.
    const session = await getCurrentSession();
    const areaId = resolveAreaIdFromSession(session);

    if (!areaId) {
      throw new Error("Missing area_id in user metadata.");
    }

    return {
      area_id: areaId,
      created_by: session?.user?.id ?? null,
    };
  }
}

export function canUseDocumentsApi() {
  return isSupabaseConfigured && Boolean(supabase);
}

export async function downloadDocumentBlob(arquivoPath) {
  if (!canUseDocumentsApi()) {
    throw new Error("Supabase is not configured");
  }

  const safePath = sanitizeStoragePath(arquivoPath);
  if (!safePath) {
    throw new Error("Invalid document path");
  }

  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).download(safePath);
  if (error) {
    throw error;
  }

  return data;
}

export async function listDocuments() {
  if (!canUseDocumentsApi()) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabase
    .from(DOCUMENTS_TABLE)
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(normalizeRow);
}

export async function uploadDocumentFile(file, contextInput = {}) {
  if (!canUseDocumentsApi()) {
    throw new Error("Supabase is not configured");
  }

  if (!file) {
    throw new Error("File is required");
  }

  const scope = await getScopedFields();
  const contextType = normalizeContextType(contextInput?.contextType);
  const classGroupId = normalizeUuidOrNull(contextInput?.classGroupId);
  const partnerId = normalizeUuidOrNull(contextInput?.partnerId);
  const folderPath = sanitizeFolderPath(contextInput?.folderPath);
  const folderName = normalizeText(contextInput?.folderName);
  const subfolderName = normalizeText(contextInput?.subfolderName);
  const cleanName = sanitizeFileName(file.name || "documento");
  const baseFolderPrefix = buildStorageFolder(scope, contextType, classGroupId, partnerId);
  const folderPrefix = buildStorageFolderWithHierarchy(baseFolderPrefix, folderPath, folderName, subfolderName);
  const storagePath = `${folderPrefix}/${Date.now()}-${cleanName}`;

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(storagePath);

  return {
    arquivoPath: storagePath,
    arquivoUrl: data?.publicUrl ?? null,
  };
}

export async function createDocument(documentInput) {
  if (!canUseDocumentsApi()) {
    throw new Error("Supabase is not configured");
  }

  const scope = await getScopedFields();
  const payload = {
    ...normalizePayload(documentInput),
    ...scope,
    estado: "review",
    updated_at: new Date().toISOString(),
    updated_by: scope.created_by,
  };

  const { data, error } = await supabase.from(DOCUMENTS_TABLE).insert(payload).select("*").single();

  if (error) {
    throw error;
  }

  return normalizeRow(data);
}

export async function updateDocument(id, documentInput) {
  if (!canUseDocumentsApi()) {
    throw new Error("Supabase is not configured");
  }

  const scope = await getScopedFields();
  const payload = {
    ...normalizePayload(documentInput),
    area_id: scope.area_id,
    updated_at: new Date().toISOString(),
    updated_by: scope.created_by,
  };

  const { data, error } = await supabase.from(DOCUMENTS_TABLE).update(payload).eq("id", id).select("*").single();

  if (error) {
    throw error;
  }

  return normalizeRow(data);
}

export async function updateDocumentStatus(id, status) {
  if (!canUseDocumentsApi()) {
    throw new Error("Supabase is not configured");
  }

  const normalizedStatus = normalizeText(status).toLowerCase();
  if (!ALLOWED_STATUS.has(normalizedStatus)) {
    throw new Error("Invalid document status");
  }

  const scope = await getScopedFields();
  const archivedAt = normalizedStatus === "archived" ? new Date().toISOString() : null;
  const payload = {
    estado: normalizedStatus,
    archived_at: archivedAt,
    updated_at: new Date().toISOString(),
    updated_by: scope.created_by,
  };

  const { data, error } = await supabase.from(DOCUMENTS_TABLE).update(payload).eq("id", id).select("*").single();

  if (error) {
    throw error;
  }

  return normalizeRow(data);
}

export async function deleteDocument(id) {
  if (!canUseDocumentsApi()) {
    throw new Error("Supabase is not configured");
  }

  const { error } = await supabase.from(DOCUMENTS_TABLE).delete().eq("id", id);
  if (error) {
    throw error;
  }
}

/**
 * Upload em lote: recebe array de File + payload base comum.
 * Retorna array de { file, result, error } — nunca rejeita globalmente.
 */
export async function bulkUploadDocuments(files, basePayload = {}) {
  if (!canUseDocumentsApi()) {
    throw new Error("Supabase is not configured");
  }

  const results = [];

  for (const file of files) {
    try {
      const uploadData = await uploadDocumentFile(file, basePayload);
      const payload = {
        titulo: basePayload.titulo || sanitizeFileName(file.name),
        tipo: basePayload.tipo || "PDF",
        versao: basePayload.versao || "v1.0",
        categoria: basePayload.categoria || "geral",
        descricao: basePayload.descricao || "",
        contextType: basePayload.contextType || "general",
        classGroupId: basePayload.classGroupId || null,
        partnerId: basePayload.partnerId || null,
        isPinned: Boolean(basePayload.isPinned),
        folderPath: basePayload.folderPath || "",
        folderName: basePayload.folderName || "",
        subfolderName: basePayload.subfolderName || "",
        arquivoUrl: uploadData.arquivoUrl,
        arquivoPath: uploadData.arquivoPath,
      };
      const created = await createDocument(payload);
      results.push({ file, result: created, error: null });
    } catch (err) {
      results.push({ file, result: null, error: err });
    }
  }

  return results;
}
