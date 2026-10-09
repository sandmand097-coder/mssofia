# mrsofia | Architecture and scaling checklist

## Current architecture — implemented

```text
Student Browser (read-only audio/video by default) ─┐
Student Browser (read-only audio/video by default) ─┤ WebRTC subscribe
Other enrolled students ────────────────────────────┤
                                                     ▼
                                             LiveKit SFU (to be provisioned)
                                                     ▲
                                 WebRTC publish audio, video, screen
                                                     │
                                             Mrs Sofia / Teacher
                                                     │
             REST moderation + hand raise ────────────┤
                                                     ▼
              Node.js / Express API (teacher permissions, JWT, attendance)
                                                     │
                                                     ▼
                           SQLite (current local phase; production migration needed)
```

- **Implemented**: LiveKit access grants prevent children broadcasting by default; 6 concurrent authorised student microphones maximum; teacher moderation goes through authenticated, course-owned APIs and LiveKit RoomService.
- **Implemented**: host camera/microphone/screen-share controls, pupil hand requests, noticeboard messaging, and listening-only students.
- **Implemented**: room UI uses Adaptive Stream and Dynacast; only host camera/screen are rendered as the large stage, not all children's cameras.
- **Implemented**: connected users displayed with incremental roster rendering (40 pupils per page), no expensive grids for every child's video.
- **Not implemented**: running LiveKit deployment, PostgreSQL migration, CDN/hosting, multi-node API orchestration, recordings, session load testing.
- **Not guaranteed**: capacity of 500 live children; 500 is the current maximum course enrolment setting, not a tested simultaneous WebRTC capacity.

## Scaling phases and acceptance criteria

| Phase | Concurrent viewers per room | Validation |
|---|---:|---|
| Controlled classroom | 10-25 | Camera, screen-share with tab audio, late join, reconnect, raise hand, permission revoke and kick |
| Small cohort | 50 | Join success, devices, simultaneous attendance webhook arrivals, backend response under sustained requests |
| Growing classes | 100 | Screen-share stays smooth, speech remains clear, no unauthorized publications |
| Large class | 250 | Provider room quotas, bandwidth, packet loss and costs, teacher roster/search performance |
| High-capacity class | 500 | Full soak test with realistic clients and geographic mix; go/no-go based on real metrics |

Test at least 30–60 minutes per stage and include a reconnect burst and teacher screen-sharing a video with audio. Define objective acceptance thresholds in agreement with the business before buying capacity. Measure audio interruptions, WebRTC connection failure rates, regional latency, participant counts and actual data transfer. The numbers above are test targets, not claims of measured support.

## Production recommendations

1. Host React's static assets behind a CDN/custom domain; operate Node API separately using HTTPS with stable sessions and health checks.
2. Use a managed LiveKit SFU deployment sized according to maximum simultaneous subscribers, publishers, region, and network quality.
3. Move from a single writable SQLite file to PostgreSQL before scaling to sustained high concurrent writes. Plan migrations, backups, restore tests and monitoring.
4. Avoid polling each student every few seconds. The current student gets its own permissions via LiveKit updates; only the teacher polls hand-raise state every six seconds.
5. Maintain a low number of student publishers per class. A class of viewers has a very different cost profile than hundreds of camera publishers.
6. For over roughly a thousand subscribers, evaluate LiveKit's Livestream Mode and differences in participant event visibility. Do not rely only on `useParticipants()` to count every viewer there.
7. Do not open a large class to paying families until a representative production load test has passed.
8. Obtain appropriate guardian consent and adopt an explicit child privacy policy, data retention limits, support/escalation process and staff access controls.
9. Define an outage procedure: cancel or reschedule sessions, notify families, and avoid charging for failed lessons without a fair policy.

## Safeguards

- Never publish a student's microphone or camera automatically when the teacher approves the permission. The child must initiate capture locally.
- Disable student publishing by default using backend-signed LiveKit tokens and runtime permission updates.
- Prevent re-entry after moderation removal; token issuance checks the lesson ban list and LiveKit receives a token revocation timestamp.
- Room dismissal marks the lesson ended and stops new valid tokens.
- Do not record minors unless there is a well-defined retention and consent policy.

## Verification commands

```powershell
npm run check
npm test
npm run build
node qa-classroom-mrsofia.mjs
node qa-classroom-studio.mjs
```

`qa-classroom-studio.mjs` mounts the real classroom components inside a disconnected LiveKit room for visual/hook testing; it does **not** simulate a real WebRTC media connection or bandwidth load.
