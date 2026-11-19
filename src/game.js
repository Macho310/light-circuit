import { svgLabel, labelWidth } from './svg-label.js';
import { cells as circuitCells, lampEntries, evaluatePuzzle, absoluteText, fractionText } from './circuit.js';
export function mountGame(options = {}) {
const DX=[1,0,-1,0],DY=[0,1,0,-1],VOLTAGE=12;
const PARTS=[],R=[],SHAPES=[],LINKS=[];
let FIXED=[],lampIndex=new Map();
function configure(p){for(let [key,array] of [['parts',PARTS],['resistances',R],['shapes',SHAPES],['links',LINKS]])array.splice(0,array.length,...p[key]);FIXED=p.fixed;lampIndex=new Map(lampEntries(p).map(({id,k},i)=>[id+':'+k,i]));}
const inside=(x,y)=>x>=0&&y>=0&&x<4&&y<4;
function cells(p,id=0){return circuitCells(puzzle,p,id)}
function targetText(id,k){return puzzle.targetFractions[lampIndex.get(id+':'+k)]}
function currentText(e,id,k){const v=e.exactCurrents[id][k];return e.short||e.invalid||v===null?'—':absoluteText(v)}
const $=id=>document.getElementById(id),GAP=140,ORIGIN=90;let puzzle,placed=Array(4).fill(null),turns=[0,0,0,0],drag=null,notice='',number=0,worker=null,requestId=0,disposed=false,generationNotice='',solved=false;
const baseSeed=options.seed??options.puzzle?.seed??new URLSearchParams(window.location.search).get('seed')??String(crypto.getRandomValues(new Uint32Array(1))[0]);
function withinBoard(p,id){return cells(p,id).every(([x,y])=>inside(x,y))}
function overlapEdges(ps=placed){let edges=new Map();let add=(a,b,owner)=>{let key=[a,b].sort((x,y)=>x-y).join(':');if(!edges.has(key))edges.set(key,{a:Math.min(a,b),b:Math.max(a,b),owners:[]});edges.get(key).owners.push(owner)};puzzle.wires.forEach(([a,b],i)=>add(a,b,'wire-'+i));FIXED.forEach((c,i)=>add(c.a,c.b,'fixed-'+i));ps.forEach((p,id)=>{if(!p)return;let cs=cells(p,id).map(([x,y])=>y*4+x);LINKS[id].forEach(([a,b])=>add(cs[a],cs[b],id))});return [...edges.values()].filter(e=>e.owners.length>1)}
function evaluate(){return evaluatePuzzle(puzzle,placed)}
function overlapSvg(edges){return edges.map(({a,b})=>{let x=ORIGIN+a%4*GAP,y=ORIGIN+Math.floor(a/4)*GAP,ex=ORIGIN+b%4*GAP,ey=ORIGIN+Math.floor(b/4)*GAP,cx=(x+ex)/2+(y===ey?0:22),cy=(y+ey)/2-(y===ey?22:0);return `<g class="overlap-warning" pointer-events="none"><title>部品が重なっています</title><path d="M${x} ${y}L${ex} ${ey}" stroke="#fa8174" stroke-width="15" stroke-opacity=".28" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="10" fill="#af3834" stroke="#ffc1a9" stroke-width="1.5"/><text x="${cx}" y="${cy+5}" text-anchor="middle" font-size="14" font-weight="700" fill="#fff3df">!</text></g>`}).join('')}

function potentialInfo(e){let groups=[];return e.volts.map((v,i)=>{let j=groups.findIndex(g=>v===null?g.net===e.nets[i]:g.v!==null&&Math.abs(g.v-v)<1e-7);if(j<0){j=groups.length;groups.push({v,net:e.nets[i]})}let voltage=groups[j].v;return {group:j,color:voltage===null?'#687b91':`hsl(210 70% ${38+Math.max(0,Math.min(1,voltage/VOLTAGE))*42}%)`}})}
function wireSvg(x,y,ex,ey,node,e,fixed,owner=0,current=0){let color=e?potentialInfo(e)[node].color:'#687b91';return `<path class="${fixed?'fixed-wire':'piece-wire'}" d="M${x} ${y}L${ex} ${ey}" stroke="${color}" stroke-width="${fixed?5:3}" ${fixed?'':`stroke-dasharray="${['8 5','2 5','12 4 2 4','12 4 2 4 2 4'][owner%4]}"`} stroke-linecap="round" fill="none"/>`+flowSvg(x,y,ex,ey,e?.short?null:current,fixed?5:3)}
function flowSvg(x,y,ex,ey,current,diameter){
if(current===null||!Number.isFinite(current)||Math.abs(current)<1e-8)return '';
if(current<0)[x,y,ex,ey]=[ex,ey,x,y];
return `<circle class="current-dot" r="${diameter/2}" fill="#f5d65f" pointer-events="none"><animateMotion path="M${x} ${y}L${ex} ${ey}" dur="${Math.hypot(ex-x,ey-y)/65}s" repeatCount="indefinite"/></circle>`;
}
function componentSvg(id,k,a,b,e,large=false){let type=PARTS[id][k],current=e?.short||e?.invalid?null:e?e.currents[id][k]:0,x=ORIGIN+a[0]*GAP,y=ORIGIN+a[1]*GAP,ex=ORIGIN+b[0]*GAP,ey=ORIGIN+b[1]*GAP,cx=(x+ex)/2,cy=(y+ey)/2,vx=(ex-x)/GAP,vy=(ey-y)/GAP,d=DX.findIndex((dx,i)=>dx===vx&&DY[i]===vy),good=type==='lamp'&&e?.matches?.[lampIndex.get(id+':'+k)],active=current!==null&&Math.abs(current)>1e-8,stroke=active?'#f5d65f':'#92979e',flow=type==='battery'?-current:current,s='';
if(type==='wire')s+=wireSvg(x,y,ex,ey,a[1]*4+a[0],e,id>=4,id,flow);else{s+=wireSvg(x,y,cx-vx*17,cy-vy*17,a[1]*4+a[0],e,id>=4,id,flow)+wireSvg(cx+vx*17,cy+vy*17,ex,ey,b[1]*4+b[0],e,id>=4,id,flow);if(type==='lamp')s+=`<circle class="lamp-symbol" cx="${cx}" cy="${cy}" r="19" fill="${active?(good?'#f5d65f':'#d8cb91'):'#33363b'}" stroke="${stroke}" stroke-width="2"/>${large?'':`<text class="resistance-value" x="${cx}" y="${cy+4}" text-anchor="middle" fill="${active?'#33312a':'#c5c9ce'}" font-size="16">${R[id][k]}Ω</text>`}`;if(type==='battery')s+=`<g transform="rotate(${d*90} ${cx} ${cy})"><path d="M${cx-5} ${cy-22}v44m11 -34v24M${cx-17} ${cy}h12m11 0h11" stroke="#ead19c" stroke-width="3"/></g>`;if(type==='resistor')s+=`<rect class="resistor-symbol" x="${cx-(vy?13:17)}" y="${cy-(vy?17:13)}" width="${vy?26:34}" height="${vy?34:26}" fill="${active?'#454640':'#33363b'}" stroke="${stroke}" stroke-width="2"/>${large?'':`<text class="resistance-value" x="${cx}" y="${cy+4}" text-anchor="middle" fill="${stroke}" font-size="16">${R[id][k]}Ω</text>`}`}

if(type!=='wire'){s+=`<g class="component-meta" fill="${good?'#f5d65f':'#d9dde2'}" stroke="#33363b" stroke-width="4" paint-order="stroke">`;if(large&&type!=='battery')s+=`<text class="resistance-value" x="${cx-27}" y="${cy+38}" text-anchor="end" font-size="38">${R[id][k]}Ω</text>`;if(type==='battery')s+=`<text x="${large?cx-27:cx}" y="${large?cy+38:cy-31}" text-anchor="${large?'end':'middle'}" font-size="${large?38:16}">12V</text>`;if(type==='lamp'){
if(e)s+=`<g class="lamp-current">${svgLabel([{text:currentText(e,id,k)+'A'}],cx-12,cy+40,14,'end','actual-current')}${svgLabel([{text:targetText(id,k)+'A',fill:'#d7c39a'}],cx+12,cy+40,14,'start','target-current')}</g>`;
else s+=svgLabel([{text:targetText(id,k)+'A',fill:'#d7c39a'}],cx+27,cy+35,large?36:14,'start','target-current');
if(good&&active)s+=`<text class="target-check" x="${cx+23}" y="${cy-18}" font-size="13" fill="#f5d65f">&#x2713;</text>`;
}else if(e)s+=svgLabel([{text:currentText(e,id,k)+'A'}],cx-17,cy+26,14,'end','actual-current');s+=`</g>`;}

return s}
function pieceSvg(id,p,e,opacity=1,interactive=true,large=false){interactive=interactive&&!solved&&!options.preview;let cs=cells(p,id),s=`<g ${interactive?`data-piece="${id}" tabindex="0" role="button" aria-label="ピース${id+1}、${cs.length}端子、クリックで回転、ドラッグで移動"`:''} opacity="${opacity}" class="piece">`;
// Catch the part's actual branches, leaving the rest of its footprint transparent to other pieces.
for(let [a,b] of LINKS[id]){let [x,y]=cs[a],[ex,ey]=cs[b];s+=`<path d="M${ORIGIN+x*GAP} ${ORIGIN+y*GAP}L${ORIGIN+ex*GAP} ${ORIGIN+ey*GAP}" fill="none" stroke="transparent" stroke-width="36" stroke-linecap="round" pointer-events="stroke"/>`}
for(let k=0;k<PARTS[id].length;k++){let link=LINKS[id][k];s+=componentSvg(id,k,cs[link[0]],cs[link[1]],e,large)}for(let [x,y]of cs)s+=`<circle cx="${ORIGIN+x*GAP}" cy="${ORIGIN+y*GAP}" r="4" fill="#e5e9da"/>`;return s+'</g>'}
function dragHighlight(id,p,color){let cs=cells(p,id),path=LINKS[id].map(([a,b])=>`M${ORIGIN+cs[a][0]*GAP} ${ORIGIN+cs[a][1]*GAP}L${ORIGIN+cs[b][0]*GAP} ${ORIGIN+cs[b][1]*GAP}`).join(' ');return `<g class="drag-highlight" pointer-events="none"><path d="${path}" fill="none" stroke="${color}" stroke-width="24" stroke-opacity=".15" stroke-linecap="round" stroke-linejoin="round"/><path d="${path}" fill="none" stroke="${color}" stroke-width="13" stroke-opacity=".35" stroke-linecap="round" stroke-linejoin="round"/></g>`}
function pieceBox(id,p){let cs=cells(p,id),x=Math.min(...cs.map(c=>ORIGIN+c[0]*GAP))-GAP/2-5,y=Math.min(...cs.map(c=>ORIGIN+c[1]*GAP))-GAP/2-5;return [x,y,(Math.max(...cs.map(c=>c[0]))-Math.min(...cs.map(c=>c[0]))+1)*GAP+10,(Math.max(...cs.map(c=>c[1]))-Math.min(...cs.map(c=>c[1]))+1)*GAP+10].join(' ')}

function potentialLabels(e,info){let boxes=[],labels=[],out='',rect=(x,y,w,h)=>({x,y,w,h}),intersect=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;let addWire=(a,b)=>{let x=ORIGIN+a%4*GAP,y=ORIGIN+Math.floor(a/4)*GAP,ex=ORIGIN+b%4*GAP,ey=ORIGIN+Math.floor(b/4)*GAP;boxes.push(rect(Math.min(x,ex)-7,Math.min(y,ey)-7,Math.abs(ex-x)+14,Math.abs(ey-y)+14))};puzzle.wires.forEach(([a,b])=>addWire(a,b));for(let c of e.components){addWire(c.a,c.b);if(c.type==='wire')continue;let x=ORIGIN+(c.a%4+c.b%4)*GAP/2,y=ORIGIN+(Math.floor(c.a/4)+Math.floor(c.b/4))*GAP/2,vertical=c.a%4===c.b%4;boxes.push(rect(x-24,y-25,48,50));if(c.type==='lamp'){const actualWidth=labelWidth([{text:currentText(e,c.id,c.k)+'A'}],14),targetWidth=labelWidth([{text:targetText(c.id,c.k)+'A'}],14);boxes.push(rect(x-12-actualWidth,y+19,actualWidth,33),rect(x+12,y+19,targetWidth,33));boxes.push(rect(x+20,y-32,20,20))}else boxes.push(rect(x-125,y+5,104,33));if(c.type==='battery')boxes.push(rect(x-30,y-45,60,22))}
for(let group of [...new Set(info.map(v=>v.group))]){let nodes=info.map((v,i)=>v.group===group?i:-1).filter(i=>i>=0),pick=null,best=Infinity;for(let i of nodes){let x=ORIGIN+i%4*GAP,y=ORIGIN+Math.floor(i/4)*GAP,label=e.volts[i]===null?'—':fractionText(e.exactVolts[i])+'V',w=Math.max(54,labelWidth([{text:label}],14)+18);for(let [dx,dy] of [[-37,-34],[37,-34],[-37,34],[37,34],[0,-40],[0,40],[-50,0],[50,0],[-55,-55],[55,-55],[-55,55],[55,55]]){let box=rect(x+dx-w/2,y+dy-19,w,38);if(box.x<5||box.x+w>595||box.y<5||box.y+38>595)continue;let hits=[...boxes,...labels].filter(b=>intersect(box,b)).length,score=hits*1000+Math.hypot(dx,dy);if(score<best){best=score;pick={i,x,y,label,box}}}if(best<60)break}if(!pick)continue;let {i,x,y,label,box:b}=pick;const offset=options.preview?.labelOffsets?.[label];if(offset){b.x+=offset.x;b.y+=offset.y}labels.push(b);out+=`<g class="potential-label" pointer-events="none"><path d="M${x} ${y}L${b.x+b.w/2} ${b.y+b.h/2}" stroke="${info[i].color}" stroke-width="1" opacity=".35"/><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="5" fill="#282a2e"/>${svgLabel([{text:label,fill:info[i].color}],b.x+b.w/2,b.y+23,14)}</g>`}return out}
function draw(){if(!puzzle){renderStatus();return}let e=evaluate(),wasSolved=solved,info=potentialInfo(e),s='';if(e.win)solved=true;for(let [wireId,[a,b]] of puzzle.wires.entries()){let x=ORIGIN+a%4*GAP,y=ORIGIN+Math.floor(a/4)*GAP,xx=ORIGIN+b%4*GAP,yy=ORIGIN+Math.floor(b/4)*GAP;s+=wireSvg(x,y,xx,yy,a,e,true,0,e.wireCurrents[wireId])}for(let i=0;i<16;i++)s+=`<circle cx="${ORIGIN+i%4*GAP}" cy="${ORIGIN+Math.floor(i/4)*GAP}" r="3.5" fill="${info[i].color}"/>`;FIXED.forEach((c,j)=>{s+=`<g class="fixed-component" pointer-events="none">${componentSvg(4+j,0,[c.a%4,Math.floor(c.a/4)],[c.b%4,Math.floor(c.b/4)],e)}</g>`});placed.forEach((p,id)=>{if(p)s+=pieceSvg(id,p,e,drag?.moving&&drag.id===id?.15:1)});if(drag?.moving&&drag.over){let p=drag.candidate,color=withinBoard(p,drag.id)?(overlapEdges(placed.map((q,i)=>i===drag.id?p:q)).length?'#efb16c':'#b9dda7'):'#ed9889';s+=`<g pointer-events="none">${dragHighlight(drag.id,p,color)}${pieceSvg(drag.id,p,null,.85,false)}</g>`}

s+=potentialLabels(e,info);s+=overlapSvg(e.overlaps);if(options.preview){options.preview.receive({board:s,piece:pieceSvg(0,{x:0,y:0,d:0},null,1,false),tray:placed.map((p,id)=>p?null:{viewBox:pieceBox(id,{x:0,y:0,d:0}),markup:pieceSvg(id,{x:0,y:0,d:0},null,1,false,true)}),evaluation:e});return}$('board').innerHTML=s;
if($('tray').children.length!==4){$('tray').innerHTML='';for(let id=0;id<4;id++)$('tray').append(document.createElement('div'))}for(let id=0;id<4;id++){let slot=$('tray').children[id];slot.className='tray-slot'+(placed[id]?' placed':'');if(placed[id])slot.innerHTML=`<span>ピース ${id+1}</span>`;else{let p={x:0,y:0,d:turns[id]};slot.innerHTML=`<svg viewBox="${pieceBox(id,p)}">${pieceSvg(id,p,null,1,true,true)}</svg>`}}
renderStatus(e);if($('number'))$('number').textContent=options.puzzle?.daily?.date??String(number).padStart(2,'0');if(drag?.moving&&!drag.over){let p={x:0,y:0,d:turns[drag.id]};$('ghost').innerHTML=`<svg viewBox="${pieceBox(drag.id,p)}">${dragHighlight(drag.id,p,'#e3cc99')}${pieceSvg(drag.id,p,null,.9,false)}</svg>`;$('ghost').style.left=drag.clientX+'px';$('ghost').style.top=drag.clientY+'px';$('ghost').hidden=false}else $('ghost').hidden=true;if(solved&&!wasSolved)options.onSolved?.()}
function renderStatus(e){
  if (!$('status')) return;
  const message=generationNotice||(e?.overlaps.length?`部品が${e.overlaps.length}区間で重なっています。移動して解消してください。`:notice||(e?.short?'ショート：電池が導線で直結されています':e?.invalid?'回路計算が成立しません':e?.win?'完成！ 全電球の目標電流と、全素子の通電を満たしました':e&&placed.every(Boolean)&&e.matches.every(Boolean)?'電池・電球・抵抗のすべてに電流を流してください':''));
  $('status').textContent=message;
  $('status').className=generationNotice?'':e?.win?'win':e?.short||e?.invalid||e?.overlaps.length?'danger':message?'':'empty';
}
function newPuzzle(){
  worker?.terminate();
  const id=++requestId,seed=id===1?baseSeed:`${baseSeed}:${id-1}`;
  generationNotice='Loading...';
  if($('answer'))$('answer').disabled=!puzzle;
  if(!puzzle&&$('tray').children.length!==4){for(let i=0;i<4;i++){const slot=document.createElement('div');slot.className='tray-slot';$('tray').append(slot)}}
  $('workspace').setAttribute('aria-busy','true');
  renderStatus();
  function finish(message){worker?.terminate();worker=null;generationNotice=message;$('workspace').setAttribute('aria-busy','false');if($('answer'))$('answer').disabled=!puzzle;draw()}
  try{
    worker=new Worker(new URL('./generator.worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
      if(disposed||data.requestId!==requestId)return;
      if(data.type==='progress'){generationNotice=`Loading... (${data.stats.candidates})`;renderStatus();return}
      if(data.type==='error'){finish('問題の生成に失敗しました。「新しい問題」で再試行できます。');return}
      if(data.type!=='result')return;
      if(!data.puzzle||data.puzzle.validation?.complete!==true||data.puzzle.validation?.solutions!==1){finish('試行上限に達しました。「新しい問題」で再試行できます。');return}
      // Replace the board only after complete uniqueness verification.
      puzzle=data.puzzle;configure(puzzle);placed=Array(4).fill(null);turns=[0,0,0,0];drag=null;notice='';solved=false;number++;
      $('board').dataset.seed=String(puzzle.seed);$('board').dataset.generatorVersion=puzzle.generatorVersion;
      finish('');
    };
    worker.onerror=event=>{if(disposed||id!==requestId)return;event.preventDefault();finish('問題の生成に失敗しました。「新しい問題」で再試行できます。')};
    worker.postMessage({seed,requestId:id});
  }catch{finish('問題の生成を開始できませんでした。「新しい問題」で再試行できます。')}
}
function boardPoint(x,y){let p=$('board').createSVGPoint();p.x=x;p.y=y;return p.matrixTransform($('board').getScreenCTM().inverse())}
function overBoard(x,y){let r=$('board').getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom}
function candidateFor(s,x,y){let p=boardPoint(x,y);return {x:Math.round((p.x-s.offset.x-ORIGIN)/GAP),y:Math.round((p.y-s.offset.y-ORIGIN)/GAP),d:turns[s.id]}}
function rotatePiece(id){if(solved||options.isPaused?.())return;let d=(turns[id]+1)%4;if(!placed[id]){turns[id]=d;return}let p={...placed[id],d},cs=cells(p,id),xs=cs.map(c=>c[0]),ys=cs.map(c=>c[1]),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);p.x+=minx<0?-minx:maxx>3?3-maxx:0;p.y+=miny<0?-miny:maxy>3?3-maxy:0;placed[id]=p;turns[id]=d;notice=''}

function pointerDown(ev){let node=ev.target.closest('[data-piece]');if(solved||options.isPaused?.()||!puzzle||!node||drag||ev.button&&ev.button!==0)return;let id=+node.dataset.piece,p=placed[id],point=boardPoint(ev.clientX,ev.clientY);turns[id]=p?.d??turns[id];drag={id,pointerId:ev.pointerId,startX:ev.clientX,startY:ev.clientY,moving:false,over:false,offset:p?{x:point.x-(ORIGIN+p.x*GAP),y:point.y-(ORIGIN+p.y*GAP)}:{x:(Math.min(...cells({x:0,y:0,d:turns[id]},id).map(c=>c[0]))+Math.max(...cells({x:0,y:0,d:turns[id]},id).map(c=>c[0])))*GAP/2,y:(Math.min(...cells({x:0,y:0,d:turns[id]},id).map(c=>c[1]))+Math.max(...cells({x:0,y:0,d:turns[id]},id).map(c=>c[1])))*GAP/2}};notice='';$('workspace').setPointerCapture(ev.pointerId);ev.preventDefault()}
function pointerMove(ev){if(solved||options.isPaused?.()||!drag||drag.pointerId!==ev.pointerId)return;if(!drag.moving&&Math.hypot(ev.clientX-drag.startX,ev.clientY-drag.startY)<6)return;drag.moving=true;drag.clientX=ev.clientX;drag.clientY=ev.clientY;drag.over=overBoard(ev.clientX,ev.clientY);drag.candidate=candidateFor(drag,ev.clientX,ev.clientY);draw();ev.preventDefault()}
function pointerUp(ev){if(solved||options.isPaused?.()||!drag||drag.pointerId!==ev.pointerId)return;let s=drag;drag=null;if(s.moving){if(overBoard(ev.clientX,ev.clientY)){let p=candidateFor(s,ev.clientX,ev.clientY);if(withinBoard(p,s.id))placed[s.id]=p;else notice='盤外には置けません'}else placed[s.id]=null}else rotatePiece(s.id);if($('workspace').hasPointerCapture(ev.pointerId))$('workspace').releasePointerCapture(ev.pointerId);draw()}
if(options.preview){puzzle=options.puzzle;configure(puzzle);placed=options.preview.positions;draw();const cleanup=()=>{};cleanup.cancelDrag=()=>{};return cleanup}
$('workspace').onpointerdown=pointerDown;$('workspace').onpointermove=pointerMove;$('workspace').onpointerup=pointerUp;$('workspace').onpointercancel=()=>{drag=null;draw()};$('workspace').onkeydown=ev=>{let n=ev.target.closest('[data-piece]');if(puzzle&&n&&(ev.key==='Enter'||ev.key===' ')){ev.preventDefault();rotatePiece(+n.dataset.piece);draw()}};if($('new'))$('new').onclick=()=>newPuzzle();if($('answer'))$('answer').onclick=()=>{if(!puzzle||solved||options.isPaused?.())return;drag=null;placed=puzzle.answer.map(p=>({...p}));turns=placed.map(p=>p.d);notice='答えの一例を表示しています';draw()};
if(options.puzzle){puzzle=options.puzzle;configure(puzzle);if($('answer'))$('answer').disabled=false;$('board').dataset.seed=String(puzzle.seed);$('board').dataset.generatorVersion=puzzle.generatorVersion;draw()}else newPuzzle();

const cleanup = () => { disposed=true;worker?.terminate(); for (const id of ["workspace", "new", "answer"]) { const node = document.getElementById(id); if (node) { node.onpointerdown = node.onpointermove = node.onpointerup = node.onpointercancel = node.onkeydown = node.onclick = null; } } };
cleanup.cancelDrag=()=>{if(drag&&$('workspace').hasPointerCapture(drag.pointerId))$('workspace').releasePointerCapture(drag.pointerId);drag=null;$('ghost').hidden=true;draw()};
return cleanup;
}

// Render tutorial frames through the exact same circuit evaluator and SVG renderer.
/** @returns {{board: string, piece: string, tray: Array<null | {viewBox: string, markup: string}>, evaluation: ReturnType<typeof evaluatePuzzle> & {win: boolean}}} */
export function renderPuzzlePreview(puzzle, positions, settings = {}) {
  let frame;
  mountGame({puzzle, preview:{...settings, positions, receive:value=>{frame=value;}}});
  if (!frame) throw new Error('Tutorial frame could not be rendered');
  return frame;
}
