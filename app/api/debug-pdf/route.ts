import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { parsePDF } from '@/lib/parsers';

let getPdfParse: any;

async function getPdfParseModule() {
  if (!getPdfParse) {
    const pdfParseModule = await import('pdf-parse');
    getPdfParse = pdfParseModule.default || pdfParseModule;
  }
  return getPdfParse;
}

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

    const dataBuffer = await fs.readFile(filePath);

    // Get raw PDF text
    const pdfParse = await getPdfParseModule();
    const data = await pdfParse(dataBuffer);
    const text = data.text;
    const lines = text.split('\n');

    // Also run through our parser
    const parseResult = await parsePDF(dataBuffer);

    return NextResponse.json({
      filename: filePath.split('/').pop(),
      metadata: {
        pages: data.numpages,
        totalChars: text.length,
        totalLines: lines.length,
      },
      rawText: text,
      lines: lines.map((line, i) => ({ num: i, content: line.trim() })).filter(l => l.content),
      firstHundredLines: lines.slice(0, 100).map((line, i) => ({ num: i, content: line.trim() })).filter(l => l.content),
      parseResult: {
        transactions: parseResult.transactions,
        balance: parseResult.balance,
        warnings: parseResult.warnings,
      },
    });
  } catch (error: any) {
    console.error('Error reading PDF:', error);
    return NextResponse.json(
      { error: 'Failed to read PDF', details: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
