import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, BadgeCheck, BellRing, Building2,
  Check, CheckCircle2, ChevronRight, CircleCheck, Clock3, Copy,
  ExternalLink, FileCheck2, Fingerprint, Info, LockKeyhole, Menu,
  Plus, Radio, RefreshCw, Search, ShieldCheck, Siren, Smartphone,
  UserCheck, WalletCards, X
} from 'lucide-react';
import {
  ARBITRUM_SEPOLIA, connectWallet, getWalletSnapshot, hasContractAddress,
  shortAddress, signHolderDecision, signIdentityVerification,
  signOperatorRequest, switchToArbitrumSepolia
} from './services/wallet';

const STORAGE_KEY = 'simi-demo-requests-v3';

const seedRequests = [
  {
    id: 'SIMI-2026-00021', line: '•••• ••• 4821', date: '12 Ago 2026 · 09:18',
    channel: 'Agencia San Isidro', identity: true, consent: 'pending',
    status: 'AWAITING_HOLDER', alert: 'WhatsApp de prueba enviado', tx: null,
    createdAt: 1786544280, expiresAt: 1786630680, nonce: 1, policyVersion: 2,
    sample: true,
  },
  {
    id: 'SIMI-2026-00018', line: '•••• ••• 1744', date: '12 Ago 2026 · 08:42',
    channel: 'Canal digital', identity: true, consent: 'yes', status: 'AUTHORIZED',
    alert: 'SMS de prueba enviado', tx: '0x81f0…29ab', createdAt: 1786541720,
    expiresAt: 1786628120, nonce: 1, policyVersion: 2,
    sample: true,
  },
  {
    id: 'SIMI-2026-00016', line: '•••• ••• 9310', date: '12 Ago 2026 · 08:05',
    channel: 'Agencia Centro', identity: true, consent: 'no', status: 'DISPUTED',
    alert: 'WhatsApp de prueba enviado', tx: '0x44bc…a981', createdAt: 1786539500,
    expiresAt: 1786625900, nonce: 1, policyVersion: 2,
    sample: true,
  },
];

const statusMeta = {
  PENDING: { label: 'Falta validar identidad', tone: 'neutral', icon: Clock3 },
  AWAITING_HOLDER: { label: 'Esperando al titular', tone: 'warning', icon: Smartphone },
  AUTHORIZED: { label: 'Reposición autorizada', tone: 'success', icon: CircleCheck },
  DISPUTED: { label: 'Bloqueada por el titular', tone: 'danger', icon: Siren },
};

const roleMeta = {
  operator: { label: 'Empleado', short: 'Centro de operaciones', icon: Building2 },
  verifier: { label: 'Verificador', short: 'Validación de identidad', icon: UserCheck },
  holder: { label: 'Titular', short: 'Confirmación del cliente', icon: Smartphone },
};

function loadRequests() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) && saved.length ? saved : seedRequests;
  } catch {
    return seedRequests;
  }
}

function Brand() {
  return <div className="brand">
    <img src="/assets/simi/logo/simi-isotipo.png" alt="SIMI" />
    <div><strong>SIMI</strong><span>Seguridad para operadoras</span></div>
  </div>;
}

function StatusBadge({ status }) {
  const meta = statusMeta[status] || statusMeta.PENDING;
  const Icon = meta.icon;
  return <span className={`status-badge ${meta.tone}`}><Icon size={14} />{meta.label}</span>;
}

function WalletPanel({ wallet, setWallet, notify }) {
  const wrongNetwork = wallet.connected && wallet.chainId !== ARBITRUM_SEPOLIA.chainId;

  const connect = async () => {
    try {
      setWallet((current) => ({ ...current, busy: true }));
      const snapshot = await connectWallet();
      setWallet({ ...snapshot, busy: false });
      notify('Credencial conectada correctamente');
    } catch (error) {
      setWallet((current) => ({ ...current, busy: false }));
      notify(error?.message === 'METAMASK_NOT_FOUND'
        ? 'MetaMask no está instalado en este navegador'
        : 'No pudimos conectar la credencial');
    }
  };

  const changeNetwork = async () => {
    try {
      await switchToArbitrumSepolia();
      setWallet(await getWalletSnapshot());
      notify('Ahora estás en Arbitrum Sepolia');
    } catch {
      notify('No pudimos cambiar la red');
    }
  };

  if (!wallet.installed) {
    return <div className="wallet-state warning"><WalletCards size={19} /><div>
      <strong>Credencial no disponible</strong><span>Instala MetaMask para firmar</span>
    </div></div>;
  }

  if (!wallet.connected) {
    return <button className="wallet-connect" onClick={connect} disabled={wallet.busy}>
      <Fingerprint size={18} />{wallet.busy ? 'Conectando…' : 'Conectar credencial'}
    </button>;
  }

  return <div className={`wallet-state ${wrongNetwork ? 'warning' : 'ready'}`}>
    <span className="live-dot" />
    <div><strong>{wrongNetwork ? 'Red incorrecta' : 'Credencial lista'}</strong>
      <span>{shortAddress(wallet.account)} · {wallet.balance} ETH</span></div>
    <div className="wallet-mini-actions">
      {wrongNetwork && <button onClick={changeNetwork}>Cambiar red</button>}
      <button onClick={() => navigator.clipboard?.writeText(wallet.account)} aria-label="Copiar dirección"><Copy size={14} /></button>
      <a href={`https://sepolia.arbiscan.io/address/${wallet.account}`} target="_blank" rel="noreferrer" aria-label="Ver en Arbiscan"><ExternalLink size={14} /></a>
    </div>
  </div>;
}

function DemoSwitcher({ role, setRole }) {
  return <div className="demo-switcher">
    <div className="demo-label"><Radio size={15} /><span><strong>Recorrido de demostración</strong>
      <small>Una sola sesión muestra los 3 momentos del proceso</small></span></div>
    <div className="demo-roles">
      {Object.entries(roleMeta).map(([key, item], index) => {
        const Icon = item.icon;
        return <React.Fragment key={key}>
          <button className={role === key ? 'active' : ''} onClick={() => setRole(key)}>
            <span>{index + 1}</span><Icon size={16} />{item.label}
          </button>
          {index < 2 && <ChevronRight className="demo-arrow" size={15} />}
        </React.Fragment>;
      })}
    </div>
  </div>;
}

export default function App() {
  const [role, setRole] = useState('operator');
  const [requests, setRequests] = useState(loadRequests);
  const [selectedId, setSelectedId] = useState(() => loadRequests()[0]?.id);
  const [wallet, setWallet] = useState({ installed: true, connected: false, account: '', chainId: 0, balance: '0' });
  const [toast, setToast] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) || requests[0],
    [requests, selectedId]
  );

  const notify = (message) => {
    setToast(message);
    window.clearTimeout(window.__simiToast);
    window.__simiToast = window.setTimeout(() => setToast(''), 2800);
  };

  const patchSelected = (patch) => {
    setRequests((items) => items.map((item) => item.id === selectedId ? { ...item, ...patch } : item));
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  }, [requests]);

  useEffect(() => {
    getWalletSnapshot().then(setWallet).catch(() => setWallet({
      installed: Boolean(window.ethereum), connected: false, account: '', chainId: 0, balance: '0'
    }));
    if (!window.ethereum) return undefined;
    const refresh = () => getWalletSnapshot().then(setWallet).catch(() => {});
    window.ethereum.on?.('accountsChanged', refresh);
    window.ethereum.on?.('chainChanged', refresh);
    return () => {
      window.ethereum.removeListener?.('accountsChanged', refresh);
      window.ethereum.removeListener?.('chainChanged', refresh);
    };
  }, []);

  const openStep = (nextRole, requestId = selectedId) => {
    setSelectedId(requestId);
    setRole(nextRole);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const createRequest = async ({ lastFour, channel }) => {
    if (!wallet.connected || wallet.chainId !== ARBITRUM_SEPOLIA.chainId) {
      notify('Conecta tu credencial en Arbitrum Sepolia antes de crear la solicitud');
      return false;
    }
    const now = Math.floor(Date.now() / 1000);
    const nextNumber = String(Math.max(...requests.map((item) => Number(item.id.split('-').pop()) || 0)) + 1).padStart(5, '0');
    const request = {
      id: `SIMI-2026-${nextNumber}`, line: `•••• ••• ${lastFour}`, date: 'Ahora', channel,
      identity: false, consent: 'pending', status: 'PENDING', alert: 'Aún no enviada', tx: null,
      createdAt: now, expiresAt: now + 24 * 60 * 60, nonce: 1, policyVersion: 2,
      holderAddress: wallet.account,
    };
    try {
      const evidence = await signOperatorRequest(request);
      const signed = { ...request, operatorAddress: evidence.signer, operatorSignature: evidence.signature };
      setRequests((items) => [signed, ...items]);
      setSelectedId(signed.id);
      setShowNew(false);
      notify('Solicitud creada y firmada. Continúa con la validación.');
      return true;
    } catch {
      notify('La firma fue cancelada; no se creó la solicitud');
      return false;
    }
  };

  const validateIdentity = async () => {
    if (!wallet.connected || wallet.chainId !== ARBITRUM_SEPOLIA.chainId) {
      notify('Conecta la credencial del verificador en Arbitrum Sepolia');
      return;
    }
    try {
      const evidence = await signIdentityVerification(selected);
      patchSelected({
        identity: true, status: 'AWAITING_HOLDER', alert: 'WhatsApp de prueba enviado',
        verifierAddress: evidence.signer, verifierSignature: evidence.signature,
      });
      notify('Validación firmada. Ahora debe responder el titular.');
    } catch {
      notify('La firma fue cancelada o no pudo completarse');
    }
  };

  const holderDecision = async (decision) => {
    if (!wallet.connected || wallet.chainId !== ARBITRUM_SEPOLIA.chainId) {
      notify('Conecta la credencial del titular en Arbitrum Sepolia');
      return;
    }
    try {
      const action = decision === 'yes' ? 'AUTHORIZE' : 'DISPUTE';
      const evidence = await signHolderDecision(selected, action);
      patchSelected(decision === 'yes' ? {
        consent: 'yes', status: 'AUTHORIZED',
        holderSignature: evidence.signature,
        tx: hasContractAddress ? 'Lista para registro final' : 'Firma lista · contrato pendiente de despliegue',
      } : {
        consent: 'no', status: 'DISPUTED',
        holderSignature: evidence.signature,
        tx: hasContractAddress ? 'Disputa lista para registrar' : 'Disputa firmada · contrato pendiente',
      });
      notify(decision === 'yes' ? 'El titular autorizó la reposición' : 'Solicitud bloqueada y reportada');
    } catch {
      notify('La firma fue cancelada o no pudo completarse');
    }
  };

  return <div className="app-shell">
    {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
    <header className="topbar">
      <Brand />
      <div className="screen-context"><span>Portal del empleado</span><strong>{roleMeta[role].short}</strong></div>
      <WalletPanel wallet={wallet} setWallet={setWallet} notify={notify} />
      <button className="menu-button" onClick={() => setMobileMenu((open) => !open)} aria-label="Abrir recorrido"><Menu /></button>
    </header>

    <div className={mobileMenu ? 'demo-wrap open' : 'demo-wrap'}>
      <DemoSwitcher role={role} setRole={(next) => { setRole(next); setMobileMenu(false); }} />
    </div>

    {role === 'operator' && <OperatorView
      requests={requests} selected={selected} setSelectedId={setSelectedId}
      setShowNew={setShowNew} openStep={openStep}
    />}
    {role === 'verifier' && <VerifierView
      request={selected} requests={requests} setSelectedId={setSelectedId}
      validateIdentity={validateIdentity} wallet={wallet} openStep={openStep}
    />}
    {role === 'holder' && <HolderView
      request={selected} requests={requests} setSelectedId={setSelectedId}
      holderDecision={holderDecision} wallet={wallet} openStep={openStep}
    />}

    {showNew && <NewRequestModal wallet={wallet} onClose={() => setShowNew(false)} onCreate={createRequest} />}
  </div>;
}

function OperatorView({ requests, selected, setSelectedId, setShowNew, openStep }) {
  const [query, setQuery] = useState('');
  const visible = requests.filter((item) => `${item.id} ${item.line} ${statusMeta[item.status]?.label}`.toLowerCase().includes(query.toLowerCase()));
  const counts = {
    action: requests.filter((item) => ['PENDING', 'AWAITING_HOLDER'].includes(item.status)).length,
    authorized: requests.filter((item) => item.status === 'AUTHORIZED').length,
    blocked: requests.filter((item) => item.status === 'DISPUTED').length,
  };

  return <main className="operations-page">
    <section className="page-heading">
      <div><span className="eyebrow"><ShieldCheck size={16} /> Centro de protección SIM</span>
        <h1>Buenos días. Estas son tus solicitudes.</h1>
        <p>Selecciona un caso y SIMI te indicará el siguiente paso. No necesitas entender blockchain.</p></div>
      <button className="primary-action" onClick={() => setShowNew(true)}><Plus size={19} />Nueva solicitud</button>
    </section>

    <section className="summary-strip">
      <div className="summary-item focus"><span><Activity />Necesitan atención</span><strong>{counts.action}</strong></div>
      <div className="summary-item"><span><BadgeCheck />Autorizadas</span><strong>{counts.authorized}</strong></div>
      <div className="summary-item danger"><span><Siren />Bloqueadas</span><strong>{counts.blocked}</strong></div>
      <div className="system-online"><span className="live-dot" /><div><strong>Interfaz disponible</strong><small>Red objetivo: Arbitrum Sepolia</small></div></div>
    </section>

    <section className="operations-grid">
      <aside className="queue-panel">
        <div className="queue-head"><div><h2>Cola de solicitudes</h2><p>{visible.length} casos visibles</p></div>
          <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar caso" /></label></div>
        <div className="request-stack">
          {visible.map((request) => <button key={request.id} className={selected.id === request.id ? 'request-card selected' : 'request-card'} onClick={() => setSelectedId(request.id)}>
            <div className="request-card-top"><strong>{request.line}</strong><StatusBadge status={request.status} /></div>
            <span>{request.id}</span><small>{request.channel} · {request.date}</small>
          </button>)}
        </div>
      </aside>

      <RequestWorkspace request={selected} openStep={openStep} />
    </section>

    <RealityPanel />
  </main>;
}

function RequestWorkspace({ request, openStep }) {
  const steps = [
    { label: 'Solicitud firmada por la operadora', done: Boolean(request.operatorSignature) || request.sample },
    { label: 'Identidad validada', done: request.identity },
    { label: 'Titular notificado', done: request.alert !== 'Aún no enviada' },
    { label: 'Decisión del titular', done: request.consent !== 'pending' },
    { label: 'Evidencia final en Arbitrum', done: Boolean(request.tx?.startsWith('0x')) },
  ];
  const action = request.status === 'PENDING'
    ? { title: 'La identidad aún no fue validada', text: 'Pasa este caso al verificador para registrar la comprobación externa.', label: 'Continuar con verificación', role: 'verifier', icon: UserCheck }
    : request.status === 'AWAITING_HOLDER'
      ? { title: 'Estamos esperando al titular', text: 'Abre la vista del cliente para demostrar cómo confirma o bloquea la solicitud.', label: 'Ver confirmación del titular', role: 'holder', icon: Smartphone }
      : null;
  const ActionIcon = action?.icon;

  return <article className="workspace-panel">
    <div className="workspace-header"><div><span>Solicitud seleccionada</span><h2>{request.id}</h2></div><StatusBadge status={request.status} /></div>

    {request.status === 'DISPUTED' && <div className="critical-alert"><Siren /><div><strong>No autorizar esta reposición</strong><span>El titular indicó que no reconoce la solicitud. El caso requiere revisión antifraude.</span></div></div>}
    {request.status === 'AUTHORIZED' && <div className="success-alert"><CircleCheck /><div><strong>El titular confirmó la solicitud</strong><span>La reposición puede continuar cuando la evidencia final quede registrada.</span></div></div>}

    <div className="case-data">
      <div><span>Línea protegida</span><strong>{request.line}</strong></div>
      <div><span>Origen</span><strong>{request.channel}</strong></div>
      <div><span>Creada</span><strong>{request.date}</strong></div>
    </div>

    {action && <section className="next-action-card"><div className="next-action-icon"><ActionIcon /></div><div><span>Próxima acción recomendada</span><h3>{action.title}</h3><p>{action.text}</p></div>
      <button onClick={() => openStep(action.role, request.id)}>{action.label}<ArrowRight size={17} /></button></section>}

    <div className="progress-section"><div className="section-title"><div><span>Progreso del caso</span><h3>5 controles de seguridad</h3></div><strong>{steps.filter((step) => step.done).length}/5 listos</strong></div>
      <div className="case-progress">{steps.map((step, index) => <div className={step.done ? 'progress-step done' : 'progress-step'} key={step.label}>
        <div className="progress-node">{step.done ? <Check size={15} /> : index + 1}</div><span>{step.label}</span>
      </div>)}</div>
    </div>

    <details className="audit-drawer"><summary><LockKeyhole size={17} /><span><strong>Auditoría técnica</strong><small>Wallet, firmas y datos de Arbitrum</small></span><ChevronRight /></summary>
      <div className="audit-grid">
        <div><span>Red</span><strong>Arbitrum Sepolia · 421614</strong></div>
        <div><span>Contrato</span><strong>{hasContractAddress ? 'Dirección configurada' : 'Pendiente de desplegar'}</strong></div>
        <div><span>Firma operadora</span><strong>{request.operatorSignature ? 'Capturada' : request.sample ? 'Muestra sin firma' : 'Aún no capturada'}</strong></div>
        <div><span>Registro final</span><strong>{request.tx || 'Aún no disponible'}</strong></div>
      </div>
    </details>
  </article>;
}

function RealityPanel() {
  return <section className="reality-panel"><div className="reality-title"><Info /><div><strong>Estado real del MVP</strong><span>Sin promesas escondidas: esto es lo que funciona hoy.</span></div></div>
    <div className="reality-items">
      <div className="real"><CircleCheck /><span><strong>Real ahora</strong><small>MetaMask, lectura de cuenta y cambio de red</small></span></div>
      <div className="demo"><BellRing /><span><strong>Demostración</strong><small>Solicitudes de ejemplo y aviso WhatsApp/SMS</small></span></div>
      <div className="pending"><Clock3 /><span><strong>Siguiente integración</strong><small>Despliegue y transacción final del contrato</small></span></div>
    </div>
  </section>;
}

function VerifierView({ request, requests, setSelectedId, validateIdentity, wallet, openStep }) {
  const pending = requests.filter((item) => !item.identity);
  const target = pending.find((item) => item.id === request.id) || pending[0] || request;
  useEffect(() => { if (target.id !== request.id) setSelectedId(target.id); }, [target.id, request.id, setSelectedId]);
  const canSign = wallet.connected && wallet.chainId === ARBITRUM_SEPOLIA.chainId && !target.identity;

  return <main className="task-page">
    <button className="back-link" onClick={() => openStep('operator')}><ArrowLeft />Volver al centro de operaciones</button>
    <div className="task-heading"><div className="task-icon"><UserCheck /></div><div><span className="eyebrow">Momento 2 de 3 · Verificador</span><h1>Registra la validación de identidad</h1><p>Esta pantalla solo certifica el resultado de la validación externa. SIMI no almacena DNI, foto ni biometría en blockchain.</p></div></div>

    <div className="task-layout"><aside className="task-queue"><div><h2>Pendientes</h2><span>{pending.length} por validar</span></div>
      {(pending.length ? pending : [target]).map((item) => <button key={item.id} className={item.id === target.id ? 'active' : ''} onClick={() => setSelectedId(item.id)}>
        <span>{item.line}</span><small>{item.id}</small><ChevronRight /></button>)}</aside>
      <section className="verification-card"><div className="verification-head"><div><span>Solicitud</span><h2>{target.id}</h2></div><StatusBadge status={target.status} /></div>
        <div className="identity-result"><FileCheck2 /><div><span>Resultado recibido del sistema de identidad</span><strong>Identidad verificada correctamente</strong><small>Referencia privada: IDV-{target.id.slice(-5)}</small></div></div>
        <div className="privacy-note"><ShieldCheck /><span><strong>Privacidad protegida</strong> Solo se firma una huella criptográfica del resultado. Los documentos permanecen en los sistemas de la operadora.</span></div>
        <div className="simple-checks"><div><CheckCircle2 /><span>Solicitud vigente</span></div><div><CheckCircle2 /><span>Datos vinculados al mismo caso</span></div><div><CheckCircle2 /><span>Firma sin costo de gas</span></div></div>
        <button className="wide-primary" disabled={!canSign} onClick={validateIdentity}><Fingerprint />{target.identity ? 'Validación ya registrada' : canSign ? 'Firmar validación' : 'Conecta la credencial del verificador'}</button>
        {target.identity && <button className="secondary-action" onClick={() => openStep('holder', target.id)}>Continuar a la confirmación del titular<ArrowRight /></button>}
      </section></div>
  </main>;
}

function HolderView({ request, requests, setSelectedId, holderDecision, wallet, openStep }) {
  const awaiting = requests.find((item) => item.status === 'AWAITING_HOLDER');
  const target = request.status === 'AWAITING_HOLDER' || ['AUTHORIZED', 'DISPUTED'].includes(request.status) ? request : awaiting || request;
  useEffect(() => { if (target.id !== request.id) setSelectedId(target.id); }, [target.id, request.id, setSelectedId]);
  const finished = ['AUTHORIZED', 'DISPUTED'].includes(target.status);
  const canRespond = wallet.connected && wallet.chainId === ARBITRUM_SEPOLIA.chainId;

  return <main className="holder-page-new">
    <button className="back-link holder-back" onClick={() => openStep('operator')}><ArrowLeft />Volver al recorrido del empleado</button>
    <section className="customer-phone"><div className="customer-top"><Brand /><span>Solicitud segura</span></div>
      {!finished ? <>
        <div className="customer-hero"><img src="/assets/simi/mascot/simi-welcome.png" alt="Asistente SIMI" /><div><span className="eyebrow">Protección activa</span><h1>¿Solicitaste reemplazar tu SIM?</h1></div></div>
        <p className="customer-lead">Una persona pidió una nueva SIM para tu línea. Confirma si fuiste tú; toma menos de un minuto.</p>
        <div className="customer-data"><div><span>Línea</span><strong>{target.line}</strong></div><div><span>Lugar</span><strong>{target.channel}</strong></div><div><span>Fecha</span><strong>{target.date}</strong></div></div>
        <div className="customer-question"><strong>¿Reconoces esta solicitud?</strong><span>Tu respuesta no se puede cambiar después.</span></div>
        <div className="customer-actions"><button className="yes" disabled={!canRespond} onClick={() => holderDecision('yes')}><CircleCheck />Sí, fui yo</button>
          <button className="no" disabled={!canRespond} onClick={() => holderDecision('no')}><Siren />No fui yo, bloquear</button></div>
        {!canRespond && <div className="credential-prompt"><WalletCards /><span><strong>Falta verificar que eres tú</strong> Conecta la credencial segura desde la parte superior.</span></div>}
      </> : <ResultState request={target} />}
      <div className="customer-help"><ShieldCheck /><span>SIMI protege tu línea sin guardar documentos personales en blockchain.</span></div>
    </section>
  </main>;
}

function ResultState({ request }) {
  const blocked = request.status === 'DISPUTED';
  return <div className={blocked ? 'customer-result blocked' : 'customer-result'}>
    <img src={blocked ? '/assets/simi/states/simi-blocked.png' : '/assets/simi/states/simi-authorized.png'} alt="Resultado de la solicitud" />
    {blocked ? <><Siren /><h1>Solicitud bloqueada</h1><p>La operadora fue alertada. No se debe entregar una nueva SIM hasta revisar el caso.</p></>
      : <><CircleCheck /><h1>Solicitud confirmada</h1><p>Tu autorización quedó firmada. La operadora puede continuar con el proceso seguro.</p></>}
  </div>;
}

function NewRequestModal({ wallet, onClose, onCreate }) {
  const [lastFour, setLastFour] = useState('');
  const [channel, setChannel] = useState('Agencia Miraflores');
  const [busy, setBusy] = useState(false);
  const ready = /^\d{4}$/.test(lastFour) && wallet.connected && wallet.chainId === ARBITRUM_SEPOLIA.chainId;
  const submit = async (event) => {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    await onCreate({ lastFour, channel });
    setBusy(false);
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="request-modal" onSubmit={submit}><button type="button" className="modal-close" onClick={onClose}><X /></button>
      <span className="eyebrow"><Plus />Nueva solicitud</span><h2>Registrar reposición de SIM</h2><p>Usa solo datos mínimos para la demostración. La información personal completa permanece fuera de blockchain.</p>
      <label>Últimos 4 dígitos de la línea<input inputMode="numeric" maxLength="4" value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, ''))} placeholder="Ej. 6084" /></label>
      <label>Canal de atención<select value={channel} onChange={(event) => setChannel(event.target.value)}><option>Agencia Miraflores</option><option>Agencia San Isidro</option><option>Canal digital</option><option>Call center</option></select></label>
      <div className={ready ? 'sign-readiness ready' : 'sign-readiness'}><Fingerprint /><span><strong>{ready ? 'Lista para firmar' : 'Falta conectar la credencial'}</strong><small>{hasContractAddress ? 'La firma EIP-712 usará el contrato configurado y no gasta gas.' : 'Se generará una firma EIP-712 de demo; falta desplegar el contrato.'}</small></span></div>
      <button className="wide-primary" disabled={!ready || busy}>{busy ? <RefreshCw className="spin" /> : <Fingerprint />}{busy ? 'Esperando firma…' : 'Firmar y crear solicitud'}</button>
    </form>
  </div>;
}
