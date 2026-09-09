"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconChevronDown, IconClose } from "@/components/icons";
import { cn } from "@/lib/cn";
import { MOTION_MS, usePresence } from "@/lib/use-presence";

export type AutocompleteOption = {
  value: string;
  label: string;
};

export function Autocomplete({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  className,
  allowClear = false,
  emptyMessage = "No matches",
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  emptyMessage?: string;
  "aria-label"?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const present = usePresence(open, MOTION_MS.popover);
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);
  const [active, setActive] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const selected = options.find((option) => option.value === value);
  const filter = dirty ? query.trim().toLowerCase() : "";
  const filtered = useMemo(
    () =>
      filter
        ? options.filter((option) => option.label.toLowerCase().includes(filter))
        : options,
    [options, filter],
  );

  useEffect(() => {
    setActive((current) =>
      filtered.length ? Math.min(current, filtered.length - 1) : 0,
    );
  }, [filtered.length]);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 240 && rect.top > spaceBelow;
      setMenuStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, filtered.length]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) {
        return;
      }
      close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setDirty(false);
    setQuery("");
  }

  function openList() {
    if (disabled) return;
    setOpen(true);
    setDirty(false);
    setQuery(selected?.label ?? "");
    const index = options.findIndex((option) => option.value === value);
    setActive(index >= 0 ? index : 0);
  }

  function pick(option: AutocompleteOption) {
    onChange(option.value);
    close();
  }

  function clear() {
    onChange("");
    setQuery("");
    setDirty(false);
    inputRef.current?.focus();
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) =>
        filtered.length ? (current + 1) % filtered.length : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) =>
        filtered.length ? (current - 1 + filtered.length) % filtered.length : 0,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[active];
      if (option) pick(option);
    } else if (event.key === "Tab") {
      close();
    }
  }

  const inputValue = open ? query : (selected?.label ?? "");
  const activeId = filtered[active]
    ? `${listId}-option-${filtered[active].value}`
    : undefined;

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <input
        ref={inputRef}
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? activeId : undefined}
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={inputValue}
        onChange={(event) => {
          if (!open) openList();
          setDirty(true);
          setQuery(event.target.value);
          setActive(0);
        }}
        onFocus={() => {
          if (!open) openList();
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "h-10 w-full rounded-[10px] border border-line bg-surface py-0 pr-16 pl-3 text-sm text-ink placeholder:text-muted focus:border-primary disabled:cursor-not-allowed disabled:opacity-45",
        )}
      />
      <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center">
        {allowClear && value ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Clear selection"
            className="pointer-events-auto inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-bg hover:text-ink"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clear}
          >
            <IconClose className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <span className="inline-flex h-8 w-8 items-center justify-center text-muted">
          <IconChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200 ease-out",
              open && "rotate-180",
            )}
          />
        </span>
      </div>
      {present
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              data-state={open ? "open" : "closed"}
              style={menuStyle}
              className={cn(
                "ui-popover z-[70] max-h-60 overflow-auto rounded-[10px] border border-line bg-surface py-1 shadow-md",
                !open && "pointer-events-none",
              )}
            >
              {filtered.length ? (
                filtered.map((option, index) => {
                  const isActive = index === active;
                  const isSelected = option.value === value;
                  return (
                    <li
                      key={option.value}
                      id={`${listId}-option-${option.value}`}
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm",
                        isActive ? "bg-primary-50 text-ink" : "text-ink",
                      )}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pick(option)}
                    >
                      {option.label}
                      {isSelected ? (
                        <IconCheck className="h-4 w-4 shrink-0 text-primary" />
                      ) : null}
                    </li>
                  );
                })
              ) : (
                <li className="px-3 py-2 text-sm text-muted">{emptyMessage}</li>
              )}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
