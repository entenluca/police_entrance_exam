(() => {
  'use strict';

  const DATA = window.POLICE_EXAM_DATA || { questions: [], sections: {} };
  const QUESTIONS = DATA.questions || [];
  const SECTIONS = DATA.sections || {};
  const root = document.getElementById('app');
  const tabletStage = document.getElementById('tablet-stage');
  const closeBtn = document.getElementById('close-nui');
  const themeBtn = document.getElementById('theme-toggle');
  const isNui = typeof window.GetParentResourceName === 'function';
  const THEME_KEY = 'police_exam_theme';

  const state = {
    visible: !isNui,
    view: 'home',
    staffName: '',
    staffRank: '',
    candidate: null,
    exam: null,
    result: null,
    pendingRecord: null,
    records: [],
    codes: [],
    selectedRecordId: null,
    adminTab: 'records',
    search: '',
    error: '',
    info: '',
    blocked: false,
    deleteConfirmRecordId: null,
    clearRecordsConfirm: false,
    lastIncident: { type: '', at: 0 },
    theme: 'light',
  };

  let examTimer = null;
  let adminPoll = null;

  const icons = {
    clock: '<svg class="timer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    shield: '<svg class="block-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l8 4v6c0 5.25-3.5 10-8 12-4.5-2-8-6.75-8-12V6l8-4z"/><path d="M9 12l2 2 4-4" stroke-width="2"/></svg>',
    check: '<svg class="result-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>',
    info: '<svg class="notice-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    user: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    lock: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
    key: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
    close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    logout: '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  };

  const h = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const nl2br = (value) => h(value).replaceAll('\n', '<br>');
  const pad = (n) => String(n).padStart(2, '0');
  const formatTime = (seconds) => `${pad(Math.floor(Math.max(0, seconds) / 60))}:${pad(Math.max(0, seconds) % 60)}`;
  const formatDate = (value, withTime = false) => {
    if (!value) return '–';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return h(value);
    return withTime ? date.toLocaleString('de-DE') : date.toLocaleDateString('de-DE');
  };
  const normalizeArray = (value) => Array.isArray(value) ? value : (value && typeof value === 'object' ? Object.values(value) : []);
  const resourceName = () => isNui ? window.GetParentResourceName() : '';

  async function rpc(action, payload = {}) {
    if (!isNui) throw new Error('FiveM-NUI ist nicht aktiv.');
    const response = await fetch(`https://${resourceName()}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ action, payload }),
    });
    const result = await response.json();
    if (result && result.ok === false) throw new Error(result.error || 'Serveranfrage fehlgeschlagen.');
    return result;
  }

  async function closeNui() {
    if (state.view === 'exam' || state.view === 'saving') return;
    if (state.staffName) rpc('auth:logout').catch(() => {});
    stopAdminPoll();
    state.visible = false;
    setTabletVisible(false);
    if (isNui) {
      await fetch(`https://${resourceName()}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: '{}',
      }).catch(() => {});
    }
  }

  function setTabletVisible(visible) {
    if (!tabletStage) return;
    tabletStage.classList.toggle('hidden', !visible);
    tabletStage.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (closeBtn) closeBtn.hidden = !visible || !isNui;
  }

  function applyTheme(theme) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    state.theme = nextTheme;
    document.documentElement.dataset.theme = nextTheme;
    try { localStorage.setItem(THEME_KEY, nextTheme); } catch (_) {}
    if (themeBtn) {
      const label = nextTheme === 'dark' ? 'Hellmodus' : 'Dunkelmodus';
      themeBtn.setAttribute('aria-label', label);
      themeBtn.setAttribute('title', label);
    }
  }

  function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  function initTheme() {
    let stored = 'light';
    try { stored = localStorage.getItem(THEME_KEY) || 'light'; } catch (_) {}
    applyTheme(stored === 'dark' ? 'dark' : 'light');
  }

  function resetSession() {
    stopExamTimer();
    stopAdminPoll();
    state.view = 'home';
    state.staffName = '';
    state.staffRank = '';
    state.candidate = null;
    state.exam = null;
    state.result = null;
    state.pendingRecord = null;
    state.records = [];
    state.codes = [];
    state.selectedRecordId = null;
    state.adminTab = 'records';
    state.search = '';
    state.error = '';
    state.info = '';
    state.blocked = false;
    state.deleteConfirmRecordId = null;
    state.clearRecordsConfirm = false;
  }

  function generateCandidateId() {
    const now = new Date();
    const date = `${pad(now.getDate())}${pad(now.getMonth() + 1)}`;
    const sequence = Math.floor(1000 + Math.random() * 9000);
    const digits = `${date}${sequence}`.split('');
    const check = digits.reduce((sum, digit, index) => sum + Number(digit) * (index + 2), 0) % 10;
    return `PIH-EAV-${String(now.getFullYear()).slice(-2)}-${date}-${sequence}-${check}`;
  }

  function generateRecordId() {
    return crypto.randomUUID ? crypto.randomUUID() : `record-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function generateAccessCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i += 1) {
      if (i === 4) code += '-';
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function categoryLabel(category) {
    return SECTIONS[category]?.title || category;
  }

  function logoBrand(subtitle = 'Auswahlverfahren – digitale Eignungsprüfung') {
    return `<div class="brand">
      <div class="logo-box"><img src="logo.svg" alt="Polizeistern"></div>
      <div><div class="eyebrow">Land Niedersachsen</div><h1>Polizeiinspektion Hannover</h1><div class="muted">${h(subtitle)}</div></div>
    </div>`;
  }

  function topbar(extra = '') {
    return `<header class="card topbar">${logoBrand()}<div class="inline-actions">${extra}</div></header>`;
  }

  function noticeHtml() {
    const error = state.error ? `<div class="notice notice-error">${icons.info}<span>${h(state.error)}</span></div>` : '';
    const info = state.info ? `<div class="notice notice-success">${icons.check}<span>${h(state.info)}</span></div>` : '';
    return `${error}${info}`;
  }

  function staffInitials(name) {
    return String(name || '?').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }

  function renderHome() {
    root.innerHTML = `<div class="shell"><div class="wrap animate-in">
      ${topbar('<button class="btn btn-secondary" id="open-login">' + icons.lock + ' Personalwesen</button>')}
      <section class="grid-home">
        <div class="card hero animate-in-delay-1">
          <div class="hero-pattern"></div>
          <span class="pill"><span class="pill-dot"></span> Digitaler Eignungstest</span>
          <h2>Behördliches Auswahlverfahren für Bewerberinnen und Bewerber</h2>
          <p>Die Prüfung wird einzeln, zeitgebunden und mit gesicherter Prüfungsansicht durchgeführt. Nach Abschluss steht das Ergebnis unmittelbar dem Personalwesen zur Verfügung.</p>
          <div class="stat-grid">
            <div class="stat"><span>Dauer</span><strong>25 Min.</strong></div>
            <div class="stat"><span>Bereiche</span><strong>4 Module</strong></div>
            <div class="stat"><span>Fragen</span><strong>20 Aufgaben</strong></div>
          </div>
        </div>
        <div class="card form-card animate-in-delay-2">
          <div class="form-header-icon">${icons.user}</div>
          <div class="eyebrow">Bewerberzugang</div>
          <h2>Prüfung starten</h2>
          <p class="muted">Name, Geburtsdatum und den einmaligen Zugangscode des Personalwesens eingeben.</p>
          <form id="candidate-form">
            <div class="field"><label>Vollständiger Name</label><input class="input" id="candidate-name" autocomplete="off" placeholder="Max Mustermann" required></div>
            <div class="field"><label>Geburtsdatum</label><input class="input" id="candidate-birth" type="date" required></div>
            <div class="field"><label>Zugangscode</label><input class="input code-input" id="candidate-code" maxlength="9" placeholder="AB3K-7HNP" required></div>
            <div class="notice notice-info">${icons.info}<span>Während der Prüfung werden Rechtsklick, Kopieren und typische Screenshot-Tasten blockiert. Das Verlassen der Ansicht wird protokolliert.</span></div>
            <div style="height:12px"></div>${noticeHtml()}
            <button class="btn btn-primary" style="width:100%;margin-top:16px" type="submit">Auswahlprüfung starten →</button>
          </form>
        </div>
      </section>
    </div></div>`;

    document.getElementById('open-login').onclick = () => { state.view = 'login'; state.error = ''; render(); };
    const codeInput = document.getElementById('candidate-code');
    codeInput.addEventListener('input', () => {
      let value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      if (value.length > 4) value = `${value.slice(0, 4)}-${value.slice(4)}`;
      codeInput.value = value;
    });
    document.getElementById('candidate-form').onsubmit = handleCandidateSubmit;
  }

  async function handleCandidateSubmit(event) {
    event.preventDefault();
    state.error = '';
    state.info = '';
    const name = document.getElementById('candidate-name').value.trim();
    const birth = document.getElementById('candidate-birth').value;
    const code = document.getElementById('candidate-code').value.trim();
    if (name.length < 3) { state.error = 'Bitte vollständigen Vor- und Nachnamen eintragen.'; render(); return; }
    if (!birth) { state.error = 'Bitte das Geburtsdatum eintragen.'; render(); return; }
    if (!code) { state.error = 'Bitte einen Zugangscode eintragen.'; render(); return; }

    try {
      const result = await rpc('code:validate', { code, candidateName: name, candidateBirthDate: birth });
      if (!result.valid) throw new Error('Der Zugangscode ist ungültig, bereits verwendet oder den eingegebenen Personendaten nicht zugeordnet.');
      state.candidate = {
        candidateId: result.candidateId,
        attemptId: result.attemptId,
        candidateName: name,
        candidateBirthDate: birth,
        startedAt: result.startedAt,
      };
      startExam();
    } catch (error) {
      state.error = error.message || 'Zugangscode konnte nicht geprüft werden.';
      render();
    }
  }

  function renderLogin() {
    root.innerHTML = `<div class="shell login-page">
      <div class="login-split">
        <aside class="login-brand">
          ${logoBrand('Interner Zugang Personalwesen')}
          <div class="login-brand-body">
            <h2>Zugang für autorisiertes Personal</h2>
            <p>Verwaltung von Prüfungsakten, Bewerber-Zugangscodes und Zertifikatsausstellung.</p>
          </div>
        </aside>
        <section class="login-panel">
          <div class="form-header-icon">${icons.lock}</div>
          <h2>Personalwesen Login</h2>
          <p class="muted">Die Anmeldung wird ausschließlich serverseitig geprüft.</p>
          <form id="login-form">
            <div class="field"><label>Benutzername</label><input class="input" id="staff-user" autocomplete="username" placeholder="Benutzername eingeben" required></div>
            <div class="field"><label>Passwort</label><input class="input" id="staff-pass" type="password" autocomplete="current-password" placeholder="••••••••" required></div>
            ${noticeHtml()}
            <div class="login-actions">
              <button type="button" class="btn btn-secondary" id="login-back">← Zurück</button>
              <button type="submit" class="btn btn-primary">${icons.lock} Anmelden</button>
            </div>
          </form>
        </section>
      </div>
    </div>`;
    document.getElementById('login-back').onclick = () => { state.view = 'home'; state.error = ''; render(); };
    document.getElementById('login-form').onsubmit = handleLogin;
  }

  async function handleLogin(event) {
    event.preventDefault();
    state.error = '';
    const username = document.getElementById('staff-user').value.trim();
    const password = document.getElementById('staff-pass').value;
    try {
      const result = await rpc('auth:login', { username, password });
      if (!result.success) throw new Error('Benutzername oder Passwort ist falsch.');
      state.staffName = result.displayName || username;
      state.staffRank = result.rank || 'Personalwesen';
      state.view = 'admin';
      await refreshAdminData();
      startAdminPoll();
      render();
    } catch (error) {
      state.error = error.message || 'Anmeldung fehlgeschlagen.';
      render();
    }
  }

  function startExam() {
    state.exam = {
      questions: shuffle(QUESTIONS),
      index: 0,
      selected: null,
      answers: {},
      globalTime: 25 * 60,
      questionTime: null,
      incidents: [],
    };
    state.view = 'exam';
    state.error = '';
    state.blocked = false;
    resetQuestionTime();
    startExamTimer();
    render();
  }

  function resetQuestionTime() {
    if (!state.exam) return;
    const question = state.exam.questions[state.exam.index];
    state.exam.questionTime = Number.isFinite(question.timeLimit) ? question.timeLimit : null;
  }

  function updateExamTimers() {
    const exam = state.exam;
    if (!exam) return;
    const globalTimer = root.querySelector('[data-global-timer]');
    const questionTimer = root.querySelector('[data-question-timer]');
    const progressBar = root.querySelector('[data-progress]');
    const progressLabel = root.querySelector('[data-progress-label]');
    if (globalTimer) {
      globalTimer.innerHTML = `${icons.clock} Restzeit ${formatTime(exam.globalTime)}`;
      globalTimer.classList.toggle('danger', exam.globalTime < 300);
    }
    if (questionTimer && exam.questionTime !== null) {
      questionTimer.innerHTML = `${icons.clock} Frage ${exam.questionTime}s`;
    }
    if (progressBar) {
      progressBar.style.width = `${((exam.index + 1) / exam.questions.length) * 100}%`;
    }
    if (progressLabel) {
      progressLabel.textContent = `Frage ${exam.index + 1} von ${exam.questions.length}`;
    }
  }

  function startExamTimer() {
    stopExamTimer();
    examTimer = window.setInterval(() => {
      if (state.view !== 'exam' || !state.exam) return;
      state.exam.globalTime -= 1;
      if (state.exam.globalTime <= 0) { finishExam(); return; }
      if (state.exam.questionTime !== null) {
        state.exam.questionTime -= 1;
        if (state.exam.questionTime <= 0) { advanceQuestion(true); return; }
      }
      updateExamTimers();
    }, 1000);
  }

  function stopExamTimer() {
    if (examTimer) window.clearInterval(examTimer);
    examTimer = null;
  }

  function registerIncident(type, message) {
    if (state.view !== 'exam' || !state.exam) return;
    const now = Date.now();
    if (state.lastIncident.type === type && now - state.lastIncident.at < 1200) return;
    state.lastIncident = { type, at: now };
    state.exam.incidents.push({ type, message, timestamp: new Date().toISOString() });
  }

  function examQuestionBodyHTML(question, exam) {
    const source = question.text ? `<div class="source-text">${nl2br(question.text)}</div>` : '';
    const stimulus = question.stimulus ? `<div class="source-text stimulus">${question.stimulus}</div>` : '';
    const options = question.options.map((option) => `<button class="option ${exam.selected === option.id ? 'selected' : ''}" data-option="${h(option.id)}" type="button" aria-pressed="${exam.selected === option.id}">
      <span class="option-key">${h(option.id)}</span><span class="option-text">${h(option.text)}</span></button>`).join('');
    return `<div class="section-tag">${h(categoryLabel(question.category))}</div>
      <h2 class="question-title">${h(question.title)}</h2>
      ${source}${stimulus}
      <div class="question-text">${nl2br(question.question)}</div>
      <div class="options" role="radiogroup">${options}</div>
      <div class="exam-actions"><span class="muted small">Antworten können nach dem Fortfahren nicht geändert werden.</span><button class="btn btn-primary" id="next-question" ${exam.selected === null ? 'disabled' : ''}>${exam.index === exam.questions.length - 1 ? 'Prüfung abschließen' : 'Weiter →'}</button></div>`;
  }

  function bindExamHandlers() {
    const exam = state.exam;
    if (!exam) return;
    root.querySelectorAll('[data-option]').forEach((button) => {
      button.onclick = () => {
        exam.selected = button.dataset.option;
        updateExamSelection();
      };
    });
    const nextBtn = document.getElementById('next-question');
    if (nextBtn) nextBtn.onclick = () => advanceQuestion(false);
  }

  function updateExamSelection() {
    const exam = state.exam;
    if (!exam) return;
    root.querySelectorAll('[data-option]').forEach((button) => {
      const selected = button.dataset.option === exam.selected;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    const nextBtn = document.getElementById('next-question');
    if (nextBtn) nextBtn.disabled = exam.selected === null;
  }

  function updateQuestionTimerVisibility() {
    const exam = state.exam;
    const row = root.querySelector('.timer-row');
    if (!row || !exam) return;
    let questionTimer = row.querySelector('[data-question-timer]');
    if (exam.questionTime !== null) {
      const label = `${icons.clock} Frage ${exam.questionTime}s`;
      if (!questionTimer) {
        row.insertAdjacentHTML('afterbegin', `<div class="timer" data-question-timer>${label}</div>`);
      } else {
        questionTimer.innerHTML = label;
      }
    } else if (questionTimer) {
      questionTimer.remove();
    }
  }

  function updateExamBlockScreen() {
    const shell = root.querySelector('.exam-shell');
    if (!shell) return;
    const existing = shell.querySelector('.block-screen');
    if (state.blocked) {
      if (!existing) {
        shell.insertAdjacentHTML('beforeend', `<div class="block-screen"><div class="block-screen-inner">${icons.shield}<h2>Prüfungsansicht gesperrt</h2><p>Der Bildschirminhalt wurde zum Schutz der Prüfung ausgeblendet.<br>Kehren Sie zur Prüfungsansicht zurück.</p></div></div>`);
      }
    } else {
      existing?.remove();
    }
  }

  function patchExamView(animate = true) {
    const exam = state.exam;
    if (!exam) return;
    const question = exam.questions[exam.index];
    const card = root.querySelector('[data-question-card]');
    if (!card) { renderExam(true); return; }

    const applyContent = () => {
      card.innerHTML = examQuestionBodyHTML(question, exam);
      bindExamHandlers();
      updateExamTimers();
      updateQuestionTimerVisibility();
      root.parentElement?.scrollTo({ top: 0, behavior: animate ? 'smooth' : 'auto' });
    };

    if (!animate) {
      applyContent();
      return;
    }

    card.classList.add('is-changing');
    window.setTimeout(() => {
      applyContent();
      card.classList.remove('is-changing');
      card.classList.add('is-entering');
      window.setTimeout(() => card.classList.remove('is-entering'), 280);
    }, 110);
  }

  function renderExam(forceFull = false) {
    const exam = state.exam;
    if (!exam) { state.view = 'home'; render(); return; }

    const existingShell = root.querySelector('.exam-shell');
    if (existingShell && !forceFull) {
      patchExamView(false);
      updateExamBlockScreen();
      return;
    }

    const question = exam.questions[exam.index];
    const progress = ((exam.index + 1) / exam.questions.length) * 100;

    root.innerHTML = `<div class="exam-shell">
      <header class="exam-header"><div class="exam-header-inner">
        ${logoBrand(`Verfahrensnummer: ${state.candidate?.candidateId || '–'}`)}
        <div class="timer-row">
          ${exam.questionTime !== null ? `<div class="timer" data-question-timer>${icons.clock} Frage ${exam.questionTime}s</div>` : ''}
          <div class="timer ${exam.globalTime < 300 ? 'danger' : ''}" data-global-timer>${icons.clock} Restzeit ${formatTime(exam.globalTime)}</div>
        </div>
      </div></header>
      <div class="progress-label" data-progress-label>Frage ${exam.index + 1} von ${exam.questions.length}</div>
      <div class="progress-wrap"><div class="progress" data-progress style="width:${progress}%"></div></div>
      <main class="exam-main"><section class="card question-card" data-question-card>${examQuestionBodyHTML(question, exam)}</section></main>
      ${state.blocked ? `<div class="block-screen"><div class="block-screen-inner">${icons.shield}<h2>Prüfungsansicht gesperrt</h2><p>Der Bildschirminhalt wurde zum Schutz der Prüfung ausgeblendet.<br>Kehren Sie zur Prüfungsansicht zurück.</p></div></div>` : ''}
    </div>`;

    bindExamHandlers();
  }

  function advanceQuestion(timeout) {
    const exam = state.exam;
    if (!exam) return;
    const question = exam.questions[exam.index];
    if (!timeout && exam.selected === null) return;
    exam.answers[question.id] = exam.selected || '';
    if (exam.index >= exam.questions.length - 1) { finishExam(); return; }
    exam.index += 1;
    exam.selected = null;
    resetQuestionTime();
    patchExamView(true);
  }

  async function finishExam() {
    if (!state.exam || !state.candidate) return;
    stopExamTimer();
    const exam = state.exam;
    state.pendingRecord = {
      attemptId: state.candidate.attemptId,
      answers: exam.answers,
      securityIncidents: exam.incidents,
    };
    state.view = 'saving';
    state.exam = null;
    state.error = '';
    state.info = '';
    render();
    await submitPendingRecord();
  }

  async function submitPendingRecord() {
    if (!state.pendingRecord) return;
    state.error = '';
    render();
    try {
      const result = await rpc('exam:submit', state.pendingRecord);
      if (!result.receipt || !result.receipt.recordId) throw new Error('Der Server hat keine gültige Abgabebestätigung zurückgegeben.');
      state.result = result.receipt;
      state.pendingRecord = null;
      state.view = 'result';
      state.info = 'Die Prüfung wurde erfolgreich an das Personalwesen übermittelt.';
      state.error = '';
    } catch (error) {
      state.error = `Speichern fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`;
    }
    render();
  }

  function renderSaving() {
    const hasError = Boolean(state.error);
    root.innerHTML = `<div class="shell login-page">
      <div class="status-page">
        <div class="status-card card">
          ${logoBrand('Prüfung wird übermittelt')}
          <div class="login-divider"></div>
          ${hasError ? '' : '<div class="spinner"></div>'}
          <h2>${hasError ? 'Speichern fehlgeschlagen' : 'Abgabe wird gespeichert'}</h2>
          <p class="muted">Die Antworten und Prüfungsdaten werden sicher in der Prüfungsakte gespeichert.</p>
          ${hasError ? `<div class="notice notice-error">${icons.info}<span>${h(state.error)}</span></div><button class="btn btn-primary" id="retry-save" style="margin-top:16px">Erneut speichern</button>` : `
            <div class="saving-steps">
              <div class="saving-step done"><span class="step-dot"></span>Antworten erfasst</div>
              <div class="saving-step active"><span class="step-dot"></span>Übermittlung an Server</div>
              <div class="saving-step"><span class="step-dot"></span>Bestätigung erhalten</div>
            </div>
            <div class="notice notice-info" style="margin-top:20px">${icons.info}<span>Bitte die Anwendung nicht schließen.</span></div>`}
        </div>
      </div>
    </div>`;
    document.getElementById('retry-save')?.addEventListener('click', submitPendingRecord);
  }

  function renderResult() {
    const receipt = state.result;
    if (!receipt) { state.view = 'home'; render(); return; }
    root.innerHTML = `<div class="shell"><div class="wrap animate-in">
      ${topbar('')}
      <section class="card result-card">
        <div class="eyebrow">Prüfung abgeschlossen</div>
        <h2>Abgabe erfolgreich</h2>
        ${icons.check}
        <p>Ihre Prüfung wurde gespeichert und an das Personalwesen zur internen Prüfung übermittelt.</p>
        <div class="notice notice-info">${icons.info}<span>Das Ergebnis sowie eine mögliche Zertifikatsausstellung werden ausschließlich im Admin-Dashboard bearbeitet und in dieser Ansicht nicht angezeigt.</span></div>
        <div class="detail-grid" style="margin-top:24px;text-align:left">
          <div class="detail-box"><div class="small muted">Bewerber</div><strong>${h(receipt.candidateName)}</strong></div>
          <div class="detail-box"><div class="small muted">Verfahrensnummer</div><strong>${h(receipt.candidateId)}</strong></div>
          <div class="detail-box"><div class="small muted">Abgegeben am</div><strong>${formatDate(receipt.completedAt, true)}</strong></div>
          <div class="detail-box"><div class="small muted">Status</div><strong>Beim Personalwesen eingegangen</strong></div>
        </div>
        ${noticeHtml()}
        <div class="inline-actions" style="justify-content:center;margin-top:24px"><button class="btn btn-primary" id="result-home">Zur Startseite</button></div>
      </section>
    </div></div>`;
    document.getElementById('result-home').onclick = () => { state.view = 'home'; state.candidate = null; state.result = null; state.error = ''; state.info = ''; render(); };
  }

  async function refreshAdminData() {
    if (!state.staffName) return;
    const [records, codes] = await Promise.all([rpc('records:get'), rpc('codes:get')]);
    state.records = normalizeArray(records).sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
    state.codes = normalizeArray(codes).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    if (!state.selectedRecordId || !state.records.some((record) => record.recordId === state.selectedRecordId)) {
      state.selectedRecordId = state.records[0]?.recordId || null;
    }
    if (!state.records.some((record) => record.recordId === state.deleteConfirmRecordId)) state.deleteConfirmRecordId = null;
    if (state.records.length === 0) state.clearRecordsConfirm = false;
  }

  function startAdminPoll() {
    stopAdminPoll();
    adminPoll = window.setInterval(async () => {
      if (state.view !== 'admin' || !state.staffName || state.adminTab === 'codes') return;
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (['input', 'textarea', 'select'].includes(activeTag)) return;
      try { await refreshAdminData(); render(); } catch (_) {}
    }, 30000);
  }

  function stopAdminPoll() {
    if (adminPoll) window.clearInterval(adminPoll);
    adminPoll = null;
  }

  function renderAdmin() {
    const passed = state.records.filter((record) => record.evaluation?.finalDecision === 'BESTANDEN').length;
    const failed = state.records.length - passed;
    const openCodes = state.codes.filter((code) => !code.used).length;
    root.innerHTML = `<div class="shell"><div class="wrap animate-in">
      ${topbar(`<div class="staff-badge"><div class="staff-avatar">${staffInitials(state.staffName)}</div><div><strong>${h(state.staffName)}</strong><br><span class="small muted">${h(state.staffRank)}</span></div></div><button class="btn btn-secondary" id="logout">${icons.logout} Abmelden</button>`)}
      ${noticeHtml()}
      <div class="admin-layout">
        <aside class="card sidebar">
          <div class="eyebrow">Verwaltung</div><h2>Personalwesen</h2>
          <div class="admin-stats">
            <div class="admin-stat"><strong>${state.records.length}</strong><span>Akten</span></div>
            <div class="admin-stat"><strong>${passed}</strong><span>Bestanden</span></div>
            <div class="admin-stat"><strong>${openCodes}</strong><span>Codes</span></div>
          </div>
          <div class="tabs"><button class="btn tab ${state.adminTab === 'records' ? 'active' : 'btn-secondary'}" data-tab="records">Prüfungsakten</button><button class="btn tab ${state.adminTab === 'codes' ? 'active' : 'btn-secondary'}" data-tab="codes">Zugangscodes</button></div>
          ${state.adminTab === 'records' ? renderRecordList() : renderCodeList()}
        </aside>
        <main class="card content">${state.adminTab === 'records' ? renderRecordDetail() : renderCodeManager()}</main>
      </div>
    </div></div>`;

    document.getElementById('logout').onclick = logout;
    root.querySelectorAll('[data-tab]').forEach((button) => button.onclick = () => { state.adminTab = button.dataset.tab; state.error = ''; state.info = ''; render(); });
    root.querySelectorAll('[data-record]').forEach((button) => button.onclick = () => { state.selectedRecordId = button.dataset.record; state.deleteConfirmRecordId = null; state.clearRecordsConfirm = false; render(); });
    root.querySelectorAll('[data-delete-code]').forEach((button) => button.onclick = () => deleteCode(button.dataset.deleteCode));
    document.getElementById('record-search')?.addEventListener('input', (event) => { state.search = event.target.value; render(); const input = document.getElementById('record-search'); input.focus(); input.setSelectionRange(input.value.length, input.value.length); });
    document.getElementById('create-code-form')?.addEventListener('submit', createCode);
    document.getElementById('delete-record')?.addEventListener('click', requestDeleteSelectedRecord);
    document.getElementById('confirm-delete-record')?.addEventListener('click', deleteSelectedRecord);
    document.getElementById('cancel-delete-record')?.addEventListener('click', cancelDeleteSelectedRecord);
    document.getElementById('clear-records')?.addEventListener('click', requestClearRecords);
    document.getElementById('confirm-clear-records')?.addEventListener('click', clearRecords);
    document.getElementById('cancel-clear-records')?.addEventListener('click', cancelClearRecords);
    document.getElementById('issue-certificate')?.addEventListener('click', issueCertificate);
    document.getElementById('refresh-admin')?.addEventListener('click', async () => { await refreshAdminData(); render(); });
  }

  function renderRecordList() {
    const term = state.search.trim().toLowerCase();
    const filtered = state.records.filter((record) => !term || [record.candidateName, record.candidateId, record.certificateNumber].some((value) => String(value || '').toLowerCase().includes(term)));
    const items = filtered.map((record) => {
      const active = record.recordId === state.selectedRecordId;
      const isPassed = record.evaluation?.finalDecision === 'BESTANDEN';
      return `<div class="record-item ${active ? 'active' : ''}"><button data-record="${h(record.recordId)}"><strong>${h(record.candidateName)}</strong><div class="small muted">${h(record.candidateId)}</div><div style="margin-top:7px"><span class="badge ${isPassed ? 'badge-pass' : 'badge-fail'}">${isPassed ? 'Bestanden' : 'Nicht bestanden'}</span></div></button></div>`;
    }).join('');
    return `<div class="field"><input class="input" id="record-search" value="${h(state.search)}" placeholder="Akten durchsuchen"></div><div class="record-list">${items || '<div class="empty">Keine Akten gefunden.</div>'}</div>`;
  }

  function renderRecordDetail() {
    const record = state.records.find((item) => item.recordId === state.selectedRecordId);
    if (!record) return '<div class="empty">Noch keine Prüfungsakte vorhanden.</div>';
    const isPassed = record.evaluation?.finalDecision === 'BESTANDEN';
    const scores = Object.values(record.evaluation?.categoryScores || {}).map((score) => `<tr><td>${h(categoryLabel(score.category))}</td><td>${score.score}/${score.maxScore}</td><td>${Number(score.percentage || 0).toFixed(0)}%</td><td>${h(score.evaluation)}</td></tr>`).join('');
    const certificateBox = record.certificateNumber
      ? `<div class="notice notice-success" style="margin-top:16px"><strong>Zertifikat ausgestellt</strong><br>Nummer: ${h(record.certificateNumber)}<br><span class="small">Ausgestellt am ${formatDate(record.certificateIssuedAt, true)} durch ${h(record.certificateIssuedBy || '–')}</span></div>`
      : `<div class="notice notice-info" style="margin-top:16px">${isPassed ? 'Die Prüfung ist bestanden. Das Zertifikat kann jetzt durch das Personalwesen ausgestellt werden.' : 'Für eine nicht bestandene Prüfung kann kein Zertifikat ausgestellt werden.'}</div>`;
    const certificateButton = record.certificateNumber
      ? '<button class="btn btn-success" type="button" disabled>Zertifikat ausgestellt</button>'
      : `<button class="btn btn-success" id="issue-certificate" type="button" ${isPassed ? '' : 'disabled'}>Zertifikat ausstellen</button>`;
    const deleteControls = state.deleteConfirmRecordId === record.recordId
      ? `<div class="notice notice-error" style="margin-top:16px"><strong>Akte endgültig löschen?</strong><br>Dieser Vorgang kann nicht rückgängig gemacht werden.<div class="inline-actions" style="margin-top:12px"><button class="btn btn-danger" id="confirm-delete-record" type="button">Löschen bestätigen</button><button class="btn btn-secondary" id="cancel-delete-record" type="button">Abbrechen</button></div></div>`
      : '';
    const clearControls = state.clearRecordsConfirm
      ? `<div class="notice notice-error" style="margin-top:16px"><strong>Alle Prüfungsakten endgültig löschen?</strong><div class="inline-actions" style="margin-top:12px"><button class="btn btn-danger" id="confirm-clear-records" type="button">Alle löschen bestätigen</button><button class="btn btn-secondary" id="cancel-clear-records" type="button">Abbrechen</button></div></div>`
      : '';
    return `<div class="eyebrow">Prüfungsakte</div><h2>${h(record.candidateName)}</h2>
      <div class="detail-grid">
        <div class="detail-box"><div class="small muted">Verfahrensnummer</div><strong>${h(record.candidateId)}</strong></div>
        <div class="detail-box"><div class="small muted">Geburtsdatum</div><strong>${formatDate(record.candidateBirthDate)}</strong></div>
        <div class="detail-box"><div class="small muted">Abschluss</div><strong>${formatDate(record.completedAt, true)}</strong></div>
        <div class="detail-box"><div class="small muted">Gesamtergebnis</div><strong class="${isPassed ? 'result-pass' : 'result-fail'}">${Number(record.evaluation?.totalPercentage || 0).toFixed(1)}% · ${h(record.evaluation?.decisionLabel)}</strong></div>
      </div>
      <table class="score-table"><thead><tr><th>Bereich</th><th>Punkte</th><th>Quote</th><th>Bewertung</th></tr></thead><tbody>${scores}</tbody></table>
      <div class="notice notice-info" style="margin-top:16px">${h(record.evaluation?.decisionReason || '')}</div>
      <p class="small muted">Sicherheitsereignisse: ${normalizeArray(record.securityIncidents).length} · Bearbeitungsstatus: ${h(record.reviewStatus || 'AUSSTEHEND')}</p>
      ${certificateBox}
      ${deleteControls}${clearControls}
      <div class="inline-actions" style="margin-top:16px">${certificateButton}<button class="btn btn-danger" id="delete-record" type="button">Akte löschen</button><button class="btn btn-danger" id="clear-records" type="button">Alle Akten löschen</button><button class="btn btn-secondary" id="refresh-admin" type="button">Aktualisieren</button></div>`;
  }

  function renderCodeList() {
    const items = state.codes.map((code) => `<div class="code-item">
      <span class="code-value">${h(code.code)}</span>
      <div class="small">${h(code.candidateName)} · ${formatDate(code.candidateBirthDate)}</div>
      <div class="small muted">${code.used ? `Verwendet von ${h(code.usedBy || '–')}` : '● Verfügbar'}</div>
      <button class="btn btn-danger" style="margin-top:4px;padding:7px 12px;font-size:0.8125rem" data-delete-code="${h(code.code)}">Löschen</button>
    </div>`).join('');
    return `<div class="code-list">${items || '<div class="empty">Noch keine Zugangscodes.</div>'}</div>`;
  }

  function renderCodeManager() {
    return `<div class="eyebrow">Bewerberzugang</div><h2>Einmaligen Zugangscode erstellen</h2><p class="muted">Der Code ist an den eingegebenen Namen und das Geburtsdatum gebunden.</p>
      <form id="create-code-form"><div class="code-row"><div class="field"><label>Name des Bewerbers</label><input class="input" id="new-code-name" placeholder="Max Mustermann" required></div><div class="field"><label>Geburtsdatum</label><input class="input" id="new-code-birth" type="date" required></div><button class="btn btn-primary" type="submit" style="margin-bottom:16px">${icons.key} Code erstellen</button></div></form>
      <div class="notice notice-info">${icons.info}<span>Offene Codes: ${state.codes.filter((code) => !code.used).length} · Bereits verwendet: ${state.codes.filter((code) => code.used).length}</span></div>`;
  }

  async function createCode(event) {
    event.preventDefault();
    const candidateName = document.getElementById('new-code-name').value.trim();
    const candidateBirthDate = document.getElementById('new-code-birth').value;
    if (!candidateName || !candidateBirthDate) return;
    const submitButton = event.submitter;
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await rpc('code:create', { candidateName, candidateBirthDate });
      const createdCode = result.code?.code || result.code;
      if (!createdCode) throw new Error('Der Server hat keinen Zugangscode zurückgegeben.');
      state.info = `Zugangscode ${createdCode} wurde erstellt.`;
      state.error = '';
      await refreshAdminData();
    } catch (error) {
      state.error = error.message || 'Zugangscode konnte nicht erstellt werden.';
      state.info = '';
    }
    render();
  }

  async function deleteCode(code) {
    try { await rpc('code:delete', { code }); await refreshAdminData(); state.info = 'Zugangscode wurde gelöscht.'; state.error = ''; }
    catch (error) { state.error = error.message; state.info = ''; }
    render();
  }

  function requestDeleteSelectedRecord() {
    if (!state.selectedRecordId) return;
    state.deleteConfirmRecordId = state.selectedRecordId;
    state.clearRecordsConfirm = false;
    state.error = '';
    state.info = '';
    render();
  }

  function cancelDeleteSelectedRecord() {
    state.deleteConfirmRecordId = null;
    render();
  }

  async function deleteSelectedRecord() {
    const recordId = state.deleteConfirmRecordId;
    if (!recordId) return;
    try {
      const result = await rpc('record:delete', { recordId });
      if (!result.deletedRecordId) throw new Error('Der Server hat das Löschen nicht bestätigt.');
      state.deleteConfirmRecordId = null;
      await refreshAdminData();
      state.info = 'Prüfungsakte wurde endgültig gelöscht.';
      state.error = '';
    } catch (error) {
      state.error = error.message || 'Prüfungsakte konnte nicht gelöscht werden.';
      state.info = '';
    }
    render();
  }

  function requestClearRecords() {
    state.clearRecordsConfirm = true;
    state.deleteConfirmRecordId = null;
    state.error = '';
    state.info = '';
    render();
  }

  function cancelClearRecords() {
    state.clearRecordsConfirm = false;
    render();
  }

  async function clearRecords() {
    if (!state.clearRecordsConfirm) return;
    try {
      await rpc('records:clear');
      state.clearRecordsConfirm = false;
      await refreshAdminData();
      state.info = 'Alle Prüfungsakten wurden endgültig gelöscht.';
      state.error = '';
    } catch (error) {
      state.error = error.message || 'Prüfungsakten konnten nicht gelöscht werden.';
      state.info = '';
    }
    render();
  }

  async function issueCertificate() {
    const record = state.records.find((item) => item.recordId === state.selectedRecordId);
    if (!record) return;
    try {
      const result = await rpc('record:issueCertificate', { recordId: record.recordId });
      const certificateNumber = result.record?.certificateNumber;
      if (!certificateNumber) throw new Error('Der Server hat kein Zertifikat zurückgegeben.');
      await refreshAdminData();
      state.info = `Zertifikat ${certificateNumber} wurde ausgestellt.`;
      state.error = '';
    } catch (error) {
      state.error = error.message || 'Zertifikat konnte nicht ausgestellt werden.';
      state.info = '';
    }
    render();
  }

  async function logout() {
    await rpc('auth:logout').catch(() => {});
    stopAdminPoll();
    state.staffName = '';
    state.staffRank = '';
    state.records = [];
    state.codes = [];
    state.view = 'home';
    state.error = '';
    state.info = '';
    render();
  }

  function render() {
    if (!state.visible) { setTabletVisible(false); return; }
    setTabletVisible(true);
    if (state.view === 'home') renderHome();
    else if (state.view === 'login') renderLogin();
    else if (state.view === 'exam') renderExam();
    else if (state.view === 'saving') renderSaving();
    else if (state.view === 'result') renderResult();
    else if (state.view === 'admin') renderAdmin();
  }

  closeBtn?.addEventListener('click', closeNui);
  themeBtn?.addEventListener('click', toggleTheme);
  initTheme();

  window.addEventListener('message', async (event) => {
    const message = event.data || {};
    if (message.type === 'police_exam:visibility') {
      state.visible = message.visible === true;
      if (state.visible) resetSession();
      render();
    }
    if (message.type === 'police_exam:dataChanged' && state.view === 'admin' && state.staffName) {
      try { await refreshAdminData(); render(); } catch (_) {}
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.view !== 'exam' && state.view !== 'saving') closeNui();
    if (state.view === 'saving') { event.preventDefault(); return; }
    if (state.view !== 'exam') return;
    if (event.key === 'Escape') { event.preventDefault(); registerIncident('RESTRICTED_ACTION', 'Schließen der Prüfungsansicht wurde blockiert.'); }
    const key = event.key.toLowerCase();
    if (event.key === 'PrintScreen') { event.preventDefault(); registerIncident('PRINT_SCREEN', 'Screenshot-Taste erkannt.'); }
    if ((event.ctrlKey || event.metaKey) && ['c', 'x', 'v', 'u', 's', 'p'].includes(key)) { event.preventDefault(); registerIncident('RESTRICTED_ACTION', 'Nicht zulässige Tastenkombination erkannt.'); }
    if (event.key === 'F12') { event.preventDefault(); registerIncident('RESTRICTED_ACTION', 'Entwicklertools wurden blockiert.'); }
  });

  document.addEventListener('contextmenu', (event) => { if (state.view === 'exam') event.preventDefault(); });
  document.addEventListener('copy', (event) => { if (state.view === 'exam') event.preventDefault(); });
  document.addEventListener('cut', (event) => { if (state.view === 'exam') event.preventDefault(); });
  document.addEventListener('paste', (event) => { if (state.view === 'exam') event.preventDefault(); });
  document.addEventListener('visibilitychange', () => {
    if (state.view !== 'exam') return;
    state.blocked = document.hidden;
    if (document.hidden) registerIncident('WINDOW_SWITCH', 'Die Prüfungsansicht wurde verlassen.');
    updateExamBlockScreen();
  });
  window.addEventListener('blur', () => {
    if (state.view !== 'exam') return;
    state.blocked = true;
    registerIncident('WINDOW_SWITCH', 'Das Prüfungsfenster hat den Fokus verloren.');
    updateExamBlockScreen();
  });
  window.addEventListener('focus', () => {
    if (state.view !== 'exam') return;
    state.blocked = false;
    updateExamBlockScreen();
  });

  render();
})();
