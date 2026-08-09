(function () {
  // Privacy modal
  var modal = document.getElementById('privacy-modal');
  var closeBtn = document.getElementById('modal-close');

  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('privacy-link')) {
      e.preventDefault();
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }
  });

  closeBtn.addEventListener('click', function () {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  });

  modal.addEventListener('click', function (e) {
    if (e.target === modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
  });

  // Image skeletons — swap each shimmer for the picture as it resolves.
  function trackImages(root) {
    root.querySelectorAll('img').forEach(function (img) {
      if (img.classList.contains('is-loaded')) return;

      // This script is deferred, so an image may already be complete and its
      // load event long gone by now. naturalWidth separates decoded from broken.
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add('is-loaded');
        return;
      }

      var done = function () { img.classList.add('is-loaded'); };
      img.addEventListener('load', done);
      // A broken image must not shimmer forever.
      img.addEventListener('error', done);
    });
  }

  trackImages(document);

  // Success chime — two rising notes, synthesised rather than loaded, so
  // there is no audio file to download and nothing to fail on slow campus
  // wifi. It is built inside the submit handler, which browsers count as a
  // user gesture; audio that starts any other way is blocked outright.
  function playChime() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;

      var ctx = new Ctx();
      if (ctx.state === 'suspended') ctx.resume();

      // C6 then G6 — a perfect fifth, the interval most notification
      // sounds land on because it reads as resolved rather than urgent.
      [[1046.5, 0], [1568.0, 0.085]].forEach(function (note) {
        var start = ctx.currentTime + note[1];
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = note[0];

        // Fade in over a few ms so the note doesn't begin with a click,
        // then decay exponentially the way a struck bell does.
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);

        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.55);
      });

      // Browsers cap how many audio contexts a page may hold open, so hand
      // the hardware back once the tail has finished ringing.
      setTimeout(function () { ctx.close(); }, 1200);
    } catch (err) {
      // The chime is a bonus. If audio is unavailable the green button and
      // the success card still land, so swallow this rather than break them.
    }
  }

  // Signup form
  var form = document.getElementById('signup-form');
  var msg = document.getElementById('form-msg');
  var btn = document.getElementById('submit-btn');
  var btnWrap = btn.parentElement;

  function failWith(text) {
    msg.textContent = text;
    msg.className = 'form-msg error';
    btn.disabled = false;
    btn.textContent = 'Join';
    // Restart the shake even on a repeated failure: removing the class,
    // forcing a reflow, then re-adding it replays the animation.
    btnWrap.classList.remove('is-error');
    void btnWrap.offsetWidth;
    btnWrap.classList.add('is-error');
  }

  function showSuccessCard() {
    var card = document.getElementById('main-card');
    card.innerHTML =
      '<div class="pin pin-left" aria-hidden="true"></div>' +
      '<div class="pin pin-right" aria-hidden="true"></div>' +
      '<div class="success-state">' +
        '<img src="/assets/raccoon.png" alt="Backyard raccoon" class="success-raccoon">' +
        '<h1 class="headline">You\'re on the list!</h1>' +
        '<p class="tagline">We\'ll let you know as soon as Backyard launches. See you on campus.</p>' +
      '</div>' +
      '<div class="footer">' +
        '<a href="/privacy">Privacy Policy</a>' +
        '<span class="footer-sep">&#x2022;</span>' +
        'Built with care at Northeastern' +
      '</div>';

    // The raccoon was just injected, so it needs the same treatment.
    trackImages(card);
  }

  function celebrate() {
    btnWrap.classList.add('is-success');
    btn.textContent = '✓ You\'re in!';

    // The green button and the chime say nothing to a screen reader, so
    // put the result through the live region as well.
    msg.textContent = 'You\'re on the list!';
    msg.className = 'form-msg success';

    playChime();

    // Hold the confirmation long enough to see and hear before the card
    // flips. Swapping immediately destroyed it in the same frame it
    // appeared, which is why the button never looked like it responded.
    setTimeout(showSuccessCard, 1100);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.textContent = '';
    msg.className = 'form-msg';
    btnWrap.classList.remove('is-error');

    var email = form.email.value.trim();
    var honeypot = form.website.value;
    var consent = document.getElementById('consent-check').checked;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      failWith('Please enter a valid email address.');
      return;
    }

    if (!consent) {
      failWith('Please check the consent box to continue.');
      return;
    }

    btn.disabled = true;
    btn.textContent = '...';

    fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, website: honeypot }),
    })
      .then(function (res) {
        // A platform-level failure can return HTML instead of JSON; fall
        // back to an empty body so the status code still drives the message.
        return res.json()
          .catch(function () { return {}; })
          .then(function (d) { return { ok: res.ok, status: res.status, data: d }; });
      })
      .then(function (result) {
        if (result.ok) {
          celebrate();
          return;
        }
        // 400 and 429 carry text written for a human to read. The rest
        // ('Forbidden', 'Method not allowed') are plumbing details that
        // would only confuse someone who just wants on the waitlist.
        var actionable = result.status === 400 || result.status === 429;
        failWith((actionable && result.data.error) || 'Something went wrong. Please try again.');
      })
      .catch(function () {
        failWith('Something went wrong. Please try again.');
      });
  });
})();
