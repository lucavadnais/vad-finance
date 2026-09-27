// Parses a bank CSV export with no header row:
//   date,description,withdrawal,deposit
//   2026-08-03,Internet Banking INTERNET DEPOSIT 000000115535,,299.25
// Returns transactions in the same shape as the Transaction model
// (negative amountCents = expense) plus the lines that could not be read.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseTransactionsCsv(text) {
  const transactions = [];
  const errors = [];

  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    const lineNumber = index + 1;

    try {
      const [date, description = '', withdrawal = '', deposit = ''] = splitCsvLine(line).map((f) =>
        f.trim(),
      );
      if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
        throw new Error(`date invalide « ${date} »`);
      }

      const withdrawalCents = parseAmountCents(withdrawal);
      const depositCents = parseAmountCents(deposit);
      if (withdrawalCents === null && depositCents === null) {
        throw new Error('aucun montant');
      }

      transactions.push({
        date,
        description,
        amountCents: (depositCents ?? 0) - (withdrawalCents ?? 0),
      });
    } catch (err) {
      errors.push({ line: lineNumber, content: line, error: err.message });
    }
  });

  return { transactions, errors };
}

// "Compte cheques (2).csv" -> "Compte cheques" (the bank names the file after the account;
// the browser adds " (n)" when the same file is downloaded several times)
export function accountNameFromFileName(fileName = '') {
  return fileName
    .replace(/\.csv$/i, '')
    .replace(/\s*\(\d+\)$/, '')
    .trim();
}

// "Compte CIBC.csv" -> 'cibc', "NBC visa.csv" -> 'nbc', otherwise null
const BANK_KEYS = ['cibc', 'nbc'];

export function bankFromFileName(fileName = '') {
  const words = fileName.toLowerCase().split(/[^a-z0-9]+/);
  return BANK_KEYS.find((key) => words.includes(key)) ?? null;
}

// Splits one CSV line, honouring double-quoted fields ("a, b" and "" escapes)
function splitCsvLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  if (inQuotes) throw new Error('guillemet non fermé');
  fields.push(field);
  return fields;
}

// "1,234.56" / "$299.25" -> cents, "" -> null
function parseAmountCents(value) {
  const cleaned = value.replace(/[$\s,]/g, '');
  if (!cleaned) return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) throw new Error(`montant invalide « ${value} »`);
  return Math.abs(Math.round(parseFloat(cleaned) * 100));
}
