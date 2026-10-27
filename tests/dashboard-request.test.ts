import { describe, expect, it } from 'vitest';
import { isLocalSameOrigin, parseReceiptsAction, readLocalJson } from '../apps/dashboard/src/lib/request.js';

function request(host: string, origin?: string) {
  return new Request('http://127.0.0.1:3000/api/test-alert', { method: 'POST', headers: { host, ...(origin ? { origin } : {}) } });
}

describe('dashboard test-alert origin guard', () => {
  it('accepts the local page origin only', () => {
    expect(isLocalSameOrigin(request('127.0.0.1:3000', 'http://127.0.0.1:3000'))).toBe(true);
    expect(isLocalSameOrigin(request('127.0.0.1:3000', 'http://evil.example'))).toBe(false);
    expect(isLocalSameOrigin(request('evil.example', 'http://evil.example'))).toBe(false);
    expect(isLocalSameOrigin(request('127.0.0.1:3000'))).toBe(false);
  });
});
describe('bounded local JSON requests',()=>{
  const post=(body:string,headers:Record<string,string>={})=>new Request('http://127.0.0.1:3000/api/receipts',{method:'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','content-type':'application/json',...headers},body});
  it('accepts valid local JSON',async()=>expect(await readLocalJson(post('{"action":"scan"}'))).toMatchObject({ok:true,value:{action:'scan'}}));
  it('rejects cross-origin, invalid content type, malformed and oversized bodies',async()=>{expect(await readLocalJson(post('{}',{origin:'http://evil.example'}))).toMatchObject({ok:false,status:403});expect(await readLocalJson(post('{}',{'content-type':'text/plain'}))).toMatchObject({ok:false,status:415});expect(await readLocalJson(post('{'))).toMatchObject({ok:false,status:400});expect(await readLocalJson(post('"'+ 'x'.repeat(9000)+'"'))).toMatchObject({ok:false,status:413});});
  it('accepts only strict scan and dismiss actions',()=>{expect(parseReceiptsAction({action:'scan'})).toEqual({action:'scan'});expect(parseReceiptsAction({action:'dismiss',eventId:'rework:0123456789abcdef'})).toEqual({action:'dismiss',eventId:'rework:0123456789abcdef'});expect(parseReceiptsAction({action:'dismiss',eventId:'../../bad'})).toBeUndefined();expect(parseReceiptsAction({action:'scan',extra:true})).toBeUndefined();});
});
