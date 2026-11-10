const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const app = express();
app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(__dirname,'public')));

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname,'data');
const DB_FILE = path.join(DATA_DIR,'db.json');
const TEACHER_PIN = process.env.TEACHER_PIN || '1234';
fs.mkdirSync(DATA_DIR,{recursive:true});
if(!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({exam:null,attempts:[]},null,2));
const read=()=>JSON.parse(fs.readFileSync(DB_FILE,'utf8'));
const write=(db)=>{const t=DB_FILE+'.tmp';fs.writeFileSync(t,JSON.stringify(db,null,2));fs.renameSync(t,DB_FILE)};
const id=()=>crypto.randomUUID();
const auth=(req,res,next)=> req.headers['x-teacher-pin']===TEACHER_PIN ? next() : res.status(401).json({error:'รหัสครูไม่ถูกต้อง'});
const clean=s=>String(s||'').trim().slice(0,100);

app.get('/api/health',(req,res)=>res.json({ok:true}));
app.get('/api/exam/public',(req,res)=>{const e=read().exam;if(!e||!e.active)return res.status(404).json({error:'ยังไม่มีข้อสอบที่เปิดใช้งาน'});res.json({id:e.id,title:e.title,durationMinutes:e.durationMinutes,questionCount:e.questions.length,updatedAt:e.updatedAt})});
app.post('/api/attempts/start',(req,res)=>{
 const studentId=clean(req.body.studentId),studentName=clean(req.body.studentName); if(!studentId||!studentName)return res.status(400).json({error:'กรุณากรอกเลขประจำตัวและชื่อ'});
 const db=read(),e=db.exam;if(!e||!e.active)return res.status(404).json({error:'ยังไม่มีข้อสอบที่เปิดใช้งาน'});
 const duplicate=db.attempts.find(a=>a.examId===e.id&&a.studentId===studentId&&!a.finishedAt);
 if(duplicate)return res.json({token:duplicate.token,expiresAt:duplicate.expiresAt,title:e.title,total:e.questions.length,nextIndex:duplicate.answers.length});
 const now=Date.now(),a={id:id(),token:crypto.randomBytes(24).toString('hex'),examId:e.id,studentId,studentName,startedAt:new Date(now).toISOString(),expiresAt:new Date(now+e.durationMinutes*60000).toISOString(),answers:[],score:0,finishedAt:null};
 db.attempts.push(a);write(db);res.json({token:a.token,expiresAt:a.expiresAt,title:e.title,total:e.questions.length,nextIndex:0});
});
function getAttempt(token){const db=read(),a=db.attempts.find(x=>x.token===token),e=db.exam;return {db,a,e}}
app.get('/api/attempts/:token/next',(req,res)=>{
 const {db,a,e}=getAttempt(req.params.token);if(!a||!e||a.examId!==e.id)return res.status(404).json({error:'ไม่พบการทำข้อสอบ'});
 if(a.finishedAt)return res.json({finished:true,score:a.score,total:e.questions.length});
 if(Date.now()>new Date(a.expiresAt).getTime()){a.finishedAt=new Date().toISOString();write(db);return res.status(410).json({error:'หมดเวลาทำข้อสอบ',finished:true,score:a.score,total:e.questions.length})}
 const i=a.answers.length;if(i>=e.questions.length){a.finishedAt=new Date().toISOString();write(db);return res.json({finished:true,score:a.score,total:e.questions.length})}
 const q=e.questions[i];res.json({finished:false,index:i,number:i+1,text:q.text,choices:q.choices,expiresAt:a.expiresAt,total:e.questions.length});
});
app.post('/api/attempts/:token/answer',(req,res)=>{
 const {db,a,e}=getAttempt(req.params.token);if(!a||!e||a.examId!==e.id)return res.status(404).json({error:'ไม่พบการทำข้อสอบ'});
 if(a.finishedAt)return res.status(409).json({error:'ส่งข้อสอบแล้ว ไม่สามารถแก้ไขได้'});
 if(Date.now()>new Date(a.expiresAt).getTime()){a.finishedAt=new Date().toISOString();write(db);return res.status(410).json({error:'หมดเวลาทำข้อสอบ'});}
 const i=a.answers.length,q=e.questions[i],choice=Number(req.body.choice);if(!q||!Number.isInteger(choice)||choice<0||choice>=q.choices.length)return res.status(400).json({error:'คำตอบไม่ถูกต้อง'});
 const correct=choice===q.correct; a.answers.push({question:i+1,choice,choiceText:q.choices[choice],correct,correctChoice:q.correct,correctText:q.choices[q.correct],answeredAt:new Date().toISOString()});if(correct)a.score++;
 if(a.answers.length===e.questions.length)a.finishedAt=new Date().toISOString();write(db);
 res.json({correct,correctChoice:q.correct,correctText:q.choices[q.correct],finished:!!a.finishedAt,score:a.score,total:e.questions.length});
});
app.get('/api/teacher/exam',auth,(req,res)=>res.json(read().exam));
app.put('/api/teacher/exam',auth,(req,res)=>{
 const title=clean(req.body.title)||'ชุดติวข้อสอบ';const durationMinutes=Number(req.body.durationMinutes);const qs=req.body.questions;
 if(!Number.isFinite(durationMinutes)||durationMinutes<1||durationMinutes>300)return res.status(400).json({error:'เวลาอยู่ระหว่าง 1-300 นาที'});
 if(!Array.isArray(qs)||qs.length<1||qs.length>200)return res.status(400).json({error:'ต้องมี 1-200 ข้อ'});
 const questions=qs.map((q,i)=>({text:clean(q.text)||`ข้อ ${i+1}`,choices:(q.choices||[]).map(clean).filter(Boolean),correct:Number(q.correct)}));
 if(questions.some(q=>q.choices.length<2||q.choices.length>6||!Number.isInteger(q.correct)||q.correct<0||q.correct>=q.choices.length))return res.status(400).json({error:'แต่ละข้อต้องมี 2-6 ตัวเลือกและกำหนดเฉลยให้ถูกต้อง'});
 const db=read();db.exam={id:id(),title,durationMinutes,active:req.body.active!==false,questions,updatedAt:new Date().toISOString()};db.attempts=[];write(db);res.json({ok:true,exam:db.exam});
});
app.get('/api/teacher/results',auth,(req,res)=>{const db=read(),e=db.exam;res.json({exam:e?{title:e.title,total:e.questions.length}:null,attempts:db.attempts.filter(a=>e&&a.examId===e.id).map(a=>({studentId:a.studentId,studentName:a.studentName,startedAt:a.startedAt,finishedAt:a.finishedAt,score:a.score,total:e.questions.length,answers:a.answers}))})});
app.delete('/api/teacher/results',auth,(req,res)=>{const db=read();db.attempts=[];write(db);res.json({ok:true})});
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'เกิดข้อผิดพลาดในระบบ'})});
const port=process.env.PORT||3000;app.listen(port,()=>console.log(`Exam tutor running on :${port}`));
