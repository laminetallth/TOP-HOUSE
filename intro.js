// TOP HOUSE — animazioni del marchio: apertura del sito e passaggio tra le pagine.
// Va caricato nel <head> di ogni pagina, prima del contenuto.
(function () {
  'use strict';
  var ROOT;
  try { ROOT = new URL('./', document.currentScript.src).href; } catch (e) { ROOT = ''; }
  var html = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MARK = 'M5.75 105.00 L5.75 105.50 L6.75 107.00 L7.75 108.00 L10.75 112.00 L12.00 113.25 L12.00 113.50 L13.50 115.00 L13.50 115.25 L23.50 125.50 L23.75 125.50 L28.00 129.50 L28.25 129.50 L33.25 133.75 L37.25 136.75 L39.00 137.75 L39.75 138.50 L43.50 141.00 L44.25 141.25 L45.50 142.25 L46.25 142.50 L46.75 143.00 L46.75 190.25 L47.00 190.50 L77.00 190.50 L77.25 190.25 L77.25 157.75 L77.75 157.25 L79.25 157.25 L79.50 157.50 L80.25 157.50 L81.25 158.00 L82.00 158.00 L83.00 158.50 L83.75 158.50 L84.00 158.75 L84.75 158.75 L85.00 159.00 L85.75 159.00 L86.00 159.25 L86.75 159.25 L88.00 159.75 L89.00 159.75 L90.25 160.25 L91.25 160.25 L91.50 160.50 L92.50 160.50 L92.75 160.75 L93.75 160.75 L94.00 161.00 L95.25 161.00 L95.50 161.25 L96.50 161.25 L96.75 161.50 L98.25 161.50 L98.50 161.75 L101.75 162.00 L102.00 162.25 L103.75 162.25 L104.00 162.50 L106.00 162.50 L106.25 162.75 L113.00 163.00 L113.25 163.25 L127.50 163.25 L127.75 163.00 L131.50 163.00 L131.75 162.75 L136.75 162.50 L137.00 162.25 L138.75 162.25 L139.00 162.00 L142.25 161.75 L142.50 161.50 L143.75 161.50 L144.00 161.25 L145.25 161.25 L145.50 161.00 L146.50 161.00 L146.75 160.75 L149.25 160.50 L150.50 160.00 L151.50 160.00 L152.75 159.50 L153.75 159.50 L154.00 159.25 L155.75 159.00 L156.75 158.50 L158.50 158.25 L161.25 157.25 L162.75 157.25 L163.25 157.75 L163.25 190.25 L163.50 190.50 L193.50 190.50 L193.75 190.25 L193.75 143.25 L194.75 142.25 L197.50 140.75 L201.25 138.25 L202.00 137.50 L203.00 137.00 L203.75 136.25 L204.75 135.75 L210.25 131.25 L210.50 131.25 L215.50 126.75 L215.75 126.75 L219.25 123.25 L219.50 123.25 L226.00 116.50 L226.00 116.25 L228.00 114.25 L228.00 114.00 L229.25 112.75 L229.25 112.50 L230.50 111.25 L233.25 107.50 L234.25 106.50 L236.00 106.50 L244.00 114.50 L244.25 114.25 L244.50 99.25 L244.75 99.00 L244.75 90.75 L245.00 90.50 L245.00 82.00 L245.25 81.75 L245.25 74.00 L245.00 73.75 L244.00 73.75 L243.75 74.00 L235.50 74.00 L235.25 74.25 L226.75 74.25 L226.50 74.50 L218.00 74.50 L217.75 74.75 L204.00 75.00 L204.00 75.25 L205.75 77.00 L206.00 77.00 L213.25 83.75 L213.25 85.50 L210.25 89.75 L209.25 90.75 L207.25 93.50 L205.75 95.00 L205.75 95.25 L203.50 97.50 L203.50 97.75 L197.00 104.25 L196.75 104.25 L195.50 105.50 L194.25 105.50 L193.75 105.00 L193.75 66.50 L190.25 63.50 L188.75 62.50 L187.50 61.25 L186.00 60.25 L184.75 59.00 L183.25 58.00 L180.50 55.50 L179.00 54.50 L177.75 53.25 L176.25 52.25 L175.00 51.00 L173.50 50.00 L172.25 48.75 L170.75 47.75 L168.00 45.25 L166.50 44.25 L165.25 43.00 L163.75 42.00 L162.50 40.75 L161.00 39.75 L155.50 35.00 L154.00 34.00 L152.75 32.75 L151.25 31.75 L148.50 29.25 L148.25 29.25 L143.00 24.75 L141.50 23.75 L138.75 21.25 L138.50 21.25 L133.25 16.75 L131.75 15.75 L129.00 13.25 L128.75 13.25 L123.50 8.75 L122.00 7.75 L120.75 6.50 L119.75 6.25 L46.75 66.00 L46.75 105.00 L46.25 105.50 L45.00 105.50 L37.25 98.00 L37.25 97.75 L33.00 93.25 L28.00 86.50 L27.75 86.50 L21.75 91.75 L21.50 91.75 L20.25 93.00 L20.00 93.00 L18.75 94.25 L18.50 94.25ZM77.25 78.00 L80.50 75.25 L80.75 75.25 L82.00 74.00 L83.50 73.00 L86.25 70.50 L87.75 69.50 L89.00 68.25 L90.50 67.25 L93.25 64.75 L94.75 63.75 L96.00 62.50 L97.50 61.50 L100.25 59.00 L101.75 58.00 L103.00 56.75 L104.50 55.75 L107.25 53.25 L108.75 52.25 L111.50 49.75 L111.75 49.75 L114.25 47.50 L115.75 46.50 L119.50 43.25 L121.00 43.25 L121.50 43.50 L124.00 45.75 L124.25 45.75 L128.00 49.00 L129.50 50.00 L130.75 51.25 L131.00 51.25 L134.75 54.50 L136.25 55.50 L137.50 56.75 L137.75 56.75 L141.50 60.00 L143.00 61.00 L144.25 62.25 L145.75 63.25 L147.00 64.50 L147.25 64.50 L153.75 70.00 L154.00 70.00 L157.75 73.25 L159.25 74.25 L160.50 75.50 L162.00 76.50 L163.25 77.75 L163.25 125.50 L162.25 126.25 L161.00 126.50 L159.00 127.50 L158.50 127.50 L153.00 129.50 L152.25 129.50 L151.25 130.00 L149.50 130.25 L149.25 130.50 L146.75 131.00 L146.50 131.25 L145.50 131.25 L145.25 131.50 L143.25 131.75 L143.00 132.00 L142.00 132.00 L141.75 132.25 L140.75 132.25 L140.50 132.50 L139.25 132.50 L139.00 132.75 L137.75 132.75 L137.50 133.00 L136.00 133.00 L135.75 133.25 L131.75 133.50 L131.50 133.75 L129.00 133.75 L128.75 134.00 L124.75 134.00 L124.50 134.25 L116.25 134.25 L116.00 134.00 L111.75 134.00 L111.50 133.75 L109.00 133.75 L108.75 133.50 L106.75 133.50 L106.50 133.25 L104.75 133.25 L104.50 133.00 L103.25 133.00 L103.00 132.75 L101.50 132.75 L101.25 132.50 L97.50 132.00 L97.25 131.75 L95.25 131.50 L95.00 131.25 L94.25 131.25 L94.00 131.00 L90.25 130.25 L89.25 129.75 L88.50 129.75 L85.25 128.50 L84.50 128.50 L83.75 128.00 L81.00 127.25 L80.25 126.75 L79.75 126.75 L79.00 126.25 L78.00 126.00 L77.25 125.25Z';
  var store = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
                set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* niente */ } },
                del: function (k) { try { sessionStorage.removeItem(k); } catch (e) { /* niente */ } } };

  var css = ''
    /* passaggio tra pagine: la casetta salta al centro */
    + 'html.th-leaving::before,html.th-arriving::before{content:"";position:fixed;inset:0;z-index:2147483000;background:radial-gradient(circle at 50% 46%,#fff 0,#f7f4f1 55%,#f3ece6 100%)}'
    + 'html.th-leaving::after,html.th-arriving::after{content:"";position:fixed;left:50%;top:46%;width:130px;height:110px;transform:translate(-50%,-50%);z-index:2147483001;background:url("' + ROOT + 'casetta.svg") center/contain no-repeat}'
    + 'html.th-leaving::before,html.th-leaving::after{animation:thov-in .18s ease both}'
    + 'html.th-arrived::before{animation:thov-out .35s ease .05s forwards}'
    + 'html.th-arrived::after{animation:thov-pop .4s cubic-bezier(.5,0,.3,1) forwards}'
    + '@keyframes thov-in{from{opacity:0}}'
    + '@keyframes thov-out{to{opacity:0;visibility:hidden}}'
    + '@keyframes thov-pop{40%{transform:translate(-50%,-50%) scale(1.12)}100%{transform:translate(-50%,-50%) scale(.2);opacity:0;visibility:hidden}}'
    /* apertura del sito */
    + '.th-intro{position:fixed;inset:0;z-index:2147483002;display:grid;place-items:center;overflow:hidden;cursor:pointer;background:radial-gradient(circle at 50% 50%,#fff 0,#f7f4f1 60%,#f1e8e1 100%);animation:ti-out .75s cubic-bezier(.7,0,.2,1) 2.55s forwards}'
    + '.th-intro.skip{animation:ti-out .45s cubic-bezier(.7,0,.2,1) forwards}'
    + '.ti-glow{position:absolute;width:90vmax;height:90vmax;border-radius:50%;background:radial-gradient(circle,rgba(247,148,29,.28),rgba(200,16,46,.10) 40%,transparent 68%);opacity:0;animation:ti-glow 1.8s ease-out .1s forwards}'
    + '.ti-ring{position:absolute;width:40vmin;height:40vmin;border-radius:50%;border:3px solid #e8302a;opacity:0;animation:ti-ring 1.2s cubic-bezier(.2,.7,.2,1) .95s forwards}'
    + '.ti-ring.r2{border-color:#f7941d;animation-delay:1.1s}'
    + '.ti-logo{position:relative;width:min(600px,86vw);aspect-ratio:987.5/196.2}'
    + '.ti-logo>*{position:absolute;display:block}'
    + '.ti-mark{left:.58%;top:3.19%;width:24.25%;height:93.91%;overflow:visible;transform-origin:20% 95%;animation:ti-mark .9s cubic-bezier(.2,.8,.2,1) .15s both}'
    + '.ti-fill{clip-path:polygon(0 100%,0 100%,0 100%);animation:ti-reveal .9s cubic-bezier(.2,.8,.2,1) .35s forwards}'
    + '.ti-line{fill:none;stroke:url(#tiL);stroke-width:2.4;stroke-linecap:round;stroke-dasharray:1000;stroke-dashoffset:1000;filter:drop-shadow(0 0 4px rgba(247,148,29,.8));animation:ti-draw 1s ease-in-out .1s forwards,ti-run 1.4s linear 1.15s infinite}'
    + '.ti-word{left:29.85%;top:14.53%;width:69.72%;height:44.6%;clip-path:inset(0 100% 0 0);animation:ti-wipe .7s cubic-bezier(.65,0,.25,1) .85s forwards}'
    + '.ti-tag{left:30.3%;top:71.61%;width:48.13%;height:25.87%;opacity:0;transform:translateY(10px);animation:ti-up .6s ease-out 1.4s forwards}'
    + '.ti-bar{left:0;right:0;bottom:-26%;height:4px;border-radius:4px;background:linear-gradient(90deg,#c8102e,#e8302a 35%,#f26a21 65%,#f7941d);transform:scaleX(0);transform-origin:left;animation:ti-bar .9s cubic-bezier(.65,0,.25,1) 1.3s forwards}'
    + '.ti-bar::after{content:"";position:absolute;top:-5px;bottom:-5px;width:60px;left:-60px;background:radial-gradient(closest-side,#fff,rgba(255,255,255,0));animation:ti-pulse 1s ease-in-out 2.05s forwards}'
    + '@keyframes ti-mark{0%{transform:scale(.8) rotate(-6deg)}70%{transform:scale(1.05) rotate(0)}100%{transform:scale(1)}}'
    + '@keyframes ti-reveal{60%{clip-path:polygon(0 100%,0 -60%,160% 100%)}100%{clip-path:polygon(0 100%,0 -140%,240% 100%)}}'
    + '@keyframes ti-draw{to{stroke-dashoffset:0}}'
    + '@keyframes ti-run{from{stroke-dasharray:90 910;stroke-dashoffset:1000}to{stroke-dasharray:90 910;stroke-dashoffset:0}}'
    + '@keyframes ti-wipe{to{clip-path:inset(0 0 0 0)}}'
    + '@keyframes ti-up{to{opacity:1;transform:none}}'
    + '@keyframes ti-bar{to{transform:scaleX(1)}}'
    + '@keyframes ti-pulse{to{left:calc(100% + 10px)}}'
    + '@keyframes ti-glow{0%{opacity:0;transform:scale(.5)}60%{opacity:1}100%{opacity:.85;transform:scale(1)}}'
    + '@keyframes ti-ring{0%{opacity:.9;transform:scale(.3)}100%{opacity:0;transform:scale(2.6)}}'
    + '@keyframes ti-out{0%{transform:none;border-radius:0}100%{transform:translateY(-105%);border-radius:0 0 50% 50%/0 0 18% 18%;visibility:hidden}}';
  // la casetta del caricamento deve essere già pronta quando serve
  try { var pre = new Image(); pre.src = ROOT + 'casetta.svg'; } catch (e) { /* niente */ }
  var style = document.createElement('style');
  style.textContent = css;
  (document.head || html).appendChild(style);

  // ---------------------------------------------------------------- apertura (una volta per sessione)
  var firstOpen = !store.get('thIntro');
  store.set('thIntro', '1');
  if (firstOpen && !reduce) {
    store.del('thNavAt');
    var g = '<defs><linearGradient id="tiG" gradientUnits="userSpaceOnUse" x1="6" y1="190" x2="245" y2="40"><stop offset="0" stop-color="#c8102e"/><stop offset=".45" stop-color="#e8302a"/><stop offset="1" stop-color="#f7941d"/></linearGradient>'
          + '<linearGradient id="tiL" gradientUnits="userSpaceOnUse" x1="6" y1="190" x2="245" y2="40"><stop offset="0" stop-color="#ff5a3c"/><stop offset="1" stop-color="#ffc35a"/></linearGradient></defs>';
    var intro = document.createElement('div');
    intro.className = 'th-intro';
    intro.setAttribute('aria-hidden', 'true');
    intro.innerHTML = '<div class="ti-glow"></div><div class="ti-ring"></div><div class="ti-ring r2"></div>'
      + '<div class="ti-logo"><svg class="ti-mark" viewBox="5.75 6.25 239.5 184.25">' + g
      + '<path class="ti-fill" fill="url(#tiG)" fill-rule="evenodd" d="' + MARK + '"/>'
      + '<path class="ti-line" pathLength="1000" d="' + MARK + '"/></svg>'
      + '<img class="ti-word" src="' + ROOT + 'logo-scritta.svg" alt="">'
      + '<img class="ti-tag" src="' + ROOT + 'logo-payoff.svg" alt="">'
      + '<div class="ti-bar"></div></div>';
    html.appendChild(intro);
    var done = function () { if (intro.parentNode) intro.parentNode.removeChild(intro); };
    intro.addEventListener('click', function () { intro.classList.add('skip'); });
    intro.addEventListener('animationend', function (e) { if (e.target === intro) done(); });
    setTimeout(done, 4500);
  } else if (!reduce) {
    // ---------------------------------------------------------------- arrivo da un'altra pagina
    var at = Number(store.get('thNavAt')) || 0;
    store.del('thNavAt');
    if (Date.now() - at < 6000) {
      html.classList.add('th-arriving');
      var started = Date.now();
      var finish = function () {
        var wait = Math.max(0, 380 - (Date.now() - started));
        setTimeout(function () {
          html.classList.add('th-arrived');
          setTimeout(function () { html.classList.remove('th-arriving', 'th-arrived'); }, 450);
        }, wait);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', finish); else finish();
      setTimeout(function () { html.classList.remove('th-arriving', 'th-arrived'); }, 3000);
    }
  }

  // ---------------------------------------------------------------- partenza verso un'altra pagina
  if (reduce) return;
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    var url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch (err) { return; }
    if (url.origin !== location.origin || !/\.html?$|\/$/.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.search === location.search) return; // stessa pagina (anche #ancore)
    e.preventDefault();
    store.set('thNavAt', String(Date.now()));
    html.classList.add('th-leaving');
    setTimeout(function () { location.href = url.href; }, 230);
  });
  // tornando indietro con la cache del browser la pagina non deve restare coperta
  window.addEventListener('pageshow', function (e) { if (e.persisted) html.classList.remove('th-leaving', 'th-arriving', 'th-arrived'); });
})();
