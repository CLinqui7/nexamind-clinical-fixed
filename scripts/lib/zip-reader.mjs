import fs from 'node:fs';
import zlib from 'node:zlib';

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

const crcTable = Array.from({length:256},(_,value)=>{
  let crc=value;
  for(let bit=0;bit<8;bit+=1)crc=(crc&1)?0xedb88320^(crc>>>1):crc>>>1;
  return crc>>>0;
});

export function crc32(buffer){
  let crc=0xffffffff;
  for(const byte of buffer)crc=crcTable[(crc^byte)&0xff]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}

function findEnd(buffer){
  const floor=Math.max(0,buffer.length-0xffff-22);
  for(let offset=buffer.length-22;offset>=floor;offset-=1)if(buffer.readUInt32LE(offset)===EOCD)return offset;
  throw new Error('ZIP_EOCD_NOT_FOUND');
}

function safeName(value){
  const name=value.replaceAll('\\','/');
  if(!name || name.startsWith('/') || /^[a-z]:/i.test(name) || name.split('/').includes('..'))throw new Error('ZIP_UNSAFE_PATH');
  return name;
}

export function readZipEntries(file){
  const archive=fs.readFileSync(file);
  const end=findEnd(archive);
  const entryCount=archive.readUInt16LE(end+10);
  const centralSize=archive.readUInt32LE(end+12);
  const centralOffset=archive.readUInt32LE(end+16);
  if(entryCount===0xffff || centralSize===0xffffffff || centralOffset===0xffffffff)throw new Error('ZIP64_NOT_SUPPORTED');
  if(centralOffset+centralSize>archive.length)throw new Error('ZIP_CENTRAL_DIRECTORY_OUT_OF_RANGE');
  const result=new Map();
  let cursor=centralOffset;
  for(let index=0;index<entryCount;index+=1){
    if(cursor+46>archive.length || archive.readUInt32LE(cursor)!==CENTRAL)throw new Error('ZIP_CENTRAL_ENTRY_INVALID');
    const flags=archive.readUInt16LE(cursor+8),method=archive.readUInt16LE(cursor+10),expectedCrc=archive.readUInt32LE(cursor+16);
    const compressedSize=archive.readUInt32LE(cursor+20),uncompressedSize=archive.readUInt32LE(cursor+24);
    const nameLength=archive.readUInt16LE(cursor+28),extraLength=archive.readUInt16LE(cursor+30),commentLength=archive.readUInt16LE(cursor+32);
    const localOffset=archive.readUInt32LE(cursor+42);
    const name=safeName(archive.subarray(cursor+46,cursor+46+nameLength).toString((flags&0x800)?'utf8':'latin1'));
    cursor+=46+nameLength+extraLength+commentLength;
    if(name.endsWith('/'))continue;
    if(result.has(name.toLowerCase()))throw new Error(`ZIP_DUPLICATE_ENTRY:${name}`);
    if(flags&1)throw new Error(`ZIP_ENCRYPTED_ENTRY:${name}`);
    if(localOffset+30>archive.length || archive.readUInt32LE(localOffset)!==LOCAL)throw new Error(`ZIP_LOCAL_ENTRY_INVALID:${name}`);
    const localNameLength=archive.readUInt16LE(localOffset+26),localExtraLength=archive.readUInt16LE(localOffset+28);
    const dataOffset=localOffset+30+localNameLength+localExtraLength;
    const compressed=archive.subarray(dataOffset,dataOffset+compressedSize);
    let data;
    if(method===0)data=Buffer.from(compressed);
    else if(method===8)data=zlib.inflateRawSync(compressed);
    else throw new Error(`ZIP_COMPRESSION_UNSUPPORTED:${name}:${method}`);
    if(data.length!==uncompressedSize)throw new Error(`ZIP_SIZE_MISMATCH:${name}`);
    if(crc32(data)!==expectedCrc)throw new Error(`ZIP_CRC_MISMATCH:${name}`);
    result.set(name.toLowerCase(),{name,data,crc32:expectedCrc,size:uncompressedSize});
  }
  return result;
}
