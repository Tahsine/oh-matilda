import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AppHeader } from "@/components/AppHeader";
import { KebabMenu } from "@/components/KebabMenu";
import { Toast } from "@/components/Toast";
import { HomeState } from "@/components/HomeState";
import { Composer } from "@/components/Composer";
import { BottomSheet } from "@/components/BottomSheet";
import { MessageItem } from "@/components/MessageItem";
import { DeviceAccessModal } from "@/components/DeviceAccessModal";
import { SettingsSheet } from "@/components/SettingsSheet";
import { ConversationList } from "@/components/ConversationList";
import { ArrowDown } from "@/lib/icons";
import { openAccessibilitySettings } from "@/lib/agentTools";
import { onAgentStopRequest, setStatusBarDark } from "@/lib/agentBridge";
import { useChatStore } from "@/store/chatStore";

function App() {
  const theme = useChatStore((s) => s.theme);
  const toast = useChatStore((s) => s.toast);
  const messages = useChatStore((s) => s.messages);
  const conversations = useChatStore((s) => s.conversations);
  const activeConvId = useChatStore((s) => s.activeConvId);
  const input = useChatStore((s) => s.input);
  const attachments = useChatStore((s) => s.attachments);
  const mode = useChatStore((s) => s.mode);
  const kebabOpen = useChatStore((s) => s.kebabOpen);
  const sheetOpen = useChatStore((s) => s.sheetOpen);
  const accessOpen = useChatStore((s) => s.accessOpen);
  const perms = useChatStore((s) => s.perms);
  const screenshotPreview = useChatStore((s) => s.screenshotPreview);
  const isCapturing = useChatStore((s) => s.isCapturing);
  const captureScreen = useChatStore((s) => s.captureScreen);
  const agentRun = useChatStore((s) => s.agentRun);
  const runHistory = useChatStore((s) => s.runHistory ?? []);
  const cancelAgentTask = useChatStore((s) => s.cancelAgentTask);
  const agentArmed = useChatStore((s) => s.agentArmed);
  const toggleAgentArmed = useChatStore((s) => s.toggleAgentArmed);
  const listOpen = useChatStore((s) => s.listOpen);

  const showToast = useChatStore((s) => s.showToast);
  const setInput = useChatStore((s) => s.setInput);
  const removeAttachment = useChatStore((s) => s.removeAttachment);
  const setMode = useChatStore((s) => s.setMode);
  const toggleTheme = useChatStore((s) => s.toggleTheme);
  const toggleKebab = useChatStore((s) => s.toggleKebab);
  const closeKebab = useChatStore((s) => s.closeKebab);
  const openSheet = useChatStore((s) => s.openSheet);
  const closeSheet = useChatStore((s) => s.closeSheet);
  const openAccess = useChatStore((s) => s.openAccess);
  const closeAccess = useChatStore((s) => s.closeAccess);
  const continueAccess = useChatStore((s) => s.continueAccess);
  const openList = useChatStore((s) => s.openList);
  const closeList = useChatStore((s) => s.closeList);
  const enablePerm = useChatStore((s) => s.enablePerm);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const regenerate = useChatStore((s) => s.regenerate);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const newChat = useChatStore((s) => s.newChat);
  const toggleFav = useChatStore((s) => s.toggleFav);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const deleteConversations = useChatStore((s) => s.deleteConversations);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const prevLenRef = useRef(0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    setStatusBarDark(theme === 'dark');
  }, [theme]);

  // Ligne a11y : ouvre les vrais Réglages Android (l'activation se fait
  // hors app, l'état est resynchronisé à l'ouverture + au retour focus).
  const handleEnablePerm = (perm: "a11y" | "capture") => {
    if (perm === "a11y") {
      if (openAccessibilitySettings()) {
        showToast("Enable Oh-Matilda, then come back");
      } else {
        showToast("Cannot open Settings");
      }
      return;
    }
    enablePerm(perm);
  };

  // Stop notification → kill-switch (même app backgroundée).
  useEffect(() => {
    onAgentStopRequest(() => {
      useChatStore.getState().cancelAgentTask();
    });
  }, []);

  // Resync état service a11y au retour dans l'app (modal ouverte).
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && useChatStore.getState().accessOpen) {
        useChatStore.getState().openAccess();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Hydratation persist : après reload, messages est vide mais activeConvId/conversations sont restaurés
  useEffect(() => {
    if (messages.length === 0 && activeConvId) {
      const conv = conversations.find((c) => c.id === activeConvId);
      if (conv && conv.messages.length > 0) {
        useChatStore.setState({ messages: conv.messages, lastScId: conv.messages.filter((m) => m.sender === "ai").slice(-1)[0]?.scId });
      }
    }
  }, [activeConvId, conversations, messages.length]);

  // Scroll helpers — FAB n'apparaît que si overflow réel et pas en bas
  const updateFabVisibility = () => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 10;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(hasOverflow && distanceFromBottom >= 80);
  };

  const handleScroll = () => {
    updateFabVisibility();
  };

  // Auto-scroll : force systématique sur nouveau message (même depuis le haut), streaming seulement si déjà en bas
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) {
      prevLenRef.current = messages.length;
      setShowScrollBottom(false);
      return;
    }
    const isNewMessage = messages.length > prevLenRef.current;
    // Laisser le DOM se mettre à jour (layout + tokens)
    const doScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const isNearBottom = distanceFromBottom < 80;
      const isOverflow = el.scrollHeight > el.clientHeight + 10;
      if (isNewMessage) {
        el.scrollTop = el.scrollHeight;
        setShowScrollBottom(false);
      } else if (isNearBottom) {
        el.scrollTop = el.scrollHeight;
        setShowScrollBottom(false);
      } else {
        setShowScrollBottom(isOverflow && distanceFromBottom >= 80);
      }
      prevLenRef.current = messages.length;
    };
    requestAnimationFrame(() => setTimeout(doScroll, 30));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, agentRun]);

  // Initial + resize : masquer FAB si pas d'overflow
  useEffect(() => {
    updateFabVisibility();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateFabVisibility());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="flex flex-col h-dvh relative overflow-hidden">
      <AppHeader onOpenSidebar={openList} onToggleKebab={toggleKebab} />

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain px-2.5 pb-1"
        >
          {messages.length === 0 ? (
            <HomeState onSelectPrompt={(p) => sendMessage(p)} />
          ) : (
            <div>
              <div
                className="text-center text-[10.5px] my-2 tracking-widest uppercase opacity-70"
                style={{ color: "var(--text-3)" }}
              >
                {activeConv ? `${activeConv.title} · ${activeConv.time}` : "New chat"}
              </div>
              {messages.map((m) => {
                // Carte run sous le message IA : live si le run tourne,
                // sinon archive permanente (visible des mois après).
                const live = agentRun && agentRun.id === m.runId ? agentRun : null;
                const archived = !live && m.runId
                  ? runHistory.find((r) => r.id === m.runId) ?? null
                  : null;
                return (
                  <MessageItem
                    key={m.id}
                    message={m}
                    onToast={showToast}
                    onRegenerate={regenerate}
                    run={live ?? archived}
                    onCancelRun={cancelAgentTask}
                  />
                );
              })}
            </div>
          )}
        </div>

        <AnimatePresence>
          {showScrollBottom && (
            <motion.button
              key="fab-scroll"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              onClick={() => {
                const el = scrollRef.current;
                if (el) {
                  el.scrollTop = el.scrollHeight;
                  setShowScrollBottom(false);
                }
              }}
              className="absolute right-3.5 bottom-3.5 w-11 h-11 rounded-full border shadow-md flex items-center justify-center z-[15] active:scale-90"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
                color: "var(--text-2)",
              }}
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="w-4 h-4" strokeWidth={2.2} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <Composer
        input={input}
        onChangeInput={setInput}
        attachments={attachments}
        onRemoveAttachment={removeAttachment}
        onOpenSheet={openSheet}
        onSend={() => sendMessage()}
        agentArmed={agentArmed}
      />

      <BottomSheet
        isOpen={sheetOpen}
        onClose={closeSheet}
        mode={mode}
        onChangeMode={setMode}
        agentArmed={agentArmed}
        onToggleAgent={() => {
          toggleAgentArmed();
          closeSheet();
        }}
      />

      <KebabMenu
        isOpen={kebabOpen}
        onClose={closeKebab}
        isDark={theme === "dark"}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAccess={openAccess}
      />

      <DeviceAccessModal
        isOpen={accessOpen}
        onClose={closeAccess}
        perms={perms}
        onEnablePerm={handleEnablePerm}
        onCaptureScreen={captureScreen}
        screenshotPreview={screenshotPreview}
        isCapturing={isCapturing}
        onContinue={continueAccess}
      />

      <SettingsSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onToast={showToast}
      />

      <ConversationList
        isOpen={listOpen}
        onClose={closeList}
        conversations={conversations}
        activeConvId={activeConvId}
        onSelectConversation={selectConversation}
        onToggleFav={toggleFav}
        onDeleteConversation={deleteConversation}
        onDeleteMany={deleteConversations}
        onNewChat={newChat}
      />

      <Toast message={toast} />
    </div>
  );
}

export default App;
