import { existsSync } from 'node:fs';
import { delimiter, extname, isAbsolute, join } from 'node:path';

export function discoverReceiptsCli(env:NodeJS.ProcessEnv=process.env,platform:NodeJS.Platform=process.platform):string|undefined{
  const configured=env.RECEIPTS_CLI_PATH;
  if(configured)return isAbsolute(configured)&&existsSync(configured)?configured:undefined;
  const extensions=platform==='win32'?['.cmd','.exe','.bat','.js']:[''];
  for(const directory of (env.PATH??'').split(delimiter).filter(Boolean)){
    for(const extension of extensions){const candidate=join(directory,`receipts${extension}`);if(existsSync(candidate))return candidate;}
  }
  return undefined;
}

export function receiptsInvocation(cli:string,args:string[],platform:NodeJS.Platform=process.platform,env:NodeJS.ProcessEnv=process.env):{file:string;args:string[];env?:NodeJS.ProcessEnv}|undefined{
  const extension=extname(cli).toLowerCase();
  if(extension==='.js')return{file:process.execPath,args:[cli,...args]};
  if(platform==='win32'&&(extension==='.cmd'||extension==='.bat')){
    const script='$items=ConvertFrom-Json $env:CLIFFWATCH_RECEIPTS_ARGS; & $env:CLIFFWATCH_RECEIPTS_CLI @items; exit $LASTEXITCODE';
    return{file:'powershell.exe',args:['-NoProfile','-NonInteractive','-Command',script],env:{...env,CLIFFWATCH_RECEIPTS_CLI:cli,CLIFFWATCH_RECEIPTS_ARGS:JSON.stringify(args)}};
  }
  return isAbsolute(cli)?{file:cli,args}:undefined;
}
