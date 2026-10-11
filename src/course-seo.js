import {SEO_ORIGIN} from './public-seo.js';
const normalized=(value,max)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
export function coursePublicSeo(course){
 if(!course||!course.id||!course.title)return null;
 const name=normalized(course.title,90),subject=normalized(course.subject||'العلوم',55);
 const detail=normalized(course.description,120);
 const title=normalized(name+' | مس صوفيا للعلوم',140);
 const description=normalized(
  (detail?detail+'. ':'')+'تعرف على كورس '+name+' في '+subject+' مع مس صوفيا للعلوم، ومحتوى الحصص ومواعيد الدروس وكيفية الاشتراك.',
  160
 );
 return {title,description,canonical:SEO_ORIGIN+'/courses/'+encodeURIComponent(String(course.id))};
}
