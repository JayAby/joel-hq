import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// IMPORTANT: base must match your GitHub repo name exactly, e.g. if your
// repo is github.com/yourname/joel-hq, base stays '/joel-hq/'.
// If you rename the repo, update this to match.
export default defineConfig({
    plugins: [react()],
    base: '/joel-hq/',
});
