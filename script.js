const SIZE = 9;
const BASE_TIME = 32;
const LEVELS = [
  { cores: 3, time: 32, walls: 10, echoAfter: 9, bonus: 100 },
  { cores: 4, time: 36, walls: 15, echoAfter: 8, bonus: 150 },
  { cores: 5, time: 40, walls: 19, echoAfter: 7, bonus: 220 }
];

let state = {
  level: 0, player: {x:1,y:1}, exit:{x:7,y:7}, cores:[],
  walls:new Set(), trail:[], echoes:[], score:0, time:0,
  timer:null, running:false, sound:true, moveCount:0
};

const $ = id => document.getElementById(id);
const screens = { menu:$("menuScreen"), game:$("gameScreen"), result:$("resultScreen") };

function show(screen) {
  Object.values(screens).forEach(s=>s.classList.remove("active"));
  screen.classList.add("active");
}

function key(x,y){ return `${x},${y}`; }
function rand(max){ return Math.floor(Math.random()*max); }

function beep(freq=440, duration=.05) {
  if (!state.sound) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx(), osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.value = freq; osc.type = "sine"; gain.gain.value=.025;
    osc.connect(gain); gain.connect(ctx.destination); osc.start();
    setTimeout(()=>{osc.stop();ctx.close()}, duration*1000);
  } catch {}
}

function neighbors(x,y) {
  return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]
    .filter(([a,b])=>a>=0&&a<SIZE&&b>=0&&b<SIZE);
}

function reachable(a,b,walls) {
  const q=[[a.x,a.y]], seen=new Set([key(a.x,a.y)]);
  while(q.length){
    const [x,y]=q.shift();
    if(x===b.x&&y===b.y) return true;
    for(const [nx,ny] of neighbors(x,y)){
      const k=key(nx,ny);
      if(!seen.has(k)&&!walls.has(k)){seen.add(k);q.push([nx,ny]);}
    }
  }
  return false;
}

function buildLevel() {
  clearInterval(state.timer);
  const cfg=LEVELS[state.level];
  state.player={x:1,y:1}; state.exit={x:7,y:7}; state.cores=[];
  state.walls=new Set(); state.trail=[]; state.echoes=[]; state.time=cfg.time;
  state.moveCount=0; state.running=true;

  let attempts=0;
  while(state.walls.size<cfg.walls && attempts++<1000){
    const x=rand(SIZE),y=rand(SIZE),k=key(x,y);
    if((x<=1&&y<=1)||(x===7&&y===7)) continue;
    state.walls.add(k);
    if(!reachable(state.player,state.exit,state.walls)) state.walls.delete(k);
  }
  while(state.cores.length<cfg.cores){
    const x=1+rand(7),y=1+rand(7),k=key(x,y);
    if(!state.walls.has(k)&&!(x===1&&y===1)&&!(x===7&&y===7)&&!state.cores.some(c=>key(c.x,c.y)===k))
      state.cores.push({x,y});
  }
  render();
  updateHud();
  $("statusText").textContent="Recover every core. Your route is being recorded.";
  state.timer=setInterval(tick,1000);
}

function tick(){
  if(!state.running)return;
  state.time--;
  updateHud();
  if(state.time<=0) endGame(false,"Time collapsed. The archive closed before you escaped.");
}

function render(){
  const board=$("board"); board.innerHTML="";
  for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++){
    const c=document.createElement("div"); c.className="cell";
    const k=key(x,y);
    if(state.walls.has(k)) c.classList.add("wall");
    if(state.trail.some(p=>p.x===x&&p.y===y)) c.classList.add("trail");
    if(state.cores.some(p=>p.x===x&&p.y===y)) c.classList.add("core");
    if(state.echoes.some(e=>e.path[e.index]&&e.path[e.index].x===x&&e.path[e.index].y===y)) c.classList.add("echo");
    if(state.player.x===x&&state.player.y===y) c.classList.add("player");
    if(state.exit.x===x&&state.exit.y===y) c.classList.add("exit");
    board.appendChild(c);
  }
}

function updateHud(){
  const cfg=LEVELS[state.level];
  $("levelText").textContent=state.level+1;
  $("coresText").textContent=`${cfg.cores-state.cores.length}/${cfg.cores}`;
  $("timeText").textContent=state.time;
  $("scoreText").textContent=state.score;
  $("missionText").textContent=`Recover ${cfg.cores} Memory Cores`;
  $("timeText").style.color=state.time<=8?"#ff4f8b":"";
}

function addEchoIfReady(){
  const cfg=LEVELS[state.level];
  if(state.moveCount>0 && state.moveCount%cfg.echoAfter===0 && state.trail.length>=3){
    const copy=state.trail.map(p=>({...p}));
    state.echoes.push({path:copy,index:0});
    $("echoList").innerHTML="";
    [...state.echoes].reverse().forEach((e,i)=>{
      const div=document.createElement("div"); div.className="echo-item";
      div.textContent=`Echo ${state.echoes.length-i}: repeating ${e.path.length} recorded moves`;
      $("echoList").appendChild(div);
    });
    beep(180,.12);
  }
}

function move(dx,dy){
  if(!state.running)return;
  const nx=state.player.x+dx, ny=state.player.y+dy, k=key(nx,ny);
  if(nx<0||nx>=SIZE||ny<0||ny>=SIZE||state.walls.has(k)){beep(100,.04);return;}
  state.player={x:nx,y:ny};
  state.trail.push({...state.player});
  state.moveCount++;
  for(const e of state.echoes) if(e.index<e.path.length-1) e.index++;
  collect();
  addEchoIfReady();
  if(state.echoes.some(e=>e.path[e.index] && e.path[e.index].x===nx && e.path[e.index].y===ny)){
    state.score=Math.max(0,state.score-50);
    $("statusText").textContent="⚠ Echo collision! Your score dropped by 50.";
    beep(90,.18);
  } else {
    $("statusText").textContent="Route recorded. The archive remembers everything.";
    beep(420,.035);
  }
  if(state.cores.length===0 && nx===state.exit.x && ny===state.exit.y){
    state.score += state.time*10 + LEVELS[state.level].bonus;
    if(state.level<LEVELS.length-1){
      state.running=false; clearInterval(state.timer);
      state.level++;
      setTimeout(buildLevel,650);
    } else endGame(true,"You broke the loop and recovered the entire archive.");
  }
  render(); updateHud();
}

function collect(){
  const i=state.cores.findIndex(c=>c.x===state.player.x&&c.y===state.player.y);
  if(i>=0){
    state.cores.splice(i,1); state.score+=100; beep(760,.12);
    $("statusText").textContent="Memory Core recovered. Keep moving.";
  }
}

function endGame(win,message){
  state.running=false; clearInterval(state.timer);
  $("resultIcon").textContent=win?"✓":"×";
  $("resultTitle").textContent=win?"ARCHIVE ESCAPED":"PROTOCOL FAILED";
  $("resultMessage").textContent=message;
  $("finalScore").textContent=state.score;
  $("finalLevel").textContent=state.level+1;
  $("finalEchoes").textContent=state.echoes.length;
  show(screens.result);
}

document.addEventListener("keydown",e=>{
  const m={ArrowUp:[0,-1],w:[0,-1],W:[0,-1],ArrowDown:[0,1],s:[0,1],S:[0,1],
           ArrowLeft:[-1,0],a:[-1,0],A:[-1,0],ArrowRight:[1,0],d:[1,0],D:[1,0]}[e.key];
  if(m){e.preventDefault();move(...m);}
});
document.querySelectorAll("[data-move]").forEach(btn=>{
  btn.addEventListener("click",()=>({up:move(0,-1),down:move(0,1),left:move(-1,0),right:move(1,0)}[btn.dataset.move]));
});
$("startBtn").onclick=()=>{state={...state,level:0,score:0};show(screens.game);buildLevel();};
$("playAgainBtn").onclick=()=>{state={...state,level:0,score:0};show(screens.game);buildLevel();};
$("restartBtn").onclick=()=>buildLevel();
$("menuBtn").onclick=()=>{state.running=false;clearInterval(state.timer);show(screens.menu);};
$("soundBtn").onclick=()=>{state.sound=!state.sound;$("soundBtn").textContent=state.sound?"🔊":"🔇";};
