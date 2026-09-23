/**
 * The panel's stylesheet, injected into the toolbar canvas's shadow root.
 * Tokens (`--cp-*`) are lifted from notes/mockups/m2-panel.html. Phase 3 does the
 * visual pass; this file is where it happens.
 *
 * Differences from the mockup, on purpose:
 * - No web fonts are loaded (the product makes no network requests). The font
 *   stacks keep the mockup's names first, so installed copies are used.
 * - The z-index tokens sit just below Astro's toolbar bar (z-index 2000000010),
 *   so the toolbar stays clickable over the drawer on narrow windows. The
 *   mockup's values (2147483000/…100) would cover it.
 * - Markers, the hover outline and the selected-element outline are boxes in
 *   this shadow root positioned over the page, not classes on page elements:
 *   carapin adds nothing to the page's own DOM.
 */
export const STYLES = /* css */ `
:host {
  /* Spacing scale (px) */
  --cp-space-1: 2px;
  --cp-space-2: 4px;
  --cp-space-3: 6px;
  --cp-space-4: 8px;
  --cp-space-5: 12px;
  --cp-space-6: 16px;
  --cp-space-7: 20px;
  --cp-space-8: 24px;
  --cp-space-9: 32px;

  /* Type */
  --cp-font-ui: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --cp-font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --cp-text-xs: 11px;
  --cp-text-sm: 12px;
  --cp-text-md: 13px;
  --cp-text-lg: 14px;
  --cp-leading-tight: 1.25;
  --cp-leading-body: 1.45;
  --cp-tracking-caps: 0.04em;

  /* Surfaces */
  --cp-bg-0: #0e1014;
  --cp-bg-1: #14171d;
  --cp-bg-2: #1b1f27;
  --cp-bg-3: #232833;
  --cp-line-1: #21252e;
  --cp-line-2: #2f3541;
  --cp-line-3: #414958;

  /* Text */
  --cp-fg-0: #e9ebf0;
  --cp-fg-1: #a3a9b7;
  --cp-fg-2: #6c7386;
  --cp-fg-inverse: #0e1014;

  /* Interaction */
  --cp-accent: #8ab4f8;
  --cp-accent-soft: rgba(138,180,248,.16);
  --cp-focus-ring: 0 0 0 2px var(--cp-bg-0), 0 0 0 4px var(--cp-accent);

  /* Status */
  --cp-open: #6aa5f7;
  --cp-open-soft: rgba(106,165,247,.14);
  --cp-open-text: #a9c8fb;

  --cp-review: #f5b84a;
  --cp-review-soft: rgba(245,184,74,.14);
  --cp-review-text: #f7cf85;
  --cp-review-glow: 0 0 0 3px rgba(245,184,74,.28);

  --cp-done: #57c48a;
  --cp-done-soft: rgba(87,196,138,.12);
  --cp-done-text: #8fdcb2;

  --cp-lost: #6c7386;
  --cp-lost-soft: rgba(108,115,134,.12);

  --cp-danger: #f07178;
  --cp-danger-soft: rgba(240,113,120,.14);

  /* Radii */
  --cp-radius-1: 3px;
  --cp-radius-2: 6px;
  --cp-radius-3: 10px;
  --cp-radius-full: 999px;

  /* Shadows */
  --cp-shadow-drawer: -12px 0 32px rgba(0,0,0,.35);
  --cp-shadow-marker: 0 1px 2px rgba(0,0,0,.5), 0 0 0 2px rgba(255,255,255,.85);

  /* Layout */
  --cp-drawer-width: 400px;
  --cp-marker-size: 20px;
  --cp-z-markers: 2000000000;   /* above the page, below the toolbar bar */
  --cp-z-drawer: 2000000005;
}

*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }

/* ---------- Page layer: markers, hover and selection outlines ---------- */
.cp-layer { position: fixed; inset: 0; pointer-events: none; z-index: var(--cp-z-markers); -webkit-font-smoothing: antialiased; }
/* Positioned by inline left/top (page-layer.ts); transform is kept for the hover / pressed scale. */
.cp-marker {
  position: fixed; left: 0; top: 0;
  width: var(--cp-marker-size); height: var(--cp-marker-size);
  padding: 0; border: 0; margin: 0;
  border-radius: var(--cp-radius-full);
  font: 500 11px/1 var(--cp-font-mono);
  display: grid; place-items: center;
  cursor: pointer; user-select: none;
  color: var(--cp-fg-inverse);
  box-shadow: var(--cp-shadow-marker);
  pointer-events: auto;              /* only the dot takes clicks, never the layer */
  transition: transform .08s ease;
}
.cp-marker:hover { transform: scale(1.12); }
.cp-marker:active { transform: scale(1.0); }
.cp-marker:focus-visible { outline: none; box-shadow: var(--cp-shadow-marker), var(--cp-focus-ring); }
.cp-marker[data-status="open"]   { background: var(--cp-open); }
.cp-marker[data-status="review"] { background: var(--cp-review); box-shadow: var(--cp-shadow-marker), var(--cp-review-glow); }
.cp-marker[data-status="done"]   { background: #fff; color: var(--cp-done); box-shadow: 0 1px 2px rgba(0,0,0,.4), inset 0 0 0 2px var(--cp-done); }
.cp-marker:not([data-status="open"]):not([data-status="review"]):not([data-status="done"]) { background: var(--cp-fg-1); }
.cp-marker.is-selected { box-shadow: var(--cp-shadow-marker), 0 0 0 3px var(--cp-accent); }

.cp-box { position: fixed; left: 0; top: 0; pointer-events: none; border-radius: 4px; }
.cp-box-selected { outline: 2px solid var(--cp-accent); outline-offset: 3px; }
.cp-box-hover { outline: 2px dashed var(--cp-accent); outline-offset: 3px; }
.cp-hover-label {
  position: absolute; left: 0; top: 100%; margin-top: 8px;
  padding: 4px 8px; border-radius: var(--cp-radius-2);
  background: var(--cp-bg-1); color: var(--cp-fg-1);
  font: 400 var(--cp-text-xs)/1.3 var(--cp-font-mono);
  border: 1px solid var(--cp-line-2); white-space: nowrap;
  box-shadow: 0 6px 16px rgba(0,0,0,.3);
}
.cp-hover-label b { font-weight: 500; color: var(--cp-fg-0); margin-right: 8px; }

/* ---------- Drawer ---------- */
.cp-drawer {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: var(--cp-drawer-width); max-width: 100vw;
  background: var(--cp-bg-0); color: var(--cp-fg-0);
  font: 400 var(--cp-text-md)/var(--cp-leading-body) var(--cp-font-ui);
  border-left: 1px solid var(--cp-line-1);
  box-shadow: var(--cp-shadow-drawer);
  display: flex; flex-direction: column;
  z-index: var(--cp-z-drawer);
  -webkit-font-smoothing: antialiased;
  text-align: left;
  color-scheme: dark;                /* native scrollbars, caret and textarea chrome match the drawer */
}
.cp-drawer *:focus-visible { outline: none; box-shadow: var(--cp-focus-ring); }
.cp-drawer code { font: 400 11px var(--cp-font-mono); color: var(--cp-fg-0); }

.cp-head {
  display: flex; align-items: center; gap: var(--cp-space-4);
  height: 48px; padding: 0 var(--cp-space-5) 0 var(--cp-space-6);
  background: var(--cp-bg-1); border-bottom: 1px solid var(--cp-line-1);
  flex: none;
}
.cp-title { font-size: var(--cp-text-lg); font-weight: 600; letter-spacing: -0.01em; }
.cp-page { font: 400 var(--cp-text-xs)/1 var(--cp-font-mono); color: var(--cp-fg-2); padding: 3px 6px; border: 1px solid var(--cp-line-2); border-radius: var(--cp-radius-1); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.spacer { flex: 1; }

.cp-btn {
  appearance: none; font: 500 var(--cp-text-sm)/1 var(--cp-font-ui);
  display: inline-flex; align-items: center; gap: 6px;
  height: 28px; padding: 0 10px; border-radius: var(--cp-radius-2);
  background: transparent; color: var(--cp-fg-1);
  border: 1px solid var(--cp-line-2); cursor: pointer;
  transition: background .08s ease, border-color .08s ease, color .08s ease;
  white-space: nowrap;
}
.cp-btn svg { width: 14px; height: 14px; }
.cp-btn:hover { background: var(--cp-bg-2); border-color: var(--cp-line-3); color: var(--cp-fg-0); }
.cp-btn:active { background: var(--cp-bg-3); }
.cp-btn[aria-pressed="true"] { background: var(--cp-accent-soft); border-color: var(--cp-accent); color: var(--cp-accent); }
.cp-btn[aria-pressed="true"]:hover { background: rgba(138,180,248,.24); border-color: var(--cp-accent); color: var(--cp-accent); }
.cp-btn[aria-pressed="true"]:active { background: rgba(138,180,248,.32); }
.cp-btn.primary { background: var(--cp-fg-0); color: var(--cp-fg-inverse); border-color: var(--cp-fg-0); }
.cp-btn.primary:hover { background: #fff; border-color: #fff; }
.cp-btn.primary:active { background: #d7dae2; border-color: #d7dae2; }
.cp-btn.done { background: var(--cp-done-soft); border-color: rgba(87,196,138,.4); color: var(--cp-done-text); }
.cp-btn.done:hover { background: rgba(87,196,138,.22); border-color: var(--cp-done); color: #c6f0d9; }
.cp-btn.danger { color: var(--cp-danger); }
.cp-btn.danger:hover { background: var(--cp-danger-soft); border-color: rgba(240,113,120,.45); color: var(--cp-danger); }
.cp-btn.danger.solid { background: var(--cp-danger); border-color: var(--cp-danger); color: var(--cp-fg-inverse); }
.cp-btn.danger.solid:hover { background: #f58a90; border-color: #f58a90; }
.cp-btn.quiet { border-color: transparent; color: var(--cp-fg-2); }
.cp-btn.quiet:hover { border-color: transparent; color: var(--cp-fg-0); }
.cp-btn.icon { width: 28px; padding: 0; justify-content: center; }
.cp-btn.small { height: 24px; padding: 0 8px; font-size: var(--cp-text-xs); }
.cp-btn:disabled { opacity: .45; cursor: default; }
.cp-btn:disabled:hover { background: transparent; border-color: var(--cp-line-2); color: var(--cp-fg-1); }
.cp-btn.primary:disabled:hover { background: var(--cp-fg-0); border-color: var(--cp-fg-0); color: var(--cp-fg-inverse); }

.cp-subbar {
  display: flex; align-items: center; gap: var(--cp-space-4);
  padding: var(--cp-space-4) var(--cp-space-5) var(--cp-space-4) var(--cp-space-6);
  border-bottom: 1px solid var(--cp-line-1); flex: none;
  color: var(--cp-fg-2); font-size: var(--cp-text-sm);
}
.cp-subbar .count { color: var(--cp-fg-1); }
.cp-subbar .count b { color: var(--cp-fg-0); font-weight: 600; }
.cp-subbar .review-count { color: var(--cp-review-text); }

.cp-switch {
  appearance: none; background: none; border: 0; font: inherit;
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;
  color: var(--cp-fg-2); font-size: var(--cp-text-sm); padding: 2px 4px; border-radius: var(--cp-radius-2);
}
.cp-switch:hover { color: var(--cp-fg-1); }
.cp-switch:hover .track { border-color: var(--cp-line-3); }
.cp-switch:active .track::after { transform: scaleX(1.15); transform-origin: left center; }
.cp-switch[aria-checked="true"]:active .track::after { transform: translateX(11px) scaleX(1.15); transform-origin: right center; }
.cp-switch:disabled { opacity: .5; cursor: default; }
.cp-switch:disabled:hover { color: var(--cp-fg-2); }
.cp-switch:disabled:hover .track { border-color: var(--cp-line-2); }
.cp-switch .track {
  width: 26px; height: 15px; border-radius: 999px; background: var(--cp-bg-3);
  border: 1px solid var(--cp-line-2); position: relative; transition: background .1s ease;
}
.cp-switch .track::after {
  content: ""; position: absolute; top: 1px; left: 1px; width: 11px; height: 11px; border-radius: 50%;
  background: var(--cp-fg-1); transition: transform .12s ease, background .1s ease;
}
.cp-switch[aria-checked="true"] { color: var(--cp-fg-0); }
.cp-switch[aria-checked="true"] .track { background: var(--cp-done-soft); border-color: rgba(87,196,138,.5); }
.cp-switch[aria-checked="true"] .track::after { transform: translateX(11px); background: var(--cp-done); }

.cp-view { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.cp-body { flex: 1; overflow: auto; min-height: 0; scrollbar-width: thin; scrollbar-color: var(--cp-line-3) transparent; }

.cp-list { list-style: none; margin: 0; padding: var(--cp-space-2) 0; }
.cp-row {
  display: grid; grid-template-columns: 24px 1fr auto; column-gap: var(--cp-space-4);
  align-items: start; padding: var(--cp-space-4) var(--cp-space-5) var(--cp-space-4) var(--cp-space-6);
  cursor: pointer; border-left: 2px solid transparent;
  transition: background .06s ease;
}
.cp-row:hover { background: var(--cp-bg-2); }
.cp-row:active { background: var(--cp-bg-3); }
.cp-row:focus-visible { box-shadow: inset var(--cp-focus-ring); }
.cp-row.is-selected { background: var(--cp-bg-2); border-left-color: var(--cp-accent); }
.cp-row[data-status="review"] { border-left-color: var(--cp-review); }
.cp-row[data-status="review"].is-selected { border-left-color: var(--cp-accent); }
.cp-row .text { min-width: 0; }
.cp-row .note {
  color: var(--cp-fg-0); font-weight: 500; line-height: var(--cp-leading-tight);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 3px;
}
.cp-row[data-status="done"] .note { color: var(--cp-fg-1); font-weight: 400; }
.cp-row .meta {
  margin-top: 3px; font-size: var(--cp-text-xs); color: var(--cp-fg-2);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cp-row .meta .tag { font-family: var(--cp-font-mono); color: var(--cp-fg-1); }
.cp-row .meta .snippet::before { content: "\\201C"; }
.cp-row .meta .snippet::after { content: "\\201D"; }
.cp-row .meta .file { font-family: var(--cp-font-mono); }
.cp-row .side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; padding-top: 2px; }
.cp-row .side .when { font-size: var(--cp-text-xs); color: var(--cp-fg-2); font-variant-numeric: tabular-nums; }
.cp-row[data-status="lost"] .note { color: var(--cp-fg-1); }
.cp-row[data-status="lost"] .meta { color: var(--cp-fg-2); }
.cp-row[data-status="lost"]:hover .note { color: var(--cp-fg-0); }
.cp-list-note { padding: var(--cp-space-6); color: var(--cp-fg-2); font-size: var(--cp-text-sm); text-align: center; }

.cp-num {
  width: 20px; height: 20px; border-radius: var(--cp-radius-full);
  font: 500 11px/1 var(--cp-font-mono); display: grid; place-items: center; flex: none;
  color: var(--cp-fg-inverse); background: var(--cp-fg-1);
}
.cp-num[data-status="open"]   { background: var(--cp-open); }
.cp-num[data-status="review"] { background: var(--cp-review); box-shadow: var(--cp-review-glow); }
.cp-num[data-status="done"]   { background: transparent; color: var(--cp-done); box-shadow: inset 0 0 0 1.5px var(--cp-done); }
.cp-num[data-status="lost"]   { background: transparent; color: var(--cp-lost); border: 1.5px dashed var(--cp-lost); }

.cp-chip {
  display: inline-flex; align-items: center; gap: 5px; height: 18px; padding: 0 7px;
  border-radius: var(--cp-radius-1); font-size: var(--cp-text-xs); font-weight: 500;
  letter-spacing: var(--cp-tracking-caps); text-transform: uppercase; line-height: 1;
  background: var(--cp-bg-3); color: var(--cp-fg-1);
}
.cp-chip[data-status="open"]   { background: var(--cp-open-soft); color: var(--cp-open-text); }
.cp-chip[data-status="review"] { background: var(--cp-review-soft); color: var(--cp-review-text); }
.cp-chip[data-status="done"]   { background: var(--cp-done-soft); color: var(--cp-done-text); }
.cp-chip[data-status="lost"]   { background: var(--cp-lost-soft); color: var(--cp-fg-2); border: 1px dashed var(--cp-line-3); }
.cp-chip .dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.cp-label {
  display: inline-block; height: 18px; padding: 0 6px; line-height: 17px; border-radius: var(--cp-radius-1);
  font: 500 var(--cp-text-xs)/17px var(--cp-font-mono); color: var(--cp-fg-1);
  background: var(--cp-bg-3); border: 1px solid var(--cp-line-2);
}

.cp-empty { padding: var(--cp-space-9) var(--cp-space-8); text-align: center; color: var(--cp-fg-2); }
.cp-empty .glyph {
  width: 40px; height: 40px; margin: 0 auto var(--cp-space-6); border-radius: 50%;
  border: 1.5px dashed var(--cp-line-3); display: grid; place-items: center; color: var(--cp-fg-2);
  font: 500 14px/1 var(--cp-font-mono);
}
.cp-empty h3 { margin: 0 0 var(--cp-space-3); font-size: var(--cp-text-lg); font-weight: 500; color: var(--cp-fg-0); }
.cp-empty p { margin: 0 auto var(--cp-space-7); font-size: var(--cp-text-md); max-width: 30ch; }
.cp-empty kbd { font: 500 var(--cp-text-xs)/1 var(--cp-font-mono); color: var(--cp-fg-1); background: var(--cp-bg-3); border: 1px solid var(--cp-line-2); border-radius: var(--cp-radius-1); padding: 2px 5px; }

.cp-thread-head { padding: var(--cp-space-4) var(--cp-space-5) var(--cp-space-5) var(--cp-space-6); border-bottom: 1px solid var(--cp-line-1); flex: none; }
.cp-thread-head .nav { display: flex; align-items: center; gap: var(--cp-space-3); margin-bottom: var(--cp-space-5); margin-left: -6px; }
.cp-thread-head .headline { display: flex; align-items: center; gap: var(--cp-space-4); margin-bottom: var(--cp-space-4); }
.cp-thread-head .headline .cp-num { width: 22px; height: 22px; font-size: 12px; }
.cp-thread-head .headline h2 { margin: 0; font-size: var(--cp-text-lg); font-weight: 600; letter-spacing: -0.01em; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--cp-fg-0); }
.cp-anchor {
  display: grid; grid-template-columns: auto 1fr; column-gap: var(--cp-space-4); row-gap: 3px;
  font-size: var(--cp-text-xs); color: var(--cp-fg-2); align-items: baseline;
}
.cp-anchor .k { color: var(--cp-fg-2); }
.cp-anchor .v { color: var(--cp-fg-1); font-family: var(--cp-font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-anchor .v .tag { color: var(--cp-accent); }
.cp-anchor .v .text { font-family: var(--cp-font-ui); }
.cp-anchor .v .text::before { content: "\\201C"; }
.cp-anchor .v .text::after { content: "\\201D"; }
.cp-anchor .v.chain { color: var(--cp-fg-2); }
.cp-lost-note { margin-top: var(--cp-space-4); font-size: var(--cp-text-xs); color: var(--cp-fg-1); }
.cp-gone-note { padding: var(--cp-space-6); color: var(--cp-fg-1); font-size: var(--cp-text-sm); }

.cp-comments { padding: var(--cp-space-5) var(--cp-space-5) var(--cp-space-5) var(--cp-space-6); display: flex; flex-direction: column; gap: var(--cp-space-5); }
.cp-comment { display: grid; grid-template-columns: 22px 1fr; column-gap: var(--cp-space-4); }
.cp-avatar {
  width: 22px; height: 22px; border-radius: var(--cp-radius-full); display: grid; place-items: center;
  font: 600 10px/1 var(--cp-font-ui); letter-spacing: .02em;
  background: var(--cp-bg-3); color: var(--cp-fg-1); border: 1px solid var(--cp-line-2);
}
.cp-avatar[data-author="claude"] { background: #d9c7b6; color: #3a2a1c; border-color: transparent; }
.cp-comment .text { min-width: 0; }
.cp-comment .who { display: flex; align-items: baseline; gap: var(--cp-space-4); margin-bottom: 3px; }
.cp-comment .who .name { font-weight: 600; font-size: var(--cp-text-sm); color: var(--cp-fg-0); }
.cp-comment .who .when { font-size: var(--cp-text-xs); color: var(--cp-fg-2); }
.cp-comment .who .status-note { font-size: var(--cp-text-xs); color: var(--cp-review-text); margin-left: auto; white-space: nowrap; }
.cp-comment .body { color: var(--cp-fg-0); white-space: pre-wrap; overflow-wrap: anywhere; }
.cp-comment .body code { font: 400 12px/1.4 var(--cp-font-mono); color: var(--cp-fg-1); background: var(--cp-bg-2); padding: 1px 4px; border-radius: var(--cp-radius-1); }

.cp-foot {
  flex: none; border-top: 1px solid var(--cp-line-1); background: var(--cp-bg-1);
  padding: var(--cp-space-5) var(--cp-space-5) var(--cp-space-5) var(--cp-space-6);
}
.cp-textarea {
  width: 100%; resize: none; display: block; margin: 0;
  font: 400 var(--cp-text-md)/var(--cp-leading-body) var(--cp-font-ui);
  color: var(--cp-fg-0); background: var(--cp-bg-2);
  border: 1px solid var(--cp-line-2); border-radius: var(--cp-radius-2);
  padding: var(--cp-space-4) var(--cp-space-5); min-height: 64px;
}
.cp-textarea::placeholder { color: var(--cp-fg-2); }
.cp-textarea:hover { border-color: var(--cp-line-3); }
.cp-textarea:focus { border-color: var(--cp-accent); box-shadow: 0 0 0 3px var(--cp-accent-soft); outline: none; }
.cp-textarea:disabled { opacity: .6; }
.cp-foot .actions { display: flex; align-items: center; gap: var(--cp-space-4); margin-top: var(--cp-space-4); }
.cp-hint { font-size: var(--cp-text-xs); color: var(--cp-fg-2); }
.cp-hint kbd { font: 500 10px/1 var(--cp-font-mono); color: var(--cp-fg-1); background: var(--cp-bg-3); border: 1px solid var(--cp-line-2); border-radius: var(--cp-radius-1); padding: 2px 4px; margin: 0 1px; }
.cp-hint .warm { color: var(--cp-review-text); }

.cp-confirm {
  display: flex; align-items: center; gap: var(--cp-space-4); margin-top: var(--cp-space-4);
  padding: var(--cp-space-4) var(--cp-space-5); border-radius: var(--cp-radius-2);
  background: var(--cp-danger-soft); border: 1px solid rgba(240,113,120,.35);
  font-size: var(--cp-text-sm); color: var(--cp-fg-0);
}

.cp-picked {
  margin: var(--cp-space-5) var(--cp-space-5) 0 var(--cp-space-6);
  padding: var(--cp-space-5); border-radius: var(--cp-radius-3);
  background: var(--cp-bg-1); border: 1px solid var(--cp-line-2);
}
.cp-picked .row1 { display: flex; align-items: center; gap: var(--cp-space-4); margin-bottom: var(--cp-space-3); }
.cp-picked .tag { font: 500 var(--cp-text-sm)/1 var(--cp-font-mono); color: var(--cp-accent); background: var(--cp-accent-soft); padding: 4px 6px; border-radius: var(--cp-radius-1); }
.cp-picked .snippet { color: var(--cp-fg-0); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.cp-picked .snippet:not(:empty)::before { content: "\\201C"; color: var(--cp-fg-2); }
.cp-picked .snippet:not(:empty)::after { content: "\\201D"; color: var(--cp-fg-2); }
.cp-picked .src { font: 400 var(--cp-text-xs)/1.4 var(--cp-font-mono); color: var(--cp-fg-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-picked .chain { font: 400 var(--cp-text-xs)/1.4 var(--cp-font-mono); color: var(--cp-fg-2); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-picked .chain span + span::before { content: " \\2039 "; color: var(--cp-line-3); }
.cp-view-composer .cp-thread-head { padding-bottom: var(--cp-space-4); }
.cp-view-composer .cp-thread-head .nav { margin-bottom: 0; }
.cp-new-pin { font-size: var(--cp-text-sm); color: var(--cp-fg-2); white-space: nowrap; }
.cp-new-pin .num { font-family: var(--cp-font-mono); color: var(--cp-fg-1); }
.cp-composer-body { padding: var(--cp-space-5) var(--cp-space-5) 0 var(--cp-space-6); }
.cp-composer-body .cp-textarea { min-height: 112px; }
.cp-view-composer .cp-foot { margin-top: auto; }
.cp-view-composer .cp-foot .actions { margin-top: 0; }

.cp-error {
  margin: var(--cp-space-5) var(--cp-space-5) 0 var(--cp-space-6);
  padding: var(--cp-space-5); border-radius: var(--cp-radius-3);
  background: var(--cp-danger-soft); border: 1px solid rgba(240,113,120,.35);
  display: grid; grid-template-columns: 16px 1fr; column-gap: var(--cp-space-4);
  flex: none;
}
.cp-error svg { width: 16px; height: 16px; color: var(--cp-danger); margin-top: 1px; }
.cp-error h4 { margin: 0 0 3px; font-size: var(--cp-text-md); font-weight: 600; color: var(--cp-fg-0); }
.cp-error p { margin: 0 0 var(--cp-space-4); font-size: var(--cp-text-sm); color: var(--cp-fg-1); }
.cp-error pre {
  margin: 0 0 var(--cp-space-4); padding: var(--cp-space-4); border-radius: var(--cp-radius-2);
  background: var(--cp-bg-0); border: 1px solid var(--cp-line-2);
  font: 400 var(--cp-text-xs)/1.5 var(--cp-font-mono); color: var(--cp-fg-1); white-space: pre-wrap; overflow: hidden;
}
.cp-errors { flex: none; }
.cp-error .actions { display: flex; gap: var(--cp-space-4); align-items: center; }
.cp-body.is-stale .cp-list { opacity: .35; pointer-events: none; }
.cp-stale-note { padding: var(--cp-space-4) var(--cp-space-6) 0; font-size: var(--cp-text-xs); color: var(--cp-fg-2); flex: none; }

@media (prefers-reduced-motion: reduce) {
  .cp-marker, .cp-btn, .cp-row, .cp-switch .track, .cp-switch .track::after { transition: none; }
}
`;
