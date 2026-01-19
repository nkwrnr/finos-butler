import db from '../lib/db';
import fs from 'fs';
import path from 'path';

console.log('Creating recurring expense tables...\n');

try {
  // Read schema file
  const schemaPath = path.join(__dirname, '../lib/recurring-expenses/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  // Execute schema
  db.exec(schema);

  console.log('✓ Recurring expense tables created successfully');
  console.log('  - recurring_expenses');
  console.log('  - expense_corrections');
  console.log('  - recurring_anomalies');
  console.log('\nTables are ready for detection.');

} catch (error) {
  console.error('Error creating tables:', error);
  process.exit(1);
}
