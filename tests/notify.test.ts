import { it, expect } from 'vitest';
import { parseConfig } from '../packages/cli/src/config.js';
import { sendMessage } from '../packages/cli/src/core/notify.js';
it('Telegram requires ok:true, even for HTTP 200', async () => {
  const c = parseConfig('channels:\n  - type: telegram\n    botTokenEnv: TOKEN\n    chatIdEnv: CHAT');
  const channel = c.channels[0]!;
  const env = {TOKEN:'123:AbCd',CHAT:'-123'};
  await expect(sendMessage(channel,'test','test',1000,env,async()=>new Response(JSON.stringify({ok:false})))).rejects.toThrow('Telegram notification failed');
  await expect(sendMessage(channel,'test','test',1000,env,async()=>new Response(JSON.stringify({ok:true})))).resolves.toBeUndefined();
});
it('Discord forbids mass mentions and uses one POST', async () => {
  const c = parseConfig('channels:\n  - type: discord\n    urlEnv: DISCORD_URL');
  let body = '';
  await sendMessage(c.channels[0]!,'@everyone quota test','threshold',1000,{DISCORD_URL:'https://example.test/hook'},async (_url,init) => { body=String(init?.body); return new Response(null,{status:204}); });
  expect(JSON.parse(body)).toMatchObject({content:'@everyone quota test',allowed_mentions:{parse:[]}});
});
it('ntfy sends plain text to the configured topic', async () => {
  const c = parseConfig('channels:\n  - type: ntfy\n    urlEnv: NTFY_URL');
  let contentType = '';
  await sendMessage(c.channels[0]!,'CliffWatch alert','threshold',1000,{NTFY_URL:'https://ntfy.sh/cliffwatch-test'},async (_url,init) => { contentType=String((init?.headers as Record<string,string>)['Content-Type']); return new Response(null,{status:200}); });
  expect(contentType).toContain('text/plain');
});
