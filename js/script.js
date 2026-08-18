(() => {
  'use strict';

  const ROUTES = [
    'Вступ',
    'Цінність і бізнес-модель',
    'Від цінності до участі',
    'Де черпати натхнення',
    'Рамка для «Портфеля мера»',
    'Підсумкова перевірка',
    'Завершення'
  ];

  const KEYS = Object.freeze({
    progress: 'ucan_l09_progress_v1',
    portfolio: 'ucan_l09_portfolio_v1',
    formative: 'ucan_l09_formative_v1',
    assessment: 'ucan_l09_assessment_v1'
  });

  const ASSESSMENT_KEY = Object.freeze({ q1: 'C', q2: 'A', q3: 'D', q4: 'B', q5: 'A' });
  const PORTFOLIO_IDS = ['pfValue', 'pfRecipients', 'pfPrivate', 'pfRole', 'pfVerify'];
  const qaMode = new URLSearchParams(window.location.search).get('qa') === '1';

  let state = {
    route: 0,
    formative: { selected: '', checked: false },
    assessment: { answers: {}, checked: false, pass: false, dirty: false, score: null }
  };
  let qaReturnRoute = 0;

  const els = {};
  const byId = (id) => document.getElementById(id);

  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function readStorage() {
    const progress = safeParse(localStorage.getItem(KEYS.progress), { route: 0 });
    const formative = safeParse(localStorage.getItem(KEYS.formative), { selected: '', checked: false });
    const assessment = safeParse(localStorage.getItem(KEYS.assessment), { answers: {}, checked: false, pass: false, dirty: false, score: null });
    const rawRoute = Number.isInteger(progress.route) ? Math.min(5, Math.max(0, progress.route)) : 0;
    if (progress.routeOrder === 'v1.1') {
      state.route = rawRoute;
    } else {
      // v1.0 compatibility: Resources and Portfolio swapped positions in v1.1.
      state.route = rawRoute === 3 ? 4 : rawRoute === 4 ? 3 : rawRoute;
      try { localStorage.setItem(KEYS.progress, JSON.stringify({ route: state.route, routeOrder: 'v1.1' })); } catch (_) {}
    }
    state.formative = { selected: formative.selected || '', checked: Boolean(formative.checked) };
    state.assessment = {
      answers: assessment.answers && typeof assessment.answers === 'object' ? assessment.answers : {},
      checked: Boolean(assessment.checked),
      pass: Boolean(assessment.pass),
      dirty: Boolean(assessment.dirty),
      score: Number.isInteger(assessment.score) ? assessment.score : null
    };
    if (state.assessment.dirty) state.assessment.pass = false;
  }

  function writeProgress() {
    localStorage.setItem(KEYS.progress, JSON.stringify({ route: state.route, routeOrder: 'v1.1' }));
  }
  function writeFormative() {
    localStorage.setItem(KEYS.formative, JSON.stringify(state.formative));
  }
  function writeAssessment() {
    localStorage.setItem(KEYS.assessment, JSON.stringify(state.assessment));
  }

  function readPortfolio() {
    return safeParse(localStorage.getItem(KEYS.portfolio), {
      pfValue: '', pfRecipients: '', pfPrivate: '', pfRole: '', pfVerify: ''
    });
  }

  function collectPortfolioFromDom() {
    const data = {};
    PORTFOLIO_IDS.forEach((id) => { data[id] = byId(id).value; });
    return data;
  }

  const PREVIEW_MAP = Object.freeze({
    pfValue: 'previewValue',
    pfRecipients: 'previewRecipients',
    pfPrivate: 'previewPrivate',
    pfRole: 'previewRole',
    pfVerify: 'previewVerify'
  });

  function portfolioHasContent(data = collectPortfolioFromDom()) {
    return PORTFOLIO_IDS.some((id) => String(data[id] || '').trim().length > 0);
  }

  function updatePortfolioPreview() {
    const data = collectPortfolioFromDom();
    Object.entries(PREVIEW_MAP).forEach(([sourceId, targetId]) => {
      const target = byId(targetId);
      if (!target) return;
      const text = String(data[sourceId] || '').trim();
      target.textContent = text || 'ще не заповнено';
    });
    updateCompletionPanel(data);
  }

  function updateCompletionPanel(data = collectPortfolioFromDom()) {
    if (!els.completionPortfolioStatus || !els.completionAssessmentStatus) return;
    els.completionAssessmentStatus.innerHTML = canComplete() ? '<strong>Статус:</strong> 5/5 — підсумкова перевірка пройдена.' : '<strong>Статус:</strong> підсумкова перевірка ще не має поточного результату 5/5.';
    if (portfolioHasContent(data)) {
      els.completionPortfolioStatus.textContent = 'У рамці є Ваші локальні записи. Ви можете повернутися до них і продовжити уточнення.';
    } else {
      els.completionPortfolioStatus.textContent = 'Рамка ще не заповнена у цьому браузері. Ви можете повернутися до неї після завершення тесту.';
    }
  }

  function persistPortfolio(silent = true) {
    try {
      localStorage.setItem(KEYS.portfolio, JSON.stringify(collectPortfolioFromDom()));
      updatePortfolioPreview();
      if (!silent) els.portfolioStatus.textContent = 'Рамку збережено у цьому браузері.';
      updateQaPanel();
      return true;
    } catch (_) {
      if (!silent) els.portfolioStatus.textContent = 'Не вдалося зберегти рамку у цьому браузері.';
      return false;
    }
  }

  function restorePortfolioToDom() {
    const data = readPortfolio();
    PORTFOLIO_IDS.forEach((id) => { byId(id).value = data[id] || ''; });
    updatePortfolioPreview();
  }

  function canComplete() {
    return state.assessment.checked && state.assessment.pass && !state.assessment.dirty && state.assessment.score === 5;
  }

  function showRoute(index, options = {}) {
    const { fromQa = false, saveProgress = true } = options;
    if (index < 0 || index >= ROUTES.length) return false;
    if (index === 6 && !canComplete() && !(qaMode && fromQa)) return false;

    document.querySelectorAll('[data-route-panel]').forEach((panel) => {
      panel.hidden = Number(panel.dataset.routePanel) !== index;
    });

    if (!(qaMode && fromQa)) state.route = index;
    const effectiveRoute = index;
    if (saveProgress && !(qaMode && fromQa) && index <= 5) writeProgress();

    els.currentRouteTitle.textContent = ROUTES[effectiveRoute];
    els.pageCounter.textContent = `Сторінка ${effectiveRoute + 1} з 7`;
    const percent = Math.round(((effectiveRoute + 1) / 7) * 100);
    els.progressPercent.textContent = `${percent}%`;
    els.progressBar.style.width = `${((effectiveRoute + 1) / 7) * 100}%`;
    els.progressTrack.setAttribute('aria-valuenow', String(effectiveRoute + 1));
    els.progressTrack.setAttribute('aria-valuetext', `Сторінка ${effectiveRoute + 1} з 7`);

    document.querySelectorAll('.route-tab').forEach((tab) => {
      const tabIndex = Number(tab.dataset.route);
      if (tabIndex === effectiveRoute) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });

    renderNav(effectiveRoute);
    updateCompletionPanel();
    updateQaPanel(effectiveRoute);
    if (!options.preserveFocus) {
      const heading = document.querySelector(`[data-route-panel="${effectiveRoute}"] h1`);
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    return true;
  }

  function renderNav(effectiveRoute = state.route) {
    const completion = canComplete();
    const completionTab = document.querySelector('.route-tab[data-route="6"]');
    completionTab.disabled = !(completion || qaMode);
    completionTab.setAttribute('aria-disabled', String(!(completion || qaMode)));
    const lockLabel = completionTab.querySelector('.lock-label');
    if (completion) {
      lockLabel.textContent = 'Відкрито';
      completionTab.setAttribute('aria-label', 'Завершення — відкрито');
    } else if (qaMode) {
      lockLabel.textContent = 'QA перегляд';
      completionTab.setAttribute('aria-label', 'Завершення — доступно лише для QA перегляду');
    } else {
      lockLabel.textContent = 'Заблоковано';
      completionTab.setAttribute('aria-label', 'Завершення — заблоковано до результату 5 з 5');
    }

    els.backRoute.disabled = effectiveRoute === 0;
    els.backRoute.setAttribute('aria-disabled', String(effectiveRoute === 0));

    if (effectiveRoute === 6) {
      els.nextRoute.hidden = true;
      els.nextLesson.hidden = false;
      els.nextLesson.disabled = true;
      els.nextLesson.setAttribute('aria-disabled', 'true');
    } else {
      els.nextLesson.hidden = true;
      els.nextRoute.hidden = false;
      if (effectiveRoute === 5) {
        els.nextRoute.textContent = 'До завершення →';
        els.nextRoute.disabled = !completion;
        els.nextRoute.setAttribute('aria-disabled', String(!completion));
      } else {
        els.nextRoute.textContent = 'Далі →';
        els.nextRoute.disabled = false;
        els.nextRoute.setAttribute('aria-disabled', 'false');
      }
    }
  }

  function restoreFormative() {
    if (state.formative.selected) {
      const input = document.querySelector(`input[name="formative"][value="${state.formative.selected}"]`);
      if (input) input.checked = true;
    }
    if (state.formative.checked) showFormativeFeedback();
  }

  function showFormativeFeedback() {
    els.formativeFeedback.hidden = false;
    const correct = state.formative.selected === 'C';
    els.formativeFeedback.dataset.kind = correct ? 'success' : 'retry';
    els.formativeFeedback.textContent = 'Правильна логіка — C. Фінансові інструменти й фінансові розрахунки передчасні, доки команда не сформулювала, яку цінність створює NBS-рішення, хто її отримує і чому приватна сторона потенційно може мати реальний інтерес до участі. Формативна практика не оцінюється і не блокує рух далі.';
  }

  function handleFormativeSubmit(event) {
    event.preventDefault();
    const selected = new FormData(els.formativeForm).get('formative');
    if (!selected) {
      els.formativeFeedback.hidden = false;
      els.formativeFeedback.dataset.kind = 'retry';
      els.formativeFeedback.textContent = 'Оберіть один варіант, а потім перевірте відповідь.';
      return;
    }
    state.formative = { selected: String(selected), checked: true };
    writeFormative();
    showFormativeFeedback();
    updateQaPanel();
  }

  function restoreAssessment() {
    Object.entries(state.assessment.answers).forEach(([q, value]) => {
      const input = document.querySelector(`input[name="${q}"][value="${value}"]`);
      if (input) input.checked = true;
    });
    renderAssessmentFeedback();
  }

  function renderAssessmentFeedback() {
    document.querySelectorAll('.assessment-question').forEach((field) => {
      field.removeAttribute('data-state');
      const p = field.querySelector('.question-feedback');
      p.textContent = '';
      const q = field.dataset.question;
      if (state.assessment.checked && !state.assessment.dirty) {
        const isCorrect = state.assessment.answers[q] === ASSESSMENT_KEY[q];
        field.dataset.state = isCorrect ? 'correct' : 'incorrect';
        p.textContent = isCorrect ? 'Правильно.' : 'Перегляньте відповідь і спробуйте ще раз.';
      } else if (state.assessment.dirty && state.assessment.answers[q]) {
        p.textContent = 'Відповідь змінено. Перевірте поточні відповіді ще раз.';
      }
    });

    if (state.assessment.checked && !state.assessment.dirty && Number.isInteger(state.assessment.score)) {
      els.assessmentFeedback.hidden = false;
      if (state.assessment.pass) {
        els.assessmentFeedback.dataset.kind = 'success';
        els.assessmentFeedback.textContent = 'Результат: 5/5. Завершення заняття відкрито.';
      } else {
        els.assessmentFeedback.dataset.kind = 'retry';
        els.assessmentFeedback.textContent = `Результат: ${state.assessment.score}/5. Якщо результат менший за 5/5, перегляньте, чи не змішали Ви логіку цінності й участі з фінансовими інструментами. Ви можете змінити відповіді та перевірити ще раз. Після 5/5 відкривається завершення заняття.`;
      }
    } else if (state.assessment.dirty) {
      els.assessmentFeedback.hidden = false;
      els.assessmentFeedback.dataset.kind = 'retry';
      els.assessmentFeedback.textContent = 'Відповіді змінено після перевірки. Перевірте поточні відповіді ще раз.';
    } else {
      els.assessmentFeedback.hidden = true;
      els.assessmentFeedback.textContent = '';
      delete els.assessmentFeedback.dataset.kind;
    }
    renderNav();
    updateQaPanel();
  }

  function collectAssessmentAnswers() {
    const answers = {};
    Object.keys(ASSESSMENT_KEY).forEach((q) => {
      const selected = document.querySelector(`input[name="${q}"]:checked`);
      if (selected) answers[q] = selected.value;
    });
    return answers;
  }

  function handleAssessmentSubmit(event) {
    event.preventDefault();
    const answers = collectAssessmentAnswers();
    let score = 0;
    Object.entries(ASSESSMENT_KEY).forEach(([q, key]) => {
      if (answers[q] === key) score += 1;
    });
    state.assessment = {
      answers,
      checked: true,
      pass: score === 5,
      dirty: false,
      score
    };
    writeAssessment();
    renderAssessmentFeedback();
  }

  function handleAssessmentChange() {
    const answers = collectAssessmentAnswers();
    const hadTrustedCheck = state.assessment.checked || state.assessment.pass;
    const changed = JSON.stringify(answers) !== JSON.stringify(state.assessment.answers);
    state.assessment.answers = answers;
    if (changed && hadTrustedCheck) {
      state.assessment.checked = false;
      state.assessment.pass = false;
      state.assessment.dirty = true;
      state.assessment.score = null;
    }
    writeAssessment();
    renderAssessmentFeedback();
  }

  function buildAiPrompt(mode) {
    const p = collectPortfolioFromDom();
    if (mode === '1') {
      return `Я працюю над NBS-рішенням для своєї громади. Нижче мій власний текст. Перевір, чи чітко сформульовано: (1) яку цінність створює рішення, (2) хто отримує цю цінність, (3) чому потенційна приватна сторона може бути зацікавлена. Не додавай фактів про мою громаду. Не пропонуй гранти, кредити, зелені облігації, ROI, NPV, IRR або юридичну модель ДПП. Спочатку постав до 5 уточнювальних запитань, а потім запропонуй стислий варіант формулювання, використовуючи лише мої дані. Мій текст:\n\nЦінність:\n${p.pfValue}\n\nОтримувачі:\n${p.pfRecipients}\n\nГіпотеза приватного інтересу:\n${p.pfPrivate}`;
    }
    return `Оціни лише логіку потенційної участі в моєму NBS-рішенні. Не вирішуй завдання замість мене і не додавай локальних фактів. Перевір: чи сформульовано приватний інтерес як гіпотезу; чи роль партнера описана без передчасного вибору фінансового інструменту; чи зрозуміло, що саме місто має перевірити далі. Поверни: 3 сильні сторони, до 3 ризиків у формулюванні та 3 уточнювальні запитання. Мій текст:\n\nГіпотеза приватного інтересу:\n${p.pfPrivate}\n\nЛогіка участі:\n${p.pfRole}\n\nНаступна перевірка:\n${p.pfVerify}`;
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('copy failed');
  }

  async function handleAiCopy(event) {
    const mode = event.currentTarget.dataset.ai;
    persistPortfolio(true);
    try {
      await copyText(buildAiPrompt(mode));
      els.aiStatus.textContent = 'Промпт скопійовано. Дані не було передано зовнішньому сервісу.';
    } catch (_) {
      els.aiStatus.textContent = 'Не вдалося скопіювати промпт автоматично. Ваші дані не було передано зовнішньому сервісу.';
    }
  }

  function resetLesson() {
    const ok = window.confirm('Почати заняття спочатку? Буде очищено прогрес, формативну практику та фінальний тест. Ваша рамка у «Портфелі мера» буде збережена.');
    if (!ok) return;
    localStorage.removeItem(KEYS.progress);
    localStorage.removeItem(KEYS.formative);
    localStorage.removeItem(KEYS.assessment);
    state.route = 0;
    state.formative = { selected: '', checked: false };
    state.assessment = { answers: {}, checked: false, pass: false, dirty: false, score: null };
    els.formativeForm.reset();
    els.formativeFeedback.hidden = true;
    els.assessmentForm.reset();
    renderAssessmentFeedback();
    showRoute(0, { saveProgress: false });
    const status = byId('portfolioStatus');
    status.textContent = 'Прогрес заняття очищено. Рамку у «Портфелі мера» збережено.';
    updateQaPanel();
  }

  function deletePortfolio() {
    const ok = window.confirm('Видалити лише Вашу «Рамку циркулярної бізнес-моделі для NBS-рішення» з цього браузера? Ця дія не змінює результат фінального тесту.');
    if (!ok) return;
    localStorage.removeItem(KEYS.portfolio);
    PORTFOLIO_IDS.forEach((id) => { byId(id).value = ''; });
    updatePortfolioPreview();
    els.portfolioStatus.textContent = 'Рамку видалено з цього браузера.';
    updateQaPanel();
  }

  function updateQaPanel(effectiveRoute = null) {
    if (!qaMode || !els.qaPanel) return;
    const visiblePanel = effectiveRoute ?? Number(document.querySelector('.route:not([hidden])')?.dataset.routePanel ?? state.route);
    els.qaRouteIndex.textContent = `${visiblePanel + 1} / 7`;
    els.qaCompletionLock.textContent = canComplete() ? 'UNLOCKED' : 'LOCKED';
    const a = state.assessment;
    els.qaAssessmentState.textContent = a.dirty ? 'DIRTY' : a.pass ? 'PASS' : a.checked ? `CHECKED ${a.score ?? 0}/5` : 'NOT CHECKED';
    els.qaProgressStorage.textContent = localStorage.getItem(KEYS.progress) ? 'PRESENT' : 'EMPTY';
    els.qaPortfolioStorage.textContent = localStorage.getItem(KEYS.portfolio) ? 'PRESENT' : 'EMPTY';
    els.qaFormativeStorage.textContent = localStorage.getItem(KEYS.formative) ? 'PRESENT' : 'EMPTY';
    els.qaAssessmentStorage.textContent = localStorage.getItem(KEYS.assessment) ? 'PRESENT' : 'EMPTY';
  }

  function wireEvents() {
    document.querySelectorAll('.route-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = Number(tab.dataset.route);
        if (target === 6 && qaMode && !canComplete()) {
          qaReturnRoute = state.route;
          showRoute(6, { fromQa: true, saveProgress: false });
          return;
        }
        showRoute(target);
      });
    });

    els.backRoute.addEventListener('click', () => {
      const visible = Number(document.querySelector('.route:not([hidden])')?.dataset.routePanel ?? state.route);
      if (qaMode && visible === 6 && !canComplete()) {
        showRoute(qaReturnRoute, { saveProgress: false });
        return;
      }
      showRoute(Math.max(0, visible - 1));
    });
    els.nextRoute.addEventListener('click', () => {
      const visible = Number(document.querySelector('.route:not([hidden])')?.dataset.routePanel ?? state.route);
      if (visible === 5) {
        if (canComplete()) showRoute(6);
        return;
      }
      showRoute(Math.min(5, visible + 1));
    });

    els.resetLesson.addEventListener('click', resetLesson);
    els.formativeForm.addEventListener('submit', handleFormativeSubmit);
    els.assessmentForm.addEventListener('submit', handleAssessmentSubmit);
    els.assessmentForm.addEventListener('change', handleAssessmentChange);
    els.savePortfolio.addEventListener('click', () => persistPortfolio(false));
    els.deletePortfolio.addEventListener('click', deletePortfolio);
    PORTFOLIO_IDS.forEach((id) => byId(id).addEventListener('input', () => { persistPortfolio(true); updatePortfolioPreview(); }));
    document.querySelectorAll('.copy-ai').forEach((button) => button.addEventListener('click', handleAiCopy));

    if (qaMode) {
      els.qaOpenCompletion.addEventListener('click', () => {
        qaReturnRoute = state.route;
        showRoute(6, { fromQa: true, saveProgress: false });
      });
      els.qaReturn.addEventListener('click', () => showRoute(qaReturnRoute, { saveProgress: false }));
    }
  }

  function cacheElements() {
    els.currentRouteTitle = byId('currentRouteTitle');
    els.pageCounter = byId('pageCounter');
    els.progressPercent = byId('progressPercent');
    els.progressBar = byId('progressBar');
    els.progressTrack = document.querySelector('.progress-track');
    els.backRoute = byId('backRoute');
    els.nextRoute = byId('nextRoute');
    els.nextLesson = byId('nextLesson');
    els.resetLesson = byId('resetLesson');
    els.formativeForm = byId('formativeForm');
    els.formativeFeedback = byId('formativeFeedback');
    els.assessmentForm = byId('assessmentForm');
    els.assessmentFeedback = byId('assessmentFeedback');
    els.portfolioStatus = byId('portfolioStatus');
    els.aiStatus = byId('aiStatus');
    els.savePortfolio = byId('savePortfolio');
    els.deletePortfolio = byId('deletePortfolio');
    els.qaPanel = byId('qaPanel');
    els.qaRouteIndex = byId('qaRouteIndex');
    els.qaCompletionLock = byId('qaCompletionLock');
    els.qaAssessmentState = byId('qaAssessmentState');
    els.qaProgressStorage = byId('qaProgressStorage');
    els.qaPortfolioStorage = byId('qaPortfolioStorage');
    els.qaFormativeStorage = byId('qaFormativeStorage');
    els.qaAssessmentStorage = byId('qaAssessmentStorage');
    els.qaOpenCompletion = byId('qaOpenCompletion');
    els.qaReturn = byId('qaReturn');
    els.completionAssessmentStatus = byId('completionAssessmentStatus');
    els.completionPortfolioStatus = byId('completionPortfolioStatus');
  }

  function init() {
    cacheElements();
    readStorage();
    restorePortfolioToDom();
    updatePortfolioPreview();
    restoreFormative();
    restoreAssessment();
    wireEvents();
    if (qaMode) els.qaPanel.hidden = false;
    qaReturnRoute = state.route;
    showRoute(state.route, { saveProgress: false, preserveFocus: true });
    updateQaPanel();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
