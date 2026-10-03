const WINDOWS_1252=new TextDecoder('windows-1252');

function decode(buffer){return WINDOWS_1252.decode(buffer).replace(/\u0000+$/g,'').replaceAll('\u0000','\u2400');}
function parseNumeric(text,decimals){
  const value=text.trim();
  if(!value)return null;
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))return {invalid:value};
  if(decimals===0){const integer=Number(value);return Number.isSafeInteger(integer)?integer:value;}
  return value.replace(/^\+/,'');
}
function parseDate(text){
  const raw=text.trim();
  if(!raw)return null;
  if(!/^\d{8}$/.test(raw))return {invalid:raw};
  const year=Number(raw.slice(0,4)),month=Number(raw.slice(4,6)),day=Number(raw.slice(6,8));
  const date=new Date(Date.UTC(year,month-1,day));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return {invalid:raw};
  return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
}
function parseLogical(text){
  const value=text.trim().toUpperCase();
  if(!value||value==='?')return null;
  if(value==='T'||value==='Y')return true;
  if(value==='F'||value==='N')return false;
  return {invalid:value};
}

export function parseFpt(buffer){
  if(!buffer)return null;
  if(buffer.length<512)throw new Error('FPT_HEADER_TRUNCATED');
  const blockSize=buffer.readUInt16BE(6);
  if(blockSize<32||blockSize>65535)throw new Error('FPT_BLOCK_SIZE_INVALID');
  return pointer=>{
    if(pointer===null||pointer===undefined||pointer==='')return null;
    const block=Number(pointer),offset=block*blockSize;
    if(!Number.isSafeInteger(block)||block<=0||offset+8>buffer.length)throw new Error(`FPT_POINTER_INVALID:${pointer}`);
    const length=buffer.readUInt32BE(offset+4);
    if(length>64*1024*1024||offset+8+length>buffer.length)throw new Error(`FPT_LENGTH_INVALID:${pointer}`);
    return decode(buffer.subarray(offset+8,offset+8+length)).replace(/\u001a+$/g,'');
  };
}

export function parseDbf(buffer,{memoBuffer=null,fileName='source.dbf'}={}){
  if(buffer.length<33)throw new Error(`DBF_HEADER_TRUNCATED:${fileName}`);
  const recordCount=buffer.readUInt32LE(4),headerLength=buffer.readUInt16LE(8),recordLength=buffer.readUInt16LE(10);
  if(headerLength<33||recordLength<2||headerLength>buffer.length)throw new Error(`DBF_HEADER_INVALID:${fileName}`);
  const fields=[];
  for(let offset=32;offset<headerLength-1;offset+=32){
    if(buffer[offset]===0x0d)break;
    const name=buffer.subarray(offset,offset+11).toString('ascii').replace(/\0.*$/,'').trim().toUpperCase();
    const type=String.fromCharCode(buffer[offset+11]),length=buffer[offset+16],decimals=buffer[offset+17];
    if(!name||length<1)throw new Error(`DBF_FIELD_INVALID:${fileName}:${offset}`);
    fields.push({name,type,length,decimals});
  }
  if(1+fields.reduce((sum,field)=>sum+field.length,0)!==recordLength)throw new Error(`DBF_RECORD_LENGTH_MISMATCH:${fileName}`);
  const memo=parseFpt(memoBuffer);
  const rows=[];
  for(let index=0;index<recordCount;index+=1){
    const start=headerLength+index*recordLength;
    if(start+recordLength>buffer.length)throw new Error(`DBF_RECORD_TRUNCATED:${fileName}:${index+1}`);
    if(buffer[start]!==0x20&&buffer[start]!==0x2a)throw new Error(`DBF_DELETION_FLAG_INVALID:${fileName}:${index+1}`);
    const row={__rowNumber:index+1,__deleted:buffer[start]===0x2a};
    let cursor=start+1;
    for(const field of fields){
      const bytes=buffer.subarray(cursor,cursor+field.length),text=decode(bytes);cursor+=field.length;
      if(field.type==='C')row[field.name]=text.trimEnd();
      else if(field.type==='N'||field.type==='F')row[field.name]=parseNumeric(text,field.decimals);
      else if(field.type==='D')row[field.name]=parseDate(text);
      else if(field.type==='L')row[field.name]=parseLogical(text);
      else if(field.type==='M'){
        const pointer=field.length===4?bytes.readUInt32LE(0):parseNumeric(text,0);
        row[field.name]=pointer===null||pointer===0?null:memo?memo(pointer):{invalidMemoPointer:pointer};
      }else row[field.name]={unsupportedType:field.type,raw:text};
    }
    rows.push(row);
  }
  return {fileName,version:buffer[0],recordCount,headerLength,recordLength,fields,rows};
}

export function readFoxProArchive(entries){
  const tables=new Map();
  for(const entry of entries.values()){
    if(!entry.name.toLowerCase().endsWith('.dbf'))continue;
    const base=entry.name.replace(/\.dbf$/i,'');
    const fpt=entries.get(`${base}.fpt`.toLowerCase())?.data||null;
    tables.set(base.split('/').pop().toLowerCase(),parseDbf(entry.data,{memoBuffer:fpt,fileName:entry.name}));
  }
  if(!tables.size)throw new Error('FOXPRO_DBF_NOT_FOUND');
  return tables;
}
