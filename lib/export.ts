const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

/** A, B, … Z, AA… */
function kolona(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function celija(v: unknown, ref: string, stil = 0): string {
  const st = stil ? ` s="${stil}"` : "";
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
  if (typeof v === "boolean") return `<c r="${ref}" t="b"${st}><v>${v ? 1 : 0}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
}

/** Jedan list "Podaci": zaglavlje (podebljano) iz ključeva prvog pojavljivanja, brojevi ostaju brojevi */
export async function napraviXlsx(data: Record<string, unknown>[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const kljucevi: string[] = [];
  for (const r of data) for (const k of Object.keys(r)) if (!kljucevi.includes(k)) kljucevi.push(k);

  const sirina = kljucevi.map((k) => Math.min(60, Math.max(k.length, ...data.map((r) => String(r[k] ?? "").length)) + 2));
  const zaglavlje = `<row r="1">${kljucevi.map((k, c) => celija(k, `${kolona(c)}1`, 1)).join("")}</row>`;
  const redovi = data.map((r, i) => `<row r="${i + 2}">${kljucevi.map((k, c) => celija(r[k], `${kolona(c)}${i + 2}`)).join("")}</row>`).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${sirina.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${zaglavlje}${redovi}</sheetData></worksheet>`;

  const zip = new JSZip();
  // bez zapisa foldera u arhivi: Excel ih ne traži
  const dodaj = (ime: string, sadrzaj: string) => zip.file(ime, sadrzaj, { createFolders: false });
  dodaj("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  dodaj("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  dodaj("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Podaci" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  dodaj("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  dodaj("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`);
  dodaj("xl/worksheets/sheet1.xml", sheet);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function exportXlsx(data: Record<string, unknown>[], filename: string) {
  preuzmiFajl(await napraviXlsx(data), `${filename}.xlsx`);
}

/** Preuzimanje fajla napravljenog u browseru (npr. Word izvještaj) */
export function preuzmiFajl(blob: Blob, imeFajla: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = imeFajla;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
