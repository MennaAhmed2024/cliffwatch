'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AlertActions({alertId}:{alertId:number}){
  const[pending,setPending]=useState(false),router=useRouter();
  async function act(action:'acknowledge'|'snooze'){
    setPending(true);try{const response=await fetch('/api/alerts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action==='acknowledge'?{action,alertId}:{action,alertId,minutes:60})});if(response.ok)router.refresh();}finally{setPending(false);}
  }
  return <span className="alert-actions"><button type="button" disabled={pending} onClick={()=>act('snooze')}>Snooze 1h</button><button type="button" disabled={pending} onClick={()=>act('acknowledge')}>Acknowledge</button></span>;
}
