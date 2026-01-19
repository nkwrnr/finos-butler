import { parse } from 'csv-parse/sync';

// Dynamically import pdf-parse (CommonJS module)
async function getPdfParse() {
  const pdfParseModule = await import('pdf-parse');
  return pdfParseModule.default || pdfParseModule;
}

export type Transaction = {
  date: string;
  description: string;
  amount: number;
  category?: string;
};

export type ParseResult = {
  transactions: Transaction[];
  balance?: number;
  warnings: string[];
};

// Common date patterns
const datePatterns = [
  /\d{1,2}\/\d{1,2}\/\d{2,4}/,  // MM/DD/YYYY or M/D/YY
  /\d{1,2}\/\d{1,2}(?=\s)/,     // MM/DD (without year, followed by space - common in statements)
  /\d{4}-\d{2}-\d{2}/,           // YYYY-MM-DD
  /\d{2}-\d{2}-\d{4}/,           // MM-DD-YYYY
  /\w{3}\s+\d{1,2},?\s+\d{4}/,   // Jan 1, 2024 or Jan 1 2024
];

// Common amount patterns
const amountPattern = /[-+]?\$?\s*\d{1,3}(?:,?\d{3})*\.?\d{0,2}/;

export async function parseCSV(buffer: Buffer): Promise<ParseResult> {
  const warnings: string[] = [];
  const transactions: Transaction[] = [];

  try {
    const text = buffer.toString('utf-8');
    const records = parse(text, {
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    if (records.length === 0) {
      warnings.push('No data found in CSV file');
      return { transactions, warnings };
    }

    // Try to detect if first row is a header
    const header = records[0].map((h: string) => h.toLowerCase());
    const hasHeader = header.some((h: string) =>
      h.includes('date') || h.includes('desc') || h.includes('amount') || h.includes('transaction')
    );

    let dateIdx = -1;
    let descIdx = -1;
    let amountIdx = -1;
    let startRow = 1; // Default: skip first row (header)

    if (hasHeader) {
      dateIdx = header.findIndex((h: string) =>
        h.includes('date') || h.includes('posted') || h.includes('trans')
      );
      descIdx = header.findIndex((h: string) =>
        h.includes('desc') || h.includes('memo') || h.includes('merchant') || h.includes('payee')
      );
      amountIdx = header.findIndex((h: string) =>
        h.includes('amount') || h.includes('total') || h.includes('debit') || h.includes('credit')
      );
    } else {
      // No header - use positional indices based on common CSV formats
      // Format 1: Date, Amount, ..., Description (Wells Fargo)
      // Format 2: Date, Description, Amount (standard)
      warnings.push('No header row detected, using positional columns');
      startRow = 0; // Don't skip first row

      // Try to detect format by checking if second column looks like an amount
      if (records[0].length >= 2) {
        const secondCol = records[0][1].toString().replace(/[$,\s-]/g, '');
        if (!isNaN(parseFloat(secondCol))) {
          // Format 1: Date, Amount, ..., Description
          dateIdx = 0;
          amountIdx = 1;
          descIdx = records[0].length > 4 ? 4 : records[0].length - 1; // Usually last column
        } else {
          // Format 2: Date, Description, Amount
          dateIdx = 0;
          descIdx = 1;
          amountIdx = records[0].length - 1;
        }
      }
    }

    if (dateIdx === -1) {
      warnings.push('Could not detect date column, using first column');
      dateIdx = 0;
    }
    if (descIdx === -1) {
      warnings.push('Could not detect description column, using second column');
      descIdx = 1;
    }
    if (amountIdx === -1) {
      warnings.push('Could not detect amount column, using last column');
      amountIdx = records[0].length - 1;
    }

    const finalDateIdx = dateIdx;
    const finalDescIdx = descIdx;
    const finalAmountIdx = amountIdx;

    // Parse transactions
    for (let i = startRow; i < records.length; i++) {
      const row = records[i];

      if (row.length < 2) continue; // Skip empty or invalid rows

      try {
        const dateStr = row[finalDateIdx] || '';
        const description = row[finalDescIdx] || 'Unknown';
        const amountStr = row[finalAmountIdx] || '0';

        // Parse amount
        const cleanAmount = amountStr.toString()
          .replace(/[$,\s]/g, '')
          .replace(/[()]/g, ''); // Remove parentheses for negative amounts

        let amount = parseFloat(cleanAmount);

        // Handle parentheses notation for negative amounts
        if (amountStr.includes('(') && amountStr.includes(')')) {
          amount = -Math.abs(amount);
        }

        if (isNaN(amount)) {
          warnings.push(`Row ${i + 1}: Could not parse amount "${amountStr}"`);
          continue;
        }

        transactions.push({
          date: dateStr,
          description: description.toString(),
          amount,
        });
      } catch (err) {
        warnings.push(`Row ${i + 1}: Error parsing transaction - ${err}`);
      }
    }

    if (transactions.length === 0) {
      warnings.push('No valid transactions found');
    }

  } catch (error) {
    warnings.push(`CSV parsing error: ${error}`);
  }

  return { transactions, warnings };
}

export async function parsePDF(buffer: Buffer): Promise<ParseResult> {
  const warnings: string[] = [];
  const transactions: Transaction[] = [];
  let balance: number | undefined;

  try {
    const pdfParse = await getPdfParse();
    const data = await pdfParse(buffer);
    const text = data.text;

    // Extract balance - try multiple patterns in order of specificity
    const balancePatterns = [
      // Wells Fargo: "Ending balance on 12/31  $23,135.31"
      /ending\s+balance\s+on\s+\d{1,2}\/\d{1,2}\s+\$?([\d,]+\.\d{2})/i,
      // Chase: "New Balance $28,531.77" or "Statement Balance $8,486.06"
      /(?:ending|statement|new|current)\s+balance[:\s]+\$\s*([\d,]+\.\d{2})/i,
      // Generic with colon: "Balance: $1,234.56"
      /balance:\s*\$\s*([\d,]+\.\d{2})/i,
      // Fallback: any balance with $ and decimal
      /(?:ending|statement|new|current)\s+balance[:\s]+\$?([\d,]+\.\d{2})/i,
    ];

    for (const pattern of balancePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const balanceStr = match[1].replace(/,/g, '');
        const parsedBalance = parseFloat(balanceStr);
        if (!isNaN(parsedBalance) && parsedBalance > 0) {
          balance = parsedBalance;
          break;
        }
      }
    }

    if (balance === undefined) {
      warnings.push('Could not detect statement balance');
    }

    // Extract transactions - look for lines with date and amount patterns
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.length === 0) continue;

      // Check if line starts with a date pattern (MM/DD or MM/DD/YY or MM/DD/YYYY)
      const lineStartDateMatch = line.match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+)/);

      if (!lineStartDateMatch) continue;

      const dateStr = lineStartDateMatch[1];
      let restOfLine = lineStartDateMatch[2];

      // Check if line contains an amount
      let amountMatches = restOfLine.match(new RegExp(amountPattern, 'g'));

      // Wells Fargo sometimes puts amount on the NEXT line
      // If no amount found, check next 2 lines
      if (!amountMatches || amountMatches.length === 0) {
        for (let j = 1; j <= 2 && i + j < lines.length; j++) {
          const nextLine = lines[i + j].trim();
          // Check if next line is just an amount (or amount + balance)
          const nextLineMatches = nextLine.match(new RegExp(amountPattern, 'g'));
          if (nextLineMatches && nextLineMatches.length > 0) {
            amountMatches = nextLineMatches;
            // Include continuation lines in description
            for (let k = 1; k < j; k++) {
              restOfLine += ' ' + lines[i + k].trim();
            }
            break;
          }
        }
      }

      if (!amountMatches || amountMatches.length === 0) continue;

      // Wells Fargo format has TWO amounts: transaction amount, then running balance
      // Chase format has ONE amount: transaction amount
      // Strategy: If there are 2+ amounts, use second-to-last (transaction). Otherwise use last.
      let amountStr: string;
      if (amountMatches.length >= 2) {
        // Multiple amounts found - likely Wells Fargo format with running balance
        // Use second-to-last (the transaction amount, not the balance)
        amountStr = amountMatches[amountMatches.length - 2];
      } else {
        // Single amount - standard format (Chase, etc.)
        amountStr = amountMatches[0];
      }

      const cleanAmount = amountStr.replace(/[$,\s]/g, '');
      const amount = parseFloat(cleanAmount);

      if (isNaN(amount)) continue;

      // Filter out unreasonably large amounts (likely parsing errors)
      if (Math.abs(amount) > 1000000) continue;

      // Filter out amounts that look like dates (YYMMDD format: 6 digits, no decimals)
      if (cleanAmount.match(/^\d{6}$/) && amount > 200000 && amount < 300000) {
        continue; // Skip reference numbers that look like dates (e.g., 251203)
      }

      // Filter out 5-digit numbers without decimals that are likely reference/store numbers
      if (cleanAmount.match(/^\d{5}$/) && !amountStr.includes('.')) {
        continue; // Skip store/reference numbers (e.g., 83070, 38470)
      }

      // Extract description (text between date and amount)
      const descStartIdx = 0;
      let description = restOfLine.trim();

      // Remove the amount from description if it appears
      const amountIdx = description.indexOf(amountStr);
      if (amountIdx !== -1) {
        description = description.substring(0, amountIdx).trim();
      }

      // Skip if description is too short (likely not a real transaction)
      if (description.length < 3) continue;

      transactions.push({
        date: dateStr,
        description,
        amount,
      });
    }

    if (transactions.length === 0) {
      warnings.push('Could not extract transactions from PDF. PDF format may not be supported or transactions may need manual entry.');
    } else {
      warnings.push(`Extracted ${transactions.length} potential transactions from PDF. Please verify the data for accuracy.`);
    }

  } catch (error) {
    warnings.push(`PDF parsing error: ${error}. This PDF may have a complex format that is difficult to parse automatically.`);
  }

  return { transactions, balance, warnings };
}
