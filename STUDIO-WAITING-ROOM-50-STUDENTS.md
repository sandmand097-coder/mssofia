# Miss Sofia — Safe studio waiting lobby and 40–50 learner operations

Release behavior (no production database migration or new vendor account needed):

1. The administrator/assigned teacher opens **فتح استوديو البث**. The LiveKit SFU confirms an authorized, currently active instructor has joined the actual classroom. This opens a **private website-only lobby** for students who already have active, verified course access, including before the scheduled 15-minute window.
2. A student clicks **الدخول لمشاهدة الحصة** and enters the school's branded waiting room, **without joining WebRTC and without consuming LiveKit participant minutes**. Their browser checks lesson state at a moderate ~8.5-second interval while the tab is visible; the backend deduplicates provider room checks for five seconds. Waiting students have no microphone or camera permission.
3. When the instructor publishes real sound, camera or screen media, the browser automatically connects via a **new, student-scoped, server-verified LiveKit token** after short random jitter (0–1.7s). All monthly payment, course membership, expiry, ban and status checks still apply to the token endpoint. A permanent 403 never triggers a retry loop.
4. If the instructor leaves their studio before the timetable window, the room no longer opens for *new* student arrivals; students already waiting keep the website waiting UI without video consumption. Ending the lesson blocks token issuance. The normal 15-minute window remains available as a website lobby.
5. A presenter can **+15, +30 or +60 min** with buttons, or enter a total duration up to **240 minutes (four hours)**. Increment updates are atomic and capped so concurrent clicks do not lose minutes. Extending a lesson changes the authorization window, **not** LiveKit's provider quota or remaining free connection minutes.

### Truthful LiveKit Build free arithmetic
Official terms are published at https://livekit.com/pricing and https://docs.livekit.io/deploy/admin/quotas-and-limits/ . The Build free plan has a 100-participant concurrent limit, 5,000 monthly WebRTC participant-minutes and 50 GB monthly downstream allowance as of October 2026. These are project-level/cloud-account constraints, not a 100-student two-hour guarantee; the active plan and remaining quota must be checked in the owner's dashboard before the class.

| Real media participants | Two-hour session | Connection minutes consumed |
|---|---:|---:|
| Teacher + 40 students | 120 minutes | 4,920 |
| Teacher + 50 students | 120 minutes | 6,120 |
| Teacher + 50 students | 60 minutes | 3,060 |

Waiting on the website before media starts saves otherwise wasted connection minutes; once broadcasting starts, all connected students continue consuming minutes regardless of camera resolution or whether video is muted. Low-res video reduces *bandwidth*, not *participant minutes*.

### Genuine free versus hidden expenses
- **Keep LiveKit Cloud Build** for smaller classes/tests or shorter paid classes. Never attempt to bypass its rate, billing or hard quota limits.
- **LiveKit open-source SFU self-hosted** has no proprietary LiveKit Cloud participant-minutes billing, but requires a server and sufficient upload capacity, public HTTPS/WSS, NAT/TURN networking, monitoring and incident handling. Software is free; reliable infrastructure/bandwidth is **not automatically free**. See https://docs.livekit.io/transport/self-hosting/ . Do a separate staged migration, not an uncontrolled switch during a real lesson.
- **Upgrade managed LiveKit only with explicit approval** when classes regularly exceed free limits. This is the simplest operationally but has monthly and potentially usage-based charges. Never make a billing change automatically.
- **Unlisted consumer video streams** should not be treated as equally private/safe for paid children's lessons: anyone with a leaked watch URL may access them. Replacing authorized WebRTC with an unsecured unlisted link is not a security improvement.

### Operator playbook
- Before the real class, check LiveKit remaining minutes/GB and the expected student×minutes calculation; verify recording policy and parental consent where applicable.
- Admin opens studio first; students get the waiting lobby; admin presses **ابدئي البث الآن**. When audio/video is published, viewers join automatically. If sound does not play, tap the existing audio unlock on the student's phone.
- On 40+ viewers, consider the economical video capture preset in studio to reduce transfer usage. This will not increase free participant-minute quota.
- Prefer staggered logins. Initial teacher media transition is jittered for 50 waiting browsers and excess token issuance gets HTTP 503 with Retry-After from the current single Render API.
- When the session runs long, use +15/+30/+60 early enough and confirm the end time changes. Admin must still click **إنهاء الحصة للجميع** to close the room immediately.
- For a LiveKit quota violation or external ISP failure, automatic retries cannot create capacity. Notify learners, reschedule with subscription protection and check provider dashboard logs.
- First operational acceptance on two real devices, then 10, 25 and (only if quota allows) 50 consenting test attendees for 60–120 minutes. Node synthetic lobby/API tests **are not** equivalent to actual 50 simultaneous streams.

**Security:** never cache student membership publicly, send a LiveKit JWT in the first GET response, or turn on children's devices automatically. The waiting lobby is only for the verified course and never silently authorizes an unsubscribed student.
