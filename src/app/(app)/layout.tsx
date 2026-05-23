import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MobileFab } from "@/components/layout/mobile-fab";
import { PinGate } from "@/components/auth/pin-gate";
import { AIChatPopup } from "@/components/ai/chat-popup";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PinGate>
      <div className="flex min-h-screen w-full overflow-x-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-24 pt-4 md:px-6 md:pb-8">
            <div className="mx-auto w-full max-w-7xl overflow-x-hidden">{children}</div>
          </main>
          <MobileBottomNav />
          <MobileFab />
        </div>
      </div>
      <AIChatPopup />
    </PinGate>
  );
}
