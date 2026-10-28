import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { win32 } from 'node:path';

const exec=promisify(execFile);
const taskName='CliffWatch';
type Runner=(file:string,args:string[])=>Promise<{stdout?:string;stderr?:string}>;
export type ServiceCommand='install-service'|'start-service'|'stop-service'|'service-status';

function quotedPath(path:string):string{
  if(!path||/["\r\n]/.test(path))throw new Error('Service executable and config paths must not contain quotes or newlines.');
  return `"${path}"`;
}

export function serviceTaskCommand(nodePath:string,cliPath:string,configPath?:string):string{
  const command=`${quotedPath(win32.resolve(nodePath))} ${quotedPath(win32.resolve(cliPath))} daemon${configPath?` --config ${quotedPath(win32.resolve(configPath))}`:''}`;
  if(command.length>260)throw new Error('Service command is too long for Windows Task Scheduler; use shorter installation/config paths.');
  return command;
}

const defaultRunner:Runner=async(file,args)=>exec(file,args,{windowsHide:true,maxBuffer:1024*1024});
export async function runServiceCommand(command:ServiceCommand,cliPath:string,configPath?:string,runner:Runner=defaultRunner,platform:NodeJS.Platform=process.platform,nodePath=process.execPath):Promise<string>{
  if(platform!=='win32')throw new Error('Daemon service lifecycle is currently supported on Windows only. Run cliffwatch daemon under your OS service manager.');
  try{
    if(command==='install-service'){
      const taskCommand=serviceTaskCommand(nodePath,cliPath,configPath);
      await runner('schtasks.exe',['/Create','/TN',taskName,'/SC','ONLOGON','/RL','LIMITED','/TR',taskCommand,'/F']);
      return 'CliffWatch user service installed. Run cliffwatch start-service to start it now.';
    }
    if(command==='start-service'){
      await runner('schtasks.exe',['/Run','/TN',taskName]);
      return 'CliffWatch user service start requested.';
    }
    if(command==='stop-service'){
      await runner('schtasks.exe',['/End','/TN',taskName]);
      return 'CliffWatch user service stop requested.';
    }
    const result=await runner('schtasks.exe',['/Query','/TN',taskName,'/FO','LIST']);
    return `CliffWatch user service is installed.\n${(result.stdout??'').trim()}`.trim();
  }catch{
    if(command==='service-status')throw new Error('CliffWatch user service is not installed or Task Scheduler is unavailable.');
    throw new Error(`Cannot ${command.replace('-service','')} CliffWatch user service; Task Scheduler rejected the request.`);
  }
}
