// ===============================
// CONFIGURE AQUI O SEU SUPABASE
// ===============================
const SUPABASE_URL = 'https://muizwcujosmukqywgcag.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11aXp3Y3Vqb3NtdWtxeXdnY2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNzU1ODksImV4cCI6MjA5Njc1MTU4OX0.Gf96rSreo7PkoYx6EYABshGggleu4efhyaX32RNGyl0';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BET_VALUE = 0.50;
let session = null;
let profile = null;
let matches = [];
let guesses = [];
let rankings = [];
let apurations = [];

const $ = (id) => document.getElementById(id);
const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dt = (v) => new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
const day = (v) => new Date(v).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const deadlinePassed = (m) => Date.now() >= new Date(m.kickoff_brt).getTime() - 30 * 60 * 1000;
const outcome = (a,b) => a > b ? 'A' : a < b ? 'B' : 'E';

function toast(msg) {
  $('toast').textContent = msg;
  $('toast').classList.remove('hidden');
  setTimeout(() => $('toast').classList.add('hidden'), 4200);
}
function isConfigured(){ return !SUPABASE_URL.includes('COLE_AQUI') && !SUPABASE_ANON_KEY.includes('COLE_AQUI'); }

async function init() {
  $('setupBox').classList.toggle('hidden', isConfigured());
  bindEvents();
  const { data } = await sb.auth.getSession();
  session = data.session;
  if (session) await enterApp(); else showAuth();
}

function bindEvents(){
  $('btnLogin').onclick = login;
  $('btnSignup').onclick = signup;
  $('btnReset').onclick = resetPassword;
  $('searchMatch').oninput = renderMatches;
  $('filterDay').onchange = renderMatches;
  $('btnBlockAll').onclick = () => setGlobalLock(true);
  $('btnUnblockAll').onclick = () => setGlobalLock(false);
  document.querySelectorAll('.tabs button').forEach(btn => btn.onclick = () => switchTab(btn.dataset.tab));
}

async function login(){
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return toast(error.message);
  const { data } = await sb.auth.getSession(); session = data.session; await enterApp();
}
async function signup(){
  const nome = $('signupName').value.trim();
  const email = $('signupEmail').value.trim();
  const password = $('signupPassword').value;
  if(!nome) return toast('Informe o nome.');
  const { error } = await sb.auth.signUp({ email, password, options: { data: { nome } } });
  if (error) return toast(error.message);
  toast('Cadastro criado. Se o Supabase exigir confirmação, verifique o e-mail.');
}
async function resetPassword(){
  const email = $('resetEmail').value.trim();
  const redirectTo = location.origin + location.pathname;
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return toast(error.message);
  toast('E-mail de recuperação enviado.');
}
async function logout(){ await sb.auth.signOut(); session=null; profile=null; showAuth(); }
function showAuth(){ $('authView').classList.remove('hidden'); $('appView').classList.add('hidden'); $('userBox').classList.add('hidden'); }

async function enterApp(){
  $('authView').classList.add('hidden'); $('appView').classList.remove('hidden'); $('userBox').classList.remove('hidden');
  await loadAll();
  $('userBox').innerHTML = `<span>${profile?.nome || session.user.email} • <b>${profile?.role}</b></span><button class="secondary" onclick="logout()">Sair</button>`;
  $('gestorTab').classList.toggle('hidden', profile?.role !== 'gestor');
  renderAll();
}

async function loadAll(){
  const uid = session.user.id;
  let { data: prof, error: pErr } = await sb.from('profiles').select('*').eq('id', uid).single();
  if (pErr) console.warn(pErr);
  profile = prof;

  const [mRes, gRes, rRes, aRes] = await Promise.all([
    sb.from('matches').select('*').order('kickoff_brt'),
    sb.from('guesses').select('*').eq('player_id', uid),
    sb.from('ranking_geral').select('*'),
    sb.from('apuration_public').select('*').order('kickoff_brt')
  ]);
  if (mRes.error) toast(mRes.error.message);
  matches = mRes.data || [];
  guesses = gRes.data || [];
  rankings = rRes.data || [];
  apurations = aRes.data || [];
  fillDayFilter();
}
function fillDayFilter(){
  const sel = $('filterDay'); const current = sel.value;
  const days = [...new Set(matches.map(m => day(m.kickoff_brt)))];
  sel.innerHTML = '<option value="">Todos os dias</option>' + days.map(d=>`<option value="${d}">${d}</option>`).join('');
  sel.value = current;
}
function renderAll(){ renderMatches(); renderRanking(); renderFinance(); renderApuration(); renderGestor(); }
function switchTab(tab){
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.tab-content').forEach(s=>s.classList.toggle('active', s.id===tab));
}

function filteredMatches(){
  const q = $('searchMatch').value.toLowerCase().trim(); const d = $('filterDay').value;
  return matches.filter(m => {
    const text = `${m.fase} ${m.grupo||''} ${m.team_a} ${m.team_b} ${m.city||''} ${m.stadium||''}`.toLowerCase();
    return (!q || text.includes(q)) && (!d || day(m.kickoff_brt) === d);
  });
}
function renderMatches(){
  $('matchesList').innerHTML = filteredMatches().map(m => {
    const g = guesses.find(x => x.match_id === m.id);
    const locked = m.bets_locked || deadlinePassed(m);
    const status = m.result_entered ? `<span class="badge ok">Resultado: ${m.score_a} x ${m.score_b}</span>` : locked ? '<span class="badge danger">Palpite travado</span>' : '<span class="badge ok">Aberto</span>';
    return `<article class="card match-card">
      <h3>#${m.match_number} — ${m.team_a} x ${m.team_b}</h3>
      <p class="muted">${m.fase}${m.grupo ? ' • Grupo ' + m.grupo : ''} • ${dt(m.kickoff_brt)} BRT<br>${m.stadium || ''} ${m.city ? '• ' + m.city : ''}</p>
      ${status}
      <div class="row wrap" style="margin-top:12px">
        <input class="score-input" id="ga_${m.id}" type="number" min="0" value="${g?.guess_a ?? ''}" ${locked?'disabled':''} placeholder="${m.team_a}">
        <b>x</b>
        <input class="score-input" id="gb_${m.id}" type="number" min="0" value="${g?.guess_b ?? ''}" ${locked?'disabled':''} placeholder="${m.team_b}">
        <button onclick="saveGuess(${m.id})" ${locked?'disabled':''}>Salvar palpite</button>
        <button class="danger" onclick="deleteGuess(${m.id})" ${locked || !g?'disabled':''}>Excluir</button>
      </div>
      <p class="muted">Custo do jogo para você: ${money(BET_VALUE)}. Prazo: até ${dt(new Date(new Date(m.kickoff_brt).getTime()-30*60000))} BRT.</p>
    </article>`;
  }).join('') || '<div class="card">Nenhum jogo encontrado.</div>';
}

async function saveGuess(matchId){
  const a = Number($(`ga_${matchId}`).value), b = Number($(`gb_${matchId}`).value);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return toast('Informe placares válidos.');
  const { error } = await sb.from('guesses').upsert({ match_id: matchId, player_id: session.user.id, guess_a: a, guess_b: b }, { onConflict: 'match_id,player_id' });
  if (error) return toast(error.message);
  toast('Palpite salvo.'); await loadAll(); renderAll();
}
async function deleteGuess(matchId){
  const { error } = await sb.from('guesses').delete().eq('match_id', matchId).eq('player_id', session.user.id);
  if (error) return toast(error.message);
  toast('Palpite excluído.'); await loadAll(); renderAll();
}

function renderRanking(){
  $('rankingBox').innerHTML = table(['#','Jogador','Placar exato','Resultado','Prêmios','Pagar','Saldo'], rankings.map((r,i)=>[i+1,r.nome,r.placares_exatos,r.resultados_corretos,money(r.premios),money(r.valor_a_pagar_ate_agora),money(r.saldo_ate_agora)]));
}
function renderFinance(){
  const me = rankings.find(r => r.id === session.user.id);
  if(!me) return $('financeBox').innerHTML = 'Sem dados financeiros.';
  $('financeBox').innerHTML = `<div class="grid">
    <div class="card"><h3>Valor a pagar até agora</h3><h2>${money(me.valor_a_pagar_ate_agora)}</h2></div>
    <div class="card"><h3>Prêmios ganhos</h3><h2>${money(me.premios)}</h2></div>
    <div class="card"><h3>Saldo até agora</h3><h2>${money(me.saldo_ate_agora)}</h2></div>
    <div class="card"><h3>Acertos</h3><p>${me.placares_exatos} placares exatos • ${me.resultados_corretos} resultados corretos</p></div>
  </div>`;
}
function renderApuration(){
  const rows = apurations.map(a => [
    `#${a.match_number}`, `${a.team_a} ${a.score_a} x ${a.score_b} ${a.team_b}`, a.nome,
    a.guess_a == null ? 'Sem palpite' : `${a.guess_a} x ${a.guess_b}`,
    a.exact_score ? 'Placar exato' : a.correct_outcome ? 'Resultado' : 'Errou', money(a.prize_value)
  ]);
  $('apurationBox').innerHTML = table(['Jogo','Resultado','Jogador','Palpite','Situação','Prêmio'], rows);
}

function renderGestor(){
  if(profile?.role !== 'gestor') return;
  $('gestorList').innerHTML = matches.map(m => `<article class="card match-card">
    <h3>#${m.match_number} — ${m.team_a} x ${m.team_b}</h3>
    <p class="muted">${m.fase}${m.grupo ? ' • Grupo ' + m.grupo : ''} • ${dt(m.kickoff_brt)} BRT</p>
    <span class="badge ${m.bets_locked?'danger':'ok'}">${m.bets_locked?'Bloqueado':'Liberado'}</span>
    <div class="row wrap">
      <button onclick="toggleMatchLock(${m.id}, ${!m.bets_locked})">${m.bets_locked?'Liberar':'Bloquear'} jogo</button>
    </div>
    <div class="row wrap" style="margin-top:10px">
      <input class="score-input" id="sa_${m.id}" type="number" min="0" value="${m.score_a ?? ''}" placeholder="${m.team_a}">
      <b>x</b>
      <input class="score-input" id="sb_${m.id}" type="number" min="0" value="${m.score_b ?? ''}" placeholder="${m.team_b}">
      <button onclick="setResult(${m.id})">Salvar resultado e apurar</button>
    </div>
  </article>`).join('');
}
async function toggleMatchLock(id, locked){
  const { error } = await sb.from('matches').update({ bets_locked: locked }).eq('id', id);
  if(error) return toast(error.message); toast(locked?'Jogo bloqueado.':'Jogo liberado.'); await loadAll(); renderAll();
}
async function setGlobalLock(locked){
  const { error } = await sb.from('matches').update({ bets_locked: locked }).neq('id', 0);
  if(error) return toast(error.message); toast(locked?'Todos os jogos bloqueados.':'Todos os jogos liberados.'); await loadAll(); renderAll();
}
async function setResult(id){
  const a = Number($(`sa_${id}`).value), b = Number($(`sb_${id}`).value);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return toast('Informe resultado válido.');
  const { error } = await sb.rpc('gestor_set_resultado', { p_match_id: id, p_score_a: a, p_score_b: b });
  if(error) return toast(error.message); toast('Resultado salvo e jogo apurado.'); await loadAll(); renderAll();
}
function table(headers, rows){
  if(!rows.length) return '<p class="muted">Nenhum registro.</p>';
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

init();
