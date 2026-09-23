const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function element() {
  const children = new Map();
  return { dataset: {}, classList: { add(){}, remove(){}, toggle(){} },
    querySelector(key) { if (!children.has(key)) children.set(key, element()); return children.get(key); },
    addEventListener(){}, removeAttribute(){}, setAttribute(){}, append(){}, replaceChildren(){}, scrollIntoView(){} };
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
test('pair selection prefers the exact rarity and color pool',()=>{
 const run=app();
 run('state.setCode="DFT"');
 run(`var cards=normalizeCards(${JSON.stringify([
   {name:'First',rarity:'rare',colors:['U','W'],winRate:50},
   {name:'Exact partner',rarity:'rare',colors:['W','U'],winRate:51},
   {name:'Shared color',rarity:'rare',colors:['U'],winRate:52},
   {name:'Opposite rarity',rarity:'mythic',colors:['U','W'],winRate:53},
 ])});state.cards=cards;`);
 assert.equal(run('JSON.stringify(getPartnerCandidates(cards[0]).cards.map(card=>card.name))'),JSON.stringify(['Exact partner']));
 assert.equal(run('getPartnerCandidates(cards[0]).usesFallback'),false);
});
test('singleton fallback uses same-rarity shared colors or opposite-rarity exact colors',()=>{
 const run=app();
 run('state.setCode="DFT"');
 run(`var cards=normalizeCards(${JSON.stringify([
   {name:'Rare UW',rarity:'rare',colors:['U','W'],winRate:50},
   {name:'Rare U',rarity:'rare',colors:['U'],winRate:51},
   {name:'Rare G',rarity:'rare',colors:['G'],winRate:52},
   {name:'Mythic UW',rarity:'mythic',colors:['U','W'],winRate:53},
   {name:'Mythic U',rarity:'mythic',colors:['U'],winRate:54},
   {name:'Uncommon W',rarity:'uncommon',colors:['W'],winRate:55},
 ])});state.cards=cards;`);
 assert.equal(run('JSON.stringify(getPartnerCandidates(cards[0]).cards.map(card=>card.name).sort())'),JSON.stringify(['Mythic UW','Rare U']));
 assert.equal(run('getPartnerCandidates(cards[0]).usesFallback'),true);

 run(`var cards=normalizeCards(${JSON.stringify([
   {name:'Mythic UW',rarity:'mythic',colors:['U','W'],winRate:50},
   {name:'Mythic U',rarity:'mythic',colors:['U'],winRate:51},
   {name:'Rare UW',rarity:'rare',colors:['U','W'],winRate:52},
   {name:'Rare U',rarity:'rare',colors:['U'],winRate:53},
 ])});state.cards=cards;`);
 assert.equal(run('JSON.stringify(getPartnerCandidates(cards[0]).cards.map(card=>card.name).sort())'),JSON.stringify(['Mythic U','Rare UW']));
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
test('FIN uses stored 17Lands grades and one-decimal GIH scores',()=>{
 const data=JSON.parse(fs.readFileSync('web/data/final-fantasy.json'));
 assert.equal(data.cards.length,357); assert.equal(new Set(data.cards.map(c=>c.name)).size,357);
 assert.equal(data.cards.filter(c=>c.grade==='F').length,23);
 assert.equal(data.cards.filter(c=>c.winRate!==null).length,348);
 const run=app();run('state.setCode="FIN"');
 assert.equal(run('cardGrade({grade:"A+",winRate:64.5})'),'A+');
 assert.equal(run('formatScore(64.5)'),'64.5%');
 assert.equal(run('cardScore({winRate:56.7})'),56.7);
 let h=2166136261; const canonical=data.cards.map(c=>`${c.name}|${c.grade}|${c.winRate===null?'':c.winRate.toFixed(1)+'%'}`).sort().join('\n');
 for(const c of canonical) h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
 assert.equal(h,3328844481,'Must match the complete rendered 17Lands FIN grade grid');
 const rarity={common:'C',uncommon:'U',rare:'R',mythic:'M'};
 const metadata=data.cards.map(c=>`${c.name}|${[...c.colors].sort().join('')}|${rarity[c.rarity]}`).sort().join('\n');h=2166136261;
 for(const c of metadata)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
 assert.equal(h,2431312925,'Must match the 17Lands FIN table colors and rarities');
});
test('switching sets discards an older pending load and resets accuracy',async()=>{
 const run=app();run(`var pending={};fetch=url=>new Promise(resolve=>pending[url]=resolve);state.correctDecisions=5;state.decisiveRounds=6;var old=selectSet('SOS');var latest=selectSet('DFT');`);
 const payload={cards:[{name:'One',winRate:50,grade:'F',colors:['U'],rarity:'common',imageUrl:'one'},{name:'Two',winRate:51,grade:'D',colors:['U'],rarity:'common',imageUrl:'two'}],sourceUrl:'https://www.17lands.com',sourceName:'17Lands'};
 run(`pending['data/aetherdrift.json']({ok:true,json:async()=>(${JSON.stringify(payload)})});`);await run('latest');
 run(`pending['data/cards.json']({ok:true,json:async()=>({cards:[]})});`);await run('old');
 assert.equal(run('state.setCode'),'DFT');assert.equal(run('state.cards.length'),2);
 assert.equal(run('state.correctDecisions'),0);assert.equal(run('state.round'),1);
});

test('comparison reports disagreement and ties neutrally',()=>{
 const run=app();
 run(`state.setCode='DFT';state.currentPair={bucket:{rarity:'common',colorKey:'U'},leftCard:{name:'One',grade:'C',winRate:50},rightCard:{name:'Two',grade:'B',winRate:55}};revealOutcome('left');`);
 assert.equal(run('resultText.textContent'),'THE DATA DISAGREES.');
 assert.equal(run('state.correctDecisions'),0);
 assert.equal(run('state.decisiveRounds'),1);
 run('clearResultState();state.currentPair.rightCard.winRate=50;revealOutcome("right");');
 assert.equal(run('state.ties'),1);
 assert.match(run('accuracyStat.textContent'),/0 of 1 comparisons. Equal scores: 1/);
 assert.equal(run('resultText.textContent'),'The data has them tied.');
});
