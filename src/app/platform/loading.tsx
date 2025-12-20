import { Skeleton } from "@/components/chat/skeleton";

export default function PlatformLoading() {
  return (
    <main className="min-h-screen bg-[#fffaf0]/60p-4 sm:p-6 lg:p-8">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </section>
    </main>
  );
}
