// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env?: Record<string, unknown>;
			caches?: CacheStorage & { default: Cache };
			cf?: unknown;
			context?: { waitUntil(p: Promise<unknown>): void };
		}
	}
}

export {};
