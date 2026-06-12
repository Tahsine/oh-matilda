import * as FileSystem from 'expo-file-system/legacy';
import { downloadModel } from '@react-native-ai/llama';

export const BGE_M3_REPO = 'bbvch-ai/bge-m3-GGUF/bge-m3-q4_k_m.gguf';

export function getBgeM3Path(): string {
  return (FileSystem.documentDirectory ?? '') + 'llama-models/bge-m3-q4_k_m.gguf';
}

export type DownloadState = {
  status: 'idle' | 'downloading' | 'done' | 'error' | 'skipped';
  progress: number;
  path: string | null;
  error?: string;
};

let state: DownloadState = { status: 'idle', progress: 0, path: null };
const listeners = new Set<(s: DownloadState) => void>();

function emit() {
  listeners.forEach((cb) => cb(state));
}

export function onDownloadState(cb: (s: DownloadState) => void) {
  listeners.add(cb);
  cb(state);
  return () => listeners.delete(cb);
}

export async function isModelReady(): Promise<boolean> {
  try {
    const path = getBgeM3Path();
    console.log('[models] checking path:', path);
    const info = await FileSystem.getInfoAsync(path);
    console.log('[models] getInfoAsync result:', JSON.stringify(info));
    return info.exists;
  } catch (e) {
    console.warn('[models] isModelReady error:', e);
    return false;
  }
}

export async function startDownload(): Promise<void> {
  state = { status: 'downloading', progress: 0, path: null };
  emit();

  try {
    const path = await downloadModel(BGE_M3_REPO, (p) => {
      const fraction = p.totalBytes > 0 ? p.bytesDownloaded / p.totalBytes : 0;
      state = { status: 'downloading', progress: fraction, path: null };
      emit();
    });

    state = { status: 'done', progress: 1, path };
    emit();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur de téléchargement';
    state = { status: 'error', progress: 0, path: null, error: msg };
    emit();
  }
}

export function skipDownload(): void {
  state = { status: 'skipped', progress: 0, path: null };
  emit();
}

export function getModelPath(): string | null {
  return state.path;
}
