// All classroom schedules are entered and displayed in Africa/Cairo time.
// Separate 24-hour hour/minute selectors avoid incomplete browser AM/PM fields.
const ZONE='Africa/Cairo';
const pad=value=>String(value).padStart(2,'0');

export function cairoParts(instant){
 const value=instant instanceof Date?instant:new Date(instant);
 if(!Number.isFinite(value.getTime()))throw Error('تاريخ الحصة غير صالح');
 const parts=new Intl.DateTimeFormat('en-GB',{
  timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
 }).formatToParts(value);
 const obj=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return {date:obj.year+'-'+obj.month+'-'+obj.day,hour:obj.hour,minute:obj.minute};
}

function cairoOffsetAt(timestamp){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:ZONE,timeZoneName:'longOffset'}).formatToParts(new Date(timestamp));
 const offset=parts.find(x=>x.type==='timeZoneName')?.value||'';
 if(offset==='GMT'||offset==='UTC')return 0;
 const match=/^(?:GMT|UTC)([+-])(\d{2}):(\d{2})$/.exec(offset);
 if(!match)throw Error('تعذر التأكد من توقيت القاهرة');
 return (match[1]==='-'?-1:1)*(Number(match[2])*60+Number(match[3]));
}

export function cairoLocalToISO(date,hour,minute){
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date||''));
 const hh=String(hour??''),mm=String(minute??'');
 if(!match||!/^(?:[01]\d|2[0-3])$/.test(hh)||!/^[0-5]\d$/.test(mm))
  throw Error('حددي تاريخ الحصة والساعة والدقائق كاملة (بتوقيت القاهرة)');
 const y=+match[1],m=+match[2],d=+match[3],h=+hh,n=+mm;
 const wall=Date.UTC(y,m-1,d,h,n);
 const inspected=new Date(wall);
 if(y<2024||y>2100||inspected.getUTCFullYear()!==y||inspected.getUTCMonth()!==m-1||inspected.getUTCDate()!==d)
  throw Error('تاريخ الحصة غير صحيح');
 let utc=wall-cairoOffsetAt(wall)*60000;
 utc=wall-cairoOffsetAt(utc)*60000;
 const verified=cairoParts(utc);
 if(verified.date!==date||verified.hour!==hh||verified.minute!==mm)
  throw Error('الموعد غير موجود بسبب تغيير التوقيت الصيفي؛ اختاري وقتًا آخر');
 return new Date(utc).toISOString();
}

export function initialLessonTime(after=new Date()){
 const future=new Date(after.getTime()+60*60000);
 future.setUTCSeconds(0,0);
 future.setUTCMinutes(Math.ceil(future.getUTCMinutes()/5)*5);
 const {date,hour,minute}=cairoParts(future);
 return {lesson_date:date,lesson_hour:hour,lesson_minute:minute};
}
export function fieldsFromScheduledLesson(startsAt){
 const {date,hour,minute}=cairoParts(startsAt);
 return {lesson_date:date,lesson_hour:hour,lesson_minute:minute};
}
export const hours24=Array.from({length:24},(_,hour)=>pad(hour));
export const minutes5=Array.from({length:12},(_,i)=>pad(i*5));
