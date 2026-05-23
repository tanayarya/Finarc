"use client";

import * as React from "react";
import { MessageCircle, X, Send, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

/** Strip markdown formatting for clean display */
function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold
    .replace(/\*(.*?)\*/g, "$1") // italic
    .replace(/#{1,6}\s/g, "") // headers
    .replace(/`{1,3}(.*?)`{1,3}/gs, "$1") // code
    .replace(/^\s*[-*]\s/gm, "• ") // bullets
    .replace(/^\s*\d+\.\s/gm, "") // numbered lists - remove numbers
    .trim();
}

export function AIChatPopup() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([
    { role: "assistant", content: "Hi! I'm Finarc AI. Ask me anything about your finances." },
  ]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const onSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: cleanMarkdown(json.data.reply) }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: json.error?.message ?? "Something went wrong" }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Failed to connect. Check AI settings." }]);
    } finally {
      setLoading(false);
    }
  };

  const onClear = () => {
    setMessages([{ role: "assistant", content: "Chat cleared. Ask me anything about your finances." }]);
  };

  return (
    <>
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          className="fixed bottom-36 right-4 z-50 h-12 w-12 rounded-full shadow-lg md:bottom-8 md:right-8"
          size="icon"
          aria-label="Open AI chat"
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[500px] w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-xl border bg-background shadow-2xl md:bottom-8 md:right-8">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Finarc AI</p>
              <p className="text-[10px] text-muted-foreground">Ask about your finances</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClear} aria-label="Clear chat">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-3">
            <form onSubmit={(e) => { e.preventDefault(); onSend(); }} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your finances..."
                className="flex-1 h-9"
                disabled={loading}
              />
              <Button type="submit" size="icon" className="h-9 w-9" disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
