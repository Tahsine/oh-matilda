import * as mammoth from 'mammoth';
import { extractText, isAvailable } from 'expo-pdf-text-extract';
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
  input: ArrayBuffer | string,
): Promise<ParseResult> {
  const type = getFileType(name);
  if (!type) return { success: false, error: `Format non supporté : ${name}` };

  try {
    if (type === 'pdf') {
      if (typeof input !== 'string') {
        return { success: false, error: 'Le PDF nécessite un chemin de fichier, pas un buffer' };
      }
      if (!isAvailable()) {
        return { success: false, error: 'L\'extraction PDF nécessite un dev build (pas Expo Go)' };
      }
      const text = await extractText(input);
      return { success: true, text };
    }
    return await parseDOCX(input as ArrayBuffer);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    if (type === 'pdf' && msg.includes('password')) {
      return { success: false, error: 'Ce PDF est protégé par mot de passe' };
    }
    return { success: false, error: msg };
  }
}

async function parseDOCX(arrayBuffer: ArrayBuffer): Promise<ParseResult> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { success: true, text: result.value };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erreur de parsing DOCX' };
  }
}
