-- Add trust provenance to wallet profiles and make the borrowed-data boundary
-- durable even when a caller bypasses the application adapter. Existing wallet
-- rows start at the conservative, non-promotable state.
ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'borrowed'
    CHECK (origin IN ('first_hand', 'borrowed')),
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'verified'));

ALTER TABLE wallets
  ADD CONSTRAINT wallets_borrowed_cannot_be_verified
    CHECK (origin <> 'borrowed' OR verification_status = 'unverified');

ALTER TABLE wallet_token_edges
  ADD CONSTRAINT wallet_token_edges_borrowed_cannot_be_verified
    CHECK (origin <> 'borrowed' OR verification_status = 'unverified');

ALTER TABLE observations
  ADD CONSTRAINT observations_borrowed_cannot_be_verified
    CHECK (origin <> 'borrowed' OR verification_status = 'unverified');