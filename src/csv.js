/**
 * RFC 4180-ish CSV parser: quoted fields, "" escapes, newlines inside quotes, CRLF.
 * The delimiter is auto-detected (",", ";" or tab) from the first line when not given.
 */
export function parseCSV(text, { delimiter } = {}) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const sep = delimiter ?? detectDelimiter(src);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function detectDelimiter(src) {
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const counts = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

/**
 * Maps CSV rows to records keyed by field name.
 * If the first row matches field names or labels (case-insensitive) it is used as header,
 * otherwise columns follow the schema order.
 */
export function csvToRecords(rows, fields) {
  if (!rows.length) return [];
  const lookup = new Map();
  for (const f of fields) {
    lookup.set(f.name.toLowerCase(), f.name);
    lookup.set(String(f.label).toLowerCase(), f.name);
  }
  const header = rows[0].map((h) => lookup.get(h.trim().toLowerCase()));
  const hasHeader = header.some(Boolean);
  const columns = hasHeader ? header : fields.map((f) => f.name);
  const body = hasHeader ? rows.slice(1) : rows;
  return body.map((cells) => {
    const record = {};
    columns.forEach((name, i) => {
      if (name && i < cells.length) record[name] = cells[i].trim();
    });
    return record;
  });
}
