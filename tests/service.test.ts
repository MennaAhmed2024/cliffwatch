import { describe,expect,it } from 'vitest';
import { runServiceCommand,serviceTaskCommand } from '../packages/cli/src/service.js';

describe('Windows user service lifecycle',()=>{
  it('builds a quoted daemon command without elevating privileges',()=>{
    const command=serviceTaskCommand('C:\\Program Files\\nodejs\\node.exe','C:\\Users\\Me\\CliffWatch\\cli.js','C:\\Users\\Me\\My Config\\config.yaml');
    expect(command).toBe('"C:\\Program Files\\nodejs\\node.exe" "C:\\Users\\Me\\CliffWatch\\cli.js" daemon --config "C:\\Users\\Me\\My Config\\config.yaml"');
    expect(command).not.toMatch(/admin|highest/i);
  });
  it('rejects command injection characters that can break quoting',()=>{
    expect(()=>serviceTaskCommand('C:\\node.exe','C:\\bad" & calc.exe','C:\\config.yaml')).toThrow('quotes or newlines');
  });
  it('registers a limited current-user ONLOGON task and exposes lifecycle actions',async()=>{
    const calls:{file:string;args:string[]}[]=[];
    const runner=async(file:string,args:string[])=>{calls.push({file,args});return{stdout:'Status: Ready'}};
    expect(await runServiceCommand('install-service','C:\\CliffWatch\\cli.js',undefined,runner,'win32','C:\\node.exe')).toContain('installed');
    await runServiceCommand('start-service','C:\\CliffWatch\\cli.js',undefined,runner,'win32');
    await runServiceCommand('stop-service','C:\\CliffWatch\\cli.js',undefined,runner,'win32');
    expect(await runServiceCommand('service-status','C:\\CliffWatch\\cli.js',undefined,runner,'win32')).toContain('Status: Ready');
    expect(calls[0]).toMatchObject({file:'schtasks.exe',args:expect.arrayContaining(['/SC','ONLOGON','/RL','LIMITED'])});
    expect(calls.map(call=>call.args[0])).toEqual(['/Create','/Run','/End','/Query']);
  });
  it('fails clearly on unsupported operating systems',async()=>{
    await expect(runServiceCommand('service-status','/tmp/cli.js',undefined,async()=>({}),'linux')).rejects.toThrow('Windows only');
  });
});
