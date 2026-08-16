"use client";

import { useEffect, useSyncExternalStore } from "react";

type Mode = "dark" | "light" | "system";
const ORDER: Mode[] = ["dark", "light", "system"];
const KEY = "aap-theme";

function resolve(mode: Mode): "dark" | "light" {
  if (mode !== "system") return mode;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Tiny external store over localStorage: the storage event only fires in
// other tabs, so same-tab updates notify subscribers manually.
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function getMode(): Mode {
  const s = localStorage.getItem(KEY);
  return s === "light" || s === "system" ? s : "dark";
}
function setMode(mode: Mode) {
  localStorage.setItem(KEY, mode);
  document.documentElement.dataset.theme = resolve(mode);
  listeners.forEach((l) => l());
}

// Cycles dark → light → system. The pre-hydration script in the root layout
// already applied the stored choice, so this only has to keep it in sync.
export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, getMode, () => "dark" as Mode);

  // Follow OS changes live while in system mode.
  useEffect(() => {
    if (mode !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      document.documentElement.dataset.theme = resolve("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];

  return (
    <button
      type="button"
      aria-label={`Theme: ${mode} — switch to ${next}`}
      title={`Theme: ${mode} (click for ${next})`}
      onClick={() => setMode(next)}
      className="rounded p-1.5 text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {mode === "light" ? <SunIcon /> : mode === "system" ? <AutoIcon /> : <MoonIcon />}
    </button>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function AutoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M8 21h8m-4-3v3" />
    </svg>
  );
}
