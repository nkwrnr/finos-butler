import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    // Verify auth PIN
    const authPin = request.headers.get('x-auth-pin');
    const expectedPin = process.env.AUTH_PIN || '0926';

    if (!authPin || authPin !== expectedPin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the database file from request body
    const contentType = request.headers.get('content-type') || '';

    let fileBuffer: Buffer;

    if (contentType.includes('multipart/form-data')) {
      // Handle form data upload
      const formData = await request.formData();
      const file = formData.get('database') as File | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No database file provided' },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } else {
      // Handle raw binary upload
      const arrayBuffer = await request.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    }

    if (fileBuffer.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Empty file received' },
        { status: 400 }
      );
    }

    // Verify it's a SQLite file (magic bytes: "SQLite format 3\0")
    const sqliteMagic = 'SQLite format 3\0';
    const fileHeader = fileBuffer.slice(0, 16).toString('utf8');

    if (!fileHeader.startsWith('SQLite format 3')) {
      return NextResponse.json(
        { success: false, error: 'Invalid SQLite database file' },
        { status: 400 }
      );
    }

    // Determine database path
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'finance.db');
    const dbDir = path.dirname(dbPath);

    // Create directory if it doesn't exist
    await mkdir(dbDir, { recursive: true });

    // Write the database file
    await writeFile(dbPath, fileBuffer);

    return NextResponse.json({
      success: true,
      message: 'Database uploaded successfully',
      path: dbPath,
      size: fileBuffer.length,
    });
  } catch (error) {
    console.error('Database upload error:', error);
    return NextResponse.json(
      { success: false, error: `Upload failed: ${error}` },
      { status: 500 }
    );
  }
}
