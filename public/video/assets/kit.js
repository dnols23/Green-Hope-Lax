// Shared by every template page: puts the answers into the page before its timeline is built.
//   data-field="key"   text from that answer
//   data-if="key"      shown only when that answer is filled in (data-unless: the opposite)
//   data-lines="key"   one child per line of a multi-line answer, cloned from its <template>
//   data-fit="960"     shrinks the font until the text is at most that many px wide
(function () {
  var F = window.__FIELDS || {};
  function val(k) {
    return F[k] == null ? '' : String(F[k]);
  }
  function each(sel, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), fn);
  }
  each('[data-field]', function (el) {
    el.textContent = val(el.getAttribute('data-field'));
  });
  each('[data-lines]', function (el) {
    var tpl = el.querySelector('template');
    val(el.getAttribute('data-lines'))
      .split('\n')
      .filter(function (l) { return l.trim(); })
      .forEach(function (line) {
        var node = tpl.content.firstElementChild.cloneNode(true);
        var slot = node.querySelector('[data-line]') || node;
        slot.textContent = line;
        el.appendChild(node);
      });
  });
  each('[data-if]', function (el) {
    if (!val(el.getAttribute('data-if')).trim()) el.style.display = 'none';
  });
  each('[data-unless]', function (el) {
    if (val(el.getAttribute('data-unless')).trim()) el.style.display = 'none';
  });
  function fit() {
    each('[data-fit]', function (el) {
      var max = Number(el.getAttribute('data-fit'));
      el.style.fontSize = '';
      var w = el.offsetWidth;
      if (w > max) el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * max) / w + 'px';
    });
  }
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  // A repeatable scatter (confetti, sparks): the same numbers on every render.
  function rand(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  window.HF = { F: F, val: val, fit: fit, rand: rand };
})();
