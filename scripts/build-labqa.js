// Converts content/guide-qa/*.qa into content/guide-src/zzz-labqa.md (collapsible Q&A per lab)
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..','content','guide-qa');
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
let out='';const blocks=new Map();let cur=null;
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.qa')).sort()){
  const lines=fs.readFileSync(path.join(dir,f),'utf8').split('\n');
  let id=null,q=null,a=[],inA=false,fence=false,n=0;
  const flush=()=>{ if(q!==null){ n++;
    cur.push(`<details>\n<summary><b>Q${n}.</b> ${q.replace(/`([^`]+)`/g,'<code>$1</code>')}</summary>\n\n${a.join('\n').trim()}\n\n</details>\n\n`); } q=null;a=[];inA=false;};
  for(const ln of lines){
    if(/^```/.test(ln)) fence=!fence;
    if(!fence&&ln.startsWith('=== ')){flush();id=ln.slice(4).trim();if(!blocks.has(id))blocks.set(id,[]);cur=blocks.get(id);n=cur.length;continue;}
    if(!fence&&ln.startsWith('Q: ')){flush();q=ln.slice(3).trim();continue;}
    if(!fence&&ln.trim()==='A:'&&q!==null&&!inA){inA=true;continue;}
    if(inA)a.push(ln);
  }
  flush();
}
for(const [id,arr] of blocks) out+=`@@ ${id}\n\n`+arr.join('');
fs.writeFileSync(path.join(__dirname,'..','content','guide-src','zzz-labqa.md'),out);
console.log('written',out.length);
