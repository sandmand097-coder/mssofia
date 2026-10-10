import assert from 'node:assert/strict';
import {cairoParts,cairoLocalToISO,initialLessonTime,fieldsFromScheduledLesson,hours24,minutes5} from '../src/components/cairo-lesson-time.js';

const summer=cairoLocalToISO('2026-10-10','16','30');
assert.equal(summer,'2026-10-10T13:30:00.000Z','Cairo uses daylight time on 10 October 2026');
assert.deepEqual(cairoParts(summer),{date:'2026-10-10',hour:'16',minute:'30'});
assert.equal(cairoLocalToISO('2026-01-10','09','05'),'2026-01-10T07:05:00.000Z','Cairo uses winter UTC+2');
assert.deepEqual(fieldsFromScheduledLesson('2026-01-10T07:05:00.000Z'),{lesson_date:'2026-01-10',lesson_hour:'09',lesson_minute:'05'});
assert.throws(()=>cairoLocalToISO('2026-10-10','16','--'),/دقائق/);
assert.throws(()=>cairoLocalToISO('2026-02-30','16','30'),/غير صحيح/);
assert.throws(()=>cairoLocalToISO('2026-10-10','25','30'),/حددي/);
const defaults=initialLessonTime(new Date('2026-10-10T12:10:00.000Z'));
assert.equal(defaults.lesson_date,'2026-10-10');
assert.equal(Number(defaults.lesson_hour),16);
assert.equal(Number(defaults.lesson_minute)%5,0);
assert.deepEqual([hours24.length,minutes5.length],[24,12]);
assert.ok(hours24.includes('16')&&minutes5.includes('30'));
console.log('PASS 11 Cairo timezone, DST, 24-hour scheduling and incomplete-date prevention tests');
