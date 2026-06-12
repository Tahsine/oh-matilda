export type AppError = {
  id: string;
  type: 'search' | 'embedding' | 'parse' | 'agent' | 'network';
  message: string;
  timestamp: number;
  retry?: () => void;
};

let errors: AppError[] = [];
const listeners = new Set<(errors: AppError[]) => void>();

function emit() {
  listeners.forEach((cb) => cb([...errors]));
}

let idCounter = 0;

export function pushError(error: Omit<AppError, 'id' | 'timestamp'>) {
  const entry: AppError = {
    ...error,
    id: `err_${++idCounter}`,
    timestamp: Date.now(),
  };
  errors = [...errors, entry];
  if (errors.length > 5) errors = errors.slice(-5);
  emit();
}

export function dismissError(id: string) {
  errors = errors.filter((e) => e.id !== id);
  emit();
}

export function clearErrors() {
  errors = [];
  emit();
}

export function onErrors(cb: (errors: AppError[]) => void) {
  listeners.add(cb);
  cb([...errors]);
  return () => listeners.delete(cb);
}
