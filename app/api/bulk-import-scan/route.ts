import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import db, { initDatabase } from '@/lib/db';

// Initialize database
initDatabase();

type FolderMapping = {
  path: string;
  institution: string;
  accountType: string;
  goalId: number | null;
  goalName: string | null;
  fileCount: number;
  files: string[];
};

async function scanDirectory(dirPath: string): Promise<FolderMapping[]> {
  const mappings: FolderMapping[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Check if this is a nested directory (like Ally/House)
        const subEntries = await fs.readdir(fullPath, { withFileTypes: true });
        const hasSubdirs = subEntries.some((e) => e.isDirectory());

        if (hasSubdirs) {
          // Scan subdirectories
          for (const subEntry of subEntries) {
            if (subEntry.isDirectory()) {
              const subPath = path.join(fullPath, subEntry.name);
              const files = await getFiles(subPath);

              if (files.length > 0) {
                const mapping = inferMapping(entry.name, subEntry.name, subPath, files);
                mappings.push(mapping);
              }
            }
          }
        } else {
          // Single-level directory
          const files = await getFiles(fullPath);
          if (files.length > 0) {
            const mapping = inferMapping(entry.name, null, fullPath, files);
            mappings.push(mapping);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error scanning directory:', error);
  }

  return mappings;
}

async function getFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && (e.name.endsWith('.csv') || e.name.endsWith('.pdf')))
      .map((e) => path.join(dirPath, e.name));
    return files;
  } catch (error) {
    return [];
  }
}

function inferMapping(
  institution: string,
  subFolder: string | null,
  folderPath: string,
  files: string[]
): FolderMapping {
  let accountType = 'checking';
  let goalId: number | null = null;
  let goalName: string | null = null;

  // Infer institution
  const institutionLower = institution.toLowerCase();

  // Infer account type
  if (
    institutionLower.includes('chase') ||
    institutionLower.includes('gemini') ||
    institutionLower.includes('bilt')
  ) {
    accountType = 'credit_card';
  } else if (institutionLower.includes('ally')) {
    accountType = 'savings';
  }

  // Infer goal from subfolder
  if (subFolder) {
    const subLower = subFolder.toLowerCase();
    if (subLower.includes('house')) {
      const goal = db.prepare('SELECT id, name FROM savings_goals WHERE name = ?').get('House') as
        | { id: number; name: string }
        | undefined;
      if (goal) {
        goalId = goal.id;
        goalName = goal.name;
      }
    } else if (subLower.includes('life')) {
      const goal = db.prepare('SELECT id, name FROM savings_goals WHERE name = ?').get('Life') as
        | { id: number; name: string }
        | undefined;
      if (goal) {
        goalId = goal.id;
        goalName = goal.name;
      }
    }
  }

  return {
    path: folderPath,
    institution,
    accountType,
    goalId,
    goalName,
    fileCount: files.length,
    files,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { statementsPath } = body;

    if (!statementsPath) {
      return NextResponse.json({ error: 'Statements path is required' }, { status: 400 });
    }

    // Verify path exists
    try {
      await fs.access(statementsPath);
    } catch {
      return NextResponse.json({ error: 'Statements path does not exist' }, { status: 400 });
    }

    const mappings = await scanDirectory(statementsPath);

    // Get already imported files
    const imports = db.prepare('SELECT filename FROM imports').all() as Array<{ filename: string }>;
    const importedFiles = new Set(imports.map((i) => i.filename));

    // Filter out already imported files
    const mappingsWithStatus = mappings.map((mapping) => {
      const newFiles = mapping.files.filter(
        (f) => !importedFiles.has(path.basename(f))
      );
      return {
        ...mapping,
        files: newFiles,
        fileCount: newFiles.length,
        alreadyImportedCount: mapping.files.length - newFiles.length,
      };
    });

    return NextResponse.json({ mappings: mappingsWithStatus });
  } catch (error) {
    console.error('Error scanning folders:', error);
    return NextResponse.json(
      { error: `Failed to scan folders: ${error}` },
      { status: 500 }
    );
  }
}
