// =============================================
// MetaDesk — App Principal
// =============================================

const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const COLORS = ['#4f46e5','#1877f2','#22c55e','#ec4899','#f59e0b','#ef4444','#7c3aed','#06b6d4'];
let clients = [];
let currentClient = null;
let currentView = 'overview';
let currentDateRange = '30';
let charts = [];

// ─── AUTH ──────────────────────────────────────────────────────────

async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  const err   = document.getElementById('loginError');
  err.style.display = 'none';
  const { error } = await db.auth.signInWithPassword({ email, password: pass });
  if (error) { err.textContent = error.message; err.style.display = 'block'; return; }
}

async function register() {
  const email = document.getElementById('regEmail').value.trim();
  const pass  = document.getElementById('regPassword').value;
  const err   = document.getElementById('loginError');
  err.style.display = 'none';
  const { error } = await db.auth.signUp({ email, password: pass });
  if (error) { err.textContent = error.message; err.style.display = 'block'; return; }
  err.className = 'alert-success';
  err.textContent = 'Conta criada! Verifique seu e-mail para confirmar.';
  err.style.display = 'block';
}

async function logout() { await db.auth.signOut(); }

function showRegister() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
}
function showLogin() {
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
}

db.auth.onAuthStateChange((event, session) => {
  if (session) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('userEmail').textContent = session.user.email;
    loadClients();
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }
});

// ─── CLIENTS ───────────────────────────────────────────────────────

async function loadClients() {
  const { data, error } = await db.from('clients').select('*').order('created_at');
  if (error) { console.error(error); return; }
  clients = data || [];
  renderSidebar();
  if (clients.length === 0) {
    document.getElementById('mainContent').innerHTML = `
      <div class="empty-state">
        <div style="font-size:48px; margin-bottom:16px">🚀</div>
        <div style="font-size:16px; font-weight:500; margin-bottom:8px">Nenhum cliente ainda</div>
        <div style="font-size:13px; color:var(--muted); margin-bottom:24px">Adicione seu primeiro cliente para começar</div>
        <button class="btn-primary" onclick="openModal('addClientModal')">Adicionar cliente</button>
      </div>`;
  }
}

async function addClient() {
  const name   = document.getElementById('inputName').value.trim();
  const sector = document.getElementById('inputSector').value.trim();
  const token  = document.getElementById('inputToken').value.trim();
  const adAcct = document.getElementById('inputAdAccount').value.trim();
  const pageId = document.getElementById('inputPageId').value.trim();
  const errEl  = document.getElementById('addClientError');
  const btn    = document.getElementById('addClientBtn');

  errEl.style.display = 'none';
  if (!name || !token) { errEl.textContent = 'Nome e token são obrigatórios.'; errEl.style.display = 'block'; return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${token}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
  } catch(e) {
    errEl.textContent = 'Token inválido: ' + e.message;
    errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Adicionar';
    return;
  }

  // Garante que ad_account_id sempre tem o prefixo act_
  let finalAdAcct = adAcct;
  if (finalAdAcct && !finalAdAcct.startsWith('act_')) {
    finalAdAcct = 'act_' + finalAdAcct;
  }

  const color = COLORS[clients.length % COLORS.length];
  const { data: session } = await db.auth.getSession();
  const { error } = await db.from('clients').insert({
    user_id: session.session.user.id,
    name, sector: sector || 'Geral',
    meta_access_token: token,
    ad_account_id: finalAdAcct,
    page_id: pageId,
    color, status: 'active',
  });

  btn.disabled = false; btn.textContent = 'Adicionar';
  if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }

  ['inputName','inputSector','inputToken','inputAdAccount','inputPageId'].forEach(id => {
    document.getElementById(id).value = '';
  });
  closeModal('addClientModal');
  await loadClients();
}

async function saveEditClient() {
  const id     = document.getElementById('editClientId').value;
  const name   = document.getElementById('editName').value.trim();
  const sector = document.getElementById('editSector').value.trim();
  const token  = document.getElementById('editToken').value.trim();
  const adAcct = document.getElementById('editAdAccount').value.trim();
  const pageId = document.getElementById('editPageId').value.trim();
  const errEl  = document.getElementById('editClientError');
  const btn    = document.getElementById('editClientBtn');

  errEl.style.display = 'none';
  if (!name) { errEl.textContent = 'Nome é obrigatório.'; errEl.style.display = 'block'; return; }

  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

  let finalAdAcct = adAcct;
  if (finalAdAcct && !finalAdAcct.startsWith('act_')) {
    finalAdAcct = 'act_' + finalAdAcct;
  }

  const updates = { name, sector: sector || 'Geral', ad_account_id: finalAdAcct, page_id: pageId };
  if (token) updates.meta_access_token = token;

  const { error } = await db.from('clients').update(updates).eq('id', id);

  btn.disabled = false; btn.textContent = 'Salvar';
  if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }

  closeModal('editClientModal');
  await loadClients();
  // Atualiza cliente atual se for o mesmo
  if (currentClient && currentClient.id === id) {
    currentClient = clients.find(c => c.id === id);
    await renderMain();
  }
}

async function deleteClient(id) {
  if (!confirm('Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.')) return;
  await db.from('clients').delete().eq('id', id);
  if (currentClient && currentClient.id === id) {
    currentClient = null;
    document.getElementById('mainContent').innerHTML = `
      <div class="empty-state">
        <div style="font-size:48px">👈</div>
        <p style="margin-top:16px; color:var(--muted)">Selecione um cliente</p>
      </div>`;
  }
  await loadClients();
}

function openEditModal(id) {
  const c = clients.find(c => c.id === id);
  if (!c) return;
  document.getElementById('editClientId').value = c.id;
  document.getElementById('editName').value = c.name;
  document.getElementById('editSector').value = c.sector || '';
  document.getElementById('editAdAccount').value = c.ad_account_id || '';
  document.getElementById('editPageId').value = c.page_id || '';
  document.getElementById('editToken').value = '';
  document.getElementById('editClientError').style.display = 'none';
  openModal('editClientModal');
}

function renderSidebar() {
  const list = document.getElementById('clientsList');
  if (clients.length === 0) { list.innerHTML = '<div class="loading-clients">Nenhum cliente</div>'; return; }
  list.innerHTML = clients.map(c => {
    const words = c.name.split(' ');
    const ini = (words[0][0] + (words[1] ? words[1][0] : words[0][1] || '')).toUpperCase();
    return `
    <div class="client-item ${currentClient && currentClient.id === c.id ? 'active' : ''}" onclick="selectClient('${c.id}')">
      <div class="avatar" style="background:${c.color}22; color:${c.color}">${ini}</div>
      <div class="client-info">
        <div class="client-name">${c.name}</div>
        <div class="client-sub">${c.sector}</div>
      </div>
      <button class="client-edit-btn" onclick="event.stopPropagation(); openEditModal('${c.id}')" title="Editar">
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-width="2" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>`;
  }).join('');
}

async function selectClient(id) {
  currentClient = clients.find(c => c.id === id);
  currentView = 'overview';
  document.getElementById('topbarTitle').textContent = currentClient.name;
  renderSidebar();
  updateNavActive();
  await renderMain();
}

// ─── META API ──────────────────────────────────────────────────────

const META_BASE = 'https://graph.facebook.com/v19.0';

async function metaGet(path, params = {}) {
  const token = currentClient.meta_access_token;
  const qs = new URLSearchParams({ access_token: token, ...params }).toString();
  const res = await fetch(`${META_BASE}/${path}?${qs}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json;
}

async function fetchAdMetrics() {
  const acct = currentClient.ad_account_id;
  if (!acct) return null;
  const since = daysAgo(parseInt(currentDateRange));
  try {
    const insights = await metaGet(`${acct}/insights`, {
      fields: 'impressions,reach,clicks,ctr,cpc,spend,actions',
      time_range: JSON.stringify({ since, until: today() }),
      level: 'account',
    });
    return insights.data?.[0] || null;
  } catch(e) { console.error('Ads metrics error:', e); return null; }
}

async function fetchCampaigns() {
  const acct = currentClient.ad_account_id;
  if (!acct) return [];
  try {
    const campaigns = await metaGet(`${acct}/campaigns`, {
      fields: 'name,status,daily_budget,lifetime_budget',
      limit: 10,
    });
    const ids = (campaigns.data || []).map(c => c.id).join(',');
    if (!ids) return [];
    const insights = await metaGet('', {
      ids,
      fields: 'insights{impressions,clicks,ctr,cpc,spend,actions}',
      date_preset: currentDateRange === '7' ? 'last_7d' : currentDateRange === '90' ? 'last_90d' : 'last_30d',
    });
    return (campaigns.data || []).map(camp => ({
      ...camp,
      insights: insights[camp.id]?.insights?.data?.[0] || {},
    }));
  } catch(e) { console.error('Campaigns error:', e); return []; }
}

async function fetchPagePosts() {
  const pageId = currentClient.page_id;
  if (!pageId) return [];
  try {
    const posts = await metaGet(`${pageId}/posts`, {
      fields: 'message,created_time,insights.metric(post_impressions,post_reactions_by_type_total,post_clicks)',
      limit: 6,
    });
    return posts.data || [];
  } catch(e) { console.error('Posts error:', e); return []; }
}

// ─── VIEWS ─────────────────────────────────────────────────────────

async function renderMain() {
  destroyCharts();
  const el = document.getElementById('mainContent');
  el.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><div class="loading-text">Buscando dados do Meta...</div></div>`;

  try {
    if (!currentClient) { el.innerHTML = '<div class="empty-state"><div style="font-size:48px">👈</div><p style="margin-top:16px; color:var(--muted)">Selecione um cliente</p></div>'; return; }

    if (currentView === 'ads') {
      const [metrics, campaigns] = await Promise.all([fetchAdMetrics(), fetchCampaigns()]);
      el.innerHTML = renderAdsView(metrics, campaigns);
      setTimeout(() => renderSpendChart(campaigns), 50);
    } else if (currentView === 'content') {
      const posts = await fetchPagePosts();
      el.innerHTML = renderContentView(posts);
    } else if (currentView === 'reports') {
      el.innerHTML = renderReportsView();
    } else {
      const metrics = await fetchAdMetrics();
      el.innerHTML = renderOverviewView(metrics);
      setTimeout(() => renderOverviewCharts(metrics), 50);
    }

    updateMetaStatus(true);
  } catch(e) {
    el.innerHTML = `<div class="empty-state"><div style="font-size:48px">⚠️</div><p style="margin-top:16px; color:var(--red)">${e.message}</p><p style="margin-top:8px; color:var(--muted); font-size:13px">Verifique se o token do cliente ainda é válido</p><button class="btn-primary" style="margin-top:16px" onclick="openEditModal('${currentClient.id}')">Editar cliente</button></div>`;
    updateMetaStatus(false);
  }
}

function renderOverviewView(m) {
  const ini   = initials(currentClient.name);
  const imp   = m ? fmt(parseInt(m.impressions)) : '—';
  const reach = m ? fmt(parseInt(m.reach))       : '—';
  const clicks= m ? fmt(parseInt(m.clicks))       : '—';
  const spend = m ? fmtMoney(parseFloat(m.spend)) : '—';
  const ctr   = m ? parseFloat(m.ctr).toFixed(2) + '%' : '—';
  const cpc   = m ? 'R$ ' + parseFloat(m.cpc).toFixed(2) : '—';
  const conv  = m ? (m.actions?.find(a=>a.action_type==='purchase')?.value || '—') : '—';
  return `
  <div class="client-header">
    <div class="client-avatar-lg" style="background:${currentClient.color}22; color:${currentClient.color}">${ini}</div>
    <div class="client-header-info">
      <h1>${currentClient.name}</h1>
      <p>${currentClient.sector}
        <span class="badge badge-green" style="margin-left:8px">● Ativo</span>
        ${currentClient.ad_account_id ? '<span class="badge badge-blue" style="margin-left:4px">Meta Ads ✓</span>' : ''}
      </p>
    </div>
    <button class="export-btn" style="margin-left:auto" onclick="openEditModal('${currentClient.id}')">
      <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-width="2" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-width="2" stroke-linecap="round"/></svg>
      Editar cliente
    </button>
    <button class="export-btn" style="color:var(--red); border-color:rgba(239,68,68,0.3)" onclick="deleteClient('${currentClient.id}')">
      <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" stroke-width="2" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke-width="2" stroke-linecap="round"/><path d="M10 11v6M14 11v6" stroke-width="2" stroke-linecap="round"/></svg>
      Excluir
    </button>
  </div>
  <div class="metrics-grid">
    <div class="metric-card blue"><div class="metric-label">Gasto</div><div class="metric-value">${spend}</div><div class="metric-change neutral">Últimos ${currentDateRange} dias</div></div>
    <div class="metric-card purple"><div class="metric-label">Impressões</div><div class="metric-value">${imp}</div></div>
    <div class="metric-card blue"><div class="metric-label">Alcance</div><div class="metric-value">${reach}</div></div>
    <div class="metric-card green"><div class="metric-label">Conversões</div><div class="metric-value">${conv}</div></div>
  </div>
  <div class="metrics-grid">
    <div class="metric-card amber"><div class="metric-label">CTR</div><div class="metric-value">${ctr}</div></div>
    <div class="metric-card pink"><div class="metric-label">CPC</div><div class="metric-value">${cpc}</div></div>
    <div class="metric-card green"><div class="metric-label">Cliques</div><div class="metric-value">${clicks}</div></div>
    <div class="metric-card purple"><div class="metric-label">Conta</div><div class="metric-value" style="font-size:14px">${currentClient.ad_account_id || 'Não configurada'}</div></div>
  </div>
  <div class="chart-card">
    <div class="chart-title">Resumo do período</div>
    <div class="chart-subtitle">Dados reais da Meta Ads API · Últimos ${currentDateRange} dias</div>
    <div class="chart-area"><canvas id="overviewBar"></canvas></div>
  </div>`;
}

function renderOverviewCharts(m) {
  const ctx = document.getElementById('overviewBar');
  if (!ctx || !m) return;
  const c = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Impressões', 'Alcance', 'Cliques'],
      datasets: [{
        data: [parseInt(m.impressions)||0, parseInt(m.reach)||0, parseInt(m.clicks)||0],
        backgroundColor: [currentClient.color+'55', currentClient.color+'88', currentClient.color+'cc'],
        borderColor: currentClient.color, borderWidth: 2, borderRadius: 8,
      }]
    },
    options: chartOpts(),
  });
  charts.push(c);
}

function renderAdsView(m, campaigns) {
  const ini = initials(currentClient.name);
  const rows = campaigns.map(camp => {
    const ins = camp.insights;
    const status = camp.status === 'ACTIVE' ? 'pill-green' : camp.status === 'PAUSED' ? 'pill-amber' : 'pill-gray';
    const statusLabel = camp.status === 'ACTIVE' ? '● Ativo' : camp.status === 'PAUSED' ? '⏸ Pausado' : camp.status;
    return `<tr>
      <td><div class="ad-name">${camp.name}</div></td>
      <td><span class="status-pill ${status}">${statusLabel}</span></td>
      <td class="mono">${ins.spend ? fmtMoney(parseFloat(ins.spend)) : '—'}</td>
      <td class="mono">${ins.impressions ? fmt(parseInt(ins.impressions)) : '—'}</td>
      <td class="mono">${ins.ctr ? parseFloat(ins.ctr).toFixed(2)+'%' : '—'}</td>
      <td class="mono">${ins.cpc ? 'R$ '+parseFloat(ins.cpc).toFixed(2) : '—'}</td>
    </tr>`;
  }).join('');
  return `
  <div class="client-header">
    <div class="client-avatar-lg" style="background:${currentClient.color}22; color:${currentClient.color}">${ini}</div>
    <div class="client-header-info"><h1>${currentClient.name} — Anúncios</h1><p>${campaigns.length} campanhas encontradas</p></div>
  </div>
  <div class="metrics-grid">
    <div class="metric-card blue"><div class="metric-label">Gasto total</div><div class="metric-value">${m ? fmtMoney(parseFloat(m.spend)) : '—'}</div></div>
    <div class="metric-card amber"><div class="metric-label">CTR</div><div class="metric-value">${m ? parseFloat(m.ctr).toFixed(2)+'%' : '—'}</div></div>
    <div class="metric-card pink"><div class="metric-label">CPC</div><div class="metric-value">${m ? 'R$ '+parseFloat(m.cpc).toFixed(2) : '—'}</div></div>
    <div class="metric-card green"><div class="metric-label">Cliques</div><div class="metric-value">${m ? fmt(parseInt(m.clicks)) : '—'}</div></div>
  </div>
  <div class="chart-card" style="margin-bottom:16px;">
    <div class="chart-title">Gasto por campanha</div>
    <div class="chart-subtitle">Dados reais das campanhas</div>
    <div class="chart-area" style="height:160px;"><canvas id="spendChart"></canvas></div>
  </div>
  <div class="table-card">
    <div class="table-header"><div class="table-title">Campanhas</div></div>
    <table>
      <thead><tr><th>Nome</th><th>Status</th><th>Gasto</th><th>Impressões</th><th>CTR</th><th>CPC</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" style="text-align:center; color:var(--muted); padding:24px;">Nenhuma campanha encontrada</td></tr>'}</tbody>
    </table>
  </div>`;
}

function renderSpendChart(campaigns) {
  const ctx = document.getElementById('spendChart');
  if (!ctx || !campaigns.length) return;
  const data = campaigns.map(c => parseFloat(c.insights?.spend || 0));
  const labels = campaigns.map(c => c.name.length > 20 ? c.name.slice(0,20)+'…' : c.name);
  charts.push(new Chart(ctx, {
    type: 'bar', indexAxis: 'y',
    data: {
      labels,
      datasets: [{ label: 'Gasto (R$)', data, backgroundColor: currentClient.color+'88', borderColor: currentClient.color, borderWidth: 2, borderRadius: 5 }]
    },
    options: chartOpts(),
  }));
}

function renderContentView(posts) {
  const ini = initials(currentClient.name);
  const cards = posts.length ? posts.map(p => {
    const msg = (p.message || 'Post sem legenda').slice(0, 60) + '…';
    const ins = p.insights?.data || [];
    const imp = ins.find(i => i.name === 'post_impressions')?.values?.[0]?.value || 0;
    const react = p.insights?.data?.find?.(i => i.name === 'post_reactions_by_type_total')?.values?.[0]?.value || {};
    const likes = Object.values(react).reduce((a,b)=>a+b,0);
    const clicks = ins.find(i => i.name === 'post_clicks')?.values?.[0]?.value || 0;
    const date = new Date(p.created_time).toLocaleDateString('pt-BR');
    return `
    <div class="post-card">
      <div class="post-thumb" style="background:${currentClient.color}15; font-size:36px;">
        📝
        <span class="post-thumb-label">${date}</span>
      </div>
      <div class="post-body">
        <div class="post-title">${msg}</div>
        <div class="post-stats">
          <div><div class="post-stat-label">❤️ Reações</div><div class="post-stat-val">${likes}</div></div>
          <div><div class="post-stat-label">👁 Alcance</div><div class="post-stat-val">${fmt(imp)}</div></div>
          <div><div class="post-stat-label">🖱 Cliques</div><div class="post-stat-val">${clicks}</div></div>
        </div>
      </div>
    </div>`;
  }).join('') : `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--muted);">Nenhum post encontrado. Configure o ID da página do cliente.</div>`;
  return `
  <div class="client-header">
    <div class="client-avatar-lg" style="background:${currentClient.color}22; color:${currentClient.color}">${ini}</div>
    <div class="client-header-info"><h1>${currentClient.name} — Conteúdo</h1><p>Últimas publicações · ${posts.length} posts</p></div>
  </div>
  <div class="content-grid">${cards}</div>`;
}

function renderReportsView() {
  const ini = initials(currentClient.name);
  return `
  <div class="client-header">
    <div class="client-avatar-lg" style="background:${currentClient.color}22; color:${currentClient.color}">${ini}</div>
    <div class="client-header-info"><h1>${currentClient.name} — Relatórios</h1><p>Gere relatórios prontos para o cliente</p></div>
  </div>
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
    ${[
      { icon:'📊', title:'Relatório Mensal Completo', desc:'Visão geral com todas as métricas de anúncios do mês.' },
      { icon:'📈', title:'Relatório de Campanhas', desc:'Performance detalhada com CTR, CPC e gastos por campanha.' },
      { icon:'💬', title:'Relatório de Conteúdo', desc:'Análise de posts: alcance, reações e cliques.' },
      { icon:'💰', title:'Relatório Financeiro', desc:'Detalhamento de gastos e retorno sobre investimento.' },
    ].map(r => `
    <div class="chart-card">
      <div style="font-size:28px; margin-bottom:12px">${r.icon}</div>
      <div style="font-size:14px; font-weight:500; margin-bottom:6px">${r.title}</div>
      <div style="font-size:12px; color:var(--muted); margin-bottom:16px; line-height:1.5">${r.desc}</div>
      <button class="export-btn" onclick="exportReport('${r.title}')">
        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke-width="2" stroke-linecap="round"/></svg>
        Gerar PDF
      </button>
    </div>`).join('')}
  </div>`;
}

// ─── HELPERS ───────────────────────────────────────────────────────

function initials(name) {
  const w = name.split(' ');
  return (w[0][0] + (w[1] ? w[1][0] : w[0][1] || '')).toUpperCase();
}
function fmt(n) { return n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : String(n); }
function fmtMoney(n) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
function today() { return new Date().toISOString().split('T')[0]; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().split('T')[0]; }
function destroyCharts() { charts.forEach(c => c.destroy()); charts = []; }
function updateMetaStatus(ok) {
  const el = document.getElementById('metaStatus');
  document.getElementById('metaStatusText').textContent = ok ? 'Meta conectado' : 'Meta desconectado';
  el.className = 'topbar-meta ' + (ok ? 'topbar-meta-on' : 'topbar-meta-off');
}
function chartOpts() {
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ labels:{ color:'#7070a0', font:{size:11}, padding:16, boxWidth:12 }}},
    scales:{
      x:{ grid:{ color:'#2a2a3d' }, ticks:{ color:'#7070a0', font:{size:11} }},
      y:{ grid:{ color:'#2a2a3d' }, ticks:{ color:'#7070a0', font:{size:11} }},
    }
  };
}

function setView(v) {
  currentView = v;
  updateNavActive();
  if (currentClient) renderMain();
}
function updateNavActive() {
  const views = ['overview','ads','content','reports'];
  document.querySelectorAll('.nav-item').forEach((el,i) => {
    el.classList.toggle('active', i === views.indexOf(currentView));
  });
}
function setDate(range, btn) {
  currentDateRange = range;
  document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (currentClient) renderMain();
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
});

function exportReport(name = '') {
  alert(`Para exportar "${name}" em PDF, use Ctrl+P (imprimir como PDF) na página do cliente.`);
}
