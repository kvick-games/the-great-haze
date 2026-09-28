// Tiny DOM helpers.

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string | number | null): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = String(text);
  return e;
}

export function add<T extends Node>(parent: T, ...kids: (Node | null | undefined | false)[]): T {
  for (const k of kids) if (k) parent.appendChild(k);
  return parent;
}

export function svg(markup: string, cls = "ico"): HTMLElement {
  const s = document.createElement("span");
  s.className = cls;
  s.innerHTML = markup;
  return s;
}

const I = (d: string) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICONS: Record<string, string> = {
  rations: I('<path d="M8 4h8l-1 3c3 2 4 5 4 8a7 5 0 0 1-14 0c0-3 1-6 4-8z"/><path d="M9 7h6"/>'),
  torches: I('<path d="M12 21v-8"/><path d="M9 13h6"/><path d="M12 3c2 3 4 4 4 7a4 4 0 0 1-8 0c0-2 1-3 2-4 0 1 1 2 2 2 0-2-1-3 0-5z"/>'),
  ammo: I('<path d="M9 21V10c0-3 1.5-6 3-7 1.5 1 3 4 3 7v11z"/><path d="M9 17h6"/>'),
  medicine: I('<path d="M9 3h6v3l2 3v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9l2-3z"/><path d="M12 12v5M9.5 14.5h5"/>'),
  spares: I('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4v6M12 14v6M4 12h6M14 12h6"/>'),
  veils: I('<path d="M4 8c5-3 11-3 16 0v4c0 4-4 8-8 8s-8-4-8-8z"/><path d="M8 12h8"/>'),
  rockets: I('<path d="M12 2c3 3 4 7 3 12H9C8 9 9 5 12 2z"/><path d="M9 14l-3 4h4M15 14l3 4h-4M11 18l1 4 1-4"/>'),
  scrip: I('<circle cx="12" cy="12" r="8"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5 1-2.5 2s1 1.7 2.5 2 2.5 1 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5v11"/>'),
  wagons: I('<path d="M4 14V9c0-3 3.5-5 8-5s8 2 8 5v5z"/><circle cx="7" cy="18" r="2.4"/><circle cx="17" cy="18" r="2.4"/>'),
  sound: I('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
  mute: I('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  camera: I('<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>'),
};
