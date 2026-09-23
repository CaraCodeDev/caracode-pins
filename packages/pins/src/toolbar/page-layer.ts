/**
 * Everything carapin draws over the page: numbered markers (Decision 6), the
 * selected pin's outline, and pin mode's hover outline + label. It all lives in
 * the toolbar canvas's shadow root, a fixed layer that takes no pointer events;
 * only the marker dots do. Hidden with the canvas when the panel closes.
 *
 * While running it keeps positions current: scroll (any scroller, capture),
 * resize, element and document size changes (ResizeObserver), and DOM changes
 * (MutationObserver). All of it is batched into one update per frame. DOM changes
 * also call `onDomChange` so the app can re-find pins (Decision 8).
 */
import { sourceInfo } from './capture.js';
import { h } from './dom.js';
import { placeMarkers, type Box } from './placement.js';

export interface MarkerSpec {
  id: string;
  number: number;
  status: string;
  el: Element;
}

const MARKER_SIZE = 20; // matches --cp-marker-size

export class PageLayer {
  readonly root: HTMLDivElement;
  private markers: MarkerSpec[] = [];
  private buttons = new Map<string, HTMLButtonElement>();
  private selectedId: string | null = null;
  /** The element outlined solid: the selected pin's, or the one picked for the composer. */
  private outlined: Element | null = null;
  private hovered: Element | null = null;
  private readonly selectedBox: HTMLDivElement;
  private readonly hoverBox: HTMLDivElement;
  private readonly hoverLabel: HTMLSpanElement;
  private session: AbortController | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private frame = 0;
  private domChanged = false;

  constructor(
    private readonly opts: {
      onMarkerClick: (id: string) => void;
      onDomChange: () => void;
      /** The horizontal span of the page not covered by the drawer, viewport px. */
      pageArea: () => { left: number; right: number };
    },
  ) {
    this.selectedBox = h('div', { class: 'cp-box cp-box-selected', attrs: { hidden: true } });
    this.hoverLabel = h('span', { class: 'cp-hover-label' });
    this.hoverBox = h('div', { class: 'cp-box cp-box-hover', attrs: { hidden: true } }, this.hoverLabel);
    this.root = h('div', { class: 'cp-layer' }, this.selectedBox, this.hoverBox);
  }

  start(): void {
    if (this.session) return;
    this.session = new AbortController();
    const opts = { capture: true, passive: true, signal: this.session.signal };
    const reposition = () => this.schedule(false);
    window.addEventListener('scroll', reposition, opts);
    window.addEventListener('resize', reposition, opts);
    // Images and fonts finishing load move things after first paint.
    window.addEventListener('load', reposition, opts);
    document.fonts?.addEventListener?.('loadingdone', reposition, { signal: this.session.signal });

    this.resizeObserver = new ResizeObserver(reposition);
    this.observeSizes();
    this.mutationObserver = new MutationObserver(() => this.schedule(true));
    this.mutationObserver.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    this.schedule(false);
  }

  stop(): void {
    this.session?.abort();
    this.session = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.setHover(null);
  }

  /** The markers to show, in pin-number order. Rebuilds the dots. */
  setMarkers(markers: MarkerSpec[]): void {
    this.markers = markers;
    for (const b of this.buttons.values()) b.remove();
    this.buttons.clear();
    for (const m of markers) {
      const b = h('button', {
        class: 'cp-marker',
        text: String(m.number),
        attrs: { type: 'button', 'data-status': m.status, 'aria-label': `Pin ${m.number}, ${m.status}`, hidden: true },
        on: {
          click: (e) => {
            e.stopPropagation();
            this.opts.onMarkerClick(m.id);
          },
        },
      });
      this.buttons.set(m.id, b);
      this.root.append(b);
    }
    this.observeSizes();
    this.applySelected();
    this.schedule(false);
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
    this.applySelected();
    this.schedule(false);
  }

  /** Solid outline on an element (the selected pin's, or the composer's pick). */
  setOutlined(el: Element | null): void {
    this.outlined = el;
    this.schedule(false);
  }

  setHover(el: Element | null): void {
    if (el === this.hovered) return;
    this.hovered = el;
    if (el) {
      const src = sourceInfo(el).source;
      this.hoverLabel.replaceChildren(h('b', { text: el.localName }), src ?? '(no source location)');
    }
    this.schedule(false);
  }

  /** Batch updates into one frame. `dom` = the page's DOM changed (re-find first). */
  schedule(dom: boolean): void {
    if (dom) this.domChanged = true;
    if (this.frame || !this.session) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.domChanged) {
        this.domChanged = false;
        this.opts.onDomChange(); // may call setMarkers, which schedules again
      }
      this.update();
    });
  }

  private applySelected(): void {
    for (const [id, b] of this.buttons) b.classList.toggle('is-selected', id === this.selectedId);
  }

  private observeSizes(): void {
    const ro = this.resizeObserver;
    if (!ro) return;
    ro.disconnect();
    ro.observe(document.documentElement);
    ro.observe(document.body);
    for (const m of this.markers) ro.observe(m.el);
  }

  private visibleArea(): Box {
    const { left, right } = this.opts.pageArea();
    const width = Math.min(document.documentElement.clientWidth || innerWidth, right);
    const height = document.documentElement.clientHeight || innerHeight;
    return { left: Math.max(0, left), top: 0, right: width, bottom: height };
  }

  private update(): void {
    const area = this.visibleArea();
    const positions = placeMarkers(
      this.markers.map((m) => ({ key: m.id, rect: rectOf(m.el) })),
      area,
      MARKER_SIZE,
    );
    for (const [id, b] of this.buttons) {
      const p = positions.get(id);
      b.hidden = !p;
      // Positioned with left/top, not transform: the stylesheet uses transform
      // for the hover / pressed scale, and an inline transform would cancel it.
      if (p) {
        b.style.left = `${p.x}px`;
        b.style.top = `${p.y}px`;
      }
    }
    placeBox(this.selectedBox, this.outlined);
    placeBox(this.hoverBox, this.hovered);
  }
}

/** The element's box, or null if it isn't rendered (detached, display: none). */
function rectOf(el: Element): Box | null {
  if (!el.isConnected || el.getClientRects().length === 0) return null;
  return el.getBoundingClientRect();
}

function placeBox(box: HTMLElement, el: Element | null): void {
  const r = el ? rectOf(el) : null;
  box.hidden = !r;
  if (!r) return;
  Object.assign(box.style, {
    transform: `translate(${r.left}px, ${r.top}px)`,
    width: `${r.right - r.left}px`,
    height: `${r.bottom - r.top}px`,
  });
}
