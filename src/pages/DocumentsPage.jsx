import { useOutletContext } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchesSearch } from "../utils/search.js";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import DocumentSubmitModal from "../components/DocumentSubmitModal.jsx";
import { useAccessProfile, useAuth } from "../contexts/AuthContext.jsx";
import { listManualClasses } from "../services/classesService.js";
import { listPartners } from "../services/partnersService.js";
import { listCoursesByArea, listTrainingAreas } from "../services/trainingAreaService.js";
import { filterByCoordinatorScope, hasCoordinatorScope } from "../utils/coordinationScope.js";
import {
  bulkUploadDocuments,
  canUseDocumentsApi,
  createDocument,
  deleteDocument,
  downloadDocumentBlob,
  listDocuments,
  updateDocument,
  updateDocumentStatus,
  uploadDocumentFile,
} from "../services/documentsService.js";

const LOCAL_FOLDERS_STORAGE_KEY = "giva.documents.virtual-folders";

function stateLabel(state, copy) {
  if (state === "published") {
    return copy.published;
  }
  if (state === "pending") {
    return copy.pending;
  }
  if (state === "archived") {
    return copy.archived;
  }
  return copy.review;
}

function contextLabel(doc) {
  if (doc.contextType === "class") {
    return doc.classGroupId ? `Turma: ${doc.classGroupId}` : "Turma";
  }
  if (doc.contextType === "company") {
    return doc.partnerId ? `Empresa: ${doc.partnerId}` : "Empresa";
  }
  return "Geral";
}

function toUpdatePayload(doc) {
  return {
    titulo: doc.titulo ?? "",
    tipo: doc.tipo ?? "PDF",
    versao: doc.versao ?? "v1.0",
    categoria: doc.categoria ?? "geral",
    descricao: doc.descricao ?? "",
    arquivoUrl: doc.arquivoUrl ?? "",
    arquivoPath: doc.arquivoPath ?? "",
    contextType: doc.contextType ?? "general",
    classGroupId: doc.classGroupId ?? "",
    partnerId: doc.partnerId ?? "",
    isPinned: Boolean(doc.isPinned),
    folderPath: getDocFolderPath(doc),
    folderName: doc.folderName ?? "",
    subfolderName: doc.subfolderName ?? "",
  };
}

function titleLabel(key, t) {
  if (key === "docManual") {
    return t("documents.docManual");
  }
  if (key === "docChecklist") {
    return t("documents.docChecklist");
  }
  if (key === "docReport") {
    return t("documents.docReport");
  }
  return key;
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("pt-PT");
}

function extractDocExtension(doc) {
  const fileLikeValues = [doc?.arquivoPath, doc?.arquivoUrl, doc?.titulo, doc?.tipo]
    .filter(Boolean)
    .map((value) => String(value));

  for (const rawValue of fileLikeValues) {
    const cleanValue = rawValue.split("?")[0].split("#")[0];
    const match = cleanValue.match(/\.([a-z0-9]{2,8})$/i);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }

    // Alguns registos antigos guardam apenas o tipo sem ponto.
    if (/^[a-z0-9]{2,8}$/i.test(cleanValue)) {
      return cleanValue.toLowerCase();
    }
  }

  return "file";
}

function docVisualByExtension(extension) {
  const ext = (extension ?? "").toLowerCase();

  if (ext === "pdf") return { icon: "picture_as_pdf", cssClass: "pdf", label: "PDF" };
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return { icon: "description", cssClass: "word", label: ext.toUpperCase() };
  if (["xls", "xlsx", "ods"].includes(ext)) return { icon: "table_chart", cssClass: "sheet", label: ext.toUpperCase() };
  if (["ppt", "pptx", "odp"].includes(ext)) return { icon: "slideshow", cssClass: "slides", label: ext.toUpperCase() };
  if (["csv", "tsv"].includes(ext)) return { icon: "grid_on", cssClass: "csv", label: ext.toUpperCase() };
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return { icon: "image", cssClass: "image", label: ext.toUpperCase() };
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return { icon: "folder_zip", cssClass: "archive", label: ext.toUpperCase() };
  if (["txt", "md", "log"].includes(ext)) return { icon: "article", cssClass: "text", label: ext.toUpperCase() };

  return { icon: "insert_drive_file", cssClass: "generic", label: ext ? ext.toUpperCase() : "FILE" };
}

function normalizeFolderPath(value) {
  return String(value ?? "")
    .split(/[\\/]+/)
    .map((segment) => String(segment ?? "").trim())
    .filter(Boolean)
    .join("/");
}

function splitFolderPath(path) {
  return normalizeFolderPath(path).split("/").filter(Boolean);
}

function buildLegacyPath(folderName, subfolderName) {
  return normalizeFolderPath([folderName, subfolderName].filter(Boolean).join("/"));
}

function getDocFolderPath(doc) {
  return normalizeFolderPath(doc.folderPath) || buildLegacyPath(doc.folderName, doc.subfolderName);
}

function normalizeFolderSegment(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getAreaLabel(areaRow, areaId) {
  if (!areaRow) {
    return areaId ? `area-${String(areaId).slice(0, 8)}` : "area-sem-definicao";
  }
  const raw = areaRow.code || areaRow.name || areaId;
  const segment = normalizeFolderSegment(raw);
  return segment ? `area-${segment}` : `area-${String(areaId ?? "sem-definicao").slice(0, 8)}`;
}

function getCourseLabel(courseLike, fallbackCode) {
  const raw = courseLike?.code || courseLike?.name || fallbackCode;
  const segment = normalizeFolderSegment(raw);
  if (!segment) return "curso-sem-definicao";
  return `curso-${segment}`;
}

function getClassLabel(classLike) {
  const raw = classLike?.turma || classLike?.className || classLike?.id;
  const segment = normalizeFolderSegment(raw);
  if (!segment) return "turma-sem-definicao";
  return `turma-${segment}`;
}

function buildClassHierarchyPath(classRow, areaById, coursesByArea, fallbackAreaId) {
  const resolvedAreaId = classRow?.areaId || fallbackAreaId || null;
  const areaLabel = getAreaLabel(areaById.get(String(resolvedAreaId ?? "")), resolvedAreaId);
  const areaCourses = coursesByArea.get(String(resolvedAreaId ?? "")) ?? [];
  const mappedCourse = areaCourses.find((course) => String(course.code ?? "").toUpperCase() === String(classRow?.curso ?? "").toUpperCase());
  const courseLabel = getCourseLabel(mappedCourse, classRow?.curso);
  const classLabel = getClassLabel(classRow);

  return normalizeFolderPath(`${areaLabel}/${courseLabel}/${classLabel}`);
}

function buildGeneralAreaPath(areaById, areaId) {
  return normalizeFolderPath(`${getAreaLabel(areaById.get(String(areaId ?? "")), areaId)}/geral`);
}

function getImmediateChildrenFolders(docs, currentPath) {
  const current = normalizeFolderPath(currentPath);
  const baseSegments = splitFolderPath(current);
  const children = new Set();

  for (const doc of docs) {
    const docPath = getDocFolderPath(doc);
    if (!docPath) {
      continue;
    }

    const segments = splitFolderPath(docPath);
    if (segments.length <= baseSegments.length) {
      continue;
    }

    const matchesPrefix = baseSegments.every((segment, idx) => segment === segments[idx]);
    if (!matchesPrefix) {
      continue;
    }

    const childPath = segments.slice(0, baseSegments.length + 1).join("/");
    children.add(childPath);
  }

  return Array.from(children).sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" }));
}

function getImmediateChildrenFromPaths(paths, currentPath) {
  const current = normalizeFolderPath(currentPath);
  const baseSegments = splitFolderPath(current);
  const children = new Set();

  for (const rawPath of paths) {
    const fullPath = normalizeFolderPath(rawPath);
    if (!fullPath) {
      continue;
    }

    const segments = splitFolderPath(fullPath);
    if (segments.length <= baseSegments.length) {
      continue;
    }

    const matchesPrefix = baseSegments.every((segment, idx) => segment === segments[idx]);
    if (!matchesPrefix) {
      continue;
    }

    children.add(segments.slice(0, baseSegments.length + 1).join("/"));
  }

  return Array.from(children).sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" }));
}

function isInsideFolder(docPath, folderPath) {
  const normalizedDoc = normalizeFolderPath(docPath);
  const normalizedFolder = normalizeFolderPath(folderPath);

  if (!normalizedFolder) {
    return true;
  }

  return normalizedDoc === normalizedFolder || normalizedDoc.startsWith(`${normalizedFolder}/`);
}

function replaceFolderPrefix(path, sourcePrefix, targetPrefix) {
  const normalizedPath = normalizeFolderPath(path);
  const normalizedSource = normalizeFolderPath(sourcePrefix);
  const normalizedTarget = normalizeFolderPath(targetPrefix);

  if (!normalizedSource) {
    return normalizedPath;
  }

  if (normalizedPath === normalizedSource) {
    return normalizedTarget;
  }

  if (normalizedPath.startsWith(`${normalizedSource}/`)) {
    const suffix = normalizedPath.slice(normalizedSource.length + 1);
    return normalizeFolderPath(normalizedTarget ? `${normalizedTarget}/${suffix}` : suffix);
  }

  return normalizedPath;
}

function toSafeBlobUrl(value) {
  const raw = String(value ?? "").trim();
  return raw.startsWith("blob:") ? raw : "";
}

export default function DocumentsPage() {
  const { query, showToast, t } = useOutletContext();
  const { isAdmin, isCoordinatorUser } = useAccessProfile();
  const { authProfile } = useAuth();
  const copy = {
    review: t("common.inReview"),
    published: t("common.approved"),
    pending: t("common.pending"),
    archived: "Arquivado"
  };
  const [docs, setDocs] = useState([]);
  const [form, setForm] = useState({
    titulo: "",
    tipo: "PDF",
    versao: "v1.0",
    categoria: "geral",
    descricao: "",
    arquivoUrl: "",
    arquivoPath: "",
    contextType: "general",
    classGroupId: "",
    partnerId: "",
    isPinned: false,
    folderPath: "",
    folderName: "",
    subfolderName: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [apiMode, setApiMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [sortBy, setSortBy] = useState("az"); // "az" | "date"
  const [quickFilter, setQuickFilter] = useState("all"); // all|general|class|company|pinned|archived
  const [currentFolderPath, setCurrentFolderPath] = useState("");
  const [virtualFolders, setVirtualFolders] = useState([]);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [draggingDocId, setDraggingDocId] = useState(null);
  const [selectedDocIds, setSelectedDocIds] = useState(new Set());
  const [bulkMoveTargetPath, setBulkMoveTargetPath] = useState("");
  const [folderContextMenu, setFolderContextMenu] = useState({
    open: false,
    x: 0,
    y: 0,
    folderPath: "",
  });
  const [classOptions, setClassOptions] = useState([]);
  const [partnerOptions, setPartnerOptions] = useState([]);
  const [areaOptions, setAreaOptions] = useState([]);
  const [coursesByArea, setCoursesByArea] = useState(new Map());
  // Admin: upload em lote
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkProgress, setBulkProgress] = useState([]); // [{name, status: 'pending'|'ok'|'error', msg}]
  const [bulkUploading, setBulkUploading] = useState(false);
  const bulkInputRef = useRef(null);
  const previewFrameRef = useRef(null);
  const previewBlobUrlRef = useRef("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const effectiveFallbackAreaId = useMemo(() => authProfile?.areaId ?? null, [authProfile?.areaId]);
  const areaById = useMemo(() => new Map(areaOptions.map((area) => [String(area.id), area])), [areaOptions]);
  const classById = useMemo(() => new Map(classOptions.map((item) => [String(item.id), item])), [classOptions]);

  const scopedClassOptions = useMemo(() => {
    if (!isCoordinatorUser) return classOptions;
    return filterByCoordinatorScope(classOptions, authProfile, {
      areaKeys: ["areaId", "area_id"],
      courseCodeKeys: ["curso", "course", "course_code"],
    });
  }, [classOptions, isCoordinatorUser, authProfile]);

  const scopedClassIds = useMemo(() => new Set(scopedClassOptions.map((row) => String(row.id))), [scopedClassOptions]);

  const autoHierarchyFolders = useMemo(() => {
    const folders = new Set();

    for (const classRow of scopedClassOptions) {
      const fullPath = buildClassHierarchyPath(classRow, areaById, coursesByArea, effectiveFallbackAreaId);
      const segments = splitFolderPath(fullPath);
      for (let i = 1; i <= segments.length; i += 1) {
        folders.add(segments.slice(0, i).join("/"));
      }
    }

    if (!folders.size && effectiveFallbackAreaId) {
      folders.add(buildGeneralAreaPath(areaById, effectiveFallbackAreaId));
    }

    return Array.from(folders).sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" }));
  }, [scopedClassOptions, areaById, coursesByArea, effectiveFallbackAreaId]);

  function resetFormState() {
    setForm({
      titulo: "",
      tipo: "PDF",
      versao: "v1.0",
      categoria: "geral",
      descricao: "",
      arquivoUrl: "",
      arquivoPath: "",
      contextType: "general",
      classGroupId: "",
      partnerId: "",
      isPinned: false,
      folderPath: "",
      folderName: "",
      subfolderName: "",
    });
    setEditingId(null);
    setSelectedFile(null);
  }

  const handleBulkFileChange = useCallback((e) => {
    const files = Array.from(e.target.files ?? []);
    setBulkFiles(files);
    setBulkProgress(files.map((f) => ({ name: f.name, status: "pending", msg: "" })));
  }, []);

  const handleBulkUpload = useCallback(async () => {
    if (!bulkFiles.length) {
      showToast("Selecione pelo menos um ficheiro.", "error");
      return;
    }
    if (!apiMode) {
      showToast("Sem ligação ao Supabase.", "error");
      return;
    }
    setBulkUploading(true);

    const results = await bulkUploadDocuments(bulkFiles, {
      tipo: "PDF",
      versao: "v1.0",
      categoria: "geral",
      folderPath: form.folderPath,
      contextType: form.contextType,
      classGroupId: form.classGroupId,
      partnerId: form.partnerId,
      folderName: form.folderName,
      subfolderName: form.subfolderName,
    });

    const nextProgress = results.map(({ file, result, error }) => ({
      name: file.name,
      status: error ? "error" : "ok",
      msg: error ? (error.message || "Erro desconhecido") : "Guardado com sucesso",
    }));
    setBulkProgress(nextProgress);

    const saved = results.filter((r) => r.result).map((r) => r.result);
    if (saved.length) {
      setDocs((curr) => [...saved, ...curr]);
      showToast(`${saved.length} documento(s) guardado(s) no sistema.`);
    }
    const failed = results.filter((r) => r.error).length;
    if (failed) {
      showToast(`${failed} ficheiro(s) falharam. Verifique os detalhes abaixo.`, "error");
    }

    setBulkFiles([]);
    setBulkUploading(false);
    if (bulkInputRef.current) bulkInputRef.current.value = "";
  }, [bulkFiles, apiMode, showToast, form.folderPath, form.contextType, form.classGroupId, form.partnerId, form.folderName, form.subfolderName]);

  useEffect(() => {
    let active = true;

    async function loadSecurePreview() {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = "";
      }

      if (previewFrameRef.current) {
        previewFrameRef.current.removeAttribute("src");
      }

      if (!previewDoc?.arquivoPath) {
        setPreviewLoading(false);
        setPreviewError("");
        return;
      }

      setPreviewLoading(true);
      setPreviewError("");

      try {
        const blob = await downloadDocumentBlob(previewDoc.arquivoPath);
        if (!active || !blob) {
          return;
        }

        const objectUrl = URL.createObjectURL(blob);
        const safeBlobUrl = toSafeBlobUrl(objectUrl);
        if (!safeBlobUrl) {
          throw new Error("Invalid blob URL");
        }

        previewBlobUrlRef.current = safeBlobUrl;
        if (previewFrameRef.current) {
          previewFrameRef.current.src = safeBlobUrl;
        }
      } catch {
        if (active) {
          setPreviewError("Não foi possível carregar a pré-visualização segura deste documento.");
        }
      } finally {
        if (active) {
          setPreviewLoading(false);
        }
      }
    }

    loadSecurePreview();

    return () => {
      active = false;
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = "";
      }
      if (previewFrameRef.current) {
        previewFrameRef.current.removeAttribute("src");
      }
    };
  }, [previewDoc]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_FOLDERS_STORAGE_KEY);
      const parsed = JSON.parse(raw ?? "[]");
      if (Array.isArray(parsed)) {
        setVirtualFolders(parsed.map((item) => normalizeFolderPath(item)).filter(Boolean));
      }
    } catch {
      setVirtualFolders([]);
    }
  }, []);

  useEffect(() => {
    if (form.contextType !== "class") {
      return;
    }

    const selectedClass = classById.get(String(form.classGroupId ?? ""));
    if (!selectedClass) {
      return;
    }

    const autoPath = buildClassHierarchyPath(selectedClass, areaById, coursesByArea, effectiveFallbackAreaId);
    if (!autoPath || autoPath === form.folderPath) {
      return;
    }

    setForm((current) => ({
      ...current,
      folderPath: autoPath,
      folderName: splitFolderPath(autoPath)[0] ?? "",
      subfolderName: splitFolderPath(autoPath)[1] ?? "",
    }));
  }, [form.contextType, form.classGroupId, form.folderPath, classById, areaById, coursesByArea, effectiveFallbackAreaId]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_FOLDERS_STORAGE_KEY, JSON.stringify(virtualFolders));
    } catch {
      // localStorage indisponível
    }
  }, [virtualFolders]);

  useEffect(() => {
    let active = true;

    async function loadDocuments() {
      if (!canUseDocumentsApi()) {
        setApiMode(false);
        setLoading(false);
        return;
      }

      try {
        const rows = await listDocuments();
        if (!active) {
          return;
        }
        setDocs(rows);
        setApiMode(true);
      } catch {
        if (!active) {
          return;
        }
        setApiMode(false);
        showToast("Falha ao carregar documentos na base remota.", "error");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDocuments();

    return () => {
      active = false;
    };
  }, [showToast]);

  useEffect(() => {
    let active = true;

    async function loadContextOptions() {
      try {
        const [classesRows, partnersRows, areasRows] = await Promise.all([
          listManualClasses().catch(() => []),
          canUseDocumentsApi() ? listPartners().catch(() => []) : Promise.resolve([]),
          listTrainingAreas().catch(() => []),
        ]);

        if (!active) {
          return;
        }

        setClassOptions(Array.isArray(classesRows) ? classesRows : []);
        setPartnerOptions(Array.isArray(partnersRows) ? partnersRows : []);

        const safeAreas = Array.isArray(areasRows) ? areasRows : [];
        setAreaOptions(safeAreas);

        const perAreaPairs = await Promise.all(
          safeAreas.map(async (area) => {
            const areaId = String(area.id ?? "");
            if (!areaId) return [areaId, []];
            const rows = await listCoursesByArea(areaId).catch(() => []);
            return [areaId, Array.isArray(rows) ? rows : []];
          })
        );

        if (!active) {
          return;
        }

        setCoursesByArea(new Map(perAreaPairs));
      } catch {
        if (!active) {
          return;
        }
        setClassOptions([]);
        setPartnerOptions([]);
        setAreaOptions([]);
        setCoursesByArea(new Map());
      }
    }

    loadContextOptions();

    return () => {
      active = false;
    };
  }, []);

  const scopedDocs = useMemo(() => {
    if (!isCoordinatorUser || !hasCoordinatorScope(authProfile)) {
      return docs;
    }

    return docs.filter((doc) => {
      if (doc.contextType === "class") {
        return scopedClassIds.has(String(doc.classGroupId ?? ""));
      }

      // Compatibilidade com registos antigos sem areaId: não ocultar por ausência de metadado.
      if (!doc.areaId) {
        return true;
      }

      return filterByCoordinatorScope([doc], authProfile, {
        areaKeys: ["areaId", "area_id"],
      }).length > 0;
    });
  }, [docs, isCoordinatorUser, authProfile, scopedClassIds]);

  const quickFilteredDocs = useMemo(() => {
    const isArchived = (doc) => String(doc.estado ?? "").toLowerCase() === "archived";

    if (quickFilter === "general") {
      return scopedDocs.filter((doc) => doc.contextType === "general" && !isArchived(doc));
    }
    if (quickFilter === "class") {
      return scopedDocs.filter((doc) => doc.contextType === "class" && !isArchived(doc));
    }
    if (quickFilter === "company") {
      return scopedDocs.filter((doc) => doc.contextType === "company" && !isArchived(doc));
    }
    if (quickFilter === "pinned") {
      return scopedDocs.filter((doc) => Boolean(doc.isPinned) && !isArchived(doc));
    }
    if (quickFilter === "archived") {
      return scopedDocs.filter((doc) => isArchived(doc));
    }
    return scopedDocs.filter((doc) => !isArchived(doc));
  }, [scopedDocs, quickFilter]);

  const explorerSourceDocs = useMemo(
    () => quickFilteredDocs.filter((doc) => matchesSearch(query, `${titleLabel(doc.titulo, t)} ${doc.tipo} ${doc.versao} ${doc.categoria} ${doc.descricao} ${stateLabel(doc.estado, copy)} ${getDocFolderPath(doc)}`)),
    [quickFilteredDocs, query]
  );

  const explorerFolderChildren = useMemo(
    () => {
      const allPaths = new Set(virtualFolders.map((path) => normalizeFolderPath(path)).filter(Boolean));
      for (const autoPath of autoHierarchyFolders) {
        allPaths.add(normalizeFolderPath(autoPath));
      }

      for (const doc of explorerSourceDocs) {
        const path = getDocFolderPath(doc);
        if (!path) {
          continue;
        }

        const segments = splitFolderPath(path);
        for (let i = 1; i <= segments.length; i += 1) {
          allPaths.add(segments.slice(0, i).join("/"));
        }
      }

      return getImmediateChildrenFromPaths(Array.from(allPaths), currentFolderPath);
    },
    [explorerSourceDocs, currentFolderPath, virtualFolders, autoHierarchyFolders]
  );

  const allKnownFolderPaths = useMemo(() => {
    const allPaths = new Set(virtualFolders.map((path) => normalizeFolderPath(path)).filter(Boolean));

    for (const autoPath of autoHierarchyFolders) {
      allPaths.add(normalizeFolderPath(autoPath));
    }

    for (const doc of scopedDocs) {
      const path = getDocFolderPath(doc);
      if (!path) {
        continue;
      }

      const segments = splitFolderPath(path);
      for (let i = 1; i <= segments.length; i += 1) {
        allPaths.add(segments.slice(0, i).join("/"));
      }
    }

    return Array.from(allPaths).sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" }));
  }, [scopedDocs, virtualFolders, autoHierarchyFolders]);

  const explorerVisibleDocs = useMemo(() => {
    const current = normalizeFolderPath(currentFolderPath);
    return explorerSourceDocs.filter((doc) => getDocFolderPath(doc) === current);
  }, [explorerSourceDocs, currentFolderPath]);

  const breadcrumbs = useMemo(() => {
    const segments = splitFolderPath(currentFolderPath);
    const items = [{ label: "Raiz", path: "" }];
    let running = "";
    for (const segment of segments) {
      running = running ? `${running}/${segment}` : segment;
      items.push({ label: segment, path: running });
    }
    return items;
  }, [currentFolderPath]);

  const parentFolderPath = useMemo(() => {
    if (breadcrumbs.length <= 1) {
      return "";
    }
    return breadcrumbs[breadcrumbs.length - 2].path;
  }, [breadcrumbs]);

  useEffect(() => {
    const current = normalizeFolderPath(currentFolderPath);
    if (!current) {
      return;
    }

    const stillExists =
      explorerSourceDocs.some((doc) => isInsideFolder(getDocFolderPath(doc), current)) ||
      virtualFolders.some((path) => isInsideFolder(path, current));

    if (!stillExists) {
      setCurrentFolderPath("");
    }
  }, [explorerSourceDocs, currentFolderPath, virtualFolders]);

  useEffect(() => {
    setBulkMoveTargetPath(normalizeFolderPath(currentFolderPath));
  }, [currentFolderPath]);

  useEffect(() => {
    if (!folderContextMenu.open) {
      return;
    }

    const closeMenu = () => {
      setFolderContextMenu({ open: false, x: 0, y: 0, folderPath: "" });
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("contextmenu", closeMenu);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("contextmenu", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [folderContextMenu.open]);

  const filteredDocs = useMemo(
    () => explorerVisibleDocs,
    [explorerVisibleDocs]
  );

  const sortedDocs = useMemo(() => {
    const list = [...filteredDocs];

    // Regra global: fixados aparecem sempre antes.
    const withPinPriority = (a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));

    if (sortBy === "az") {
      list.sort((a, b) => {
        const pinDelta = withPinPriority(a, b);
        if (pinDelta !== 0) {
          return pinDelta;
        }
        return (a.titulo ?? "").localeCompare(b.titulo ?? "", "pt", { sensitivity: "base" });
      });
    } else {
      list.sort((a, b) => {
        const pinDelta = withPinPriority(a, b);
        if (pinDelta !== 0) {
          return pinDelta;
        }
        return new Date(b.updatedAt ?? b.createdAt ?? 0) - new Date(a.updatedAt ?? a.createdAt ?? 0);
      });
    }
    return list;
  }, [filteredDocs, sortBy]);

  const _UNUSED_columns = [
    { key: "titulo", label: t("documents.titleLabel"), render: (row) => titleLabel(row.titulo, t) },
    { key: "tipo", label: t("common.type") },
    { key: "versao", label: t("documents.version") },
    { key: "categoria", label: "Categoria" },
    { key: "estado", label: t("common.status"), render: (row) => stateLabel(row.estado, copy) },
    { key: "updatedAt", label: "Atualizado em", render: (row) => formatDate(row.updatedAt || row.createdAt) },
    {
      key: "acoes",
      label: t("common.action"),
      render: (row) => (
        <div className="form-actions">
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              setEditingId(row.id);
              setForm({
                titulo: row.titulo ?? "",
                tipo: row.tipo ?? "PDF",
                versao: row.versao ?? "v1.0",
                categoria: row.categoria ?? "geral",
                descricao: row.descricao ?? "",
                arquivoUrl: row.arquivoUrl ?? "",
                arquivoPath: row.arquivoPath ?? "",
                contextType: row.contextType ?? "general",
                classGroupId: row.classGroupId ?? "",
                partnerId: row.partnerId ?? "",
                isPinned: Boolean(row.isPinned),
                folderPath: getDocFolderPath(row),
                folderName: row.folderName ?? "",
                subfolderName: row.subfolderName ?? "",
              });
              setSelectedFile(null);
              setShowSubmitModal(true);
            }}
          >
            Editar
          </button>
          <button className="btn ghost" type="button" onClick={() => handleStatusChange(row.id, "published")}>
            Publicar
          </button>
          <button className="btn ghost" type="button" onClick={() => handleStatusChange(row.id, "archived")}>
            Arquivar
          </button>
          <button className="btn ghost" type="button" onClick={() => handleDelete(row.id, row.titulo)}>
            Remover
          </button>
          {row.arquivoUrl ? (
            <a className="btn ghost" href={row.arquivoUrl} target="_blank" rel="noreferrer">
              Abrir
            </a>
          ) : null}
        </div>
      ),
    }
  ]; // _UNUSED_columns — kept for reference, replaced by grid

  async function handleStatusChange(id, status) {
    if (!apiMode) {
      showToast("Operação indisponível sem ligação Supabase.", "error");
      return;
    }

    try {
      const updated = await updateDocumentStatus(id, status);
      setDocs((current) => current.map((item) => (item.id === id ? updated : item)));
      showToast("Estado do documento atualizado.");
    } catch {
      showToast("Não foi possível atualizar o estado do documento.", "error");
    }
  }

  async function handleTogglePinned(doc) {
    if (!apiMode) {
      showToast("Operação indisponível sem ligação Supabase.", "error");
      return;
    }

    try {
      const updated = await updateDocument(doc.id, {
        ...toUpdatePayload(doc),
        isPinned: !doc.isPinned,
      });
      setDocs((current) => current.map((item) => (item.id === doc.id ? updated : item)));
      showToast(updated.isPinned ? "Documento fixado com sucesso." : "Documento desafixado com sucesso.");
    } catch {
      showToast("Não foi possível atualizar a prioridade do documento.", "error");
    }
  }

  async function handleMoveDocumentToFolder(doc, targetFolderPath) {
    if (!apiMode) {
      showToast("Operação indisponível sem ligação Supabase.", "error");
      return;
    }

    try {
      const normalizedPath = normalizeFolderPath(targetFolderPath);
      const segments = splitFolderPath(normalizedPath);
      const updated = await updateDocument(doc.id, {
        ...toUpdatePayload(doc),
        folderPath: normalizedPath,
        folderName: segments[0] ?? "",
        subfolderName: segments[1] ?? "",
      });
      setDocs((current) => current.map((item) => (item.id === doc.id ? updated : item)));
      showToast(normalizedPath ? "Documento movido para a pasta selecionada." : "Documento movido para a raiz.");
    } catch {
      showToast("Não foi possível mover o documento.", "error");
    }
  }

  function handleFolderDrop(targetFolderPath) {
    if (!draggingDocId) {
      return;
    }

    const draggingDoc = docs.find((doc) => doc.id === draggingDocId);
    if (!draggingDoc) {
      return;
    }

    const sourcePath = getDocFolderPath(draggingDoc);
    const destinationPath = normalizeFolderPath(targetFolderPath);
    if (sourcePath === destinationPath) {
      return;
    }

    handleMoveDocumentToFolder(draggingDoc, destinationPath);
  }

  function handleCreateFolder(event) {
    event.preventDefault();
    const cleanName = splitFolderPath(newFolderName)[0] ?? "";
    if (!cleanName) {
      showToast("Informe um nome válido para a pasta.", "error");
      return;
    }

    const fullPath = normalizeFolderPath(currentFolderPath ? `${currentFolderPath}/${cleanName}` : cleanName);
    const alreadyExists =
      virtualFolders.some((path) => normalizeFolderPath(path) === fullPath) ||
      explorerSourceDocs.some((doc) => getDocFolderPath(doc) === fullPath || getDocFolderPath(doc).startsWith(`${fullPath}/`));

    if (alreadyExists) {
      showToast("Esta pasta já existe.", "error");
      return;
    }

    setVirtualFolders((current) => [...current, fullPath]);
    setNewFolderName("");
    setCreateFolderOpen(false);
    showToast("Pasta criada com sucesso.");
  }

  function openFolderContextMenu(event, folderPath) {
    event.preventDefault();
    event.stopPropagation();
    setFolderContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      folderPath: normalizeFolderPath(folderPath),
    });
  }

  function openFolderContextMenuFromButton(event, folderPath) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setFolderContextMenu({
      open: true,
      x: Math.round(rect.left),
      y: Math.round(rect.bottom + 6),
      folderPath: normalizeFolderPath(folderPath),
    });
  }

  function closeFolderContextMenu() {
    setFolderContextMenu({ open: false, x: 0, y: 0, folderPath: "" });
  }

  function handleCreateSubfolder(parentFolderPath) {
    const parentPath = normalizeFolderPath(parentFolderPath);
    const raw = window.prompt("Nome da subpasta:", "Nova Subpasta");
    if (raw == null) {
      return;
    }

    const cleanName = splitFolderPath(raw)[0] ?? "";
    if (!cleanName) {
      showToast("Informe um nome válido para a subpasta.", "error");
      return;
    }

    const fullPath = normalizeFolderPath(parentPath ? `${parentPath}/${cleanName}` : cleanName);
    const alreadyExists =
      virtualFolders.some((path) => normalizeFolderPath(path) === fullPath) ||
      allKnownFolderPaths.some((path) => normalizeFolderPath(path) === fullPath);

    if (alreadyExists) {
      showToast("Esta subpasta já existe.", "error");
      return;
    }

    setVirtualFolders((current) => Array.from(new Set([...current, fullPath])));
    showToast("Subpasta criada com sucesso.");
  }

  async function applyFolderPathTransform(sourcePath, targetPath, successMessage, errorMessage) {
    const normalizedSource = normalizeFolderPath(sourcePath);
    const normalizedTarget = normalizeFolderPath(targetPath);

    if (!normalizedSource || normalizedSource === normalizedTarget) {
      return;
    }

    if (!apiMode) {
      showToast("Operação indisponível sem ligação Supabase.", "error");
      return;
    }

    const docsToUpdate = docs.filter((doc) => {
      const path = getDocFolderPath(doc);
      return path === normalizedSource || path.startsWith(`${normalizedSource}/`);
    });

    try {
      if (docsToUpdate.length) {
        const updatedDocs = await Promise.all(
          docsToUpdate.map((doc) => {
            const currentPath = getDocFolderPath(doc);
            const nextPath = replaceFolderPrefix(currentPath, normalizedSource, normalizedTarget);
            const nextSegments = splitFolderPath(nextPath);

            return updateDocument(doc.id, {
              ...toUpdatePayload(doc),
              folderPath: nextPath,
              folderName: nextSegments[0] ?? "",
              subfolderName: nextSegments[1] ?? "",
            });
          })
        );

        const updatedById = new Map(updatedDocs.map((doc) => [doc.id, doc]));
        setDocs((current) => current.map((doc) => updatedById.get(doc.id) ?? doc));
      }

      setVirtualFolders((current) => {
        const next = current
          .map((path) => replaceFolderPrefix(path, normalizedSource, normalizedTarget))
          .map((path) => normalizeFolderPath(path))
          .filter(Boolean);
        return Array.from(new Set(next));
      });

      setCurrentFolderPath((current) => replaceFolderPrefix(current, normalizedSource, normalizedTarget));
      showToast(successMessage);
    } catch {
      showToast(errorMessage, "error");
    }
  }

  function toggleDocSelection(docId) {
    setSelectedDocIds((current) => {
      const next = new Set(current);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }

  function toggleSelectAllVisibleDocs() {
    const visibleIds = sortedDocs.map((doc) => doc.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedDocIds.has(id));

    setSelectedDocIds((current) => {
      const next = new Set(current);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  async function handleMoveSelectedDocs() {
    if (!selectedDocIds.size) {
      showToast("Selecione pelo menos um documento.", "error");
      return;
    }

    if (!apiMode) {
      showToast("Operação indisponível sem ligação Supabase.", "error");
      return;
    }

    const targetPath = normalizeFolderPath(bulkMoveTargetPath);
    const selectedDocs = docs.filter((doc) => selectedDocIds.has(doc.id));
    const segments = splitFolderPath(targetPath);

    try {
      const movedDocs = await Promise.all(
        selectedDocs.map((doc) =>
          updateDocument(doc.id, {
            ...toUpdatePayload(doc),
            folderPath: targetPath,
            folderName: segments[0] ?? "",
            subfolderName: segments[1] ?? "",
          })
        )
      );

      const updatedById = new Map(movedDocs.map((doc) => [doc.id, doc]));
      setDocs((current) => current.map((doc) => updatedById.get(doc.id) ?? doc));
      setSelectedDocIds(new Set());
      showToast(`${movedDocs.length} documento(s) movido(s) com sucesso.`);
    } catch {
      showToast("Não foi possível mover os documentos selecionados.", "error");
    }
  }

  async function handleRenameFolder(folderPath) {
    const normalizedSource = normalizeFolderPath(folderPath);
    if (!normalizedSource) {
      return;
    }

    const segments = splitFolderPath(normalizedSource);
    const oldName = segments[segments.length - 1] ?? normalizedSource;
    const raw = window.prompt("Novo nome da pasta:", oldName);
    if (raw == null) {
      return;
    }

    const cleanName = splitFolderPath(raw)[0] ?? "";
    if (!cleanName || cleanName === oldName) {
      return;
    }

    const parent = segments.slice(0, -1).join("/");
    const normalizedTarget = normalizeFolderPath(parent ? `${parent}/${cleanName}` : cleanName);

    const alreadyExists = allKnownFolderPaths.some((path) => normalizeFolderPath(path) === normalizedTarget);
    if (alreadyExists) {
      showToast("Já existe uma pasta com esse nome neste nível.", "error");
      return;
    }

    await applyFolderPathTransform(
      normalizedSource,
      normalizedTarget,
      "Pasta renomeada com sucesso.",
      "Não foi possível renomear a pasta."
    );
  }

  async function handleMoveFolder(folderPath) {
    const source = normalizeFolderPath(folderPath);
    if (!source) {
      return;
    }

    const segments = splitFolderPath(source);
    const folderName = segments[segments.length - 1] ?? source;
    const currentParent = segments.slice(0, -1).join("/");

    const raw = window.prompt(
      `Mover '${folderName}' para qual pasta pai?\nUse vazio para Raiz.`,
      currentParent
    );

    if (raw == null) {
      return;
    }

    const destinationParent = normalizeFolderPath(raw);
    if (destinationParent === source || destinationParent.startsWith(`${source}/`)) {
      showToast("Destino inválido: a pasta não pode ser movida para dentro dela mesma.", "error");
      return;
    }

    const target = normalizeFolderPath(destinationParent ? `${destinationParent}/${folderName}` : folderName);
    const alreadyExists = allKnownFolderPaths.some((path) => normalizeFolderPath(path) === target);
    if (alreadyExists) {
      showToast("Já existe uma pasta com esse nome no destino.", "error");
      return;
    }

    await applyFolderPathTransform(
      source,
      target,
      "Pasta movida com sucesso.",
      "Não foi possível mover a pasta."
    );
  }

  async function handleDelete(id, title) {
    if (!apiMode) {
      showToast("Operação indisponível sem ligação Supabase.", "error");
      return;
    }

    if (!window.confirm(`Tem a certeza de que deseja remover o documento ${title || ""}?`)) {
      return;
    }

    try {
      await deleteDocument(id);
      setDocs((current) => current.filter((item) => item.id !== id));
      if (editingId === id) {
        resetFormState();
        setShowSubmitModal(false);
      }
      showToast("Documento removido com sucesso.");
    } catch {
      showToast("Não foi possível remover o documento.", "error");
    }
  }

  async function submitDoc(event) {
    event.preventDefault();
    if (!form.titulo.trim()) {
      showToast(t("documents.toast.titleRequired"), "error");
      return;
    }

    if (!apiMode) {
      showToast("Operação indisponível sem ligação Supabase.", "error");
      return;
    }

    setSubmitting(true);

    try {
      const selectedClass = classById.get(String(form.classGroupId ?? ""));
      const autoClassPath = form.contextType === "class" && selectedClass
        ? buildClassHierarchyPath(selectedClass, areaById, coursesByArea, effectiveFallbackAreaId)
        : "";
      const autoGeneralPath = !autoClassPath && effectiveFallbackAreaId
        ? buildGeneralAreaPath(areaById, effectiveFallbackAreaId)
        : "";

      let uploadData = null;
      if (selectedFile) {
        uploadData = await uploadDocumentFile(selectedFile, {
          ...form,
          folderPath: autoClassPath || normalizeFolderPath(form.folderPath) || autoGeneralPath,
        });
      }

      const payload = {
        ...form,
        folderPath: autoClassPath || normalizeFolderPath(form.folderPath || [form.folderName, form.subfolderName].filter(Boolean).join("/")) || autoGeneralPath,
        arquivoUrl: uploadData?.arquivoUrl ?? form.arquivoUrl,
        arquivoPath: uploadData?.arquivoPath ?? form.arquivoPath,
      };

      if (editingId) {
        const updated = await updateDocument(editingId, payload);
        setDocs((current) => current.map((item) => (item.id === editingId ? updated : item)));
        showToast("Documento atualizado com sucesso.");
      } else {
        const created = await createDocument(payload);
        setDocs((current) => [created, ...current]);
        showToast(t("documents.toast.submitted"));
      }
    } catch {
      showToast("Não foi possível submeter o documento.", "error");
      setSubmitting(false);
      return;
    }

    resetFormState();
    setShowSubmitModal(false);
    setSubmitting(false);
  }

  return (
    <main className="page page-documents">
      <PageHeader
        title={t("documents.title")}
        description={t("documents.description")}
        meta={
          <button
            className="btn primary"
            type="button"
            onClick={() => {
              resetFormState();
              setShowSubmitModal(true);
            }}
          >
            <span className="material-icons-sharp" aria-hidden="true">upload_file</span>
            {t("documents.submit")}
          </button>
        }
      />

      {isAdmin ? (
        <PanelSection title="Administração — Upload em Lote">
          <div className="admin-bulk-upload">
            <p className="meta" style={{ marginBottom: "0.75rem" }}>
              Selecione um ou vários ficheiros para guardar diretamente no sistema. Cada ficheiro é armazenado no banco de dados automaticamente.
            </p>
            <div className="bulk-upload-controls">
              <label className="btn ghost" htmlFor="admin-bulk-input" style={{ cursor: "pointer" }}>
                <span className="material-icons-sharp" aria-hidden="true">folder_open</span>
                Selecionar Ficheiros
              </label>
              <input
                ref={bulkInputRef}
                id="admin-bulk-input"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv"
                onChange={handleBulkFileChange}
                style={{ display: "none" }}
              />
              {bulkFiles.length > 0 ? (
                <span className="meta" style={{ alignSelf: "center" }}>
                  {bulkFiles.length} ficheiro(s) selecionado(s)
                </span>
              ) : null}
              <button
                className="btn primary"
                type="button"
                disabled={bulkUploading || bulkFiles.length === 0}
                onClick={handleBulkUpload}
              >
                {bulkUploading ? (
                  <>
                    <span className="material-icons-sharp" aria-hidden="true" style={{ animation: "spin 1s linear infinite" }}>sync</span>
                    A guardar...
                  </>
                ) : (
                  <>
                    <span className="material-icons-sharp" aria-hidden="true">save</span>
                    Guardar no Sistema
                  </>
                )}
              </button>
            </div>

            {bulkProgress.length > 0 ? (
              <ul className="bulk-progress-list">
                {bulkProgress.map((item, idx) => (
                  <li
                    key={idx}
                    className={`bulk-progress-item bulk-progress-${item.status}`}
                  >
                    <span className="material-icons-sharp" aria-hidden="true">
                      {item.status === "ok" ? "check_circle" : item.status === "error" ? "error" : "hourglass_empty"}
                    </span>
                    <span className="bulk-item-name">{item.name}</span>
                    <span className="bulk-item-msg">{item.msg}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </PanelSection>
      ) : null}

      <PanelSection title={t("documents.library")}>
        <div className="doc-grid-toolbar">
          <button
            className={`btn ghost doc-sort-btn${quickFilter === "all" ? " --active" : ""}`}
            type="button"
            onClick={() => setQuickFilter("all")}
          >
            Tudo
          </button>
          <button
            className={`btn ghost doc-sort-btn${quickFilter === "general" ? " --active" : ""}`}
            type="button"
            onClick={() => setQuickFilter("general")}
          >
            Geral
          </button>
          <button
            className={`btn ghost doc-sort-btn${quickFilter === "class" ? " --active" : ""}`}
            type="button"
            onClick={() => setQuickFilter("class")}
          >
            Turma
          </button>
          <button
            className={`btn ghost doc-sort-btn${quickFilter === "company" ? " --active" : ""}`}
            type="button"
            onClick={() => setQuickFilter("company")}
          >
            Empresa
          </button>
          <button
            className={`btn ghost doc-sort-btn${quickFilter === "pinned" ? " --active" : ""}`}
            type="button"
            onClick={() => setQuickFilter("pinned")}
          >
            Fixados
          </button>
          <button
            className={`btn ghost doc-sort-btn${quickFilter === "archived" ? " --active" : ""}`}
            type="button"
            onClick={() => setQuickFilter("archived")}
          >
            Arquivados
          </button>
          <button
            className={`btn ghost doc-sort-btn${sortBy === "az" ? " --active" : ""}`}
            type="button"
            onClick={() => setSortBy("az")}
          >
            <span className="material-icons-sharp" aria-hidden="true">sort_by_alpha</span>
            A &rarr; Z
          </button>
          <button
            className={`btn ghost doc-sort-btn${sortBy === "date" ? " --active" : ""}`}
            type="button"
            onClick={() => setSortBy("date")}
          >
            <span className="material-icons-sharp" aria-hidden="true">schedule</span>
            Mais recentes
          </button>
          <button
            className="btn ghost doc-sort-btn"
            type="button"
            onClick={() => setCreateFolderOpen((open) => !open)}
          >
            <span className="material-icons-sharp" aria-hidden="true">create_new_folder</span>
            Nova pasta
          </button>
          <span className="meta" style={{ marginLeft: "auto", alignSelf: "center" }}>
            {sortedDocs.length} documento(s) na pasta atual
          </span>
        </div>

        {createFolderOpen ? (
          <form className="doc-folder-create-form" onSubmit={handleCreateFolder}>
            <input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="Nome da nova pasta"
            />
            <button className="btn primary" type="submit">
              Criar pasta
            </button>
            <button className="btn ghost" type="button" onClick={() => setCreateFolderOpen(false)}>
              Cancelar
            </button>
          </form>
        ) : null}

        <div className="doc-bulk-actions">
          <button className="btn ghost" type="button" onClick={toggleSelectAllVisibleDocs}>
            {sortedDocs.length > 0 && sortedDocs.every((doc) => selectedDocIds.has(doc.id))
              ? "Desmarcar visíveis"
              : "Selecionar visíveis"}
          </button>
          <span className="meta">{selectedDocIds.size} selecionado(s)</span>
          <select
            className="btn ghost doc-sort-btn"
            value={bulkMoveTargetPath}
            onChange={(event) => setBulkMoveTargetPath(event.target.value)}
            aria-label="Mover selecionados para"
          >
            <option value="">Raiz</option>
            {allKnownFolderPaths.map((path) => (
              <option key={path} value={path}>{path}</option>
            ))}
          </select>
          <button className="btn primary" type="button" disabled={!selectedDocIds.size} onClick={handleMoveSelectedDocs}>
            Mover selecionados
          </button>
        </div>

        <div className="doc-explorer-shell">
          <div className="doc-breadcrumbs">
            {breadcrumbs.map((item) => (
              <button
                key={item.path || "root"}
                type="button"
                className={`doc-breadcrumb-btn${normalizeFolderPath(item.path) === normalizeFolderPath(currentFolderPath) ? " --active" : ""}`}
                onClick={() => setCurrentFolderPath(item.path)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleFolderDrop(item.path);
                  setDraggingDocId(null);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="doc-folder-grid">
            {normalizeFolderPath(currentFolderPath) ? (
              <button
                type="button"
                className="doc-folder-card"
                onClick={() => setCurrentFolderPath(parentFolderPath)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleFolderDrop(parentFolderPath);
                  setDraggingDocId(null);
                }}
              >
                <span className="material-icons-sharp" aria-hidden="true">arrow_upward</span>
                <span>Subir um nível</span>
              </button>
            ) : null}

            {explorerFolderChildren.map((path) => {
              const segments = splitFolderPath(path);
              const folderLabel = segments[segments.length - 1] ?? path;
              const directDocCount = explorerSourceDocs.filter((doc) => getDocFolderPath(doc) === path).length;
              const childFoldersCount = allKnownFolderPaths.filter((knownPath) => {
                const normalizedKnown = normalizeFolderPath(knownPath);
                if (!normalizedKnown.startsWith(`${path}/`)) {
                  return false;
                }
                return splitFolderPath(normalizedKnown).length === splitFolderPath(path).length + 1;
              }).length;

              return (
                <div
                  key={path}
                  className="doc-folder-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => setCurrentFolderPath(path)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setCurrentFolderPath(path);
                    }
                  }}
                  onContextMenu={(event) => openFolderContextMenu(event, path)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleFolderDrop(path);
                    setDraggingDocId(null);
                  }}
                >
                  <span className="material-icons-sharp" aria-hidden="true">folder</span>
                  <span className="doc-folder-main">
                    <span className="doc-folder-name">{folderLabel}</span>
                    <span className="doc-folder-meta">{directDocCount} doc(s) - {childFoldersCount} subpasta(s)</span>
                  </span>
                  <button
                    type="button"
                    className="doc-folder-menu-trigger"
                    aria-label={`Abrir menu da pasta ${folderLabel}`}
                    title="Mais opções"
                    onClick={(event) => openFolderContextMenuFromButton(event, path)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openFolderContextMenuFromButton(event, path);
                      }
                    }}
                  >
                    <span className="material-icons-sharp" aria-hidden="true">more_vert</span>
                  </button>
                </div>
              );
            })}
          </div>

          {folderContextMenu.open ? (
            <div
              className="doc-folder-context-menu"
              style={{ top: folderContextMenu.y, left: folderContextMenu.x }}
              role="menu"
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const folderPath = folderContextMenu.folderPath;
                  closeFolderContextMenu();
                  handleRenameFolder(folderPath);
                }}
              >
                <span className="material-icons-sharp" aria-hidden="true">drive_file_rename_outline</span>
                Renomear pasta
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const folderPath = folderContextMenu.folderPath;
                  closeFolderContextMenu();
                  handleCreateSubfolder(folderPath);
                }}
              >
                <span className="material-icons-sharp" aria-hidden="true">create_new_folder</span>
                Nova subpasta
              </button>
              <span className="doc-folder-context-divider" aria-hidden="true" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const folderPath = folderContextMenu.folderPath;
                  closeFolderContextMenu();
                  handleMoveFolder(folderPath);
                }}
              >
                <span className="material-icons-sharp" aria-hidden="true">drive_file_move</span>
                Mover pasta
              </button>
            </div>
          ) : null}
        </div>

        {loading ? (
          <p className="meta loading-state">A carregar documentos...</p>
        ) : sortedDocs.length === 0 ? (
          <p className="meta" style={{ padding: "2.5rem 0", textAlign: "center" }}>Nenhum documento encontrado.</p>
        ) : (
          <div className="doc-grid">
            {sortedDocs.map((doc) => {
              const extension = extractDocExtension(doc);
              const visual = docVisualByExtension(extension);
              const isArchivedDoc = String(doc.estado ?? "").toLowerCase() === "archived";

              return (
                <article
                  key={doc.id}
                  className="doc-card"
                  draggable
                  onDragStart={() => setDraggingDocId(doc.id)}
                  onDragEnd={() => setDraggingDocId(null)}
                >
                  <label className="doc-card-select">
                    <input
                      type="checkbox"
                      checked={selectedDocIds.has(doc.id)}
                      onChange={() => toggleDocSelection(doc.id)}
                    />
                    <span>Selecionar</span>
                  </label>
                  <div className={`doc-card__thumb doc-card__thumb--${visual.cssClass}`}>
                    <span className="material-icons-sharp" aria-hidden="true">{visual.icon}</span>
                    <span className="doc-card__ext">{visual.label}</span>
                  </div>
                  <div className="doc-card__body">
                    <h3 className="doc-card__title" title={titleLabel(doc.titulo, t)}>
                      {titleLabel(doc.titulo, t)}
                    </h3>
                    <p className="doc-card__meta">
                      <span>{doc.versao ?? "—"}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{doc.categoria ?? "—"}</span>
                    </p>
                    <p className="doc-card__meta">
                      <span>{contextLabel(doc)}</span>
                    </p>
                    <p className="doc-card__meta">
                      <span>{doc.folderName ? `Pasta: ${doc.folderName}` : "Pasta: raiz"}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{doc.subfolderName ? `Sub-pasta: ${doc.subfolderName}` : "Sub-pasta: —"}</span>
                    </p>
                    <p className="doc-card__date">
                      <span className="material-icons-sharp" aria-hidden="true">event</span>
                      {formatDate(doc.updatedAt ?? doc.createdAt)}
                    </p>
                    {doc.isPinned ? (
                      <span className="doc-card__status doc-card__status--published">Fixado</span>
                    ) : null}
                    <span className={`doc-card__status doc-card__status--${doc.estado}`}>
                      {stateLabel(doc.estado, copy)}
                    </span>
                  </div>
                  <div className="doc-card__actions">
                    <button
                      className="btn ghost"
                      type="button"
                      disabled={!doc.arquivoUrl}
                      onClick={() => setPreviewDoc(doc)}
                    >
                      <span className="material-icons-sharp" aria-hidden="true">description</span>
                      Abrir
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => {
                        setEditingId(doc.id);
                        setForm({
                          titulo: doc.titulo ?? "",
                          tipo: doc.tipo ?? "PDF",
                          versao: doc.versao ?? "v1.0",
                          categoria: doc.categoria ?? "geral",
                          descricao: doc.descricao ?? "",
                          arquivoUrl: doc.arquivoUrl ?? "",
                          arquivoPath: doc.arquivoPath ?? "",
                          contextType: doc.contextType ?? "general",
                          classGroupId: doc.classGroupId ?? "",
                          partnerId: doc.partnerId ?? "",
                          isPinned: Boolean(doc.isPinned),
                          folderPath: getDocFolderPath(doc),
                          folderName: doc.folderName ?? "",
                          subfolderName: doc.subfolderName ?? "",
                        });
                        setSelectedFile(null);
                        setShowSubmitModal(true);
                      }}
                    >
                      Editar
                    </button>
                    <button className="btn ghost" type="button" onClick={() => handleTogglePinned(doc)}>
                      {doc.isPinned ? "Desafixar" : "Fixar"}
                    </button>
                    {!isArchivedDoc ? (
                      <button className="btn ghost" type="button" onClick={() => handleStatusChange(doc.id, "published")}>
                        Publicar
                      </button>
                    ) : null}
                    {isArchivedDoc ? (
                      <button className="btn ghost" type="button" onClick={() => handleStatusChange(doc.id, "review")}>
                        Desarquivar
                      </button>
                    ) : (
                      <button className="btn ghost" type="button" onClick={() => handleStatusChange(doc.id, "archived")}>
                        Arquivar
                      </button>
                    )}
                    <button
                      className="btn ghost doc-card__remove"
                      type="button"
                      onClick={() => handleDelete(doc.id, doc.titulo)}
                    >
                      Remover
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </PanelSection>

      {showSubmitModal ? (
        <DocumentSubmitModal
          mode={editingId ? "edit" : "create"}
          form={form}
          selectedFile={selectedFile}
          submitting={submitting}
          onSubmit={submitDoc}
          onClose={() => {
            setShowSubmitModal(false);
            resetFormState();
          }}
          onFormChange={(partial) => setForm((current) => ({ ...current, ...partial }))}
          onFileChange={setSelectedFile}
          classOptions={scopedClassOptions}
          partnerOptions={partnerOptions}
          t={t}
        />
      ) : null}

      {previewDoc ? (
        <div className="doc-preview-overlay" role="dialog" aria-modal="true" aria-label="Visualizador de documento">
          <div className="doc-preview-modal">
            <div className="doc-preview-header">
              <strong>{titleLabel(previewDoc.titulo, t)}</strong>
              <div className="doc-preview-header-actions">
                <button className="btn ghost" type="button" onClick={() => setPreviewDoc(null)}>
                  Fechar
                </button>
              </div>
            </div>
            {previewLoading ? (
              <div style={{ padding: "1rem", opacity: 0.85 }}>A carregar pré-visualização segura...</div>
            ) : previewError ? (
              <div style={{ padding: "1rem", opacity: 0.85 }}>{previewError}</div>
            ) : (
              <iframe
                ref={previewFrameRef}
                title={titleLabel(previewDoc.titulo, t)}
                className="doc-preview-frame"
                sandbox="allow-same-origin"
              />
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
