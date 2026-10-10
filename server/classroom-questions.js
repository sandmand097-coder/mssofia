// Private, moderated teacher-student text questions during live lessons.
// Students see only their own conversation; peers never see children's texts.
import rateLimit from 'express-rate-limit';

export const classroomQuestionsEnabled=()=>process.env.CLASSROOM_QA_ENABLED==='true';
const response=(res,status,data)=>res.status(status).json(data);
const questionLimiter=rateLimit({
 windowMs:60000,limit:7,standardHeaders:'draft-8',legacyHeaders:false,
 message:{error:'تم إرسال عدد كبير من الأسئلة، انتظر دقيقة'}
});
const isLive=lesson=>{
 const start=Date.parse(lesson.starts_at);
 return lesson.status==='scheduled'&&Number.isFinite(start)
  &&Date.now()>=start-15*60000
  &&Date.now()<=start+(lesson.duration_minutes+30)*60000;
};

export function attachClassroomQuestions(app,{auth,role,get,all,run,uid,now,roomLesson,roomPermitted,isLessonHost}){
 app.get('/api/lessons/:id/questions',auth,async(req,res,next)=>{
  try{
   if(!classroomQuestionsEnabled())return response(res,503,{error:'دردشة الفصل لم تُفعّل بعد'});
   const lesson=await roomLesson(req.params.id);
   if(!lesson)return response(res,404,{error:'الحصة غير موجودة'});
   if(!(await roomPermitted(lesson,req.user)))return response(res,403,{error:'غير مسموح بعرض أسئلة هذه الحصة'});
   const host=isLessonHost(lesson,req.user);
   const rows=host?
    await all(`SELECT q.id,q.student_id,u.name AS student_name,q.body,q.answer,q.created_at,q.answered_at
     FROM lesson_questions q JOIN users u ON u.id=q.student_id
     WHERE q.lesson_id=? ORDER BY q.created_at DESC LIMIT 100`,lesson.id):
    await all(`SELECT id,body,answer,created_at,answered_at
     FROM lesson_questions WHERE lesson_id=? AND student_id=?
     ORDER BY created_at DESC LIMIT 50`,lesson.id,req.user.id);
   res.set('Cache-Control','no-store, private').json({questions:rows.reverse(),isHost:host});
  }catch(error){next(error)}
 });

 app.post('/api/lessons/:id/questions',auth,role('student'),questionLimiter,async(req,res,next)=>{
  try{
   if(!classroomQuestionsEnabled())return response(res,503,{error:'دردشة الفصل غير متاحة'});
   const lesson=await roomLesson(req.params.id);
   if(!lesson)return response(res,404,{error:'الحصة غير موجودة'});
   if(!(await roomPermitted(lesson,req.user)))return response(res,403,{error:'الاشتراك غير صالح لدخول الفصل'});
   if(!isLive(lesson))return response(res,403,{error:'الأسئلة متاحة أثناء الحصة فقط'});
   const body=typeof req.body?.message==='string'?req.body.message.trim():'';
   if(!body||body.length>300||/[<>]/.test(body)||/(https?:\/\/|www\.|\b\S+@\S+\.\S+\b)/i.test(body))
    return response(res,400,{error:'اكتب سؤالًا من 1 إلى 300 حرفًا دون روابط أو بيانات تواصل'});
   const id=uid();
   await run('INSERT INTO lesson_questions(id,lesson_id,student_id,body,created_at) VALUES(?,?,?,?,?)',id,lesson.id,req.user.id,body,now());
   res.status(201).json({ok:true,id,message:'تم إرسال السؤال إلى المعلمة'});
  }catch(error){next(error)}
 });

 app.patch('/api/lessons/:id/questions/:questionId',auth,role('teacher','admin'),async(req,res,next)=>{
  try{
   if(!classroomQuestionsEnabled())return response(res,503,{error:'دردشة الفصل غير متاحة'});
   const lesson=await roomLesson(req.params.id);
   if(!lesson)return response(res,404,{error:'الحصة غير موجودة'});
   if(!isLessonHost(lesson,req.user))return response(res,403,{error:'الرد متاح لمقدمة الحصة فقط'});
   const answer=typeof req.body?.answer==='string'?req.body.answer.trim():'';
   if(!answer||answer.length>500)return response(res,400,{error:'الرد يجب أن يكون بين 1 و500 حرف'});
   const saved=await run('UPDATE lesson_questions SET answer=?,answered_at=?,answered_by=? WHERE id=? AND lesson_id=? AND answer IS NULL',
    answer,now(),req.user.id,req.params.questionId,lesson.id);
   if(!saved.changes)return response(res,409,{error:'السؤال غير موجود أو تمت الإجابة عنه سابقًا'});
   res.json({ok:true});
  }catch(error){next(error)}
 });
}
