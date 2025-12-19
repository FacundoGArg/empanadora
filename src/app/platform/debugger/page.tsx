"use client";

import { useChat } from "@ai-sdk/react";
import { useMemo, useState } from "react";

/**
 * /test page: visualizes every message + part that streams through /api/chat.
 * Useful to debug new part types (reasoning, source-url, tool outputs, etc.).
 */
export default function ChatDebugPage() {
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const { messages, sendMessage, status, regenerate, stop } = useChat();
  const serializedStream = useMemo(() => JSON.stringify(messages, null, 2), [messages]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Chat Stream Debug</h1>
          <p className="text-sm text-muted-foreground">
            Messages/parts below are the raw payload coming from <code>/api/chat</code>.
          </p>
        </div>
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span>Status: {status}</span>
          <button
            className="rounded-md border px-3 py-1 text-xs text-foreground disabled:opacity-40"
            disabled={messages.length === 0}
            onClick={async () => {
              await navigator.clipboard.writeText(serializedStream);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied!" : "Copy full stream"}
          </button>
        </div>
      </header>

      <section className="rounded-md border bg-card">
        <form onSubmit={handleSubmit} className="flex gap-2 border-b p-4">
          <input
            className="flex-1 rounded-md border px-3 py-2"
            value={input}
            placeholder="Type a prompt and press Enter"
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-40"
            disabled={!input.trim() || status === "streaming"}
          >
            Send
          </button>
          <button
            type="button"
            onClick={() => regenerate()}
            className="rounded-md border px-4 py-2 disabled:opacity-40"
            disabled={status !== "ready"}
          >
            Regenerate
          </button>
          <button
            type="button"
            onClick={() => stop()}
            className="rounded-md border px-4 py-2 disabled:opacity-40"
            disabled={status !== "streaming"}
          >
            Stop
          </button>
        </form>

        <div className="max-h-[70vh] overflow-auto p-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          )}
          <ul className="space-y-4">
            {messages.map((message) => (
              <li key={message.id} className="rounded-md border p-3">
                <header className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    {message.role.toUpperCase()} · {message.id}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Parts: {message.parts.length}
                  </span>
                </header>
                <ol className="space-y-3">
                  {message.parts.map((part, index) => (
                    <li key={`${message.id}-${index}`} className="rounded bg-muted p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Part #{index + 1}</span>
                        <code className="text-xs">{part.type}</code>
                      </div>
                      <pre className="mt-2 overflow-auto rounded bg-background p-2 text-xs">
                        {JSON.stringify(part, null, 2)}
                      </pre>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
