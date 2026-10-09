import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Safe public launch phase: marketing is live; accounts and payments remain unavailable.
// Database, authentication, and live classroom are activated only after secure cloud setup.
const app=express();
const port=Number(process.env.PORT||4010);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:false}));
const cloudVideoPrepared=Boolean(/^wss:\/\/[^/]+\.livekit\.cloud\/?$/i.test(process.env.LIVEKIT_URL||'')&&process.env.LIVEKIT_API_KEY&&process.env.LIVEKIT_API_SECRET);
app.get('/api/health',(req,res)=>res.json({ok:true,mode:'preview',registrationAvailable:false,videoConfigured:false,videoCloudReady:cloudVideoPrepared,videoMode:'preview-disabled'}));
app.get('/api/auth/registration-status',(req,res)=>res.json({registrationAvailable:false,emailMode:'disabled'}));
app.get('/api/auth/me',(req,res)=>res.status(401).json({error:'لم يتم تسجيل الدخول'}));
app.get('/api/courses',(req,res)=>res.json({courses:[]}));
app.use('/api',(req,res)=>res.status(503).json({error:'خدمة تسجيل الطلاب والحصص غير متاحة أثناء الإطلاق التعريفي. سيتم الإعلان عن موعد فتح التسجيل.'}));
app.use(express.static(path.join(root,'dist'),{maxAge:'1h',immutable:false}));
app.get('/{*splat}',(req,res)=>res.sendFile(path.join(root,'dist','index.html'),err=>{if(err&&!res.headersSent)res.status(404).end()}));
app.listen(port,process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1',()=>console.log('Mrs Sofia public introduction is running safely on port '+port));
