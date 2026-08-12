import React, { useMemo, useState } from 'react';
import {
  ShieldCheck, Building2, UserCheck, Smartphone, BellRing, CircleCheck,
  CircleAlert, Clock3, Search, ChevronRight, LockKeyhole, Activity,
  Gauge, BadgeCheck, Siren, Info, WalletCards
} from 'lucide-react';

const initialRequests = [
  {
    id: 'SIMI-2026-00021', line: '•••• ••• 4821', date: '12 Ago 2026 · 18:31',
    channel: 'Agencia San Isidro', identity: true, consent: 'pending', status: 'AWAITING_HOLDER',
    alert: 'WhatsApp · simulada', tx: null,
  },
  {
    id: 'SIMI-2026-00018', line: '•••• ••• 1744', date: '12 Ago 2026 · 16:08',
    channel: 'Canal digital', identity: true, consent: 'yes', status: 'AUTHORIZED',
    alert: 'SMS · simulada', tx: '0x81f0…29ab',
  },
  {
    id: 'SIMI-2026-00016', line: '•••• ••• 9310', date: '12 Ago 2026 · 14:20',
    channel: 'Agencia Centro', identity: true, consent: 'no', status: 'DISPUTED',
    alert: 'WhatsApp · simulada', tx: '0x44bc…a981',
  },
];

const statusMeta = {
  PENDING: ['Pendiente', 'neutral'],
  IDENTITY_VERIFIED: ['Identidad validada', 'info'],
  AWAITING_HOLDER: ['Esperando titular', 'warning'],
  AUTHORIZED: ['Autorizada', 'success'],
  DISPUTED: ['Disputada', 'danger'],
  EXPIRED: ['Expirada', 'neutral'],
  BLOCKED: ['Bloqueada', 'danger'],
};

function Badge({ status }) {
  const [label, tone] = statusMeta[status] || [status, 'neutral'];
  return <span className={`badge ${tone}`}>{label}</span>;
}

function Brand() {
  return (
    <div className="brand">
      <img src="/assets/simi/logo/simi-isotipo.png" alt="SIMI" />
      <div><strong>SIMI</strong><span>Telecom Security</span></div>
    </div>
  );
}

function App() {
  const [role, setRole] = useState('operator');
  const [requests, setRequests] = useState(initialRequests);
  const [selectedId, setSelectedId] = useState(initialRequests[0].id);
  const [toast, setToast] = useState('');
  const selected = useMemo(() => requests.find(r => r.id === selectedId) || requests[0], [requests, selectedId]);

  const notify = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 2600);
  };

  const updateSelected = (patch) => {
    setRequests(items => items.map(r => r.id === selectedId ? { ...r, ...patch } : r));
  };

  const createDemo = () => {
    const n = requests.length + 22;
    const item = {
      id: `SIMI-2026-000${n}`,
      line: '•••• ••• 6084',
      date: 'Ahora',
      channel: 'Agencia Miraflores',
      identity: false,
      consent: 'pending',
      status: 'PENDING',
      alert: 'Pendiente',
      tx: null,
    };
    setRequests([item, ...requests]);
    setSelectedId(item.id);
    notify('Solicitud demo creada');
  };

  const validateIdentity = () => {
    updateSelected({ identity: true, status: 'AWAITING_HOLDER', alert: 'WhatsApp · simulada' });
    notify('Identidad validada y alerta preparada');
  };

  const holderDecision = (decision) => {
    if (decision === 'yes') {
      updateSelected({ consent: 'yes', status: 'AUTHORIZED', tx: '0xdemo…authorized' });
      notify('Autorización registrada de forma segura');
    } else {
      updateSelected({ consent: 'no', status: 'DISPUTED', tx: '0xdemo…disputed' });
      notify('Solicitud bloqueada y operadora alertada');
    }
  };

  const kpis = {
    active: requests.filter(r => ['PENDING','AWAITING_HOLDER'].includes(r.status)).length,
    pending: requests.filter(r => r.status === 'PENDING').length,
    waiting: requests.filter(r => r.status === 'AWAITING_HOLDER').length,
    authorized: requests.filter(r => r.status === 'AUTHORIZED').length,
    disputed: requests.filter(r => r.status === 'DISPUTED').length,
  };

  return (
    <div className="app-shell">
      {toast && <div className="toast"><CircleCheck size={18}/>{toast}</div>}
      <header className="topbar">
        <Brand />
        <nav className="role-switch" aria-label="Cambiar vista de demo">
          <button className={role==='operator'?'active':''} onClick={()=>setRole('operator')}><Building2 size={17}/>Operadora</button>
          <button className={role==='verifier'?'active':''} onClick={()=>setRole('verifier')}><UserCheck size={17}/>Verificador</button>
          <button className={role==='holder'?'active':''} onClick={()=>setRole('holder')}><Smartphone size={17}/>Titular</button>
        </nav>
        <div className="demo-pill"><span></span> Modo demo</div>
      </header>

      {role === 'operator' && <OperatorView requests={requests} selected={selected} setSelectedId={setSelectedId} kpis={kpis} createDemo={createDemo} />}
      {role === 'verifier' && <VerifierView request={selected} validateIdentity={validateIdentity} setSelectedId={setSelectedId} requests={requests} />}
      {role === 'holder' && <HolderView request={selected} holderDecision={holderDecision} setSelectedId={setSelectedId} requests={requests} />}
    </div>
  );
}

function OperatorView({ requests, selected, setSelectedId, kpis, createDemo }) {
  return (
    <main className="page">
      <section className="hero compact">
        <div>
          <span className="eyebrow"><ShieldCheck size={16}/> Centro de protección SIM</span>
          <h1>Protección y autorización segura de reposiciones SIM.</h1>
          <p>SIMI añade consentimiento explícito del titular y evidencia verificable sin reemplazar los sistemas de la operadora.</p>
        </div>
        <button className="primary" onClick={createDemo}>Nueva solicitud demo</button>
      </section>

      <section className="kpi-grid">
        <Kpi icon={<Activity/>} label="Solicitudes activas" value={kpis.active}/>
        <Kpi icon={<Clock3/>} label="Pendientes" value={kpis.pending}/>
        <Kpi icon={<BellRing/>} label="Esperando titular" value={kpis.waiting}/>
        <Kpi icon={<BadgeCheck/>} label="Autorizadas" value={kpis.authorized}/>
        <Kpi icon={<Siren/>} label="Disputadas" value={kpis.disputed} danger/>
      </section>

      <div className="content-grid">
        <section className="panel requests-panel">
          <div className="panel-head"><div><h2>Solicitudes</h2><p>Seguimiento operativo sin exponer información sensible.</p></div><div className="search"><Search size={16}/>Buscar</div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Solicitud</th><th>Línea</th><th>Identidad</th><th>Consentimiento</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {requests.map(r => <tr key={r.id} className={selected.id===r.id?'selected':''} onClick={()=>setSelectedId(r.id)}>
                  <td><strong>{r.id}</strong><small>{r.date}</small></td>
                  <td>{r.line}</td>
                  <td>{r.identity ? '✓ Validada' : 'Pendiente'}</td>
                  <td>{r.consent==='yes'?'✓ Confirmado':r.consent==='no'?'🚨 Rechazado':'Pendiente'}</td>
                  <td><Badge status={r.status}/></td><td><ChevronRight size={18}/></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <RequestDetail request={selected}/>
      </div>

      <section className="efficiency panel">
        <div><span className="eyebrow"><Gauge size={16}/> Eficiencia SIMI V2</span><h2>Blockchain donde aporta valor, no donde añade fricción.</h2><p>La arquitectura objetivo consolida firmas off-chain y reserva el registro on-chain para evidencia crítica. Los costos reales deben medirse antes de mostrar porcentajes.</p></div>
        <div className="metric-comparison"><div><span>V1</span><strong>3+</strong><small>TX normales conceptuales</small></div><div className="arrow">→</div><div><span>V2 objetivo</span><strong>1</strong><small>TX final + disputa si aplica</small></div></div>
      </section>
    </main>
  );
}

function Kpi({ icon, label, value, danger }) { return <div className={`kpi ${danger?'danger-card':''}`}><div className="kpi-icon">{icon}</div><div><strong>{value}</strong><span>{label}</span></div></div> }

function RequestDetail({ request }) {
  const steps = [
    ['Solicitud creada', true],
    ['Identidad validada', request.identity],
    ['Alerta enviada', request.alert !== 'Pendiente'],
    ['Respuesta del titular', request.consent !== 'pending'],
    ['Registro verificable', !!request.tx],
  ];
  return <aside className="panel detail-panel">
    <div className="detail-top"><div><small>Detalle de solicitud</small><h2>{request.id}</h2></div><Badge status={request.status}/></div>
    {request.status==='DISPUTED' && <div className="risk-banner"><Siren size={20}/><div><strong>ALTO RIESGO</strong><span>El titular no reconoce esta operación. La autorización debe permanecer bloqueada.</span></div></div>}
    <div className="meta-grid"><div><span>Línea</span><strong>{request.line}</strong></div><div><span>Canal</span><strong>{request.channel}</strong></div><div><span>Alerta</span><strong>{request.alert}</strong></div><div><span>Privacidad</span><strong>Datos personales off-chain</strong></div></div>
    <div className="timeline">
      {steps.map(([label, done], i) => <div className={`timeline-item ${done?'done':''}`} key={label}><div className="node">{done?'✓':i+1}</div><span>{label}</span></div>)}
    </div>
    <details className="audit"><summary><LockKeyhole size={16}/> Detalle de auditoría</summary><div><span>Red objetivo</span><strong>Arbitrum Sepolia</strong><span>Transaction hash</span><strong>{request.tx || 'Aún no registrado'}</strong><span>Evidencia</span><strong>Identificadores pseudónimos / proof hash</strong></div></details>
  </aside>
}

function VerifierView({ request, validateIdentity, requests, setSelectedId }) {
  const pending = requests.filter(r => !r.identity);
  return <main className="page narrow">
    <section className="hero compact"><div><span className="eyebrow"><UserCheck size={16}/> Verificación de identidad</span><h1>Validaciones pendientes</h1><p>Este rol registra únicamente el resultado de una validación realizada fuera de blockchain.</p></div></section>
    <section className="panel verifier-list">
      {(pending.length?pending:[request]).map(r => <div className="verifier-card" key={r.id} onClick={()=>setSelectedId(r.id)}><div><small>{r.date}</small><h3>{r.id}</h3><p>{r.line} · {r.channel}</p></div><Badge status={r.identity?'IDENTITY_VERIFIED':'PENDING'}/></div>)}
    </section>
    <section className="panel action-panel"><div><span className="eyebrow">Solicitud seleccionada</span><h2>{request.id}</h2><p>Confirma únicamente si el sistema de identidad de la operadora ya completó la validación correspondiente.</p></div><button className="primary" disabled={request.identity} onClick={validateIdentity}>{request.identity?'Identidad ya validada':'Registrar identidad verificada'}</button></section>
  </main>
}

function HolderView({ request, holderDecision, requests, setSelectedId }) {
  const active = requests.find(r => r.status === 'AWAITING_HOLDER') || request;
  if (active.id !== request.id) setTimeout(()=>setSelectedId(active.id),0);
  const finished = ['AUTHORIZED','DISPUTED'].includes(request.status);
  return <main className="holder-page">
    <section className="holder-card">
      <div className="holder-brand"><img src="/assets/simi/mascot/simi-welcome.png" alt="SIMI te protege"/><div><span className="eyebrow"><ShieldCheck size={16}/> Tu línea está protegida</span><h1>{finished ? (request.status==='AUTHORIZED'?'Solicitud confirmada':'Solicitud bloqueada') : 'Se ha solicitado una reposición de tu SIM'}</h1></div></div>
      {!finished ? <>
        <div className="holder-info"><div><span>Cuándo</span><strong>{request.date}</strong></div><div><span>Canal</span><strong>{request.channel}</strong></div><div><span>Línea</span><strong>{request.line}</strong></div></div>
        <div className="question"><h2>¿Reconoces esta solicitud?</h2><p>Si tú pediste el reemplazo, confírmalo. Si no lo reconoces, repórtalo inmediatamente.</p></div>
        <div className="holder-actions"><button className="confirm" onClick={()=>holderDecision('yes')}><CircleCheck/> Sí, fui yo</button><button className="reject" onClick={()=>holderDecision('no')}><CircleAlert/> No reconozco esta solicitud</button></div>
      </> : <div className={`result ${request.status==='DISPUTED'?'blocked':''}`}><img src={request.status==='AUTHORIZED'?'/assets/simi/states/simi-authorized.png':'/assets/simi/states/simi-blocked.png'} alt="Estado SIMI"/><div>{request.status==='AUTHORIZED'?<><CircleCheck/><h2>Tu autorización fue registrada de forma segura.</h2><p>La operadora puede continuar con el proceso según sus políticas internas.</p></>:<><Siren/><h2>Hemos reportado que no reconoces esta operación.</h2><p>La solicitud quedó marcada como disputada. Contacta a tu operadora si necesitas ayuda.</p></>}</div></div>}
      <div className="holder-help"><Info size={17}/><span><strong>¿Qué es SIMI?</strong> Ayuda a proteger tu línea cuando alguien solicita reemplazar tu SIM.</span></div>
      <details className="technical"><summary><WalletCards size={16}/> Información técnica de la demo</summary><p>El MVP puede utilizar wallets para representar criptográficamente a los actores. En producción esta complejidad debería abstraerse mediante passkeys, wallets embebidas o cuentas inteligentes.</p></details>
    </section>
  </main>
}

export default App;
