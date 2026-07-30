const SAFE_LIVE_WARNING_CODES = new Set([
  "helius_address_invalid",
  "helius_live_read_unavailable",
  "helius_mint_malformed",
  "helius_request_budget_exhausted",
  "helius_response_malformed",
  "helius_rpc_error",
  "helius_rpc_malformed",
  "helius_runtime_credential_unavailable",
  "helius_timeout",
  "helius_token_account_malformed",
  "helius_token_account_duplicate",
  "helius_token_accounts_malformed",
  "helius_token_accounts_truncated",
  "helius_token_accounts_cursor_stuck",
  "helius_transport_unavailable",
]);

/** Converts any thrown value to a stable public code without echoing its text. */
export function safeSolanaLiveWarning(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (SAFE_LIVE_WARNING_CODES.has(message)) return message;
  if (/^helius_http_[1-5]\d{2}$/.test(message)) return "helius_http_error";
  return "helius_live_read_unavailable";
}
