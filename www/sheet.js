/* CEM 3.6.0: reads spreadsheet files in the browser. No library, nothing is uploaded: the file never leaves the phone or computer.
   Formats: CSV, TSV and plain text tables (comma, semicolon, tab or pipe), Excel .xlsx / .xlsm, and OpenDocument .ods.
   Not supported: the old binary Excel .xls (and password-protected files). The reader says so and tells the person to Save as .xlsx or CSV.
   An .xlsx and an .ods file are ZIP archives of XML. The ZIP is read here (central directory + the browser's built-in DecompressionStream),
   so no download of a library is needed and nothing runs from the file (no macros, no formulas: only the stored values are read).
   API:  CEMSheet.read(file)                 -> Promise<{kind, sheets:[{name, rows:[[cell,...],...], nums:[sourceRowNumber,...]}]}>
         CEMSheet.readBytes(uint8Array,name) -> same, from bytes (used by the tests)
         CEMSheet.parseCsv(text, delimiter)  -> [[cell,...],...]
   Limits: 8 MB per file, 48 MB after unzipping, 5,000 data rows and 60 columns per sheet, 12 sheets. */
(function(root){
const MAX_BYTES=8*1024*1024,MAX_UNZIP=48*1024*1024,MAX_ROWS=5000,MAX_COLS=60,MAX_SHEETS=12;
const u16=(d,o)=>d[o]|(d[o+1]<<8),u32=(d,o)=>(d[o]|(d[o+1]<<8)|(d[o+2]<<16)|(d[o+3]<<24))>>>0;
const utf8=u=>new TextDecoder('utf-8').decode(u);
const OLD_XLS='This is an old Excel (.xls) file, or it is password protected, and the app cannot read it. Open it in Excel or Google Sheets, choose Save as / Download as .xlsx or CSV, and import that file.';

/* ---------- cleaning ---------- */
// Our own export writes a leading apostrophe in front of cells that start with = + - @ (so a spreadsheet never runs them as a formula). Take it off again.
const clean=v=>{let s=String(v==null?'':v).replace(/[\u00a0\u200b\ufeff]/g,' ').trim();if(/^'[=+\-@]/.test(s))s=s.slice(1);return s};
const numStr=v=>{
 const x=+v;if(!isFinite(x))return String(v);
 if(Number.isInteger(x)&&Math.abs(x)<9007199254740992)return String(x);   // exact: phone numbers, roll numbers
 if(Math.abs(x)>=9007199254740992&&Math.abs(x)<1e21)return x.toLocaleString('fullwide',{useGrouping:false,maximumSignificantDigits:15});   // Excel keeps only 15 digits
 return String(+x.toPrecision(15));
};
const pad=n=>String(n).padStart(2,'0');
const serialDate=n=>{   // Excel serial number -> text
 const d=new Date(Math.round((n-25569)*864e5)),day=Math.floor(n),frac=n-day;
 if(n>0&&n<1)return pad(d.getUTCHours())+':'+pad(d.getUTCMinutes());
 const ymd=d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate());
 return frac>1e-6?ymd+' '+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes()):ymd;
};
function tidy(rows,nums){   // trim trailing empty cells, drop empty rows, cap columns
 const R=[],N=[];
 rows.forEach((r,i)=>{
  if(!r)return;let c=r.map(clean);while(c.length&&c[c.length-1]==='')c.pop();
  if(!c.length)return;if(c.length>MAX_COLS)c=c.slice(0,MAX_COLS);
  R.push(c);N.push(nums?nums[i]:i+1);
 });
 return{rows:R,nums:N};
}

/* ---------- CSV / TSV ---------- */
function decode(u8){
 if(u8.length>=3&&u8[0]===0xEF&&u8[1]===0xBB&&u8[2]===0xBF)return utf8(u8.subarray(3));
 if(u8.length>=2&&u8[0]===0xFF&&u8[1]===0xFE)return new TextDecoder('utf-16le').decode(u8.subarray(2));
 if(u8.length>=2&&u8[0]===0xFE&&u8[1]===0xFF)return new TextDecoder('utf-16be').decode(u8.subarray(2));
 try{return new TextDecoder('utf-8',{fatal:true}).decode(u8)}
 catch(e){try{return new TextDecoder('windows-1252').decode(u8)}catch(x){return utf8(u8)}}
}
function guessDelim(text){
 const line=(text.split(/\r\n|\n|\r/).find(l=>l.trim())||'');let best=',',n=0;
 [',',';','\t','|'].forEach(d=>{let q=false,c=0;for(const ch of line){if(ch==='"')q=!q;else if(!q&&ch===d)c++}if(c>n){n=c;best=d}});
 return best;
}
function parseCsv(text,delim){
 const rows=[],n=text.length;let row=[],cur='',q=false,i=0;
 while(i<n){
  const c=text[i];
  if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i+=2;continue}q=false;i++;continue}cur+=c;i++;continue}
  if(c==='"'&&cur===''){q=true;i++;continue}
  if(c===delim){row.push(cur);cur='';i++;continue}
  if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cur);cur='';rows.push(row);row=[];i++;if(rows.length>MAX_ROWS+2)return rows;continue}
  cur+=c;i++;
 }
 if(cur!==''||row.length){row.push(cur);rows.push(row)}
 return rows;
}
function readText(u8,name){
 let t=decode(u8),d=null;
 const m=/^sep=(.)\r?\n/i.exec(t);if(m){d=m[1];t=t.slice(m[0].length)}   // Excel's own "sep=;" line
 if(!d)d=/\.tsv$/i.test(name||'')?'\t':guessDelim(t);
 const x=tidy(parseCsv(t,d));
 return{kind:d==='\t'?'tsv':'csv',sheets:[{name:'Sheet 1',rows:x.rows,nums:x.nums}]};
}

/* ---------- ZIP ---------- */
function zipEntries(u8){
 let e=-1;for(let i=u8.length-22;i>=Math.max(0,u8.length-22-65535);i--)if(u32(u8,i)===0x06054b50){e=i;break}
 if(e<0)throw new Error('This file is damaged or is not a spreadsheet (no ZIP directory found).');
 const cnt=u16(u8,e+10),out={};let p=u32(u8,e+16);
 for(let k=0;k<cnt;k++){
  if(p+46>u8.length||u32(u8,p)!==0x02014b50)throw new Error('This file is damaged (bad ZIP directory).');
  const nl=u16(u8,p+28),xl=u16(u8,p+30),cl=u16(u8,p+32);
  out[utf8(u8.subarray(p+46,p+46+nl))]={method:u16(u8,p+10),csz:u32(u8,p+20),usz:u32(u8,p+24),lho:u32(u8,p+42)};
  p+=46+nl+xl+cl;
 }
 return out;
}
async function unzip(u8,ent){
 if(ent.csz===0xFFFFFFFF||ent.usz===0xFFFFFFFF||ent.lho===0xFFFFFFFF)throw new Error('This file is too large to read in the app. Save it as CSV and import that.');
 if(ent.usz>MAX_UNZIP)throw new Error('This file holds too much data. Remove empty rows and columns, or save it as CSV.');
 const p=ent.lho;if(u32(u8,p)!==0x04034b50)throw new Error('This file is damaged (bad ZIP entry).');
 const s=p+30+u16(u8,p+26)+u16(u8,p+28),raw=u8.subarray(s,s+ent.csz);
 if(ent.method===0)return raw;
 if(ent.method!==8)throw new Error('This file uses a compression the app does not support. Save it as CSV and import that.');
 if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot open Excel files. Update the browser, or save the sheet as CSV and import that.');
 const rd=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),parts=[];let total=0;
 for(;;){const r=await rd.read();if(r.done)break;total+=r.value.length;if(total>MAX_UNZIP){try{rd.cancel()}catch(e){}throw new Error('This file holds too much data. Remove empty rows and columns, or save it as CSV.')}parts.push(r.value)}
 const o=new Uint8Array(total);let q=0;parts.forEach(a=>{o.set(a,q);q+=a.length});return o;
}
const xml=t=>{
 const d=new DOMParser().parseFromString(t,'application/xml');
 if(d.getElementsByTagName('parsererror').length)throw new Error('This file is damaged (unreadable XML inside).');
 return d;
};
const kids=(n,name)=>Array.prototype.filter.call(n.childNodes,c=>c.nodeType===1&&(c.localName||c.nodeName)===name);
const all=(n,name)=>Array.prototype.slice.call(n.getElementsByTagName(name));

/* ---------- XLSX ---------- */
const colIdx=r=>{let n=0;const m=/^[A-Za-z]+/.exec(r||'');if(!m)return -1;for(const ch of m[0].toUpperCase())n=n*26+ch.charCodeAt(0)-64;return n-1};
async function readXlsx(u8,z){
 const get=async n=>z[n]?utf8(await unzip(u8,z[n])):null;
 const wb=await get('xl/workbook.xml');if(!wb)throw new Error('No sheets found in this Excel file.');
 const rels={};
 const rx=await get('xl/_rels/workbook.xml.rels');
 if(rx)all(xml(rx),'Relationship').forEach(r=>{let t=r.getAttribute('Target')||'';t=t.startsWith('/')?t.slice(1):'xl/'+t.replace(/^\.\//,'');rels[r.getAttribute('Id')]=t});
 const sst=[],ss=await get('xl/sharedStrings.xml');
 if(ss)all(xml(ss),'si').forEach(si=>sst.push(all(si,'t').filter(t=>t.parentNode.nodeName!=='rPh').map(t=>t.textContent).join('')));
 const fmts={},xfs=[],sx=await get('xl/styles.xml');
 if(sx){const sd=xml(sx);all(sd,'numFmt').forEach(f=>{fmts[f.getAttribute('numFmtId')]=f.getAttribute('formatCode')||''});
  const cx=all(sd,'cellXfs')[0];if(cx)kids(cx,'xf').forEach(x=>xfs.push(+x.getAttribute('numFmtId')||0))}
 const isDate=s=>{const id=xfs[s];if(id==null)return false;
  if((id>=14&&id<=22)||(id>=27&&id<=36)||(id>=45&&id<=47)||(id>=50&&id<=58))return true;
  const c=fmts[id];if(!c)return false;const t=c.replace(/"[^"]*"|\[[^\]]*\]|\\./g,'');return /[ymdhs]/i.test(t)&&!/^general$/i.test(t)};
 const out=[];
 for(const sh of all(xml(wb),'sheet')){
  if(out.length>=MAX_SHEETS)break;
  const st=sh.getAttribute('state');if(st==='hidden'||st==='veryHidden')continue;
  const path=rels[sh.getAttribute('r:id')]||rels[sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')];
  const sd=path&&await get(path);if(!sd)continue;
  const rows=[],nums=[];let seq=0;
  for(const r of all(xml(sd),'row')){
   seq=r.getAttribute('r')?+r.getAttribute('r'):seq+1;if(rows.length>MAX_ROWS+1)break;
   const cells=[];let next=0;
   kids(r,'c').forEach(c=>{
    let ix=colIdx(c.getAttribute('r'));if(ix<0)ix=next;next=ix+1;if(ix>=MAX_COLS)return;
    const t=c.getAttribute('t'),v=kids(c,'v')[0],val=v?v.textContent:'';let s='';
    if(t==='s')s=sst[+val]||'';
    else if(t==='inlineStr')s=all(c,'t').map(x=>x.textContent).join('');
    else if(t==='str'||t==='d')s=val;
    else if(t==='b')s=val==='1'?'TRUE':'FALSE';
    else if(t==='e')s='';
    else if(val!==''){s=isDate(+c.getAttribute('s'))&&isFinite(+val)?serialDate(+val):numStr(val)}
    cells[ix]=s;
   });
   rows.push(Array.from(cells,x=>x==null?'':x));nums.push(seq);
  }
  const x=tidy(rows,nums);out.push({name:sh.getAttribute('name')||'Sheet '+(out.length+1),rows:x.rows,nums:x.nums});
 }
 if(!out.length)throw new Error('No visible sheets found in this Excel file.');
 return{kind:'xlsx',sheets:out};
}

/* ---------- ODS ---------- */
const NS_T='urn:oasis:names:tc:opendocument:xmlns:table:1.0',NS_O='urn:oasis:names:tc:opendocument:xmlns:office:1.0',NS_X='urn:oasis:names:tc:opendocument:xmlns:text:1.0';
function odText(n){
 let s='';
 n.childNodes.forEach(c=>{
  if(c.nodeType===3)s+=c.data;
  else if(c.nodeType===1){const ln=c.localName;
   if(ln==='s')s+=' '.repeat(Math.min(50,+c.getAttributeNS(NS_X,'c')||1));
   else if(ln==='tab')s+='\t';else if(ln==='line-break')s+='\n';else s+=odText(c)}
 });
 return s;
}
async function readOds(u8,z){
 const cx=z['content.xml'];if(!cx)throw new Error('No sheets found in this OpenDocument file.');
 const d=xml(utf8(await unzip(u8,cx))),out=[];
 for(const tb of Array.from(d.getElementsByTagNameNS(NS_T,'table'))){
  if(out.length>=MAX_SHEETS)break;
  const rows=[],nums=[];let rn=0;
  for(const tr of Array.from(tb.getElementsByTagNameNS(NS_T,'table-row'))){
   const rep=Math.max(1,+tr.getAttributeNS(NS_T,'number-rows-repeated')||1),cells=[];
   for(const c of Array.from(tr.childNodes)){
    if(c.nodeType!==1||(c.localName!=='table-cell'&&c.localName!=='covered-table-cell'))continue;
    const cr=Math.max(1,+c.getAttributeNS(NS_T,'number-columns-repeated')||1),vt=c.getAttributeNS(NS_O,'value-type');let s='';
    if(vt==='string'||!vt)s=Array.from(c.getElementsByTagNameNS(NS_X,'p')).map(odText).join('\n');
    else if(vt==='float'||vt==='percentage'||vt==='currency')s=numStr(c.getAttributeNS(NS_O,'value'));
    else if(vt==='date')s=(c.getAttributeNS(NS_O,'date-value')||'').replace(/T00:00:00$/,'').replace('T',' ').slice(0,16);
    else if(vt==='boolean')s=c.getAttributeNS(NS_O,'boolean-value')==='true'?'TRUE':'FALSE';
    else s=Array.from(c.getElementsByTagNameNS(NS_X,'p')).map(odText).join('\n');
    if(s===''&&cr>1){cells.length=Math.min(MAX_COLS,cells.length+cr);continue}   // a long run of empty cells at the end of a row
    for(let k=0;k<Math.min(cr,MAX_COLS-cells.length);k++)cells.push(s);
    if(cells.length>=MAX_COLS)break;
   }
   const filled=Array.from(cells,x=>x==null?'':x),has=filled.some(x=>String(x).trim()!=='');
   if(!has){rn+=rep;continue}   // blank rows (often repeated a million times at the bottom) are skipped, never expanded
   for(let k=0;k<Math.min(rep,200);k++){rows.push(filled);nums.push(++rn)}
   if(rows.length>MAX_ROWS+1)break;
  }
  const x=tidy(rows,nums);out.push({name:tb.getAttributeNS(NS_T,'name')||'Sheet '+(out.length+1),rows:x.rows,nums:x.nums});
 }
 if(!out.length)throw new Error('No sheets found in this OpenDocument file.');
 return{kind:'ods',sheets:out};
}

/* ---------- entry points ---------- */
async function readBytes(u8,name){
 if(!u8.length)throw new Error('This file is empty.');
 if(u8.length>MAX_BYTES)throw new Error('This file is larger than 8 MB. Remove unused rows or save it as CSV.');
 if(u8.length>=8&&u8[0]===0xD0&&u8[1]===0xCF&&u8[2]===0x11&&u8[3]===0xE0)throw new Error(OLD_XLS);
 if(u8.length>=4&&u8[0]===0x50&&u8[1]===0x4B){   // a ZIP: Excel or OpenDocument
  const z=zipEntries(u8);
  if(z['xl/workbook.xml'])return readXlsx(u8,z);
  if(z['content.xml'])return readOds(u8,z);
  throw new Error('This ZIP file is not a spreadsheet. Use .xlsx, .ods or .csv.');
 }
 if(u8.length>=4&&u8[0]===0x25&&u8[1]===0x50&&u8[2]===0x44&&u8[3]===0x46)throw new Error('This is a PDF. Use a spreadsheet file: .xlsx, .ods or .csv.');
 for(let i=0;i<Math.min(u8.length,4096);i++)if(u8[i]===0&&!(u8[0]===0xFF||u8[0]===0xFE))throw new Error('This does not look like a spreadsheet. Use .xlsx, .ods or .csv.');
 return readText(u8,name);
}
async function read(file){
 if(!file)throw new Error('No file chosen.');
 if(file.size>MAX_BYTES)throw new Error('This file is larger than 8 MB. Remove unused rows or save it as CSV.');
 return readBytes(new Uint8Array(await file.arrayBuffer()),file.name);
}
root.CEMSheet={read,readBytes,parseCsv,limits:{rows:MAX_ROWS,cols:MAX_COLS}};
})(typeof window!=='undefined'?window:globalThis);
