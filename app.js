'use strict';
const STORE_KEY = 'mt6_state_v1';
const TOPICS = [
  { id:'natural',   name:'Натуральныя лікі', emoji:'🔢' },
  { id:'fractions', name:'Звычайныя дробы',  emoji:'🍕' },
  { id:'decimals',  name:'Дзесятковыя дробы',emoji:'🔟' },
  { id:'percents',  name:'Працэнты',         emoji:'💯' },
  { id:'integers',  name:'Адмоўныя лікі',    emoji:'➖' },
  { id:'equations', name:'Ураўненні',        emoji:'🧩' },
  { id:'proportions',name:'Прапорцыі',       emoji:'⚖️' },
  { id:'geometry',  name:'Плошча і перыметр',emoji:'📐' },
  { id:'word',      name:'Тэкставыя задачы', emoji:'📖' }
];
const TOPIC_MAP = Object.fromEntries(TOPICS.map(t=>[t.id,t]));
function clampGrade(acc){ return Math.max(1, Math.min(10, Math.round(1 + acc*9))); }
function overallGrade(s){ if(!s.solved) return null; return clampGrade(s.correct/s.solved); }
const BADGES = [
  { id:'first',name:'Першы крок',emoji:'🐣',test:s=>s.solved>=1 },
  { id:'ten',name:'Дзясятак',emoji:'🔟',test:s=>s.solved>=10 },
  { id:'fifty',name:'Паўсотні',emoji:'🏅',test:s=>s.solved>=50 },
  { id:'hundred',name:'Сотня!',emoji:'🏆',test:s=>s.solved>=100 },
  { id:'streak3',name:'3 дні запар',emoji:'🔥',test:s=>s.streakDays>=3 },
  { id:'grade8',name:'Адзнака 8+',emoji:'🌟',test:s=>overallGrade(s)>=8 },
  { id:'grade10',name:'Ідэальна 10!',emoji:'💎',test:s=>overallGrade(s)>=10 && s.solved>=20 },
  { id:'perfect',name:'Бездакорная сесія',emoji:'✨',test:s=>s.hadPerfectSession }
];
function defaultState(){
  const topics={}; TOPICS.forEach(t=>topics[t.id]={correct:0,total:0,level:3});
  return { xp:0, level:1, solved:0, correct:0, streakDays:0, lastDay:null, todayCount:0, todayDate:null,
    dailyGoal:10, topics, badges:[], hadPerfectSession:false, history:[], settings:{sound:true} };
}
function loadState(){
  try{ const s=JSON.parse(localStorage.getItem(STORE_KEY)); if(!s||typeof s!=='object') return defaultState();
    const d=defaultState(); const m=Object.assign(d,s);
    m.settings=Object.assign(d.settings,s.settings||{});
    m.topics=Object.assign(d.topics,s.topics||{});
    TOPICS.forEach(t=>{ m.topics[t.id]=Object.assign({correct:0,total:0,level:3},m.topics[t.id]); });
    return m;
  }catch(e){ return defaultState(); }
}
function saveState(){ try{ localStorage.setItem(STORE_KEY,JSON.stringify(S)); }catch(e){} }
function rndInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function round2(x){ return Math.round(x*100)/100; }
function genNatural(d){
  const max=10+d*10; const ops = d<=3?['+','-']:d<=6?['+','-','*']:['+','-','*','/']; const op=pick(ops);
  let a=rndInt(2,max),b=rndInt(2,max),ans=0;
  if(op==='-'){ if(a<b){const t=a;a=b;b=t;} ans=a-b; }
  else if(op==='+'){ ans=a+b; }
  else if(op==='*'){ a=rndInt(2,Math.min(12,3+Math.floor(d*1.2))); b=rndInt(2,Math.min(12,3+Math.floor(d*1.2))); ans=a*b; }
  else { b=rndInt(2,Math.min(12,3+Math.floor(d*1.2))); a=b*rndInt(2,Math.min(12,3+Math.floor(d*1.2))); ans=a/b; }
  return { q:`${a} ${op==='*'?'·':op==='/'?'÷':op} ${b} = ?`, a:ans, topic:'natural', hint: op==='*'?'Множанне — гэта мнагакратнае складанне.':'Вылічы ў слупок.' };
}
function genFractions(d){
  const den=pick([3,4,5,6,8,10]); const op=(d<=4||Math.random()<0.6)?'+':'-';
  let n1=rndInt(1,den-1),n2=rndInt(1,den-1); if(op==='-'&&n1<n2){const t=n1;n1=n2;n2=t;}
  const ans= op==='+'?n1+n2:n1-n2;
  return { q:`${n1}/${den} ${op} ${n2}/${den} = ?/${den}`, a:ans, topic:'fractions', hint:'Лічнікі складзі/аднімі, назоўнік той жа. Увядзі новы лічнік.' };
}
function genDecimals(d){
  const place=d<=5?1:2, m=Math.pow(10,place), op=Math.random()<0.55?'+':'-';
  let a=round2(rndInt(10,40+d*15)/m), b=round2(rndInt(10,40+d*15)/m); if(op==='-'&&a<b){const t=a;a=b;b=t;}
  return { q:`${a} ${op} ${b} = ?`, a:round2(op==='+'?a+b:a-b), topic:'decimals', hint:'Коску пад коскай, складзі/аднімі па разрадах.' };
}
function genPercents(d){
  const pct=pick([5,10,20,25,50]), base=20*rndInt(1,2+d);
  return { q:`Знайдзі ${pct}% ад ${base}`, a:base*pct/100, topic:'percents', hint:`${pct}% = ${pct}/100. Памнож ${base} на ${pct} і падзялі на 100.` };
}
function genIntegers(d){
  const k=rndInt(1,3);
  if(k===1){ const a=rndInt(1,8+d*3), b=rndInt(1,8+d*3); return { q:`${a} − ${b} = ?`, a:a-b, topic:'integers', hint:'Калі аднімаемае большае — адказ адмоўны.' }; }
  if(k===2){ const a=rndInt(1,5+d*2), b=rndInt(1,5+d*2); return { q:`−${a} − ${b} = ?`, a:-(a+b), topic:'integers', hint:'Два мінусы: складзі і пастаў мінус.' }; }
  const a=rndInt(1,10+d*3); return { q:`|−${a}| = ?`, a:a, topic:'integers', hint:'Модуль — адлегласць да нуля, заўсёды ≥0.' };
}
function genEquations(d){
  const k=rndInt(1,2);
  if(k===1){ const x=rndInt(1,10+d*3), a=rndInt(2,10+d*2); return { q:`x + ${a} = ${x+a}`, a:x, topic:'equations', hint:'Аднімі a ад правага боку.' }; }
  const x=rndInt(1,10+d*2), m=rndInt(2,9); return { q:`${m}·x = ${x*m}`, a:x, topic:'equations', hint:'Падзялі правы бок на множнік перад x.' };
}
function genProportions(d){
  const b=rndInt(2,9), t=rndInt(1,4+d), a=b*t, dd=rndInt(2,9), x=t*dd;
  return { q:`${a} : ${b} = x : ${dd}`, a:x, topic:'proportions', hint:'Правіла прапорцыі: a·dd = b·x.' };
}
function genGeometry(d){
  const k=rndInt(1,3);
  if(k===1){ const w=rndInt(2,5+d), h=rndInt(2,5+d); return { q:`Прамавугольнік ${w}×${h}. Плошча = ?`, a:w*h, topic:'geometry', hint:'Плошча = даўжыня × шырыня.' }; }
  if(k===2){ const w=rndInt(2,5+d), h=rndInt(2,5+d); return { q:`Прамавугольнік ${w}×${h}. Перыметр = ?`, a:2*(w+h), topic:'geometry', hint:'Перыметр = 2·(a+b).' }; }
  let b=rndInt(2,10); if(b%2) b++; const hh=rndInt(2,10); return { q:`Трохвугольнік: аснова ${b}, вышыня ${hh}. Плошча = ?`, a:b*hh/2, topic:'geometry', hint:'Плошча = (аснова × вышыня) / 2.' };
}
function genWord(d){
  const k=rndInt(1,4), n=15+d*7, m=rndInt(2,n-1);
  if(k===1) return { q:`У Алены было ${n} цукерак. Яна з'ела ${m}. Колькі засталося?`, a:n-m, topic:'word', hint:'Аднімі лік зедзеных.' };
  if(k===2){ const p=rndInt(1,5), kk=rndInt(2,6+d); return { q:`Адзін аловак каштуе ${p} руб. Колькі каштуюць ${kk} алоўкаў?`, a:p*kk, topic:'word', hint:'Памнож цану на колькасць.' }; }
  if(k===3) return { q:`У класе ${n} вучняў, з іх ${m} дзяўчынак. Колькі хлопчыкаў?`, a:n-m, topic:'word', hint:'Аднімі колькасць дзяўчынак.' };
  const tt=rndInt(2,4), s=tt*rndInt(3,4+d); return { q:`Аўтобус праехаў ${s} км за ${tt} гадзін. Скорасць (км/г)?`, a:s/tt, topic:'word', hint:'Скорасць = шлях / час.' };
}
const GENERATORS={natural:genNatural,fractions:genFractions,decimals:genDecimals,percents:genPercents,integers:genIntegers,equations:genEquations,proportions:genProportions,geometry:genGeometry,word:genWord};
function weakestTopicIds(){ return TOPICS.map(t=>({id:t.id, acc:S.topics[t.id].total?S.topics[t.id].correct/S.topics[t.id].total:0.5, total:S.topics[t.id].total})).sort((a,b)=>a.acc-b.acc); }
function chooseQuestion(scope){
  let topicId;
  if(scope && scope!=='mix'){ topicId=scope; }
  else { const w=weakestTopicIds(), weighted=[]; w.forEach((x,i)=>{ const c=4-i; for(let j=0;j<c;j++) weighted.push(x.id); }); topicId=pick(weighted); }
  let d=S.topics[topicId].level||3; if(d<1)d=1; if(d>10)d=10;
  const g=GENERATORS[topicId](d); g.topicId=topicId; g.difficulty=d; return g;
}
const cv=document.getElementById('confetti'); const ctx=cv.getContext('2d');
let particles=[], rafId=null;
function sizeCanvas(){ cv.width=window.innerWidth; cv.height=window.innerHeight; }
window.addEventListener('resize',sizeCanvas); sizeCanvas();
function burst(){
  const cols=['#ff6b6b','#feca57','#48dbfb','#1dd1a1','#a29bfe','#fd79a8'];
  for(let i=0;i<90;i++){ particles.push({x:window.innerWidth/2,y:window.innerHeight/2.4,vx:(Math.random()-0.5)*14,vy:(Math.random()-0.9)*14,g:0.35+Math.random()*0.2,col:pick(cols),life:70+Math.random()*30,r:3+Math.random()*4,rot:Math.random()*6,vr:(Math.random()-0.5)*0.3}); }
  if(!rafId) rafId=requestAnimationFrame(tick);
}
function tick(){ ctx.clearRect(0,0,cv.width,cv.height);
  particles.forEach(p=>{ p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.life--; p.rot+=p.vr;
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.globalAlpha=Math.max(0,p.life/80); ctx.fillStyle=p.col; ctx.fillRect(-p.r,-p.r,p.r*2,p.r*2); ctx.restore(); });
  particles=particles.filter(p=>p.life>0&&p.y<cv.height+50);
  if(particles.length){ rafId=requestAnimationFrame(tick); } else { ctx.clearRect(0,0,cv.width,cv.height); rafId=null; }
}
let audioCtx=null;
function beep(ok){ if(!S.settings.sound) return;
  try{ audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination); o.type='sine'; o.frequency.value=ok?880:220;
    g.gain.setValueAtTime(0.001,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.15,audioCtx.currentTime+0.02); g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.25);
    o.start(); o.stop(audioCtx.currentTime+0.26);
  }catch(e){} }
function $(id){ return document.getElementById(id); }
function show(id){ ['screen-home','screen-quiz','screen-result','screen-stats'].forEach(s=>$(s).classList.toggle('hidden',s!==id)); }
let S=loadState(); let session=null; let current=null;
function renderHome(){
  const g=overallGrade(S);
  $('home-grade').textContent = g===null?'—':g;
  $('home-level').textContent = S.level; $('home-xp').textContent = S.xp; $('home-streak').textContent = S.streakDays;
  const goal=Math.min(S.todayCount,S.dailyGoal);
  $('daily-fill').style.width=Math.round(goal/S.dailyGoal*100)+'%'; $('daily-text').textContent=`Сёння: ${goal}/${S.dailyGoal}`;
  const grid=$('topic-grid'); grid.innerHTML='';
  TOPICS.forEach(t=>{ const st=S.topics[t.id], acc=st.total?Math.round(st.correct/st.total*100):0;
    const b=document.createElement('button'); b.className='topic-card';
    b.innerHTML=`<span class="tc-emoji">${t.emoji}</span><span class="tc-name">${t.name}</span><span class="tc-stat">${st.total?acc+'% • ур. '+st.level:'нов.'}</span>`;
    b.onclick=()=>startSession(t.id); grid.appendChild(b); });
  show('screen-home');
}
function startSession(scope){ session={scope:scope||'mix',answered:0,correct:0,total:10,startXp:S.xp,perfect:true}; nextQuestion(); show('screen-quiz'); }
function nextQuestion(){
  if(session.answered>=session.total){ finishSession(); return; }
  current=chooseQuestion(session.scope);
  $('q-counter').textContent=`${session.answered+1} / ${session.total}`;
  $('q-topic').textContent=TOPIC_MAP[current.topicId].emoji+' '+TOPIC_MAP[current.topicId].name;
  $('quiz-fill').style.width=Math.round(session.answered/session.total*100)+'%';
  $('question').textContent=current.q;
  const inp=$('answer'); inp.value=''; inp.disabled=false;
  $('feedback').className='feedback hidden'; $('feedback').textContent='';
  $('submit-btn').classList.remove('hidden'); $('next-btn').classList.add('hidden'); $('mascot-emoji').textContent='🦉';
  inp.onkeydown=(e)=>{ if(e.key==='Enter') submitAnswer(); };
  setTimeout(()=>inp.focus(),50);
}
function parseAns(v){ if(v==null||v==='') return NaN; var t=String(v).replace(',','.').replace(/[^0-9.-]/g,''); if(t===''||t==='-'||t==='.') return NaN; return parseFloat(t); }
function submitAnswer(){
  const val=parseAns($('answer').value);
  if(isNaN(val)){ $('feedback').className='feedback warn'; $('feedback').textContent='Увядзі лік 🙂'; return; }
  $('answer').disabled=true;
  const ok=Math.abs(val-current.a)<0.01; const st=S.topics[current.topicId]; st.total++;
  if(ok){ st.correct++; session.correct++; S.correct++; S.solved++; session.answered++; const gain=5+current.difficulty*2; S.xp+=gain; if(st.level<10&&Math.random()<0.7) st.level++;
    $('mascot-emoji').textContent='🎉'; burst(); beep(true); $('feedback').className='feedback ok';
    $('feedback').innerHTML=`✅ Правільна! +${gain} XP<br><span class="hint">${current.hint}</span>`;
  } else { S.solved++; session.answered++; session.perfect=false; if(st.level>1) st.level--;
    $('mascot-emoji').textContent='🤔'; beep(false); $('feedback').className='feedback bad';
    $('feedback').innerHTML=`❌ Правільны адказ: <b>${current.a}</b><br><span class="hint">${current.hint}</span>`;
  }
  bumpLevel(); touchDay(); saveState();
  $('submit-btn').classList.add('hidden'); $('next-btn').classList.remove('hidden');
}
function nextQ(){ nextQuestion(); }
function bumpLevel(){ S.level=Math.floor(S.xp/100)+1; }
function touchDay(){
  const today=new Date().toISOString().slice(0,10);
  if(S.todayDate!==today){ S.todayDate=today; S.todayCount=0; const y=new Date(Date.now()-86400000).toISOString().slice(0,10); S.streakDays=(S.lastDay===y)?S.streakDays+1:1; }
  S.todayCount++; S.lastDay=today; checkBadges();
}
function checkBadges(){ BADGES.forEach(b=>{ if(!S.badges.includes(b.id) && b.test(S)) S.badges.push(b.id); }); }
function finishSession(){
  if(session.perfect && session.correct===session.total) S.hadPerfectSession=true;
  checkBadges(); saveState();
  const acc=session.correct/session.total; const grade=clampGrade(acc);
  $('res-grade').textContent=grade; $('res-acc').textContent=Math.round(acc*100)+'%';
  $('res-correct').textContent=session.correct+' / '+session.total; $('res-xp').textContent='+'+(S.xp-session.startXp)+' XP';
  $('res-msg').textContent = grade>=10?'Бездакорна! Ты супер! 🌟':grade>=8?'Выдатна! Яшчэ крыху да 10! 🚀':grade>=6?'Добра, працягвай трэніравацца! 💪':'Не здавайся — кожная спроба робіць мацнейшым! 🌱';
  if(grade>=8) burst(); show('screen-result');
}
function renderStats(){
  const g=overallGrade(S);
  $('st-grade').textContent=g===null?'—':g; $('st-solved').textContent=S.solved;
  $('st-acc').textContent=S.solved?Math.round(S.correct/S.solved*100)+'%':'—'; $('st-streak').textContent=S.streakDays;
  $('st-level').textContent=S.level; $('st-xp').textContent=S.xp;
  const wrap=$('topic-bars'); wrap.innerHTML='';
  TOPICS.forEach(t=>{ const st=S.topics[t.id], acc=st.total?Math.round(st.correct/st.total*100):0;
    const row=document.createElement('div'); row.className='bar-row';
    row.innerHTML=`<span class="bar-label">${t.emoji} ${t.name}</span><span class="bar"><span class="bar-fill" style="width:${acc}%"></span></span><span class="bar-val">${st.total?acc+'%':'—'}</span>`;
    wrap.appendChild(row); });
  const weak=weakestTopicIds().slice(0,3).filter(x=>S.topics[x.id].total>0);
  $('weak').textContent=weak.length?weak.map(w=>TOPIC_MAP[w.id].name).join(', '):'Пакуль няма даных — патрэніруйся!';
  const bw=$('badges'); bw.innerHTML='';
  BADGES.forEach(b=>{ const got=S.badges.includes(b.id); const d=document.createElement('div'); d.className='badge'+(got?' got':'');
    d.innerHTML=`<span class="b-emoji">${b.emoji}</span><span class="b-name">${b.name}</span>`; bw.appendChild(d); });
  $('sound-toggle').checked=!!S.settings.sound; show('screen-stats');
}
$('start-mix').onclick=()=>startSession('mix');
$('open-stats').onclick=()=>renderStats();
$('res-again').onclick=()=>startSession(session?session.scope:'mix');
$('res-home').onclick=()=>renderHome();
$('res-stats').onclick=()=>renderStats();
$('submit-btn').onclick=submitAnswer;
$('next-btn').onclick=nextQ;
$('stats-back').onclick=()=>renderHome();
$('sound-toggle').onchange=(e)=>{ S.settings.sound=e.target.checked; saveState(); };
$('reset-btn').onclick=()=>{ if(confirm('Скінуць увесь прагрэс?')){ S=defaultState(); saveState(); renderHome(); } };
$('quiz-quit').onclick=()=>renderHome();
renderHome();
