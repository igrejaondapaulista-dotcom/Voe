import {exportRows,type ExportData,type ExportOptions,type ExportKind} from './exportModel';
// Exportador de tabelas OOXML para o navegador, sem dependências ou fórmulas.
const encoder=new TextEncoder();
const xml=(value:unknown)=>String(value??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
function column(index:number):string{let value=index+1,result='';while(value){value--;result=String.fromCharCode(65+value%26)+result;value=Math.floor(value/26)}return result}
function crc32(bytes:Uint8Array):number{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
function zip(files:{name:string;text:string}[]):ArrayBuffer{
 const parts:Uint8Array[]=[],directory:Uint8Array[]=[];let offset=0;
 for(const file of files){const name=encoder.encode(file.name),data=encoder.encode(file.text),crc=crc32(data);
  const local=new Uint8Array(30+name.length),header=new DataView(local.buffer);header.setUint32(0,0x04034b50,true);header.setUint16(4,20,true);header.setUint16(6,0x0800,true);header.setUint16(12,33,true);header.setUint32(14,crc,true);header.setUint32(18,data.length,true);header.setUint32(22,data.length,true);header.setUint16(26,name.length,true);local.set(name,30);
  const central=new Uint8Array(46+name.length),entry=new DataView(central.buffer);entry.setUint32(0,0x02014b50,true);entry.setUint16(4,20,true);entry.setUint16(6,20,true);entry.setUint16(8,0x0800,true);entry.setUint16(14,33,true);entry.setUint32(16,crc,true);entry.setUint32(20,data.length,true);entry.setUint32(24,data.length,true);entry.setUint16(28,name.length,true);entry.setUint32(42,offset,true);central.set(name,46);
  parts.push(local,data);directory.push(central);offset+=local.length+data.length;
 }
 const directoryLength=directory.reduce((n,p)=>n+p.length,0),end=new Uint8Array(22),footer=new DataView(end.buffer);footer.setUint32(0,0x06054b50,true);footer.setUint16(8,files.length,true);footer.setUint16(10,files.length,true);footer.setUint32(12,directoryLength,true);footer.setUint32(16,offset,true);
 const output=new Uint8Array(offset+directoryLength+22);let position=0;for(const part of [...parts,...directory,end]){output.set(part,position);position+=part.length}return output.buffer;
}
const tabNames:Record<ExportKind,string>={visitors:'Visitantes',visits:'Visitas',schedule:'Escala',availability:'Disponibilidade',volunteers:'Voluntários'};
export function allSheets(data:ExportData,options:ExportOptions){return (Object.keys(tabNames) as ExportKind[]).map(kind=>({name:tabNames[kind],rows:exportRows(data,kind,options)}))}
function sheetXml(rows:unknown[][]):string{
 const width=(index:number)=>{const label=String(rows[0][index]);return /Observação|Resposta/.test(label)?48:/Nome|por|Situação|Acompanhamento/.test(label)?28:/ID/.test(label)?38:/Data|em|visita/.test(label)?24:20};
 const range=`A1:${column(rows[0].length-1)}${rows.length}`;
 const cells=rows.map((row,r)=>{
  const height=r===0?36:Math.min(409,Math.max(24,...row.map((value,i)=>Math.ceil(String(value??'').length/width(i)+String(value??'').split('\n').length-1)*15+8)));
  return `<row r="${r+1}" ht="${height}" customHeight="1">`+row.map((value,c)=>{
   const ref=column(c)+(r+1),label=String(rows[0][c]);
   if(r>0&&typeof value==='number'&&Number.isFinite(value))return `<c r="${ref}" s="1"><v>${value}</v></c>`;
   if(r>0&&typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}.*Z)?$/.test(value)&&/Data| em$|Prazo|visita/.test(label)){
    const timestamp=Date.parse(value);if(Number.isFinite(timestamp))return `<c r="${ref}" s="${value.includes('T')?3:2}"><v>${timestamp/86400000+25569}</v></c>`;
   }
   const text=r===0&&/ em$/.test(label)?label+' (UTC)':value;
   return `<c r="${ref}" s="${r===0?0:1}" t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
  }).join('')+'</row>';
 }).join('');
 return declaration+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${range}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${rows[0].map((_,i)=>`<col min="${i+1}" max="${i+1}" width="${width(i)}" customWidth="1"/>`).join('')}</cols><sheetData>${cells}</sheetData><autoFilter ref="${range}"/></worksheet>`;
}
export function xlsxAll(data:ExportData,options:ExportOptions):ArrayBuffer{
 const sheets=allSheets(data,options),files:{name:string;text:string}[]=[];
 files.push({name:'[Content_Types].xml',text:declaration+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`});
 files.push({name:'_rels/.rels',text:declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'});
 files.push({name:'xl/workbook.xml',text:declaration+`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map((sheet,i)=>`<sheet name="${xml(sheet.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`});
 files.push({name:'xl/_rels/workbook.xml.rels',text:declaration+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`});
 files.push({name:'xl/styles.xml',text:declaration+'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF7042A4"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'});
 sheets.forEach((sheet,i)=>files.push({name:`xl/worksheets/sheet${i+1}.xml`,text:sheetXml(sheet.rows)}));return zip(files);
}
