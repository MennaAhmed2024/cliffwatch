'use client';

import { useState } from 'react';

export function DiagnosticsDownload(){
  const[pending,setPending]=useState(false),[message,setMessage]=useState('');
  async function download(){
    setPending(true);setMessage('');
    try{
      const response=await fetch('/api/diagnostics',{cache:'no-store'});if(!response.ok)throw new Error();
      const blob=await response.blob(),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='cliffwatch-diagnostics.json';anchor.click();URL.revokeObjectURL(url);setMessage('Diagnostic report downloaded.');
    }catch{setMessage('Could not generate the local diagnostic report.');}
    finally{setPending(false);}
  }
  return<div><button type="button" className="button" onClick={download} disabled={pending}>{pending?'Preparing…':'Download diagnostics'}</button>{message?<p role="status" className="action-message">{message}</p>:null}</div>;
}
