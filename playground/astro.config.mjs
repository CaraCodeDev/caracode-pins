// @ts-check
import { defineConfig } from 'astro/config';
import pins from '@caracode/pins';

// Port 4358, never Astro's default 4321 (another project lives there).
// A busy port must fail loudly, not drift to 4359.
const PORT = 4358;

export default defineConfig({
  server: { port: PORT },
  vite: { server: { strictPort: true } },
  integrations: [pins()],
});
