# @caracode/pins

An Astro dev-toolbar app for leaving notes on the elements of your site while it runs in `astro dev`. Each note (a pin) is saved as JSON in your repo with the source file and line of the element, so Claude Code can read the pins, make the changes and reply.

It only runs in local dev. It never edits your source code, and it adds nothing to production builds.

## Install

Requires Astro 7 or later and Node 22.12 or later.

### With `astro add`

From your site's folder, run the command for your package manager. It installs the package and adds it to your Astro config in one step.

```bash
pnpm astro add @caracode/pins
```

```bash
npx astro add @caracode/pins
```

```bash
yarn astro add @caracode/pins
```

```bash
bunx astro add @caracode/pins
```

### By hand

Install it as a dev dependency:

```bash
pnpm add -D @caracode/pins
```

```bash
npm install -D @caracode/pins
```

```bash
yarn add -D @caracode/pins
```

```bash
bun add -d @caracode/pins
```

Then add the integration to `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import pins from '@caracode/pins';

export default defineConfig({
  integrations: [pins()],
});
```

There are no options.

### Check it's working

Start the dev server as usual:

```bash
pnpm astro dev
```

A Pins button (a map pin icon) appears in the Astro dev toolbar at the bottom of the page. The first start also writes the Claude Code skill to `.claude/skills/pins/SKILL.md`, and the terminal says so.

### Updating

```bash
pnpm up @caracode/pins
```

The skill updates itself on the next `astro dev` start.

### Removing

Remove `pins()` from `astro.config.mjs`, then uninstall the package:

```bash
pnpm remove @caracode/pins
```

Delete `.carapin/` and `.claude/skills/pins/` too if you don't want to keep your pins or the skill.

## Using it with Claude Code

Open Claude Code in your site's folder and say "work the pins", or type `/pins`. Other things it understands: "check the pins", "what's pinned", "what content fields did I pin?". The skill it uses is written into your repo on dev start, so it works in any session without setup.

## How a pass works

1. Open the site in `astro dev` and click Pins in the dev toolbar.
2. Turn on pin mode and click an element. Type what should change ("make this bigger", "indigo, not blue") and save. Pin mode stays on, so you can pin the next thing straight away. Press Esc to leave it.
3. In Claude Code, in the site's folder, say "work the pins". Claude reads the pin files, finds each element in the source, makes the change, adds a comment on the pin saying what it did, and sets the pin to `review`.
4. Look at each change in the browser. The panel updates on its own when the pin files change.
5. If a change is right, click Mark done. If it isn't, reply on the pin. A reply sets it back to `open`, and the next "work the pins" picks it up with the whole thread.

Each pin moves through three states: `open`, `review` and `done`. Claude never marks a pin done. Done pins are hidden in the panel unless you turn them on.

A pin can also describe content rather than a change, for example "image or video, optional CTA with a URL". This is useful when you're deciding what a CMS should make editable. Claude recognises these notes from the wording, or from a `"label": "content"` field you add to the pin in the file. It skips them when working the pins and lists them when you ask what content fields you pinned.

## The panel

The panel shows the current page's pins. A switch in its header sets where it sits, and your browser remembers the choice:

- **Push** (default): the page narrows to make room, like docked devtools, so nothing is covered. If the window is narrower than 1280px, it overlays on the right instead and says so.
- **Right** or **Left**: the panel sits over the page. While pin mode is on, it tucks into a tab at the edge so you can click anything, and slides back when you pick an element.

Keyboard: ⌘Enter (Ctrl+Enter on Windows and Linux) saves a note or reply. Esc cancels the note you're writing, then leaves pin mode.

Numbered markers show where each pin sits, but only while the panel is open. If an element has been removed or changed so much that the pin can't find it, the pin is marked lost instead of attaching to the wrong element.

Sites using Astro view transitions (`<ClientRouter />`) work too: the panel follows you from page to page.

## What it writes to your repo

- `.carapin/`: one JSON file per page. `/` is `.carapin/index.json` and `/blog/post/` is `.carapin/blog/post.json`. Commit these or ignore them, whichever suits you.
- `.claude/skills/pins/SKILL.md`: a Claude Code skill that explains the pin format and how to work the pins. The dev server writes it on start and updates it when the package changes. If you edit it and delete the marker line near the top, it becomes yours and the package won't overwrite it again.

Nothing else. The dev server writes both only while `astro dev` is running.

## Production builds

In `astro build` and `astro preview` the integration registers nothing. No toolbar app, no `data-pins-src` attributes, no pin data. You can leave it in your config.

## The file format

A pin file looks like this:

```json
{
  "page": "/",
  "pins": [
    {
      "id": "c27c07dc",
      "status": "open",
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

`anchor.source` is the file, line and column of the element. `comments` is the thread, with `author` set to `human` or `claude`. You or Claude can edit the files by hand, with or without the dev server running.

The full contract, including the rules for hand edits, is in the skill: [`skill/SKILL.md`](./skill/SKILL.md).

## Limits

- Astro 7 or later only.
- Dev only. It does nothing outside `astro dev`.
- Source locations come from `.astro` files in your project. Elements rendered by React, Vue, Svelte or other framework components get the location of the nearest `.astro` element around them.
- Content from `.md` and `.mdx` files isn't annotated. You can still pin it, and the pin points at the nearest `.astro` element.
- Files under `node_modules` aren't annotated either.

## License

MIT
