// Public science discovery prompts. No grades, tracking, accounts, requests
// or persistent student data: this is a playful visitor-only learning sample.
export const SCIENCE_DISCOVERIES=Object.freeze([
 Object.freeze({
  id:'lightning',
  subject:'الفيزياء',
  icon:'lightning',
  title:'ليه بنشوف البرق قبل ما نسمع الرعد؟',
  choices:Object.freeze(['لأن الضوء أسرع من الصوت','لأن الصوت أسرع من الضوء']),
  correctIndex:0,
  explanation:'الضوء بيوصل لعينا أسرع بكتير من صوت الرعد، علشان كده بنشوف الوميض الأول.',
  discovery:'السر في سرعة الضوء!'
 }),
 Object.freeze({
  id:'plant',
  subject:'الأحياء',
  icon:'plant',
  title:'النبات بيستخدم ضوء الشمس في إيه؟',
  choices:Object.freeze(['علشان يطلع صوت','علشان يصنع غذاءه']),
  correctIndex:1,
  explanation:'النبات بيستخدم طاقة الضوء في البناء الضوئي علشان يصنع غذاءه وينمو.',
  discovery:'النبات عنده مطبخ طبيعي!'
 }),
 Object.freeze({
  id:'moon',
  subject:'الفلك',
  icon:'moon',
  title:'نور القمر اللي بنشوفه جاي منين؟',
  choices:Object.freeze(['القمر بيعكس ضوء الشمس','القمر بينتج الضوء بنفسه']),
  correctIndex:0,
  explanation:'القمر مش مصدر للضوء المرئي بنفسه؛ إحنا بنشوف ضوء الشمس المنعكس عن سطحه.',
  discovery:'القمر مرآة للضوء!'
 })
]);
export function evaluateDiscovery(discovery,selectedIndex){
 if(!discovery||!Number.isInteger(selectedIndex)||selectedIndex<0||selectedIndex>=discovery.choices.length)return null;
 return discovery.correctIndex===selectedIndex;
}
export function nextDiscoveryIndex(current,length=SCIENCE_DISCOVERIES.length){
 return Number.isInteger(current)&&Number.isInteger(length)&&length>0?(current+1)%length:0;
}
