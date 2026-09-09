"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@mandela/ui";

/**
 * NavPill — the sidebar nav with a gliding white pill behind the active
 * item (comp 02's signature interaction, now alive). The pill measures the
 * active link and animates top/height between route changes. Falls back to
 * the static active style for reduced motion.
 */
export function NavPill({
  items,
  className,
}: {
  items: { href: string; label: string; icon?: React.ReactNode }[];
  className?: string;
}) {
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  const activeIndex = items.findIndex((i) => i.href === pathname);

  useLayoutEffect(() => {
    const list = listRef.current;
    const pill = pillRef.current;
    if (!list || !pill) return;
    if (activeIndex < 0) {
      pill.style.opacity = "0";
      return;
    }
    const el = list.children[activeIndex] as HTMLElement | undefined;
    if (!el) return;
    pill.style.opacity = "1";
    pill.style.transform = `translateY(${el.offsetTop}px)`;
    pill.style.height = `${el.offsetHeight}px`;
  }, [activeIndex, pathname, items]);

  return (
    <ul ref={listRef} className={cn("relative", className)}>
      <span
        ref={pillRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 rounded-[10px] bg-white shadow-1 transition-[transform,height,opacity] duration-300 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none"
        style={{ opacity: 0 }}
      />
      {items.map((item, i) => {
        const active = i === activeIndex;
        return (
          <li key={item.href} className="relative">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[44px] items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "text-ink-950" : "text-ink-300 hover:bg-ink-900 hover:text-white",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
