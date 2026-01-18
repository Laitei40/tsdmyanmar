const fs = require('fs');
const s = fs.readFileSync('js/core/header.js', 'utf8');
try{
  new Function(s);
  console.log('parse ok');
}catch(e){
  console.log('error:', e.message);
  console.log(e.stack);
  // try to extract line number from stack
  const m = e.stack && e.stack.match(/<anonymous_script>:(\d+):(\d+)/);
  if (m){
    const line = parseInt(m[1],10);
    const col = parseInt(m[2],10);
    const lines = s.split(/\r?\n/);
    const start = Math.max(0,line-6);
    const end = Math.min(lines.length, line+3);
    console.log('--- context ---');
    for(let i=start;i<end;i++){
      const ln = i+1;
      console.log((ln===line? '>>':'  ')+ln+':'+lines[i]);
    }
    console.log('col',col);
  }
}
