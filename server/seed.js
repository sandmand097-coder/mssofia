import bcrypt from 'bcryptjs';
import {get,run,uid,now} from './db.js';
if(process.env.NODE_ENV==='production') throw Error('Demo seeding is disabled in production');
const users=[
 ['مدير المنصة',process.env.ADMIN_EMAIL,process.env.ADMIN_PASSWORD,'admin',''],
 ['أحمد محمود',process.env.DEMO_TEACHER_EMAIL,process.env.DEMO_TEACHER_PASSWORD,'teacher','الرياضيات والعلوم'],
 ['سارة محمد',process.env.DEMO_STUDENT_EMAIL,process.env.DEMO_STUDENT_PASSWORD,'student','']
];
for(const [name,email,password,role,specialty] of users){
 if(!email || !password)throw Error('Set all demo credentials in .env');
 if(!get('SELECT id FROM users WHERE email=?',email))
 run('INSERT INTO users(id,name,email,password_hash,role,status,specialty,created_at) VALUES(?,?,?,?,?,?,?,?)',uid(),name,email,bcrypt.hashSync(password,12),role,'active',specialty,now());
}
const teacher=get('SELECT id FROM users WHERE email=?',process.env.DEMO_TEACHER_EMAIL).id;
const student=get('SELECT id FROM users WHERE email=?',process.env.DEMO_STUDENT_EMAIL).id;
const samples=[
 ['أساسيات الجبر بطريقة سهلة','تعلم المعادلات وحل المسائل خطوة بخطوة مع أمثلة عملية.','رياضيات','الإعدادي',0,60,25],
 ['الفيزياء الممتعة','استكشف الحركة والقوة والطاقة بتجارب تفاعلية.','فيزياء','الثانوي',180,75,20],
 ['اللغة الإنجليزية بثقة','محادثات وتدريب عملي على مهارات اللغة الإنجليزية.','إنجليزي','الإعدادي',150,60,30],
 ['رحلة في عالم الأحياء','فهم الخلايا وأعضاء الجسم بأسلوب مبسط.','أحياء','الثانوي',200,90,20],
 ['رياضيات المتفوقين','حل أسئلة متقدمة والتدريب على الامتحانات.','رياضيات','الثانوي',220,90,18],
 ['العلوم من حولنا','تجارب واكتشافات من حياتنا اليومية.','علوم','الابتدائي',0,50,35]
];
for(let i=0;i<samples.length;i++){
 const [title,description,subject,level,price,duration,capacity]=samples[i];
 let c=get('SELECT id FROM courses WHERE title=? AND teacher_id=?',title,teacher);
 if(!c){c={id:uid()};run('INSERT INTO courses(id,title,description,subject,level,price,duration_minutes,capacity,teacher_id,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',c.id,title,description,subject,level,price,duration,capacity,teacher,'published',now());}
 if(!get('SELECT id FROM lessons WHERE course_id=?',c.id)){
  for(let n=1;n<=3;n++){const date=new Date(Date.now()+(i+n)*86400000);date.setUTCHours(16+i%5,0,0,0);run('INSERT INTO lessons(id,course_id,title,starts_at,duration_minutes,status,room_key,created_at) VALUES(?,?,?,?,?,?,?,?)',uid(),c.id,'الحصة '+n+' - '+subject,date.toISOString(),duration,'scheduled',uid(),now());}
 }
 if(i<2 && !get('SELECT id FROM bookings WHERE course_id=? AND student_id=?',c.id,student))run('INSERT INTO bookings(id,course_id,student_id,status,created_at) VALUES(?,?,?,?,?)',uid(),c.id,student,i===0?'approved':'pending',now());
}
console.log('Demo data ready. Accounts stored in LOCAL_ACCESS.txt');
