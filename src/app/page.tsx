import { unstable_noStore as noStore } from "next/cache";

import { Topbar } from "@/components/chat/topbar"
import { OrderTracker } from "@/components/chat/order-tracker";
import { Chat } from "@/components/chat/chat"
import { ConversationProvider } from "@/components/chat/conversation-context";


export default async function ChatPage() {
  noStore(); // Deshabilitamos el caching para esta página
  return (
    <ConversationProvider>
      <div className="flex bg-[#fffaf0]/60 h-screen">
        <OrderTracker />
        <div className="w-full flex flex-col">
          <Topbar />
          <Chat />
        </div>
      </div>
    </ConversationProvider>
  )
}
