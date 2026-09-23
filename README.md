# caracode-pins

Source for [`@caracode/pins`](./packages/pins), an Astro dev-toolbar app for leaving notes on elements of your site in local dev. Pins are saved as JSON with the element's source file and line, and a bundled Claude Code skill works through them.

Install and usage are in the [package README](./packages/pins/README.md).

## Repo layout

- `packages/pins/`: the published package.
- `playground/`: a small Astro site used to develop and test it. Runs on port 4358.
- `notes/`: the product spec, the milestone plan and the build log for each milestone.

## Development

```bash
pnpm install
pnpm dev
```

`pnpm dev` builds the package, watches it, and serves the playground at http://localhost:4358. Toolbar code doesn't hot-reload; refresh the browser after a change.

```bash
pnpm test
pnpm -r typecheck
pnpm -r build
```

## License

MIT
