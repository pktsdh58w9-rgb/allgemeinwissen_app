const {chromium}=require('playwright');const fs=require('fs');
const mode=process.argv[2]||'preview';
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:540,height:960},deviceScaleFactor:2});
 await p.goto('file://'+process.cwd()+'/reel.html');await p.waitForTimeout(500);
 if(mode==='preview'){
  for(const t of [3,10,18,26,35,39]){await p.evaluate(t=>render(t),t);await p.screenshot({path:`prev_${t}.png`});}
 }else{
  fs.mkdirSync('frames',{recursive:true});const fps=30,dur=await p.evaluate(()=>DUR);
  for(let i=0;i<fps*dur;i++){await p.evaluate(t=>render(t),i/fps);await p.screenshot({path:`frames/f${String(i).padStart(5,'0')}.jpg`,type:'jpeg',quality:92});}
 }
 await b.close();})();
