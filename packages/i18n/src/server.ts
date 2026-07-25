// Server-only entry point - import from "@bawi/i18n/server", never from the
// main "@bawi/i18n" barrel, so Client Component bundles never pull in
// next/headers or the "server-only" guard.
export { getLocale } from "./get-locale"
