(() => {
  'use strict';

  const DATA = window.POLICE_EXAM_DATA || { questions: [], sections: {} };
  const QUESTIONS = DATA.questions || [];
  const SECTIONS = DATA.sections || {};
  const root = document.getElementById('app');
  const isNui = typeof window.GetParentResourceName === 'function';

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
  };

  let examTimer = null;
  let adminPoll = null;

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
    root.classList.add('hidden');
    if (isNui) {
      await fetch(`https://${resourceName()}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: '{}',
      }).catch(() => {});
    }
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
    const error = state.error ? `<div class="notice notice-error">${h(state.error)}</div>` : '';
    const info = state.info ? `<div class="notice notice-success">${h(state.info)}</div>` : '';
    return `${error}${info}`;
  }

  function renderHome() {
    root.innerHTML = `<div class="shell"><div class="wrap">
      ${topbar('<button class="btn btn-secondary" id="open-login">Personalwesen Login</button>')}
      <section class="grid-home">
        <div class="card hero">
          <span class="pill">Digitaler Eignungstest</span>
          <h2>Behördliches Auswahlverfahren für Bewerberinnen und Bewerber.</h2>
          <p>Die Prüfung wird einzeln, zeitgebunden und mit gesicherter Prüfungsansicht durchgeführt. Nach Abschluss steht das Ergebnis unmittelbar dem Personalwesen zur Verfügung.</p>
          <div class="stat-grid">
            <div class="stat"><span>Dauer</span><strong>25 Min.</strong></div>
            <div class="stat"><span>Bereiche</span><strong>4 Module</strong></div>
            <div class="stat"><span>Navigation</span><strong>Ohne Rücksprung</strong></div>
          </div>
        </div>
        <div class="card form-card">
          <div class="eyebrow">Bewerberzugang</div>
          <h2>Prüfung starten</h2>
          <p class="muted">Name, Geburtsdatum und den einmaligen Zugangscode des Personalwesens eingeben.</p>
          <form id="candidate-form">
            <div class="field"><label>Vollständiger Name</label><input class="input" id="candidate-name" autocomplete="off" placeholder="Max Mustermann" required></div>
            <div class="field"><label>Geburtsdatum</label><input class="input" id="candidate-birth" type="date" required></div>
            <div class="field"><label>Zugangscode</label><input class="input code-input" id="candidate-code" maxlength="9" placeholder="AB3K-7HNP" required></div>
            <div class="notice notice-info">Während der Prüfung werden Rechtsklick, Kopieren und typische Screenshot-Tasten blockiert. Das Verlassen der Ansicht wird protokolliert.</div>
            <div style="height:12px"></div>${noticeHtml()}
            <button class="btn btn-primary" style="width:100%;margin-top:14px" type="submit">Auswahlprüfung starten</button>
          </form>
        </div>
      </section>
    </div></div>${isNui ? '<button class="btn btn-secondary close-fixed" id="close-nui">Schließen ×</button>' : ''}`;

    document.getElementById('open-login').onclick = () => { state.view = 'login'; state.error = ''; render(); };
    document.getElementById('close-nui')?.addEventListener('click', closeNui);
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
    root.innerHTML = `<div class="shell login-layout"><div class="card login-card">
      ${logoBrand('Interner Zugang Personalwesen')}
      <div style="height:24px"></div>
      <h2>Personalwesen Login</h2>
      <p class="muted">Die Anmeldung wird ausschließlich serverseitig geprüft.</p>
      <form id="login-form">
        <div class="field"><label>Benutzername</label><input class="input" id="staff-user" autocomplete="username" required></div>
        <div class="field"><label>Passwort</label><input class="input" id="staff-pass" type="password" autocomplete="current-password" required></div>
        ${noticeHtml()}
        <div class="inline-actions"><button type="button" class="btn btn-secondary" id="login-back">Zurück</button><button type="submit" class="btn btn-primary">Anmelden</button></div>
      </form>
    </div></div>${isNui ? '<button class="btn btn-secondary close-fixed" id="close-nui">Schließen ×</button>' : ''}`;
    document.getElementById('login-back').onclick = () => { state.view = 'home'; state.error = ''; render(); };
    document.getElementById('close-nui')?.addEventListener('click', closeNui);
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
      render();
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

  function renderExam() {
    const exam = state.exam;
    if (!exam) { state.view = 'home'; render(); return; }
    const question = exam.questions[exam.index];
    const progress = ((exam.index + 1) / exam.questions.length) * 100;
    const source = question.text ? `<div class="source-text">${nl2br(question.text)}</div>` : '';
    const stimulus = question.stimulus ? `<div class="source-text stimulus">${question.stimulus}</div>` : '';
    const options = question.options.map((option) => `<button class="option ${exam.selected === option.id ? 'selected' : ''}" data-option="${h(option.id)}">
      <span class="option-key">${h(option.id)}</span><span>${h(option.text)}</span></button>`).join('');

    root.innerHTML = `<div class="exam-shell">
      <header class="exam-header"><div class="exam-header-inner">
        ${logoBrand(`Verfahrensnummer: ${state.candidate?.candidateId || '–'}`)}
        <div class="timer-row">
          ${exam.questionTime !== null ? `<div class="timer">Frage ${exam.questionTime}s</div>` : ''}
          <div class="timer ${exam.globalTime < 300 ? 'danger' : ''}">Restzeit ${formatTime(exam.globalTime)}</div>
        </div>
      </div></header>
      <div class="progress"><div style="width:${progress}%"></div></div>
      <main class="exam-main"><section class="card question-card">
        <div class="section-tag">${h(categoryLabel(question.category))} · Frage ${exam.index + 1} von ${exam.questions.length}</div>
        <h2 class="question-title">${h(question.title)}</h2>
        ${source}${stimulus}
        <div class="question-text">${nl2br(question.question)}</div>
        <div class="options">${options}</div>
        <div class="exam-actions"><span class="muted small">Antworten können nach dem Fortfahren nicht geändert werden.</span><button class="btn btn-primary" id="next-question" ${exam.selected === null ? 'disabled' : ''}>${exam.index === exam.questions.length - 1 ? 'Prüfung abschließen' : 'Weiter'}</button></div>
      </section></main>
      ${state.blocked ? '<div class="block-screen"><div><div style="font-size:64px">🛡️</div><h2>PRÜFUNGSANSICHT GESPERRT</h2><p>Der Bildschirminhalt wurde zum Schutz der Prüfung ausgeblendet.<br>Kehren Sie zur Prüfungsansicht zurück.</p></div></div>' : ''}
    </div>`;

    root.querySelectorAll('[data-option]').forEach((button) => {
      button.onclick = () => { exam.selected = button.dataset.option; render(); };
    });
    document.getElementById('next-question').onclick = () => advanceQuestion(false);
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
    render();
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
    root.innerHTML = `<div class="shell login-layout"><div class="card login-card" style="text-align:center">
      ${logoBrand('Prüfung wird übermittelt')}
      <div style="height:22px"></div><h2>Abgabe wird gespeichert</h2>
      <p class="muted">Die Antworten und Prüfungsdaten werden sicher in der Prüfungsakte gespeichert.</p>
      ${state.error ? `<div class="notice notice-error">${h(state.error)}</div><button class="btn btn-primary" id="retry-save" style="margin-top:14px">Erneut speichern</button>` : '<div class="notice notice-info">Bitte die Anwendung nicht schließen.</div>'}
    </div></div>`;
    document.getElementById('retry-save')?.addEventListener('click', submitPendingRecord);
  }

  function renderResult() {
    const receipt = state.result;
    if (!receipt) { state.view = 'home'; render(); return; }
    root.innerHTML = `<div class="shell"><div class="wrap">
      ${topbar('')}
      <section class="card result-card">
        <div class="eyebrow">Prüfung abgeschlossen</div>
        <h2>Abgabe erfolgreich</h2>
        <div style="font-size:64px;margin:16px 0">✓</div>
        <p>Ihre Prüfung wurde gespeichert und an das Personalwesen zur internen Prüfung übermittelt.</p>
        <div class="notice notice-info">Das Ergebnis sowie eine mögliche Zertifikatsausstellung werden ausschließlich im Admin-Dashboard bearbeitet und in dieser Ansicht nicht angezeigt.</div>
        <div class="detail-grid" style="margin-top:18px;text-align:left">
          <div class="detail-box"><div class="small muted">Bewerber</div><strong>${h(receipt.candidateName)}</strong></div>
          <div class="detail-box"><div class="small muted">Verfahrensnummer</div><strong>${h(receipt.candidateId)}</strong></div>
          <div class="detail-box"><div class="small muted">Abgegeben am</div><strong>${formatDate(receipt.completedAt, true)}</strong></div>
          <div class="detail-box"><div class="small muted">Status</div><strong>Beim Personalwesen eingegangen</strong></div>
        </div>
        ${noticeHtml()}
        <div class="inline-actions" style="justify-content:center"><button class="btn btn-primary" id="result-home">Zur Startseite</button></div>
      </section>
    </div></div>${isNui ? '<button class="btn btn-secondary close-fixed" id="close-nui">Schließen ×</button>' : ''}`;
    document.getElementById('result-home').onclick = () => { state.view = 'home'; state.candidate = null; state.result = null; state.error = ''; state.info = ''; render(); };
    document.getElementById('close-nui')?.addEventListener('click', closeNui);
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
    root.innerHTML = `<div class="shell"><div class="wrap">
      ${topbar(`<span class="muted"><strong>${h(state.staffName)}</strong><br>${h(state.staffRank)}</span><button class="btn btn-secondary" id="logout">Abmelden</button>`)}
      ${noticeHtml()}
      <div class="admin-layout">
        <aside class="card sidebar">
          <div class="eyebrow">Verwaltung</div><h2>Personalwesen</h2>
          <div class="admin-stats"><div class="admin-stat"><strong>${state.records.length}</strong><span>Akten</span></div><div class="admin-stat"><strong>${passed}</strong><span>Bestanden</span></div><div class="admin-stat"><strong>${openCodes}</strong><span>Codes</span></div></div>
          <div class="tabs"><button class="btn tab ${state.adminTab === 'records' ? 'active' : 'btn-secondary'}" data-tab="records">Prüfungsakten</button><button class="btn tab ${state.adminTab === 'codes' ? 'active' : 'btn-secondary'}" data-tab="codes">Zugangscodes</button></div>
          ${state.adminTab === 'records' ? renderRecordList() : renderCodeList()}
        </aside>
        <main class="card content">${state.adminTab === 'records' ? renderRecordDetail() : renderCodeManager()}</main>
      </div>
    </div></div>${isNui ? '<button class="btn btn-secondary close-fixed" id="close-nui">Schließen ×</button>' : ''}`;

    document.getElementById('logout').onclick = logout;
    document.getElementById('close-nui')?.addEventListener('click', closeNui);
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
    const items = state.codes.map((code) => `<div class="code-item"><strong style="font-family:ui-monospace,monospace;letter-spacing:.1em">${h(code.code)}</strong><div class="small">${h(code.candidateName)} · ${formatDate(code.candidateBirthDate)}</div><div class="small muted">${code.used ? `Verwendet von ${h(code.usedBy || '–')}` : 'Verfügbar'}</div><button class="btn btn-danger" style="margin-top:8px;padding:7px 10px" data-delete-code="${h(code.code)}">Löschen</button></div>`).join('');
    return `<div class="code-list">${items || '<div class="empty">Noch keine Zugangscodes.</div>'}</div>`;
  }

  function renderCodeManager() {
    return `<div class="eyebrow">Bewerberzugang</div><h2>Einmaligen Zugangscode erstellen</h2><p class="muted">Der Code ist an den eingegebenen Namen und das Geburtsdatum gebunden.</p>
      <form id="create-code-form"><div class="code-row"><div class="field"><label>Name des Bewerbers</label><input class="input" id="new-code-name" required></div><div class="field"><label>Geburtsdatum</label><input class="input" id="new-code-birth" type="date" required></div><button class="btn btn-primary" type="submit" style="margin-bottom:16px">Code erstellen</button></div></form>
      <div class="notice notice-info">Offene Codes: ${state.codes.filter((code) => !code.used).length} · Bereits verwendet: ${state.codes.filter((code) => code.used).length}</div>`;
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
    if (!state.visible) { root.classList.add('hidden'); return; }
    root.classList.remove('hidden');
    if (state.view === 'home') renderHome();
    else if (state.view === 'login') renderLogin();
    else if (state.view === 'exam') renderExam();
    else if (state.view === 'saving') renderSaving();
    else if (state.view === 'result') renderResult();
    else if (state.view === 'admin') renderAdmin();
  }

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
    render();
  });
  window.addEventListener('blur', () => {
    if (state.view !== 'exam') return;
    state.blocked = true;
    registerIncident('WINDOW_SWITCH', 'Das Prüfungsfenster hat den Fokus verloren.');
    render();
  });
  window.addEventListener('focus', () => { if (state.view === 'exam') { state.blocked = false; render(); } });

  render();
})();
