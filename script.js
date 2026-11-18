(() => {
  'use strict';

  /* ---------- Config & helpers ---------- */
  const USER_NAME = 'Ololade'; // change to the logged-in user's name
  const STORAGE_KEY = 'nexapay_state_v1';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const naira = (n) => '₦' + Math.abs(n).toLocaleString('en-NG', { maximumFractionDigits: 2 });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icons = () => window.lucide && window.lucide.createIcons();

  /* ---------- State (persisted in localStorage) ---------- */
  const HOUR = 3600e3;
  const seed = () => {
    const now = Date.now();
    return {
      balance: 450000, income: 180000, expenses: 75000, hidden: false,
      tx: [
        { id: 5, name: 'John Doe', desc: 'Transfer received', amount: 25000, time: now - 2 * HOUR },
        { id: 4, name: 'Netflix', desc: 'Subscription', amount: -6500, time: now - 20 * HOUR },
        { id: 3, name: 'Sarah James', desc: 'Transfer received', amount: 15000, time: now - 30 * HOUR },
        { id: 2, name: 'MTN', desc: 'Airtime purchase', amount: -2000, time: now - 52 * HOUR },
        { id: 1, name: 'Amazon', desc: 'Online purchase', amount: -12500, time: now - 76 * HOUR },
      ],
    };
  };

  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.tx) && typeof saved.balance === 'number') return saved;
    } catch (e) { /* storage unavailable or corrupted: fall back to seed */ }
    return seed();
  };
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  };

  let state = load();
  const ui = { filter: 'all', query: '', mode: 'send' };
 
  /* ---------- Welcome section ---------- */
  function updateWelcome() {
    const now = new Date();

    // Always use Nigerian time
    const hour = Number(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      hour: 'numeric',
      hourCycle: 'h23'
    }).format(now));

    const part = hour < 12
      ? 'Morning'
      : hour < 17
        ? 'Afternoon'
        : 'Evening';

    $('#greeting').textContent =
      `Good ${part}, ${USER_NAME.split(' ')[0]}`;

    $('#cardName').textContent = USER_NAME;

    $('#today').textContent = now.toLocaleDateString('en-NG', {
      timeZone: 'Africa/Lagos',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  updateWelcome();

  /* ---------- Rendering ---------- */
  const dayLabel = (t) => {
    const d = new Date(t), today = new Date();
    const diff = Math.round((new Date(today.toDateString()) - new Date(d.toDateString())) / 864e5);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  };
  const initials = (name) => name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  function renderMoney() {
    $$('[data-money]').forEach((el) => {
      el.textContent = state.hidden ? '₦ ••••••' : naira(state[el.dataset.money]);
    });
    const btn = $('#toggleBalance');
    btn.setAttribute('aria-pressed', state.hidden);
    $('span', btn).textContent = state.hidden ? 'Show balances' : 'Hide balances';
    btn.querySelector('svg, i').outerHTML = `<i data-lucide="${state.hidden ? 'eye-off' : 'eye'}"></i>`;
    icons();
  }

  function renderTx() {
    const q = ui.query.trim().toLowerCase();
    const rows = state.tx.filter((t) => {
      const typeOk = ui.filter === 'all' || (ui.filter === 'income' ? t.amount > 0 : t.amount < 0);
      return typeOk && (!q || t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q));
    });
    $('#txList').innerHTML = rows.map((t) => {
      const inc = t.amount > 0;
      return `<li class="tx">
        <span class="avatar ${inc ? 'in' : 'out'}">${esc(initials(t.name))}</span>
        <div class="tx-info"><strong>${esc(t.name)}</strong><small>${esc(t.desc)} &middot; ${dayLabel(t.time)}</small></div>
        <span class="tx-amount ${inc ? 'pos' : 'neg'}">${inc ? '+' : '-'}${naira(t.amount)}</span>
      </li>`;
    }).join('');
    $('#empty').hidden = rows.length > 0;
  }

  /* ---------- Navigation (views + mobile menu) ---------- */
  function setView(view) {
    $$('[data-views]').forEach((s) => { s.hidden = !s.dataset.views.split(' ').includes(view); });
    $$('.nav-item[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    closeMenu();
    window.scrollTo({ top: 0 });
  }
  const sidebar = $('#sidebar'), overlay = $('#overlay'), menuBtn = $('#menuBtn');
  function openMenu() { sidebar.classList.add('open'); overlay.classList.add('show'); menuBtn.setAttribute('aria-expanded', 'true'); }
  function closeMenu() { sidebar.classList.remove('open'); overlay.classList.remove('show'); menuBtn.setAttribute('aria-expanded', 'false'); }

  $$('.nav-item[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  menuBtn.addEventListener('click', () => (sidebar.classList.contains('open') ? closeMenu() : openMenu()));
  overlay.addEventListener('click', closeMenu);
  window.addEventListener('resize', () => { if (window.innerWidth > 900) closeMenu(); });

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  /* ---------- Balance visibility, search, filters ---------- */
  $('#toggleBalance').addEventListener('click', () => { state.hidden = !state.hidden; save(); renderMoney(); });
  $('#search').addEventListener('input', (e) => { ui.query = e.target.value; renderTx(); });
  $$('.chip').forEach((chip) => chip.addEventListener('click', () => {
    ui.filter = chip.dataset.filter;
    $$('.chip').forEach((c) => { const on = c === chip; c.classList.toggle('active', on); c.setAttribute('aria-pressed', on); });
    renderTx();
  }));

  /* ---------- Modal: send / add / withdraw ---------- */
  const MODES = {
    send: { title: 'Send money', btn: 'Send money' },
    add: { title: 'Add money', btn: 'Add money' },
    withdraw: { title: 'Withdraw', btn: 'Withdraw' },
  };
  const modal = $('#modal'), form = $('#form'), submitBtn = $('#submitBtn');
  let lastFocus = null;

  function openModal(mode) {
    ui.mode = mode;
    lastFocus = document.activeElement;
    form.reset();
    clearErrors();
    $('#modalTitle').textContent = MODES[mode].title;
    submitBtn.textContent = MODES[mode].btn;
    submitBtn.disabled = false;
    $$('[data-for="send"]', form).forEach((f) => { f.hidden = mode !== 'send'; });
    form.hidden = false;
    $('#success').hidden = true;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    (mode === 'send' ? $('#recipient') : $('#amount')).focus();
  }
  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  function clearErrors() {
    $$('.field', form).forEach((f) => f.classList.remove('invalid'));
    $$('.error', form).forEach((e) => { e.textContent = ''; });
  }
  function setError(id, msg) {
    $('#' + id).closest('.field').classList.add('invalid');
    $('#err-' + id).textContent = msg;
  }

  function validate() {
    clearErrors();
    const errors = [];
    const fail = (id, msg) => { setError(id, msg); errors.push(id); };

    if (ui.mode === 'send') {
      if ($('#recipient').value.trim().length < 2) fail('recipient', 'Enter the recipient’s full name.');
      if (!/^\d{10}$/.test($('#account').value.trim())) fail('account', 'Account number must be exactly 10 digits.');
    }
    const amt = Number($('#amount').value.replace(/,/g, '').trim());
    if (!$('#amount').value.trim() || Number.isNaN(amt) || amt <= 0) fail('amount', 'Enter an amount greater than ₦0.');
    else if (amt < 100) fail('amount', 'The minimum amount is ₦100.');
    else if (ui.mode !== 'add' && amt > state.balance) fail('amount', `Insufficient funds. Your balance is ${naira(state.balance)}.`);

    return { errors, amt };
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { errors, amt } = validate();
    if (errors.length) { $('#' + errors[0]).focus(); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing…';

    setTimeout(() => { // simulated network delay
      const mode = ui.mode, name = $('#recipient').value.trim();
      const entry = { id: Date.now(), time: Date.now() };
      if (mode === 'add') {
        Object.assign(entry, { name: 'Wallet top-up', desc: 'Money added', amount: amt });
        state.balance += amt; state.income += amt;
      } else {
        Object.assign(entry, mode === 'send'
          ? { name, desc: $('#note').value.trim() || 'Transfer sent', amount: -amt }
          : { name: 'Withdrawal', desc: 'To bank account', amount: -amt });
        state.balance -= amt; state.expenses += amt;
      }
      state.tx.unshift(entry);
      save(); renderMoney(); renderTx();

      $('#successMsg').textContent = mode === 'send' ? `${naira(amt)} was sent to ${name}.`
        : mode === 'add' ? `${naira(amt)} was added to your wallet.` : `${naira(amt)} is on its way to your bank.`;
      form.hidden = true;
      $('#success').hidden = false;
      icons();
      $('#doneBtn').focus();
      toast('Transaction successful');
    }, 1200);
  });

  $$('[data-action]').forEach((b) => b.addEventListener('click', () => openModal(b.dataset.action)));
  $('#closeModal').addEventListener('click', closeModal);
  $('#doneBtn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!modal.hidden) closeModal(); else closeMenu();
  });
  $('#account').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });

  /* ---------- Misc ---------- */
  $('#bellBtn').addEventListener('click', () => { $('#bellDot').hidden = true; toast('You’re all caught up. No new notifications.'); });
  $('#logoutBtn').addEventListener('click', () => { if (confirm('Log out of NexaPay?')) toast('Logged out (demo only, no backend).'); });
  $('#resetBtn').addEventListener('click', () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    state = seed(); renderMoney(); renderTx(); toast('Demo data reset.');
  });

  /* ---------- Init ---------- */
  renderMoney();
  renderTx();
  setView('dashboard');
  window.addEventListener('load', icons);
  icons();
})();
