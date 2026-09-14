import { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle, Send, MessageSquare } from "lucide-react";
import { useT } from "./i18n";

export const ChatTab = ({ messages = [], onMessagesChange, onSend }) => {
  const { t } = useT();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const next = [...messages, { role: "user", content: text }];
    onMessagesChange(next);
    setLoading(true);
    try {
      const reply = await onSend(text, next.slice(-10));
      onMessagesChange([...next, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error("Chat error:", err);
      setError(t("chat.error"));
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="chat-tab">
      <div ref={listRef} className="flex-1 overflow-y-auto p-5 space-y-3" data-testid="chat-messages">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="bg-white/5 p-5 rounded-2xl mb-4">
              <MessageSquare className="w-10 h-10 text-white/30" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">{t("chat.title")}</h4>
            <p className="text-sm text-white/50 max-w-[280px]">{t("chat.sub")}</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                data-testid={`chat-message-${msg.role}`}
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-blue-500 to-emerald-500 text-white rounded-br-sm"
                    : "bg-white/5 border border-white/10 text-white/80 rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start" data-testid="chat-loading">
            <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 rounded-bl-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              <span className="text-sm text-white/60">{t("chat.thinking")}</span>
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm" data-testid="chat-error">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="p-4 bg-black/20 border-t border-white/10 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("chat.placeholder")}
          rows={1}
          style={{ maxHeight: "120px" }}
          data-testid="chat-input"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 resize-none"
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          data-testid="chat-send-btn"
          className="w-11 h-11 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-xl flex items-center justify-center hover:shadow-lg hover:shadow-emerald-500/25 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Send className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
};
