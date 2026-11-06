const API_URL="/api/analyze"; // GitHub Pages: replace with your Worker URL, e.g. https://etel-safety-ai.YOURNAME.workers.dev
const AREAS=["Office","Production","Utility","Testing","Warehouse"];
const SEV=["Minor","Moderate","Major","Catastrophic"],LIK=["Rare","Possible","Likely","Almost Certain"];
const STAT={review:"Pending HSE Review",open:"Corrective Action",done:"Pending Verification",verified:"Closed & Verified"};
let F=[],tab="patrol",draft={area:"Production",desc:"",blob:null,thumb:"",loc:"",ai:null,busy:false,err:""};
try{F=JSON.parse(localStorage.getItem("sp_f")||"[]")}catch(e){F=[]}
const save=()=>{try{localStorage.setItem("sp_f",JSON.stringify(F))}catch(e){}};
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const today=()=>new Date().toISOString().slice(0,10);
function risk(sev,lik){const s=Math.max(1,SEV.indexOf(sev)+1)*Math.max(1,LIK.indexOf(lik)+1);
 const lv=s>=12?"Extreme":s>=8?"High":s>=4?"Medium":"Low";
 const pr={Extreme:"Immediate Action (stop work)",High:"Urgent (≤ 7 days)",Medium:"Planned (≤ 30 days)",Low:"Monitor / Routine"}[lv];return{lv,pr,score:s}}
const blobToURL=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(b)});
async function ai(prompt,imgs){
 let image=null;if(imgs&&imgs[0])image=await blobToURL(imgs[0]);
 let res;try{res=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt,image})})}catch(e){throw new Error("Cannot reach the AI server. Check your internet connection.")}
 const d=await res.json().catch(()=>({}));if(!res.ok)throw new Error(d.error||"AI server error ("+res.status+")");
 let t=String(d.text||"").replace(/```json|```/g,"");const a=t.indexOf("{"),b=t.lastIndexOf("}");
 if(a<0||b<a)throw new Error("AI response was not valid JSON. Please try again.");
 try{return JSON.parse(t.slice(a,b+1))}catch(e){throw new Error("AI response was invalid. Please try again.")}}
async function shrink(file,max,q){const b=await createImageBitmap(file);const r=Math.min(1,max/Math.max(b.width,b.height));
 const c=document.createElement("canvas");c.width=b.width*r;c.height=b.height*r;c.getContext("2d").drawImage(b,0,0,c.width,c.height);
 return new Promise(res=>c.toBlob(bl=>res({blob:bl,url:c.toDataURL("image/jpeg",q)}),"image/jpeg",q))}

/* ---------- Patrol: AI Safety Inspector / Risk Assessment / Corrective Action Advisor ---------- */
function vPatrol(){const d=draft,a=d.ai;
 let h=`<div class="card"><div class="flow"><span class="a">Patrol</span><span>AI Analysis</span><span>HSE Review</span><span>Corrective Action</span><span>Verification</span></div>
 <h2>New finding</h2>
 <label>Patrol area</label><select id="area">${AREAS.map(x=>`<option${x==d.area?" selected":""}>${x}</option>`).join("")}</select>
 <label>Specific location</label><input id="loc" placeholder="e.g. Line 3, press machine" value="${esc(d.loc)}">
 <label>Photo of unsafe condition</label><input type="file" id="ph" accept="image/*" capture="environment">
 ${d.thumb?`<img class="ph" src="${d.thumb}" alt="Finding photo">`:""}
 <label>Inspector notes (optional)</label><textarea id="desc" placeholder="Briefly describe what you see">${esc(d.desc)}</textarea>
 <div class="act"><button class="p full" id="an" ${d.busy||!d.blob?"disabled":""}>${d.busy?"AI is analyzing…":"🔍 Analyze with AI"}</button></div>
 ${d.err?`<p class="err">${esc(d.err)}</p>`:""}</div>`;
 if(a){const r=risk(a.severity,a.likelihood);
 h+=`<div class="card"><h2>AI result <span class="sub">(HSE can edit during review)</span></h2>
 <div class="kv"><b>Finding</b><span>${esc(a.finding)}</span><b>Hazard category</b><span>${esc(a.category)}</span><b>Unsafe condition</b><span>${esc(a.unsafe_condition)}</span><b>Potential risk</b><span>${esc(a.potential_risk)}</span><b>Severity</b><span>${esc(a.severity)}</span><b>Likelihood</b><span>${esc(a.likelihood)}</span><b>Risk level</b><span><span class="badge ${r.lv}">${r.lv}</span></span><b>Priority</b><span>${r.pr}</span></div>
 <h3>Draft finding description</h3><p>${esc(a.draft_description)}</p>
 <h3>Recommended corrective actions</h3><ol>${a.recommendations.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>
 ${a.other_hazards&&a.other_hazards.length?`<h3>Other hazards detected</h3><ul>${a.other_hazards.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
 <div class="act"><button class="p full" id="sub">Submit for HSE review</button></div></div>`}
 return h}
function bindPatrol(){
 $("#area").onchange=e=>draft.area=e.target.value;$("#loc").oninput=e=>draft.loc=e.target.value;$("#desc").oninput=e=>draft.desc=e.target.value;
 $("#ph").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const a=await shrink(f,1024,.8),t=await shrink(f,360,.6);draft.blob=a.blob;draft.thumb=t.url;draft.ai=null;draft.err=""}catch(x){draft.err="Could not read the photo."}render()};
 $("#an").onclick=async()=>{draft.busy=true;draft.err="";render();
  try{const r=await ai(`You are an AI Safety Inspector, Risk Assessor and Corrective Action Advisor for a manufacturing company. Analyze this safety patrol photo taken in the ${draft.area} area${draft.loc?" ("+draft.loc+")":""}. Inspector notes: ${draft.desc||"none"}.
Return ONLY JSON with keys: finding (short title), category (one of: Electrical, Mechanical, PPE, Slip-Trip-Fall, Fire, Chemical, Ergonomic, Housekeeping, Emergency Access, Other), unsafe_condition, potential_risk, severity (exactly one of: Minor, Moderate, Major, Catastrophic), likelihood (exactly one of: Rare, Possible, Likely, Almost Certain), draft_description (2 sentences), recommendations (array of 3-6 ordered steps; include LOTOTO isolation when relevant), other_hazards (array, may be empty). If the photo shows no unsafe condition, say so in finding and use severity Minor and likelihood Rare. Respond in English.`,[draft.blob]);
   r.recommendations=Array.isArray(r.recommendations)?r.recommendations:[];r.category=r.category||"Other";
   if(!SEV.includes(r.severity))r.severity="Moderate";if(!LIK.includes(r.likelihood))r.likelihood="Possible";draft.ai=r}
  catch(x){draft.err=x.message||"Analysis failed. Please try again."}draft.busy=false;render()};
 const s=$("#sub");if(s)s.onclick=()=>{F.unshift({id:"SP-"+String(Date.now()).slice(-6),ts:today(),area:draft.area,loc:draft.loc,desc:draft.desc,thumb:draft.thumb,ai:draft.ai,sev:draft.ai.severity,lik:draft.ai.likelihood,status:"review",why:null});save();draft={area:draft.area,desc:"",blob:null,thumb:"",loc:"",ai:null,busy:false,err:""};tab="list";render()}}

/* ---------- Findings: HSE review, corrective action, root cause, verification ---------- */
function card(f,i){const r=risk(f.sev,f.lik),a=f.ai,od=f.status==="open"&&f.target&&f.target<today();
 let h=`<details class="card"${f.open?" open":""} data-i="${i}"><summary><b>${esc(f.id)}</b> · ${esc(f.area)}<br>${esc(a.finding)} <span class="badge ${r.lv}">${r.lv}</span> <span class="badge st">${STAT[f.status]}</span>${od?' <span class="badge Extreme">Overdue</span>':""}</summary>
 ${f.thumb?`<img class="ph" src="${f.thumb}" alt="">`:""}
 <div class="kv"><b>Date</b><span>${f.ts}${f.loc?" · "+esc(f.loc):""}</span><b>Category</b><span>${esc(a.category)}</span><b>Potential risk</b><span>${esc(a.potential_risk)}</span><b>Risk score</b><span>${f.sev} × ${f.lik} = ${r.score} → ${r.pr}</span>${f.pic?`<b>PIC / Target</b><span>${esc(f.pic)} · ${f.target}</span>`:""}</div>
 <p>${esc(a.draft_description)}</p><h3>AI recommendations</h3><ol>${(a.recommendations||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ol>`;
 if(f.status==="review")h+=`<h3>HSE review &amp; approval</h3><label>Severity</label><select data-f="sev">${SEV.map(x=>`<option${x==f.sev?" selected":""}>${x}</option>`).join("")}</select><label>Likelihood</label><select data-f="lik">${LIK.map(x=>`<option${x==f.lik?" selected":""}>${x}</option>`).join("")}</select>
 <label>PIC (person in charge)</label><input data-f="pic" value="${esc(f.pic||"")}"><label>Target date</label><input type="date" data-f="target" value="${f.target||""}">
 <label>HSE notes</label><textarea data-f="hse">${esc(f.hse||"")}</textarea><div class="act"><button class="p" data-a="approve">✔ Approve &amp; assign action</button></div>`;
 if(f.hse&&f.status!=="review")h+=`<p class="sub">HSE notes: ${esc(f.hse)}</p>`;
 if(f.status==="open")h+=`<h3>Evidence of correction</h3><textarea data-f="evid" placeholder="Describe the action that was completed">${esc(f.evid||"")}</textarea><label>Photo after correction</label><input type="file" accept="image/*" capture="environment" data-a="evph"><div class="act"><button class="p" data-a="done">Submit evidence</button></div>`;
 if(f.status==="done"||f.status==="verified"){h+=`<h3>Evidence of correction</h3><p>${esc(f.evid)}</p>${f.evthumb?`<img class="ph" src="${f.evthumb}" alt="">`:""}`;
  if(f.ver)h+=`<div class="ai"><b>AI verification:</b> ${esc(f.ver.verdict)}<br>${esc(f.ver.reason)}${f.ver.gaps&&f.ver.gaps.length?"<ul>"+f.ver.gaps.map(x=>`<li>${esc(x)}</li>`).join("")+"</ul>":""}</div>`;
  if(f.status==="done")h+=`<div class="act"><button data-a="ver">🤖 AI verify evidence</button><button class="p" data-a="close">HSE verify &amp; close</button></div>`}
 h+=`<h3>Root cause (5 Why)</h3>`;
 if(f.why)h+=`<ol>${(f.why.whys||[]).map(w=>`<li><b>${esc(w.q)}</b><br>${esc(w.a)}</li>`).join("")}</ol><div class="ai"><b>Root cause:</b> ${esc(f.why.root)}<br><b>Systemic action:</b> ${esc(f.why.systemic)}</div>`;
 else h+=`<div class="act"><button data-a="why">🧭 Generate 5 Why with AI</button></div>`;
 return h+`<p id="e${i}" class="err"></p></details>`}
function vList(){return F.length?F.map(card).join(""):`<div class="card">No findings yet. Start from the Patrol tab, or <button data-a="demo">load sample data</button>.</div>`}
function bindList(){
 document.querySelectorAll("details.card").forEach(el=>{const i=+el.dataset.i,f=F[i];
  el.addEventListener("toggle",()=>f.open=el.open);
  el.querySelectorAll("[data-f]").forEach(x=>x.oninput=()=>{f[x.dataset.f]=x.value});
  el.querySelectorAll("[data-a]").forEach(b=>{const act=b.dataset.a;
   if(act==="evph"){b.onchange=async e=>{if(e.target.files[0]){const t=await shrink(e.target.files[0],360,.6);f.evthumb=t.url;try{f._eb=await shrink(e.target.files[0],1024,.75)}catch(x){}}};return}
   b.onclick=async()=>{const er=$("#e"+i);er.textContent="";f.open=true;
    try{
    if(act==="approve"){if(!f.pic||!f.target){er.textContent="Please enter the PIC and target date.";return}f.status="open"}
    if(act==="done"){if(!f.evid){er.textContent="Please describe the evidence.";return}f.status="done"}
    if(act==="close"){f.status="verified";f.closed=today()}
    if(act==="why"){b.disabled=true;b.textContent="AI is analyzing…";f.why=await ai(`You are an AI Root Cause Analyst. Perform a 5 Why analysis for this safety finding: "${f.ai.finding}" in the ${f.area} area. Condition: ${f.ai.unsafe_condition}. ${f.desc||""} Return ONLY JSON: whys (array of 5 objects {q,a}, each answer leading to the next question), root (root cause, 1 sentence), systemic (systemic corrective/preventive action, 1-2 sentences). The answers are hypotheses to be confirmed by the team. Respond in English.`)}
    if(act==="ver"){b.disabled=true;b.textContent="Verifying…";const im=f._eb?[f._eb.blob]:[];f.ver=await ai(`You are an AI Verifier. Finding: "${f.ai.finding}". Original recommendations: ${(f.ai.recommendations||[]).join("; ")}. Written evidence of correction: "${f.evid}". ${im.length?"A photo taken after correction is attached.":"No photo attached."} Judge whether the evidence is sufficient. Return ONLY JSON: verdict (Evidence Sufficient / Needs Clarification / Insufficient), reason (1-2 sentences), gaps (array of missing items, may be empty). The final decision remains with HSE. Respond in English.`,im)}
    }catch(x){er.textContent=x.message||"Failed. Please try again."}
    save();render()}})})}

/* ---------- Dashboard: Performance Analyst + Safety Coach ---------- */
let dashAI=null,dashBusy=false,dashErr="";
const cnt=(arr,k)=>{const m={};arr.forEach(x=>{const v=k(x);m[v]=(m[v]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1])};
function bars(e){const mx=Math.max(1,...e.map(x=>x[1]));return e.map(([k,v])=>`<div class="bar"><span>${esc(k)}</span><i style="width:${v/mx*50}%"></i><span>${v}</span></div>`).join("")||"<p class='sub'>No data.</p>"}
function stats(){const od=F.filter(f=>f.status==="open"&&f.target&&f.target<today());
 const rep=cnt(F,f=>f.area+" · "+f.ai.category).filter(x=>x[1]>=2);
 return{od,rep,area:cnt(F,f=>f.area),cat:cnt(F,f=>f.ai.category),lvl:cnt(F,f=>risk(f.sev,f.lik).lv),open:F.filter(f=>f.status!=="verified").length}}
function vDash(){if(!F.length)return`<div class="card">No data yet. Add findings in the Patrol tab or <button data-a="demo">load sample data</button>.</div>`;
 const s=stats(),hi=F.filter(f=>["High","Extreme"].includes(risk(f.sev,f.lik).lv)&&f.status!=="verified").length;
 let h=`<div class="kpi"><div><b>${F.length}</b><span>Total findings</span></div><div><b>${s.open}</b><span>Not closed</span></div><div><b>${hi}</b><span>Open High/Extreme</span></div><div><b>${s.od.length}</b><span>Overdue actions</span></div><div><b>${s.rep.length}</b><span>Repeat patterns</span></div></div>
 <div class="card"><h2>Highest-risk areas</h2>${bars(s.area)}<h3>Hazard categories</h3>${bars(s.cat)}<h3>Risk level distribution</h3>${bars(s.lvl)}</div>
 <div class="card"><h2>Repeat findings &amp; overdue actions</h2>${s.rep.length?"<ul>"+s.rep.map(x=>`<li>${esc(x[0])} — ${x[1]}× findings</li>`).join("")+"</ul>":"<p class='sub'>No repeat patterns yet (same area + category, 2 or more).</p>"}${s.od.length?"<h3>Overdue</h3><ul>"+s.od.map(f=>`<li>${f.id} ${esc(f.ai.finding)} — PIC ${esc(f.pic)}, target ${f.target}</li>`).join("")+"</ul>":""}</div>
 <div class="card"><h2>AI Performance Analyst &amp; Safety Coach</h2><div class="act"><button class="p full" id="da" ${dashBusy?"disabled":""}>${dashBusy?"AI is analyzing…":"📊 Analyze trends &amp; create Safety Talk"}</button></div>${dashErr?`<p class="err">${esc(dashErr)}</p>`:""}`;
 if(dashAI){const d=dashAI;d.talk=d.talk||{};h+=`<h3>Insights</h3><ul>${(d.insights||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul><h3>Management priorities</h3><ul>${(d.priorities||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
 <div class="ai"><b>🎤 Safety Talk: ${esc(d.talk.topic)}</b><br>${esc(d.talk.why)}<h3>Talking points</h3><ul>${(d.talk.points||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul><h3>Discussion questions</h3><ul>${(d.talk.questions||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`}
 return h+"</div>"}
function bindDash(){const b=$("#da");if(b)b.onclick=async()=>{dashBusy=true;dashErr="";render();const s=stats();
 const data={total:F.length,by_area:s.area,by_category:s.cat,risk_levels:s.lvl,overdue:s.od.map(f=>({area:f.area,finding:f.ai.finding,pic:f.pic})),repeats:s.rep,root_causes:F.filter(f=>f.why).map(f=>f.why.root),recent:F.slice(0,12).map(f=>({date:f.ts,area:f.area,category:f.ai.category,finding:f.ai.finding,status:f.status}))};
 try{dashAI=await ai(`You are an AI Safety Performance Analyst and Safety Coach. Safety patrol data (JSON): ${JSON.stringify(data)}. Return ONLY JSON in English: insights (array of 3-5 analysis points: trends, highest-risk areas, repeat findings, overdue actions), priorities (array of 2-3 management actions), talk ({topic, why (reason based on the actual data), points (array of 4-5 talking points), questions (array of 2-3 discussion questions)}). Only use numbers that appear in the data.`)}catch(x){dashErr=x.message||"Analysis failed."}
 dashBusy=false;render()}}

function demo(){const mk=(n,area,fn,cat,pr,sev,lik,st,off,pic,tg)=>({id:"SP-D"+n,ts:new Date(Date.now()-off*864e5).toISOString().slice(0,10),area,loc:"",desc:"",thumb:"",sev,lik,status:st,pic,target:tg,ai:{finding:fn,category:cat,unsafe_condition:fn,potential_risk:pr,draft_description:"Sample finding: "+fn+".",recommendations:["Stop the related activity","Correct according to procedure","Re-inspect before use"]}});
 const d=new Date(Date.now()-3*864e5).toISOString().slice(0,10),f=new Date(Date.now()+5*864e5).toISOString().slice(0,10);
 F=[mk(1,"Production","Damaged electrical cable","Electrical","Electric shock / fire","Major","Likely","open",6,"Budi (Maintenance)",d),mk(2,"Production","Unprotected cable routing","Electrical","Insulation damage","Moderate","Likely","open",4,"Budi (Maintenance)",f),mk(3,"Warehouse","Material blocking evacuation route","Emergency Access","Evacuation obstruction","Major","Possible","review",3),mk(4,"Utility","Machine guard left open","Mechanical","Crushing / amputation","Catastrophic","Possible","done",2,"Sari (Utility)",f),mk(5,"Production","Operator not wearing gloves","PPE","Hand injury","Moderate","Possible","verified",8,"Andi (Production)",d),mk(6,"Testing","Slippery floor from oil spill","Slip-Trip-Fall","Slip and fall","Moderate","Likely","review",1)];
 F[3].evid="Guard reinstalled and locked";save();render()}

function render(){document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("on",b.dataset.t===tab));$("#cnt").textContent=F.length?"("+F.length+")":"";
 $("#v").innerHTML=tab==="patrol"?vPatrol():tab==="list"?vList():vDash();
 if(tab==="patrol")bindPatrol();else if(tab==="list")bindList();else bindDash();
 document.querySelectorAll('[data-a="demo"]').forEach(b=>b.onclick=demo)}
document.querySelectorAll("#tabs button").forEach(b=>b.onclick=()=>{tab=b.dataset.t;render();window.scrollTo(0,0)});
render();
