const $ = (id) => document.getElementById(id);
const state = { curve: [], result: null };
const profiles = {
  hybrid: { name: 'Hybrid Recovery + Paroli', steps: [['01','BASE','Start at a measured stake'],['02','RECOVER','Capped 1.55× after losses'],['03','PRESS','Press 1.5× on wins'],['04','RESET','Bank profit, return to base']] },
  flat: { name: 'Flat Stake Discipline', steps: [['01','FLAT','Same bet every roll'],['02','STEADY','No recovery chasing'],['03','TRACK','Pure probability read'],['04','RESET','Consistent exposure']] },
  martingale: { name: 'Capped Recovery', steps: [['01','BASE','Start at a measured stake'],['02','RECOVER','Raise after a loss'],['03','CAP','Hard loss-step ceiling'],['04','RESET','Accept loss, reset']] },
  fibonacci: { name: 'Fibonacci Ladder', steps: [['01','BASE','Begin at sequence start'],['02','LADDER','Move one step on losses'],['03','RETREAT','Step back on wins'],['04','RESET','Floor at base stake']] }
};
function money(n){return `${n<0?'−':'+'}$${Math.abs(n).toFixed(2)}`}
function configure(){
  $('basePctLabel').textContent = `${Number($('basePct').value).toFixed(2)}%`;
  $('takeLabel').textContent = `+${$('takeProfit').value}%`; $('stopLabel').textContent = `−${$('stopLoss').value}%`; $('rollLabel').textContent = $('maxRolls').value;
  const p = profiles[$('strategy').value]; $('strategyMap').innerHTML = p.steps.map((s,i)=>`<div class="${i===0?'active':''}"><b>${s[0]} / ${s[1]}</b><small>${s[2]}</small></div>`).join('');
  const pct=Number($('basePct').value), edge=Number($('edge').value), exposure=Math.min(100,Math.round(pct*8+edge*3+Number($('stopLoss').value)*.35));
  $('riskScore').textContent=`${exposure} / 100`; $('meterFill').style.width=`${exposure}%`; $('riskMessage').textContent=exposure<35?'Measured setup. Exposure is within a conservative simulation range.':exposure<65?'Moderate exposure. Keep the loss limit active and avoid chasing.':'High exposure. Reduce base bet or stop-loss before testing.';
  $('riskBadge',).textContent=exposure<35?'LOW INTENSITY':exposure<65?'MEDIUM INTENSITY':'HIGH INTENSITY';
}
function simulate(){
  const bankroll=Number($('bankroll').value), base=bankroll*Number($('basePct').value)/100, edge=Number($('edge').value), payout=Number($('payout').value), take=bankroll*Number($('takeProfit').value)/100, stop=bankroll*Number($('stopLoss').value)/100, maxRolls=Number($('maxRolls').value), strategy=$('strategy').value;
  let equity=bankroll, bet=base, wins=0, losses=0, wagered=0, peak=equity, maxDD=0, lossStreak=0, maxLossStreak=0, winStreak=0, fibIndex=0; const curve=[equity];
  // A small seeded-free run models the actual chance implied by payout and house edge.
  const chance=Math.max(0,Math.min(99.99,(100-edge)/payout)); let ended='max rolls';
  for(let i=0;i<maxRolls;i++){
    bet=Math.min(Math.max(bet,0), bankroll*.06, Math.max(equity,0)); if(bet<=0) {ended='bankroll exhausted';break}
    const won=Math.random()*100<chance; const profit=won?bet*(payout-1):-bet; equity+=profit; wagered+=bet; wins+=won?1:0; losses+=won?0:1; lossStreak=won?0:lossStreak+1; maxLossStreak=Math.max(maxLossStreak,lossStreak); winStreak=won?winStreak+1:0; peak=Math.max(peak,equity); maxDD=Math.max(maxDD,peak-equity); curve.push(equity);
    if(strategy==='flat') bet=base;
    else if(strategy==='martingale') bet=won?base:(lossStreak>=5?base:bet*1.55);
    else if(strategy==='fibonacci'){ fibIndex=won?Math.max(0,fibIndex-2):Math.min(7,fibIndex+1); const fib=[1,1,2,3,5,8,13,21]; bet=base*fib[fibIndex]; }
    else { if(won){ if(winStreak>=2){bet=base;winStreak=0}else bet=bet*1.5}else{bet=lossStreak>=5?base:bet*1.55} }
    if(equity-bankroll>=take){ended='take-profit';break} if(equity-bankroll<=-stop){ended='stop-loss';break}
  }
  state.curve=curve; state.result={equity,profit:equity-bankroll,wins,losses,wagered,maxDD,maxLossStreak,rolls:curve.length-1,chance,ended,bet}; renderResult();
}
function drawChart(){const c=$('chart'),ctx=c.getContext('2d'),d=devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;c.width=w*d;c.height=h*d;ctx.scale(d,d);ctx.clearRect(0,0,w,h);const vals=state.curve,min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;ctx.strokeStyle='#202b38';ctx.lineWidth=1;for(let i=1;i<5;i++){const y=i*h/5;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}ctx.strokeStyle='#66d9d0';ctx.lineWidth=2;ctx.beginPath();vals.forEach((v,i)=>{const x=i/(vals.length-1||1)*w,y=h-((v-min)/range)*(h-20)-10;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();const last=vals.at(-1),x=w,y=h-((last-min)/range)*(h-20)-10;ctx.fillStyle=last>=Number($('bankroll').value)?'#c6f36b':'#ff6c78';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill()}
function renderResult(){const r=state.result, bankroll=Number($('bankroll').value);$('chartEmpty').style.display='none';$('netResult').textContent=money(r.profit);$('netResult').style.color=r.profit>=0?'#c6f36b':'#ff6c78';$('netPercent').textContent=`${(r.profit/bankroll*100).toFixed(2)}% bankroll`;$('winRate').textContent=`${(r.wins/(r.rolls||1)*100).toFixed(1)}%`;$('evLabel').textContent=`Expected value: −${Number($('edge').value).toFixed(2)}%`; $('drawdown').textContent=`−$${r.maxDD.toFixed(2)}`;$('sessionId').textContent=`SESSION ${String(Date.now()).slice(-6)}`;$('lastRoll').textContent=`Roll #${r.rolls}`;$('rollNumber').textContent=r.rolls?Math.floor(Math.random()*100):'—';$('rollOutcome').textContent=`${r.ended.toUpperCase()} · ${r.wins} W / ${r.losses} L`;$('rollOutcome').style.color=r.profit>=0?'#c6f36b':'#ff6c78';$('rollBet').textContent=`Next bet $${r.bet.toFixed(2)}`;$('maxBet').textContent=`$${Math.min(Number($('bankroll').value)*.06,Math.max(...state.curve)*.06).toFixed(2)}`;$('lossStreak').textContent=`${r.maxLossStreak} rolls`;$('wagered').textContent=`$${r.wagered.toFixed(2)}`;drawChart()}
['strategy','bankroll','basePct','edge','payout','takeProfit','stopLoss','maxRolls'].forEach(id=>$(id).addEventListener('input',configure));$('runBtn').addEventListener('click',simulate);$('resetBtn').addEventListener('click',()=>{state.curve=[];$('chartEmpty').style.display='flex';['netResult','netPercent','winRate','evLabel','drawdown','lastRoll','rollNumber','rollOutcome','rollBet'].forEach(id=>$(id).textContent=id==='netResult'?'$0.00':'—');configure()});document.querySelectorAll('[data-scroll]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.scroll).scrollIntoView({behavior:'smooth'})));window.addEventListener('resize',()=>state.curve.length&&drawChart());configure();
const liveState = { connected: false };
function liveMessage(message, good = false){ $('liveStatus').textContent = message; $('liveStatus').style.color = good ? '#a6ca7c' : '#d8959b'; }
$('connectBtn').addEventListener('click', async () => { const coin = $('liveCoin').value; $('connectBtn').disabled = true; liveMessage('CONNECTING…'); try { const r = await fetch('/api/account', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({coin}) }); const data = await r.json(); if(!r.ok) throw new Error(data.error || 'Connection failed'); liveState.connected = true; $('accountBalance').textContent = `${data.balance.Balance} ${coin}`; $('accountDetails').textContent = `Edge ${data.settings.Edge}% · payout ${data.settings.MinPayout}–${data.settings.MaxPayout}×`; liveMessage('ACCOUNT READY', true); } catch(e) { liveMessage(e.message); $('accountBalance').textContent = '—'; } finally { $('connectBtn').disabled = false; } });
function updateArm(){ $('armBtn').disabled = !liveState.connected || !$('liveConfirm').checked || $('livePhrase').value !== 'I UNDERSTAND REAL MONEY'; }
$('liveConfirm').addEventListener('change', updateArm); $('livePhrase').addEventListener('input', updateArm);
$('armBtn').addEventListener('click', async () => { $('armBtn').disabled = true; try { const r = await fetch('/api/live/arm', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation:$('livePhrase').value})}); const data = await r.json(); if(!r.ok) throw new Error(data.error || 'Unable to arm'); liveMessage('LIVE ARMED', true); $('armBtn').textContent = 'SESSION ARMED'; } catch(e) { liveMessage(e.message); updateArm(); } });
