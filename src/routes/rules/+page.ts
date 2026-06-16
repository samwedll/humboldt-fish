// Static reference: rules come entirely from bundled config, no live data.
// Prerendering makes the route a static asset the service worker can precache
// for the no-signal "fish in hand" case. Params are read client-side.
export const prerender = true;
