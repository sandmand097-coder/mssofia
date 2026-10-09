import fs from 'node:fs';
import crypto from 'node:crypto';
const random=()=>crypto.randomBytes(24).toString('hex');
if (fs.existsSync(new URL('./.env',import.meta.url))) {
 console.log('Existing environment kept. Nothing overwritten.');
 process.exit(0);
}
const admin=random(),teacher=random(),student=random();
const env=['PORT=4010','NODE_ENV=development','JWT_SECRET='+crypto.randomBytes(48).toString('hex'),'ADMIN_EMAIL=admin@madrasati.local','ADMIN_PASSWORD='+admin,'DEMO_TEACHER_EMAIL=teacher@madrasati.local','DEMO_TEACHER_PASSWORD='+teacher,'DEMO_STUDENT_EMAIL=student@madrasati.local','DEMO_STUDENT_PASSWORD='+student,'LIVEKIT_URL=','LIVEKIT_API_KEY=','LIVEKIT_API_SECRET='].join('\n');
fs.writeFileSync(new URL('./.env',import.meta.url),env+'\n');
fs.writeFileSync(new URL('./LOCAL_ACCESS.txt',import.meta.url),['LOCAL DEMO CREDENTIALS - KEEP PRIVATE','Admin: admin@madrasati.local / '+admin,'Teacher: teacher@madrasati.local / '+teacher,'Student: student@madrasati.local / '+student].join('\n'));
console.log('Local environment configured');
