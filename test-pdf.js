import fs from 'fs';
import { PDFParse } from 'pdf-parse';

const pdfPath = process.argv[2] || '/Users/the_machine/app/finance/Statements/Chase/20250128-statements-1627-.pdf';
const dataBuffer = fs.readFileSync(pdfPath);

const parser = new PDFParse({ data: dataBuffer });

async function run() {
  try {
    const textResult = await parser.getText();
    const info = await parser.getInfo();

    console.log('=== PDF METADATA ===');
    console.log('Info:', info);
    console.log('Total chars:', textResult.text.length);

    console.log('\n=== EXTRACTED TEXT ===');
    console.log(textResult.text);

    console.log('\n=== LINES ===');
    const lines = textResult.text.split('\n');
    console.log('Total lines:', lines.length);
    lines.slice(0, 100).forEach((line, i) => {
      if (line.trim()) console.log(`${i}: ${line.trim()}`);
    });

    await parser.destroy();
  } catch (err) {
    console.error('PDF parsing error:', err);
  }
}

run();
