import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, Building2, UserCheck, Smartphone, CircleCheck, CircleAlert,
  Clock3, BellRing, BadgeCheck, Siren, WalletCards, Copy, ExternalLink,
  RefreshCw, ArrowRight, Info, Activity, LockKeyhole
} from 'lucide-react';
import {
  ARBITRUM_SEPOLIA, connectWallet, getWalletSnapshot, shortAddress,
  signHolderDecision, signIdentityVerification, switchToArbitrumSepolia
} from './services/wallet';

const initialRequests = [
  { id:'SIMI-2026-00021', line:'•••• ••• 4821', date:'12 Ago 2026 · 18:31', channel:'Agencia San Isidro', identity:true, consent:'pending', status:'AWAITING_HOLDER', alert:'WhatsApp · simulada', tx:null },
  { id:'SIMI-2026-00018', line:'•••• ••• 1744', date:'12 Ago 2026 · 16:08', channel:'Canal digital', identity:true, consent:'yes', status:'AUTHORIZED', alert:'SMS · simulada', tx:'0x81f0…29ab' },
  { id:'SIMI-2026-00016', line:'•••• ••• 9310', date:'12 Ago 2026 · 14:20', channel:'Agencia Centro', identity:true, consent:'no', status:'DISPUTED', alert:'WhatsApp · simulada', tx:'0x44bc…a981' },
];

const statusMeta = {
  PENDING:['Pendiente','neutral'], AWAITING_HOLDER:['Esperando titular','warning'],
  AUTHORIZED:['Autorizada','success'], DISPUTED:['Disputada','danger'],
  IDENTITY_VERIFIED:['Identidad validada','info']
};

function Badge({status}) { const [label,tone]=statusMeta[status]||[status,'neutral']; return <span className={`badge ${tone}`}>{label}</span>; }
function Brand(){ return <div className="brand"><img src="/assets/simi/logo/simi-isotipo.png" alt="SIMI"/><div><strong>SIMI</strong><span>Protección de tu línea</span></div></div>; }

function WalletPanel({wallet,setWallet,notify}) {
  const busyText = wallet?.chainId && wallet.chainId !== ARBITRUM_SEPOLIA.chainId ? 'Cambiar a Arbitrum Sepolia' : 'Verificar identidad digital';
  const connect = async()=>{
    try { setWallet({...wallet,busy:true}); const snap = await connectWallet(); setWallet({...snap,busy:false}); notify('Identidad digital conectada'); }
    catch(e){ setWallet(w=>({...w,busy:false})); notify(e?.message==='METAMASK_NOT_FOUND'?'Instala MetaMask para continuar':'No pudimos conectar la identidad digital'); }
  };
  const changeNetwork = async()=>{
    try { await switchToArbitrumSepolia(); setWallet(await getWalletSnapshot()); notify('Red correcta seleccionada'); } catch { notify('No pudimos cambiar de red'); }
  };
  if(!wallet.installed) return <div className="wallet-card warning-card"><WalletCards/><div><strong>MetaMask no detectado</strong><span>Instala la extensión para firmar las validaciones del demo.</span></div></div>;
  if(!wallet.connected) return <button className="identity-button" onClick={connect} disabled={wallet.busy}><WalletCards/>{wallet.busy?'Conectando...':busyText}</button>;
  const wrong = wallet.chainId !== ARBITRUM_SEPOLIA.chainId;
  return <div className={`wallet-card ${wrong?'warning-card':''}`}>
    <div className="wallet-status"><span className={`status-dot ${wrong?'bad':''}`}></span><div><strong>{wrong?'Red incorrecta':'Identidad digital lista'}</strong><span>{shortAddress(wallet.account)} · {wallet.balance} ETH</span></div></div>
    <div className="wallet-actions">
      {wrong && <button onClick={changeNetwork}>Cambiar red</button>}
      <button onClick={()=>navigator.clipboard?.writeText(wallet.account)} title="Copiar dirección"><Copy size={15}/></button>
      <a href={`https://sepolia.arbiscan.io/address/${wallet.account}`} target="_blank" rel="noreferrer" title="Ver en Arbiscan"><ExternalLink size={15}/></a>
    </div>
  </div>;
}

export default function App(){
  const [role,setRole]=useState('operator');
  const [requests,setRequests]=useState(initialRequests);
  const [selectedId,setSelectedId]=useState(initialRequests[0].id);
  const [toast,setToast]=useState('');
  const [wallet,setWallet]=useState({installed:true,connected:false,account:'',chainId:0,balance:'0'});
  const selected=useMemo(()=>requests.find(r=>r.id===selectedId)||requests[0],[requests,selectedId]);
  const notify=(m)=>{setToast(m);setTimeout(()=>setToast(''),2600)};
  const patchSelected=(patch)=>setRequests(items=>items.map(r=>r.id===selectedId?{...r,...patch}:r));

  useEffect(()=>{
    getWalletSnapshot().then(setWallet).catch(()=>setWallet({installed:Boolean(window.ethereum),connected:false,account:'',chainId:0,balance:'0'}));
    if(!window.ethereum) return;
    const refresh=()=>getWalletSnapshot().then(setWallet).catch(()=>{});
    window.ethereum.on?.('accountsChanged',refresh); window.ethereum.on?.('chainChanged',refresh);
    return ()=>{window.ethereum.removeListener?.('accountsChanged',refresh);window.ethereum.removeListener?.('chainChanged',refresh)};
  },[]);

  const createDemo=()=>{
    const id=`SIMI-2026-000${requests.length+22}`;
    const item={id,line:'•••• ••• 6084',date:'Ahora',channel:'Agencia Miraflores',identity:false,consent:'pending',status:'PENDING',alert:'Pendiente',tx:null};
    setRequests([item,...requests]);setSelectedId(id);notify('Solicitud creada. Siguiente paso: validar identidad.');
  };

  const validateIdentity=async()=>{
    if(!wallet.connected){notify('Primero verifica tu identidad digital');return;}
    try{
      const evidence=await signIdentityVerification(selected);
      patchSelected({identity:true,status:'AWAITING_HOLDER',alert:'WhatsApp · simulada',verifierSignature:evidence.signature});
      notify('Identidad validada. No se gastó gas: fue una firma off-chain.');
    }catch{notify('La firma fue cancelada o no pudo completarse');}
  };

  const holderDecision=async(decision)=>{
    if(!wallet.connected){notify('Primero verifica tu identidad digital');return;}
    try{
      const action=decision==='yes'?'AUTHORIZE':'DISPUTE';
      const evidence=await signHolderDecision(selected,action);
      if(decision==='yes') patchSelected({consent:'yes',status:'AUTHORIZED',tx:'Pendiente de consolidación on-chain',holderSignature:evidence.signature});
      else patchSelected({consent:'no',status:'DISPUTED',tx:'Disputa firmada · pendiente de registro',holderSignature:evidence.signature});
      notify(decision==='yes'?'Autorización firmada de forma segura':'Solicitud bloqueada y reportada');
    }catch{notify('La firma fue cancelada o no pudo completarse');}
  };

  const counts={active:requests.filter(r=>['PENDING','AWAITING_HOLDER'].includes(r.status)).length,authorized:requests.filter(r=>r.status==='AUTHORIZED').length,disputed:requests.filter(r=>r.status==='DISPUTED').length};

  return <div className="app-shell">
    {toast&&<div className="toast"><CircleCheck size={18}/>{toast}</div>}
    <header className="topbar">
      <Brand/>
      <nav className="role-switch" aria-label="Cambiar rol">
        <button className={role==='operator'?'active':''} onClick={()=>setRole('operator')}><Building2 size={17}/>Operadora</button>
        <button className={role==='verifier'?'active':''} onClick={()=>setRole('verifier')}><UserCheck size={17}/>Verificador</button>
        <button className={role==='holder'?'active':''} onClick={()=>setRole('holder')}><Smartphone size={17}/>Titular</button>
      </nav>
      <WalletPanel wallet={wallet} setWallet={setWallet} notify={notify}/>
    </header>

    {role==='operator'&&<OperatorView requests={requests} selected={selected} setSelectedId={setSelectedId} counts={counts} createDemo={createDemo}/>} 
    {role==='verifier'&&<VerifierView request={selected} requests={requests} setSelectedId={setSelectedId} validateIdentity={validateIdentity} wallet={wallet}/>} 
    {role==='holder'&&<HolderView request={selected} requests={requests} setSelectedId={setSelectedId} holderDecision={holderDecision} wallet={wallet}/>} 
  </div>;
}

function StepGuide({step,title,text}){return <div className="step-guide"><div className="step-num">{step}</div><div><strong>{title}</strong><span>{text}</span></div></div>}

function OperatorView({requests,selected,setSelectedId,counts,createDemo}){
  return <main className="page">
    <section className="welcome-grid">
      <div className="hero-card"><span className="eyebrow"><ShieldCheck size={16}/> Centro de protección SIM</span><h1>Una reposición segura, paso a paso.</h1><p>La operadora mantiene su proceso habitual. SIMI agrega consentimiento del titular y evidencia verificable en los momentos críticos.</p><button className="primary big" onClick={createDemo}>Crear nueva solicitud demo <ArrowRight size={18}/></button></div>
      <div className="guide-card"><h3>¿Qué hago ahora?</h3><StepGuide step="1" title="Crea la solicitud" text="Registra el trámite de reposición."/><StepGuide step="2" title="Valida identidad" text="El verificador firma el resultado."/><StepGuide step="3" title="Espera al titular" text="El usuario confirma o bloquea."/></div>
    </section>

    <section className="simple-kpis"><div><Activity/><span>Activas</span><strong>{counts.active}</strong></div><div><BadgeCheck/><span>Autorizadas</span><strong>{counts.authorized}</strong></div><div className="risk"><Siren/><span>Disputadas</span><strong>{counts.disputed}</strong></div></section>

    <section className="workbench">
      <div className="panel request-list"><div className="panel-head"><div><h2>Solicitudes</h2><p>Selecciona una para continuar.</p></div></div>{requests.map(r=><button key={r.id} className={`request-row ${selected.id===r.id?'selected':''}`} onClick={()=>setSelectedId(r.id)}><div><strong>{r.id}</strong><span>{r.line} · {r.date}</span></div><Badge status={r.status}/></button>)}</div>
      <RequestDetail request={selected}/>
    </section>
  </main>
}

function RequestDetail({request}){
  const steps=[['Solicitud creada',true],['Identidad validada',request.identity],['Alerta enviada',request.alert!=='Pendiente'],['Respuesta del titular',request.consent!=='pending'],['Registro verificable',Boolean(request.tx)]];
  return <aside className="panel detail-panel"><div className="detail-top"><div><small>Solicitud seleccionada</small><h2>{request.id}</h2></div><Badge status={request.status}/></div>
    {request.status==='DISPUTED'&&<div className="risk-banner"><Siren/><div><strong>ALTO RIESGO</strong><span>El titular no reconoce la solicitud. No debe autorizarse.</span></div></div>}
    <div className="meta-grid"><div><span>Línea protegida</span><strong>{request.line}</strong></div><div><span>Canal</span><strong>{request.channel}</strong></div><div><span>Notificación</span><strong>{request.alert}</strong></div><div><span>Privacidad</span><strong>Datos personales fuera de blockchain</strong></div></div>
    <div className="timeline">{steps.map(([label,done],i)=><div className={`timeline-item ${done?'done':''}`} key={label}><div className="node">{done?'✓':i+1}</div><span>{label}</span></div>)}</div>
    <details className="audit"><summary><LockKeyhole size={16}/> Información técnica</summary><div><span>Red objetivo</span><strong>Arbitrum Sepolia</strong><span>Evidencia</span><strong>{request.tx||'Aún no registrada'}</strong></div></details>
  </aside>
}

function VerifierView({request,requests,setSelectedId,validateIdentity,wallet}){
  const pending=requests.filter(r=>!r.identity);
  return <main className="page narrow"><section className="role-hero"><div className="role-icon"><UserCheck/></div><div><span className="eyebrow">Paso 2 de 3</span><h1>Validar identidad</h1><p>Solo registra el resultado cuando la validación externa ya terminó.</p></div></section>
    <div className="flow-hint"><Info/><span>La firma de esta validación es <strong>off-chain</strong>: MetaMask confirma quién firma, pero no gasta gas.</span></div>
    <section className="panel selection-panel"><h2>Elige una solicitud</h2>{(pending.length?pending:[request]).map(r=><button key={r.id} className={`request-row ${r.id===request.id?'selected':''}`} onClick={()=>setSelectedId(r.id)}><div><strong>{r.id}</strong><span>{r.line} · {r.channel}</span></div><Badge status={r.identity?'IDENTITY_VERIFIED':'PENDING'}/></button>)}</section>
    <section className="panel action-panel"><div><span className="eyebrow">Solicitud seleccionada</span><h2>{request.id}</h2><p>{request.identity?'La identidad ya fue validada. Puedes pasar al titular.':'Confirma la evidencia usando tu identidad digital.'}</p></div><button className="primary big" disabled={request.identity||!wallet.connected} onClick={validateIdentity}>{request.identity?'Identidad validada':wallet.connected?'Firmar validación':'Conecta tu identidad digital'}</button></section>
  </main>
}

function HolderView({request,requests,setSelectedId,holderDecision,wallet}){
  const active=requests.find(r=>r.status==='AWAITING_HOLDER')||request;
  useEffect(()=>{if(active.id!==request.id)setSelectedId(active.id)},[active.id,request.id,setSelectedId]);
  const finished=['AUTHORIZED','DISPUTED'].includes(request.status);
  return <main className="holder-page"><section className="holder-card">
    <div className="holder-brand"><img src="/assets/simi/mascot/simi-welcome.png" alt="SIMI"/><div><span className="eyebrow"><ShieldCheck size={16}/> Tu línea está protegida</span><h1>{finished?(request.status==='AUTHORIZED'?'Solicitud confirmada':'Solicitud bloqueada'):'¿Pediste una nueva SIM?'}</h1></div></div>
    {!finished?<><p className="holder-lead">Detectamos una solicitud de reposición. Solo necesitamos que respondas una pregunta.</p><div className="holder-info"><div><span>Cuándo</span><strong>{request.date}</strong></div><div><span>Dónde</span><strong>{request.channel}</strong></div><div><span>Línea</span><strong>{request.line}</strong></div></div><div className="question"><h2>¿Reconoces esta solicitud?</h2><p>Si tú la pediste, confírmala. Si no, bloquéala de inmediato.</p></div><div className="holder-actions"><button className="confirm" disabled={!wallet.connected} onClick={()=>holderDecision('yes')}><CircleCheck/> Sí, fui yo</button><button className="reject" disabled={!wallet.connected} onClick={()=>holderDecision('no')}><CircleAlert/> No fui yo</button></div>{!wallet.connected&&<div className="flow-hint"><WalletCards/><span>Primero usa <strong>“Verificar identidad digital”</strong> arriba. Es la forma de demostrar que la respuesta viene del titular.</span></div>}</>:<div className={`result ${request.status==='DISPUTED'?'blocked':''}`}><img src={request.status==='AUTHORIZED'?'/assets/simi/states/simi-authorized.png':'/assets/simi/states/simi-blocked.png'} alt="Estado SIMI"/><div>{request.status==='AUTHORIZED'?<><CircleCheck/><h2>Listo. Tu autorización quedó firmada.</h2><p>SIMI puede consolidar esta evidencia para el registro final en Arbitrum.</p></>:<><Siren/><h2>Bloqueamos la solicitud.</h2><p>La operadora queda alertada de que no reconoces esta operación.</p></>}</div></div>}
    <div className="holder-help"><Info/><span><strong>¿Qué es SIMI?</strong> Una capa de seguridad que ayuda a proteger tu línea cuando alguien solicita reemplazar tu SIM.</span></div>
  </section></main>
}
