# Miss Sofia — direct administrator broadcasting

Status: LIVE ADMIN STUDIO IMPLEMENTED; public student enrollment and payment
release remain subject to school approvals and external live acceptance testing.

## Who broadcasts?
**The signed-in administrator is the instructor and primary live broadcaster.**
No additional teacher account is needed. Newly created courses select the admin
account by default. The director can also present classes originally associated
with another teacher: signed LiveKit participant metadata marks the admin as
the director, and the student's media player prioritizes the director's video.

## Director steps
1. Sign in with the approved Google director account at
   https://mssofia.pages.dev/login.
2. In the administration portal, open **الدورات**, select **دورة جديدة**, and
   assign the director's own account as the presenting instructor.
3. Create the scheduled lesson with **إضافة حصة**.
4. Under **الحصص**, choose **استوديو البث الخاص بي**.
5. Before the lesson, use **فحص الكاميرا والميكروفون قبل البث**. The browser
   requests permission only when the director clicks it, tests both sources,
   and releases the media tracks immediately.
6. Starting 15 minutes before the scheduled lesson, click **فتح استوديو البث**.
   Connecting to the room does not automatically activate camera or microphone.
7. Inside the studio, click **ابدئي البث الآن** to turn on the director's
   microphone and camera. The browser controls device permissions.
8. Use **مشاركة الشاشة** for the science slide deck or demonstration.
9. Watch **رفع اليد**, grant individual student microphone/camera permission
   on request, revoke access, mute all children or remove disruptive users.
   A child must still click their own controls and grant browser permission.
10. **إنهاء الحصة للجميع** closes the LiveKit room and marks the class ended.
    Simply leaving the room does NOT finish the class for everyone.

## Student steps
1. Only a student with an approved booking can access the lesson.
2. From **لوحة الطالب** > **جدول الحصص**, click **مشاهدة البث**.
3. The room opens no earlier than 15 minutes before the scheduled lesson, and
   closes 30 minutes after its scheduled end. The browser button is disabled
   outside the access window; the backend enforces the identical limits.
4. In the LiveKit room, students start with subscribe-only grants and cannot
   publish audio, video, screen sharing, or messages by default.
5. Students watch the director's camera or shared screen and may need to press
   **اضغط هنا لتشغيل صوت الدرس** due to browser autoplay protection.
6. Students can raise their hand; only the director can grant microphone or
   camera publishing. Students retain control of their own devices.
7. Signed classroom attendance is recorded on actual room join webhooks,
   rather than by merely requesting a token.

## Technical controls and status
- Instructor LiveKit room tokens include roomJoin, roomAdmin, canPublish, and
  canPublishData. Student tokens have canPublish=false and canPublishData=false
  until a specific permission is granted via server moderation.
- The backend checks authentication, session validity, enrollment approval,
  lesson status, booking ban list, and the join time window on every token.
- Identity metadata is assigned server-side using the actual authenticated
  account role; user-supplied roles cannot forge host metadata.
- The video component picks a connected director over a scheduled teacher,
  including when a course was previously assigned to that other teacher.
- Teachers and students are still blocked from production APIs while the
  public application remains in administrator-only launch mode.
- Preview screens are not live streams. The studio displays *broadcast
  running* only when the instructor has activated media publishing.
- Current verified tests: 42 mocked LiveKit moderation checks; director-first
  media selection; mobile and desktop separate admin/student interface tests;
  director camera/microphone preflight; admin-only and guest API security.
- LiveKit Cloud's management API has responded successfully from Render.
  A *real* simultaneous two-device audio/video run using approved school
  accounts is a remaining acceptance test before public student launch.
- The platform does not automatically record children or broadcast outside
  the lesson room.

## Release gates
Public student registration and payment remain closed until legal guardian
consent text, support contact, refund policy, private proof storage, and
outgoing email requirements are approved and tested. Do not override this
safety gate solely to run an unauthorized child-account demonstration.
