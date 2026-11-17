export const seed = {
  settings: { organization:'National Health Audit Authority', defaultSla:7, requireRemarks:true, emailNotifications:true, timezone:'Asia/Kolkata' },
  masterOptions: {
    auditResult:['Correct','Incorrect','Partially Correct','Needs Clarification'],
    findingCategory:['No discrepancy','Documentation','Clinical','Financial','Coding','Duplicate','Other'],
    documentVerification:['Complete','Incomplete','Not Available'],
    clinicalJustification:['Justified','Not Justified','Needs Review'],
    financialObservation:['No Issue','Overcharged','Undercharged','Mismatch'],
    finalDecision:['Approved','Rejected','Returned for Correction','Escalated']
  },
  assignmentHistory: [
    { id:1, caseId:'CASE-93827', from:null, to:'Dr. Ananya Sharma', reason:'Equal distribution', by:'Priya Nair', at:'20 Sep 2026, 10:15 AM' },
    { id:2, caseId:'CASE-93830', from:'Dr. Vikram Mehta', to:'Dr. Ananya Sharma', reason:'Workload balancing', by:'Priya Nair', at:'19 Sep 2026, 02:13 PM' }
  ],
  batches: [
    { id:'AUD-2026-0098', name:'September Claims Audit — Batch 04', records:5000, completed:2850, progress:1250, pending:800, returned:100, deadline:'25 Sep 2026', status:'In Progress' },
    { id:'AUD-2026-0101', name:'North Region High Value Claims', records:3200, completed:2592, progress:378, pending:230, returned:18, deadline:'30 Sep 2026', status:'In Progress' },
    { id:'AUD-2026-0087', name:'August Provider Review', records:4100, completed:4100, progress:0, pending:0, returned:24, deadline:'31 Aug 2026', status:'Completed' },
    { id:'AUD-2026-0104', name:'Cardiology Package Review', records:1800, completed:315, progress:685, pending:800, returned:12, deadline:'05 Oct 2026', status:'In Progress' }
  ],
  doctors: [
    { id:1, name:'Dr. Ananya Sharma', initials:'AS', specialty:'Internal Medicine', assigned:2500, completed:2200, pending:300, avg:'4.2 min', score:92, status:'Active' },
    { id:2, name:'Dr. Vikram Mehta', initials:'VM', specialty:'Cardiology', assigned:2000, completed:1620, pending:380, avg:'5.1 min', score:86, status:'Active' },
    { id:3, name:'Dr. Neha Iyer', initials:'NI', specialty:'Claims Review', assigned:1800, completed:1530, pending:270, avg:'3.9 min', score:89, status:'Active' },
    { id:4, name:'Dr. Arjun Rao', initials:'AR', specialty:'Surgery', assigned:2100, completed:1470, pending:630, avg:'6.0 min', score:78, status:'Active' }
  ],
  cases: [
    { id:'CASE-93827', batchId:'AUD-2026-0098', doctorId:1, claim:'CLM-728341', hospital:'Apollo Hospitals', patient:'Riya Kapoor', package:'CABG Package', amount:485000, approved:442000, status:'In Progress', priority:'High', due:'Today' },
    { id:'CASE-93828', batchId:'AUD-2026-0098', doctorId:1, claim:'CLM-728355', hospital:'Fortis Healthcare', patient:'Aman Verma', package:'Knee Replacement', amount:312000, approved:298500, status:'Assigned', priority:'Medium', due:'22 Sep' },
    { id:'CASE-93829', batchId:'AUD-2026-0101', doctorId:2, claim:'CLM-728401', hospital:'Max Super Speciality', patient:'Sana Khan', package:'Chemotherapy', amount:178000, approved:178000, status:'Assigned', priority:'Low', due:'24 Sep' },
    { id:'CASE-93830', batchId:'AUD-2026-0098', doctorId:1, claim:'CLM-728443', hospital:'Medanta', patient:'Karan Singh', package:'Cardiac Angioplasty', amount:265000, approved:241000, status:'Returned', priority:'High', due:'Today' },
    { id:'CASE-93831', batchId:'AUD-2026-0104', doctorId:null, claim:'CLM-728502', hospital:'AIIMS Delhi', patient:'Meera Joshi', package:'Dialysis', amount:86000, approved:82000, status:'Uploaded', priority:'Medium', due:'27 Sep' }
  ],
  notifications: [
    { id:1, title:'New batch assigned', body:'500 cases from AUD-2026-0098 were assigned to you.', time:'12 min ago', unread:true },
    { id:2, title:'Deadline approaching', body:'80 cases in September Claims Audit are due in 2 days.', time:'1 hr ago', unread:true },
    { id:3, title:'Audit returned', body:'CASE-93830 needs clarification on financial observation.', time:'Yesterday', unread:false }
  ],
  logs: [
    { time:'10:27 AM', actor:'Dr. Ananya Sharma', action:'Acknowledged assignment', detail:'AUD-2026-0098 · 500 cases' },
    { time:'10:15 AM', actor:'Priya Nair', action:'Assigned cases', detail:'500 records assigned to Dr. Ananya Sharma' },
    { time:'10:02 AM', actor:'Priya Nair', action:'Created audit batch', detail:'AUD-2026-0098 · 5,000 records' }
  ]
}
