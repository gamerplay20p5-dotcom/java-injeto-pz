import React, { useEffect, useRef, useState } from 'react';
import { Home, Package, Wrench, Gauge, DatabaseBackup, Settings, Info, FolderOpen, Search, FileCheck2, Download,
  RotateCcw, CheckCircle2, ShieldCheck, Copy, ChevronRight, X, RefreshCw, Plus, Trash2, ExternalLink,
  Cpu, MemoryStick, HardDrive, Monitor, LoaderCircle, Power, ArrowUpRight, Bell } from 'lucide-react';
import catalog from '../../catalog.json';
import logo from '../../assets/Logo_Organic.png';

const native = Boolean(window.organic);
const defaults = { profile: 'balanced', memoryAuto: true, jvm: true, priority: false, power: false, monitor: false };
const initial = { version: '0.3.0', settings: { gamePath: null, steamPath: null, modRoots: [], overrides: {}, selected: [], memoryGb: 0, theme: 'dark', reduceMotion: false, checkUpdates: false, optimizer: defaults },
  mods: catalog.mods.map(mod => ({ ...mod, status: 'missing' })), libraries: [], busy: null, progress: '', game: null, history: [],
  injection: { status: 'none' }, optimizer: { status: 'idle' }, update: { status: 'idle' }, hardware: null, auth: { status: 'offline' } };
const labels = { missing: ['Não encontrado', 'muted'], found: ['Revisão pendente', 'amber'], ready: ['Pronto', 'green'], changed: ['Revisão pendente', 'amber'], invalid: ['Erro', 'red'], injected: ['Injetado', 'green'] };
const nav = [['home', Home, 'Início'], ['jars', Package, 'Mod JAR'], ['injection', Wrench, 'Injeção'], ['optimizer', Gauge, 'Otimizador'], ['backup', DatabaseBackup, 'Backup'], ['settings', Settings, 'Configurações'], ['about', Info, 'Sobre']];
const profiles = [['balanced', 'Equilibrado'], ['performance', 'Desempenho'], ['economy', 'Econômico']];

function Button({ icon: Icon, children, primary, danger, compact, ...props }) {
  return <button className={`button ${primary ? 'primary' : ''} ${danger ? 'danger' : ''} ${compact ? 'icon-button' : ''}`} {...props}>{Icon && <Icon size={15} />}{children}</button>;
}
function Toggle({ label, checked, onChange, disabled }) {
  return <button type="button" className={`toggle ${checked ? 'checked' : ''}`} role="switch" aria-label={label} aria-checked={Boolean(checked)} onClick={() => onChange(!checked)} disabled={disabled}><span /></button>;
}
function Badge({ status }) { const value = labels[status] || labels.missing; return <span className={`badge ${value[1]}`}><i />{value[0]}</span>; }
function Modal({ title, onClose, children, footer, wide }) {
  const element = useRef(), close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement; element.current?.querySelector('button')?.focus();
    function key(event) {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab') return;
      const controls = [...element.current.querySelectorAll('button:not(:disabled),input,select,[tabindex="0"]')];
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
    }
    document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="modal-shade"><section className={`modal ${wide ? 'wide' : ''}`} ref={element} role="dialog" aria-modal="true" aria-label={title}>
    <header><h2>{title}</h2><Button compact icon={X} title="Fechar" aria-label="Fechar" onClick={onClose} /></header><div className="modal-body">{children}</div><footer>{footer}</footer>
  </section></div>;
}

export default function App() {
  const [state, setState] = useState(initial), [page, setPage] = useState('home'), [action, setAction] = useState(null), [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null), [consent, setConsent] = useState(false), [search, setSearch] = useState(''), [detailId, setDetailId] = useState('skinwalker');
  const hardwareAttempted = useRef(false);
  const busy = Boolean(action || state.busy), selected = state.mods.filter(mod => mod.selected), detail = state.mods.find(mod => mod.id === detailId) || state.mods[0];
  const preference = state.settings.optimizer || defaults;
  const workshop = state.workshopPath || state.settings.modRoots[0] || null;
  const activeMonitor = ['watching', 'active', 'stopping'].includes(state.optimizer?.status);
  const update = state.update || { status: 'idle' };
  useEffect(() => {
    if (!native) return;
    let mounted = true;
    window.organic.getState().then(value => mounted && setState(value)).catch(error => setToast(error.message));
    const unsubscribe = window.organic.subscribe(value => mounted && setState(value));
    const unsubscribeUpdate = window.organic.subscribeUpdate(value => mounted && setState(current => ({ ...current, update: value })));
    return () => { mounted = false; unsubscribe(); unsubscribeUpdate(); };
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = state.settings.theme; document.documentElement.dataset.motion = state.settings.reduceMotion ? 'reduced' : 'full'; }, [state.settings.theme, state.settings.reduceMotion]);
  useEffect(() => { document.querySelector('.workspace')?.scrollTo(0, 0); }, [page]);
  useEffect(() => {
    if (page !== 'optimizer') { hardwareAttempted.current = false; return; }
    if (native && !state.hardware && !busy && !hardwareAttempted.current) { hardwareAttempted.current = true; void call('hardware'); }
  }, [page, state.hardware, busy]);
  async function call(method, ...args) {
    if (!native) { setToast('Disponível no aplicativo desktop.'); return null; }
    setAction(method); setToast(null);
    try {
      const value = await window.organic[method](...args);
      if (method === 'createShortcut') setToast('Atalho Java Injeto criado na área de trabalho.');
      return value;
    } catch (error) { setToast(error.message); return null; } finally { setAction(null); }
  }
  async function save(patch) {
    if (!native) { setState(current => ({ ...current, settings: { ...current.settings, ...patch } })); return; }
    const value = await call('saveSettings', { ...state.settings, ...patch }); if (value) setState(value);
  }
  async function saveOptimizer(patch) { await save({ optimizer: { ...preference, ...patch } }); }
  function open(value) { setConsent(false); setModal(value); }
  async function review() { const value = await call('review'); if (value) open({ kind: 'prepare', value }); }
  async function inject() {
    if (selected.some(mod => mod.status !== 'ready')) { setToast('Revise e prepare os JARs selecionados antes da injeção.'); await review(); return; }
    const value = await call('reviewInjection'); if (value) open({ kind: 'inject', value });
  }
  async function confirm() {
    const kind = modal.kind;
    const value = await call(kind === 'prepare' ? 'apply' : 'inject', modal.value.token);
    if (value) { setModal(null); setToast(kind === 'prepare' ? 'JARs revisados e copiados. Prontos para injetar.' : 'Java posicionado com sucesso. Configuração aplicada com backup.'); }
  }
  function status(mod) { return mod.kind === 'agent' && state.injection.status === 'injected' && mod.status === 'ready' && state.injection.modHashes?.[mod.id] === mod.hash ? 'injected' : mod.status; }
  async function copy(text) { if (text && await call('copyText', text)) setToast('Copiado.'); }
  function updates() {
    const text = { idle: 'Verificação manual', checking: 'Consultando GitHub', current: 'Você está na versão mais recente',
      available: `Nova versão: ${update.release?.version}`, downloading: 'Baixando atualização', downloaded: 'Instalador verificado', installing: 'Abrindo instalador', error: 'Atualização não concluída' };
    return <section className="unframed"><div className="section-title"><RefreshCw size={17} /><h2>Atualizações</h2><span>v{state.version}</span></div>
      <div className="setting-row"><div><strong>Verificar ao abrir</strong><span>Consulta releases públicas do GitHub. Nunca instala automaticamente.</span></div><Toggle label="Verificar atualizações ao abrir" checked={state.settings.checkUpdates} disabled={busy} onChange={value => save({ checkUpdates: value })} /></div>
      <div className="setting-row"><div><strong>{text[update.status]}</strong><span>{update.release ? `${(update.release.size / 1024 ** 2).toFixed(1)} MB / SHA-256 obrigatório` : 'Somente o Java Injeto. Mods continuam sendo atualizados pela Workshop.'}</span></div><Button icon={RefreshCw} disabled={busy} onClick={() => call('checkUpdate')}>Verificar atualização</Button></div>
      {update.status === 'downloading' && <div className="setting-row"><progress aria-label="Download da atualização" value={update.received || 0} max={update.release?.size || 1} /><Button icon={X} onClick={() => call('cancelUpdate')}>Cancelar download</Button></div>}
      {update.error && <p className="error">{update.error}</p>}
      {['available','downloaded'].includes(update.status) && <Button primary icon={Download} disabled={busy} onClick={() => open({ kind: 'update', value: update })}>{update.status === 'downloaded' ? 'Instalar atualização' : 'Baixar atualização'}</Button>}
    </section>;
  }
  function paths() {
    return <div className="paths"><div className="path-row"><FolderOpen size={20} /><div><h3>Project Zomboid</h3><code title={state.game?.path}>{state.game?.path || 'Pasta não localizada'}</code></div><Badge status={state.game ? 'ready' : 'missing'} /><Button compact icon={FolderOpen} title="Abrir pasta do jogo" aria-label="Abrir pasta do jogo" disabled={!state.game} onClick={() => call('openFolder', 'game')} /></div>
      <div className="path-row"><Package size={20} /><div><h3>Workshop / Mods</h3><code title={workshop}>{workshop || 'Configure uma pasta de mods'}</code></div><Button compact icon={Settings} title="Configurar pastas" aria-label="Configurar pastas" onClick={() => setPage('settings')} /><Button compact icon={FolderOpen} title="Abrir pasta da Workshop" aria-label="Abrir pasta da Workshop" disabled={!workshop} onClick={() => call('openFolder', 'workshop')} /></div></div>;
  }
  function actions() { return <div className="actions"><Button icon={Search} disabled={busy} onClick={() => call('scan')}>Verificar pastas</Button><Button icon={FileCheck2} disabled={busy || !selected.length} onClick={review}>Revisar JAR</Button><Button primary icon={Download} disabled={busy || !state.game || !selected.length} onClick={inject}>Injetar agora</Button><Button icon={RotateCcw} disabled={busy || !['injected', 'changed'].includes(state.injection.status)} onClick={() => open({ kind: 'restore' })}>Restaurar backup</Button></div>; }
  function components() {
    const filtered = state.mods.filter(mod => `${mod.name} ${mod.jarName}`.toLowerCase().includes(search.toLowerCase()));
    return <section className="components"><div className="section-title"><Package size={17} /><h2>Componentes Java</h2><span>{state.mods.length} itens</span></div>
      {page === 'jars' && <label className="search"><Search size={15} /><input placeholder="Filtrar componentes" aria-label="Filtrar componentes" value={search} onChange={event => setSearch(event.target.value)} /></label>}
      <div className="table-wrap"><table><thead><tr><th>Nome</th><th>Tipo</th><th>Status</th><th>Versão</th><th>Ação</th></tr></thead><tbody>{filtered.map(mod => <tr key={mod.id} className={mod.id === detailId ? 'selected' : ''} onClick={() => setDetailId(mod.id)}>
        <td><strong>{mod.name}</strong><span className="filename">{mod.jarName}</span></td><td>{mod.kind === 'agent' ? 'Agente Java' : 'Biblioteca'}</td><td><Badge status={status(mod)} /></td><td>{mod.version || '—'}</td>
        <td><div className="row-actions"><Toggle label={`Selecionar ${mod.name}`} checked={mod.selected} disabled={busy || mod.automatic} onChange={enabled => save({ selected: enabled ? [...state.settings.selected, mod.id] : state.settings.selected.filter(id => id !== mod.id) })} /><Button compact icon={Info} title={`Detalhes de ${mod.name}`} aria-label={`Detalhes de ${mod.name}`} onClick={() => open({ kind: 'details', value: mod })} /></div></td>
      </tr>)}</tbody></table></div></section>;
  }
  function security() { return <section className="tool-card"><div className="section-title"><ShieldCheck size={17} /><h2>Segurança e integridade</h2></div><div className="current-component">{detail.name}</div><dl>
    <dt>SHA-256</dt><dd className="hash"><code title={detail.hash}>{detail.hash ? `${detail.hash.slice(0, 9)}…${detail.hash.slice(-9)}` : 'Pendente'}</code><Button compact icon={Copy} title="Copiar SHA-256" aria-label="Copiar SHA-256" disabled={!detail.hash} onClick={() => copy(detail.hash)} /></dd>
    <dt>Manifesto JAR</dt><dd className={detail.manifest ? 'text-green' : ''}>{detail.manifest ? 'Validado' : 'Pendente'}</dd><dt>Assinatura</dt><dd>{detail.signature || 'Não verificada'}</dd><dt>Risco</dt><dd className="text-amber">Acesso do usuário</dd></dl></section>; }
  function destination() { return <section className="tool-card"><div className="section-title"><Download size={17} /><h2>Destino de injeção</h2></div><span className="meta">{detail.kind === 'agent' ? 'Cópia isolada do agente' : 'Biblioteca mantida na Workshop'}</span><code className="destination" title={detail.installed || detail.source}>{detail.installed || (detail.kind === 'workshop' ? detail.source : state.runtimePath) || 'Disponível após revisão'}</code><div className="config-target"><span>Configuração</span><code>ProjectZomboid64.json</code></div></section>; }

  return <div className="app-shell"><aside className="sidebar"><div className="brand"><img src={logo} alt="Organic Duck" /><div><strong>Java Injeto</strong><span>Injector Utility</span></div></div><nav aria-label="Navegação">{nav.map(([id, Icon, text]) => <button key={id} aria-label={text} title={text} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><Icon size={17} /><span>{text}</span>{page === id && <ChevronRight size={12} />}</button>)}</nav><div className="sidebar-footer"><span className="local-dot" />LOCAL / WINDOWS<span>v{state.version}</span></div></aside>
    <div className="main"><header className="topbar"><div><strong>{nav.find(item => item[0] === page)?.[2]}</strong><span>Java Injeto / Organic</span></div><div className="top-actions"><Button compact icon={ArrowUpRight} title="Criar atalho na área de trabalho" aria-label="Criar atalho na área de trabalho" onClick={() => call('createShortcut')} /><Button compact icon={FolderOpen} title="Localizar executável" aria-label="Localizar executável" onClick={() => call('openFolder', 'executable')} /></div></header>
      <main className="workspace">
        {['home', 'jars', 'injection'].includes(page) && <>{page === 'home' && paths()}{actions()}<div className="main-grid"><div>{components()}{state.profileError && <p className="error">{state.profileError}</p>}{state.injection.status === 'injected' && <div className="success"><CheckCircle2 size={25} /><div><strong>Java posicionado com sucesso</strong><span>Agentes copiados para o destino revisado. Configuração aplicada com backup.</span></div><Button icon={Info} onClick={() => setPage('backup')}>Detalhes</Button></div>}
          {page === 'injection' && <section className="unframed"><h2>Arquivos preparados</h2>{selected.map(mod => <div className="file-line" key={mod.id}><FileCheck2 size={16} /><div><strong>{mod.name}</strong><code>{mod.installed || 'Revisão pendente'}</code></div></div>)}</section>}
          <div className="activity"><div className="section-title"><Bell size={16} /><h2>Últimas operações</h2><Button compact icon={Download} title="Exportar diagnóstico" aria-label="Exportar diagnóstico" onClick={() => open({ kind: 'export' })} /></div>{state.history.slice(0, 4).map(event => <div className={`event ${event.type}`} key={event.id}><span>{event.message}</span><time>{new Date(event.time).toLocaleTimeString('pt-BR')}</time></div>)}{!state.history.length && <p className="meta">Sem operações nesta sessão.</p>}</div></div><aside className="details-column">{security()}{destination()}</aside></div></>}

        {page === 'optimizer' && <>
          <div className="page-heading"><h1>Otimizador</h1><Button icon={RefreshCw} disabled={busy} onClick={() => call('hardware')}>Atualizar hardware</Button></div>
          <div className="hardware">{[[Cpu, 'CPU', state.hardware?.cpu], [Monitor, 'GPU', state.hardware?.gpus?.join(' / ')], [MemoryStick, 'RAM', state.hardware ? `${state.hardware.ramGb} GB` : null], [HardDrive, 'Disco', state.hardware?.disks?.join(' / ')]].map(([Icon, label, value]) => <div key={label}><Icon size={18} /><span>{label}</span><strong>{value || (busy ? 'Detectando…' : 'Não identificado')}</strong></div>)}</div>
          <section className="unframed"><div className="section-title"><Gauge size={17} /><h2>Perfil de otimização</h2></div><div className="profile-controls"><div className="segmented">{profiles.map(([id, label]) => <button disabled={busy || activeMonitor} className={preference.profile === id ? 'active' : ''} key={id} onClick={() => saveOptimizer({ profile: id })}>{label}</button>)}</div><div className="recommendation"><span>Java recomendado</span><strong>{state.recommendedGb ? `${state.recommendedGb} GB` : 'Padrão do jogo'}</strong></div></div></section>
          <div className="optimizer-grid"><section className="unframed"><h2>Configuração Java</h2>{[['memoryAuto', 'Memória Java automática', 'Limite calculado com reserva para Windows e memória nativa.'], ['jvm', 'Parâmetros JVM', 'Heap adaptativo no ZGC; mantém o coletor e as flags do jogo.']].map(([key, label, description]) => <div className="setting-row" key={key}><div><strong>{label}</strong><span>{description}</span></div><Toggle label={label} checked={preference[key]} disabled={busy} onChange={value => saveOptimizer({ [key]: value })} /></div>)}
            {!preference.memoryAuto && <div className="setting-row"><strong>Memória Java</strong><select aria-label="Memória Java" value={state.settings.memoryGb} onChange={event => save({ memoryGb: Number(event.target.value) })}><option value={0}>Padrão</option>{[2,3,4,6,8,12,16,24,32].map(value => <option key={value} value={value}>{value} GB</option>)}</select></div>}
            <Button icon={FileCheck2} disabled={busy || !state.game} onClick={inject}>Aplicar configuração JVM</Button></section>
            <section className="unframed"><h2>Sessão temporária</h2>{[['priority', 'Prioridade do processo', 'Aplica somente ao cliente PZ detectado. Nunca usa tempo real.'], ['power', 'Perfil de energia temporário', 'Ativo durante a partida, na tomada; restaurado ao encerrar.'], ['monitor', 'Monitoramento de RAM', 'Amostragem de 10 segundos, sem purgar memória do jogo.']].map(([key, label, description]) => <div className="setting-row" key={key}><div><strong>{label}</strong><span>{description}</span></div><Toggle label={label} checked={preference[key]} disabled={busy || activeMonitor} onChange={value => saveOptimizer({ [key]: value })} /></div>)}
            <div className="inline-actions"><Button icon={Power} disabled={busy || !state.game || activeMonitor || ![preference.priority,preference.power,preference.monitor].some(Boolean)} onClick={() => call('startOptimizer')}>Ativar em segundo plano</Button><Button icon={RotateCcw} disabled={busy} onClick={() => call('stopOptimizer')}>Restaurar sessão</Button></div></section></div>
          <div className="monitor-band"><span className={`local-dot ${activeMonitor ? 'on' : ''}`} /><strong>{state.optimizer?.status === 'active' ? 'PZ detectado' : activeMonitor ? 'Aguardando o jogo' : 'Monitor inativo'}</strong><span>RAM livre: {state.optimizer?.availableGb ?? state.hardware?.availableGb ?? '—'} GB</span><span>PZ: {state.optimizer?.gameMb ?? '—'} MB</span>{state.optimizer?.pressure && <span className="text-amber">Pressão de memória</span>}</div>{state.optimizer?.warning && <p className="error">{state.optimizer.warning}</p>}
          <section className="unframed"><div className="section-title"><MemoryStick size={17} /><h2>Processos em segundo plano</h2></div><div className="setting-row"><div><strong>Redução seletiva</strong><span>Solicita fechar apenas o aplicativo escolhido, sem encerramento forçado. Salve documentos antes.</span></div><Button icon={Search} disabled={busy} onClick={async () => { const value = await call('backgroundProcesses'); if (value) open({ kind: 'processes', value }); }}>Selecionar aplicativos</Button></div></section>
          <div className="inline-actions"><Button icon={RotateCcw} disabled={busy || activeMonitor} onClick={() => open({ kind: 'optimizer-reset' })}>Restaurar padrão</Button><span className="meta">O utilitário não inicia o jogo. Ajustes JVM exigem aplicação; sessão nativa funciona sem a janela.</span></div>
        </>}

        {page === 'backup' && <><div className="page-heading"><h1>Backup e restauração</h1><Button icon={FolderOpen} onClick={() => call('openFolder', 'backups')}>Abrir backups</Button></div><section className="unframed"><dl className="backup-details"><dt>Estado</dt><dd>{({ none: 'Nenhuma injeção', injected: 'Injeção ativa', changed: 'Alterado externamente', restored: 'Restaurado', error: 'Erro no registro' })[state.injection.status]}</dd><dt>Arquivo original</dt><dd><code>{state.injection.backupPath || 'Sem backup'}</code></dd><dt>SHA-256 original</dt><dd><code>{state.injection.originalHash || '—'}</code></dd><dt>Data</dt><dd>{state.injection.createdAt ? new Date(state.injection.createdAt).toLocaleString('pt-BR') : '—'}</dd></dl>
          <div className="inline-actions"><Button primary icon={RotateCcw} disabled={busy || !['injected','changed'].includes(state.injection.status)} onClick={() => open({ kind: 'restore' })}>Restaurar backup</Button><Button icon={Trash2} disabled={busy || !['none', 'restored'].includes(state.injection.status)} onClick={() => open({ kind: 'remove' })}>Remover cópias Java</Button></div>{state.injection.error && <p className="error">{state.injection.error}</p>}</section><p className="meta">Mudanças externas no JSON bloqueiam a restauração automática para não sobrescrever sua configuração. Saves e mods da Workshop não são apagados.</p></>}

        {page === 'settings' && <><div className="page-heading"><h1>Configurações</h1></div><section className="unframed"><h2>Pastas</h2>{[['game','Project Zomboid',state.game?.path || state.settings.gamePath], ['steam','Biblioteca Steam',state.settings.steamPath]].map(([id, label, value]) => <div className="setting-row" key={id}><div><strong>{label}</strong><code>{value || 'Detecção automática'}</code></div><Button icon={FolderOpen} disabled={busy} onClick={() => call('chooseFolder', id)}>Selecionar</Button></div>)}
          <div className="setting-row"><strong>Pastas adicionais de mods</strong><Button icon={Plus} disabled={busy} onClick={() => call('chooseFolder','mods')}>Adicionar pasta</Button></div>{state.settings.modRoots.map(root => <div className="setting-row" key={root}><code>{root}</code><Button compact icon={X} title="Remover pasta" aria-label="Remover pasta" disabled={busy} onClick={() => save({ modRoots: state.settings.modRoots.filter(item => item !== root) })} /></div>)}</section>
          <section className="unframed"><h2>Interface</h2><div className="setting-row"><strong>Tema</strong><div className="segmented">{[['dark','Escuro'],['light','Claro']].map(([id, label]) => <button key={id} className={state.settings.theme === id ? 'active' : ''} disabled={busy} onClick={() => save({ theme: id })}>{label}</button>)}</div></div><div className="setting-row"><strong>Reduzir animações</strong><Toggle label="Reduzir animações" checked={state.settings.reduceMotion} disabled={busy} onChange={value => save({ reduceMotion: value })} /></div></section><div className="inline-actions"><Button icon={ArrowUpRight} onClick={() => call('createShortcut')}>Criar atalho na área de trabalho</Button><Button icon={FolderOpen} onClick={() => call('openFolder','executable')}>Localizar executável</Button></div></>}

        {page === 'settings' && updates()}
        {page === 'about' && <><div className="about-brand"><img src={logo} alt="Organic Duck" /><div><h1>Java Injeto</h1><span>Injector Utility / v{state.version}</span></div></div><section className="unframed"><h2>Organic / DuckStudio</h2><p>Utilitário local para revisão, injeção reversível de agentes Java e otimização do cliente PZ. Não abre o jogo. Os mods completos continuam na Workshop.</p><p>O Otimizador usa um auxiliar C# para hardware, prioridade e energia temporária. Ganhos de desempenho dependem do hardware, dos mods e da carga do jogo.</p></section><section className="unframed"><h2>Steam e privacidade</h2><p>Login opcional no navegador oficial. SteamID apenas na memória da sessão; sem senha, Steam Guard, telemetria ou gravação de voz pelo utilitário.</p><div className="inline-actions"><Button icon={ExternalLink} disabled={busy} onClick={() => state.auth.status === 'connected' ? call('logout') : open({ kind: 'login' })}>{state.auth.status === 'connected' ? 'Desconectar Steam' : 'Entrar com Steam'}</Button><span className="meta">{state.auth.status === 'connected' ? 'Identidade confirmada' : 'Sem conta vinculada'}</span></div></section><p className="meta">Código MIT. Project Zomboid: The Indie Stone. Steam: Valve. ZombieBuddy: zed-0xff e colaboradores. Viewpoint: autores da publicação original. Sem afiliação oficial.</p></>}
      </main><footer className="statusbar"><span>{busy ? <><LoaderCircle size={13} className="spin" />{state.progress || 'Processando…'}</> : <><span className="local-dot" />Operações locais</>}</span><span>Windows x64 / sem abertura do jogo</span></footer>
    </div>
    {toast && <div className="toast" role="status"><Info size={16} /><span>{toast}</span><Button compact icon={X} aria-label="Fechar aviso" title="Fechar aviso" onClick={() => setToast(null)} /></div>}
    {modal?.kind === 'details' && <Modal title={modal.value.name} onClose={() => setModal(null)} footer={<><Button icon={FolderOpen} onClick={async () => { await call(modal.value.kind === 'agent' ? 'chooseJar' : 'chooseFolder', modal.value.kind === 'agent' ? modal.value.id : 'mods'); setModal(null); }}>{modal.value.kind === 'agent' ? 'Localizar JAR' : 'Localizar pasta'}</Button>{state.settings.overrides[modal.value.id] && <Button icon={RefreshCw} onClick={async () => { const overrides = { ...state.settings.overrides }; delete overrides[modal.value.id]; await save({ overrides }); setModal(null); }}>Usar busca automática</Button>}{modal.value.workshopId && <Button icon={ExternalLink} onClick={() => call('openWorkshop',modal.value.id)}>Workshop</Button>}</>}><Badge status={status(modal.value)} /><p>{modal.value.notes}</p><dl className="file-details"><dt>Origem</dt><dd><code>{modal.value.source || 'Não encontrado'}</code></dd><dt>Versão</dt><dd>{modal.value.version || 'Não declarada no manifesto'}</dd><dt>SHA-256</dt><dd><code>{modal.value.hash || 'Pendente'}</code></dd><dt>Premain</dt><dd><code>{modal.value.premain || 'Biblioteca / framework'}</code></dd></dl>{modal.value.error && <p className="error">{modal.value.error}</p>}</Modal>}
    {['prepare','inject'].includes(modal?.kind) && <Modal wide title={modal.kind === 'prepare' ? 'Revisar JAR' : 'Confirmar injeção'} onClose={() => !busy && setModal(null)} footer={<><Button disabled={busy} onClick={() => setModal(null)}>Cancelar</Button><Button primary icon={modal.kind === 'prepare' ? FileCheck2 : Download} disabled={busy || !consent} onClick={confirm}>{modal.kind === 'prepare' ? 'Preparar JARs' : 'Injetar agora'}</Button></>}>
      {modal.kind === 'prepare' ? modal.value.mods.map(mod => <div className="review-file" key={mod.id}><strong>{mod.name}</strong><code>{mod.source}</code><code>SHA-256: {mod.hash}</code><span className="meta">Destino: {mod.installed}</span>{mod.native && <><strong>DLL oficial Windows x64</strong><code>{mod.native.source}</code><code>SHA-256: {mod.native.hash}</code></>}</div>) : <><div className="review-file"><strong>Configuração com backup</strong><code>{modal.value.target}</code><span className="meta">Backup: {modal.value.backup}</span></div>{modal.value.destinations.map(mod => <div className="review-file" key={mod.name}><strong>{mod.name}</strong><code>{mod.path}</code></div>)}</>}
      {modal.value.warnings.map(warning => <p className="review-warning" key={warning}><Info size={14} />{warning}</p>)}<label className="consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />Revisei os arquivos e autorizo a alteração local.</label></Modal>}
    {modal?.kind === 'restore' && <Modal title="Restaurar backup?" onClose={() => setModal(null)} footer={<><Button onClick={() => setModal(null)}>Cancelar</Button><Button primary icon={RotateCcw} disabled={busy} onClick={async () => { const value = await call('restore'); if (value) setModal(null); }}>Restaurar</Button></>}><p>O JSON e os arquivos nativos gerenciados voltam ao estado original. DLL/JAR sem cópia anterior são removidos da raiz do PZ. Alterações externas bloqueiam a restauração para preservar seus arquivos.</p></Modal>}
    {modal?.kind === 'update' && <Modal title={`Atualizar para ${modal.value.release.version}?`} onClose={() => !busy && setModal(null)} footer={<><Button disabled={busy} onClick={() => setModal(null)}>Cancelar</Button><Button primary icon={Download} disabled={busy} onClick={async () => {
      const value = await call(modal.value.status === 'downloaded' ? 'installUpdate' : 'downloadUpdate', modal.value.token);
      if (value) setModal(null);
    }}>{modal.value.status === 'downloaded' ? 'Fechar e instalar' : 'Confirmar download'}</Button></>}>
      <p>Origem: GitHub / gamerplay20p5-dotcom/java-injeto-pz.</p><dl className="file-details"><dt>Versão</dt><dd>{modal.value.release.version}</dd><dt>Tamanho</dt><dd>{(modal.value.release.size / 1024 ** 2).toFixed(1)} MB</dd><dt>SHA-256</dt><dd><code>{modal.value.release.hash}</code></dd></dl>
      <p>O aplicativo será fechado ao instalar. Configurações, backups e cópias Java serão preservados. O jogo não será iniciado. Sem assinatura digital: o hash verifica integridade, não certifica a segurança.</p>{state.portable && <p>Você usa a edição portátil. O instalador criará a edição instalada e seu atalho, mantendo os mesmos dados locais. A cópia portátil antiga não será substituída.</p>}
    </Modal>}
    {modal?.kind === 'optimizer-reset' && <Modal title="Restaurar padrão do Otimizador?" onClose={() => !busy && setModal(null)} footer={<><Button disabled={busy} onClick={() => setModal(null)}>Cancelar</Button><Button primary icon={RotateCcw} disabled={busy || state.injection.status === 'error'} onClick={async () => {
      if (['injected', 'changed'].includes(state.injection.status) && !await call('restore')) return;
      const value = await call('saveSettings', { ...state.settings, memoryGb: 0, optimizer: defaults });
      if (value) { setState(value); setModal(null); setToast('Configuração original restaurada. Preferências redefinidas.'); }
    }}>Restaurar</Button></>}><p>Redefine as opções do Otimizador e, se houver injeção ativa, restaura o JSON original. Isso também remove a ativação dos agentes Java; as cópias continuam disponíveis para uma nova injeção. Mudanças externas bloqueiam a restauração automática.</p></Modal>}
    {modal?.kind === 'remove' && <Modal title="Remover cópias Java?" onClose={() => setModal(null)} footer={<><Button onClick={() => setModal(null)}>Cancelar</Button><Button danger icon={Trash2} disabled={busy} onClick={async () => { await call('remove'); setModal(null); }}>Remover</Button></>}><p>Remove somente o runtime preparado. Mods, jogo e backups permanecem preservados.</p></Modal>}
    {modal?.kind === 'export' && <Modal title="Exportar diagnóstico" onClose={() => setModal(null)} footer={<Button icon={Download} onClick={async () => { await call('exportDiagnostics'); setModal(null); }}>Escolher destino</Button>}><p>Inclui caminhos, hashes e operações locais. Os caminhos podem conter seu nome de usuário Windows. Não inclui SteamID, credenciais ou logs do jogo.</p></Modal>}
    {modal?.kind === 'login' && <Modal title="Entrar com Steam" onClose={() => setModal(null)} footer={<Button primary icon={ExternalLink} disabled={busy || state.auth.status === 'pending'} onClick={async () => { const value = await call('login'); if (value) setModal(null); }}>Abrir Steam no navegador</Button>}><p>Confirme somente em steamcommunity.com. Nenhuma senha ou Steam Guard é solicitado neste aplicativo. Login é opcional.</p></Modal>}
    {modal?.kind === 'processes' && <Modal title="Aplicativos em segundo plano" onClose={() => setModal(null)} footer={<Button onClick={() => setModal(null)}>Fechar</Button>}><p>Salve seus documentos. A solicitação usa o fechamento normal do Windows, sem forçar encerramento.</p>{modal.value.processes.map(process => <div className="setting-row" key={process.pid}><div><strong>{process.name}</strong><span>PID {process.pid} / {process.memoryMb} MB</span></div><Button icon={X} onClick={() => open({ kind: 'close-process', value: process })}>Solicitar fechamento</Button></div>)}{!modal.value.processes.length && <p className="meta">Nenhum aplicativo permitido com janela aberta.</p>}</Modal>}
    {modal?.kind === 'close-process' && <Modal title={`Fechar ${modal.value.name}?`} onClose={() => setModal(null)} footer={<><Button onClick={() => setModal(null)}>Cancelar</Button><Button danger icon={X} onClick={async () => { const value = await call('closeBackground', modal.value); if (value) { setToast(value.requested ? 'Solicitação de fechamento enviada.' : 'O aplicativo não aceitou a solicitação.'); setModal(null); } }}>Solicitar fechamento</Button></>}><p>Confirme que seus documentos estão salvos. O utilitário não força o encerramento nem fecha processos do jogo.</p></Modal>}
  </div>;
}
