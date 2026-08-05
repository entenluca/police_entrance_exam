(() => {
  'use strict';

  const APP_BUILD = '1.3.0';
  console.info(`[auswahlverfahren] UI Build ${APP_BUILD} geladen`);

  const { el, mount, frag, setMultiline, field, btn, notice, icon, timerLabel, setTimerContent } = window.PoliceExamDOM;

  const DATA = window.POLICE_EXAM_DATA || { questions: [], sections: {} };
  const QUESTIONS = DATA.questions || [];
  const SECTIONS = DATA.sections || {};
  const root = document.getElementById('app');
  const tabletStage = document.getElementById('tablet-stage');
  const certificateOverlay = document.getElementById('certificate-overlay');
  const closeBtn = document.getElementById('close-nui');
  const themeBtn = document.getElementById('theme-toggle');
  const isNui = typeof window.GetParentResourceName === 'function';
  const THEME_KEY = 'police_exam_theme';

  const DEFAULT_BRANDING = {
    region: 'Land Niedersachsen',
    department: 'Polizeiinspektion Hannover',
    chromeTitle: 'Land Niedersachsen · Polizeiinspektion Hannover',
    logoUrl: 'logo.svg',
    logoAlt: 'Dienststellenlogo',
    appTitle: 'Auswahlverfahren',
    subtitle: 'Digitale Eignungsprüfung',
    certificateTitle: 'Zertifikat über die bestandene Eignungsprüfung',
    staffLabel: 'Personalwesen',
    examRules: {
      passPercentage: 78,
      categoryMinimum: 55,
      excellentPercentage: 88,
    },
  };

  const state = {
    visible: !isNui,
    view: 'home',
    staffName: '',
    staffRank: '',
    staffUsername: '',
    canChangePassword: false,
    canResetStaffPassword: false,
    staffAccounts: [],
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
    loginPending: false,
    blocked: false,
    deleteConfirmRecordId: null,
    clearRecordsConfirm: false,
    lastIncident: { type: '', at: 0 },
    theme: 'light',
    branding: { ...DEFAULT_BRANDING },
    certificateRecord: null,
  };

  function incidentLabel(type) {
    const labels = {
      SCREEN_CAPTURE: 'Screenshot / Bildschirmaufnahme',
      PHOTO_SUSPECTED: 'Externe Aufnahme (Handy/Foto)',
      PRINT_SCREEN: 'Screenshot-Taste',
      COPY_ATTEMPT: 'Kopierversuch',
      CUT_ATTEMPT: 'Ausschneiden blockiert',
      PASTE_ATTEMPT: 'Einfügen blockiert',
      CONTEXT_MENU: 'Rechtsklick',
      RESTRICTED_ACTION: 'Gesperrte Aktion',
      WINDOW_SWITCH: 'Ansicht verlassen',
      WINDOW_CLOSE: 'Prüfung geschlossen',
    };
    return labels[type] || type || 'Ereignis';
  }

  function isScreenshotAttempt(event) {
    const key = String(event.key || '').toLowerCase();
    const code = String(event.code || '');
    if (code === 'PrintScreen' || event.key === 'PrintScreen') return true;
    if (event.altKey && code === 'PrintScreen') return true;
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && (key === 's' || code === 'KeyS')) return true;
    if ((event.ctrlKey || event.metaKey) && key === 'p') return true;
    return false;
  }

  function screenshotIncidentMessage(event) {
    const key = String(event.key || '').toLowerCase();
    const code = String(event.code || '');
    if (code === 'PrintScreen' || event.key === 'PrintScreen') {
      return 'Screenshot-Taste (Print Screen) gedrückt – in der Prüfungsakte vermerkt.';
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && (key === 's' || code === 'KeyS')) {
      return 'Bildschirmaufnahme (Snipping Tool / Screenshot-Tool) erkannt – in der Akte vermerkt.';
    }
    if ((event.ctrlKey || event.metaKey) && key === 'p') {
      return 'Drucken oder Export während der Prüfung blockiert – in der Akte vermerkt.';
    }
    return 'Screenshot- oder Aufnahmeversuch während der Prüfung – in der Akte vermerkt.';
  }

  function registerScreenshotAttempt(event) {
    registerIncident('SCREEN_CAPTURE', screenshotIncidentMessage(event));
  }

  let examTimer = null;
  let adminPoll = null;
  let lastRenderedView = null;
  let viewExitTimer = null;
  let mountGeneration = 0;
  let adminDelegationBound = false;
  let searchRenderTimer = null;
  let wasTabletVisible = false;

  const EXAM_EXIT_MS = 200;
  const EXAM_ENTER_MS = 420;
  const VIEW_EXIT_MS = 220;
  const VIEW_ENTER_MS = 420;

  const h = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

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
    if (state.view === 'saving') return;

    if (state.view === 'exam' && state.exam) {
      registerIncident('WINDOW_CLOSE', 'Die Prüfungsansicht wurde manuell geschlossen.');
      stopExamTimer();
    }

    if (state.staffName) rpc('auth:logout').catch(() => {});
    stopAdminPoll();
    resetSession();
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
    const opening = visible && !wasTabletVisible;
    wasTabletVisible = visible;
    tabletStage.classList.toggle('hidden', !visible);
    tabletStage.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (closeBtn) closeBtn.hidden = !visible || !isNui;
    const scene = tabletStage.querySelector('.tablet-scene');
    if (scene && opening) {
      scene.classList.remove('is-entering');
      void scene.offsetWidth;
      scene.classList.add('is-entering');
    }
    if (!visible) hideCertificateModal();
  }

  function applyBranding(branding = {}) {
    state.branding = {
      ...DEFAULT_BRANDING,
      ...branding,
      examRules: {
        ...DEFAULT_BRANDING.examRules,
        ...(branding.examRules || {}),
      },
    };
    const b = state.branding;
    document.title = `${b.appTitle} · ${b.region}`;
    const chromeTitle = document.getElementById('tablet-chrome-title');
    if (chromeTitle) chromeTitle.textContent = b.chromeTitle || `${b.region} · ${b.department}`;
    if (root) root.setAttribute('aria-label', b.appTitle);
  }

  function getGradeInfo(evaluation) {
    if (!evaluation) return { note: '–', label: '–' };
    if (evaluation.gradeNote) {
      return { note: evaluation.gradeNote, label: evaluation.gradeLabel || '–' };
    }
    const pct = Number(evaluation.totalPercentage || 0);
    if (pct >= 95) return { note: '1', label: 'Sehr gut' };
    if (pct >= 85) return { note: '2', label: 'Gut' };
    if (pct >= 75) return { note: '3', label: 'Befriedigend' };
    if (pct >= 68) return { note: '4', label: 'Ausreichend' };
    if (pct >= 50) return { note: '5', label: 'Mangelhaft' };
    return { note: '6', label: 'Ungenügend' };
  }

  function buildCertificateDocument(record) {
    const b = state.branding;
    const evaluation = record.evaluation || {};
    const grade = getGradeInfo(evaluation);
    const scoreRows = Object.values(evaluation.categoryScores || {}).map((score) => el('tr', {},
      el('td', { text: categoryLabel(score.category) }),
      el('td', { text: `${score.score}/${score.maxScore}` }),
      el('td', { text: `${Number(score.percentage || 0).toFixed(0)}%` }),
      el('td', { text: score.evaluation }),
    ));

    return el('article', { className: 'certificate-document', id: 'certificate-print-area' },
      el('header', { className: 'certificate-doc-header' },
        el('div', { className: 'certificate-doc-logo' },
          el('img', { src: b.logoUrl, alt: b.logoAlt }),
        ),
        el('div', { className: 'certificate-doc-brand' },
          el('div', { className: 'eyebrow', text: b.region }),
          el('h2', { text: b.department }),
        ),
      ),
      el('h3', { className: 'certificate-doc-title', text: b.certificateTitle }),
      el('p', { className: 'certificate-doc-text', text: `Hiermit wird bestätigt, dass ${record.candidateName} die digitale Eignungsprüfung im Rahmen des behördlichen Auswahlverfahrens erfolgreich abgelegt hat.` }),
      el('div', { className: 'certificate-doc-meta' },
        el('div', { className: 'certificate-meta-box' },
          el('div', { className: 'label', text: 'Name' }),
          el('strong', { text: record.candidateName }),
        ),
        el('div', { className: 'certificate-meta-box' },
          el('div', { className: 'label', text: 'Verfahrensnummer' }),
          el('strong', { text: record.candidateId }),
        ),
        el('div', { className: 'certificate-meta-box' },
          el('div', { className: 'label', text: 'Prüfungsdatum' }),
          el('strong', { text: formatDate(record.completedAt, true) }),
        ),
        el('div', { className: 'certificate-meta-box' },
          el('div', { className: 'label', text: 'Gesamtergebnis' }),
          el('strong', { text: `${Number(evaluation.totalPercentage || 0).toFixed(1)}% · ${evaluation.decisionLabel || 'Bestanden'}` }),
        ),
        el('div', { className: 'certificate-grade-box' },
          el('div', {},
            el('div', { className: 'label', text: 'Note' }),
            el('div', { className: 'certificate-grade-label', text: grade.label }),
          ),
          el('div', { className: 'certificate-grade-note', text: grade.note }),
        ),
      ),
      el('h4', { text: 'Leistungsübersicht nach Prüfungsbereichen' }),
      el('table', { className: 'certificate-score-table' },
        el('thead', {},
          el('tr', {},
            el('th', { text: 'Bereich' }),
            el('th', { text: 'Punkte' }),
            el('th', { text: 'Quote' }),
            el('th', { text: 'Bewertung' }),
          ),
        ),
        el('tbody', {}, ...scoreRows),
      ),
      el('p', { className: 'certificate-doc-text small muted', text: evaluation.decisionReason || '' }),
      el('footer', { className: 'certificate-doc-footer' },
        el('div', {},
          el('div', { className: 'label', text: 'Zertifikatsnummer' }),
          el('strong', { text: record.certificateNumber || '–' }),
          el('div', { className: 'small muted', style: { marginTop: '6px' }, text: `Ausgestellt am ${formatDate(record.certificateIssuedAt, true)}` }),
        ),
        el('div', {},
          el('div', { className: 'label', text: 'Ausstellende Stelle' }),
          el('div', { className: 'certificate-signature', text: record.certificateSignatureName || record.certificateIssuedBy || b.staffLabel }),
          el('div', { className: 'small muted', text: b.department }),
        ),
      ),
    );
  }

  function hideCertificateModal() {
    state.certificateRecord = null;
    if (!certificateOverlay) return;
    certificateOverlay.classList.add('hidden');
    certificateOverlay.setAttribute('aria-hidden', 'true');
    mount(certificateOverlay, el('div'));
  }

  function showCertificateModal(record) {
    if (!record?.certificateNumber || !certificateOverlay) return;
    state.certificateRecord = record;
    mount(certificateOverlay,
      el('div', { className: 'certificate-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Zertifikat' },
        el('div', { className: 'certificate-modal-toolbar' },
          el('strong', { text: 'Zertifikat' }),
          el('div', { className: 'inline-actions' },
            el('button', { className: 'btn btn-secondary', id: 'certificate-close', type: 'button', text: 'Schließen' }),
            el('button', { className: 'btn btn-primary', id: 'certificate-print', type: 'button', text: 'Drucken' }),
          ),
        ),
        buildCertificateDocument(record),
      ),
    );
    certificateOverlay.classList.remove('hidden');
    certificateOverlay.setAttribute('aria-hidden', 'false');
    document.getElementById('certificate-close')?.addEventListener('click', hideCertificateModal);
    document.getElementById('certificate-print')?.addEventListener('click', () => window.print());
    certificateOverlay?.addEventListener('click', (event) => {
      if (event.target === certificateOverlay) hideCertificateModal();
    }, { once: true });
  }

  function finishViewEnter(node) {
    if (!node) return;
    const cleanup = () => node.classList.remove('view-enter', 'view-enter-active');
    node.addEventListener('transitionend', cleanup, { once: true });
    window.setTimeout(cleanup, VIEW_ENTER_MS + 80);
  }

  function startViewEnter(node) {
    if (!node) return;
    node.classList.add('view-enter');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => node.classList.add('view-enter-active'));
    });
    finishViewEnter(node);
  }

  function mountView(node, onMounted) {
    const generation = ++mountGeneration;
    const current = root.firstElementChild;
    const shouldCrossfade = Boolean(state.animateNextView && current);

    const complete = () => {
      if (generation !== mountGeneration) return;
      if (typeof onMounted === 'function') onMounted();
    };

    const applyMount = () => {
      if (generation !== mountGeneration) return;
      mount(root, node);
      if (state.animateNextView) startViewEnter(root.firstElementChild);
      complete();
    };

    if (!shouldCrossfade) {
      applyMount();
      return;
    }

    current.classList.add('view-exit');
    window.clearTimeout(viewExitTimer);

    let swapped = false;
    const swap = () => {
      if (swapped || generation !== mountGeneration) return;
      swapped = true;
      window.clearTimeout(viewExitTimer);
      applyMount();
    };

    const onTransitionEnd = (event) => {
      if (event.target !== current) return;
      swap();
    };

    current.addEventListener('transitionend', onTransitionEnd);
    viewExitTimer = window.setTimeout(swap, VIEW_EXIT_MS);
  }

  function applyTheme(theme) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    state.theme = nextTheme;
    tabletStage?.setAttribute('data-theme', nextTheme);
    certificateOverlay?.setAttribute('data-theme', nextTheme);
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
    lastRenderedView = null;
    adminDelegationBound = false;
    wasTabletVisible = false;
    state.view = 'home';
    clearStaffSession();
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

  function buildLogoBrand(subtitle) {
    const b = state.branding;
    return el('div', { className: 'brand' },
      el('div', { className: 'logo-box' }, el('img', { src: b.logoUrl, alt: b.logoAlt })),
      el('div', {},
        el('div', { className: 'eyebrow', text: b.region }),
        el('h1', { text: b.department }),
        el('div', { className: 'muted', text: subtitle || b.subtitle }),
      ),
    );
  }

  function buildTopbar(extra = null) {
    return el('header', { className: 'card topbar' },
      buildLogoBrand(),
      el('div', { className: 'inline-actions' }, extra),
    );
  }

  function buildNotices() {
    const nodes = [];
    if (state.error) nodes.push(notice('error', icon('info'), el('span', { text: state.error })));
    if (state.info) nodes.push(notice('success', icon('check'), el('span', { text: state.info })));
    return frag(...nodes);
  }

  function fillNoticesSlot(slot) {
    if (!slot) return;
    const notices = buildNotices();
    slot.replaceChildren();
    if (notices.childNodes.length) slot.append(notices);
  }

  function staffInitials(name) {
    return String(name || '?').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }

  function renderHome() {
    const openLoginBtn = el('button', { className: 'btn btn-secondary', id: 'open-login', type: 'button' }, icon('lock'), ` ${state.branding.staffLabel}`);
    openLoginBtn.addEventListener('click', () => { state.view = 'login'; state.error = ''; render(); });

    const nameInput = el('input', { className: 'input', id: 'candidate-name', autocomplete: 'off', placeholder: 'Max Mustermann', required: true });
    const birthInput = el('input', { className: 'input', id: 'candidate-birth', type: 'date', required: true });
    const codeInput = el('input', { className: 'input code-input', id: 'candidate-code', maxlength: '9', placeholder: 'AB3K-7HNP', required: true });
    codeInput.addEventListener('input', () => {
      let value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      if (value.length > 4) value = `${value.slice(0, 4)}-${value.slice(4)}`;
      codeInput.value = value;
    });

    const candidateForm = el('form', { id: 'candidate-form' },
      field('Vollständiger Name', nameInput),
      field('Geburtsdatum', birthInput),
      field('Zugangscode', codeInput),
      el('div', { style: { height: '12px' } }),
      buildNotices(),
      el('button', { className: 'btn btn-primary', style: { width: '100%', marginTop: '16px' }, type: 'submit', text: 'Auswahlprüfung starten →' }),
    );
    candidateForm.addEventListener('submit', handleCandidateSubmit);

    mountView(
      el('div', { className: 'shell' },
        el('div', { className: 'wrap' },
          buildTopbar(openLoginBtn),
          el('section', { className: 'grid-home' },
            el('div', { className: 'card hero' },
              el('div', { className: 'hero-pattern' }),
              el('span', { className: 'pill' }, el('span', { className: 'pill-dot' }), ' Digitaler Eignungstest'),
              el('h2', { text: 'Behördliches Auswahlverfahren für Bewerberinnen und Bewerber' }),
              el('p', { text: `Die Prüfung wird einzeln, zeitgebunden und mit gesicherter Prüfungsansicht durchgeführt. Nach Abschluss steht das Ergebnis unmittelbar dem ${state.branding.staffLabel} zur Verfügung.` }),
              el('div', { className: 'stat-grid' },
                el('div', { className: 'stat' }, el('span', { text: 'Dauer' }), el('strong', { text: '25 Min.' })),
                el('div', { className: 'stat' }, el('span', { text: 'Bereiche' }), el('strong', { text: '4 Module' })),
                el('div', { className: 'stat' }, el('span', { text: 'Fragen' }), el('strong', { text: '20 Aufgaben' })),
              ),
            ),
            el('div', { className: 'card form-card' },
              el('div', { className: 'form-header-icon' }, icon('user')),
              el('div', { className: 'eyebrow', text: 'Bewerberzugang' }),
              el('h2', { text: 'Prüfung starten' }),
              el('p', { className: 'muted', text: `Name, Geburtsdatum und den einmaligen Zugangscode des ${state.branding.staffLabel} eingeben.` }),
              candidateForm,
            ),
          ),
        ),
      ),
    );
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
    const loginForm = el('form', { id: 'login-form' },
      field('Benutzername', el('input', { className: 'input', id: 'staff-user', autocomplete: 'username', placeholder: 'Benutzername eingeben', required: true })),
      field('Passwort', el('input', { className: 'input', id: 'staff-pass', type: 'password', autocomplete: 'current-password', placeholder: '••••••••', required: true })),
      buildNotices(),
      el('div', { className: 'login-actions' },
        el('button', { className: 'btn btn-secondary', id: 'login-back', type: 'button', text: '← Zurück' }),
        el('button', { className: 'btn btn-primary', type: 'submit' }, icon('lock'), ' Anmelden'),
      ),
    );
    loginForm.addEventListener('submit', handleLogin);
    loginForm.querySelector('#login-back')?.addEventListener('click', () => { state.view = 'home'; state.error = ''; render(); });

    mountView(
      el('div', { className: 'shell login-page' },
        el('div', { className: 'login-split' },
          el('aside', { className: 'login-brand' },
            buildLogoBrand(`Interner Zugang ${state.branding.staffLabel}`),
            el('div', { className: 'login-brand-body' },
              el('h2', { text: 'Zugang für autorisiertes Personal' }),
              el('p', { text: 'Verwaltung von Prüfungsakten, Bewerber-Zugangscodes und Zertifikatsausstellung.' }),
            ),
          ),
          el('section', { className: 'login-panel' },
            el('div', { className: 'form-header-icon' }, icon('lock')),
            el('h2', { text: `${state.branding.staffLabel} Login` }),
            el('p', { className: 'muted', text: 'Die Anmeldung wird ausschließlich serverseitig geprüft.' }),
            loginForm,
          ),
        ),
      ),
    );
  }

  function applyStaffSession(result, fallbackUsername = '') {
    state.staffName = result.displayName || fallbackUsername;
    state.staffRank = result.rank || state.branding.staffLabel;
    state.staffUsername = result.username || fallbackUsername;
    state.canChangePassword = result.canChangePassword === true;
    state.canResetStaffPassword = result.canResetStaffPassword === true;
  }

  function clearStaffSession() {
    state.staffName = '';
    state.staffRank = '';
    state.staffUsername = '';
    state.canChangePassword = false;
    state.canResetStaffPassword = false;
    state.staffAccounts = [];
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (state.loginPending) return;
    state.error = '';
    const form = event.currentTarget;
    const username = form.querySelector('#staff-user')?.value.trim() || '';
    const password = form.querySelector('#staff-pass')?.value || '';
    const submitButton = form.querySelector('button[type="submit"]');
    state.loginPending = true;
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await rpc('auth:login', { username, password });
      if (!result.success) throw new Error('Benutzername oder Passwort ist falsch.');
      applyStaffSession(result, username);
      state.view = 'admin';
      state.error = '';
      state.info = '';
      try {
        await refreshAdminData();
        startAdminPoll();
      } catch (refreshError) {
        stopAdminPoll();
        state.error = refreshError.message || 'Admin-Daten konnten nicht geladen werden.';
      }
      render();
    } catch (error) {
      await rpc('auth:logout').catch(() => {});
      clearStaffSession();
      state.view = 'login';
      state.error = error.message || 'Anmeldung fehlgeschlagen.';
      render();
    } finally {
      state.loginPending = false;
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
      setTimerContent(globalTimer, 'Restzeit ', formatTime(exam.globalTime));
      globalTimer.classList.toggle('danger', exam.globalTime < 300);
    }
    if (questionTimer && exam.questionTime !== null) {
      setTimerContent(questionTimer, 'Frage ', `${exam.questionTime}s`);
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

  function buildExamQuestionBody(question, exam) {
    const parts = [
      el('div', { className: 'section-tag', text: categoryLabel(question.category) }),
      el('h2', { className: 'question-title', text: question.title }),
    ];

    if (question.text) {
      const sourceText = el('div', { className: 'source-text' });
      setMultiline(sourceText, question.text);
      parts.push(sourceText);
    }

    if (question.stimulus) {
      parts.push(el('div', { className: 'source-text stimulus', html: question.stimulus }));
    }

    const questionText = el('div', { className: 'question-text' });
    setMultiline(questionText, question.question);
    parts.push(questionText);

    const options = el('div', { className: 'options', role: 'radiogroup' },
      ...question.options.map((option) => el('button', {
        className: `option${exam.selected === option.id ? ' selected' : ''}`,
        dataset: { option: option.id },
        type: 'button',
        'aria-pressed': exam.selected === option.id ? 'true' : 'false',
      },
        el('span', { className: 'option-key', text: option.id }),
        el('span', { className: 'option-text', text: option.text }),
      )),
    );
    parts.push(options);

    parts.push(el('div', { className: 'exam-actions' },
      el('span', { className: 'muted small', text: 'Antworten können nach dem Fortfahren nicht geändert werden.' }),
      el('button', {
        className: 'btn btn-primary',
        id: 'next-question',
        type: 'button',
        disabled: exam.selected === null,
        text: exam.index === exam.questions.length - 1 ? 'Prüfung abschließen' : 'Weiter →',
      }),
    ));

    return frag(...parts);
  }

  function bindExamHandlers() {
    const exam = state.exam;
    if (!exam) return;
    root.querySelectorAll('[data-option]').forEach((button) => {
      button.addEventListener('click', () => {
        exam.selected = button.dataset.option;
        updateExamSelection();
      });
    });
    document.getElementById('next-question')?.addEventListener('click', () => advanceQuestion(false));
  }

  function updateExamSelection() {
    const exam = state.exam;
    if (!exam) return;
    root.querySelectorAll('[data-option]').forEach((button) => {
      const selected = button.dataset.option === exam.selected;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      if (selected) {
        button.classList.remove('is-selecting');
        void button.offsetWidth;
        button.classList.add('is-selecting');
        window.setTimeout(() => button.classList.remove('is-selecting'), 320);
      }
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
      if (!questionTimer) {
        questionTimer = timerLabel('question', `Frage ${exam.questionTime}s`);
        row.prepend(questionTimer);
      } else {
        setTimerContent(questionTimer, 'Frage ', `${exam.questionTime}s`);
      }
    } else if (questionTimer) {
      questionTimer.remove();
    }
  }

  function buildBlockScreen() {
    return el('div', { className: 'block-screen' },
      el('div', { className: 'block-screen-inner' },
        icon('shield'),
        el('h2', { text: 'Prüfungsansicht gesperrt' }),
        el('p', {}, 'Der Bildschirminhalt wurde zum Schutz der Prüfung ausgeblendet.', el('br'), 'Kehren Sie zur Prüfungsansicht zurück.'),
      ),
    );
  }

  function updateExamBlockScreen() {
    const shell = root.querySelector('.exam-shell');
    if (!shell) return;
    const existing = shell.querySelector('.block-screen');
    if (state.blocked) {
      if (!existing) shell.append(buildBlockScreen());
    } else {
      existing?.remove();
    }
  }

  function updateExamProgress() {
    const exam = state.exam;
    if (!exam) return;
    const progress = ((exam.index + 1) / exam.questions.length) * 100;
    const bar = root.querySelector('[data-progress]');
    const label = root.querySelector('[data-progress-label]');
    if (bar) bar.style.width = `${progress}%`;
    if (label) label.textContent = `Frage ${exam.index + 1} von ${exam.questions.length}`;
  }

  function patchExamView(animate = true) {
    const exam = state.exam;
    if (!exam) return;
    const question = exam.questions[exam.index];
    const card = root.querySelector('[data-question-card]');
    if (!card) { renderExam(true); return; }

    const applyContent = () => {
      updateExamProgress();
      mount(card, buildExamQuestionBody(question, exam));
      bindExamHandlers();
      updateExamTimers();
      updateQuestionTimerVisibility();
      root.parentElement?.scrollTo({ top: 0, behavior: animate ? 'smooth' : 'auto' });
    };

    if (!animate) {
      applyContent();
      return;
    }

    card.classList.remove('is-entering');
    card.classList.add('is-changing');
    window.setTimeout(() => {
      applyContent();
      card.classList.remove('is-changing');
      void card.offsetWidth;
      card.classList.add('is-entering');
      window.setTimeout(() => card.classList.remove('is-entering'), EXAM_ENTER_MS);
    }, EXAM_EXIT_MS);
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

    const globalTimer = timerLabel('global', `Restzeit ${formatTime(exam.globalTime)}`);
    if (exam.globalTime < 300) globalTimer.classList.add('danger');

    const timerRowChildren = [];
    if (exam.questionTime !== null) {
      timerRowChildren.push(timerLabel('question', `Frage ${exam.questionTime}s`));
    }
    timerRowChildren.push(globalTimer);

    const examShell = el('div', { className: 'exam-shell' },
      el('header', { className: 'exam-header' },
        el('div', { className: 'exam-header-inner' },
          buildLogoBrand(`Verfahrensnummer: ${state.candidate?.candidateId || '–'}`),
          el('div', { className: 'timer-row' }, ...timerRowChildren),
        ),
      ),
      el('div', { className: 'progress-label', dataset: { progressLabel: '' }, text: `Frage ${exam.index + 1} von ${exam.questions.length}` }),
      el('div', { className: 'progress-wrap' },
        el('div', { className: 'progress', dataset: { progress: '' }, style: { width: `${progress}%` } }),
      ),
      el('main', { className: 'exam-main' },
        el('section', { className: 'card question-card', dataset: { questionCard: '' } },
          buildExamQuestionBody(question, exam),
        ),
      ),
    );

    if (state.blocked) examShell.append(buildBlockScreen());

    mountView(examShell, () => {
      const firstCard = root.querySelector('[data-question-card]');
      if (firstCard && state.animateNextView) {
        firstCard.classList.add('is-entering');
        window.setTimeout(() => firstCard.classList.remove('is-entering'), EXAM_ENTER_MS);
      }
      bindExamHandlers();
    });
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
      state.info = `Die Prüfung wurde erfolgreich an das ${state.branding.staffLabel} übermittelt.`;
      state.error = '';
    } catch (error) {
      state.error = `Speichern fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`;
    }
    render();
  }

  function renderSaving() {
    const hasError = Boolean(state.error);
    const statusChildren = [
      buildLogoBrand('Prüfung wird übermittelt'),
      el('div', { className: 'login-divider' }),
    ];

    if (hasError) {
      statusChildren.push(
        el('h2', { text: 'Speichern fehlgeschlagen' }),
        el('p', { className: 'muted', text: 'Die Antworten und Prüfungsdaten werden sicher in der Prüfungsakte gespeichert.' }),
        notice('error', icon('info'), el('span', { text: state.error })),
        el('button', { className: 'btn btn-primary', id: 'retry-save', type: 'button', style: { marginTop: '16px' }, text: 'Erneut speichern' }),
      );
    } else {
      statusChildren.push(
        el('div', { className: 'spinner' }),
        el('h2', { text: 'Abgabe wird gespeichert' }),
        el('p', { className: 'muted', text: 'Die Antworten und Prüfungsdaten werden sicher in der Prüfungsakte gespeichert.' }),
        el('div', { className: 'saving-steps' },
          el('div', { className: 'saving-step done' }, el('span', { className: 'step-dot' }), 'Antworten erfasst'),
          el('div', { className: 'saving-step active' }, el('span', { className: 'step-dot' }), 'Übermittlung an Server'),
          el('div', { className: 'saving-step' }, el('span', { className: 'step-dot' }), 'Bestätigung erhalten'),
        ),
        el('div', { className: 'notice notice-info', style: { marginTop: '20px' } }, icon('info'), el('span', { text: 'Bitte die Anwendung nicht schließen.' })),
      );
    }

    mountView(
      el('div', { className: 'shell login-page' },
        el('div', { className: 'status-page' },
          el('div', { className: 'status-card card' }, ...statusChildren),
        ),
      ),
      () => {
        document.getElementById('retry-save')?.addEventListener('click', submitPendingRecord);
      },
    );
  }

  function renderResult() {
    const receipt = state.result;
    if (!receipt) { state.view = 'home'; render(); return; }

    mountView(
      el('div', { className: 'shell login-page' },
        el('div', { className: 'status-page result-page' },
          el('section', { className: 'card result-card' },
            buildLogoBrand('Prüfung abgeschlossen'),
            el('div', { className: 'login-divider' }),
            el('div', { className: 'result-icon-wrap' }, icon('check')),
            el('h2', { text: 'Abgabe erfolgreich' }),
            el('p', { text: `Ihre Prüfung wurde gespeichert und an das ${state.branding.staffLabel} zur internen Prüfung übermittelt.` }),
            notice('info', icon('info'), el('span', { text: 'Das Ergebnis sowie eine mögliche Zertifikatsausstellung werden ausschließlich im Admin-Dashboard bearbeitet und in dieser Ansicht nicht angezeigt.' })),
            el('div', { className: 'detail-grid result-details' },
              el('div', { className: 'detail-box' }, el('div', { className: 'small muted', text: 'Bewerber' }), el('strong', { text: receipt.candidateName })),
              el('div', { className: 'detail-box' }, el('div', { className: 'small muted', text: 'Verfahrensnummer' }), el('strong', { text: receipt.candidateId })),
              el('div', { className: 'detail-box' }, el('div', { className: 'small muted', text: 'Abgegeben am' }), el('strong', { text: formatDate(receipt.completedAt, true) })),
              el('div', { className: 'detail-box' }, el('div', { className: 'small muted', text: 'Status' }), el('strong', { text: `Beim ${state.branding.staffLabel} eingegangen` })),
            ),
            el('div', { className: 'result-actions' },
              el('button', { className: 'btn btn-primary', id: 'result-home', type: 'button', text: 'Zur Startseite' }),
            ),
          ),
        ),
      ),
      () => {
        document.getElementById('result-home')?.addEventListener('click', () => {
          state.view = 'home';
          state.candidate = null;
          state.result = null;
          state.error = '';
          state.info = '';
          render();
        });
      },
    );
  }

  async function refreshAdminData() {
    if (!state.staffName) return;
    const tasks = [rpc('records:get'), rpc('codes:get')];
    if (state.canResetStaffPassword) tasks.push(rpc('staff:list'));
    const results = await Promise.all(tasks);
    const [records, codes, staffAccounts] = results;
    state.records = normalizeArray(records).sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
    state.codes = normalizeArray(codes).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    if (staffAccounts) {
      state.staffAccounts = normalizeArray(staffAccounts).sort((a, b) => String(a.username || '').localeCompare(String(b.username || ''), 'de'));
    }
    if (!state.selectedRecordId || !state.records.some((record) => record.recordId === state.selectedRecordId)) {
      state.selectedRecordId = state.records[0]?.recordId || null;
    }
    if (!state.records.some((record) => record.recordId === state.deleteConfirmRecordId)) state.deleteConfirmRecordId = null;
    if (state.records.length === 0) state.clearRecordsConfirm = false;
  }

  function startAdminPoll() {
    stopAdminPoll();
    adminPoll = window.setInterval(async () => {
      if (state.view !== 'admin' || !state.staffName || ['codes', 'settings'].includes(state.adminTab)) return;
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (['input', 'textarea', 'select'].includes(activeTag)) return;
      try { await refreshAdminData(); render(); } catch (_) {}
    }, 30000);
  }

  function stopAdminPoll() {
    if (adminPoll) window.clearInterval(adminPoll);
    adminPoll = null;
  }

  function buildRecordList() {
    const term = state.search.trim().toLowerCase();
    const filtered = state.records.filter((record) => !term || [record.candidateName, record.candidateId, record.certificateNumber].some((value) => String(value || '').toLowerCase().includes(term)));
    const searchInput = el('input', { className: 'input', id: 'record-search', value: state.search, placeholder: 'Akten durchsuchen' });
    const items = filtered.map((record) => {
      const active = record.recordId === state.selectedRecordId;
      const isPassed = record.evaluation?.finalDecision === 'BESTANDEN';
      return el('div', { className: `record-item${active ? ' active' : ''}` },
        el('button', { dataset: { record: record.recordId } },
          el('strong', { text: record.candidateName }),
          el('div', { className: 'small muted', text: record.candidateId }),
          el('div', { style: { marginTop: '7px' } },
            el('span', { className: `badge ${isPassed ? 'badge-pass' : 'badge-fail'}`, text: isPassed ? 'Bestanden' : 'Nicht bestanden' }),
          ),
        ),
      );
    });

    return el('div', {},
      el('div', { className: 'field' }, searchInput),
      el('div', { className: 'record-list' },
        items.length ? frag(...items) : el('div', { className: 'empty', text: 'Keine Akten gefunden.' }),
      ),
    );
  }

  function buildSecurityLog(record) {
    const incidents = normalizeArray(record.securityIncidents);
    if (!incidents.length) {
      return el('div', { className: 'security-log security-log--empty' },
        el('div', { className: 'eyebrow', text: 'Sicherheitsprotokoll' }),
        el('p', { className: 'small muted', text: 'Keine Sicherheitsereignisse während der Prüfung protokolliert.' }),
      );
    }

    return el('div', { className: 'security-log' },
      el('div', { className: 'eyebrow', text: 'Sicherheitsprotokoll' }),
      el('ul', { className: 'security-log-list' },
        ...incidents.map((item) => el('li', {
          className: `security-log-item${['SCREEN_CAPTURE', 'PHOTO_SUSPECTED', 'PRINT_SCREEN'].includes(item.type) ? ' security-log-item--alert' : ''}`,
        },
          el('div', { className: 'security-log-head' },
            el('strong', { text: incidentLabel(item.type) }),
            el('span', { className: 'small muted', text: formatDate(item.timestamp, true) }),
          ),
          el('div', { className: 'small', text: item.message || '–' }),
        )),
      ),
    );
  }

  function buildRecordDetail() {
    const record = state.records.find((item) => item.recordId === state.selectedRecordId);
    if (!record) return el('div', { className: 'empty', text: 'Noch keine Prüfungsakte vorhanden.' });

    const isPassed = record.evaluation?.finalDecision === 'BESTANDEN';
    const grade = getGradeInfo(record.evaluation);
    const scoreRows = Object.values(record.evaluation?.categoryScores || {}).map((score) => el('tr', {},
      el('td', { text: categoryLabel(score.category) }),
      el('td', { text: `${score.score}/${score.maxScore}` }),
      el('td', { text: `${Number(score.percentage || 0).toFixed(0)}%` }),
      el('td', { text: score.evaluation }),
    ));

    const certificateBox = record.certificateNumber
      ? el('div', { className: 'notice notice-success', style: { marginTop: '16px' } },
        el('strong', { text: 'Zertifikat ausgestellt' }),
        el('br'),
        `Nummer: ${record.certificateNumber}`,
        el('br'),
        el('span', { className: 'small', text: `Ausgestellt am ${formatDate(record.certificateIssuedAt, true)} durch ${record.certificateIssuedBy || '–'}` }),
      )
      : el('div', { className: 'notice notice-info', style: { marginTop: '16px' }, text: isPassed ? 'Die Prüfung ist bestanden. Das Zertifikat kann jetzt ausgestellt werden.' : 'Für eine nicht bestandene Prüfung kann kein Zertifikat ausgestellt werden.' });

    const certificateButton = record.certificateNumber
      ? el('button', { className: 'btn btn-primary', id: 'view-certificate', type: 'button', text: 'Zertifikat anzeigen' })
      : el('button', { className: 'btn btn-success', id: 'issue-certificate', type: 'button', disabled: !isPassed, text: 'Zertifikat ausstellen' });

    const deleteControls = state.deleteConfirmRecordId === record.recordId
      ? el('div', { className: 'notice notice-error', style: { marginTop: '16px' } },
        el('strong', { text: 'Akte endgültig löschen?' }),
        el('br'),
        'Dieser Vorgang kann nicht rückgängig gemacht werden.',
        el('div', { className: 'inline-actions', style: { marginTop: '12px' } },
          el('button', { className: 'btn btn-danger', id: 'confirm-delete-record', type: 'button', text: 'Löschen bestätigen' }),
          el('button', { className: 'btn btn-secondary', id: 'cancel-delete-record', type: 'button', text: 'Abbrechen' }),
        ),
      )
      : null;

    const clearControls = state.clearRecordsConfirm
      ? el('div', { className: 'notice notice-error', style: { marginTop: '16px' } },
        el('strong', { text: 'Alle Prüfungsakten endgültig löschen?' }),
        el('div', { className: 'inline-actions', style: { marginTop: '12px' } },
          el('button', { className: 'btn btn-danger', id: 'confirm-clear-records', type: 'button', text: 'Alle löschen bestätigen' }),
          el('button', { className: 'btn btn-secondary', id: 'cancel-clear-records', type: 'button', text: 'Abbrechen' }),
        ),
      )
      : null;

    return el('div', {},
      el('div', { className: 'eyebrow', text: 'Prüfungsakte' }),
      el('h2', { text: record.candidateName }),
      el('div', { className: 'detail-grid' },
        el('div', { className: 'detail-box' }, el('div', { className: 'small muted', text: 'Verfahrensnummer' }), el('strong', { text: record.candidateId })),
        el('div', { className: 'detail-box' }, el('div', { className: 'small muted', text: 'Geburtsdatum' }), el('strong', { text: formatDate(record.candidateBirthDate) })),
        el('div', { className: 'detail-box' }, el('div', { className: 'small muted', text: 'Abschluss' }), el('strong', { text: formatDate(record.completedAt, true) })),
        el('div', { className: 'detail-box' },
          el('div', { className: 'small muted', text: 'Gesamtergebnis' }),
          el('strong', { className: isPassed ? 'result-pass' : 'result-fail', text: `${Number(record.evaluation?.totalPercentage || 0).toFixed(1)}% · ${record.evaluation?.decisionLabel || ''}` }),
        ),
        el('div', { className: 'detail-box' },
          el('div', { className: 'small muted', text: 'Note' }),
          el('strong', { text: `${grade.note} · ${grade.label}` }),
        ),
      ),
      el('table', { className: 'score-table' },
        el('thead', {},
          el('tr', {},
            el('th', { text: 'Bereich' }),
            el('th', { text: 'Punkte' }),
            el('th', { text: 'Quote' }),
            el('th', { text: 'Bewertung' }),
          ),
        ),
        el('tbody', {}, ...scoreRows),
      ),
      el('div', { className: 'notice notice-info', style: { marginTop: '16px' }, text: record.evaluation?.decisionReason || '' }),
      record.evaluation?.categoriesPassed === false && normalizeArray(record.evaluation?.weakCategories).length
        ? el('div', { className: 'notice notice-warning', style: { marginTop: '12px' }, text: `Unter Mindestanforderung in: ${normalizeArray(record.evaluation.weakCategories).map((c) => categoryLabel(c)).join(', ')}` })
        : null,
      buildSecurityLog(record),
      el('p', { className: 'small muted', text: `Bearbeitungsstatus: ${record.reviewStatus || 'AUSSTEHEND'}` }),
      certificateBox,
      deleteControls,
      clearControls,
      el('div', { className: 'inline-actions', style: { marginTop: '16px' } },
        certificateButton,
        el('button', { className: 'btn btn-danger', id: 'delete-record', type: 'button', text: 'Akte löschen' }),
        el('button', { className: 'btn btn-danger', id: 'clear-records', type: 'button', text: 'Alle Akten löschen' }),
        el('button', { className: 'btn btn-secondary', id: 'refresh-admin', type: 'button', text: 'Aktualisieren' }),
      ),
    );
  }

  function buildSettingsManager() {
    const sections = [];

    if (state.canChangePassword) {
      sections.push(
        el('div', { className: 'settings-section' },
          el('div', { className: 'eyebrow', text: 'Eigenes Konto' }),
          el('h2', { text: 'Passwort ändern' }),
          el('p', { className: 'muted', text: 'Nur Police-Ränge, die in der config.lua unter ChangePasswordRankIds eingetragen sind, dürfen hier das Passwort ändern.' }),
          el('form', { id: 'change-password-form' },
            field('Aktuelles Passwort', el('input', { className: 'input', id: 'current-password', type: 'password', autocomplete: 'current-password', required: true })),
            field('Neues Passwort', el('input', { className: 'input', id: 'new-password', type: 'password', autocomplete: 'new-password', minLength: 8, required: true })),
            field('Neues Passwort bestätigen', el('input', { className: 'input', id: 'confirm-password', type: 'password', autocomplete: 'new-password', minLength: 8, required: true })),
            el('button', { className: 'btn btn-primary', type: 'submit' }, icon('lock'), ' Passwort speichern'),
          ),
        ),
      );
    }

    if (state.canResetStaffPassword) {
      const accountItems = state.staffAccounts.map((account) => el('div', { className: 'code-item' },
        el('strong', { text: account.displayName || account.username }),
        el('div', { className: 'small muted', text: `${account.username} · ${account.rank || `Rang ${account.rankId ?? '–'}`}` }),
        el('form', { className: 'inline-reset-form', dataset: { resetUser: account.username } },
          field('Neues Passwort', el('input', { className: 'input', type: 'password', autocomplete: 'new-password', minLength: 8, required: true })),
          el('button', { className: 'btn btn-secondary', type: 'submit', text: 'Passwort zurücksetzen' }),
        ),
      ));

      sections.push(
        el('div', { className: 'settings-section', style: { marginTop: '24px' } },
          el('div', { className: 'eyebrow', text: 'Personalverwaltung' }),
          el('h2', { text: 'Passwörter anderer Konten' }),
          el('p', { className: 'muted', text: 'Nur Police-Ränge aus ResetStaffPasswordRankIds in der config.lua. Der Rang wird aus dem Police-Job (grade) gelesen.' }),
          el('div', { className: 'code-list' },
            accountItems.length ? frag(...accountItems) : el('div', { className: 'empty', text: 'Keine Personal-Konten gefunden.' }),
          ),
        ),
      );
    }

    if (!sections.length) {
      return el('div', { className: 'empty', text: 'Für Ihren Rang sind keine Systemeinstellungen verfügbar.' });
    }

    return el('div', {}, ...sections);
  }

  function buildAdminSidebarContent() {
    if (state.adminTab === 'records') return buildRecordList();
    if (state.adminTab === 'codes') return buildCodeList();
    return el('div', { className: 'empty', text: 'Passwort- und Kontoeinstellungen werden rechts bearbeitet.' });
  }

  function buildAdminMainContent() {
    if (state.adminTab === 'records') return buildRecordDetail();
    if (state.adminTab === 'codes') return buildCodeManager();
    return buildSettingsManager();
  }

  function buildCodeList() {
    const items = state.codes.map((code) => el('div', { className: 'code-item' },
      el('span', { className: 'code-value', text: code.code }),
      el('div', { className: 'small', text: `${code.candidateName} · ${formatDate(code.candidateBirthDate)}` }),
      el('div', { className: 'small muted', text: code.used ? `Verwendet von ${code.usedBy || '–'}` : '● Verfügbar' }),
      el('button', { className: 'btn btn-danger', style: { marginTop: '4px', padding: '7px 12px', fontSize: '0.8125rem' }, dataset: { deleteCode: code.code }, text: 'Löschen' }),
    ));

    return el('div', { className: 'code-list' },
      items.length ? frag(...items) : el('div', { className: 'empty', text: 'Noch keine Zugangscodes.' }),
    );
  }

  function buildCodeManager() {
    const openCount = state.codes.filter((code) => !code.used).length;
    const usedCount = state.codes.filter((code) => code.used).length;
    return el('div', {},
      el('div', { className: 'eyebrow', text: 'Bewerberzugang' }),
      el('h2', { text: 'Einmaligen Zugangscode erstellen' }),
      el('p', { className: 'muted', text: 'Der Code ist an den eingegebenen Namen und das Geburtsdatum gebunden.' }),
      el('form', { id: 'create-code-form' },
        el('div', { className: 'code-row' },
          field('Name des Bewerbers', el('input', { className: 'input', id: 'new-code-name', placeholder: 'Max Mustermann', required: true })),
          field('Geburtsdatum', el('input', { className: 'input', id: 'new-code-birth', type: 'date', required: true })),
          el('button', { className: 'btn btn-primary', type: 'submit', style: { marginBottom: '16px' } }, icon('key'), ' Code erstellen'),
        ),
      ),
      notice('info', icon('info'), el('span', { text: `Offene Codes: ${openCount} · Bereits verwendet: ${usedCount}` })),
    );
  }

  function scheduleAdminSearchRender() {
    window.clearTimeout(searchRenderTimer);
    searchRenderTimer = window.setTimeout(() => {
      const input = document.getElementById('record-search');
      const hadFocus = document.activeElement === input;
      const cursor = hadFocus && input ? input.selectionStart : null;
      render();
      if (hadFocus) {
        const nextInput = document.getElementById('record-search');
        if (nextInput) {
          nextInput.focus();
          if (cursor != null) nextInput.setSelectionRange(cursor, cursor);
        }
      }
    }, 120);
  }

  function setupAdminDelegation() {
    const layout = root.querySelector('[data-admin-root]');
    if (!layout || adminDelegationBound) return;
    adminDelegationBound = true;

    layout.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-tab]');
      if (tab) {
        state.adminTab = tab.dataset.tab;
        state.error = '';
        state.info = '';
        render();
        return;
      }
      const recordBtn = event.target.closest('[data-record]');
      if (recordBtn) {
        state.selectedRecordId = recordBtn.dataset.record;
        state.deleteConfirmRecordId = null;
        state.clearRecordsConfirm = false;
        render();
        return;
      }
      const deleteCodeBtn = event.target.closest('[data-delete-code]');
      if (deleteCodeBtn) {
        deleteCode(deleteCodeBtn.dataset.deleteCode);
        return;
      }
      if (event.target.closest('#delete-record')) requestDeleteSelectedRecord();
      else if (event.target.closest('#confirm-delete-record')) deleteSelectedRecord();
      else if (event.target.closest('#cancel-delete-record')) cancelDeleteSelectedRecord();
      else if (event.target.closest('#clear-records')) requestClearRecords();
      else if (event.target.closest('#confirm-clear-records')) clearRecords();
      else if (event.target.closest('#cancel-clear-records')) cancelClearRecords();
      else if (event.target.closest('#issue-certificate')) issueCertificate();
      else if (event.target.closest('#view-certificate')) {
        const record = state.records.find((item) => item.recordId === state.selectedRecordId);
        if (record) showCertificateModal(record);
      } else if (event.target.closest('#refresh-admin')) {
        refreshAdminData().then(() => render()).catch((error) => {
          state.error = error.message || 'Aktualisierung fehlgeschlagen.';
          render();
        });
      }
    });

    layout.addEventListener('input', (event) => {
      if (event.target.id === 'record-search') {
        state.search = event.target.value;
        scheduleAdminSearchRender();
      }
    });

    layout.addEventListener('submit', (event) => {
      if (event.target.id === 'create-code-form') createCode(event);
      else if (event.target.id === 'change-password-form') changePassword(event);
      else if (event.target.closest('[data-reset-user]')) resetStaffPassword(event);
    });
  }

  async function changePassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const currentPassword = form.querySelector('#current-password')?.value || '';
    const newPassword = form.querySelector('#new-password')?.value || '';
    const confirmPassword = form.querySelector('#confirm-password')?.value || '';
    if (newPassword !== confirmPassword) {
      state.error = 'Die neuen Passwörter stimmen nicht überein.';
      state.info = '';
      render();
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      await rpc('auth:changePassword', { currentPassword, newPassword });
      form.reset();
      state.info = 'Ihr Passwort wurde erfolgreich geändert.';
      state.error = '';
    } catch (error) {
      state.error = error.message || 'Passwort konnte nicht geändert werden.';
      state.info = '';
    }
    if (submitButton) submitButton.disabled = false;
    render();
  }

  async function resetStaffPassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const username = form.dataset.resetUser;
    const newPassword = form.querySelector('input[type="password"]')?.value || '';
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      await rpc('auth:resetStaffPassword', { username, newPassword });
      form.reset();
      state.info = `Das Passwort für ${username} wurde zurückgesetzt.`;
      state.error = '';
    } catch (error) {
      state.error = error.message || 'Passwort konnte nicht zurückgesetzt werden.';
      state.info = '';
    }
    if (submitButton) submitButton.disabled = false;
    render();
  }

  function patchAdminView() {
    const layout = root.querySelector('[data-admin-root]');
    if (!layout) return false;

    const passed = state.records.filter((record) => record.evaluation?.finalDecision === 'BESTANDEN').length;
    const openCodes = state.codes.filter((code) => !code.used).length;

    layout.querySelector('[data-admin-stat-records]')?.replaceChildren(String(state.records.length));
    layout.querySelector('[data-admin-stat-passed]')?.replaceChildren(String(passed));
    layout.querySelector('[data-admin-stat-codes]')?.replaceChildren(String(openCodes));

    layout.querySelectorAll('[data-tab]').forEach((button) => {
      const active = button.dataset.tab === state.adminTab;
      button.className = `btn tab${active ? ' active' : ' btn-secondary'}`;
    });

    const sidebar = layout.querySelector('[data-admin-sidebar]');
    if (sidebar) sidebar.replaceChildren(buildAdminSidebarContent());

    const main = layout.querySelector('[data-admin-main]');
    if (main) main.replaceChildren(buildAdminMainContent());

    fillNoticesSlot(layout.querySelector('[data-notices]'));
    return true;
  }

  function renderAdmin() {
    const passed = state.records.filter((record) => record.evaluation?.finalDecision === 'BESTANDEN').length;
    const openCodes = state.codes.filter((code) => !code.used).length;

    const staffBadge = el('div', { className: 'staff-badge' },
      el('div', { className: 'staff-avatar', text: staffInitials(state.staffName) }),
      el('div', {},
        el('strong', { text: state.staffName }),
        el('br'),
        el('span', { className: 'small muted', text: state.staffRank }),
      ),
    );
    const logoutBtn = el('button', { className: 'btn btn-secondary', id: 'logout', type: 'button' }, icon('logout'), ' Abmelden');
    logoutBtn.addEventListener('click', logout);

    const showSettingsTab = state.canChangePassword || state.canResetStaffPassword;
    const tabs = [
      el('button', { className: `btn tab${state.adminTab === 'records' ? ' active' : ' btn-secondary'}`, dataset: { tab: 'records' }, text: 'Prüfungsakten' }),
      el('button', { className: `btn tab${state.adminTab === 'codes' ? ' active' : ' btn-secondary'}`, dataset: { tab: 'codes' }, text: 'Zugangscodes' }),
    ];
    if (showSettingsTab) {
      tabs.push(el('button', { className: `btn tab${state.adminTab === 'settings' ? ' active' : ' btn-secondary'}`, dataset: { tab: 'settings' }, text: 'Einstellungen' }));
    }

    mountView(
      el('div', { className: 'shell', dataset: { adminRoot: '' } },
        el('div', { className: 'wrap' },
          buildTopbar(frag(staffBadge, logoutBtn)),
          el('div', { dataset: { notices: '' } }, buildNotices()),
          el('div', { className: 'admin-layout' },
            el('aside', { className: 'card sidebar' },
              el('div', { className: 'eyebrow', text: 'Verwaltung' }),
              el('h2', { text: state.branding.staffLabel }),
              el('div', { className: 'admin-stats' },
                el('div', { className: 'admin-stat' }, el('strong', { dataset: { adminStatRecords: '' }, text: String(state.records.length) }), el('span', { text: 'Akten' })),
                el('div', { className: 'admin-stat' }, el('strong', { dataset: { adminStatPassed: '' }, text: String(passed) }), el('span', { text: 'Bestanden' })),
                el('div', { className: 'admin-stat' }, el('strong', { dataset: { adminStatCodes: '' }, text: String(openCodes) }), el('span', { text: 'Codes' })),
              ),
              el('div', { className: 'tabs' }, ...tabs),
              el('div', { dataset: { adminSidebar: '' } }, buildAdminSidebarContent()),
            ),
            el('main', { className: 'card content', dataset: { adminMain: '' } }, buildAdminMainContent()),
          ),
        ),
      ),
      () => setupAdminDelegation(),
    );
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
    let issuedRecord = null;
    try {
      const result = await rpc('record:issueCertificate', { recordId: record.recordId });
      const certificateNumber = result.record?.certificateNumber;
      if (!certificateNumber) throw new Error('Der Server hat kein Zertifikat zurückgegeben.');
      await refreshAdminData();
      issuedRecord = state.records.find((item) => item.recordId === record.recordId);
      state.info = `Zertifikat ${certificateNumber} wurde ausgestellt.`;
      state.error = '';
    } catch (error) {
      state.error = error.message || 'Zertifikat konnte nicht ausgestellt werden.';
      state.info = '';
    }
    render();
    if (issuedRecord) showCertificateModal(issuedRecord);
  }

  async function logout() {
    await rpc('auth:logout').catch(() => {});
    stopAdminPoll();
    adminDelegationBound = false;
    clearStaffSession();
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
    const previousView = lastRenderedView;
    state.animateNextView = false;
    if (previousView === 'admin' && state.view === 'admin' && patchAdminView()) return;
    lastRenderedView = state.view;
    if (state.view === 'home') renderHome();
    else if (state.view === 'login') renderLogin();
    else if (state.view === 'exam') renderExam();
    else if (state.view === 'saving') renderSaving();
    else if (state.view === 'result') renderResult();
    else if (state.view === 'admin') renderAdmin();
  }

  closeBtn?.addEventListener('click', closeNui);
  themeBtn?.addEventListener('click', toggleTheme);
  applyBranding();
  initTheme();

  window.addEventListener('message', async (event) => {
    const message = event.data || {};
    if (message.type === 'police_exam:branding' && message.branding) {
      applyBranding(message.branding);
      if (state.visible) render();
      return;
    }
    if (message.type === 'police_exam:visibility') {
      const wasVisible = state.visible;
      state.visible = message.visible === true;
      if (state.visible && !wasVisible) resetSession();
      render();
    }
    if (message.type === 'police_exam:dataChanged' && state.view === 'admin' && state.staffName) {
      try { await refreshAdminData(); render(); } catch (_) {}
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.certificateRecord) {
      event.preventDefault();
      hideCertificateModal();
      return;
    }
    if (event.key === 'Escape' && state.view !== 'exam' && state.view !== 'saving') closeNui();
    if (state.view === 'saving') { event.preventDefault(); return; }
    if (state.view !== 'exam') return;
    if (event.key === 'Escape') { event.preventDefault(); registerIncident('RESTRICTED_ACTION', 'Schließen der Prüfungsansicht wurde blockiert.'); return; }
    if (isScreenshotAttempt(event)) {
      event.preventDefault();
      registerScreenshotAttempt(event);
      return;
    }
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && ['c', 'x', 'v', 'u', 's'].includes(key)) {
      event.preventDefault();
      registerIncident('RESTRICTED_ACTION', 'Nicht zulässige Tastenkombination erkannt – in der Akte vermerkt.');
      return;
    }
    if (event.key === 'F12') { event.preventDefault(); registerIncident('RESTRICTED_ACTION', 'Entwicklertools wurden blockiert – in der Akte vermerkt.'); }
  });

  window.addEventListener('keyup', (event) => {
    if (state.view !== 'exam') return;
    if (event.code === 'PrintScreen' || event.key === 'PrintScreen') {
      event.preventDefault();
      registerScreenshotAttempt(event);
    }
  });

  document.addEventListener('contextmenu', (event) => {
    if (state.view !== 'exam') return;
    event.preventDefault();
    registerIncident('CONTEXT_MENU', 'Rechtsklick während der Prüfung blockiert – in der Akte vermerkt.');
  });
  document.addEventListener('copy', (event) => {
    if (state.view !== 'exam') return;
    event.preventDefault();
    registerIncident('COPY_ATTEMPT', 'Kopieren während der Prüfung blockiert – in der Akte vermerkt.');
  });
  document.addEventListener('cut', (event) => {
    if (state.view !== 'exam') return;
    event.preventDefault();
    registerIncident('CUT_ATTEMPT', 'Ausschneiden während der Prüfung blockiert.');
  });
  document.addEventListener('paste', (event) => {
    if (state.view !== 'exam') return;
    event.preventDefault();
    registerIncident('PASTE_ATTEMPT', 'Einfügen während der Prüfung blockiert.');
  });
  document.addEventListener('visibilitychange', () => {
    if (state.view !== 'exam') return;
    state.blocked = document.hidden;
    if (document.hidden) {
      registerIncident('PHOTO_SUSPECTED', 'Prüfungsansicht verlassen – mögliche externe Aufnahme (Screenshot/Handy-Foto) in der Akte vermerkt.');
    }
    updateExamBlockScreen();
  });
  window.addEventListener('blur', () => {
    if (state.view !== 'exam') return;
    state.blocked = true;
    registerIncident('PHOTO_SUSPECTED', 'Fokus von der Prüfung abgewendet – mögliches Abfotografieren oder Screenshot in der Akte vermerkt.');
    updateExamBlockScreen();
  });
  window.addEventListener('focus', () => {
    if (state.view !== 'exam') return;
    state.blocked = false;
    updateExamBlockScreen();
  });

  render();
})();
