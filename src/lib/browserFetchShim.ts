// @vercel/blob's client-upload code (src/lib/actions imports it via
// @vercel/blob/client) pulls in the Node-only `undici` package for its HTTP
// client. The package ships its own browser shim (dist/undici-browser.js)
// that just re-exports window.fetch, wired up via the package.json "browser"
// field — but that field is a legacy bundler convention Turbopack doesn't
// reliably honor (unlike Webpack, which @vercel/blob's own comments say is
// the only bundler this trick is verified against). Left unaliased, the real
// (Node-only) `undici` ends up in the browser bundle and the actual upload
// fails with "Failed to execute 'fetch' on 'Window': Invalid value".
//
// next.config.ts's turbopack.resolveAlias forces the same substitution
// explicitly, via this local copy instead of reaching into @vercel/blob's
// own dist/ internals (not a public, version-stable import path).
export const fetch = globalThis.fetch.bind(globalThis);
