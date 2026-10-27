import { describe,expect,it } from 'vitest';
import { mkdtemp,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter,join } from 'node:path';
import { discoverReceiptsCli,receiptsInvocation } from '../apps/dashboard/src/lib/receipts-command.js';

describe('Receipts CLI discovery',()=>{
  it('requires an existing absolute configured path',()=>{expect(discoverReceiptsCli({RECEIPTS_CLI_PATH:'relative.js'},'win32')).toBeUndefined();expect(discoverReceiptsCli({RECEIPTS_CLI_PATH:'Z:\\missing\\receipts.js'},'win32')).toBeUndefined();});
  it('discovers a Windows command from PATH without a machine-specific fallback',async()=>{const directory=await mkdtemp(join(tmpdir(),'receipts-path-'));try{const command=join(directory,'receipts.cmd');await writeFile(command,'@echo off');expect(discoverReceiptsCli({PATH:[directory,'Z:\\missing'].join(delimiter)},'win32')).toBe(command);}finally{await rm(directory,{recursive:true,force:true});}});
  it('passes script arguments as data rather than PowerShell source',()=>{const invocation=receiptsInvocation('C:\\Tools\\receipts.cmd',['scan','--repo','C:\\Repo & echo unsafe'],'win32',{});expect(invocation?.file).toBe('powershell.exe');expect(invocation?.args.join(' ')).not.toContain('Repo & echo');expect(JSON.parse(invocation?.env?.CLIFFWATCH_RECEIPTS_ARGS??'[]')).toContain('C:\\Repo & echo unsafe');});
});
