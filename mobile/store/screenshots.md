# Screenshot shot list

**Current set (1.1.0, Bright Campus, 2026-10-19):** `screenshots/01-gateway.png` … `08-verified.png`, 1080x1920. Captured with headless Edge from the Expo web build on **mock data** (`EXPO_PUBLIC_API_MODE=mock`; sample names and numbers only), at a 405x720 CSS viewport and 8/3 pixel ratio. The mock-only "Offline demo" hints are hidden in the shots. Script: `scripts/play-screenshots.mjs`. The 1.0 set (dark theme) is in `screenshots/1.0/`.

1.0 set, uploaded 2026-10-16: `screenshots/1.0/02-org.png` … `06-signin.png` (emulator 1080x2400 scaled onto a 1080x1920 9:16 canvas, because Play allows at most 2:1). Officer screens were not captured: the reviewer code is a credential and was not typed by Claude.

Play needs **2–8 phone screenshots**, PNG or JPEG, 9:16 portrait. Capture at **1080×1920** (or 1080×2400 then crop) so they qualify for Play's larger placements. Use the **dev seed** data (`devdept`, students `DEV-2026-0001` / `DEV-2026-0002`), never real student names, IDs or receipts.

| # | Screen | State to show | Caption idea (optional overlay) |
| --- | --- | --- | --- |
| 1 | Home: organization picker | 2–3 orgs listed, dark theme | Your org's books, in your pocket |
| 2 | Student clearance result | `DEV-2026-0001`: **Cleared**, with the QR code | Check your clearance with your student ID |
| 3 | Student clearance result | `DEV-2026-0002`: **On hold** | Know what's still pending |
| 4 | Submit payment proof | Fee chosen, GCash selected, reference number filled, a sample receipt image attached | Send GCash or Maya proof, no printout needed |
| 5 | Officer sign-in | Email entered, 6-digit code boxes | Sign in with a one-time code |
| 6 | Officer dashboard | Stat tiles for collections and outstanding, active A.Y. and term | See collections at a glance |
| 7 | Ledger | Mix of cash payments and online remittances | Every entry, newest first |
| 8 | Remittance review | Proof image, amount, OR number field, Verify / Invalid buttons | Verify proofs with the OR number |

Optional: repeat 2 and 6 in the light theme (the app follows the device setting).

## How to capture on the Android emulator

1. Run a **preview** build (or `npx expo start` against a local server with the dev seed) on a Pixel emulator with a 1080×1920 or 1080×2400 screen.
2. Clean status bar (Android "demo mode"):

```bash
adb shell settings put global sysui_demo_allowed 1
```

```bash
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941
```

```bash
adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
```

```bash
adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false
```

3. Capture each screen:

```bash
adb exec-out screencap -p > store/screenshots/01-home.png
```

4. When done, leave demo mode:

```bash
adb shell am broadcast -a com.android.systemui.demo -e command exit
```

Save files as `store/screenshots/NN-name.png`. Use the real Android status bar; don't paint an iOS one over it.
