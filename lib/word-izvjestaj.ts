import {
  AlignmentType, BorderStyle, Document, Packer, PageOrientation, Paragraph, Table, TableCell, TableLayoutType,
  TableRow, TabStopType, TextRun, VerticalAlign, WidthType, convertMillimetersToTwip,
} from "docx";
import type { IzvjestajPostavke } from "@/lib/izvjestaj-postavke";
import { imeUIzvjestaju, zvanjeUIzvjestaju } from "@/lib/izvjestaj-postavke";
import type { MjesecniRed } from "@/lib/mjesecni";
import type { SedmicniRed } from "@/lib/sedmicni";
import { fmtBroj } from "@/lib/sihtarica";

export type WordOrijentacija = "portrait" | "landscape";

const SERIF = "Times New Roman";
const SANS = "Arial";
const MARGINA = convertMillimetersToTwip(15);
// A4 bez margina, u twip-ovima — širina tabele mora biti apsolutna da Word poštuje kolone
const SIRINA_SADRZAJA: Record<WordOrijentacija, number> = {
  portrait: convertMillimetersToTwip(210) - 2 * MARGINA,
  landscape: convertMillimetersToTwip(297) - 2 * MARGINA,
};

const linija = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const okvir = { top: linija, bottom: linija, left: linija, right: linija };

/** Ćelija s jednim ili više redova teksta; prvi red može biti podebljan */
function celija(linije: readonly string[], opts: { rowSpan?: number; bold?: boolean; boldPrvi?: boolean; lijevo?: boolean; vel?: number } = {}) {
  const vel = opts.vel ?? 18;
  return new TableCell({
    rowSpan: opts.rowSpan,
    borders: okvir,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: (linije.length ? linije : [""]).map((t, i) => new Paragraph({
      alignment: opts.lijevo ? AlignmentType.LEFT : AlignmentType.CENTER,
      children: [new TextRun({ text: t, font: SANS, size: vel, bold: opts.bold || (opts.boldPrvi && i === 0) })],
    })),
  });
}

function zaglavlje(p: IzvjestajPostavke, naslov: readonly string[], dodatak: readonly Paragraph[] = []): Paragraph[] {
  const tekst = (t: string, size = 24) => new TextRun({ text: t, font: SERIF, size });
  return [
    ...p.firma.map((l) => new Paragraph({ children: [tekst(l)] })),
    ...(p.primalac ? [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 360 }, children: [tekst(p.primalac)] })] : []),
    ...naslov.map((l, i) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: i === 0 ? 360 : 0 }, children: [tekst(l)] })),
    ...dodatak,
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
}

function potpis(p: IzvjestajPostavke, o: WordOrijentacija): Paragraph {
  const kraj = SIRINA_SADRZAJA[o];
  return new Paragraph({
    spacing: { before: 720 },
    tabStops: [{ type: TabStopType.RIGHT, position: kraj }],
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({ text: `${p.potpis}   `, font: SERIF, size: 24 }),
      new TextRun({ text: " ".repeat(30), font: SERIF, size: 24, underline: {} }),
    ],
  });
}

function dokument(o: WordOrijentacija, children: (Paragraph | Table)[]): Document {
  return new Document({
    creator: "Priprema Proizvodnje",
    sections: [{
      properties: {
        page: {
          size: { orientation: o === "landscape" ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
          margin: { top: MARGINA, bottom: MARGINA, left: MARGINA, right: MARGINA },
        },
      },
      children,
    }],
  });
}

/** Procenti → twip-ovi; ostatak širine ide koloni s null */
function kolone(o: WordOrijentacija, procenti: readonly (number | null)[]): number[] {
  const ukupno = SIRINA_SADRZAJA[o];
  const zadano = procenti.reduce<number>((s, p) => s + (p ?? 0), 0);
  const slobodnih = procenti.filter((p) => p === null).length;
  const ostatak = slobodnih ? (100 - zadano) / slobodnih : 0;
  return procenti.map((p) => Math.round(((p ?? ostatak) / 100) * ukupno));
}

const broj = (n: number, dec = 2) => (n ? fmtBroj(n, dec) : "");

export async function mjesecniDocx(args: {
  redovi: readonly MjesecniRed[];
  radniDani: number;
  naslov: readonly string[];
  postavke: IzvjestajPostavke;
  orijentacija: WordOrijentacija;
}): Promise<Blob> {
  const { redovi, radniDani, naslov, postavke: p, orijentacija: o } = args;
  const NASLOVI = ["RB", "IME I PREZIME", "RADNI DANI", "GO", "ČL.76", "plaćeno odsustvo", "PRAZ.", "BOLOV.", "TEREN", "KANC.", "BROJ STABALA", "POV ha", "VLAKA km"];
  const sirine = kolone(o, [4, null, 6.5, 5, 6.2, 8, 6.2, 7, 6.5, 6.5, 8.5, 6, 7]);
  const tabela = new Table({
    width: { size: SIRINA_SADRZAJA[o], type: WidthType.DXA },
    columnWidths: sirine,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        tableHeader: true,
        children: NASLOVI.map((t) => celija([t], { bold: t !== "plaćeno odsustvo", vel: 16 })),
      }),
      ...redovi.map((r, i) => new TableRow({
        cantSplit: true,
        children: [
          celija([String(i + 1)]),
          celija([imeUIzvjestaju(r.korisnik, p), zvanjeUIzvjestaju(r.korisnik, p)].filter(Boolean), { lijevo: true, boldPrvi: p.imeBold }),
          celija([String(radniDani)]),
          celija([broj(r.go)]), celija([broj(r.clan76)]), celija([broj(r.placeno)]), celija([broj(r.praznici)]),
          celija([broj(r.bolovanje)]), celija([broj(r.teren)]), celija([broj(r.kancelarija)]),
          celija([broj(r.stabala, 0)]), celija([broj(r.ha)]), celija([broj(r.km)]),
        ],
      })),
    ],
  });
  const sekcija = p.sekcija
    ? [new Paragraph({ spacing: { before: 240 }, indent: { left: convertMillimetersToTwip(25) }, children: [new TextRun({ text: p.sekcija, font: SERIF, size: 24 })] })]
    : [];
  return Packer.toBlob(dokument(o, [...zaglavlje(p, naslov, sekcija), tabela, potpis(p, o)]));
}

export async function sedmicniDocx(args: {
  redovi: readonly SedmicniRed[];
  naziviDana: readonly string[];
  naslov: readonly string[];
  postavke: IzvjestajPostavke;
  orijentacija: WordOrijentacija;
}): Promise<Blob> {
  const { redovi, naziviDana, naslov, postavke: p, orijentacija: o } = args;
  const sirine = kolone(o, [4, 15, 11, 8, ...naziviDana.map(() => null), 8]);
  const tabela = new Table({
    width: { size: SIRINA_SADRZAJA[o], type: WidthType.DXA },
    columnWidths: sirine,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        tableHeader: true,
        children: ["RB", "IME I PREZIME", "ODJEL", "DANI", ...naziviDana, "UKUPNO:"].map((t) => celija([t], { bold: t === "UKUPNO:", vel: 16 })),
      }),
      ...redovi.flatMap((r, i) => {
        const k = r.korisnik;
        return [
          new TableRow({
            cantSplit: true,
            children: [
              celija([`${i + 1}.`], { rowSpan: 2 }),
              celija([imeUIzvjestaju(k, p), zvanjeUIzvjestaju(k, p)].filter(Boolean), { rowSpan: 2, boldPrvi: p.imeBold }),
              celija(r.odjeli, { rowSpan: 2 }),
              celija(["Broj stabala"]),
              // više unosa istog dana: grupe odvojene praznim redom
              ...r.dani.map((grupe) => celija(grupe.flatMap((g, gi) => (gi ? ["", ...g] : g)), { rowSpan: 2 })),
              celija([r.stabala ? `${fmtBroj(r.stabala, 0)}st` : ""]),
            ],
          }),
          new TableRow({
            cantSplit: true,
            children: [
              celija(["Površina ha"]),
              celija([r.ha ? `${fmtBroj(r.ha)}ha` : "", r.km > 0 ? `${fmtBroj(r.km)}km` : ""].filter(Boolean)),
            ],
          }),
        ];
      }),
    ],
  });
  return Packer.toBlob(dokument(o, [...zaglavlje(p, naslov), tabela, potpis(p, o)]));
}
