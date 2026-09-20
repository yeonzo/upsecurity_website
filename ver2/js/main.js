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

  if (reduceMotion) {
    showScene(scenes.length - 1);
  } else {
    // 장면이 뜨는 시각(ms): 첫 장면은 로드와 동시에 시작
    [0, 1900, 3800].forEach((at, i) => {
      if (at === 0) return;
      setTimeout(() => showScene(i), at);
    });
  }

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
  const modals = { contact: $('#modal-contact'), video: $('#modal-video') };
  let openModal = null;
  let returnFocus = null;

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
    const video = $('video', openModal);
    if (video) video.pause();
    openModal.hidden = true;
    if (openModal === modals.contact) resetContactForm();
    openModal = null;
    document.documentElement.classList.remove('modal-open');
    if (restoreFocus && returnFocus) returnFocus.focus();
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

  /* ---------- 도입문의 폼 ---------- */
  const form = $('#contact-form');
  const formView = $('.form-view', modals.contact);
  const successView = $('.success-view', modals.contact);

  const validate = (input) => {
    const value = input.value.trim();
    let valid;
    if (input.type === 'checkbox') valid = input.checked;
    else if (input.type === 'email') valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    else valid = value.length > 0;
    input.closest('.field, .agree').classList.toggle('is-invalid', !valid);
    input.setAttribute('aria-invalid', String(!valid));
    return valid;
  };

  form.addEventListener('input', (e) => {
    const wrap = e.target.closest('.is-invalid');
    if (wrap && e.target.required) validate(e.target);
  });
  form.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox' && e.target.required) validate(e.target);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const invalid = $$('[required]', form).filter((input) => !validate(input));
    if (invalid.length) { invalid[0].focus(); return; }

    // TODO: 실제 접수 API로 전송 — new FormData(form)
    formView.hidden = true;
    successView.hidden = false;
    $('.modal-title', successView).focus();
  });

  function resetContactForm() {
    form.reset();
    $$('.is-invalid', form).forEach((el) => el.classList.remove('is-invalid'));
    $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
    formView.hidden = false;
    successView.hidden = true;
  }
})();
