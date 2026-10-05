import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2 } from '@/lib/icons';
import { saveApiKey, testApiKey, clearApiKey, friendlyLlmError } from '@/lib/ollamaKey';

interface ApiKeyCardProps {
  isOpen: boolean;
  hasKey: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}

// Carte clé en calque INDÉPENDANT (fixed = viewport, pas drawer) :
// centrée par défaut ; champ focusé → posée juste au-dessus du clavier
// (viewport rétréci par adjustResize, ancrage bas). Le drawer garde son
// comportement natif derrière mais masqué (sous-couche opaque + backdrop).
// Jamais de clé complète en log/trace : seuls les 4 derniers caractères
// s'affichent (côté SettingsSheet).
export const ApiKeyCard: React.FC<ApiKeyCardProps> = ({
  isOpen,
  hasKey,
  onClose,
  onToast,
}) => {
  const [keyInput, setKeyInput] = useState<string>('');
  const [testing, setTesting] = useState<boolean>(false);
  // Dernier résultat visible DANS la carte (les toasts passent trop vite).
  const [statusLine, setStatusLine] = useState<string | null>(null);
  // Position = f(hauteur clavier réelle) UNIQUEMENT (pas du focus : Retour
  // ferme le clavier en gardant le focus — la carte resterait en bas sinon).
  // kbHeight > 0 → posée sur le clavier ; 0 → centrée.
  const [kbHeight, setKbHeight] = useState<number>(0);
  // Hauteur clavier native (event `kb-height`, CSS px) : edge-to-edge =
  // clavier overlay sans resize layout ni visualViewport — le natif mesure
  // via visible-frame. 0 = fermé/inconnu → carte centrée.
  const docked = kbHeight > 0;
  useEffect(() => {
    if (!isOpen) {
      setKbHeight(0);
      return;
    }
    const onKb = (e: Event): void => {
      const h = (e as CustomEvent<number>).detail;
      setKbHeight(typeof h === 'number' && h > 0 ? Math.round(h) : 0);
    };
    window.addEventListener('kb-height', onKb);
    return () => {
      window.removeEventListener('kb-height', onKb);
      setKbHeight(0);
    };
  }, [isOpen]);

  // Messages sobres côté UI, détail technique en console uniquement.
  const friendlyError = (e: unknown): string => {
    const raw = e instanceof Error ? e.message : String(e);
    if (/timeout/i.test(raw)) return 'Storage timeout, retry';
    if (/unavailable|unsupported|not found/i.test(raw)) return 'Secure storage unavailable';
    return 'Operation failed, retry';
  };

  useEffect(() => {
    if (isOpen) {
      setKeyInput('');
      setStatusLine(null);
    }
  }, [isOpen]);

  const onSave = async (): Promise<void> => {
    const v = keyInput.trim();
    if (!v) {
      onToast('Enter a key first');
      return;
    }
    try {
      await saveApiKey(v);
      setKeyInput('');
      setStatusLine('Saved ✓');
      onToast('API key saved');
      onClose();
    } catch (e) {
      const msg = friendlyError(e);
      setStatusLine(msg);
      onToast(`Save failed: ${msg}`);
    }
  };

  const onTest = async (): Promise<void> => {
    const typed = keyInput.trim();
    setTesting(true);
    try {
      const ok = await testApiKey(typed || undefined);
      setStatusLine(ok ? 'Key works ✓' : 'Key rejected');
      onToast(ok ? 'Key works' : (typed ? 'Clé saisie rejetée' : 'Clé enregistrée rejetée'));
    } catch (e) {
      const msg = friendlyLlmError(e);
      setStatusLine(msg);
      onToast(`Test failed: ${msg}`);
    } finally {
      setTesting(false);
    }
  };

  const onClearKey = async (): Promise<void> => {
    try {
      await clearApiKey();
      setStatusLine('Key removed');
      onToast('API key removed');
      onClose();
    } catch (e) {
      const msg = friendlyError(e);
      setStatusLine(msg);
      onToast(`Remove failed: ${msg}`);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        // fixed (pas absolute) : indépendant du drawer, relatif au viewport
        // — seule la carte bouge, jamais le drawer. Hauteur clavier mesurée
        // en padding : visible même si le layout ne rétrécit pas.
        <div
          className={`fixed inset-0 z-[65] flex justify-center p-6 overflow-y-auto no-scrollbar ${docked ? 'items-end' : 'items-center'}`}
          style={docked ? { paddingBottom: kbHeight + 12 } : undefined}
        >
          {/* Sous-couche opaque : masque le mouvement du drawer derrière. */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'var(--screen-bg)', opacity: 0.72 }}
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 backdrop-blur-xs cursor-pointer"
            style={{ backgroundColor: 'var(--backdrop)' }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="API key"
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-[340px] p-4 border"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                API key
              </span>
              <button
                onClick={onClose}
                className="w-11 h-11 -m-1.5 rounded-[10px] flex items-center justify-center transition-colors active:bg-[var(--hover)] cursor-pointer"
                style={{ color: 'var(--text-2)' }}
                aria-label="Close"
              >
                <X className="w-4 h-4 stroke-[2.2]" />
              </button>
            </div>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={hasKey ? 'New key (optional)' : 'Paste key…'}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-transparent border outline-none text-[13px] px-2.5 py-2 mb-2"
              style={{
                borderColor: 'var(--card-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-1)',
              }}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => void onSave()}
                className="flex-1 py-2.5 rounded-[10px] text-[13px] font-bold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Save
              </button>
              <button
                onClick={() => void onTest()}
                disabled={testing}
                className="flex-1 py-2.5 rounded-[10px] text-[13px] font-semibold cursor-pointer border disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--hover)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-1)',
                }}
              >
                {testing ? 'Testing…' : 'Test'}
              </button>
              {hasKey && (
                <button
                  onClick={() => void onClearKey()}
                  className="py-2.5 px-3 rounded-[10px] text-[13px] font-semibold cursor-pointer"
                  style={{ color: 'var(--danger)' }}
                  aria-label="Remove API key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            {statusLine && (
              <p className="text-[11px] mt-2 text-center" style={{ color: 'var(--text-2)' }}>
                {statusLine}
              </p>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
