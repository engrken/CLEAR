# CLEAR Mobile

Expo (SDK 58) app for the CLEAR System: officers keep a department's ledger, and students check clearance and submit GCash or Maya payment proof. The UI follows the **CLEAR Mobile** design system (`design/tokens.json` is copied from it).

## Run

```bash
npm install
npm run web        # browser preview at http://localhost:8081
npm run android    # Expo Go or an emulator
```

The app currently runs on **mock data** (`src/api/mock.ts`), seeded like the web app's `prisma/seed-dev.js`:

- Officers: `admin@devdept.local`, `treasurer@devdept.local`, `auditor@devdept.local` or `viewer@devdept.local`, with code `123456`.
- Students: `DEV-2026-0001` (cleared) or `DEV-2026-0002` (on hold).

The officer session lives in memory, so a full reload signs you out until the Phase 2 API adds SecureStore persistence.

## Layout

| Path | What |
| --- | --- |
| `src/app/` | Expo Router screens. `d/[dept]/*` is the public student and sign-in flow; `(officer)/*` is the officer tab group, guarded by `Stack.Protected` in `_layout.tsx`. |
| `src/components/ui/` | Design-system components: Button, StatusPill, Money, StatTile, LedgerRow, TextField, OtpInput, TermChip, ClearanceCard, ProofUpload, Banner, Icon, Screen. |
| `src/theme/` | `tokens.ts` is generated; `index.tsx` provides `useTheme()`. Dark by default, light follows the device. |
| `src/api/` | `types.ts` is the contract for the Phase 2 REST API (money in integer centavos); `mock.ts` implements it in memory. |
| `scripts/build-design.js` | Regenerates `src/theme/tokens.ts` and `src/components/ui/icon-data.ts` (Bootstrap Icons 1.11.3, the web app's set). Run `npm run design` after changing `design/tokens.json`. |

## Checks

```bash
npm run typecheck
npm run lint
```

## Next

1. Phase 2: `/api/mobile/*` routes in the Next.js app, using the Phase 1 tenant guard and bearer tokens; swap `src/api/index.ts` from the mock to a fetch client.
2. Persist the session with `expo-secure-store`, and upload receipts straight to storage.
3. Build the modules listed under More (advances, liquidations, penalties, cashier, realignment, void, reports, officers).
4. Pick the final Android application ID (currently `app.clearsys.mobile`) before the first EAS build.
