import db from '@/lib/db';
import fs from 'fs';
import path from 'path';

const schema = fs.readFileSync(
  path.join(__dirname, '../lib/db/migrations/004_agent_insights.sql'),
  'utf-8'
);

db.exec(schema);
console.log('✓ Agent insights tables created successfully');
