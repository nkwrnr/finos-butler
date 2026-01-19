const fs = require('fs');
const pdf = require('pdf-parse');

const pdfPath = process.argv[2] || '/Users/the_machine/app/finance/Statements/Chase/20250128-statements-1627-.pdf';
const dataBuffer = fs.readFileSync(pdfPath);

pdf(dataBuffer).then(function(data) {
  console.log('=== PDF METADATA ===');
  console.log('Pages:', data.numpages);
  console.log('Total chars:', data.text.length);

  console.log('\n=== EXTRACTED TEXT ===');
  console.log(data.text);
}).catch(err => {
  console.error('PDF parsing error:', err.message);
});
