const {createQA}=require('../js/qa.js');const fs=require('fs');
const doc=JSON.parse(fs.readFileSync(__dirname+'/../data/mop-ups-017.fr.json','utf8'));
const qa=createQA(doc,{lang:'fr'});
const W={answer:'answer',refuse:'refused',decline:'declined'};
for(const f of process.argv.slice(2)){
 const qs=JSON.parse(fs.readFileSync(f,'utf8'));let ok=0,fa=0,fr=0;
 for(const q of qs){const r=qa.ask(q.question);const st=r.status===W[q.expect]&&(r.status==='refused'||q.steps.length===0||q.steps.includes(r.citations[0]?.step));
  if(st)ok++;else console.log('FAIL',q.id,q.expect,'->',r.status,r.reason,r.citations.map(c=>c.step),JSON.stringify(r.confidence),q.question.slice(0,70));
  if(q.expect==='refuse'&&r.status!=='refused')fa++;if(q.expect==='answer'&&r.status==='refused')fr++;}
 console.log(f,ok+'/'+qs.length,'false answers',fa,'false refusals',fr);}
