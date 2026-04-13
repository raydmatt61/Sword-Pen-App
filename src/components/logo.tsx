
"use client";

import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className)}
    >
      {/* Sword */}
      <path d="M14.5 17.5 3 6l3-3 11.5 11.5" />
      <path d="M13 19l2 2" />
      <path d="M16 16l2 2" />
      
      {/* Pen/Quill */}
      <path d="M10 14 21 3" />
      <path d="M5 19l3-3 2 2-3 3-4 1 1-4 1 1z" />
    </svg>
  );
}
