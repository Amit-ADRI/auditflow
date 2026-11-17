import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs/promises'
import XLSX from 'xlsx'
import session from 'express-session'
import { RedisStore } from 'connect-redis'
import { createClient } from 'redis'
import bcrypt from 'bcryptjs'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { PrismaClient } from '@prisma/client'
import { seed } from './data.js'
import { saveFile, storageMode } from './storage.js'

const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })
const dataFile = path.resolve('server/data.json')
let data
try { data = JSON.parse(await fs.readFile(dataFile, 'utf8')) } catch { data = structuredClone(seed) }
data = { ...structuredClone(seed), ...data, settings:{...seed.settings,...data.settings}, masterOptions:{...seed.masterOptions,...data.masterOptions} }
const persist = () => fs.writeFile(dataFile, JSON.stringify(data, null, 2))
let prisma
if(process.env.DATABASE_URL){
  try{prisma=new PrismaClient();await prisma.$connect();console.log('Database: PostgreSQL')}catch(e){if(process.env.NODE_ENV==='production')throw e;console.warn('PostgreSQL unavailable; using development JSON data:',e.message);prisma=undefined}
}

app.set('trust proxy', 1)
app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false }))
app.use(cors({credentials:true,origin:true}))
app.use(express.json())
let sessionStore
if(process.env.REDIS_URL){
  try{const redisClient=createClient({url:process.env.REDIS_URL});redisClient.on('error',e=>console.error('Redis:',e.message));await redisClient.connect();sessionStore=new RedisStore({client:redisClient,prefix:'auditflow:'});console.log('Session store: Redis')}catch(e){console.warn('Redis unavailable; using development memory sessions:',e.message)}
}
app.use(session({
  store:sessionStore,
  name:'auditflow_session',
  secret:process.env.SESSION_SECRET||'development-only-change-this-secret',
  resave:false,
  saveUninitialized:false,
  rolling:true,
  cookie:{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:8*60*60*1000}
}))
app.use('/uploads', express.static(path.resolve('storage/uploads')))
app.get('/api/health', (_req,res) => res.json({ ok:true, storage:storageMode, database:prisma?'postgresql':'json', sessions:sessionStore?'redis':'memory' }))
const users=await Promise.all([
  {id:'manager-dev',email:process.env.MANAGER_EMAIL||'manager@auditflow.in',password:process.env.MANAGER_PASSWORD||'Audit@123',name:'Priya Nair',role:'manager',initials:'PN'},
  {id:'doctor-dev',email:process.env.DOCTOR_EMAIL||'doctor@auditflow.in',password:process.env.DOCTOR_PASSWORD||'Audit@123',name:'Dr. Ananya Sharma',role:'doctor',initials:'AS',doctorId:Number(process.env.DOCTOR_ID||1)}
].map(async user=>({...user,passwordHash:await bcrypt.hash(user.password,12),password:undefined})))
const failedLogins=new Map()
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many login attempts. Try again in 15 minutes.'}})
app.post('/api/auth/login',loginLimiter,async(req,res)=>{const email=String(req.body.email||'').toLowerCase();let user=prisma?await prisma.user.findUnique({where:{email}}):users.find(x=>x.email.toLowerCase()===email);const lockedUntil=prisma?user?.lockedUntil:failedLogins.get(email)?.lockedUntil;if(lockedUntil&&new Date(lockedUntil).getTime()>Date.now())return res.status(423).json({error:'Account temporarily locked. Try again later.'});const valid=user&&user.status!=='INACTIVE'&&await bcrypt.compare(String(req.body.password||''),user.passwordHash);if(!valid){if(prisma&&user){const attempts=user.failedLoginAttempts+1;await prisma.user.update({where:{id:user.id},data:{failedLoginAttempts:attempts,lockedUntil:attempts>=5?new Date(Date.now()+15*60*1000):null,status:attempts>=5?'LOCKED':user.status}})}else{const state=failedLogins.get(email);const attempts=(state?.attempts||0)+1;failedLogins.set(email,{attempts,lockedUntil:attempts>=5?Date.now()+15*60*1000:0})}return res.status(401).json({error:'Invalid email or password'});}if(prisma)await prisma.user.update({where:{id:user.id},data:{failedLoginAttempts:0,lockedUntil:null,status:'ACTIVE',lastLoginAt:new Date()}});else failedLogins.delete(email);const role=String(user.role).toLowerCase();const safe={id:user.id,email:user.email,name:user.name,role,initials:user.initials||user.name.split(/\s+/).slice(-2).map(x=>x[0]).join('').toUpperCase()};req.session.regenerate(err=>{if(err)return res.status(500).json({error:'Could not create session'});req.session.user=safe;res.json(safe)})})
app.post('/api/auth/logout',(req,res)=>req.session.destroy(()=>{res.clearCookie('auditflow_session');res.status(204).end()}))
app.get('/api/auth/me',(req,res)=>req.session.user?res.json(req.session.user):res.status(401).json({error:'Not authenticated'}))
app.use('/api',(req,res,next)=>{if(!req.session.user)return res.status(401).json({error:'Authentication required'});req.user={...req.session.user};if(req.user.role==='doctor'){const own=users.find(u=>u.id===req.user.id)?.doctorId;req.user.doctorId=own??data.doctors.find(d=>d.name===req.user.name)?.id??null}next()})
const managerOnly=(req,res,next)=>req.user.role==='manager'?next():res.status(403).json({error:'Manager access required'})
const ownsCase=(req,item)=>req.user.role==='manager'||(req.user.doctorId!=null&&item.doctorId===req.user.doctorId)
const doctorView=user=>{const cases=data.cases.filter(c=>user.doctorId!=null&&c.doctorId===user.doctorId);const batchIds=new Set(cases.map(c=>c.batchId));return {...data,cases,batches:data.batches.filter(b=>batchIds.has(b.id)),doctors:data.doctors.filter(d=>d.id===user.doctorId),logs:data.logs.filter(l=>l.actor===user.name),assignmentHistory:[],storageMode}}
app.get('/api/data', (req,res) => res.json(req.user.role==='doctor'?doctorView(req.user):{...data,storageMode}))
const log = (action, detail, actor='Priya Nair') => data.logs.unshift({ time:new Date().toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}), actor, action, detail })
const notify = (title, body) => data.notifications.unshift({ id:Date.now(), title, body, time:'Just now', unread:true })
const mapRow = (r, batchId, index) => ({
  id:String(r['Case ID']||r.caseId||r.CaseID||`CASE-${Date.now()}-${index}`).trim(), batchId, doctorId:null,
  claim:String(r['Claim ID']||r.claimId||r.ClaimID||''), hospital:String(r.Hospital||r.hospital||'Unknown'),
  patient:String(r.Patient||r.patient||r.Beneficiary||''), package:String(r.Package||r.package||''),
  amount:Number(r['Claim Amount']||r.amount||0), approved:Number(r['Approved Amount']||r.approved||0),
  status:'Uploaded', priority:String(r.Priority||'Medium'), due:String(r.Deadline||'Not set')
})
app.post('/api/upload', upload.single('file'), async (req,res,next) => {
  try { if (!req.file) return res.status(400).json({ error:'No file supplied' }); res.status(201).json(await saveFile(req.file, req.body.folder || 'auditflow')) } catch (e) { next(e) }
})
app.post('/api/import/preview', managerOnly, upload.single('file'), async (req,res,next) => {
  try {
    if (!req.file) return res.status(400).json({ error:'No file supplied' })
    const book = XLSX.read(req.file.buffer)
    const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval:'' })
    const seen = new Set(); let duplicates=0, invalid=0
    rows.forEach((r,i) => { const id=String(r['Case ID']||r.caseId||r.CaseID||'').trim(); if(!id) invalid++; else if(seen.has(id)) duplicates++; else seen.add(id); r.__row=i+2 })
    res.json({ fileName:req.file.originalname, total:rows.length, valid:rows.length-invalid-duplicates, invalid, duplicates, columns:rows[0]?Object.keys(rows[0]).filter(k=>k!=='__row'):[], preview:rows.slice(0,5) })
  } catch(e) { next(e) }
})
app.post('/api/import/confirm', managerOnly, upload.single('file'), async (req,res,next) => {
  try {
    if (!req.file) return res.status(400).json({error:'No file supplied'})
    const book=XLSX.read(req.file.buffer); const rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{defval:''})
    const id=`AUD-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`; const seen=new Set(data.cases.map(c=>c.id))
    const cases=rows.map((r,i)=>mapRow(r,id,i)).filter(c=>c.id&&!seen.has(c.id)&&(seen.add(c.id)))
    if(!cases.length) return res.status(400).json({error:'No valid, unique cases found'})
    const batch={id,name:req.body.name||req.file.originalname.replace(/\.[^.]+$/,''),records:cases.length,completed:0,progress:0,pending:cases.length,returned:0,deadline:req.body.deadline||'Not set',status:'Uploaded'}
    data.batches.unshift(batch); data.cases.unshift(...cases); log('Imported audit batch',`${id} · ${cases.length} valid records`); notify('Import completed',`${batch.name} was created with ${cases.length} cases.`); await persist(); res.status(201).json(batch)
  } catch(e){next(e)}
})
app.post('/api/batches', managerOnly, async (req,res) => { const batch={...req.body,id:`AUD-2026-${String(data.batches.length+105).padStart(4,'0')}`}; data.batches.unshift(batch); log('Created audit batch',batch.id); await persist(); res.status(201).json(batch) })
app.patch('/api/cases/:id', managerOnly, async (req,res) => { const item=data.cases.find(x=>x.id===req.params.id); if(!item)return res.status(404).json({error:'Case not found'}); Object.assign(item,req.body); await persist(); res.json(item) })
app.post('/api/assignments', managerOnly, async (req,res) => {
  const {caseIds=[],doctorId,reason='Manual assignment'}=req.body; const doctor=data.doctors.find(d=>d.id===Number(doctorId)); if(!doctor)return res.status(400).json({error:'Doctor not found'})
  let count=0; for(const item of data.cases.filter(c=>caseIds.includes(c.id))){const previous=data.doctors.find(d=>d.id===item.doctorId)?.name||null;item.doctorId=doctor.id;item.status=previous?'Reassigned':'Assigned';data.assignmentHistory.unshift({id:Date.now()+count,caseId:item.id,from:previous,to:doctor.name,reason,by:'Priya Nair',at:new Date().toLocaleString('en-IN')});count++}
  doctor.assigned+=count;doctor.pending+=count;log('Assigned or reassigned cases',`${count} cases to ${doctor.name}`);notify('New audit assignment',`${count} cases were assigned to ${doctor.name}.`);await persist();res.json({count})
})
app.post('/api/audits/:id/draft', async (req,res) => {const item=data.cases.find(x=>x.id===req.params.id);if(!item||!ownsCase(req,item))return res.status(404).json({error:'Case not found'});item.audit={...req.body,draft:true};item.status='In Progress';log('Saved audit draft',item.id,req.user.name);await persist();res.json(item)})
app.post('/api/audits/:id/submit', async (req,res) => { const item=data.cases.find(x=>x.id===req.params.id); if(!item||!ownsCase(req,item))return res.status(404).json({error:'Case not found'}); if(!req.body.result||!req.body.decision)return res.status(400).json({error:'Audit result and final decision are required'}); item.status='Submitted'; item.audit={...req.body,draft:false,submittedAt:new Date().toISOString()}; log('Submitted audit',item.id,req.user.name); notify('Audit submitted',`${item.id} is ready for manager review.`); await persist(); res.json(item) })
app.post('/api/audits/:id/review', managerOnly, async (req,res) => {const item=data.cases.find(x=>x.id===req.params.id);if(!item)return res.status(404).json({error:'Case not found'});item.status=req.body.action==='return'?'Returned':'Completed';item.review={...req.body,at:new Date().toISOString()};log(req.body.action==='return'?'Returned audit':'Completed review',item.id);await persist();res.json(item)})
app.post('/api/doctors', managerOnly, async (req,res) => {if(!req.body.name)return res.status(400).json({error:'Name required'});const initials=req.body.name.split(/\s+/).filter(Boolean).slice(-2).map(x=>x[0]).join('').toUpperCase();const doctor={id:Math.max(0,...data.doctors.map(d=>d.id))+1,name:req.body.name,initials,specialty:req.body.specialty||'General Audit',assigned:0,completed:0,pending:0,avg:'—',score:0,status:'Active'};data.doctors.push(doctor);log('Added doctor',doctor.name);await persist();res.status(201).json(doctor)})
app.patch('/api/doctors/:id',managerOnly,async(req,res)=>{const d=data.doctors.find(x=>x.id===Number(req.params.id));if(!d)return res.status(404).json({error:'Doctor not found'});Object.assign(d,req.body);log('Updated doctor',d.name);await persist();res.json(d)})
app.post('/api/masters/:group',managerOnly,async(req,res)=>{const list=data.masterOptions[req.params.group];if(!list)return res.status(404).json({error:'Master group not found'});const value=String(req.body.value||'').trim();if(!value||list.includes(value))return res.status(400).json({error:'Value is empty or already exists'});list.push(value);log('Updated master options',`${req.params.group}: added ${value}`);await persist();res.json(list)})
app.delete('/api/masters/:group/:value',managerOnly,async(req,res)=>{const list=data.masterOptions[req.params.group];if(!list)return res.status(404).json({error:'Master group not found'});data.masterOptions[req.params.group]=list.filter(x=>x!==decodeURIComponent(req.params.value));await persist();res.status(204).end()})
app.patch('/api/settings',managerOnly,async(req,res)=>{data.settings={...data.settings,...req.body};log('Updated settings','Organization preferences');await persist();res.json(data.settings)})
app.patch('/api/notifications/:id/read',async(req,res)=>{const n=data.notifications.find(x=>x.id===Number(req.params.id));if(n)n.unread=false;await persist();res.json(n||{})})
app.get('/api/export/:type',managerOnly,(_req,res)=>{const type=_req.params.type;const rows=type==='doctors'?data.doctors:type==='assignments'?data.assignmentHistory:type==='batches'?data.batches:data.cases;const sheet=XLSX.utils.json_to_sheet(rows);const csv=XLSX.utils.sheet_to_csv(sheet);res.setHeader('Content-Disposition',`attachment; filename="auditflow-${type}.csv"`);res.type('text/csv').send(csv)})
app.use((err,_req,res,_next) => { console.error(err); res.status(500).json({error:err.message||'Server error'}) })
app.use(express.static(path.resolve('dist')))
app.get('/{*path}', (_req,res) => res.sendFile(path.resolve('dist/index.html')))
const port=process.env.PORT||4000
const server=app.listen(port,()=>console.log(`AuditFlow API on http://localhost:${port} · storage: ${storageMode}`))
const shutdown=async()=>{server.close();if(prisma)await prisma.$disconnect();process.exit(0)}
process.on('SIGTERM',shutdown)
process.on('SIGINT',shutdown)
