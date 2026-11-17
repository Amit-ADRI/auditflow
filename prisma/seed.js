import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD || 'Audit@123', 12)

const manager = await prisma.user.upsert({
  where: { email: process.env.MANAGER_EMAIL || 'manager@auditflow.in' },
  update: {},
  create: { email: process.env.MANAGER_EMAIL || 'manager@auditflow.in', name: 'Priya Nair', passwordHash, role: UserRole.MANAGER }
})

const doctorUser = await prisma.user.upsert({
  where: { email: process.env.DOCTOR_EMAIL || 'doctor@auditflow.in' },
  update: {},
  create: { email: process.env.DOCTOR_EMAIL || 'doctor@auditflow.in', name: 'Dr. Ananya Sharma', passwordHash, role: UserRole.DOCTOR }
})

await prisma.doctor.upsert({ where:{ userId:doctorUser.id }, update:{}, create:{ userId:doctorUser.id, specialty:'Internal Medicine' } })

const options = {
  auditResult:['Correct','Incorrect','Partially Correct','Needs Clarification'],
  findingCategory:['No discrepancy','Documentation','Clinical','Financial','Coding','Duplicate','Other'],
  documentVerification:['Complete','Incomplete','Not Available'],
  clinicalJustification:['Justified','Not Justified','Needs Review'],
  financialObservation:['No Issue','Overcharged','Undercharged','Mismatch'],
  finalDecision:['Approved','Rejected','Returned for Correction','Escalated']
}
for (const [group, values] of Object.entries(options)) for (const [sortOrder,value] of values.entries()) await prisma.masterOption.upsert({where:{group_value:{group,value}},update:{sortOrder},create:{group,value,sortOrder}})

console.log(`Seeded manager ${manager.email} and doctor ${doctorUser.email}`)
await prisma.$disconnect()
