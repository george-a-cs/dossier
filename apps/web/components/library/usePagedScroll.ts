"use client";

import { useEffect, useRef, type RefObject } from "react";

export function usePagedScroll(
  rootRef: RefObject<HTMLElement | null>,
  page: number,
  onPage: (page: number) => void,
  ready = true,
) {
  const origin = useRef<"scroll" | "jump" | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !ready) return;
    let frame = 0;

    function sync() {
      if (!root || origin.current === "jump") return;
      const nodes = root.querySelectorAll<HTMLElement>("[data-page]");
      if (!nodes.length) return;
      const anchor = root.getBoundingClientRect().top + Math.min(160, root.clientHeight * 0.25);
      let best = page;
      let bestDelta = Infinity;
      nodes.forEach((node) => {
        const number = Number(node.dataset.page);
        if (!number) return;
        const delta = Math.abs(node.getBoundingClientRect().top - anchor);
        if (delta < bestDelta) {
          bestDelta = delta;
          best = number;
        }
      });
      if (best !== page) {
        origin.current = "scroll";
        onPage(best);
      }
    }

    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    }

    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("scroll", onScroll);
    };
  }, [rootRef, page, onPage, ready]);

  useEffect(() => {
    if (!ready) return;
    if (origin.current === "scroll") {
      origin.current = null;
      return;
    }
    const root = rootRef.current;
    const target = root?.querySelector<HTMLElement>(`[data-page="${page}"]`);
    if (!root || !target) return;
    origin.current = "jump";
    const top = root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top;
    root.scrollTo({ top: Math.max(0, top) });
    const unlock = () => {
      origin.current = null;
    };
    root.addEventListener("scrollend", unlock, { once: true });
    const timer = window.setTimeout(unlock, 400);
    return () => {
      root.removeEventListener("scrollend", unlock);
      window.clearTimeout(timer);
    };
  }, [rootRef, page, ready]);
}
