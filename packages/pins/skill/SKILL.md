---
name: pins
description: Read and act on carapin pins, the notes left on page elements in an Astro site's dev toolbar and stored in .carapin/*.json. Use when asked to "work the pins", "check the pins", "what's pinned", or anything about pins, pinned notes, content pins or the .carapin folder.
---

# carapin pins

Pins are notes the developer left on elements of the running site. You make the change in the code, reply on the pin, and hand it back for review.

## The file

One JSON file per page at `.carapin/<page key>.json` under the site root (the folder with `astro.config.*`). `/` is `index.json`, `/blog/post/` is `blog/post.json`.

```json
{
  "page": "/",
  "pins": [
    {
      "id": "c27c07dc",
      "status": "open",
      "label": "content",
      "createdAt": "2026-09-23T16:23:06.990Z",
      "updatedAt": "2026-09-23T16:23:06.990Z",
      "anchor": {
        "source": "src/components/FeatureCard.astro:17:5",
        "sourceChain": ["src/components/FeatureCard.astro", "src/pages/index.astro"],
        "selector": "body > main > section > div:nth-child(2) > h3",
        "text": "Traded directly with growers",
        "tag": "h3"
      },
      "comments": [
        { "author": "human", "text": "Make this bigger", "at": "2026-09-23T16:23:06.990Z" }
      ]
    }
  ]
}
```

- `status` is `open`, `review` or `done`. `label` is optional (for example `content`).
- `anchor.source` is `file:line:col` of the nearest component element, or null. `sourceChain` lists the files from the inside out. `selector` picks out the one instance that was clicked.
- `author` is `human` (the developer, via the panel) or `claude` (you).

Lifecycle: the developer creates a pin (`open`). You make the change and set `review`. They check it and mark it `done`. If they reply to a `review` or `done` pin, the panel sets it back to `open`. You never set `done`.

## Work the pins

1. Read every `.carapin/**/*.json`. Take pins with `status: "open"` whose last comment has `author: "human"`. Say how many there are before you start. Skip the rest; an open pin whose last comment is yours is waiting on them.
2. Skip content pins (see below) and list them at the end.
3. For each remaining pin, read the whole thread for context. The latest human comment is the instruction.
4. Open the file in `anchor.source`. The line may have moved since the pin was made, so find the element by `anchor.tag` and `anchor.text` near that line.
5. By default, change the component at `anchor.source`, so every instance changes. Narrow it only if the note says so ("just this one", "only on the homepage"); `anchor.selector` and `sourceChain` tell you which instance and which page.
6. Make the change. Then edit the pin: append `{ "author": "claude", "text": "...", "at": "<now>" }` saying what you changed with `file:line`, set `status` to `"review"`, and set `updatedAt` to the same time.
7. If the note is ambiguous, or asks for something beyond a code change, don't guess. Append a claude comment asking your question, set `updatedAt`, and leave the pin `open`.
8. End with a short summary: pins moved to review, pins with a question, content pins skipped.

Comments are shown as plain text, not Markdown. Keep them to a sentence or two, for example: `Changed the button background to royal blue (#2b4acb) in src/pages/index.astro:64.`

## Content pins

A pin labelled `content`, or whose note describes editable fields ("image or video, optional CTA with URL"), is input for a CMS conversation, not a code change. Don't implement it. When asked about them ("what content fields did I pin?"), group them by page and then by section, quote each note, and cite `anchor.source`. Don't choose a CMS or write a schema unless asked.

## Editing the file by hand

Edit the JSON directly; the dev server doesn't need to be running (if it is, the panel updates on its own).

- 2-space indent and a trailing newline, as `JSON.stringify(file, null, 2)` writes it.
- Keep the existing key order and any fields you don't recognise. New keys go at the end of the pin.
- Don't reorder, renumber or delete pins. The panel numbers pins by their position in the file.
- Timestamps are ISO 8601 in UTC, like `2026-09-23T16:23:06.990Z`.
