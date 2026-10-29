# Media Tracker — first version

Routes: `/media-tracker/jobs`, `/media-tracker/campaigns`, `/media-tracker/payments`.
Each record opens a dedicated detail route ending in its ID. Available to team accounts only, inside the selected client workspace.

## Included

- Campaign and media CRUD, search and status/campaign filters.
- Print/digital and indoor/outdoor/online classification; invalid online-print combination rejected.
- Media briefs, assignments, specifications, dates and original-file attachments through the existing uploader.
- Manual status tracking. An approved job returns to Pending when its title, medium, placement, variation, location, specifications or attachments change.
- INR invoice ledger: payable/receivable, total, paid-to-date, derived balance and overdue status; optional campaign/job references.
- Payment amounts are integer paise. No payment gateway, bank integration or actual money movement.

## Persistence

`api/tracker.php` is required by the existing PHP controller. It creates two additive tables:

- `tracker_records`: workspace/kind indexed, typed campaign/job references, timestamps, validated JSON details. Keeping type-specific details in JSON is a deliberate MVP tradeoff; server validation controls accepted keys and values.
- `tracker_uploads`: upload path and owning workspace for newly uploaded attachments.

The API authenticates every tracker request and checks team access and client scope. References are validated against that same workspace. Parent deletion is blocked while linked records remain. Files stay in the existing media directory; no original compression is introduced by the tracker. Existing upload preview generation remains unchanged. Cleanup recognizes tracker attachments. Public media URL behaviour is unchanged.

This is a manual production ledger, not a formal client approval/audit system. Artwork and proof are currently grouped attachments; immutable versions, separate proof categories, payment-event history, partial-payment receipts, formal client review, vendor directory, calendar linking, and exports are follow-up features. Paid-to-date is editable, not an accounting transaction journal. Sample financial records are only created by the explicit local seed script below.

## Verification and deployment

- `npm run build`
- `php -l api/index.php` and `php -l api/tracker.php`
- With local PHP running on port 8080: `python3 tests/tracker-smoke.py`. Uses temporary workspace fixtures and removes them afterward; run only against the local project database.
- `npm run build:cpanel` now includes `api/tracker.php`. Deploy frontend and PHP together. Existing zip files are not refreshed by `npm run build`.
- Back up the existing SQLite database, media directory and config before deployment. Do not deploy the local database or test fixtures.

## Structured classification and status visibility

`api/tracker-taxonomy.json` is the shared source for placement variations and supported media, imported by React and read by PHP. The cPanel package includes it. Outdoor includes hoardings, bus shelters, LED screens and other outdoor. Indoor and online each have their own options. Old jobs without a variation remain visible under Unclassified.

All Media filters are URL-backed (placement, variation, medium, campaign, status, tenure, expiry month and search). Switching placement clears the variation. Groups follow catalogue order; location and owner are displayed in each row.

Pending (brief) is amber, approved/scheduled are violet, live is blue, completed is green, and overdue/expired is red. Labels accompany colour. Legacy designing/in_review records are presented as Pending and normalized on edit; they are no longer selectable. Overall completion is completed jobs / selected jobs before status filtering. Individual items show date-based tenure elapsed, not a production-stage percentage. Payment balances and delivery completion remain separate.

Verified at 320, 390, 768 and 1440 CSS pixels; contrast inspected in both themes. Calendar controls now use contrast-safe brand gradients, centred labels, SVG symbols and explicit selected states.

## Sample records and visual progress

To add the local sample set: `python3 scripts/seed-tracker-samples.py --client-id <local-client-id>`.
It inserts 3 campaigns, 10 media jobs and 7 invoices into that existing local workspace. It never overwrites records on rerun; existing records and sample edits are preserved. Sample IDs use `demo-tracker-`, and the interface marks them as fictional examples. No real bookings or payments are created. Add `--with-preview-assets` to copy existing project artwork into the local media folder and attach it only to sample jobs with no media; existing media and edits are preserved. The seed script and local database are not part of the deployment zip.

All Media and Campaigns each show one completion bar for the visible list and date-based tenure on each item. Campaign rows also show how many linked media items are completed. Payments includes separate payable and receivable summaries, actual amount-based progress on every invoice and detail page, overdue balances, direction/status/campaign/reference filters, and direct edit controls. Received money is labelled “received”, not “paid”. Summary amounts reflect active filters; the top workspace totals remain global.

The payment form previews the balance and progress while editing. “Paid/received to date” is a cumulative figure, not a new transaction. Overdue unpaid/partial invoices are prioritised by due date, fully settled invoices follow. This remains a manual ledger with editable totals; it is not an immutable accounting journal or payment processor.


## Tenure, thumbnails and monthly review

- Small thumbnails open the existing detail page. Campaigns use a linked item preview; payments use their linked item or campaign preview. Missing previews have an icon fallback.
- Campaign and media forms support exact start/end dates or full calendar months. End dates are inclusive: an item ending today expires tomorrow, using Asia/Kolkata time. No scheduled background deletion is performed.
- Media with neither date inherits its campaign's entire date range. Setting custom media dates overrides both bounds; a single-bound update is rejected. A due date is a work deadline, never an expiry date.
- Tenure bars show elapsed calendar days. This is independent of production status and payment settlement.
- All current includes expired records until manual removal. Upcoming, Running, Expired and Archived filters can be combined with an expiry month. Placement counts follow these tenure filters.
- “Remove expired month” archives all expired records of the selected kind/workspace whose effective end date is in that month, after confirmation. Other search/status/placement filters do not narrow this batch action; its confirmation states the full month scope. Today-ending records are excluded.
- Manual removal stores `archived_at` in the existing record JSON; no schema migration is needed. Archived records remain accessible by direct link and in Archived, with a Restore action. Files, invoice references and payment amounts are retained.
- Campaigns and media are archived independently. Archiving a campaign does not cascade to its jobs or payments. Permanent deletion remains a separate confirmed action and linked-record guards still apply.

Validation: `node tests/tracker-tenure.mjs` covers calendar-month boundaries, inclusive expiry and inherited dates. The PHP smoke test additionally covers status normalization, approval reset, archive/restore, monthly batching, tenant isolation, retained invoice references and today-ending protection.


## Simplified everyday view

The three tracker tabs now open compact lists. Search, status and Add stay visible; date/expiry/archive, campaign, medium and variation filters live under Filters. Applied extra filters remain visible as removable chips even when the panel closes. Outdoor/Indoor/Online stay one-click filters, and the list keeps its placement/variation groups.

Repeated workspace KPI cards, stage summary cards and per-group progress summaries are removed. One completion bar describes the visible list; rows retain thumbnails, status and date-based tenure. Every row has a direct Edit/Update button, while the thumbnail/title opens the full detail page. Payments show compact balance/progress rows with payable and receivable totals kept separate.

Forms keep essentials visible and put assignments, references, specifications and notes under More details. These fields remain in form state and are preserved on save. Detail pages keep archive/restore and permanent deletion under More actions. No database or retention policy was changed by this visual simplification.
