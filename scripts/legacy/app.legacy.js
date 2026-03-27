(() => {
const html = document.documentElement;
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menu-btn");
const closeBtn = document.getElementById("close-btn");
const backdrop = document.getElementById("backdrop");
const themeBtn = document.getElementById("theme-btn");
const searchInput = document.getElementById("global-search");
const loginForm = document.getElementById("login-form");
const loginUser = document.getElementById("login-user");
const loginPassword = document.getElementById("login-password");
const loginFeedback = document.getElementById("login-feedback");

const route = (location.pathname.split("/").pop() || "index.html").toLowerCase();
const uxDomain = window.GIVA?.domains?.ux || {};
const shellDomain = window.GIVA?.domains?.shell || {};
const navigationDomain = window.GIVA?.domains?.navigation || {};
const authDomain = window.GIVA?.domains?.authGuard || {};
const documentDomain = window.GIVA?.domains?.document || {};
const uxFeedbackDomain = window.GIVA?.domains?.uxFeedback || {};
const iamDomain = window.GIVA?.domains?.iam || {};
const internshipDomain = window.GIVA?.domains?.internship || {};
const authKey = iamDomain.authKey || "ipiz-auth";
const scriptLoadCache = new Map();
let logoDataUrlPromise = null;
const docRegistryKey = "ipiz-doc-registry";
const auditKeyPairStorageKey = "ipiz-audit-keypair-v1";

const users = iamDomain.users || {};

const rolePermissions = iamDomain.rolePermissions || {};

// ========== SISTEMA DE ACOMPANHAMENTO DE ESTAGIO ==========
const stageSystem = internshipDomain.stageSystem;

if (!stageSystem) {
  console.error("Modulo de estagios nao carregado.");
  return;
}

const getSession = () => {
if (authDomain.getSession) {
return authDomain.getSession({ authKey });
}
const raw = localStorage.getItem(authKey);
if (!raw) {
return null;
}

try {
return JSON.parse(raw);
} catch {
localStorage.removeItem(authKey);
return null;
}
};

const setSession = (session) => {
if (authDomain.setSession) {
authDomain.setSession({ authKey, session });
return;
}
localStorage.setItem(authKey, JSON.stringify(session));
};

const clearSession = () => {
if (authDomain.clearSession) {
authDomain.clearSession({ authKey });
return;
}
localStorage.removeItem(authKey);
};

const redirect = (target) => {
window.location.href = target;
};

const canAccess = (role, currentRoute) => {
if (authDomain.canAccess) {
return authDomain.canAccess({ rolePermissions, role, currentRoute });
}
const allowed = rolePermissions[role] || [];
return allowed.includes(currentRoute);
};

const setButtonLoading = uxDomain.setButtonLoading || ((btn) => {});

const pulseEntry = uxDomain.pulseEntry || ((el) => {});

const setupLogin = () => {
if (authDomain.setupLogin) {
authDomain.setupLogin({
loginForm,
loginUser,
loginPassword,
loginFeedback,
users,
rolePermissions,
authKey,
setButtonLoading,
redirect,
});
return;
}
if (!loginForm || !loginUser || !loginPassword || !loginFeedback) {
return;
}

const existing = getSession();
if (existing && canAccess(existing.role, "index.html")) {
redirect("index.html");
return;
}

loginForm.addEventListener("submit", (event) => {
event.preventDefault();
const submitBtn = loginForm.querySelector("button[type='submit']");
setButtonLoading(submitBtn, true, "A entrar...");
const username = loginUser.value.trim().toLowerCase();
const password = loginPassword.value;
const user = users[username];

if (!user || user.password !== password) {
loginFeedback.textContent = "Credenciais invalidas. Tente novamente.";
loginFeedback.classList.remove("is-hidden");
setButtonLoading(submitBtn, false);
return;
}

setSession({
username,
name: user.name,
role: user.role,
loginAt: new Date().toISOString()
});

redirect("index.html");
});
};

const enforceRouteProtection = () => {
if (authDomain.enforceRouteProtection) {
return authDomain.enforceRouteProtection({
route,
rolePermissions,
authKey,
redirect,
setupLoginFn: setupLogin,
});
}
if (route === "login.html") {
setupLogin();
return null;
}

const session = getSession();
if (!session) {
redirect("login.html");
return null;
}

if (!canAccess(session.role, route)) {
redirect("index.html");
return null;
}

return session;
};

const applyUserContext = (session) => {
if (authDomain.applyUserContext) {
authDomain.applyUserContext({ session, rolePermissions });
return;
}
if (!session) {
return;
}

document.querySelectorAll(".profile-chip strong").forEach((node) => {
node.textContent = session.name;
});

document.querySelectorAll(".profile-chip small").forEach((node) => {
node.textContent = session.role;
});

document.querySelectorAll(".nav-link[data-route]").forEach((link) => {
const target = link.getAttribute("data-route");
if (!target) {
return;
}

if (!canAccess(session.role, target)) {
link.classList.add("is-hidden");
}
});
};

const setupLogout = () => {
if (authDomain.setupLogout) {
authDomain.setupLogout({ authKey, redirect });
return;
}
document.querySelectorAll(".logout-link").forEach((logoutLink) => {
logoutLink.addEventListener("click", (event) => {
event.preventDefault();
clearSession();
redirect("login.html");
});
});
};

const setActiveNav = () => {
if (navigationDomain.setActiveNav) {
navigationDomain.setActiveNav({ route });
return;
}
document.querySelectorAll(".nav-link[data-route]").forEach((link) => {
if (link.getAttribute("data-route") === route) {
link.classList.add("active");
} else {
link.classList.remove("active");
}
});
};

const applyTheme = (theme) => {
if (shellDomain.applyTheme) {
shellDomain.applyTheme({ html, themeBtn, theme });
return;
}
html.setAttribute("data-theme", theme);
localStorage.setItem("ipiz-theme", theme);
};

const openSidebar = () => {
if (shellDomain.openSidebar) {
shellDomain.openSidebar({ sidebar, backdrop });
return;
}
if (!sidebar || !backdrop) {
return;
}
sidebar.classList.add("open");
backdrop.classList.add("show");
};

const closeSidebar = () => {
if (shellDomain.closeSidebar) {
shellDomain.closeSidebar({ sidebar, backdrop });
return;
}
if (!sidebar || !backdrop) {
return;
}
sidebar.classList.remove("open");
backdrop.classList.remove("show");
};

const setupSearch = () => {
if (shellDomain.setupSearch) {
shellDomain.setupSearch({ searchInput });
return;
}
if (!searchInput) {
return;
}
searchInput.addEventListener("input", () => {
const query = searchInput.value.trim().toLowerCase();
const items = document.querySelectorAll("[data-search]");
items.forEach((item) => {
const text = (item.getAttribute("data-search") || "").toLowerCase();
item.style.display = query === "" || text.includes(query) ? "" : "none";
});
});
};

const createUxModal = uxDomain.createUxModal || (() => null);

const createUxToast = uxDomain.createUxToast || (() => null);

const setUxLevel = uxDomain.setUxLevel || (() => {});

const showToast = uxDomain.showToast || ((msg) => console.log("[toast]", msg));

const showModal = uxDomain.showModal || ((title, msg) => console.log("[modal]", title, msg));

if (documentDomain.init) {
documentDomain.init({
showToast,
setButtonLoading,
});
}

const loadExternalScript = (url, readyCheck) => {
if (readyCheck()) {
return Promise.resolve();
}

if (scriptLoadCache.has(url)) {
return scriptLoadCache.get(url);
}

const promise = new Promise((resolve, reject) => {
const script = document.createElement("script");
script.src = url;
script.async = true;
script.onload = () => {
if (readyCheck()) {
resolve();
return;
}
reject(new Error("Biblioteca carregada sem API esperada"));
};
script.onerror = () => reject(new Error("Falha ao carregar biblioteca externa"));
document.head.appendChild(script);
});

scriptLoadCache.set(url, promise);
return promise;
};

const getLogoDataUrl = async () => {
if (logoDataUrlPromise) {
return logoDataUrlPromise;
}

logoDataUrlPromise = fetch(new URL("./images/logo.png", window.location.href).href)
.then((response) => {
if (!response.ok) {
throw new Error("Falha ao carregar logo");
}
return response.blob();
})
.then((blob) => new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onloadend = () => resolve(String(reader.result));
reader.onerror = reject;
reader.readAsDataURL(blob);
}))
.catch(() => "");

return logoDataUrlPromise;
};

const slugify = (value) => String(value)
.toLowerCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "")
.replace(/[^a-z0-9]+/g, "-")
.replace(/^-+|-+$/g, "")
.slice(0, 54);

const generateValidationId = () => {
const now = new Date();
const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
const nonce = Math.random().toString(36).slice(2, 8).toUpperCase();
return `IPIZ-${stamp}-${nonce}`;
};

const dataUrlToUint8Array = (dataUrl) => {
const base64 = dataUrl.split(",")[1] || "";
const binaryString = atob(base64);
const len = binaryString.length;
const bytes = new Uint8Array(len);
for (let i = 0; i < len; i += 1) {
bytes[i] = binaryString.charCodeAt(i);
}
return bytes;
};

const downloadBlob = (blob, fileName) => {
const url = URL.createObjectURL(blob);
const anchor = document.createElement("a");
anchor.href = url;
anchor.download = fileName;
document.body.appendChild(anchor);
anchor.click();
anchor.remove();
URL.revokeObjectURL(url);
};

const normalizeDocType = (rawType) => {
const value = (rawType || "PDF").toUpperCase().trim();
if (value === "EXCEL") {
return "XLSX";
}
return value;
};

const arrayBufferToBase64 = (buffer) => {
const bytes = new Uint8Array(buffer);
let binary = "";
bytes.forEach((byte) => {
binary += String.fromCharCode(byte);
});
return btoa(binary);
};

const toBase64Url = (base64) => base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const utf8ToUint8Array = (text) => new TextEncoder().encode(text);

const getDocumentRegistry = () => {
const raw = localStorage.getItem(docRegistryKey);
if (!raw) {
return [];
}
try {
const parsed = JSON.parse(raw);
return Array.isArray(parsed) ? parsed : [];
} catch {
return [];
}
};

const saveDocumentRegistry = (entries) => {
localStorage.setItem(docRegistryKey, JSON.stringify(entries));
};

const registerDocument = (entry) => {
const entries = getDocumentRegistry();
entries.unshift(entry);
saveDocumentRegistry(entries.slice(0, 500));
};

const findDocumentByValidationId = (validationId) => {
if (!validationId) {
return null;
}
const normalized = validationId.trim().toUpperCase();
return getDocumentRegistry().find((item) => String(item.validationId || "").toUpperCase() === normalized) || null;
};

const getOrCreateAuditKeyPair = async () => {
const stored = localStorage.getItem(auditKeyPairStorageKey);
if (stored) {
try {
const parsed = JSON.parse(stored);
const privateKey = await crypto.subtle.importKey(
"pkcs8",
Uint8Array.from(atob(parsed.privateKey), (ch) => ch.charCodeAt(0)),
{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
true,
["sign"]
);
const publicKey = await crypto.subtle.importKey(
"spki",
Uint8Array.from(atob(parsed.publicKey), (ch) => ch.charCodeAt(0)),
{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
true,
["verify"]
);
return { privateKey, publicKey, fingerprint: parsed.fingerprint || "N/A" };
} catch {
localStorage.removeItem(auditKeyPairStorageKey);
}
}

const keyPair = await crypto.subtle.generateKey(
{
name: "RSASSA-PKCS1-v1_5",
modulusLength: 2048,
publicExponent: new Uint8Array([1, 0, 1]),
hash: "SHA-256"
},
true,
["sign", "verify"]
);

const exportedPrivate = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
const exportedPublic = await crypto.subtle.exportKey("spki", keyPair.publicKey);
const digest = await crypto.subtle.digest("SHA-256", exportedPublic);
const fingerprint = toBase64Url(arrayBufferToBase64(digest)).slice(0, 32);

localStorage.setItem(auditKeyPairStorageKey, JSON.stringify({
privateKey: arrayBufferToBase64(exportedPrivate),
publicKey: arrayBufferToBase64(exportedPublic),
fingerprint
}));

return { privateKey: keyPair.privateKey, publicKey: keyPair.publicKey, fingerprint };
};

const createAuditSignature = async (payload) => {
if (!(window.crypto && window.crypto.subtle)) {
throw new Error("Web Crypto indisponivel neste navegador");
}

const keyPair = await getOrCreateAuditKeyPair();
const payloadString = JSON.stringify(payload);
const payloadBytes = utf8ToUint8Array(payloadString);
const digestBuffer = await crypto.subtle.digest("SHA-256", payloadBytes);
const signatureBuffer = await crypto.subtle.sign(
{ name: "RSASSA-PKCS1-v1_5" },
keyPair.privateKey,
digestBuffer
);

const hash = toBase64Url(arrayBufferToBase64(digestBuffer));
const signature = toBase64Url(arrayBufferToBase64(signatureBuffer));

return {
algorithm: "RSASSA-PKCS1-v1_5/SHA-256",
hash,
signature,
fingerprint: keyPair.fingerprint,
signedAt: new Date().toISOString()
};
};

const ensureQrLibrary = async () => {
await loadExternalScript(
"https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js",
() => Boolean(window.QRCode && window.QRCode.toDataURL)
);
};

const createValidationQrDataUrl = async (validationPayload) => {
await ensureQrLibrary();
return window.QRCode.toDataURL(validationPayload, {
width: 220,
margin: 1,
color: {
dark: "#0A6C85",
light: "#FFFFFF"
}
});
};

const ensureGeneratorLibrary = async (type) => {
if (type === "PDF") {
await loadExternalScript(
"https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
() => Boolean(window.jspdf && window.jspdf.jsPDF)
);
return;
}

if (type === "DOCX") {
await loadExternalScript(
"https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js",
() => Boolean(window.docx && window.docx.Document)
);
return;
}

if (type === "XLSX") {
await loadExternalScript(
"https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js",
() => Boolean(window.ExcelJS && window.ExcelJS.Workbook)
);
}
};

const generatePdfDocument = async (doc, validationId, logoDataUrl, qrDataUrl, auditSignature) => {
const { jsPDF } = window.jspdf;
const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
const dateText = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

pdf.setFillColor(247, 250, 252);
pdf.roundedRect(36, 36, 523, 770, 14, 14, "F");
pdf.addImage(logoDataUrl, "PNG", 56, 56, 64, 64);

pdf.setTextColor(10, 108, 133);
pdf.setFontSize(19);
pdf.setFont("helvetica", "bold");
pdf.text("GIVA IPIZ", 132, 80);
pdf.setTextColor(71, 84, 103);
pdf.setFontSize(10.5);
pdf.setFont("helvetica", "normal");
pdf.text("Instituto Politecnico Industrial do Zango", 132, 98);
pdf.text("Documento oficial de monitoria e validacao", 132, 113);

pdf.setTextColor(16, 24, 40);
pdf.setFontSize(11);
pdf.text(`Data de emissao: ${dateText}`, 410, 80);
pdf.text(`Tipo: ${doc.type}`, 410, 98);
pdf.line(56, 132, 540, 132);

pdf.setFont("helvetica", "bold");
pdf.setFontSize(17);
pdf.text(doc.title, 56, 166);
pdf.setFont("helvetica", "normal");
pdf.setTextColor(71, 84, 103);
pdf.setFontSize(11);
pdf.text("Documento gerado automaticamente pela plataforma digital do IPIZ.", 56, 186);

const rows = [
["Escopo", doc.scope],
["Entidade", doc.target],
["Responsavel", doc.responsible],
["Estado", doc.status]
];

let y = 226;
rows.forEach(([k, v]) => {
pdf.setFillColor(255, 255, 255);
pdf.roundedRect(56, y - 16, 484, 34, 7, 7, "F");
pdf.setTextColor(16, 24, 40);
pdf.setFont("helvetica", "bold");
pdf.text(`${k}:`, 70, y + 5);
pdf.setFont("helvetica", "normal");
pdf.setTextColor(71, 84, 103);
pdf.text(String(v), 170, y + 5);
y += 50;
});

pdf.setFillColor(240, 248, 251);
pdf.roundedRect(56, y - 10, 484, 170, 8, 8, "F");
pdf.setTextColor(51, 65, 85);
pdf.setFontSize(10);
pdf.text("Validacao: utilize o ID abaixo para verificacao institucional quando necessario.", 66, y + 14);
pdf.setFont("helvetica", "bold");
pdf.text(`ID Validacao: ${validationId}`, 66, y + 38);
pdf.setFont("helvetica", "normal");
pdf.text(`Hash auditoria: ${auditSignature.hash.slice(0, 38)}...`, 66, y + 58);
pdf.text(`Assinado em: ${new Date(auditSignature.signedAt).toLocaleString("pt-BR")}`, 66, y + 76);
pdf.text(`Chave auditoria: ${auditSignature.fingerprint}`, 66, y + 94);
pdf.addImage(qrDataUrl, "PNG", 446, y + 8, 84, 84);
pdf.setFontSize(8.5);
pdf.text("QR de validacao", 462, y + 104);

pdf.setProperties({
title: doc.title,
subject: `Documento IPIZ ${validationId}`,
author: "GIVA IPIZ",
creator: "Plataforma IPIZ",
keywords: `ipiz,validacao,${validationId},assinatura`
});

pdf.save(`${slugify(doc.title)}-${validationId}.pdf`);
};

const generateDocxDocument = async (doc, validationId, logoDataUrl, qrDataUrl, auditSignature) => {
const {
Document,
Packer,
Paragraph,
TextRun,
HeadingLevel,
AlignmentType,
ImageRun,
Table,
TableRow,
TableCell,
WidthType,
BorderStyle
} = window.docx;

const dateText = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const logoData = dataUrlToUint8Array(logoDataUrl);
const qrData = dataUrlToUint8Array(qrDataUrl);

const docxDocument = new Document({
sections: [{
children: [
new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: logoData, transformation: { width: 90, height: 90 } })] }),
new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "GIVA IPIZ", bold: true, size: 36, color: "0A6C85" })] }),
new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Instituto Politecnico Industrial do Zango", size: 22, color: "475467" })] }),
new Paragraph({ text: "" }),
new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: doc.title, color: "101828" })] }),
new Paragraph({ children: [new TextRun({ text: `Data de emissao: ${dateText}`, color: "475467" })] }),
new Paragraph({ text: "" }),
new Table({
width: { size: 100, type: WidthType.PERCENTAGE },
rows: [
["Escopo", doc.scope],
["Entidade", doc.target],
["Tipo", doc.type],
["Responsavel", doc.responsible],
["Estado", doc.status]
].map(([label, value]) => new TableRow({
children: [
new TableCell({
borders: {
top: { style: BorderStyle.SINGLE, size: 1, color: "D0D5DD" },
bottom: { style: BorderStyle.SINGLE, size: 1, color: "D0D5DD" },
left: { style: BorderStyle.SINGLE, size: 1, color: "D0D5DD" },
right: { style: BorderStyle.SINGLE, size: 1, color: "D0D5DD" }
},
children: [new Paragraph({ children: [new TextRun({ text: String(label), bold: true })] })]
}),
new TableCell({
borders: {
top: { style: BorderStyle.SINGLE, size: 1, color: "D0D5DD" },
bottom: { style: BorderStyle.SINGLE, size: 1, color: "D0D5DD" },
left: { style: BorderStyle.SINGLE, size: 1, color: "D0D5DD" },
right: { style: BorderStyle.SINGLE, size: 1, color: "D0D5DD" }
},
children: [new Paragraph(String(value))]
})
]
}))
}),
new Paragraph({ text: "" }),
new Paragraph({ children: [new TextRun({ text: "Validacao institucional", bold: true, color: "0A6C85" })] }),
new Paragraph({ children: [new TextRun({ text: `ID discreto de verificacao: ${validationId}`, color: "344054" })] }),
new Paragraph({ children: [new TextRun({ text: `Hash de auditoria: ${auditSignature.hash}`, color: "344054" })] }),
new Paragraph({ children: [new TextRun({ text: `Assinado em: ${new Date(auditSignature.signedAt).toLocaleString("pt-BR")}`, color: "344054" })] }),
new Paragraph({ children: [new TextRun({ text: `Chave auditoria: ${auditSignature.fingerprint}`, color: "344054" })] }),
new Paragraph({ text: "" }),
new Paragraph({ alignment: AlignmentType.LEFT, children: [new ImageRun({ data: qrData, transformation: { width: 95, height: 95 } })] }),
new Paragraph({ children: [new TextRun({ text: "QR de validacao do documento", color: "475467" })] })
]
}]
});

const blob = await Packer.toBlob(docxDocument);
downloadBlob(blob, `${slugify(doc.title)}-${validationId}.docx`);
};

const generateXlsxDocument = async (doc, validationId, logoDataUrl, qrDataUrl, auditSignature) => {
const workbook = new window.ExcelJS.Workbook();
const worksheet = workbook.addWorksheet("Relatorio IPIZ");
const dateText = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

worksheet.columns = [{ width: 30 }, { width: 60 }];

const imageId = workbook.addImage({ base64: logoDataUrl, extension: "png" });
worksheet.addImage(imageId, "A1:B4");

const qrImageId = workbook.addImage({ base64: qrDataUrl, extension: "png" });
worksheet.addImage(qrImageId, "D1:E5");

worksheet.mergeCells("A5:B5");
worksheet.getCell("A5").value = "GIVA IPIZ";
worksheet.getCell("A5").font = { size: 18, bold: true, color: { argb: "FF0A6C85" } };

worksheet.mergeCells("A6:B6");
worksheet.getCell("A6").value = "Instituto Politecnico Industrial do Zango";
worksheet.getCell("A6").font = { size: 11, color: { argb: "FF475467" } };

worksheet.mergeCells("A8:B8");
worksheet.getCell("A8").value = doc.title;
worksheet.getCell("A8").font = { size: 14, bold: true, color: { argb: "FF101828" } };

const rows = [
["Escopo", doc.scope],
["Entidade", doc.target],
["Tipo", doc.type],
["Responsavel", doc.responsible],
["Estado", doc.status],
["Data de emissao", dateText],
["ID Validacao", validationId],
["Hash Auditoria", auditSignature.hash],
["Assinado em", new Date(auditSignature.signedAt).toLocaleString("pt-BR")],
["Chave Auditoria", auditSignature.fingerprint],
["QR", "Leia o QR no topo da planilha para validar"]
];

rows.forEach((row, index) => {
const rowNum = 10 + index;
worksheet.getCell(`A${rowNum}`).value = row[0];
worksheet.getCell(`B${rowNum}`).value = row[1];
worksheet.getCell(`A${rowNum}`).font = { bold: true, color: { argb: "FF344054" } };
worksheet.getCell(`B${rowNum}`).font = { color: { argb: "FF475467" } };
worksheet.getCell(`A${rowNum}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7FAFC" } };
});

const buffer = await workbook.xlsx.writeBuffer();
const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
downloadBlob(blob, `${slugify(doc.title)}-${validationId}.xlsx`);
};

const setupDocumentDownloads = () => {
if (documentDomain.setupDocumentDownloads) {
documentDomain.setupDocumentDownloads();
return;
}
document.querySelectorAll("button[data-download-doc]").forEach((button) => {
button.addEventListener("click", async () => {
setButtonLoading(button, true, "A gerar...");
try {
const validationId = generateValidationId();
const doc = {
title: button.dataset.docTitle || "Relatorio IPIZ",
type: normalizeDocType(button.dataset.docType || "PDF"),
scope: button.dataset.docScope || "Documento",
target: button.dataset.docTarget || "Entidade",
status: button.dataset.docStatus || "Em conformidade",
responsible: button.dataset.docResponsible || "Coordenacao IPIZ"
};

if (!["PDF", "DOCX", "XLSX"].includes(doc.type)) {
throw new Error("Formato nao suportado");
}

const logoSrc = await getLogoDataUrl();
if (!logoSrc) {
throw new Error("Logo oficial indisponivel");
}

const validationPayload = JSON.stringify({
id: validationId,
title: doc.title,
type: doc.type,
scope: doc.scope,
target: doc.target,
issuedAt: new Date().toISOString()
});

const qrDataUrl = await createValidationQrDataUrl(validationPayload);
const auditSignature = await createAuditSignature({
validationId,
title: doc.title,
type: doc.type,
scope: doc.scope,
target: doc.target,
status: doc.status,
responsible: doc.responsible,
issuedAt: new Date().toISOString()
});

await ensureGeneratorLibrary(doc.type);

if (doc.type === "PDF") {
await generatePdfDocument(doc, validationId, logoSrc, qrDataUrl, auditSignature);
} else if (doc.type === "DOCX") {
await generateDocxDocument(doc, validationId, logoSrc, qrDataUrl, auditSignature);
} else {
await generateXlsxDocument(doc, validationId, logoSrc, qrDataUrl, auditSignature);
}

registerDocument({
validationId,
title: doc.title,
type: doc.type,
scope: doc.scope,
target: doc.target,
status: doc.status,
responsible: doc.responsible,
issuedAt: new Date().toISOString(),
audit: {
algorithm: auditSignature.algorithm,
hash: auditSignature.hash,
signature: auditSignature.signature,
fingerprint: auditSignature.fingerprint,
signedAt: auditSignature.signedAt
}
});

showToast(`Download concluido (${doc.type})  ID ${validationId}.`, "success", "download_done");
} catch {
showToast("Falha ao gerar no formato solicitado. Tente novamente.", "danger", "error");
} finally {
setButtonLoading(button, false);
}
});
});
};

const setupDocumentValidationModule = () => {
if (documentDomain.setupDocumentValidationModule) {
documentDomain.setupDocumentValidationModule();
return;
}
const form = document.getElementById("document-validation-form");
const input = document.getElementById("document-validation-id");
const result = document.getElementById("document-validation-result");

if (!form || !input || !result) {
return;
}

form.addEventListener("submit", (event) => {
event.preventDefault();
const rawValue = (input.value || "").trim();
if (!rawValue) {
result.className = "validation-result validation-result-warning";
result.innerHTML = "Informe um ID para validar.";
return;
}

const found = findDocumentByValidationId(rawValue);
if (!found) {
result.className = "validation-result validation-result-error";
result.innerHTML = `ID <strong>${rawValue.toUpperCase()}</strong> nao encontrado no registo local de auditoria.`;
showToast("ID nao encontrado no registo local.", "warn", "warning");
return;
}

result.className = "validation-result validation-result-success";
result.innerHTML = `
<strong>Documento valido</strong><br>
ID: ${found.validationId}<br>
Titulo: ${found.title}<br>
Tipo: ${found.type}<br>
Escopo: ${found.scope}<br>
Entidade: ${found.target}<br>
Emitido em: ${new Date(found.issuedAt).toLocaleString("pt-BR")}<br>
Assinatura: ${found.audit?.algorithm || "N/A"}<br>
Hash: ${(found.audit?.hash || "").slice(0, 38)}...
`;
showToast("Documento validado com sucesso.", "success", "verified");
});
};

const setupUxFeedback = () => {
if (uxFeedbackDomain.init) {
uxFeedbackDomain.init({ route, showToast });
return;
}
if (route === "login.html") {
return;
}

document.querySelectorAll("a[href='#']:not(.logout-link)").forEach((link) => {
link.addEventListener("click", (event) => {
event.preventDefault();
showToast("Funcionalidade em preparacao.", "info", "construction");
});
});
};

if (route === "login.html") {
const currentTheme = localStorage.getItem("ipiz-theme") || "light";
applyTheme(currentTheme);
setupLogin();
if (themeBtn) {
themeBtn.addEventListener("click", () => {
const nextTheme = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
applyTheme(nextTheme);
});
}
return;
}

const session = enforceRouteProtection();
if (!session) {
return;
}

const currentTheme = localStorage.getItem("ipiz-theme") || "light";
applyTheme(currentTheme);
applyUserContext(session);
setupLogout();
setActiveNav();
setupSearch();
setupDocumentDownloads();
setupDocumentValidationModule();
setupUxFeedback();

if (menuBtn) {
menuBtn.addEventListener("click", openSidebar);
}

if (closeBtn) {
closeBtn.addEventListener("click", closeSidebar);
}

if (backdrop) {
backdrop.addEventListener("click", closeSidebar);
}

if (themeBtn) {
themeBtn.addEventListener("click", () => {
const nextTheme = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
applyTheme(nextTheme);
});
}
})();

