/* Allied Nippon — лендинг с видео, привязанным к скроллу */
(() => {
  'use strict';

  const video    = document.getElementById('hero-video');
  const progress = document.getElementById('progress-bar');
  const topbar   = document.querySelector('.topbar');
  const burger   = document.querySelector('.topbar__burger');
  const menu     = document.getElementById('mobile-menu');
  const navLinks = [...document.querySelectorAll('.topbar__nav a')];
  const sections = [...document.querySelectorAll('main .section')];
  const reveals  = [...document.querySelectorAll('.reveal')];

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  /* ─── Прогресс страницы: 0 в самом верху, 1 в самом низу ─── */
  const scrollProgress = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? clamp(scrollY / max, 0, 1) : 0;
  };

  /* ─── Скраб видео ────────────────────────────────────────── */
  let duration = 0;
  let target   = 0;   // куда хотим попасть
  let current  = 0;   // где сейчас, со сглаживанием
  let ticking  = false;
  let ready    = false;

  const seek = (t) => {
    // держимся в долях кадра от конца, иначе Safari роняет последний кадр
    const safe = clamp(t, 0, duration - 0.02);
    if (Math.abs(video.currentTime - safe) < 0.004) return;
    try { video.currentTime = safe; } catch { /* декодер ещё не готов */ }
  };

  const loop = () => {
    const delta = target - current;

    if (Math.abs(delta) < 0.003) {
      current = target;
      seek(current);
      ticking = false;
      return;
    }

    current += delta * 0.14;   // инерция: меньше значение — «тяжелее» кадр
    seek(current);
    requestAnimationFrame(loop);
  };

  const sync = (instant = false) => {
    if (!ready) return;
    target = scrollProgress() * duration;

    if (instant) {
      current = target;
      seek(current);
    } else if (!ticking) {
      ticking = true;
      requestAnimationFrame(loop);
    }
  };

  // прогреваем декодер: без этого первый seek на iOS отдаёт чёрный кадр
  const warmUp = async () => {
    try {
      await video.play();
      video.pause();
    } catch { /* автоплей заблокирован — seek всё равно обычно работает */ }
  };

  const onMeta = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    duration = video.duration;
    ready = true;
    warmUp().then(() => sync(true));
    sync(true);
  };

  if (video) {
    if (reduced) {
      // без скраба показываем постер и не трогаем currentTime
      video.removeAttribute('src');
      video.load();
    } else {
      if (video.readyState >= 1) onMeta();
      else video.addEventListener('loadedmetadata', onMeta, { once: true });

      // iOS может разрешить декодирование только после жеста
      const unlock = () => { if (ready && video.paused) warmUp(); };
      addEventListener('touchstart', unlock, { once: true, passive: true });
      addEventListener('pointerdown', unlock, { once: true, passive: true });
    }
  }

  /* ─── Подсветка активного пункта меню ────────────────────── */
  const spy = () => {
    const line = innerHeight * 0.4;
    const active = sections.find((s) => {
      const box = s.getBoundingClientRect();
      return box.top <= line && box.bottom > line;
    });

    navLinks.forEach((a) => {
      a.classList.toggle('is-active', a.getAttribute('href') === `#${active?.id}`);
    });
  };

  /* ─── Вторая точка притяжения для высоких секций ─────────── */
  // Порог только на округление высот: всё, что секция переросла сверх него,
  // без нижней точки становится недостижимым. Две близкие точки притяжения
  // безвредны — снап срабатывает по окончании жеста и выбирает ближнюю.
  const SNAP_SLACK = 2;

  // Снап жёсткий, поэтому секция выше экрана без нижней точки становится
  // ловушкой: браузер утягивает её обратно к началу. Маркер по нижнему краю
  // даёт остановку на её второй половине.
  const tuneSnap = () => {
    sections.forEach((s) => {
      const tall = s.offsetHeight > innerHeight + SNAP_SLACK;
      const marker = s.querySelector(':scope > .snap-end');

      if (tall && !marker) {
        const el = document.createElement('div');
        el.className = 'snap-end';
        el.setAttribute('aria-hidden', 'true');
        s.append(el);
      } else if (!tall && marker) {
        marker.remove();
      }
    });
  };

  /* ─── Реакция на скролл ──────────────────────────────────── */
  let raf = null;

  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;

      if (progress) progress.style.width = `${(scrollProgress() * 100).toFixed(3)}%`;
      if (topbar) topbar.classList.toggle('is-stuck', scrollY > 40);
      if (!reduced) sync();

      spy();
    });
  };

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => {
    tuneSnap();
    onScroll();
    if (!reduced) sync(true);
  });

  /* ─── Появление блоков ───────────────────────────────────── */
  if (reduced || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(({ isIntersecting, target: el }) => {
        if (!isIntersecting) return;
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    reveals.forEach((el) => io.observe(el));
  }

  /* ─── Мобильное меню ─────────────────────────────────────── */
  if (burger && menu) {
    const closeMenu = () => {
      menu.hidden = true;
      burger.setAttribute('aria-expanded', 'false');
    };

    burger.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') === 'true';
      menu.hidden = open;
      burger.setAttribute('aria-expanded', String(!open));
    });

    menu.addEventListener('click', (e) => {
      if (e.target.closest('a')) closeMenu();
    });

    addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });

    addEventListener('resize', () => {
      if (innerWidth > 900) closeMenu();
    });
  }

  /* первый проход */
  tuneSnap();
  onScroll();
  if (!reduced) sync(true);

  // шрифт грузится позже и меняет высоты — пересчитываем, когда он готов
  document.fonts?.ready.then(tuneSnap);
})();
