export function isLocalSameOrigin(request: Request): boolean {
  const host = request.headers.get('host');
  const origin = request.headers.get('origin');
  if (!host || !/^127\.0\.0\.1:[0-9]{1,5}$/.test(host) || !origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && url.host === host && url.pathname === '/' && !url.search && !url.hash;
  } catch { return false; }
}

export type LocalJsonResult={ok:true;value:unknown}|{ok:false;status:400|403|413|415;message:string};
export async function readLocalJson(request:Request,maxBytes=8192):Promise<LocalJsonResult>{
  if(request.method!=='POST'||!isLocalSameOrigin(request))return{ok:false,status:403,message:'Local same-origin request required.'};
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return{ok:false,status:415,message:'Content-Type must be application/json.'};
  const declared=Number(request.headers.get('content-length'));if(Number.isFinite(declared)&&declared>maxBytes)return{ok:false,status:413,message:'Request is too large.'};
  const text=await request.text();if(Buffer.byteLength(text,'utf8')>maxBytes)return{ok:false,status:413,message:'Request is too large.'};
  try{return{ok:true,value:JSON.parse(text)};}catch{return{ok:false,status:400,message:'Invalid JSON body.'};}
}
export type ReceiptsAction={action:'scan'}|{action:'dismiss';eventId:string};
export function parseReceiptsAction(value:unknown):ReceiptsAction|undefined{
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
  const input=value as Record<string,unknown>,keys=Object.keys(input);
  if(input.action==='scan'&&input.eventId===undefined&&keys.every(key=>key==='action'))return{action:'scan'};
  if(input.action==='dismiss'&&typeof input.eventId==='string'&&/^rework:[a-f0-9]{16}$/.test(input.eventId)&&keys.every(key=>key==='action'||key==='eventId'))return{action:'dismiss',eventId:input.eventId};
}
export type AlertAction={action:'acknowledge';alertId:number}|{action:'snooze';alertId:number;minutes:15|60|240};
export function parseAlertAction(value:unknown):AlertAction|undefined{
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
  const input=value as Record<string,unknown>,keys=Object.keys(input),alertId=input.alertId;
  if(!Number.isSafeInteger(alertId)||Number(alertId)<=0)return undefined;
  if(input.action==='acknowledge'&&input.minutes===undefined&&keys.every(key=>key==='action'||key==='alertId'))return{action:'acknowledge',alertId:Number(alertId)};
  if(input.action==='snooze'&&(input.minutes===15||input.minutes===60||input.minutes===240)&&keys.every(key=>key==='action'||key==='alertId'||key==='minutes'))return{action:'snooze',alertId:Number(alertId),minutes:input.minutes};
}
