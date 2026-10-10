# Miss Sofia — live classroom resilience, runbook and scaling plan

**Release type:** No database schema changes, no production student/payment mutations, no LiveKit plan or Render billing changes.  
**Goal:** Make temporary faults recoverable and observable, preserve teacher access and children's privacy, avoid retry storms and distinguish real media capacity from API token throughput.

## Current architecture and actual bottlenecks

1. **Cloudflare Pages** serves the React client and same-origin API proxy. Only GET/HEAD and *token minting* use bounded upstream request deadlines; payment, account, lesson-moderation and renewal writes must not be retried by the edge.
2. **Render Node/Express Free, one instance** authenticates students, checks paid entitlements and issues signed LiveKit grants. The server now admits at most 14 simultaneous student token requests and 20 token requests in total, reserving a fast lane for teachers/directors. When overloaded it answers **503 CLASSROOM_BUSY + Retry-After: 2** instead of queuing arbitrarily many requests in memory. These caps are configurable by `LIVE_JOIN_STUDENT_INFLIGHT` and `LIVE_JOIN_TOTAL_INFLIGHT`. They control in-flight token *requests*, not viewer count or LiveKit room capacity.
3. **Supabase PostgreSQL** holds bookings, access and lesson identity. Subscription verification remains mandatory on every new token. No public caching of tokens or user records is introduced.
4. **LiveKit Cloud SFU** carries media and has its own participant concurrency/GB/minute quotas. The viewer starts with video and microphone publishing **disabled** until the teacher explicitly grants permission. The existing `adaptiveStream` / `dynacast` remain enabled.

### Automatic recovery matrix

| Event | Available behavior | Boundaries |
| --- | --- | --- |
| Viewer briefly loses Wi-Fi / signal | LiveKit SDK's own ICE/signalling recovery keeps the session and media where possible; a visible banner explains reconnection | Can't override Internet loss or ISP outages |
| LiveKit room disconnects after built-in recovery is exhausted | For transient disconnect reasons only, client obtains a fresh authorized token with bounded retries and random jitter | Removed students, ended rooms, duplicate sessions and invalid access never silently rejoin |
| Backend cold start / 503 / 429 / transient network error when requesting a token | Up to four join requests per attempt, with exponential jittered delays and `Retry-After`; no permission denial retries | Does not retry paid transactions, user edits, moderation commands |
| Sudden large arrival burst | Bounded admission middleware sheds extra short requests and reserves headroom for instructor | Free Render has a single process; not a shared distributed queue |
| Viewer reports poor/lost connection | After repeated poor readings, cap video at lower quality while keeping audio alive; viewer can explicitly switch to audio-only and back | Media bitrate still depends on device, network and SFU |
| Browser loses microphone/camera | Show an actionable notice and let instructor explicitly restart device | Never auto-enable children's cameras/microphones |
| Text question API floods / students background the browser tab | Private question polling slows from 3.5s to 9s for active instructor and 17s for viewers; background tabs pause polling, and errors back off to 60s | Student answers might appear with a longer delay; manual Refresh remains |
| Older payment accepted but booking status stale | Separate previously deployed transactional recovery without duplicate payments | Does not skip payment verification |

### Director monitoring

The private `GET /api/admin/live/admission` endpoint and Admin Operations screen expose admission in-flight count, peak and transient throttling **for the current Render process only**. It does **not** display globally connected LiveKit viewers, media quality percentiles, project billing or quota balance.

Use separate LiveKit Dashboard analytics and Render/Supabase metrics for the production SLO board:

- Successful authorized joins / all attempts, median and p95 time to first frame.
- Connection reconnection rate, recovery time, media packet loss, jitter, browser video/audio playback errors.
- Active viewers, LiveKit participant minutes and downstream GB, remaining plan quota alerts.
- Render CPU, memory, 5xx rate, p95 auth/token latency and Postgres connection-pool saturation.
- Rejected/expired student access and blocked suspicious retries. Never record children's tokens, receipts or messages in public telemetry.

### Capacity tiers and actual decision

The two earlier LiveKit synthetic tests were **20 viewers for 35s** and **40 viewers for 45s**; all received video and audio, but these do not validate a 1–2h class. The new HTTP surge test tests token/entitlement issuance with 60 synthetic users **without any WebRTC media**. These are distinct measurements and must never be represented as a 60-viewer live video stress test.

Official LiveKit quotas: https://docs.livekit.io/deploy/admin/quotas-and-limits/ and https://livekit.com/pricing. On **Build (free)** default concurrent participants are limited to **100**, with **5,000 WebRTC participant-minutes and 50 GB downstream monthly**; hitting hard caps stops new traffic. Verify the school's actual plan/remaining balance in LiveKit Dashboard before using any quota math.

| Scale target | Suggested architecture | Requirements and caveats |
| --- | --- | --- |
| 10–30 interactive students | Existing LiveKit SFU and one Render API, with the new recovery/backpressure changes | Conduct actual 60- and 120-minute soak with real teacher + student devices first |
| 50–100 interactive students | Paid LiveKit allowance if needed, persistent Render plan and metrics; simulate joins and monitor all quotas | Free monthly minutes/GB may run out in one large class |
| 100–1,000 interactive students | Paid tier with validated LiveKit concurrency, multi-instance Render/API and distributed rate limit/queue or admission storage, scalable Postgres pooling | Current in-memory admission metrics are per-process and must be replaced before horizontal scaling |
| Thousands of passive viewers | Private low-latency HLS/DASH via LiveKit egress or dedicated managed video platform + CDN, with origin-side signed per-student authorization; separate small interactive WebRTC studio | Requires a separately designed secure delivery route, consent, latency trade-offs and a paid media budget; **not implemented by this release** |

Avoid an unprotected public HLS playback URL for paid lessons. Recording and redistributing a children's educational session requires an explicit retention, permissions and guardian privacy review.

## Operations playbook

1. **Before a big class:** Confirm LiveKit plan and remaining included GB/minutes. Review room's scheduled end time, test teacher camera/screen-share/audio from two real devices, check Render response time and Supabase readiness.
2. **Provider at quota / media cannot connect:** Students must see a precise recovery notice. Do not continuously issue new tokens. Reduce video tier where possible, alert director, and reschedule or refund if the provider hard cap has been reached.
3. **Weak home Wi-Fi:** Ask student to select **الصوت فقط**, then return to automatic video once stable; do not recommend repeated refreshes that kick students from rooms.
4. **Render slow, but LiveKit already connected:** Existing media continues where the room stays connected. Avoid interrupting an active teacher stream for noncritical sidebar/chat errors.
5. **Cloudflare/API unreachable:** Client retries only safe token admission requests. Do not automatically replay payments or administrative mutations.
6. **Instructor audio fails:** Keep the classroom connected, check microphone permission and use authorized audio/screen share alternatives. No silent camera/microphone activation.
7. **Pressure rises:** The director reads backpressure metrics (per-process) and reduces concurrent new joins by staggering admission; if throttling persists, move to paid compute/distributed queue rather than pretending retries create capacity.
8. **After incident:** Collect timestamps, sanitized request IDs, service-side error counts and affected session IDs (never JWTs, phone numbers, screenshots or student messages). Check access history before rescheduling.

## Acceptance tests and limitations

- `npm run check` / `npm test` / `npm run build` and existing browser QA.
- `npm run test:surge:api` (isolated student, instructor, admin JWTs; no live media or payment).
- Manual staged tests: 60–120 minute teacher-to-student session on Android, iPhone and Windows; intentional Wi-Fi interruption/return; instructor device removal; low-bandwidth video; room ended by director; kicked learner remains excluded; 25/50/100 genuine viewers only with plan allowance and consent; optional CDN streaming after architecture approval.
- A real outage or provider quota breach cannot always be repaired automatically. **Zero outages / unlimited concurrent users cannot be guaranteed.**
