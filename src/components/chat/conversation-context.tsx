"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ConversationContextValue = {
  conversationId: string | null;
  setConversationId: (id: string) => void;
  clearConversation: () => void;
  orderRefreshToken: number;
  requestOrderRefresh: () => void;
};

const ConversationContext = createContext<ConversationContextValue | null>(
  null,
);

export function ConversationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [conversationId, setConversationIdState] = useState<string | null>(null);
  const [orderRefreshToken, setOrderRefreshToken] = useState(0);

  const setConversationId = useCallback((id: string) => {
    setConversationIdState(id);
  }, []);

  const clearConversation = useCallback(() => {
    setConversationIdState(null);
    setOrderRefreshToken(0);
  }, []);

  const requestOrderRefresh = useCallback(() => {
    setOrderRefreshToken((token) => token + 1);
  }, []);

  const value = useMemo(
    () => ({
      conversationId,
      setConversationId,
      clearConversation,
      orderRefreshToken,
      requestOrderRefresh,
    }),
    [
      conversationId,
      setConversationId,
      clearConversation,
      orderRefreshToken,
      requestOrderRefresh,
    ],
  );

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation() {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error("useConversation must be used within a ConversationProvider");
  }
  return context;
}
