import { cn } from "@/lib/utils";

export const Skeleton = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "bg-gray-200/80 animate-pulse rounded-sm w-1/2 h-6",
      className
    )}
  />
);
