# Redesign "B · Bright Campus": implementation plan (version 1.1.0)

**Status:** planned 2026-10-17. **Don't start coding until 1.0.0 is live on Google Play** (production review was submitted in `4852802`). Work then happens on a branch, so hotfixes to 1.0.x can still ship from `main`.

**Mockups:** Design canvas https://claude.ai/artifact/DMUtmacWMDXEUkhdrnRBfY
- Page **Directions**, row B: clearance (cleared), sign-in code, officer home, review remittance.
- Page **B · Full screen set**: gateway, portal, clearance on hold, submit proof, proof sent, sign-in email, collect, verify queue, verified, students, more.

## Scope

- **In:** the look of every screen (colours, type, shapes, layout, tab bar, success states) and copy tone.
- **Out:** API, data, flows, permissions and role gating, session handling, and the Play listing text. All of these stay exactly as they are in 1.0.0. If a mockup implies new behaviour, it's listed under "Decisions" below and isn't built unless approved.

## The look, as tokens

| Role | Value | Use |
| --- | --- | --- |
| ground | `#FFFFFF` | Screen background |
| soft | `#F3F4F8` | Filled inputs, list rows, neutral chips |
| ink | `#11142B` | Text; dark blocks (tab bar, selected options, profile card) |
| muted | `#555B75` | Secondary text (6.1:1 or better on every light ground) |
| cobalt | `#2B3FD6` | Primary buttons, links, hero blocks; white text on it is 7.5:1 |
| cobalt-tint | `#EEF0FF` | Selected rows, department chip, upload area |
| sun / sun-tint / sun-ink | `#FFC83D` / `#FFF4D6` / `#4A3700` (`#6B5200` on tint) | Pending, waiting for action |
| mint / mint-ink | `#CFEFDF` / `#1F4A36` | Cleared, verified, success |
| coral / coral-ink | `#FFD6CC` / `#8A1F0E` | On hold, outstanding, errors |
| tab-inactive | `#C9CCDA` on ink | Floating tab bar labels |

Every text pairing above was checked at 4.5:1 or better.

- **Type:** Bricolage Grotesque 600/700/800 for display text and figures; Figtree 400/500/600/700 for body. Packages: `@expo-google-fonts/bricolage-grotesque` and `@expo-google-fonts/figtree` (both 0.4.1). These replace IBM Plex.
- **Shapes:** cards and blocks have 28px corners, rows 20–24px. Buttons, fields, chips and the tab bar are full pills (999px). Touch targets are at least 48px, and primary buttons are 56px.
- **Status** is shown with a coloured block or pill *and* words (Cleared, On hold, Pending), never colour alone.

## Work, in order

1. **Branch and tokens** (½ day)
   - Branch `redesign-b` from the 1.0.0 release commit.
   - Rewrite `design/tokens.json` with the palette above. Decide the dark theme first (see Decisions).
   - Update `scripts/build-design.js`: its `FACE` map changes to the Bricolage and Figtree face names. Run `npm run design`.
   - Swap the fonts in `src/app/_layout.tsx` (`useFonts`).
2. **Components** in `src/components/ui/` (1½ days). Keep each component's name and props so screens change as little as possible:
   - `Button`: pill, 56px; primary cobalt, secondary ink outline, danger coral-ink, ghost.
   - `TextField`: filled pill (soft), label above; error turns the fill coral.
   - `OtpInput`: rounded 18px cells; filled cells ink with white digits; active cell cobalt-tint with a cobalt ring.
   - `StatusPill`: same status→tone map; tones become sun, mint, coral and cobalt-tint.
   - `Money`: Bricolage figures, tabular. Sizes stay.
   - `StatTile` becomes **two components**: `HeroStat` (the cobalt cash-on-hand block) and `ColorTile` (the small mint, sun and coral tiles).
   - `LedgerRow`: rounded soft row with an initials avatar (new `Avatar`); pending rows tinted sun.
   - `Banner`, `TermChip` (two pills: A.Y. dark, term light), `ProofUpload` (dashed cobalt), `OrgMark` (rounded square, initials).
   - `ClearanceCard` becomes a full-colour result block: mint when cleared (QR on a white inset), coral when on hold. The QR stays dark on white.
   - **New:** `ColorHeader` (the coloured top block on sign-in and the gateway), `SuccessScreen` (full-bleed proof sent and verified), and `FloatingTabBar`.
3. **Tab bar** (½ day): replace JS `Tabs` in `src/app/(officer)/_layout.tsx` with the headless `Tabs`, `TabList`, `TabTrigger` and `TabSlot` from `expo-router/ui`.
   - The visible floating pill bar renders a `TabTrigger` only for tabs the role can use. This replaces `href: null`, and the docs confirm that not rendering a trigger removes the tab.
   - Keep the Verify badge count.
   - Screens with the floating bar need about 100px of bottom padding plus the safe-area inset.
4. **Screens** (2 days), one commit each, matching the canvas:
   - `src/app/index.tsx`: gateway (B5)
   - `d/[dept]/index.tsx`: portal (B6)
   - `d/[dept]/clearance.tsx`: cleared (B1) and on hold (B7)
   - `d/[dept]/submit-proof.tsx`: form (B8) and sent (B9)
   - `d/[dept]/sign-in.tsx`: email (B10) and code (B2)
   - `(officer)/home.tsx` (B3), `collect.tsx` (B11), `verify.tsx` (B12)
   - `officer/verify/[id].tsx`: review (B4) and verified (B13)
   - `students.tsx` (B14), `more.tsx` (B15)
5. **Checks** (1 day)
   - `npm run typecheck`, `npm run lint`, `npx expo-doctor`.
   - Re-run the same end-to-end pass as 1.0.0 against the local API (dev seed): clearance cleared and on hold, proof upload, sign-in for admin and treasurer, session restore, payment, the 409 already-paid case, verify with an OR number, invalidate, sign-out on 401, role-filtered tabs.
   - Test on an Android phone with a preview build. Check large font scale (130%) and TalkBack labels.
6. **Release** (½ day)
   - Bump `expo.version` to 1.1.0 (versionCode is automatic).
   - Build the production AAB and upload it to the internal track through the Play API (`eas submit`), then promote.
   - Retake the Play screenshots in the new look and update `store/screenshots.md`.
   - Update the CLEAR Mobile design system artifact and `design/tokens.json` to the B tokens, so the design system and the app agree.

**Estimate:** about 6 working days for one person. Nothing changes on the server.

## Decisions to make before coding

1. **Dark mode.** The B mockups are light only, but today's app follows the phone's dark setting. Options: (a) ship B light only (simplest, and matches the mockups), or (b) design a dark B variant first (about +1 day of design and +½ day of build).
2. **Amounts on home tiles.** The small tiles show whole pesos (₱15,000). Keep that, or show centavos everywhere as 1.0.0 does? Detail screens always show centavos.
3. **"Next proof" after verifying** (B13). This is a small navigation change: the button opens the next pending item instead of returning to the queue. Approve it, or keep "Back to queue".
4. **Friendlier status words.** The mockups say "Pending", "Not valid" and "Almost there" where 1.0.0 shows the stored wording ("Pending Verification", "Invalidate"). Officers may compare against the web app, so keep the stored wording on officer screens and use friendlier words only on student screens.
5. **First name on results** ("You're cleared, Ana!"). The first word of `studentName` will be wrong for some names; use the full name if unsure.

## Risks

- `expo-router/ui` headless tabs are marked experimental in SDK 58. The fallback is the JS `Tabs` `tabBar` prop with a custom component.
- Changing fonts changes text widths. Long department names (JIECEP) and amounts need a pass at 130% font scale.
- Play screenshots and the feature graphic will look out of date until they're updated in step 6.
