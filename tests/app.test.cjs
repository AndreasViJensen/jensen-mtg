const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function element() {
  const children = new Map();
  return { dataset: {}, classList: { add(){}, remove(){}, toggle(){} },
    querySelector(key) { if (!children.has(key)) children.set(key, element()); return children.get(key); },
    addEventListener(){}, removeAttribute(){}, setAttribute(){}, append(){}, scrollIntoView(){} };
}
function app() {
  const els = new Map();
  const document = { getElementById(id) { if (!els.has(id)) els.set(id, element()); return els.get(id); },
    querySelector: () => element(), querySelectorAll: () => [], createElement: element, createDocumentFragment: element };
  const ctx = vm.createContext({document, window: {addEventListener(){},matchMedia:()=>({matches:false})}, URL, console, setTimeout});
  vm.runInContext(fs.readFileSync('web/app.js','utf8').replace(/selectSet\(setSelect.value\);\s*$/, ''),ctx);
  return code=>vm.runInContext(code,ctx);
}
test('DFT uses win rate even within the same grade; exact displayed scores tie',()=>{
 const run=app();
 run(`state.setCode='DFT';state.currentPair={bucket:{rarity:'common',colorKey:'U'},leftCard:{name:'Thoughtcast',grade:'F',winRate:49.5},rightCard:{name:'Stall Out',grade:'F',winRate:49.1}};revealOutcome('left');`);
 assert.equal(run('state.correctDecisions'),1);
 assert.equal(run('resultCardLeft.querySelector("[data-grade]").textContent'),'F');
 assert.equal(run('resultCardLeft.querySelector("[data-score]").textContent'),'49.5%');
 run(`state.revealed=false;state.currentPair.rightCard.winRate=49.5;revealOutcome('right');`);
 assert.equal(run('state.ties'),1);
 assert.equal(run('state.decisiveRounds'),1);
});
test('SOS keeps its original metric and grade thresholds',()=>{
 const run=app(); run('state.setCode="SOS"'); assert.equal(run('cardScore({avgNorm:1.8,winRate:50})'),1.8);
 assert.equal(run('cardGrade({avgNorm:1.8})'),'A');
 assert.equal(run('formatScore(1.8)'),'1.800');
});
test('DFT snapshot has complete verified values and excludes only missing scores',()=>{
 const data=JSON.parse(fs.readFileSync('web/data/aetherdrift.json'));
 assert.equal(data.cards.length,281); assert.equal(new Set(data.cards.map(c=>c.name)).size,281);
 assert.equal(data.cards.filter(c=>c.grade==='F').length,15);
 const run=app();run('state.setCode="DFT"');
 assert.equal(run(`normalizeCards(${JSON.stringify(data.cards)}).length`),277);
 let h=2166136261; const canonical=data.cards.map(c=>`${c.name}|${c.grade}|${c.winRate===null?'':c.winRate.toFixed(1)+'%'}`).sort().join('\n');
 for(const c of canonical) h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
 assert.equal(h,3948192544,'Must match the complete rendered 17Lands grade grid');
 const rarity={common:'C',uncommon:'U',rare:'R',mythic:'M'};
 const metadata=data.cards.map(c=>`${c.name}|${[...c.colors].sort().join('')}|${rarity[c.rarity]}`).sort().join('\n');h=2166136261;
 for(const c of metadata)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
 assert.equal(h,1308456291,'Must match the 17Lands table colors and rarities');
});
test('switching sets discards an older pending load and resets accuracy',async()=>{
 const run=app();run(`var pending={};fetch=url=>new Promise(resolve=>pending[url]=resolve);state.correctDecisions=5;state.decisiveRounds=6;var old=selectSet('SOS');var latest=selectSet('DFT');`);
 const payload={cards:[{name:'One',winRate:50,grade:'F',colors:['U'],rarity:'common',imageUrl:'one'},{name:'Two',winRate:51,grade:'D',colors:['U'],rarity:'common',imageUrl:'two'}],sourceUrl:'https://www.17lands.com',sourceName:'17Lands'};
 run(`pending['data/aetherdrift.json']({ok:true,json:async()=>(${JSON.stringify(payload)})});`);await run('latest');
 run(`pending['data/cards.json']({ok:true,json:async()=>({cards:[]})});`);await run('old');
 assert.equal(run('state.setCode'),'DFT');assert.equal(run('state.cards.length'),2);
 assert.equal(run('state.correctDecisions'),0);assert.equal(run('state.round'),1);
});
