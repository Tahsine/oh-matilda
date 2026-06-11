import * as mammoth from 'mammoth';
import { inflate } from 'pako';
import type { FileType } from './types';

export type ParseResult =
  | { success: true; text: string }
  | { success: false; error: string };

function getFileType(name: string): FileType | null {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx' || ext === 'doc') return 'docx';
  return null;
}

export async function parseDocument(
  name: string,
  arrayBuffer: ArrayBuffer,
): Promise<ParseResult> {
  const type = getFileType(name);
  if (!type) return { success: false, error: `Format non supporté : ${name}` };

  try {
    if (type === 'pdf') {
      return extractPDFText(new Uint8Array(arrayBuffer));
    }
    return await parseDOCX(arrayBuffer);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

// --- PDF Text Extraction ---
// Lightweight Hermes-compatible replacement for pdfjs-dist.
// Handles FlateDecode-compressed streams via pako.

function extractPDFText(bytes: Uint8Array): ParseResult {
  const pages: string[] = [];
  let searchFrom = 0;

  while (searchFrom < bytes.length) {
    const streamIdx = findPattern(bytes, [0x73, 0x74, 0x72, 0x65, 0x61, 0x6D], searchFrom);
    if (streamIdx === -1) break;

    const endIdx = findPattern(
      bytes,
      [0x65, 0x6E, 0x64, 0x73, 0x74, 0x72, 0x65, 0x61, 0x6D],
      streamIdx + 6,
    );
    if (endIdx === -1) break;

    let contentStart = streamIdx + 6;
    while (contentStart < endIdx && (bytes[contentStart] === 0x0A || bytes[contentStart] === 0x0D)) {
      contentStart++;
    }

    let contentEnd = endIdx;
    while (contentEnd > contentStart && (bytes[contentEnd - 1] === 0x0A || bytes[contentEnd - 1] === 0x0D)) {
      contentEnd--;
    }

    if (contentEnd > contentStart) {
      const raw = bytes.slice(contentStart, contentEnd);

      let decoded: string;
      try {
        decoded = new TextDecoder('utf-8', { fatal: false }).decode(inflate(raw));
      } catch {
        decoded = new TextDecoder('utf-8', { fatal: false }).decode(raw);
      }

      const text = extractTextOperators(decoded);
      if (text.trim()) {
        pages.push(text.trim());
      }
    }

    searchFrom = endIdx + 9;
  }

  if (pages.length === 0) {
    return { success: false, error: 'Aucun texte trouvé dans le PDF' };
  }

  return { success: true, text: pages.join('\n\n') };
}

function extractTextOperators(content: string): string {
  const parts: string[] = [];

  const tjRE = /\(([^)]*)\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tjRE.exec(content)) !== null) {
    parts.push(unescapePDFString(m[1]));
  }

  const tjArrayRE = /\[([^\]]*)\]\s*TJ/g;
  while ((m = tjArrayRE.exec(content)) !== null) {
    const innerRE = /\(([^)]*)\)/g;
    let im: RegExpExecArray | null;
    while ((im = innerRE.exec(m[1])) !== null) {
      parts.push(unescapePDFString(im[1]));
    }
  }

  return parts.join(' ');
}

function unescapePDFString(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\([0-7]{1,3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\(.)/g, '$1');
}

function findPattern(bytes: Uint8Array, pattern: number[], start: number): number {
  for (let i = start; i <= bytes.length - pattern.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (bytes[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

// --- DOCX Parsing ---

async function parseDOCX(arrayBuffer: ArrayBuffer): Promise<ParseResult> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { success: true, text: result.value };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erreur de parsing DOCX' };
  }
}
