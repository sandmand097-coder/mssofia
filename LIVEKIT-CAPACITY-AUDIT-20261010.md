# Miss Sofia — LiveKit capacity audit (10 October 2026)

The site's static frontend is served by Cloudflare Pages; student identities, payments and lesson-token authorization run in one Render Free Node service (reported limits: 0.15 vCPU, 512 MB RAM); realtime audio and video are served by the LiveKit Cloud SFU rather than Render. The code's default course enrolment is 30, adjustable 1–500; enrolment is not the same as proven WebRTC viewership.

## Actual synthetic LiveKit tests on the school's connected LiveKit Cloud project

| Test | Viewers | Synthetic publishers | Seconds | Successful audio/video subscriptions | Failed subscribers | Aggregate packet loss |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| A | 20 | 1 video + 1 audio | 35 | 40/40 | 0 | 0.172% |
| B | 40 | 1 video + 1 audio | 45 | 80/80 | 0 | 0.125% |

Both used the LiveKit CLI `lk perf load-test` with a separate ephemeral QA room and synthetic medium-resolution feeds. Viewer mean throughput was 338.5 kbit/s in A and 340.4 kbit/s in B. No real students, lesson rooms, student cameras, payments or private messages were involved. The CLI logs are retained on the authorized Windows PC under `%TEMP%/misssofia-livekit-perf-22-viewers.log` and `%TEMP%/misssofia-livekit-perf-40-viewers.log`.

**Measured result:** 40 concurrent synthetic viewers connected and received both tracks without errors for 45 seconds. This is not proof that 40 students can watch a continuously moving full-HD stream for 2 hours, nor that 80 clients can all authenticate, enter and reconnect under a burst.

## Provider plan limits and estimates

Official provider documentation: https://docs.livekit.io/deploy/admin/quotas-and-limits/ and https://livekit.com/pricing. The free **Build** plan lists 100 project-wide concurrent participants, 5,000 participant-minutes/month and 50 GB downstream data/month; all are hard caps. The LiveKit CLI confirmed which project the school uses but **did not disclose the actual subscription tier or remaining monthly quotas**; these figures apply only if the project is on Build with its full allowances unused.

- One **60-minute** lesson with one teacher: up to `floor(5000/60) - 1 = 82` students *by participant-minute arithmetic*, subject to concurrent and bandwidth limits.
- One **120-minute** lesson: up to `floor(5000/120) - 1 = 40` students under the same assumptions.
- One such 40-student, 2-hour lesson consumes `41 × 120 = 4,920` of 5,000 monthly participant-minutes, almost the entire free monthly allowance.
- Illustration at 2 Mbit/s of downstream video: one student's 2h stream needs about 1.8 GB, so 40 students need about 72 GB, more than the 50 GB free transfer limit. Actual bitrate, adaptation, losses, audio and overhead change usage.

Paid **Ship** starts at $50/month and lists 1,000 concurrent participants, 150,000 monthly participant-minutes and 250 GB included downstream transfer; overages may be charged. Upgrading LiveKit cannot guarantee the same capacity in the frontend, Render Free API, student Wi-Fi or database.

Before guaranteeing real 1–2h classes: inspect LiveKit Dashboard > Settings > Project to confirm the plan/remaining limits; conduct a separate 60- and 120-minute two-device/geographically varied acceptance soak with moving screen-share, reconnect bursts, token issuance, permissions and school enrolment checks; then choose a proven enrolment cap. Set quotas and failure alerts before inviting paying cohorts.
