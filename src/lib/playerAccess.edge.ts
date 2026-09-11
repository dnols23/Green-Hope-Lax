// The cookie name, on its own.
//
// The proxy runs on the edge runtime and may not import anything that pulls in
// the Supabase service client, so the name lives here and lib/playerAccess
// re-exports it for everyone else.
export const PLAYER_COOKIE = 'gh_player'
