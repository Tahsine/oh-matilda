import * as FileSystem from 'expo-file-system/legacy';
import { downloadModel } from '@react-native-ai/llama';
import i18n from './i18n';

// Minimum file sizes (80% of expected) to detect partial / interrupted downloads
const BGE3_MIN_BYTES = 350_400_000;
const GEMMA4_MIN_BYTES = 1_752_000_000;
const MMPROJ_MIN_BYTES = 788_800_000;

export const BGE_M3_REPO = 'bbvch-ai/bge-m3-GGUF/bge-m3-q4_k_m.gguf';

export function getBgeM3Path(): string {
  return (FileSystem.documentDirectory ?? '') + 'llama-models/bge-m3-q4_k_m.gguf';
}

async function isFileValid(filePath: string, minBytes: number): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists) return false;
    const size = (info as any).size as number | undefined;
    if (size !== undefined && size > 0 && size < minBytes) {
      console.warn(`[models] partial/corrupt file detected: ${filePath} (${size} bytes < ${minBytes} min), deleting`);
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      return false;
    }
    return true;
  } catch {
    return false;
  }
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
  return () => { listeners.delete(cb); };
}

export async function isModelReady(): Promise<boolean> {
  return isFileValid(getBgeM3Path(), BGE3_MIN_BYTES);
}

export async function startDownload(): Promise<void> {
  console.log('[models] startDownload BGE-M3');

  if (await isModelReady()) {
    console.log('[models] BGE-M3 already ready, skipping');
    state = { status: 'done', progress: 1, path: getBgeM3Path() };
    emit();
    return;
  }

  state = { status: 'downloading', progress: 0, path: null };
  emit();

  try {
    await removePartialFile(getBgeM3Path());

    const path = await downloadModel(BGE_M3_REPO, (p) => {
      const fraction = p.percentage / 100;
      console.log('[models] BGE-M3 progress:', Math.round(fraction * 100), '%');
      state = { status: 'downloading', progress: fraction, path: null };
      emit();
    });

    console.log('[models] BGE-M3 download complete:', path);
    state = { status: 'done', progress: 1, path };
    emit();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : i18n.t('errors.downloadError');
    console.error('[models] BGE-M3 download error:', msg);
    state = { status: 'error', progress: 0, path: null, error: msg };
    emit();
  }
}

export async function retryDownload(): Promise<void> {
  console.log('[models] retryDownload BGE-M3');
  await startDownload();
}

export function skipDownload(): void {
  state = { status: 'skipped', progress: 0, path: null };
  emit();
}

export function getModelPath(): string | null {
  return state.path;
}

async function removePartialFile(filePath: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) {
      console.log('[models] removing partial file:', filePath, 'size:', (info as any).size || 'unknown');
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      console.log('[models] partial file removed');
    }
  } catch (e) {
    console.warn('[models] failed to remove partial file:', e);
  }
}

// ── Gemma 4 ──────────────────────────────────────────────

export const GEMMA4_REPO =
  'unsloth/gemma-4-E2B-it-qat-mobile-GGUF/gemma-4-E2B-it-qat-UD-Q2_K_XL.gguf';
export const MMPROJ_REPO =
  'unsloth/gemma-4-E2B-it-qat-mobile-GGUF/mmproj-F16.gguf';

export function getGemma4Path(): string {
  return (
    (FileSystem.documentDirectory ?? '') +
    'llama-models/gemma-4-E2B-it-qat-UD-Q2_K_XL.gguf'
  );
}

export function getMmprojPath(): string {
  return (
    (FileSystem.documentDirectory ?? '') + 'llama-models/mmproj-F16.gguf'
  );
}

let gemma4State: DownloadState = {
  status: 'idle',
  progress: 0,
  path: null,
};
const gemma4Listeners = new Set<(s: DownloadState) => void>();

function emitGemma4() {
  gemma4Listeners.forEach((cb) => cb(gemma4State));
}

export function onGemma4DownloadState(cb: (s: DownloadState) => void) {
  gemma4Listeners.add(cb);
  cb(gemma4State);
  return () => { gemma4Listeners.delete(cb); };
}

export async function isGemma4Ready(): Promise<boolean> {
  return isFileValid(getGemma4Path(), GEMMA4_MIN_BYTES);
}

export async function isMmprojReady(): Promise<boolean> {
  return isFileValid(getMmprojPath(), MMPROJ_MIN_BYTES);
}

export function skipGemma4Download(): void {
  gemma4State = { status: 'skipped', progress: 0, path: null };
  emitGemma4();
}

function getHfDownloadUrl(modelId: string): string {
  const parts = modelId.split('/');
  const filename = parts.pop()!;
  const repo = parts.join('/');
  return `https://huggingface.co/${repo}/resolve/main/${filename}?download=true`;
}

async function downloadWithResume(
  modelId: string,
  destPath: string,
  onProgress: (fraction: number) => void,
): Promise<string> {
  const url = getHfDownloadUrl(modelId);

  const callback: FileSystem.FileSystemNetworkTaskProgressCallback<FileSystem.DownloadProgressData> = (dl) => {
    const fraction =
      dl.totalBytesExpectedToWrite > 0
        ? dl.totalBytesWritten / dl.totalBytesExpectedToWrite
        : 0;
    onProgress(fraction);
  };

  const dlResumable = FileSystem.createDownloadResumable(url, destPath, {}, callback);
  const result = await dlResumable.downloadAsync();
  if (!result) throw new Error(i18n.t('errors.downloadCancelled'));
  console.log('[models] downloadWithResume done:', result.uri);
  return result.uri;
}

export async function startGemma4Download(): Promise<void> {
  console.log('[models] startGemma4Download');

  const g4Ready = await isGemma4Ready();
  const mpReady = await isMmprojReady();
  if (g4Ready && mpReady) {
    console.log('[models] Gemma 4 already ready, skipping');
    gemma4State = { status: 'done', progress: 1, path: getGemma4Path() };
    emitGemma4();
    return;
  }

  gemma4State = { status: 'downloading', progress: 0, path: null };
  emitGemma4();

  try {
    await removePartialFile(getGemma4Path());
    await removePartialFile(getMmprojPath());

    console.log('[models] downloading Gemma 4 main model (2.19 GB) with resume...');
    const path = await downloadWithResume(GEMMA4_REPO, getGemma4Path(), (fraction) => {
      console.log('[models] Gemma 4 main progress:', Math.round(fraction * 100), '%');
      gemma4State = {
        status: 'downloading',
        progress: fraction * 0.9,
        path: null,
      };
      emitGemma4();
    });

    console.log('[models] Gemma 4 main model done, downloading mmproj (986 MB) with resume...');
    await downloadWithResume(MMPROJ_REPO, getMmprojPath(), (fraction) => {
      console.log('[models] mmproj progress:', Math.round(fraction * 100), '%');
      gemma4State = {
        status: 'downloading',
        progress: 0.9 + fraction * 0.1,
        path: null,
      };
      emitGemma4();
    });

    console.log('[models] Gemma 4 download complete');
    gemma4State = { status: 'done', progress: 1, path };
    emitGemma4();
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : i18n.t('errors.gemma4DownloadError');
    console.error('[models] Gemma 4 download error:', msg);
    gemma4State = { status: 'error', progress: 0, path: null, error: msg };
    emitGemma4();
  }
}

export async function retryGemma4Download(): Promise<void> {
  console.log('[models] retryGemma4Download');
  await startGemma4Download();
}
