import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Archive, ArrowDownToLine, ArrowRight, Check, CheckCircle2, ChevronRight, CircleHelp, CircleUserRound,
  Clock3, ExternalLink, Eye, FileCode2, Fingerprint, FolderOpen, Ghost, Info, Layers3, LoaderCircle, LogOut,
  Play, Plus, RefreshCw, Search, Settings2, ShieldCheck, ShieldAlert, Sparkles, Trash2, X, Zap } from 'lucide-react';
import catalog from '../../catalog.json';
import './styles.css';

const initial = { version: '0.1.0', settings: { gamePath: null, steamPath: null, modRoots: [], overrides: {}, selected: [], memoryGb: 0, theme: 'dark', reduceMotion: false },
  mods: catalog.mods.map(mod => ({ ...mod, status: 'missing', selected: false })), game: null, busy: null, progress: '',
  auth: { status: 'offline' }, history: [], runtimePath: '', physicalMemoryGb: 0, running: false, lastExit: null };
const statuses = { missing: ['Não encontrado', 'muted'], found: ['Aguardando revisão', 'yellow'], ready: ['Preparado', 'green'], changed: ['JAR atualizado', 'yellow'], invalid: ['Arquivo inválido', 'red'] };
const Icons = { skinwalker: Ghost, viewpoint: Eye, zombiebuddy: Layers3 };
const native = Boolean(window.organic);

function Button({ children, icon: Icon, tone = '', className = '', ...props }) {
  return <button className={`button ${tone} ${className}`} {...props}>{Icon && <Icon size={16} />}{children}</button>;
}
function Toggle({ checked, onChange, disabled, label }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} className={`toggle ${checked ? 'on' : ''}`} disabled={disabled} onClick={() => onChange(!checked)}><span /></button>;
}
function Badge({ status }) { const [name, color] = statuses[status] || statuses.missing; return <span className={`badge ${color}`}><i />{name}</span>; }
function Modal({ title, children, onClose, footer, large }) {
  const ref = useRef();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('button')?.focus();
    function key(event) {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab') {
        const list = [...ref.current.querySelectorAll('button:not(:disabled),input,select,[tabindex="0"]')];
        if (!list.length) return;
        if (event.shiftKey && document.activeElement === list[0]) { event.preventDefault(); list.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === list.at(-1)) { event.preventDefault(); list[0].focus(); }
      }
    }
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="modal-shade" onMouseDown={event => event.target === event.currentTarget && onClose()}><section ref={ref} className={`modal ${large ? 'large' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
    <header><h2>{title}</h2><Button icon={X} className="icon-button" aria-label="Fechar" title="Fechar" onClick={onClose} /></header>
    <div className="modal-body">{children}</div>{footer && <footer>{footer}</footer>}
  </section></div>;
}

function App() {
  const [state, setState] = useState(initial), [page, setPage] = useState('library'), [search, setSearch] = useState(''), [filter, setFilter] = useState('all');
  const [action, setAction] = useState(null), [toast, setToast] = useState(null), [modal, setModal] = useState(null), [consent, setConsent] = useState(false);
  const busy = Boolean(state.busy || action);
  useEffect(() => {
    if (!native) return;
    let mounted = true;
    window.organic.getState().then(value => mounted && setState(value)).catch(error => setToast(error.message));
    const unsubscribe = window.organic.subscribe(value => mounted && setState(value));
    return () => { mounted = false; unsubscribe(); };
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = state.settings.theme; document.documentElement.dataset.motion = state.settings.reduceMotion ? 'reduced' : 'full'; }, [state.settings.theme, state.settings.reduceMotion]);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);
  async function call(method, ...args) {
    if (!native) { setToast('Prévia visual. As operações de arquivos e login estão disponíveis no aplicativo desktop.'); return null; }
    setAction(method); setToast(null);
    try { return await window.organic[method](...args); }
    catch (error) { setToast(error.message); return null; }
    finally { setAction(null); }
  }
  async function save(patch) {
    const value = { ...state.settings, ...patch };
    if (!native) { setState(current => ({ ...current, settings: value, mods: current.mods.map(mod => ({ ...mod, selected: value.selected.includes(mod.id) || (mod.id === 'zombiebuddy' && value.selected.includes('viewpoint')), automatic: mod.id === 'zombiebuddy' && value.selected.includes('viewpoint') && !value.selected.includes(mod.id) })) })); return; }
    await call('saveSettings', value);
  }
  async function review() { const value = await call('review'); if (value) { setConsent(false); setModal({ kind: 'review', value }); } }
  async function launch() { const value = await call('launchPlan'); if (value) { setConsent(false); setModal({ kind: 'launch', value }); } }
  async function confirm() {
    const current = modal;
    const value = await call(current.kind === 'review' ? 'apply' : 'launch', current.value.token);
    if (value) { setModal(null); setToast(current.kind === 'review' ? 'JARs preparados. O jogo e a Workshop não foram alterados.' : 'Inicialização solicitada ao Java do PZ.'); }
  }
  const selected = state.mods.filter(mod => mod.selected);
  const prepared = selected.filter(mod => mod.status === 'ready').length;
  const found = state.mods.filter(mod => mod.source).length;
  const mods = state.mods.filter(mod => `${mod.name} ${mod.category}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || (filter === 'found' ? mod.source : mod.status !== 'ready')));
  const nav = [['library', Archive, 'Biblioteca Java'], ['activity', Clock3, 'Atividade'], ['settings', Settings2, 'Configurações'], ['privacy', ShieldCheck, 'Privacidade']];
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Zap size={24} fill="currentColor" /></div><div><strong>Java Injeto</strong><span>PROJECT ZOMBOID</span></div></div>
      <div className="season"><i />ORGANIC<span>Temporada nova</span></div>
      <nav aria-label="Navegação">{nav.map(([id, Icon, title]) => <button key={id} aria-label={title} title={title} onClick={() => setPage(id)} className={page === id ? 'active' : ''}><Icon size={19} /><span>{title}</span>{page === id && <ChevronRight size={14} />}</button>)}</nav>
      <div className="sidebar-bottom"><span className="connection-dot" />LOCAL · WINDOWS<span>v{state.version}</span></div>
    </aside>
    <main>
      <header className="topbar"><div className="breadcrumb">Organic <ChevronRight size={13} /><strong>{nav.find(item => item[0] === page)?.[2]}</strong></div>
        <Button icon={state.auth.status === 'connected' ? ShieldCheck : CircleUserRound} className="steam-button" onClick={() => state.auth.status === 'connected' ? setPage('privacy') : setModal({ kind: 'login' })} disabled={busy}>
          {state.auth.status === 'connected' ? 'Steam conectada' : state.auth.status === 'pending' ? 'Aguardando Steam' : 'Entrar com Steam'}</Button>
      </header>
      <div className="page-content">
        {page === 'library' && <>
          <div className="page-heading"><div><div className="eyebrow">PERFIL DA TEMPORADA</div><h1>Seu Java, no lugar certo.</h1></div><Button icon={RefreshCw} onClick={() => call('scan')} disabled={busy} className={state.busy === 'scan' ? 'scanning' : ''}>Buscar arquivos</Button></div>
          <section className="installation-band" aria-label="Instalação do jogo"><div className="installation-icon"><FolderOpen size={22} /></div><div className="installation-text"><strong>Project Zomboid</strong><span title={state.game?.path}>{state.game?.path || 'Selecione a instalação ou busque suas bibliotecas Steam'}</span></div><span className={`status-pill ${state.game ? 'ok' : ''}`}>{state.game ? <CheckCircle2 size={14} /> : <Info size={14} />}{state.game ? 'Localizado' : 'Não localizado'}</span><Button icon={FolderOpen} className="icon-button" aria-label="Selecionar instalação" title="Selecionar instalação" onClick={() => call('chooseFolder', 'game')} disabled={busy} /></section>
          <div className="summary-row"><span><strong>{found}</strong> JARs encontrados</span><span><strong>{selected.length}</strong> componentes selecionados</span><span><strong>{prepared}</strong> preparados</span><span className="safe-label"><ShieldCheck size={15} />Arquivos vanilla preservados</span></div>
          <div className="library-toolbar"><div className="segmented" role="group" aria-label="Filtro de arquivos">{[['all','Todos'],['found','Encontrados'],['pending','Pendentes']].map(([key,label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div><label className="search"><Search size={16} /><input aria-label="Buscar componente" placeholder="Buscar componente..." value={search} onChange={event => setSearch(event.target.value)} /></label></div>
          <div className="mod-list">{mods.map(mod => { const Icon = Icons[mod.id] || FileCode2; return <article className="mod-row" key={mod.id}>
            <div className={`mod-art ${mod.accent}`}><Icon size={30} strokeWidth={1.5} /></div>
            <div className="mod-content"><div className="mod-heading"><h2>{mod.name}</h2><span className="category">{mod.kind === 'agent' ? 'Agente Java' : 'Via ZombieBuddy'}</span></div><p>{mod.description}</p><div className="mod-meta"><Badge status={mod.status} /><span>{mod.jarName}</span>{mod.automatic && <span className="dependency">Dependência automática</span>}</div></div>
            <div className="mod-actions"><Button className="icon-button" icon={Info} aria-label={`Detalhes de ${mod.name}`} title="Detalhes e impressão do arquivo" onClick={() => setModal({ kind: 'details', value: mod })} /><Toggle checked={mod.selected} label={`Preparar Java de ${mod.name}`} disabled={busy || state.running || mod.automatic} onChange={enabled => save({ selected: enabled ? [...state.settings.selected, mod.id] : state.settings.selected.filter(id => id !== mod.id) })} /></div>
          </article>; })}{mods.length === 0 && <div className="empty"><Search size={28} /><h2>Nenhum componente encontrado</h2><span>Revise o filtro ou o nome pesquisado.</span></div>}</div>
          <div className="workshop-note"><ArrowDownToLine size={17} /><span>Os mods continuam na Workshop. Este perfil prepara somente os agentes <strong>.jar</strong>.</span></div>
          {state.profileError && <p className="error" role="alert">{state.profileError}</p>}
          <section className="profile-footer"><div><strong>{state.running ? 'Project Zomboid em execução' : 'Perfil Organic'}</strong><span>{selected.length ? `${selected.map(mod => mod.name).join(' + ')}` : 'Nenhum agente selecionado'}</span></div><div className="launch-buttons"><Button icon={ShieldCheck} onClick={review} disabled={busy || state.running || !selected.length}>Revisar e preparar</Button><Button icon={Play} tone="primary" onClick={launch} disabled={busy || state.running || !state.game}>{state.running ? 'Em execução' : 'Iniciar PZ'}</Button></div></section>
        </>}
        {page === 'settings' && <>
          <div className="page-heading"><div><div className="eyebrow">PREFERÊNCIAS LOCAIS</div><h1>Configurações</h1></div></div>
          <section className="settings-section"><h2>Instalação</h2><div className="setting-row"><div><strong>Pasta do Project Zomboid</strong><span className="path">{state.game?.path || state.settings.gamePath || 'Não selecionada'}</span></div><Button icon={FolderOpen} onClick={() => call('chooseFolder','game')} disabled={busy}>Selecionar</Button></div>
            <div className="setting-row"><div><strong>Biblioteca Steam</strong><span className="path">{state.settings.steamPath || 'Detecção automática por bibliotecas Steam'}</span></div><Button icon={FolderOpen} onClick={() => call('chooseFolder','steam')} disabled={busy}>Selecionar</Button></div>
            <div className="setting-row"><div><strong>Pastas adicionais de mods</strong><span>Workshop e Zomboid/mods já são pesquisados.</span></div><Button icon={Plus} onClick={() => call('chooseFolder','mods')} disabled={busy}>Adicionar pasta</Button></div>{state.settings.modRoots.map(root => <div className="extra-root" key={root}><span>{root}</span><Button icon={X} className="icon-button" title="Remover pasta da busca" aria-label="Remover pasta da busca" disabled={busy} onClick={() => save({ modRoots: state.settings.modRoots.filter(item => item !== root) })} /></div>)}</section>
          <section className="settings-section"><h2>Inicialização</h2><div className="setting-row"><div><strong>Limite de memória Java</strong><span>{state.physicalMemoryGb ? `${state.physicalMemoryGb} GB de RAM detectados. ` : ''}Não altera o JSON original do jogo.</span></div><select aria-label="Memória Java" value={state.settings.memoryGb} disabled={busy || state.running} onChange={event => save({ memoryGb: Number(event.target.value) })}><option value={0}>Padrão do PZ</option>{[3,4,6,8,12,16,24,32].map(value => <option key={value} value={value}>{value} GB</option>)}</select></div></section>
          <section className="settings-section"><h2>Aparência</h2><div className="setting-row"><strong>Tema</strong><div className="segmented">{[['dark','Escuro'],['light','Claro']].map(([key,label]) => <button key={key} disabled={busy} className={state.settings.theme === key ? 'active' : ''} onClick={() => save({ theme: key })}>{label}</button>)}</div></div><div className="setting-row"><strong>Reduzir animações</strong><Toggle checked={state.settings.reduceMotion} label="Reduzir animações" disabled={busy} onChange={enabled => save({ reduceMotion: enabled })} /></div></section>
          <section className="settings-section"><h2>Cópias dos agentes</h2><div className="setting-row"><div><strong>Pasta local do launcher</strong><span className="path">{state.runtimePath || 'Disponível no aplicativo desktop'}</span></div><Button icon={FolderOpen} className="icon-button" title="Abrir pasta local" aria-label="Abrir pasta local" onClick={() => call('openFolder','runtime')} /></div><div className="setting-row"><div><strong>Remover perfil preparado</strong><span>Não remove mods da Workshop, arquivos vanilla ou saves.</span></div><Button icon={Trash2} tone="danger" disabled={busy || state.running} onClick={() => setModal({ kind: 'remove' })}>Remover JARs</Button></div></section>
        </>}
        {page === 'activity' && <>
          <div className="page-heading"><div><div className="eyebrow">DIAGNÓSTICO LOCAL</div><h1>Atividade</h1></div><Button icon={ArrowDownToLine} onClick={() => setModal({ kind: 'export' })} disabled={busy}>Exportar diagnóstico</Button></div>
          <div className="activity-head"><span>EVENTO</span><span>HORÁRIO</span></div>{state.history.length === 0 ? <div className="empty"><Clock3 size={28} /><h2>Nenhuma atividade nesta sessão</h2></div> : state.history.map(event => <div className={`activity-row ${event.type}`} key={event.id}><span>{event.type === 'success' ? <CheckCircle2 size={17} /> : event.type === 'error' ? <ShieldAlert size={17} /> : <Info size={17} />}{event.message}</span><time>{new Date(event.time).toLocaleTimeString('pt-BR')}</time></div>)}
        </>}
        {page === 'privacy' && <>
          <div className="page-heading"><div><div className="eyebrow">VOCÊ NO CONTROLE</div><h1>Privacidade e Steam</h1></div><ShieldCheck className="privacy-symbol" size={34} /></div>
          <section className="settings-section"><h2>Identidade da sessão</h2><div className="setting-row"><div><strong>{state.auth.status === 'connected' ? 'Identidade confirmada pela Steam' : 'Sem conta vinculada'}</strong><span>{state.auth.steamId ? `SteamID: ${state.auth.steamId}` : 'Login opcional, realizado no navegador padrão.'}</span></div>{state.auth.status === 'connected' ? <Button icon={LogOut} onClick={() => call('logout')}>Desconectar</Button> : <Button icon={ExternalLink} onClick={() => setModal({ kind: 'login' })}>Entrar com Steam</Button>}</div></section>
          <section className="privacy-grid"><div><Fingerprint size={22} /><h2>SteamID só na memória</h2><p>A confirmação OpenID retorna um identificador público. Ele é descartado ao desconectar ou fechar o launcher. Não consultamos nome, avatar, amigos ou biblioteca.</p></div><div><ShieldCheck size={22} /><h2>Credenciais ficam na Steam</h2><p>Senha, Steam Guard e cookies pertencem ao navegador e à Steam. O launcher não mostra uma tela própria para digitar credenciais.</p></div><div><Archive size={22} /><h2>Preferências no computador</h2><p>Caminhos, seleção e hashes dos JARs são salvos localmente. Não há telemetria, upload, serviço em segundo plano ou gravação de voz neste launcher.</p></div><div><ShieldAlert size={22} /><h2>Java requer confiança</h2><p>Agentes podem acessar o computador. O hash identifica o arquivo, mas não prova que ele seja seguro. Instale somente agentes de fontes confiáveis.</p></div></section>
          <div className="inline-notice"><Info size={18} /><p>Login não confirma propriedade do PZ, não configura login dentro do jogo e não restringe acesso ao servidor Organic. Nenhum servidor hospedado é exigido por esta versão.</p></div>
        </>}
      </div>
      <footer className="statusbar"><span>{busy ? <><LoaderCircle className="spin" size={14} />{state.progress || 'Processando...'}</> : <><span className="connection-dot" />{native ? 'Operações locais · sem telemetria' : 'Prévia visual · sem acesso aos arquivos'}</>}</span><span>WINDOWS x64<ChevronRight size={12} />JARs de inicialização</span></footer>
    </main>
    {toast && <div className="toast" role="status"><Info size={18} /><span>{toast}</span><Button icon={X} className="icon-button" aria-label="Fechar aviso" onClick={() => setToast(null)} /></div>}
    {modal?.kind === 'details' && <Modal title={modal.value.name} onClose={() => setModal(null)} footer={<>
      {state.settings.overrides[modal.value.id] && <Button icon={RefreshCw} onClick={async () => { const overrides = { ...state.settings.overrides }; delete overrides[modal.value.id]; await save({ overrides }); setModal(null); }}>Usar busca automática</Button>}
      <Button icon={FolderOpen} onClick={async () => { await call(modal.value.kind === 'agent' ? 'chooseJar' : 'chooseFolder', modal.value.kind === 'agent' ? modal.value.id : 'mods'); setModal(null); }}>{modal.value.kind === 'agent' ? 'Localizar JAR' : 'Localizar pasta'}</Button>{modal.value.workshopId && <Button icon={ExternalLink} onClick={() => call('openWorkshop',modal.value.id)}>Workshop</Button>}
    </>}><Badge status={modal.value.status} /><p className="description">{modal.value.notes}</p><dl className="file-details"><dt>ID do mod</dt><dd>{modal.value.modId}</dd><dt>Build de referência</dt><dd>{modal.value.build} · compatibilidade em jogo requer teste</dd><dt>Origem</dt><dd>{modal.value.source || 'Não encontrado'}</dd><dt>SHA-256</dt><dd className="hash">{modal.value.hash || 'Disponível após localizar o JAR'}</dd></dl>{modal.value.error && <p className="error">{modal.value.error}</p>}</Modal>}
    {(modal?.kind === 'review' || modal?.kind === 'launch') && <Modal title={modal.kind === 'review' ? 'Revisar agentes Java' : 'Revisar inicialização'} large onClose={() => !busy && setModal(null)} footer={<><Button onClick={() => setModal(null)} disabled={busy}>Cancelar</Button><Button icon={modal.kind === 'review' ? ShieldCheck : Play} tone="primary" onClick={confirm} disabled={!consent || busy}>{modal.kind === 'review' ? 'Preparar JARs aprovados' : 'Iniciar com este perfil'}</Button></>}>
      {modal.kind === 'review' ? modal.value.mods.map(mod => <div className="review-file" key={mod.id}><FileCode2 size={20} /><div><strong>{mod.name}<span>{mod.kind === 'agent' ? 'Cópia local do agente' : 'Mantido na Workshop'}</span></strong><p>{mod.source}</p><code>{mod.hash}</code></div></div>) : <><div className="review-file"><Play size={20} /><div><strong>Java do próprio PZ</strong><p>{modal.value.executable}</p></div></div><details className="arguments"><summary>Argumentos de inicialização</summary><pre>{modal.value.args.join('\n')}</pre></details></>}
      {modal.value.warnings.map(warning => <p className="review-warning" key={warning}><Info size={16} />{warning}</p>)}<label className="consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />Revisei os arquivos e autorizo esta operação local.</label>
    </Modal>}
    {modal?.kind === 'login' && <Modal title="Entrar com Steam" onClose={() => setModal(null)} footer={<><Button onClick={() => setModal(null)}>Cancelar</Button><Button icon={ExternalLink} tone="primary" disabled={busy || state.auth.status === 'pending'} onClick={async () => { const value = await call('login'); if (value) setModal(null); }}>Abrir Steam no navegador</Button></>}><div className="login-icon"><CircleUserRound size={36} /></div><p className="description">Você confirma o login em <strong>steamcommunity.com</strong>. O launcher recebe somente seu SteamID validado e mantém esse identificador na memória desta sessão.</p><p className="description">Não digite sua senha aqui. Nenhum nome, avatar, cookie ou token de sessão será solicitado ou salvo pelo launcher. O login é opcional.</p>{state.auth.status === 'pending' && <Button icon={X} onClick={() => call('logout')}>Cancelar login pendente</Button>}</Modal>}
    {modal?.kind === 'remove' && <Modal title="Remover JARs preparados?" onClose={() => setModal(null)} footer={<><Button onClick={() => setModal(null)}>Cancelar</Button><Button icon={Trash2} tone="danger" onClick={async () => { await call('remove'); setModal(null); }}>Remover cópias locais</Button></>}><p className="description">Somente a pasta runtime e o registro de preparação deste launcher serão removidos. Os mods da Workshop, o PZ e seus saves permanecem intactos.</p></Modal>}
    {modal?.kind === 'export' && <Modal title="Exportar diagnóstico" onClose={() => setModal(null)} footer={<><Button onClick={() => setModal(null)}>Cancelar</Button><Button icon={ArrowDownToLine} onClick={async () => { await call('exportDiagnostics'); setModal(null); }}>Escolher destino</Button></>}><p className="description">A exportação inclui caminhos dos arquivos, hashes e eventos desta sessão. Os caminhos podem conter seu nome de usuário do Windows. Não inclui SteamID, credenciais ou logs do jogo. Revise o arquivo antes de compartilhar.</p></Modal>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
