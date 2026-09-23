/**
 * The Pins drawer (Decision 10) and everything it drives: the list, a pin's
 * thread, the composer (Decision 4), the markers (Decision 6) and pin mode.
 *
 * Rendering rule: the two text boxes (reply, composer note) are created once and
 * never replaced. Everything around them is re-rendered from state, so a file
 * change pushed by the server never loses a half-typed reply or note.
 */
import { pageKey } from '../pages.js';
import {
  EVENTS,
  type Anchor,
  type CreateRequest,
  type Operation,
  type Pin,
  type PinRequest,
  type PinsMessage,
  type ReplyRequest,
  type ResultMessage,
} from '../types.js';
import { capture, fileOf } from './capture.js';
import { button, h, icon, kbd, MOD_KEY } from './dom.js';
import {
  baseName,
  clockTime,
  commentsOf,
  countSummary,
  filterPins,
  firstLine,
  latestClaudeComment,
  numberPins,
  relativeTime,
  statusOf,
  type NumberedPin,
} from './model.js';
import { PageLayer, type MarkerSpec } from './page-layer.js';
import { PinMode } from './pin-mode.js';
import { findPinElement } from './refind.js';

type View = 'list' | 'thread' | 'composer';

interface Pending {
  op: Operation;
  id?: string;
  /** For replies: the text as sent, so only that text is cleared on success. */
  text?: string;
}

const OP_FAILED: Record<Operation, string> = {
  create: 'Pin not saved',
  reply: 'Reply not saved',
  done: 'Not marked done',
  delete: 'Pin not deleted',
};

const BAD_PATH = "This page's path can't be used as a pin file name.";

export interface PanelOptions {
  path: string;
  send: (event: string, payload: unknown) => void;
  /** Close the toolbar app (the drawer's own close button). */
  close: () => void;
}

export class PinsPanel {
  readonly drawer: HTMLElement;
  readonly layer: PageLayer;
  private readonly pinMode: PinMode;
  private readonly key: string | null;

  // --- Data -----------------------------------------------------------------
  private pins: Pin[] = [];
  private loaded = false;
  private lastGoodAt: Date | null = null;
  private readError: string | null = null;
  private opError: { title: string; message: string } | null = null;
  /** Re-found elements by pin key (Decision 8). A pin with no entry is lost. */
  private found = new Map<string, Element>();

  // --- UI state -------------------------------------------------------------
  private isOpen = false;
  private showDone = false;
  private view: View = 'list';
  private threadKey: string | null = null;
  private confirmingDelete = false;
  private composer: { el: Element; anchor: Anchor } | null = null;
  private composerRequest: string | null = null;
  private replyRequest: string | null = null;
  private replyDrafts = new Map<string, string>();
  private pending = new Map<string, Pending>();
  private seq = 0;
  private session: AbortController | null = null;
  private markerSig = '';
  private markerEls: Element[] = [];

  // --- Elements -------------------------------------------------------------
  private readonly pinModeBtn: HTMLButtonElement;
  private readonly errorSlot: HTMLDivElement;
  private readonly listView: HTMLElement;
  private readonly threadView: HTMLElement;
  private readonly threadTop: HTMLDivElement;
  private readonly threadBody: HTMLDivElement;
  private readonly threadActions: HTMLDivElement;
  private readonly replyBox: HTMLTextAreaElement;
  private replyBtn: HTMLButtonElement | null = null;
  private readonly composerView: HTMLElement;
  private readonly composerTop: HTMLDivElement;
  private readonly composerBox: HTMLTextAreaElement;
  private readonly saveBtn: HTMLButtonElement;

  constructor(private readonly opts: PanelOptions) {
    this.key = pageKey(opts.path);

    this.layer = new PageLayer({
      onMarkerClick: (id) => this.openThread(id, false),
      onDomChange: () => {
        if (this.refind()) this.render();
        else this.syncLayer();
      },
      drawerLeft: () => (this.isOpen ? this.drawer.getBoundingClientRect().left : innerWidth),
    });

    this.pinMode = new PinMode({
      onHover: (el) => this.layer.setHover(el),
      onPick: (el) => this.pick(el),
    });

    // Header
    this.pinModeBtn = button([icon('pin'), document.createTextNode('Pin mode')], 'cp-btn-pinmode', () => this.setPinMode(!this.pinMode.on), {
      'aria-pressed': 'false',
      title: 'Pin mode: click an element to pin it (Esc leaves)',
    });
    const head = h(
      'header',
      { class: 'cp-head' },
      h('span', { class: 'cp-title', text: 'Pins' }),
      h('span', { class: 'cp-page', text: opts.path, attrs: { title: opts.path } }),
      h('span', { class: 'spacer' }),
      this.pinModeBtn,
      button([icon('close')], 'icon quiet', () => opts.close(), { 'aria-label': 'Close panel', title: 'Close' }),
    );

    this.errorSlot = h('div', { class: 'cp-errors' });

    // List
    this.listView = h('section', { class: 'cp-view cp-view-list' });

    // Thread
    this.threadTop = h('div', { class: 'cp-thread-head' });
    this.threadBody = h('div', { class: 'cp-body' });
    this.replyBox = h('textarea', {
      class: 'cp-textarea',
      attrs: { placeholder: 'Reply…', 'aria-label': 'Reply', rows: '3' },
      on: {
        input: () => this.updateReplyBtn(),
        keydown: (e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            this.sendReply();
          }
        },
      },
    });
    this.threadActions = h('div');
    this.threadView = h(
      'section',
      { class: 'cp-view cp-view-thread', attrs: { hidden: true } },
      this.threadTop,
      this.threadBody,
      h('div', { class: 'cp-foot' }, this.replyBox, this.threadActions),
    );

    // Composer
    this.composerTop = h('div');
    this.composerBox = h('textarea', {
      class: 'cp-textarea',
      attrs: { placeholder: 'What should change here?', 'aria-label': 'Note', rows: '5' },
      on: {
        input: () => this.updateSaveBtn(),
        keydown: (e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            this.savePin();
          }
        },
      },
    });
    this.saveBtn = button('Save pin', 'primary', () => this.savePin(), { disabled: true });
    this.composerView = h(
      'section',
      { class: 'cp-view cp-view-composer', attrs: { hidden: true } },
      this.composerTop,
      h('div', { class: 'cp-composer-body' }, this.composerBox),
      h(
        'div',
        { class: 'cp-foot' },
        h(
          'div',
          { class: 'actions' },
          this.saveBtn,
          h('span', { class: 'cp-hint' }, ...kbd(MOD_KEY, '↵'), ' save · ', ...kbd('Esc'), ' cancel'),
          h('span', { class: 'spacer' }),
          h('span', { class: 'cp-hint', text: 'Pin mode stays on after saving' }),
        ),
      ),
    );

    this.drawer = h(
      'aside',
      { class: 'cp-drawer', attrs: { 'aria-label': 'Pins' } },
      head,
      this.listView,
      this.threadView,
      this.composerView,
    );

    this.render();
  }

  // --- Lifecycle --------------------------------------------------------------

  /** The toolbar app was opened or closed. Markers exist only while open (Decision 6). */
  setOpen(open: boolean): void {
    if (open === this.isOpen) return;
    this.isOpen = open;
    if (open) {
      this.session = new AbortController();
      // The toolbar closes the open app on Escape keyup (on document). Catch it
      // first when Escape means something here: composer, confirm, pin mode.
      window.addEventListener(
        'keyup',
        (e) => {
          if (e.key === 'Escape' && this.handleEscape()) e.stopImmediatePropagation();
        },
        { capture: true, signal: this.session.signal },
      );
      this.layer.start();
      this.refind();
      this.render();
      this.refresh();
    } else {
      this.setPinMode(false);
      this.session?.abort();
      this.session = null;
      this.layer.stop();
    }
  }

  private refresh(): void {
    if (this.key) this.opts.send(EVENTS.list, { path: this.opts.path });
  }

  // --- Server messages --------------------------------------------------------

  onPins(msg: PinsMessage): void {
    if (msg.key !== this.key) return;
    this.loaded = true;
    if (msg.error) {
      this.readError = msg.error; // keep showing the last good list, dimmed
    } else {
      this.readError = null;
      this.pins = Array.isArray(msg.pins) ? msg.pins : [];
      this.lastGoodAt = new Date();
    }
    this.refind();
    this.render();
  }

  onResult(msg: ResultMessage): void {
    if (msg.key !== this.key || !msg.requestId) return;
    const p = this.pending.get(msg.requestId);
    if (!p) return; // another tab's request: results go to every client
    this.pending.delete(msg.requestId);

    if (msg.requestId === this.composerRequest) this.composerRequest = null;
    if (msg.requestId === this.replyRequest) this.replyRequest = null;

    if (!msg.ok) {
      this.opError = { title: OP_FAILED[msg.op], message: msg.error };
      this.render();
      return;
    }
    this.opError = null;
    switch (p.op) {
      case 'create':
        // Written; close the composer. Pin mode stays on (Decision 4).
        this.composer = null;
        this.composerBox.value = '';
        if (this.view === 'composer') this.view = 'list';
        break;
      case 'reply':
        if (this.replyBox.value === p.text && this.threadKey === p.id) this.replyBox.value = '';
        if (p.id) this.replyDrafts.delete(p.id);
        break;
      case 'done':
      case 'delete':
        if (this.view === 'thread' && this.threadKey === p.id) this.showList();
        if (p.op === 'delete' && p.id) this.replyDrafts.delete(p.id);
        break;
    }
    this.render();
  }

  private request(event: string, op: Operation, payload: Record<string, unknown>, extra: Omit<Pending, 'op'> = {}): string {
    const requestId = `cp-${Date.now().toString(36)}-${++this.seq}`;
    this.pending.set(requestId, { op, ...extra });
    this.opts.send(event, { path: this.opts.path, ...payload, requestId });
    return requestId;
  }

  // --- Re-finding + markers ---------------------------------------------------

  private numbered(): NumberedPin[] {
    return numberPins(this.pins);
  }

  /** Decision 8 for every pin. True if any pin's lost-ness changed. */
  private refind(): boolean {
    if (!this.isOpen) return false;
    const before = this.lostSignature();
    const next = new Map<string, Element>();
    for (const { pin, number } of this.numbered()) {
      const el = findPinElement(pin?.anchor);
      if (el) next.set(pinKey(pin, number), el);
    }
    this.found = next;
    return this.lostSignature() !== before;
  }

  private lostSignature(): string {
    return this.numbered()
      .map(({ pin, number }) => (this.found.has(pinKey(pin, number)) ? '' : pinKey(pin, number)))
      .join('|');
  }

  private syncLayer(): void {
    const specs: MarkerSpec[] = [];
    for (const { pin, number } of filterPins(this.numbered(), this.showDone)) {
      const k = pinKey(pin, number);
      const el = this.found.get(k);
      if (el) specs.push({ id: k, number, status: statusOf(pin), el });
    }
    // Rebuild the dots only when something about them changed.
    const sig = specs.map((s) => `${s.id}:${s.number}:${s.status}`).join('|');
    const els = specs.map((s) => s.el);
    if (sig !== this.markerSig || els.some((el, i) => el !== this.markerEls[i])) {
      this.markerSig = sig;
      this.markerEls = els;
      this.layer.setMarkers(specs);
    }
    if (this.view === 'composer' && this.composer) {
      this.layer.setSelected(null);
      this.layer.setOutlined(this.composer.el);
    } else if (this.view === 'thread' && this.threadKey) {
      this.layer.setSelected(this.threadKey);
      this.layer.setOutlined(this.found.get(this.threadKey) ?? null);
    } else {
      this.layer.setSelected(null);
      this.layer.setOutlined(null);
    }
  }

  // --- Actions ----------------------------------------------------------------

  private setPinMode(on: boolean): void {
    if (on && (!this.key || !this.isOpen)) return;
    if (on) this.pinMode.enable();
    else this.pinMode.disable();
    this.pinModeBtn.setAttribute('aria-pressed', String(this.pinMode.on));
  }

  /** Escape, in order: cancel the composer, cancel a delete confirm, leave pin mode. */
  private handleEscape(): boolean {
    if (this.view === 'composer' && this.composer) {
      this.cancelComposer();
      return true;
    }
    if (this.confirmingDelete) {
      this.confirmingDelete = false;
      this.render();
      return true;
    }
    if (this.pinMode.on) {
      this.setPinMode(false);
      return true;
    }
    return false;
  }

  /** Pin mode click: open the composer on this element (or re-pick, keeping the note). */
  private pick(el: Element): void {
    if (!this.key) return;
    this.saveReplyDraft();
    this.composer = { el, anchor: capture(el) };
    this.view = 'composer';
    this.confirmingDelete = false;
    this.render();
    this.composerBox.focus();
  }

  private cancelComposer(): void {
    this.composer = null;
    this.composerRequest = null;
    this.composerBox.value = '';
    this.showList();
    this.render();
  }

  private savePin(): void {
    const text = this.composerBox.value.trim();
    if (!this.composer || !text || this.composerRequest) return; // Decision 4: non-empty only
    this.composerRequest = this.request(EVENTS.create, 'create', { anchor: this.composer.anchor, text } satisfies Omit<CreateRequest, 'path'>);
    this.render();
  }

  private openThread(key: string, scroll: boolean): void {
    if (this.view === 'composer') {
      this.composer = null;
      this.composerRequest = null;
      this.composerBox.value = '';
    }
    this.saveReplyDraft();
    if (this.threadKey !== key) {
      this.replyBox.value = this.replyDrafts.get(key) ?? '';
      this.confirmingDelete = false;
    }
    this.threadKey = key;
    this.view = 'thread';
    this.render();
    if (scroll) this.found.get(key)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  private showList(): void {
    this.saveReplyDraft();
    this.view = 'list';
    this.confirmingDelete = false;
  }

  private saveReplyDraft(): void {
    if (this.view !== 'thread' || !this.threadKey) return;
    if (this.replyBox.value) this.replyDrafts.set(this.threadKey, this.replyBox.value);
    else this.replyDrafts.delete(this.threadKey);
  }

  private currentThread(): NumberedPin | undefined {
    return this.numbered().find(({ pin, number }) => pinKey(pin, number) === this.threadKey);
  }

  private sendReply(): void {
    const entry = this.currentThread();
    const text = this.replyBox.value.trim();
    if (!entry || !hasId(entry.pin) || !text || this.replyRequest) return;
    this.replyRequest = this.request(EVENTS.reply, 'reply', { id: entry.pin.id, text } satisfies Omit<ReplyRequest, 'path'>, {
      id: entry.pin.id,
      text: this.replyBox.value,
    });
    this.render();
  }

  private markDone(pin: Pin): void {
    if (!hasId(pin)) return;
    this.request(EVENTS.done, 'done', { id: pin.id } satisfies Omit<PinRequest, 'path'>, { id: pin.id });
  }

  private deletePin(pin: Pin): void {
    if (!hasId(pin)) return;
    this.request(EVENTS.delete, 'delete', { id: pin.id } satisfies Omit<PinRequest, 'path'>, { id: pin.id });
  }

  private updateReplyBtn(): void {
    if (this.replyBtn) this.replyBtn.disabled = !this.replyBox.value.trim() || Boolean(this.replyRequest) || !this.currentThread();
  }

  private updateSaveBtn(): void {
    this.saveBtn.disabled = !this.composerBox.value.trim() || Boolean(this.composerRequest);
    this.saveBtn.textContent = this.composerRequest ? 'Saving…' : 'Save pin';
  }

  // --- Rendering ----------------------------------------------------------------

  private render(): void {
    this.pinModeBtn.setAttribute('aria-pressed', String(this.pinMode.on));
    this.pinModeBtn.disabled = !this.key;
    this.listView.hidden = this.view !== 'list';
    this.threadView.hidden = this.view !== 'thread';
    this.composerView.hidden = this.view !== 'composer';
    this.renderErrors();
    if (this.view === 'list') this.renderList();
    if (this.view === 'thread') this.renderThread();
    if (this.view === 'composer') this.renderComposer();
    // Error banners: under the subbar in the list (as in the mockup), at the top of the other views.
    if (this.view === 'list') this.listView.insertBefore(this.errorSlot, this.listView.children[1] ?? null);
    else (this.view === 'thread' ? this.threadView : this.composerView).prepend(this.errorSlot);
    if (this.isOpen) this.syncLayer();
  }

  private renderErrors(): void {
    const banners: HTMLElement[] = [];
    if (!this.key) {
      banners.push(errorBanner("Pins can't be saved on this page", BAD_PATH, null, []));
    }
    if (this.readError) {
      const file = `.carapin/${this.key}.json`;
      banners.push(
        errorBanner(
          "Couldn't read the pin file",
          [h('code', { text: file }), " couldn't be read, so nothing is written until it's fixed. The file was left untouched."],
          this.readError,
          [button('Retry', '', () => this.refresh())],
        ),
      );
    }
    if (this.opError) {
      banners.push(
        errorBanner(this.opError.title, this.opError.message, null, [
          button('Dismiss', 'quiet', () => {
            this.opError = null;
            this.render();
          }),
        ]),
      );
    }
    this.errorSlot.replaceChildren(...banners);
  }

  private renderList(): void {
    const all = this.numbered();
    const counts = countSummary(all, this.showDone);
    const shown = filterPins(all, this.showDone);
    const empty = this.loaded && all.length === 0 && !this.readError;

    const toggle = h(
      'button',
      {
        class: 'cp-switch',
        attrs: { type: 'button', role: 'switch', 'aria-checked': String(this.showDone), disabled: all.length === 0 },
        on: {
          click: () => {
            this.showDone = !this.showDone;
            this.render();
          },
        },
      },
      h('span', { class: 'track' }),
      ' Show done',
    );
    const count = h('span', { class: 'count' }, h('b', { text: String(counts.shown) }), counts.shown === 1 ? ' pin' : ' pins');
    if (counts.review) count.append(' · ', h('span', { class: 'review-count', text: `${counts.review} to check` }));
    const subbar = h('div', { class: 'cp-subbar' }, count, h('span', { class: 'spacer' }), toggle);

    const stale =
      this.readError && this.lastGoodAt
        ? h('div', { class: 'cp-stale-note', text: `Showing the last good read from ${clockTime(this.lastGoodAt.toISOString(), new Date())}.` })
        : null;

    const body = h('div', { class: `cp-body${this.readError ? ' is-stale' : ''}` });
    if (!this.loaded) {
      body.append(h('div', { class: 'cp-list-note', text: 'Loading pins…' }));
    } else if (empty) {
      body.append(
        h(
          'div',
          { class: 'cp-empty' },
          h('div', { class: 'glyph', text: '1' }),
          h('h3', { text: 'No pins on this page' }),
          h('p', {}, 'Turn on pin mode, click something, write a sentence. ', ...kbd('Esc'), ' leaves pin mode.'),
          this.key ? button([icon('pin'), document.createTextNode('Start pinning')], 'primary', () => this.setPinMode(true)) : null,
        ),
      );
    } else {
      const now = new Date();
      const list = h('ul', { class: 'cp-list' }, ...shown.map((p) => this.renderRow(p, now)));
      body.append(list);
      if (shown.length === 0 && counts.done > 0) {
        body.append(h('div', { class: 'cp-list-note', text: `${counts.done} done ${counts.done === 1 ? 'pin' : 'pins'} hidden.` }));
      }
    }

    this.listView.replaceChildren(subbar, ...(stale ? [stale] : []), body);
  }

  private renderRow({ pin, number }: NumberedPin, now: Date): HTMLLIElement {
    const k = pinKey(pin, number);
    const status = statusOf(pin);
    const lost = !this.found.has(k);
    const rowStatus = lost ? 'lost' : status;
    const anchor = anchorOf(pin);

    const meta = h('div', { class: 'meta' }, h('span', { class: 'tag', text: anchor.tag || 'element' }));
    if (anchor.text) meta.append(' · ', h('span', { class: 'snippet', text: anchor.text }));
    if (lost || !anchor.text) meta.append(' · ', h('span', { class: 'file', text: anchor.source ?? '(no source location)' }));
    if (status === 'review') {
      const claude = latestClaudeComment(pin);
      const line = claude?.text.split('\n').map((l) => l.trim()).find(Boolean);
      if (line) meta.append(` · Claude: ${line}`);
    }

    const side = h('div', { class: 'side' });
    if (typeof pin.label === 'string' && pin.label) side.append(h('span', { class: 'cp-label', text: pin.label, attrs: { title: `label: ${pin.label}` } }));
    side.append(statusChip(status));
    if (lost) side.append(statusChip('lost'));
    side.append(h('span', { class: 'when', text: relativeTime(pin.updatedAt ?? pin.createdAt, now) }));

    const open = () => this.openThread(k, true);
    return h(
      'li',
      {
        class: 'cp-row',
        attrs: {
          'data-status': rowStatus,
          tabindex: '0',
          role: 'button',
          'aria-label': `Pin ${number}, ${status}${lost ? ', lost' : ''}`,
        },
        on: {
          click: open,
          keydown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              open();
            }
          },
        },
      },
      h('span', { class: 'cp-num', attrs: { 'data-status': rowStatus }, text: String(number) }),
      h('div', { class: 'text' }, h('div', { class: 'note', text: firstLine(pin) || '(no note)' }), meta),
      side,
    );
  }

  private renderThread(): void {
    const entry = this.currentThread();
    const back = button([icon('back'), document.createTextNode('All pins')], 'quiet small', () => {
      this.showList();
      this.render();
    });

    if (!entry) {
      // Removed from the file (by hand, or another tab). Keep any typed reply visible.
      this.threadTop.replaceChildren(h('div', { class: 'nav' }, back));
      this.threadBody.replaceChildren(h('div', { class: 'cp-gone-note', text: "This pin isn't in the pin file any more." }));
      this.replyBox.disabled = true;
      this.threadActions.replaceChildren();
      this.replyBtn = null;
      return;
    }

    const { pin, number } = entry;
    const status = statusOf(pin);
    const lost = !this.found.has(pinKey(pin, number));
    const anchor = anchorOf(pin);

    const nav = h('div', { class: 'nav' }, back, h('span', { class: 'spacer' }));
    if (typeof pin.label === 'string' && pin.label) nav.append(h('span', { class: 'cp-label', text: pin.label }));
    if (lost) nav.append(statusChip('lost'));
    nav.append(statusChip(status));

    const chain = Array.isArray(anchor.sourceChain) ? anchor.sourceChain.filter((s): s is string => typeof s === 'string') : [];
    const grid = h(
      'div',
      { class: 'cp-anchor' },
      h('span', { class: 'k', text: 'element' }),
      h('span', { class: 'v' }, h('span', { class: 'tag', text: anchor.tag || 'element' }), ' ', anchor.text ? h('span', { class: 'text', text: anchor.text }) : null),
      h('span', { class: 'k', text: 'source' }),
      h('span', { class: 'v', text: anchor.source ?? '(no source location)', attrs: { title: anchor.source ?? '' } }),
    );
    if (chain.length) {
      grid.append(h('span', { class: 'k', text: 'in' }), h('span', { class: 'v chain', text: chain.map(baseName).join(' ‹ '), attrs: { title: chain.join(' ‹ ') } }));
    }

    this.threadTop.replaceChildren(
      ...[
      nav,
      h(
        'div',
        { class: 'headline' },
        h('span', { class: 'cp-num', attrs: { 'data-status': lost ? 'lost' : status }, text: String(number) }),
        h('h2', { text: firstLine(pin) || '(no note)' }),
      ),
      grid,
      lost
        ? h('div', {
            class: 'cp-lost-note',
            text: `Lost: nothing on the page matches this pin any more${anchor.source ? ` (was at ${fileOf(anchor.source)})` : ''}. It has no marker.`,
          })
        : null,
      ].filter((n) => n !== null),
    );

    const now = new Date();
    const comments = commentsOf(pin);
    // The comment that put the pin in review: Claude's latest, while it is in review.
    const reviewNote = status === 'review' ? latestClaudeComment(pin) : undefined;
    this.threadBody.replaceChildren(
      h(
        'div',
        { class: 'cp-comments' },
        ...comments.map((c) => {
          const who = c.author === 'claude' ? 'Claude' : c.author === 'human' ? 'You' : String(c.author ?? 'Unknown');
          return h(
            'div',
            { class: 'cp-comment' },
            h('span', { class: 'cp-avatar', attrs: { 'data-author': String(c.author) }, text: who.charAt(0).toUpperCase() }),
            h(
              'div',
              { class: 'text' },
              h(
                'div',
                { class: 'who' },
                h('span', { class: 'name', text: who }),
                h('span', { class: 'when', text: clockTime(c.at, now), attrs: { title: c.at ?? '' } }),
                c === reviewNote ? h('span', { class: 'status-note', text: '→ review' }) : null,
              ),
              h('div', { class: 'body', text: c.text }),
            ),
          );
        }),
      ),
    );

    // Footer: the reply box stays; the action row is rebuilt.
    const canAct = hasId(pin);
    this.replyBox.disabled = !canAct;
    if (this.confirmingDelete) {
      const n = commentsOf(pin).length;
      this.replyBtn = null;
      this.threadActions.replaceChildren(
        h(
          'div',
          { class: 'cp-confirm', attrs: { role: 'alertdialog', 'aria-label': 'Delete pin?' } },
          h('span', { text: `Delete pin ${number} and its ${n} ${n === 1 ? 'comment' : 'comments'}?` }),
          h('span', { class: 'spacer' }),
          button('Keep', 'small', () => {
            this.confirmingDelete = false;
            this.render();
          }),
          button('Delete', 'small danger solid', () => this.deletePin(pin)),
        ),
      );
      return;
    }

    const reopens = status === 'review' || status === 'done';
    this.replyBtn = button(this.replyRequest ? 'Sending…' : 'Reply', 'primary', () => this.sendReply());
    const actions = h(
      'div',
      { class: 'actions' },
      this.replyBtn,
      h('span', { class: 'cp-hint' }, ...kbd(MOD_KEY, '↵'), reopens ? ' · ' : null, reopens ? h('span', { class: 'warm', text: 'reopens the pin' }) : null),
      h('span', { class: 'spacer' }),
    );
    // Decision 3: prominent on review, quieter on open, absent once done.
    if (status !== 'done') {
      actions.append(button([icon('check'), document.createTextNode('Mark done')], status === 'review' ? 'done' : 'quiet', () => this.markDone(pin), { disabled: !canAct }));
    }
    actions.append(
      button(
        [icon('trash')],
        'icon quiet danger',
        () => {
          this.confirmingDelete = true;
          this.render();
        },
        { 'aria-label': 'Delete pin', title: 'Delete pin', disabled: !canAct },
      ),
    );
    this.threadActions.replaceChildren(actions);
    this.updateReplyBtn();
  }

  private renderComposer(): void {
    const c = this.composer;
    if (!c) return;
    const chain = c.anchor.sourceChain.map(baseName);
    this.composerTop.replaceChildren(
      h(
        'div',
        { class: 'cp-thread-head' },
        h(
          'div',
          { class: 'nav' },
          button([icon('back'), document.createTextNode('Cancel')], 'quiet small', () => this.cancelComposer()),
          h('span', { class: 'spacer' }),
          h('span', { class: 'cp-new-pin' }, 'New pin · will be ', h('span', { class: 'num', text: String(this.pins.length + 1) })),
        ),
      ),
      h(
        'div',
        { class: 'cp-picked' },
        h('div', { class: 'row1' }, h('span', { class: 'tag', text: c.anchor.tag }), h('span', { class: 'snippet', text: c.anchor.text })),
        h('div', { class: 'src', text: c.anchor.source ?? '(no source location)' }),
        chain.length ? h('div', { class: 'chain' }, ...chain.map((f) => h('span', { text: f }))) : null,
      ),
    );
    this.updateSaveBtn();
  }
}

// --- Helpers -------------------------------------------------------------------

/** A pin's identity for the UI: its id, or its number if a hand edit dropped the id. */
function pinKey(pin: Pin, number: number): string {
  return hasId(pin) ? pin.id : `#${number}`;
}

function hasId(pin: Pin): boolean {
  return typeof pin?.id === 'string' && pin.id.length > 0;
}

function anchorOf(pin: Pin): Partial<Anchor> {
  return pin?.anchor && typeof pin.anchor === 'object' ? pin.anchor : {};
}

function statusChip(status: string): HTMLSpanElement {
  const chip = h('span', { class: 'cp-chip', attrs: { 'data-status': status } });
  if (status !== 'lost') chip.append(h('span', { class: 'dot' }));
  chip.append(status);
  return chip;
}

function errorBanner(title: string, message: string | Node | (Node | string)[], detail: string | null, actions: HTMLElement[]): HTMLElement {
  const p = h('p');
  if (Array.isArray(message)) p.append(...message);
  else p.append(message);
  return h(
    'div',
    { class: 'cp-error', attrs: { role: 'alert' } },
    icon('alert'),
    h('div', {}, h('h4', { text: title }), p, detail ? h('pre', { text: detail }) : null, actions.length ? h('div', { class: 'actions' }, ...actions) : null),
  );
}
