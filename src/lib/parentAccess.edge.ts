// The cookie name, on its own.
//
// The proxy runs on the edge runtime and must not import anything that pulls in
// the Supabase service client, so the name lives here and lib/parentAccess
// re-exports it for everyone else.
export const PARENT_COOKIE = 'gh_parent'
