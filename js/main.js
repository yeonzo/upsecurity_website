(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 헤더 ---------- */
  const header = $('.site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const menuToggle = $('.menu-toggle');
  const mobileNav = $('#mobile-nav');
  const setMenu = (open) => {
    mobileNav.hidden = !open;
    header.classList.toggle('menu-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    $('use', menuToggle).setAttribute('href', open ? '#i-close' : '#i-menu');
  };
  menuToggle.addEventListener('click', () => setMenu(mobileNav.hidden));
  mobileNav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- 현재 섹션 표시 ---------- */
  const navLinks = $$('.gnb a');
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-current', a.hash === '#' + entry.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['hero', ...navLinks.map((a) => a.hash.slice(1))].forEach((id) => {
    const el = document.getElementById(id);
    if (el) spy.observe(el);
  });

  /* ---------- 스크롤 등장 ---------- */
  const revealer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      revealer.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal, .reveal-lines').forEach((el) => revealer.observe(el));

  /* ---------- Why Campfire: 성능 수치 카운트업 ---------- */
  const metricCounters = $$('[data-countup]');
  if (!reduceMotion && metricCounters.length) {
    const countDuration = 900;
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const counter = entry.target;
        const target = Number(counter.dataset.countup);
        const decimals = Number(counter.dataset.decimals || 0);
        const startedAt = performance.now();

        const draw = (now) => {
          const progress = Math.min(1, (now - startedAt) / countDuration);
          const eased = 1 - Math.pow(1 - progress, 3);
          counter.textContent = (target * eased).toFixed(decimals);
          if (progress < 1) requestAnimationFrame(draw);
          else counter.textContent = target.toFixed(decimals);
        };

        requestAnimationFrame(draw);
        countObserver.unobserve(counter);
      });
    }, { threshold: 0.45 });

    metricCounters.forEach((counter) => {
      const decimals = Number(counter.dataset.decimals || 0);
      counter.textContent = (0).toFixed(decimals);
      countObserver.observe(counter);
    });
  }

  /* ---------- ① 히어로: 자동 재생 인트로 ---------- */
  const hero = $('#hero');
  const scenes = $$('.hero-scene', hero);
  const showScene = (index) => {
    scenes.forEach((el, i) => {
      el.classList.toggle('is-active', i === index);
      el.classList.toggle('is-past', i < index);
    });
  };

  const transition = $('.hero-transition');
  const meteorField = $('.meteor-field', transition);
  const heroReplay = $('#hero-replay');
  const heroCloseMs = 780;
  const heroMeteorMs = 1800;
  const heroOpenMs = 920;
  let introStarted = false;
  let skipHeroTransition = false;
  let heroTimers = [];
  const scheduleHero = (callback, delay) => {
    heroTimers.push(window.setTimeout(callback, delay));
  };
  const clearHeroTimers = () => {
    heroTimers.forEach((timer) => window.clearTimeout(timer));
    heroTimers = [];
  };
  const showHeroReplay = () => { heroReplay.hidden = false; };

  // 한 번만 만드는 유성: 화면 전체에서 대각선으로 짧게 지나간다
  if (meteorField && !reduceMotion) {
    for (let i = 0; i < 48; i++) {
      const meteor = document.createElement('span');
      meteor.className = 'meteor';
      meteor.style.setProperty('--x', `${(i * 37) % 116 - 8}%`);
      meteor.style.setProperty('--y', `${(i * 53) % 110 - 24}%`);
      meteor.style.setProperty('--length', `${85 + (i * 31) % 105}px`);
      meteor.style.setProperty('--delay', `${(i * 347) % 1150}ms`);
      meteor.style.setProperty('--duration', `${760 + (i * 97) % 440}ms`);
      meteorField.appendChild(meteor);
    }
  }

  const startHeroTransition = () => {
    if (!transition || openModal || skipHeroTransition || window.scrollY > Math.max(120, hero.offsetHeight * .32)) {
      showScene(scenes.length - 1);
      showHeroReplay();
      return;
    }
    setMenu(false);
    document.body.classList.add('is-hero-transitioning');
    transition.classList.add('is-closing');
    scheduleHero(() => {
      transition.classList.remove('is-closing');
      transition.classList.add('is-covered');
      document.body.classList.add('is-meteor-covered');
    }, heroCloseMs);
    scheduleHero(() => {
      document.body.classList.remove('is-meteor-covered');
      showScene(2);
      transition.classList.remove('is-covered');
      transition.classList.add('is-opening');
    }, heroCloseMs + heroMeteorMs);
    scheduleHero(() => {
      transition.classList.remove('is-opening');
      document.body.classList.remove('is-hero-transitioning');
      showHeroReplay();
    }, heroCloseMs + heroMeteorMs + heroOpenMs);
  };

  const startHeroIntro = (replay = false) => {
    if (introStarted && !replay) return;
    introStarted = true;
    clearHeroTimers();
    heroReplay.hidden = true;
    skipHeroTransition = false;
    transition.classList.remove('is-closing', 'is-covered', 'is-opening');
    document.body.classList.remove('is-hero-transitioning', 'is-meteor-covered');
    showScene(0);
    if (reduceMotion) { showScene(scenes.length - 1); return; }
    scheduleHero(() => showScene(1), 1900);
    scheduleHero(startHeroTransition, 3800);
  };

  heroReplay.addEventListener('click', () => {
    heroReplay.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
    startHeroIntro(true);
  });

  $('.to-top').addEventListener('click', () => {
    skipHeroTransition = true;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
  });

  /* ---------- 노트북 화면 옆으로 넘기기 ---------- */
  const screensBox = $('[data-screens]');
  if (screensBox) {
    const track = $('.screens', screensBox);
    const dots = $$('.screen-dots button');
    const count = $$('.screen', screensBox).length;
    const previewTitle = $('[data-preview-title]');
    const previewDesc = $('[data-preview-desc]');
    const screenCopy = [
      {
        title: 'AI에 보내기 전, 먼저 확인하세요',
        desc: 'Campfire는 문서를 사전에 검사해 프롬프트 인젝션, 개인정보 및 조직 기밀 유출 위험을 탐지하고 민감한 정보를 마스킹합니다'
      },
      {
        title: '무엇이 위험한지, 한눈에 확인하세요',
        desc: 'Campfire는 탐지 결과를 직관적으로 보여주고<br>민감한 정보는 즉시 마스킹해 안전한 AI 활용을 돕습니다'
      },
      {
        title: '문서 검사부터 후속 작업까지, 안전하게 자동화합니다',
        desc: 'Campfire MCP는 문서를 스캔하고 보호 조치를 적용한 뒤,<br>요약·전송 등 후속 작업까지 안전하게 연결합니다'
      }
    ];
    let shown = 0;
    let timer = null;

    const showScreen = (index) => {
      shown = (index + count) % count;
      track.style.transform = `translateX(-${shown * (100 / count)}%)`;
      dots.forEach((dot, i) => {
        const on = i === shown;
        dot.classList.toggle('is-on', on);
        dot.setAttribute('aria-selected', String(on));
      });
      if (previewTitle && previewDesc && screenCopy[shown]) {
        previewTitle.textContent = screenCopy[shown].title;
        previewTitle.classList.toggle('is-compact', shown === 2);
        previewDesc.innerHTML = screenCopy[shown].desc;
      }
    };
    const play = () => {
      if (reduceMotion) return;
      stop();
      timer = setInterval(() => showScreen(shown + 1), 5000);
    };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };

    dots.forEach((dot, i) => dot.addEventListener('click', () => { showScreen(i); play(); }));

    // 터치로 좌우로 밀어 화면을 넘긴다. 세로로 움직이면 페이지 스크롤에 양보한다.
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let moved = 0;
    let swiping = false;

    const endSwipe = () => {
      if (pointerId === null) return;
      pointerId = null;
      track.classList.remove('is-dragging');
      const threshold = Math.max(40, screensBox.clientWidth * 0.12);
      showScreen(swiping && Math.abs(moved) > threshold ? shown + (moved < 0 ? 1 : -1) : shown);
      swiping = false;
      moved = 0;
      play();
    };

    screensBox.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || pointerId !== null) return;
      pointerId = e.pointerId;
      // 손가락이 요소 밖으로 나가도 같은 제스처로 이어서 받는다
      if (screensBox.setPointerCapture) screensBox.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      moved = 0;
      swiping = false;
      stop();
    });

    screensBox.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!swiping) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { endSwipe(); return; }
        if (Math.abs(dx) < 8) return;
        swiping = true;
        track.classList.add('is-dragging');
      }
      moved = dx;
      track.style.transform = `translateX(calc(-${shown * (100 / count)}% + ${dx}px))`;
    });

    ['pointerup', 'pointercancel'].forEach((type) => screensBox.addEventListener(type, endSwipe));
    screensBox.addEventListener('mouseenter', stop);
    screensBox.addEventListener('mouseleave', play);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : play()));

    // 스크린샷 파일이 없으면 목업이 보이도록 이미지를 치운다
    $$('.screen-shot', screensBox).forEach((img) => {
      img.addEventListener('error', () => img.remove(), { once: true });
    });

    // 화면에 보일 때만 자동으로 넘긴다
    new IntersectionObserver(([entry]) => (entry.isIntersecting ? play() : stop()), { threshold: 0.35 })
      .observe(screensBox);
  }

  /* ---------- ② 탭 ---------- */
  $$('[data-tabs]').forEach((root) => {
    const tabs = $$('[role="tab"]', root);
    const panels = $$('[role="tabpanel"]', root);
    const indicator = $('.tab-indicator', root);

    const placeIndicator = () => {
      const active = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
      indicator.style.width = active.offsetWidth + 'px';
      indicator.style.transform = `translateX(${active.offsetLeft}px)`;
    };

    const select = (index, focus) => {
      tabs.forEach((tab, i) => {
        const on = i === index;
        tab.classList.toggle('is-active', on);
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
      });
      panels.forEach((panel, i) => {
        panel.hidden = i !== index;
        panel.classList.toggle('is-active', i === index);
      });
      placeIndicator();
      if (focus) {
        tabs[index].focus();
        tabs[index].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(i));
      tab.addEventListener('keydown', (e) => {
        const keys = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
        if (!(e.key in keys)) return;
        e.preventDefault();
        select((keys[e.key] + tabs.length) % tabs.length, true);
      });
    });

    placeIndicator();
    window.addEventListener('resize', placeIndicator);
    if (document.fonts) document.fonts.ready.then(placeIndicator);
    root.selectTab = select;
  });

  /* ---------- 고정 스크롤: 붙잡힌 화면에서 탭이 한 단계씩 넘어간다 ---------- */
  const connect = $('#connect');
  const connectTabs = $('[data-tabs]', connect);
  const pinQuery = window.matchMedia('(min-width: 961px) and (min-height: 760px)');
  let pinnedIndex = -1;

  const updatePinnedTabs = () => {
    if (!pinQuery.matches) { pinnedIndex = -1; return; }
    const total = connect.offsetHeight - window.innerHeight;
    if (total <= 0) return;
    const progress = Math.min(0.999, Math.max(0, -connect.getBoundingClientRect().top / total));
    const index = Math.floor(progress * 3);
    if (index === pinnedIndex) return;
    pinnedIndex = index;
    connectTabs.selectTab(index);
  };
  window.addEventListener('scroll', updatePinnedTabs, { passive: true });
  pinQuery.addEventListener('change', () => { pinnedIndex = -1; updatePinnedTabs(); });
  updatePinnedTabs();

  /* ---------- 연동 환경: 3단 고정 스크롤 장면 ---------- */
  const integrationStory = $('[data-integration-story]');
  if (integrationStory) {
    let integrationFrame = 0;

    const updateIntegrationStory = () => {
      integrationFrame = 0;
      const rect = integrationStory.getBoundingClientRect();
      const viewport = window.innerHeight;
      const scrollRange = Math.max(1, integrationStory.offsetHeight - viewport);
      const progress = Math.min(1, Math.max(0, -rect.top / scrollRange));
      const inView = location.hash === '#integrations' || (rect.top < viewport * .88 && rect.bottom > viewport * .12);
      const step = reduceMotion ? 2 : progress < .26 ? 0 : progress < .62 ? 1 : 2;

      integrationStory.classList.toggle('is-in-view', inView);
      integrationStory.classList.toggle('story-step-0', step === 0);
      integrationStory.classList.toggle('story-step-1', step === 1);
      integrationStory.classList.toggle('story-step-2', step === 2);
      integrationStory.style.setProperty('--integration-progress', progress.toFixed(3));
    };

    const requestIntegrationUpdate = () => {
      if (integrationFrame) return;
      integrationFrame = requestAnimationFrame(updateIntegrationStory);
    };

    window.addEventListener('scroll', requestIntegrationUpdate, { passive: true });
    window.addEventListener('resize', requestIntegrationUpdate);
    window.addEventListener('load', requestIntegrationUpdate, { once: true });
    updateIntegrationStory();
    requestAnimationFrame(requestIntegrationUpdate);
  }

  /* ---------- 무한 흐르는 띠 ---------- */
  const fillMarquee = (track, group) => {
    if (!track || !group || reduceMotion) return;
    const need = window.innerWidth + group.offsetWidth;
    let copies = 1;
    while (track.scrollWidth < need && copies < 12) {
      const clone = group.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
      copies++;
    }
    // 최소 2벌이 있어야 이어붙임이 끊기지 않는다
    if (copies === 1) {
      const clone = group.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
      copies++;
    }
    track.style.setProperty('--copies', copies);
  };
  const setupMarquees = () => {
    $$('[data-marquee]').forEach((m) => fillMarquee($('.marquee-track', m), $('.marquee-group', m)));
    $$('[data-band]').forEach((track) => fillMarquee(track, $('.band-group', track)));
  };
  if (document.fonts) document.fonts.ready.then(setupMarquees);
  else window.addEventListener('load', setupMarquees);

  /* ---------- 모달 ---------- */
  const modals = { beta: $('#modal-beta'), contact: $('#modal-contact'), video: $('#modal-video') };
  let openModal = null;
  let returnFocus = null;
  let contactSubmissionVersion = 0;
  const comingSoonToast = $('#coming-soon-toast');
  let comingSoonTimer;

  const focusables = (root) =>
    $$('a[href], button:not([disabled]), input, textarea, select, video[controls], [tabindex]:not([tabindex="-1"])', root)
      .filter((el) => el.offsetParent !== null || el === document.activeElement);

  const loadVideo = (modal) => {
    const video = $('video', modal);
    const fallback = $('.video-fallback', modal);
    if (!video || !video.dataset.src) return;
    if (video.dataset.state === 'ready') { video.play().catch(() => {}); return; }
    if (video.dataset.state) return;
    video.dataset.state = 'loading';
    video.addEventListener('loadeddata', () => {
      video.dataset.state = 'ready';
      video.hidden = false;
      fallback.hidden = true;
      video.play().catch(() => {});
    }, { once: true });
    video.addEventListener('error', () => { video.dataset.state = 'error'; }, { once: true });
    video.preload = 'auto';
    video.src = video.dataset.src;
    video.load();
  };

  const closeModal = ({ restoreFocus = true } = {}) => {
    if (!openModal) return;
    const wasBeta = openModal === modals.beta;
    const video = $('video', openModal);
    if (video) video.pause();
    openModal.hidden = true;
    if (openModal === modals.contact) {
      contactSubmissionVersion++;
      resetContactForm();
    }
    openModal = null;
    document.documentElement.classList.remove('modal-open');
    if (restoreFocus && returnFocus) returnFocus.focus();
    if (wasBeta) startHeroIntro();
  };

  const openModalByName = (name) => {
    const modal = modals[name];
    if (!modal) return;
    if (openModal) closeModal({ restoreFocus: false });
    else returnFocus = document.activeElement;
    openModal = modal;
    modal.hidden = false;
    document.documentElement.classList.add('modal-open');
    const first = $('input', modal) || $('.modal-close', modal);
    first.focus();
    if (name === 'video') loadVideo(modal);
  };

  document.addEventListener('click', (e) => {
    const comingSoonButton = e.target.closest('[data-coming-soon]');
    if (comingSoonButton) {
      comingSoonToast.textContent = `${comingSoonButton.dataset.comingSoon}은 현재 준비 중이며 추후 공개됩니다`;
      comingSoonToast.hidden = false;
      window.clearTimeout(comingSoonTimer);
      comingSoonTimer = window.setTimeout(() => { comingSoonToast.hidden = true; }, 3200);
      return;
    }
    const opener = e.target.closest('[data-open]');
    if (opener) {
      e.preventDefault();
      setMenu(false);
      openModalByName(opener.dataset.open);
      return;
    }
    if (openModal && e.target.closest('[data-close]')) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (!openModal) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
    const items = focusables(openModal);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- 문의·베타 접수 API ---------- */
  const sendLead = async (kind, leadForm) => {
    const body = Object.fromEntries(new FormData(leadForm));
    body.kind = kind;
    body.agree = leadForm.elements.agree.checked;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      // Same-origin Vercel function; see api/lead.js.
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.error || '접수 서버를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요');
      }
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요');
      if (error instanceof TypeError) throw new Error('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요');
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const showFormStatus = (status, message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
    status.hidden = false;
  };

  /* ---------- 방문·새로고침마다 사전예약 팝업 표시 ---------- */
  const betaForm = $('#beta-form');
  betaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (betaForm.dataset.submitting) return;
    const invalid = $$('[required]', betaForm).filter((input) => !validate(input));
    if (invalid.length) { invalid[0].focus(); return; }
    const button = $('[type="submit"]', betaForm);
    const status = $('.beta-status', betaForm);
    betaForm.dataset.submitting = 'true';
    status.hidden = true;
    button.disabled = true;
    button.textContent = '접수 중...';
    try {
      await sendLead('beta', betaForm);
      betaForm.reset();
      showFormStatus(status, '베타 사전예약이 접수되었습니다. 체험이 시작되면 연락드릴게요');
      button.textContent = '접수 완료';
      $('.beta-later', modals.beta).textContent = '닫기';
    } catch (error) {
      showFormStatus(status, error.message, true);
      button.disabled = false;
      button.textContent = '사전예약하기';
    } finally {
      delete betaForm.dataset.submitting;
    }
  });

  openModalByName('beta');

  /* ---------- 도입문의 폼 ---------- */
  const form = $('#contact-form');
  const formView = $('.form-view', modals.contact);
  const successView = $('.success-view', modals.contact);

  const validate = (input) => {
    const value = input.value.trim();
    let valid;
    if (input.type === 'checkbox') valid = input.checked;
    else if (input.type === 'email') valid = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
    else if (input.name === 'contact') {
      const digits = value.replace(/\D/g, '');
      valid = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) ||
        (/^\+?[\d\s().-]+$/.test(value) && digits.length >= 9 && digits.length <= 15);
    }
    else valid = value.length > 0;
    input.closest('.field, .agree').classList.toggle('is-invalid', !valid);
    input.setAttribute('aria-invalid', String(!valid));
    return valid;
  };

  [betaForm, form].forEach((leadForm) => {
    leadForm.addEventListener('input', (e) => {
      const wrap = e.target.closest('.is-invalid');
      if (wrap && e.target.required) validate(e.target);
    });
    leadForm.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox' && e.target.required) validate(e.target);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.dataset.submitting) return;
    const invalid = $$('[required]', form).filter((input) => !validate(input));
    if (invalid.length) { invalid[0].focus(); return; }
    const button = $('[type="submit"]', form);
    const status = $('.contact-status', form);
    const version = ++contactSubmissionVersion;
    form.dataset.submitting = 'true';
    status.hidden = true;
    button.disabled = true;
    button.textContent = '전송 중...';
    try {
      await sendLead('contact', form);
      if (version !== contactSubmissionVersion) return;
      formView.hidden = true;
      successView.hidden = false;
      $('.modal-title', successView).focus();
    } catch (error) {
      if (version === contactSubmissionVersion) showFormStatus(status, error.message, true);
    } finally {
      if (version === contactSubmissionVersion) {
        delete form.dataset.submitting;
        button.disabled = false;
        button.textContent = '문의 보내기';
      }
    }
  });

  function resetContactForm() {
    form.reset();
    delete form.dataset.submitting;
    const button = $('[type="submit"]', form);
    button.disabled = false;
    button.textContent = '문의 보내기';
    $$('.is-invalid', form).forEach((el) => el.classList.remove('is-invalid'));
    $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
    $('.contact-status', form).hidden = true;
    formView.hidden = false;
    successView.hidden = true;
  }
})();
