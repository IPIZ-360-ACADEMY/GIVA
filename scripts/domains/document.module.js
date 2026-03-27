(() => {
  const root = (window.GIVA = window.GIVA || {});
  root.domains = root.domains || {};

  const state = {
    showToast: (message) => console.log(message),
    setButtonLoading: () => {},
    scriptLoadCache: new Map(),
    logoDataUrlPromise: null,
    docRegistryKey: "ipiz-doc-registry",
    auditKeyPairStorageKey: "ipiz-audit-keypair-v1",
  };

  const init = ({ showToast, setButtonLoading } = {}) => {
    if (typeof showToast === "function") state.showToast = showToast;
    if (typeof setButtonLoading === "function") state.setButtonLoading = setButtonLoading;
  };

  const loadExternalScript = (url, readyCheck) => {
    if (readyCheck()) return Promise.resolve();
    if (state.scriptLoadCache.has(url)) return state.scriptLoadCache.get(url);

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

    state.scriptLoadCache.set(url, promise);
    return promise;
  };

  const getLogoDataUrl = async () => {
    if (state.logoDataUrlPromise) return state.logoDataUrlPromise;

    state.logoDataUrlPromise = fetch(new URL("./images/logo.png", window.location.href).href)
      .then((response) => {
        if (!response.ok) throw new Error("Falha ao carregar logo");
        return response.blob();
      })
      .then((blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }))
      .catch(() => "");

    return state.logoDataUrlPromise;
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
    for (let i = 0; i < len; i += 1) bytes[i] = binaryString.charCodeAt(i);
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
    if (value === "EXCEL") return "XLSX";
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
    const raw = localStorage.getItem(state.docRegistryKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const saveDocumentRegistry = (entries) => {
    localStorage.setItem(state.docRegistryKey, JSON.stringify(entries));
  };

  const registerDocument = (entry) => {
    const entries = getDocumentRegistry();
    entries.unshift(entry);
    saveDocumentRegistry(entries.slice(0, 500));
  };

  const findDocumentByValidationId = (validationId) => {
    if (!validationId) return null;
    const normalized = validationId.trim().toUpperCase();
    return getDocumentRegistry().find((item) => String(item.validationId || "").toUpperCase() === normalized) || null;
  };

  const getOrCreateAuditKeyPair = async () => {
    const stored = localStorage.getItem(state.auditKeyPairStorageKey);
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
        localStorage.removeItem(state.auditKeyPairStorageKey);
      }
    }

    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    );

    const exportedPrivate = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    const exportedPublic = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const digest = await crypto.subtle.digest("SHA-256", exportedPublic);
    const fingerprint = toBase64Url(arrayBufferToBase64(digest)).slice(0, 32);

    localStorage.setItem(
      state.auditKeyPairStorageKey,
      JSON.stringify({
        privateKey: arrayBufferToBase64(exportedPrivate),
        publicKey: arrayBufferToBase64(exportedPublic),
        fingerprint,
      })
    );

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
    const signatureBuffer = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, keyPair.privateKey, digestBuffer);

    const hash = toBase64Url(arrayBufferToBase64(digestBuffer));
    const signature = toBase64Url(arrayBufferToBase64(signatureBuffer));

    return {
      algorithm: "RSASSA-PKCS1-v1_5/SHA-256",
      hash,
      signature,
      fingerprint: keyPair.fingerprint,
      signedAt: new Date().toISOString(),
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
      color: { dark: "#0A6C85", light: "#FFFFFF" },
    });
  };

  const ensureGeneratorLibrary = async (type) => {
    if (type === "PDF") {
      await loadExternalScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js", () => Boolean(window.jspdf && window.jspdf.jsPDF));
      return;
    }

    if (type === "DOCX") {
      await loadExternalScript("https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js", () => Boolean(window.docx && window.docx.Document));
      return;
    }

    if (type === "XLSX") {
      await loadExternalScript("https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js", () => Boolean(window.ExcelJS && window.ExcelJS.Workbook));
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

    const rows = [["Escopo", doc.scope], ["Entidade", doc.target], ["Responsavel", doc.responsible], ["Estado", doc.status]];
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
      keywords: `ipiz,validacao,${validationId},assinatura`,
    });

    pdf.save(`${slugify(doc.title)}-${validationId}.pdf`);
  };

  const generateDocxDocument = async (doc, validationId, logoDataUrl, qrDataUrl, auditSignature) => {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } = window.docx;
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
          new Paragraph({ children: [new TextRun({ text: `ID: ${validationId}`, color: "344054" })] }),
          new Paragraph({ children: [new TextRun({ text: `Hash: ${auditSignature.hash}`, color: "344054" })] }),
          new Paragraph({ children: [new TextRun({ text: `Assinado em: ${new Date(auditSignature.signedAt).toLocaleString("pt-BR")}`, color: "344054" })] }),
          new Paragraph({ alignment: AlignmentType.LEFT, children: [new ImageRun({ data: qrData, transformation: { width: 95, height: 95 } })] }),
        ],
      }],
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

    worksheet.getCell("A5").value = "GIVA IPIZ";
    worksheet.getCell("A6").value = "Instituto Politecnico Industrial do Zango";
    worksheet.getCell("A8").value = doc.title;

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
    ];

    rows.forEach((row, index) => {
      const rowNum = 10 + index;
      worksheet.getCell(`A${rowNum}`).value = row[0];
      worksheet.getCell(`B${rowNum}`).value = row[1];
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    downloadBlob(blob, `${slugify(doc.title)}-${validationId}.xlsx`);
  };

  const setupDocumentDownloads = () => {
    document.querySelectorAll("button[data-download-doc]").forEach((button) => {
      button.addEventListener("click", async () => {
        state.setButtonLoading(button, true, "A gerar...");
        try {
          const validationId = generateValidationId();
          const doc = {
            title: button.dataset.docTitle || "Relatorio IPIZ",
            type: normalizeDocType(button.dataset.docType || "PDF"),
            scope: button.dataset.docScope || "Documento",
            target: button.dataset.docTarget || "Entidade",
            status: button.dataset.docStatus || "Em conformidade",
            responsible: button.dataset.docResponsible || "Coordenacao IPIZ",
          };

          if (!["PDF", "DOCX", "XLSX"].includes(doc.type)) throw new Error("Formato nao suportado");

          const logoSrc = await getLogoDataUrl();
          if (!logoSrc) throw new Error("Logo oficial indisponivel");

          const validationPayload = JSON.stringify({
            id: validationId,
            title: doc.title,
            type: doc.type,
            scope: doc.scope,
            target: doc.target,
            issuedAt: new Date().toISOString(),
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
            issuedAt: new Date().toISOString(),
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
              signedAt: auditSignature.signedAt,
            },
          });

          state.showToast(`Download concluido (${doc.type})  ID ${validationId}.`, "success", "download_done");
        } catch {
          state.showToast("Falha ao gerar no formato solicitado. Tente novamente.", "danger", "error");
        } finally {
          state.setButtonLoading(button, false);
        }
      });
    });
  };

  const setupDocumentValidationModule = () => {
    const form = document.getElementById("document-validation-form");
    const input = document.getElementById("document-validation-id");
    const result = document.getElementById("document-validation-result");

    if (!form || !input || !result) return;

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
        state.showToast("ID nao encontrado no registo local.", "warn", "warning");
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
      state.showToast("Documento validado com sucesso.", "success", "verified");
    });
  };

  root.domains.document = {
    init,
    setupDocumentDownloads,
    setupDocumentValidationModule,
  };
})();
