import { unstable_noStore as noStore } from "next/cache";

import { Topbar } from "@/components/chat/topbar"
import { OrderTracker } from "@/components/chat/order-tracker";
import { Chat } from "@/components/chat/chat"
import { ConversationProvider } from "@/components/chat/conversation-context";


export default async function ChatPage() {
  noStore(); // Deshabilitamos el caching para esta página
  return (
    <ConversationProvider>
      <div className="flex min-h-screen flex-col bg-[#fffaf0]/60 sm:flex-row">
        <OrderTracker />
        <div className="flex w-full flex-col">
          <Topbar />
          <Chat />
        </div>
      </div>
    </ConversationProvider>
  )
}
