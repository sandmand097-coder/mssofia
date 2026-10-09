# Mrs Sofia — ربط حساب Google الجديد وإدارة Supabase

## 1. لماذا Supabase فارغ في حساب Google الجديد؟

مشروع قاعدة بيانات المدرسة `mrsofia` موجود بالفعل ويعمل في Supabase، بمعرّف:

`jtluslevdmcpxxkngomj`

لكنه يخص منظمة Supabase الحالية، المعرّف `isqwkgnchmcgxyrovlcc`.

الحساب الجديد في المتصفح لا يمتلك صلاحية عضوية هذه المنظمة. تسجيل الدخول بنفس Gmail في متصفح آخر أو استخدام GitHub بحساب جديد **لا ينقل ملكية قاعدة البيانات**.

### الإجراء الآمن الذي يجب أن يعتمده مالك المنظمة

1. من حساب Supabase **المالك للمنظمة الحالية**، افتح صفحة الفريق:
   https://supabase.com/dashboard/org/isqwkgnchmcgxyrovlcc/team
2. اختر Invite وأدخل بريد Google الجديد الذي تريد إدارة المدرسة به.
3. امنحه Administrator للمشروع `mrsofia` أو المنظمة حسب احتياجك؛ لا تمنح Owner إلا إذا كنت تنقل مسؤولية الملكية عن قصد.
4. افتح رسالة الدعوة من حساب Google الجديد واقبلها خلال 24 ساعة.
5. أعد فتح https://supabase.com/dashboard/project/jtluslevdmcpxxkngomj بالحساب الجديد. عند ظهور المشروع تكون صلاحيات الحساب مرتبطة رسميًا.

لو حساب المالك الأصلي غير متاح، يجب طلب الدعوة من صاحب المنظمة أو التواصل مع دعم Supabase لإثبات الملكية. لا تنشئ مشروعًا ثانيًا أو تنقل البيانات خلسة. الإضافة إلى المنظمة متاحة من واجهة المالك، وليست ضمن صلاحيات أداة Supabase المتصلة بهذه المحادثة.

المرجع: https://supabase.com/docs/guides/platform/access-control

## 2. تسجيل دخول مديرة المدرسة عبر Google نفسه

أُعد في الموقع دعم **Google Identity Services** لتسجيل دخول المديرة بحساب Google، لكن لن يظهر الزر إلا بعد تفعيل الإعدادات. ربط بريد Gmail وحده لا يصنع حساب Admin.

الربط الآمن يفحص:
- صحة Google ID Token، وأنه صادر من Google ومخصص للـOAuth Client الخاص بموقع المدرسة
- إثبات Google أن البريد الإلكتروني Verified
- مطابقة البريد حرفيًا مع البريد المصرح له في إعدادات المدرسة، بصرف النظر عن حالة الأحرف
- وجود حساب `admin` مسبقًا، نشط ومعتمد، بنفس البريد في قاعدة Supabase
- مطابقة Google `sub` الثابت بعد أول ربط حتى لا يستطيع حساب مختلف استبدال هوية المديرة
- الجلسة تُحفظ في Cookie مؤمّن وHttpOnly، مع صلاحيات تحددها قاعدة البيانات دائمًا

### إعداد Google Cloud OAuth

1. افتح https://console.cloud.google.com/ وأنشئ مشروع Google Cloud أو اختر مشروعًا تحت سيطرتك.
2. افتح Google Auth Platform > Branding، وسجّل اسم التطبيق `Mrs Sofia` ومعلومات التواصل المناسبة.
3. ضمن Audience، إن كان المشروع في وضع Testing أضف بريد المديرة إلى Test users.
4. افتح Clients وأنشئ OAuth Client ID من نوع **Web application**.
5. أضف **Authorized JavaScript origins**:
   `https://mssofia.onrender.com`
6. إذا تم شراء الدومين لاحقًا، أضف Origin الجديد بعد عمل HTTPS أيضًا.
7. انسخ `Client ID` فقط؛ هذه الطريقة تستخدم Google Identity Services ومكتبة Google الرسمية للتحقق من ID Token على الخادم، ولا تحتاج Client Secret أو Redirect URI مخصصًا.

في Render > Web Service `mssofia` > Environment، أضف:

```text
GOOGLE_OAUTH_CLIENT_ID=<web-client-id-ending-.apps.googleusercontent.com>
GOOGLE_ADMIN_EMAIL=<verified-school-director-gmail>
GOOGLE_ADMIN_LOGIN_ENABLED=true
```

**تنبيه:** لا تضبط `GOOGLE_ADMIN_LOGIN_ENABLED=true` إلا بعد وجود حساب إدارة فعلي مسجل مسبقًا بالبريد نفسه، واتصال PostgreSQL الآمن، وتجربة عملية تسجيل دخول. الإعداد الافتراضي `false`؛ ولن تتم ترقية طلاب أو زوار إلى Admin بأي شكل.

## 3. وضع الإطلاق الحالي

الوضع العام `PUBLIC_LAUNCH_MODE=preview` يعرض موقع المدرسة والعروض والصفحات العامة ولا يتيح تسجيل الطلاب أو لوحة الإدارة. إبقاؤه هو الإجراء الصحيح حتى الانتهاء من تجهيز قاعدة البيانات وبريد المدرسة والتحقق من السياسات وLiveKit Webhook. ربط Google ليس بديلًا عن هذه الخطوات.

## 4. كيفية اختبار الدخول دون تعريض بيانات الأطفال

- اختبر أولًا إرجاع `GET /api/auth/google/config` لحالة Enabled الصحيحة في البيئة الخاصة.
- افتح صفحة تسجيل الدخول من متصفح حديث مع بريد المديرة المعتمد.
- اختبر أن البريد غير المخول لا يستطيع الدخول وأن الطالب لا يستطيع الوصول إلى `/admin`.
- تأكد من أن تعطيل حساب المديرة أو تغيير Session Version يبطل الدخول.
- راجع لوحة Render Logs بدون تسجيل Google ID Tokens أو كلمات المرور.
- بعد نجاح الاتصال بالبريد والقاعدة، اختبر أول اشتراك بإيصال اختباري؛ رفع الإيصال لا يفعل الدورة دون موافقة الإدارة اليدوية.

هذه الخطوات لا تؤثر في GitHub أو Render أو LiveKit الحالي، ولا تنقل ملكية قاعدة البيانات من دون موافقة المالك.
