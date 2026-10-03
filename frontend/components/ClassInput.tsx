"use client";

import { ChevronDown } from "lucide-react";
import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { classOptions } from "@/lib/classes";

/**
 * Class name with a dropdown, grouped by archetype, that filters as you type.
 * Any text is still accepted, so a class added to the game later works too.
 * `onPick` fires when a class is chosen from the list.
 */
export default function ClassInput({
  value,
  onChange,
  onPick,
  onBlur,
  placeholder,
  required,
  label,
  className = "w-44",
}: {
  value: string;
  onChange: (value: string) => void;
  onPick?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  label: string;
  className?: string;
}) {
  // Fixed position under the input, so table overflow can't clip the list.
  const [open, setOpen] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const [active, setActive] = useState(0);
  // Opening shows every class (current one highlighted); typing narrows it.
  const [typing, setTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const groups = classOptions(typing ? value : "");
  const flat = groups.flatMap((g) => g.classes);

  function show() {
    setTyping(false);
    const rect = inputRef.current!.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const current = classOptions("").flatMap((g) => g.classes).findIndex((name) => name.toLowerCase() === value.trim().toLowerCase());
    setActive(Math.max(0, current));
    setOpen({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 208), maxHeight: Math.min(320, Math.max(160, below)) });
  }

  function pick(name: string) {
    onChange(name);
    onPick?.(name);
    setOpen(null);
  }

  // Close when the page scrolls, since the list doesn't follow the input.
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event.target instanceof Element && event.target.id === listId) return;
      setOpen(null);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, listId]);

  // Keep the highlighted class in view (e.g. the current one when the list opens).
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) show();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (flat.length ? (i + step + flat.length) % flat.length : 0));
    } else if (event.key === "Enter" && open && flat[active]) {
      event.preventDefault();
      pick(flat[active]);
    } else if (event.key === "Escape") {
      setOpen(null);
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        value={value}
        required={required}
        placeholder={placeholder}
        aria-label={label}
        role="combobox"
        aria-expanded={Boolean(open)}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        onFocus={show}
        onClick={() => !open && show()}
        onChange={(e) => {
          if (!open) show();
          onChange(e.target.value);
          setTyping(true);
          setActive(0);
        }}
        onKeyDown={handleKey}
        onBlur={() => {
          setOpen(null);
          onBlur?.();
        }}
        className="w-full pr-7"
      />
      <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" />
      {open && flat.length > 0 && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          style={{ top: open.top, left: open.left, width: open.width, maxHeight: open.maxHeight }}
          className="fixed z-40 overflow-y-auto rounded-md border border-border bg-surface py-1 text-sm shadow-lg"
          // Keep focus in the input so blur doesn't close the list before a click lands.
          onMouseDown={(e) => e.preventDefault()}
        >
          {groups.map((group) => (
            <li key={group.archetype} role="presentation">
              <div className="px-3 pb-0.5 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                {group.archetype}
              </div>
              <ul role="presentation">
                {group.classes.map((name) => {
                  const index = flat.indexOf(name);
                  const selected = name.toLowerCase() === value.trim().toLowerCase();
                  return (
                    <li
                      key={name}
                      role="option"
                      aria-selected={selected}
                      data-active={index === active}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => pick(name)}
                      className={`cursor-pointer px-3 py-1 ${index === active ? "bg-surface-2" : ""} ${selected ? "font-medium text-accent" : ""}`}
                    >
                      {name}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
