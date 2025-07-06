import { NextRequest, NextResponse } from 'next/server';
import { CorrectionFeedback } from '@/lib/types';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const correction: CorrectionFeedback = await request.json();
    
    // Save correction to file
    const correctionsPath = path.join(process.cwd(), 'corrections.json');
    let corrections: Record<string, any> = {};
    
    try {
      const data = await fs.readFile(correctionsPath, 'utf-8');
      corrections = JSON.parse(data);
    } catch (error) {
      // File doesn't exist, start with empty object
    }
    
    const key = `${correction.field}_${correction.context.substring(0, 50)}`;
    corrections[key] = {
      ...correction,
      timestamp: new Date().toISOString()
    };
    
    await fs.writeFile(correctionsPath, JSON.stringify(corrections, null, 2));
    
    return NextResponse.json({ success: true, message: 'Correction saved successfully' });
  } catch (error) {
    console.error('Error saving correction:', error);
    return NextResponse.json(
      { error: 'Failed to save correction' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const correctionsPath = path.join(process.cwd(), 'corrections.json');
    
    try {
      const data = await fs.readFile(correctionsPath, 'utf-8');
      const corrections = JSON.parse(data);
      return NextResponse.json(corrections);
    } catch (error) {
      return NextResponse.json({});
    }
  } catch (error) {
    console.error('Error loading corrections:', error);
    return NextResponse.json(
      { error: 'Failed to load corrections' },
      { status: 500 }
    );
  }
} 