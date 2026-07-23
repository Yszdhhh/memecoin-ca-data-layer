# MACRO-DUNE-PARAMETERIZED-SOLANA-020

## Purpose

This contract fixes the Solana S1-S4 live-query report day without changing the legacy core-query path or activating BSC/Robinhood. Each reviewed private Dune saved query uses the static placeholder `{{report_day}}`; the REST runner supplies exactly one UTC ISO day at execution. No caller can supply SQL or another parameter.

## UTC rule

A request for `reportDay = YYYY-MM-DD` is eligible only at or after **D+1 14:00 UTC**. The same string is supplied as the exact `report_day` execution parameter and every result row must return that exact day. Any disagreement fails closed before aggregate storage or test delivery.

The saved-query SQL must cast the placeholder to a date. It is static SQL and is hashed/verified before execution; the date value is a typed runtime value, not SQL concatenation.

## Delivery rule

Normal use is **manual query, no Feishu send**. An Owner instruction is required for each query. Test-only delivery remains an explicit `sendTestDelivery: true` choice and targets only the runtime-provided test chat. There is no scheduler or automatic delivery path.

## Later live checklist

After this code contract is GREEN, an authorized operator must: create/review the four private S1-S4 saved queries from the static SQL, record their exact IDs/versions/SQL hashes in `macro_query_registry`, configure newly rotated runtime-only `DUNE_API_KEY` and `DATABASE_URL`, and issue a manual Solana query instruction. The first real-data run may use the explicit test-delivery flag; it must not use BSC or Robinhood.