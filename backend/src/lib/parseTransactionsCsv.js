// Parses a bank CSV export, in either of two formats:
//
// - No header row (CIBC):
//     date,description,withdrawal,deposit
//     2026-08-03,Internet Banking INTERNET DEPOSIT 000000115535,,299.25
// - With a header row naming the columns (BNC), in any order; "Solde" is ignored:
//     Date,Description,Categorie,Debit,Credit,Solde
//     2026-09-25,Explorai Inc,Revenus,0,982.24,19054.55
//   Separated by commas or semicolons; amounts as "982.24" or "982,24".
//
// Returns transactions in the same shape as the Transaction model
// (negative amountCents = expense) plus the lines that could not be read.
// With a header, each transaction also carries the bank's category name.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Header names (lowercase, no accents) of each column we read
const COLUMNS = {
  date: ['date', 'date de transaction', 'date de l\'operation'],
  description: ['description', 'libelle'],
  category: ['categorie', 'category'],
  withdrawal: ['debit', 'retrait', 'retraits', 'withdrawal'],
  deposit: ['credit', 'depot', 'depots', 'deposit'],
};

const normalize = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

export function parseTransactionsCsv(text) {
  const transactions = [];
  const errors = [];

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const first = lines.findIndex((line) => line.trim());
  if (first === -1) return { transactions, errors };

  // A semicolon in the first line means the semicolon format
  const separator = lines[first].includes(';') ? ';' : ',';
  const split = (line) => splitCsvLine(line, separator).map((f) => f.trim());

  // Column positions: from the header when there is one, else the CIBC order
  let columns = { date: 0, description: 1, withdrawal: 2, deposit: 3 };
  let start = 0;
  const header = split(lines[first]).map(normalize);
  if (header.includes('date')) {
    columns = {};
    for (const [key, names] of Object.entries(COLUMNS)) {
      const index = header.findIndex((h) => names.includes(h));
      if (index !== -1) columns[key] = index;
    }
    const missing = ['date', 'withdrawal', 'deposit'].filter((key) => columns[key] === undefined);
    if (missing.length > 0) {
      const names = { date: 'Date', withdrawal: 'Débit', deposit: 'Crédit' };
      errors.push({
        line: first + 1,
        content: lines[first],
        error: `colonne(s) introuvable(s) : ${missing.map((key) => names[key]).join(', ')}`,
      });
      return { transactions, errors };
    }
    start = first + 1;
  }

  lines.forEach((line, index) => {
    if (index < start || !line.trim()) return;
    const lineNumber = index + 1;

    try {
      const fields = split(line);
      const field = (key) => (columns[key] === undefined ? '' : (fields[columns[key]] ?? ''));

      const date = field('date');
      if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
        throw new Error(`date invalide « ${date} »`);
      }

      const withdrawalCents = parseAmountCents(field('withdrawal'));
      const depositCents = parseAmountCents(field('deposit'));
      if (withdrawalCents === null && depositCents === null) {
        throw new Error('aucun montant');
      }
      const amountCents = (depositCents ?? 0) - (withdrawalCents ?? 0);
      // BNC lists fees waived as 0 debit and 0 credit: skipped, not an error
      if (amountCents === 0) return;

      const transaction = { date, description: field('description'), amountCents };
      if (columns.category !== undefined) transaction.bankCategory = field('category');
      transactions.push(transaction);
    } catch (err) {
      errors.push({ line: lineNumber, content: line, error: err.message });
    }
  });

  return { transactions, errors };
}

// Splits one CSV line, honouring double-quoted fields ("a, b" and "" escapes)
function splitCsvLine(line, separator) {
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
    } else if (char === separator) {
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

// "131.86" / "131,86" / "1,234.56" / "1 234,56" / "$299.25" -> cents, "" -> null.
// The last "." or "," followed by 1 or 2 digits is the decimal point; any other
// "." or "," separates thousands.
function parseAmountCents(value) {
  let cleaned = value.replace(/[$\s\u00a0]/g, '');
  if (!cleaned) return null;
  const decimal = cleaned.match(/[.,](\d{1,2})$/);
  const whole = (decimal ? cleaned.slice(0, decimal.index) : cleaned).replace(/[.,]/g, '');
  cleaned = decimal ? `${whole}.${decimal[1]}` : whole;
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) throw new Error(`montant invalide « ${value} »`);
  return Math.abs(Math.round(parseFloat(cleaned) * 100));
}
