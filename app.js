'use strict';
const STORE_KEY='mt6_state_v2';
const TOPICS=[
  {id:'decimals', name:'Дзесятковыя дробы', emoji:'🔟'},
  {id:'percent',  name:'Працэнты і прапорцыі', emoji:'💯'},
  {id:'sets',     name:'Мноствы', emoji:'🎲'},
  {id:'rational', name:'Рацыянальныя лікі', emoji:'➕'},
  {id:'coords',   name:'Каардынатная плоскасць', emoji:'📈'},
  {id:'geometry', name:'Наглядная геаметрыя', emoji:'📐'}
];
const TOPIC_MAP=Object.fromEntries(TOPICS.map(t=>[t.id,t]));
function clampGrade(acc){return Math.max(1,Math.min(10,Math.round(1+acc*9)));}
function overallGrade(s){if(!s.solved)return null;return clampGrade(s.correct/s.solved);}
const BADGES=[
  {id:'first',name:'Першы крок',emoji:'🐣',test:s=>s.solved>=1},
  {id:'ten',name:'Дзясятак',emoji:'🔟',test:s=>s.solved>=10},
  {id:'fifty',name:'Паўсотні',emoji:'🏅',test:s=>s.solved>=50},
  {id:'hundred',name:'Сотня!',emoji:'🏆',test:s=>s.solved>=100},
  {id:'streak3',name:'3 дні запар',emoji:'🔥',test:s=>s.streakDays>=3},
  {id:'grade8',name:'Адзнака 8+',emoji:'🌟',test:s=>overallGrade(s)>=8},
  {id:'grade10',name:'Ідэальна 10!',emoji:'💎',test:s=>overallGrade(s)>=10&&s.solved>=20},
  {id:'perfect',name:'Бездакорная сесія',emoji:'✨',test:s=>s.hadPerfectSession}
];
function defaultState(){
  const topics={};TOPICS.forEach(t=>topics[t.id]={correct:0,total:0,level:3});
  return {xp:0,level:1,solved:0,correct:0,streakDays:0,lastDay:null,todayCount:0,todayDate:null,dailyGoal:10,topics,badges:[],hadPerfectSession:false,history:[],settings:{sound:true}};
}
function loadState(){
  try{const s=JSON.parse(localStorage.getItem(STORE_KEY));if(!s||typeof s!=='object')return defaultState();
    const d=defaultState();const m=Object.assign(d,s);
    m.settings=Object.assign(d.settings,s.settings||{});
    m.topics=Object.assign(d.topics,s.topics||{});
    TOPICS.forEach(t=>{m.topics[t.id]=Object.assign({correct:0,total:0,level:3},m.topics[t.id]);});
    return m;
  }catch(e){return defaultState();}
}
function saveState(){try{localStorage.setItem(STORE_KEY,JSON.stringify(S));}catch(e){}}
function ri(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function pick(a){return a[Math.floor(Math.random()*a.length)];}
function r1(x){return Math.round(x*10)/10;}
function r2(x){return Math.round(x*100)/100;}
function sgn(x){return x<0?'−':'+';}
function fd(x){return String(x).replace('-','−').replace('.',',');}
function loc(s){return String(s).replace(/(\d)\.(\d)/g,'$1,$2');}
/* ===== Раздзел 1: Дзесятковыя дробы ===== */
function gAddDec(d){const p=d<=4?1:2,m=Math.pow(10,p);let a=ri(10,50+d*20)/m,b=ri(10,50+d*20)/m;return{q:`${a} + ${b} = ?`,a:r2(a+b),hint:'Коску пад коскай, складзі па разрадах.'};}
function gSubDec(d){const p=d<=4?1:2,m=Math.pow(10,p);let a=ri(20,60+d*20)/m,b=ri(5,40+d*15)/m;if(a<b){const t=a;a=b;b=t;}return{q:`${a} − ${b} = ?`,a:r2(a-b),hint:'Коску пад коскай, аднімі па разрадах.'};}
function gCmpDec(d){const m=100;let a=ri(110,80+d*20)/m;let b=r2(a+(Math.random()<.5?1:-1)*ri(1,15)/m);if(b===a)b=r2(a+1/m);return{q:`Параўнай ${a} і ${b}. Увядзі большае лік.`,a:Math.max(a,b),hint:'Параўноўвай па разрадах злева направа.'};}
function gRoundDec(d){const a=ri(105,99+d*40)/100;return{q:`Акруглі ${a} да дзясятых.`,a:r1(a),hint:'Калі сотыя 5–9 — дзясятая +1.'};}
function gPlaceDec(d){const a=ri(100,999)/100;const [nm,pos]=pick([['дзясятых',1],['сотых',2]]);const s=a.toFixed(2);const digit=Number(s.split('.')[1][pos-1]);return{q:`Якая лічба ў разрадзе ${nm} у ліку ${s.replace('.',',')}?`,a:digit,hint:'Пасля коскі: дзясятыя, сотыя, тысячныя.'};}
function gMul10(d){const a=ri(11,99)/10;const k=pick([10,100,1000]);return{q:`${String(a).replace('.',',')} · ${k} = ?`,a:r2(a*k),hint:`Коску перанясі на ${String(k).length-1} знака ўправа.`};}
function gMulDec(d){const a=ri(11,50)/10,b=ri(11,40)/10;return{q:`${String(a).replace('.',',')} · ${String(b).replace('.',',')} = ?`,a:r2(a*b),hint:'Памнож як цэлыя і аддзялі столькі знакаў, колькі іх пасля коскі.'};}
function gDivNat(d){const n=ri(2,9),q0=ri(11,50)/10,a=r2(q0*n);return{q:`${String(a).replace('.',',')} : ${n} = ?`,a:r2(a/n),hint:'Дзялі як цэлы лік, коску перанясі ў дзель.'};}
function gDivDec(d){const b=ri(2,9)/10,q0=ri(2,9),a=r2(b*q0);return{q:`${String(a).replace('.',',')} : ${String(b).replace('.',',')} = ?`,a:r2(a/b),hint:'Памнож абодва на 10/100, каб дзельнік стаў цэлым.'};}
function gFracToDec(d){const dens=[2,4,5,8,10,20,25],den=pick(dens),num=ri(1,den-1);return{q:`Запішы дроб ${num}/${den} дзесятковым дробам.`,a:r2(num/den),hint:'Падзялі лічнік на назоўнік.'};}
function gExprDec(d){const a=ri(11,40)/10,b=ri(11,30)/10,c=ri(2,9);return{q:`${String(a).replace('.',',')} + ${String(b).replace('.',',')} · ${c} = ?`,a:r2(a+b*c),hint:'Спачатку множанне, потым складанне.'};}

/* ===== Раздзел 2: Працэнты і прапорцыі ===== */
function gPctOf(d){const pct=pick([5,10,20,25,50,15]);const k=ri(1,3+d),base=100*k;return{q:`Знайдзі ${pct}% ад ${base}`,a:pct*k,hint:`${pct}% = ${pct}/100. Памнож і падзялі на 100.`};}
function gFindWhole(d){const pct=pick([10,20,25,50]),part=pct*ri(2,6+d),whole=part*100/pct;return{q:`${pct}% гэта ${part}. Знайдзі ўсё лік.`,a:whole,hint:'Спачатку знайдзі 1% (падзялі на pct), потым памнож на 100.'};}
function gPctRatio(d){const B=100*ri(1,2),pct=ri(10,90)*(1),A=B*pct/100;return{q:`Колькі працэнтаў складае ${A} ад ${B}?`,a:pct,hint:'(частка / цэлае) · 100%.'};}
function gPctChange(d){const price=10*ri(5,20),pct=pick([10,20,25,50]);const up=Math.random()<.5;const ans=up?price*(100+pct)/100:price*(100-pct)/100;return{q:`Цана тавара ${price} руб. Яе ${up?'павысілі':'знізілі'} на ${pct}%. Новая цана?`,a:r2(ans),hint:'Знайдзі pct% ад цаны і дадай/аднімі.'};}
function gProp(d){const b=ri(2,9),t=ri(1,4+d),a=b*t,dd=ri(2,9),x=t*dd;return{q:`${a} : ${b} = x : ${dd}`,a:x,hint:'Правіла прапорцыі: a·dd = b·x, адсюль x.'};}
function gDirect(d){const per=ri(2,9),n1=ri(2,5),n2=ri(2,8);return{q:`${n1} кг тавару каштуюць ${per*n1} руб. Колькі каштуюць ${n2} кг?`,a:per*n2,hint:'Спачатку цана за 1 кг, потым памнож.'};}
function gInverse(d){const w=ri(2,5),k=pick([2,3]),per=ri(3,8),days=k*per,w2=w*k;return{q:`${w} рабочых выконваюць працу за ${days} дзён. За колькі дзён гэтую працу выканаюць ${w2} рабочых?`,a:per,hint:'У колькі разоў больш рабочых — у столькі разоў менш дзён.'};}
function gScale(d){const M=pick([100000,200000,50000]),cm=ri(2,9);return{q:`Маштаб карты 1:${M}. На плане адрэзак ${cm} см. Якая рэальная адлегласць (у метрах)?`,a:r2(cm*M/100),hint:'1 см = M см = M/100 м.'};}
function gPie(d){const pct=pick([5,10,20,25,45]);return{q:`На кругавой дыяграме доля ${pct}%. Колькі гэта градусаў (усяго 360°)?`,a:r2(pct*360/100),hint:'pct% ад 360° = 360·pct/100.'};}
/* ===== Раздзел 3: Мноствы ===== */
function setOf(n,lo,hi){const s=new Set();while(s.size<n){s.add(ri(lo,hi));}return [...s];}
function gSetCount(d){const n=ri(4,7),arr=[];for(let i=0;i<n;i++)arr.push(ri(1,6));const distinct=[...new Set(arr)];return{q:`Мноства зададзена пералікам: {${arr.join(', ')}}. Колькі ў ім розных элементаў?`,a:distinct.length,hint:'Паўторы лічацца адзін раз.'};}
function gSetOp(d){const A=setOf(ri(3,5),1,10),B=setOf(ri(3,5),1,10);const inter=A.filter(x=>B.includes(x)),uni=[...new Set([...A,...B])];const kind=Math.random()<.5;if(kind){return{q:`A = {${A.join(', ')}}, B = {${B.join(', ')}}. Колькі элементаў у A ∩ B?`,a:inter.length,hint:'Перасячэнне — агульныя элементы.'};}return{q:`A = {${A.join(', ')}}, B = {${B.join(', ')}}. Колькі элементаў у A ∪ B?`,a:uni.length,hint:'Аб\'яднанне — усе элементы без паўтораў.'};}
function gEuler(d){const both=ri(2,6),math=both+ri(3,8),phys=both+ri(3,8);if(Math.random()<.5){return{q:`У класе ${math} вучняў любяць матэматыку, ${phys} — фізкультуру, ${both} — абедзве. Колькі вучняў любяць хаця б адну з гэтых прадметаў?`,a:math+phys-both,hint:'Складзі і аднімі тых, хто любіць абедзве.'};}return{q:`У класе ${math} вучняў любяць матэматыку, ${phys} — фізкультуру, ${both} — абедзве. Колькі вучняў любяць ТОЛЬКІ матэматыку?`,a:math-both,hint:'Аднімі тых, хто любіць абедзве.'};}

/* ===== Раздзел 4: Рацыянальныя лікі ===== */
function gAddInt(d){const a=ri(-15-d*2,15+d*2),b=ri(-15-d*2,15+d*2);return{q:`${fd(a)} + (${fd(b)}) = ?`,a:a+b,hint:'Пры розных знаках аднімай меншы модуль ад большага.'};}
function gSubInt(d){const a=ri(-15,15),b=ri(-15,15);return{q:`${fd(a)} − (${fd(b)}) = ?`,a:a-b,hint:'Адніманне адмоўнага = складанне.'};}
function gMod(d){const a=ri(-20,20);return{q:`|${fd(a)}| = ?`,a:Math.abs(a),hint:'Модуль — адлегласць да нуля, заўсёды ≥ 0.'};}
function gOpposite(d){const a=ri(-15,15);return{q:`Супрацьлеглы лік да ${fd(a)} — гэта?`,a:-a,hint:'Супрацьлеглы мае процілеглы знак.'};}
function gCmpInt(d){let a=ri(-20,20),b=ri(-20,20);if(a===b)b=a+1;return{q:`Параўнай ${fd(a)} і ${fd(b)}. Увядзі большае лік.`,a:Math.max(a,b),hint:'На каардынатнай прамой большае — правей.'};}
function gMulInt(d){let a=ri(-12,12),b=ri(-12,12);if(a===0)a=3;if(b===0)b=4;return{q:`${fd(a)} · (${fd(b)}) = ?`,a:a*b,hint:'−·− = +, −·+ = −.'};}
function gDivInt(d){const b=ri(2,9)*(Math.random()<.5?1:-1),q0=ri(2,9)*(Math.random()<.5?1:-1),a=b*q0;return{q:`${fd(a)} : (${fd(b)}) = ?`,a:q0,hint:'Правіла знакаў як пры множанні.'};}
function gExprInt(d){const a=ri(-10,10),b=ri(2,8),c=ri(-5,5);return{q:`${fd(a)} + ${b} · (${fd(c)}) = ?`,a:a+b*c,hint:'Спачатку множанне.'};}

/* ===== Раздзел 5: Каардынатная плоскасць ===== */
function gAbscissa(d){let x=ri(-8,8),y=ri(-8,8);if(x===0)x=3;if(y===0)y=-4;return Math.random()<.5?{q:`Пункт A(${fd(x)}; ${fd(y)}). Якая абсцыса?`,a:x,hint:'Абсцыса — першая каардыната.'}:{q:`Пункт A(${fd(x)}; ${fd(y)}). Якая ардыната?`,a:y,hint:'Ардыната — другая каардыната.'};}
function gQuadrant(d){let x=ri(-6,6),y=ri(-6,6);if(x===0)x=2;if(y===0)y=-3;const quad=(x>0&&y>0)?1:(x<0&&y>0)?2:(x<0&&y<0)?3:4;return{q:`У якой каардынатнай чвэрці знаходзіцца пункт (${fd(x)}; ${fd(y)})?`,a:quad,hint:'I:(+,+), II:(−,+), III:(−,−), IV:(+,−).'};}
function gPropGraph(d){const k=ri(2,6),x=ri(2,6);return{q:`y = ${k}x (прамая прапарцыянальнасць). Знайдзі y, калі x = ${x}.`,a:k*x,hint:'Падстаў x у формулу.'};}
function gInvGraph(d){const k=ri(2,5)*ri(2,5),x=pick([2,3,4,6]);return{q:`y = ${k}/x (адваротная прапарцыянальнасць). Знайдзі y, калі x = ${x}.`,a:r2(k/x),hint:'Падстаў x у формулу.'};}

/* ===== Раздзел 6: Наглядная геаметрыя ===== */
function gVolume(d){const a=ri(2,6),b=ri(2,6),c=ri(2,6);return{q:`Прамавугольны паралелепіпед памерамі ${a}×${b}×${c} см. Знайдзі аб'ём (см³).`,a:a*b*c,hint:'V = a·b·c.'};}
function gSurface(d){const a=ri(2,6),b=ri(2,6),c=ri(2,6);return{q:`Прамавугольны паралелепіпед ${a}×${b}×${c} см. Знайдзі плошчу паверхні (см²).`,a:2*(a*b+b*c+a*c),hint:'S = 2(ab + bc + ac).'};}
function gCircum(d){const r=ri(1,8+d);return{q:`Радыус круга ${r} см. Знайдзі даўжыню акружнасці (π ≈ 3,14).`,a:r2(2*3.14*r),hint:'C = 2πr.'};}
function gCircleArea(d){const r=ri(1,6+d);return{q:`Радыус круга ${r} см. Знайдзі плошчу круга (π ≈ 3,14).`,a:r2(3.14*r*r),hint:'S = πr².'};}
function gTriangleAngle(d){const a=ri(30,80),b=ri(30,180-a-20);const c=180-a-b;if(c<=0)return gTriangleAngle(d);return{q:`Два вуглы трохвугольніка — ${a}° і ${b}°. Знайдзі трэці (у градусах).`,a:c,hint:'Сума вуглоў трохвугольніка = 180°.'};}
function gSymmetry(d){const [nm,ax]=pick([['прамавугольніка',2],['квадрата',4],['роўнастаронняга трохвугольніка',3],['ромба',2]]);return{q:`Колькі восяў сіметрыі ў ${nm}?`,a:ax,hint:'Вось сіметрыі дзеліць фігуру на дзве роўныя часткі.'};}

const GEN={
  decimals:[gAddDec,gSubDec,gCmpDec,gRoundDec,gPlaceDec,gMul10,gMulDec,gDivNat,gDivDec,gFracToDec,gExprDec],
  percent:[gPctOf,gFindWhole,gPctRatio,gPctChange,gProp,gDirect,gInverse,gScale,gPie],
  sets:[gSetCount,gSetOp,gEuler],
  rational:[gAddInt,gSubInt,gMod,gOpposite,gCmpInt,gMulInt,gDivInt,gExprInt],
  coords:[gAbscissa,gQuadrant,gPropGraph,gInvGraph],
  geometry:[gVolume,gSurface,gCircum,gCircleArea,gTriangleAngle,gSymmetry]
};
function weakestTopicIds(){return TOPICS.map(t=>({id:t.id,acc:S.topics[t.id].total?S.topics[t.id].correct/S.topics[t.id].total:0.5,total:S.topics[t.id].total})).sort((a,b)=>a.acc-b.acc);}
function chooseQuestion(scope){
  let topicId;
  if(scope&&scope!=='mix'){topicId=scope;}
  else{const w=weakestTopicIds(),weighted=[];w.forEach((x,i)=>{const c=4-i;for(let j=0;j<c;j++)weighted.push(x.id);});topicId=pick(weighted);}
  let t=S.topics[topicId];let d=t.level||3;d=Math.max(1,Math.min(10,d));
  const g=pick(GEN[topicId])(d);g.topicId=topicId;g.difficulty=d;return g;
}
/* ===== інтэрфейс ===== */
const cv=document.getElementById('confetti');const ctx=cv.getContext('2d');
let particles=[],rafId=null;
function sizeCanvas(){cv.width=window.innerWidth;cv.height=window.innerHeight;}
window.addEventListener('resize',sizeCanvas);sizeCanvas();
function burst(){const cols=['#ff6b6b','#feca57','#48dbfb','#1dd1a1','#a29bfe','#fd79a8'];for(let i=0;i<90;i++){particles.push({x:window.innerWidth/2,y:window.innerHeight/2.4,vx:(Math.random()-0.5)*14,vy:(Math.random()-0.9)*14,g:0.35+Math.random()*0.2,col:pick(cols),life:70+Math.random()*30,r:3+Math.random()*4,rot:Math.random()*6,vr:(Math.random()-0.5)*0.3});}if(!rafId)rafId=requestAnimationFrame(tick);}
function tick(){ctx.clearRect(0,0,cv.width,cv.height);particles.forEach(p=>{p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.life--;p.rot+=p.vr;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=Math.max(0,p.life/80);ctx.fillStyle=p.col;ctx.fillRect(-p.r,-p.r,p.r*2,p.r*2);ctx.restore();});particles=particles.filter(p=>p.life>0&&p.y<cv.height+50);if(particles.length){rafId=requestAnimationFrame(tick);}else{ctx.clearRect(0,0,cv.width,cv.height);rafId=null;}}
let audioCtx=null;
function beep(ok){if(!S.settings.sound)return;try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='sine';o.frequency.value=ok?880:220;g.gain.setValueAtTime(0.001,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.15,audioCtx.currentTime+0.02);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.25);o.start();o.stop(audioCtx.currentTime+0.26);}catch(e){}}
function $(id){return document.getElementById(id);}
function show(id){['screen-home','screen-quiz','screen-result','screen-stats'].forEach(s=>$(s).classList.toggle('hidden',s!==id));}
let S=loadState();let session=null;let current=null;
function renderHome(){
  const g=overallGrade(S);
  $('home-grade').textContent=g===null?'—':g;$('home-level').textContent=S.level;$('home-xp').textContent=S.xp;$('home-streak').textContent=S.streakDays;
  const goal=Math.min(S.todayCount,S.dailyGoal);$('daily-fill').style.width=Math.round(goal/S.dailyGoal*100)+'%';$('daily-text').textContent=`Сёння: ${goal}/${S.dailyGoal}`;
  const grid=$('topic-grid');grid.innerHTML='';
  TOPICS.forEach(t=>{const st=S.topics[t.id],acc=st.total?Math.round(st.correct/st.total*100):0;const b=document.createElement('button');b.className='topic-card';b.innerHTML=`<span class="tc-emoji">${t.emoji}</span><span class="tc-name">${t.name}</span><span class="tc-stat">${st.total?acc+'% • ур. '+st.level:'нов.'}</span>`;b.onclick=()=>startSession(t.id);grid.appendChild(b);});
  show('screen-home');
}
function startSession(scope){session={scope:scope||'mix',answered:0,correct:0,total:10,startXp:S.xp,perfect:true};nextQuestion();show('screen-quiz');}
function nextQuestion(){
  if(session.answered>=session.total){finishSession();return;}
  current=chooseQuestion(session.scope);
  $('q-counter').textContent=`${session.answered+1} / ${session.total}`;
  $('q-topic').textContent=TOPIC_MAP[current.topicId].emoji+' '+TOPIC_MAP[current.topicId].name;
  $('quiz-fill').style.width=Math.round(session.answered/session.total*100)+'%';
  $('question').textContent=loc(current.q);
  const inp=$('answer');inp.value='';inp.disabled=false;
  $('feedback').className='feedback hidden';$('feedback').textContent='';
  $('submit-btn').classList.remove('hidden');$('next-btn').classList.add('hidden');$('mascot-emoji').textContent='🦉';
  inp.onkeydown=(e)=>{if(e.key==='Enter')submitAnswer();};
  setTimeout(()=>inp.focus(),50);
}
function parseAns(v){if(v==null||v==='')return NaN;var t=String(v).replace(',','.').replace(/[^0-9.\-]/g,'');if(t===''||t==='-'||t==='.')return NaN;return parseFloat(t);}
function submitAnswer(){
  const val=parseAns($('answer').value);
  if(isNaN(val)){$('feedback').className='feedback warn';$('feedback').textContent='Увядзі лік 🙂';return;}
  $('answer').disabled=true;
  const ok=Math.abs(val-current.a)<0.02;const st=S.topics[current.topicId];st.total++;
  if(ok){st.correct++;session.correct++;S.correct++;S.solved++;session.answered++;const gain=5+current.difficulty*2;S.xp+=gain;if(st.level<10&&Math.random()<0.7)st.level++;
    $('mascot-emoji').textContent='🎉';burst();beep(true);$('feedback').className='feedback ok';$('feedback').innerHTML=`✅ Правільна! +${gain} XP<br><span class="hint">${loc(current.hint)}</span>`;
  }else{S.solved++;session.answered++;session.perfect=false;if(st.level>1)st.level--;
    $('mascot-emoji').textContent='🤔';beep(false);$('feedback').className='feedback bad';$('feedback').innerHTML=`❌ Правільны адказ: <b>${fd(current.a)}</b><br><span class="hint">${loc(current.hint)}</span>`;
  }
  bumpLevel();touchDay();saveState();$('submit-btn').classList.add('hidden');$('next-btn').classList.remove('hidden');
}
function nextQ(){nextQuestion();}
function bumpLevel(){S.level=Math.floor(S.xp/100)+1;}
function touchDay(){const today=new Date().toISOString().slice(0,10);if(S.todayDate!==today){S.todayDate=today;S.todayCount=0;const y=new Date(Date.now()-86400000).toISOString().slice(0,10);S.streakDays=(S.lastDay===y)?S.streakDays+1:1;}S.todayCount++;S.lastDay=today;checkBadges();}
function checkBadges(){BADGES.forEach(b=>{if(!S.badges.includes(b.id)&&b.test(S))S.badges.push(b.id);});}
function finishSession(){
  if(session.perfect&&session.correct===session.total)S.hadPerfectSession=true;
  checkBadges();saveState();
  const acc=session.correct/session.total,grade=clampGrade(acc);
  $('res-grade').textContent=grade;$('res-acc').textContent=Math.round(acc*100)+'%';
  $('res-correct').textContent=session.correct+' / '+session.total;$('res-xp').textContent='+'+(S.xp-session.startXp)+' XP';
  $('res-msg').textContent=grade>=10?'Бездакорна! Ты супер! 🌟':grade>=8?'Выдатна! Яшчэ крыху да 10! 🚀':grade>=6?'Добра, працягвай трэніравацца! 💪':'Не здавайся — кожная спроба робіць мацнейшым! 🌱';
  if(grade>=8)burst();show('screen-result');
}
function renderStats(){
  const g=overallGrade(S);
  $('st-grade').textContent=g===null?'—':g;$('st-solved').textContent=S.solved;$('st-acc').textContent=S.solved?Math.round(S.correct/S.solved*100)+'%':'—';$('st-streak').textContent=S.streakDays;$('st-level').textContent=S.level;$('st-xp').textContent=S.xp;
  const wrap=$('topic-bars');wrap.innerHTML='';
  TOPICS.forEach(t=>{const st=S.topics[t.id],acc=st.total?Math.round(st.correct/st.total*100):0;const row=document.createElement('div');row.className='bar-row';row.innerHTML=`<span class="bar-label">${t.emoji} ${t.name}</span><span class="bar"><span class="bar-fill" style="width:${acc}%"></span></span><span class="bar-val">${st.total?acc+'%':'—'}</span>`;wrap.appendChild(row);});
  const weak=weakestTopicIds().slice(0,3).filter(x=>S.topics[x.id].total>0);
  $('weak').textContent=weak.length?weak.map(w=>TOPIC_MAP[w.id].name).join(', '):'Пакуль няма даных — патрэніруйся!';
  const bw=$('badges');bw.innerHTML='';
  BADGES.forEach(b=>{const got=S.badges.includes(b.id);const d=document.createElement('div');d.className='badge'+(got?' got':'');d.innerHTML=`<span class="b-emoji">${b.emoji}</span><span class="b-name">${b.name}</span>`;bw.appendChild(d);});
  $('sound-toggle').checked=!!S.settings.sound;show('screen-stats');
}
$('start-mix').onclick=()=>startSession('mix');
$('open-stats').onclick=()=>renderStats();
$('res-again').onclick=()=>startSession(session?session.scope:'mix');
$('res-home').onclick=()=>renderHome();
$('res-stats').onclick=()=>renderStats();
$('submit-btn').onclick=submitAnswer;
$('next-btn').onclick=nextQ;
$('stats-back').onclick=()=>renderHome();
$('sound-toggle').onchange=(e)=>{S.settings.sound=e.target.checked;saveState();};
$('reset-btn').onclick=()=>{if(confirm('Скінуць увесь прагрэс?')){S=defaultState();saveState();renderHome();}};
$('quiz-quit').onclick=()=>renderHome();
renderHome();
