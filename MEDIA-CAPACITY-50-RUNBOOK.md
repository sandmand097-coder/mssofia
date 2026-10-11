# Miss Sofia — 50-student real-media readiness and low-cost deployment gate

**State:** Engineering acceptance plan, **not** proof that production has passed a 50-device, two-hour real WebRTC test.

## Existing working boundaries

- Keep Cloudflare Pages React/Vite and the current Express app on Render. Keep Supabase data and all student/course/payment identifiers intact. No migration should overwrite enrolments.
- LiveKit Cloud currently handles WebRTC. Neither successful API requests nor synthetic waiting-lobby users demonstrate 50 simultaneous media subscribers.
- Our present design opens a website lobby before media publication, then issues student-scoped LiveKit tokens *after* subscription and moderation checks. Those checks must remain server-side after any provider change.
- Never weaken microphone permissions, drop bans, turn student devices on remotely, accept unverified payments, or expose private join URLs to Google crawlers.
- Introduce a self-hosted or low-cost provider on a separate **staging** deployment first. Do not switch production secrets or billing automatically.

## Capacity arithmetic — estimates, not telemetry

Run the no-network calculator:

```sh
node scripts/classroom-capacity.mjs 50 120 1200 8 5000
```

This means 50 learners + 1 teacher, 120-minute class, 1200 kb/s *one teacher video stream per viewer*, 8 classes/month, and an **example** 5,000-participant-minute allowance.

| Hypothetical lesson | Participants | Participant-minutes / class | Nominal server downstream | Nominal viewer video transfer |
|---|---:|---:|---:|---:|
| 40 students + teacher, 120 min, 1000 kb/s | 41 | 4,920 | 40 Mb/s | 36 GB |
| 50 students + teacher, 120 min, 1200 kb/s | 51 | 6,120 | 60 Mb/s | 54 GB |
| 50 students + teacher, 120 min, 1200 kb/s, 8/month | 51 | 48,960/month | 60 Mb/s when live | 432 GB/month |

Decimal GB, not GiB. Figures **exclude** audio, screen shares, TURN retransmissions, control data, protocol overhead, additional student publishers, recording/egress and safety margin. Bitrate adapts dynamically. Free allowances and paid pricing must be checked in the owner's **current** LiveKit dashboard; the calculator does not contact the provider.

## Provider choices

### Preferred staging experiment: self-host LiveKit OSS SFU

- The existing LiveKit browser/server SDK, room identifiers, token grants and moderation can be retained. This minimizes application rewrites and preserves the instructor's mobile controls.
- Use a VM with public IPv4, a real DNS name, trusted TLS certificates, and adequate outbound bandwidth near the students. Use a **separate** domain such as `live-staging.example.org` (placeholder) with `wss://`.
- LiveKit recommends Redis for production, appropriate TURN/TLS for restrictive networks, and correct WebRTC UDP/TCP ports. Use the **official** LiveKit VM deployment generator/guide rather than inventing insecure Docker settings.
- Keep Redis and internal management/metrics endpoints unexposed to the public internet; protect secrets and back up deployment configuration outside Git.
- Do not use the Cloudflare Pages/Render free serverless path as the media server. Signaling and WebRTC UDP/TURN require dedicated real-time infrastructure.
- Hosted LiveKit Cloud remains the known rollback path until a second solution passes the soak test.

Official references:
- https://docs.livekit.io/transport/self-hosting/
- https://docs.livekit.io/transport/self-hosting/vm/
- https://docs.livekit.io/transport/self-hosting/ports-firewall/
- https://docs.livekit.io/deploy/admin/quotas-and-limits/

### Alternative to evaluate later

When only one teacher speaks most of the time, low-latency broadcast plus a separate text/Q&A channel may reduce interactive participant costs, but switching to HLS or similar technologies changes latency, authentication and privacy assumptions. Do **not** publish an unprotected video link for paid children's classes or present HLS as interchangeable with interactive WebRTC.

## Required real-media acceptance matrix

1. **Two consenting test devices** on separate connections: teacher from Android Chrome or iOS Safari; learner receives real microphone + video track; test rear/front camera, audio-only start, camera permission denied, screen sharing availability, handset lock, app switch, headphone change and mobile portrait orientation. Do not treat headless Chrome alone as iPhone evidence.
2. **10 independent learners** and teacher for a rehearsal. Distinguish 200 response/token issuance from actual decoded audio/video; instrument WebRTC stats in the clients.
3. **25 learners**, then **50 real concurrent decoder subscriptions**, each only after the previous test is acceptable. Use a staging LiveKit server or an explicitly approved paid quota; never consume production free minutes accidentally.
4. **120-minute continuous soak** with 50 students and one real teacher publisher. Collect timestamps, successful joins, p50/p95 join time, media freeze time, audio interruptions, decoder frames received, reconnection outcomes, TURN ratio and SFU CPU/memory/network transfer. Document which clients are physical devices vs browser processes.
5. **Security and interruption:** expiry and student bans reject token issuance, revoked permission really mutes student capture, long screen-sharing and teacher reconnections behave, payment review remains isolated, kids' personally identifying information is redacted from operational logs.
6. **Go/no-go:** agree explicit percentile and reliability targets before testing. Mark anything not measured as **unverified**. Roll back to existing LiveKit Cloud on failed targets. Promote to production only after operator approval, rehearsal and documented rollback.

## Operational reliability and privacy

- Make backend readiness and frontend rendering independent: public landing pages should paint even while Render wakes, but protected pages remain fail-closed.
- Never log authorization tokens, paid receipts, children’s full names, or classroom URLs.
- Keep real-time session health distinct from API health. A 200 on `/api/health` does **not** prove LiveKit transport can carry 50 decoders.
- Monitor p95 API latency, PostgreSQL pool waits, duplicate admissions, Render cold starts, room drops and bandwidth limits.
- Keep educator controls manual for camera/microphone and provide clear low-bandwidth fallback.
