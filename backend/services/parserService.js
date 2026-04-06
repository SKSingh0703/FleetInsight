import xlsx from "xlsx";

function isRowEmpty(row) {
  if (!row || typeof row !== "object") return true;
  return Object.values(row).every((v) => v == null || String(v).trim() === "");
}

export async function parseFile(filePath) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("Missing file path for parsing");
  }

  const workbook = xlsx.readFile(filePath, {
    cellDates: true,
    raw: false,
  });

  const rawRows = [];

  for (const sheetName of workbook.SheetNames || []) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = xlsx.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
    });

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (isRowEmpty(row)) continue;
      rawRows.push({
        spreadsheetId: "UPLOAD",
        tabName: sheetName,
        sheetName,
        rowNumber: i + 2,
        raw: row,
      });
    }
  }

  return rawRows;
}

