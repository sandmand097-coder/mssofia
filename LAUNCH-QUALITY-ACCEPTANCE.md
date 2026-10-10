# Mrs Sofia — live classroom, verified wallet payments, and discoverability

## Released behaviour
- Camera and shared-screen video use **contain**, never crop/stretch. Natural WebRTC track dimensions select portrait 9:16, square 1:1 or laptop landscape layouts. Video adjusts when switching sources. Classroom remains responsive at 390px, 768px and 1366px.
- The host has an opt-in **Test sound** control for browser audio gesture unlock, a mute toggle and a soft two-tone arrival sound for newly connected student/viewer participants. A written join notification is shown even if autoplay audio is blocked. No automatic email or mobile push notification is claimed.
- Only the school director or appointed lesson teacher may amend an active lesson's duration. Valid range: **15 to 240 minutes**, with at least three minutes remaining when shortening an in-progress lesson. Ending the entire room immediately is a separate, confirmed action. Student subscription periods are unaffected.
- The director can select economy 640×360, balanced 1280×720 or high 1920×1080 camera capture requests. Actual resolution depends on source hardware, browser and network. Exposure control appears only when the browser reports a camera with exposure compensation; otherwise on-screen lighting guidance is displayed.
- Student receipt upload stays private; no screenshot is accepted automatically. All review paths, **including one-time review email**, require the director's affirmative wallet confirmation before a paid entitlement activates.
- If a student forgets the receipt, the director may choose the pending paid booking, enter the **actual sender phone, wallet transaction ID and received amount**, tick the manual confirmation and approve without a file. A manually approved record is stored in `payment_submissions` with a private `manual:` marker and no imaginary proof image.
- The same manual approval is available for eligible **monthly renewals** in the last five days or after expiry. Every renewal creates a separate ledger entry, extending 30 days from previous expiry when paid early.
- Manual approvals reject non-admin roles, missing confirmation, incorrect amount, invalid sender, duplicate transaction references, existing screenshots/reviews, and full course seats. A transaction receipt ID is required; the app has no direct Vodafone Cash banking API and cannot independently verify a transaction.
- The public brand name is **مس صوفيا للعلوم**, with semantic metadata, canonical URLs, crawl permissions, structured `EducationalOrganization` data, `robots.txt` and `sitemap.xml`.

## Explicit limitations
- **Google ranking cannot be guaranteed**, including rank #1 for exact brand searches. Claiming the name in Google Search Console, verifying site ownership, submitting the sitemap, obtaining authentic citations and allowing indexing time are separate operational steps.
- **No real financial transfer** is performed during tests. A director must compare the transaction number, amount and sender on their own Vodafone Cash phone before accepting, even without a screenshot. Test data and screenshots do not prove receipt.
- Browser camera controls cannot improve lighting that the device does not capture, override hardware restrictions or guarantee Full HD in poor network conditions.
- Browsers can block unsolicited alert audio; the director should click **تجربة النغمة** once in the studio to permit the sound.
- Tests cannot substitute for an authorized two-device teacher/learner real-media session. Record that as a release acceptance check.

## Verification
```bash
npm run check
npm test
npm run build
npm run test:launch:browser
SITE_ORIGIN=https://mssofia.pages.dev npm run test:production:smoke
```
The integration suite uses disposable SQLite, mock wallet transfers and fake identities only. Browser QA uses isolated API mocks rather than genuine students.

### Manual acceptance before real classes
1. Log in as the director and one authorized test student on **two separate physical devices**.
2. Confirm portrait and landscape camera switching with faces visible, no cropping; confirm audio/screen-share consent.
3. Click **تجربة النغمة** as director, then let the student join and verify a discrete chime and attendance announcement.
4. Shorten and lengthen a practice lesson; verify new join tokens and roster access respect changed cutoff.
5. For a test booking, perform an actual verified *small* Vodafone Cash transfer only with the school owner's approval. Check amount, sender and transaction ID on the school wallet; test the manual and screenshot-based approval paths with **distinct** test bookings and distinct references.
6. Validate no sensitive receipt is available to another student or to an anonymous visitor. End the practice lesson; verify recordings are not made without separate consent.
7. Set up Google Search Console on the appropriate Google account, verify the URL-prefix property and submit `https://mssofia.pages.dev/sitemap.xml`. Do not promise immediate indexing or first place.
