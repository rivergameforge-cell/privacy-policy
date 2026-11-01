const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const A = require('../attribution.js');

test('ad cohorts have a complete acquisition-date constraint in the property timezone', () => {
  const body = A.acquisitionBody({period:'27daysAgo',country:'Brazil',timeZone:'Asia/Seoul',now:new Date('2026-11-01T16:01:00Z')});
  assert.equal(body.metrics[0].name,'totalUsers');
  const filters=body.dimensionFilter.andGroup.expressions;
  const dates=filters.find(f=>f.filter?.fieldName==='firstSessionDate').filter.inListFilter.values;
  assert.equal(dates.length,28);assert.equal(dates[0],'20261102');assert.equal(dates.at(-1),'20261006');
  assert.ok(filters.some(f=>f.filter?.fieldName==='country'));
  assert.ok(filters.some(f=>f.andGroup));
  assert.throws(()=>A.acquisitionBody({period:'999daysAgo'}));
});
test('campaign and ad scopes always include paid Meta source constraints', () => {
  const f=A.audienceFilter({country:'',meta:false,campaign:'123',ad:'456'});
  assert.equal(f.andGroup.expressions.length,3);
  assert.deepEqual(f.andGroup.expressions.at(-1).filter.stringFilter,{matchType:'EXACT',value:'456'});
  assert.equal(A.audienceFilter({country:'',meta:false,campaign:'',ad:''}),undefined);
  const sources=JSON.stringify(A.metaFilter());assert.ok(sources.includes('paid_social'));assert.ok(!sources.includes('organic'));
});
test('calendar arithmetic preserves timezone, leap-day and year-boundary dates',()=>{
  assert.equal(A.dateDaysAgo(8,'America/Los_Angeles',new Date('2026-11-01T01:00:00Z')),'2026-10-23');
  assert.equal(A.dateDaysAgo(1,'UTC',new Date('2024-03-01T12:00:00Z')),'2024-02-29');
  assert.equal(A.dateDaysAgo(8,'UTC',new Date('2026-01-05T12:00:00Z')),'2025-12-28');
});
const row=(campaign,ad,event,users,adset='77')=>({dimensionValues:['meta',campaign,adset,ad,event].map(value=>({value})),metricValues:[{value:String(users)}]});
test('users from different campaigns and ads remain separate; missing stages stay zero',()=>{
  const result=A.aggregate({rows:[row('111','901','first_open',8),row('111','901','boss_started',3),row('111','901','boss_won',2),row('111','902','first_open',5),row('222','901','first_open',4),row('111','901','purchase',999),row('111','901','boss_won',NaN)]});
  assert.equal(result.length,3);assert.equal(result[0].counts.first_open,8);assert.equal(result[0].counts.boss_won,2);assert.equal(result[1].counts.boss_won,0);
  assert.equal(result[2].ids[1],'222');assert.equal(result[2].counts.first_open,4);
  assert.deepEqual(A.aggregate({}),[]);
  assert.equal(A.aggregate({rows:[row('(not set)','(not set)','first_open',1)]})[0].ids[1],'(not set)');
});
test('Play links retain campaign, adset and ad IDs through nested URL encoding',()=>{
  const url=new URL(A.playUrl('123','456','789'));
  assert.equal(url.origin,'https://play.google.com');assert.equal(url.searchParams.get('id'),'com.v8redline.unlimitbossrun');
  const ref=new URLSearchParams(url.searchParams.get('referrer'));
  assert.equal(ref.get('utm_source'),'meta');assert.equal(ref.get('utm_medium'),'paid_social');
  assert.equal(ref.get('utm_id'),'123');assert.equal(ref.get('utm_content'),'789');assert.equal(ref.get('utm_term'),'456');
  assert.equal(ref.has('fbclid'),false);
  for(const invalid of ['person@example.com','https://evil.test','{{ad.id}}','', '1'.repeat(33)]) assert.throws(()=>A.playUrl('123','456',invalid));
});
function harness(fetch) {
  const nodes=new Map();function el(){return {hidden:false,disabled:false,textContent:'',value:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},replaceChildren(){},append(){},showModal(){}};}
  const doc={getElementById(id){if(!nodes.has(id))nodes.set(id,el());return nodes.get(id)},createElement:el,body:el(),addEventListener(){},hidden:false};
  const storage=new Map();const ctx={document:doc,window:{UBRAttribution:A},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},Intl,Date,AbortController,DOMException,setTimeout:()=>1,clearTimeout(){},fetch};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../app.js'),'utf8'),ctx);
  return {ctx,doc,storage};
}
test('denied Google access hides all reports, clears ad selections and never persists tokens',async()=>{
  const {ctx,doc,storage}=harness(async()=>({ok:false,status:403,json:async()=>({error:{message:'Permission denied'}})}));
  vm.runInContext("state.token='fixture';state.expiry=Date.now()+60000;document.getElementById('private-content').hidden=false;document.getElementById('campaign').value='123'",ctx);
  await vm.runInContext('refresh()',ctx);
  assert.equal(doc.getElementById('private-content').hidden,true);assert.equal(vm.runInContext('state.token',ctx),null);assert.equal(doc.getElementById('campaign').value,'');assert.equal(storage.size,0);
});
test('an old API response cannot repopulate reports after logout or a new filter generation',async()=>{
  let release;const {ctx}=harness(()=>new Promise(resolve=>{release=resolve}));
  vm.runInContext("state.token='fixture';state.controller=new AbortController()",ctx);
  const request=vm.runInContext("api('runReport',{})",ctx);
  vm.runInContext('disconnect()',ctx);
  release({ok:true,status:200,json:async()=>({rows:[]})});
  await assert.rejects(request,e=>e.name==='AbortError');
});

test('selected and filtered dimensions stay within the live GA4 nine-dimension limit',()=>{
  function fields(x,found=new Set()) { if(!x||typeof x!=="object")return found; if(x.fieldName)found.add(x.fieldName);for(const v of Object.values(x))fields(v,found);return found; }
  const query=A.acquisitionBody({period:'27daysAgo',country:'Brazil',timeZone:'UTC'});
  const used=fields(query.dimensionFilter);query.dimensions.forEach(d=>used.add(d.name));assert.ok(used.size<=9,`used ${used.size}`);
  const boss=fields(A.audienceFilter({country:'Brazil',meta:true,campaign:'123',ad:'456'}));['customEvent:area','customEvent:cycle','customEvent:event_context','eventName'].forEach(x=>boss.add(x));assert.ok(boss.size<=9);
});
