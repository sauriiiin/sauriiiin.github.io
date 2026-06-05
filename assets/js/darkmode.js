(function() {
  var saved = localStorage.getItem('theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

  function injectToggle() {
    if (document.querySelector('.darkmode-toggle')) return;
    var btn = document.createElement('button');
    btn.className = 'darkmode-toggle';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.setAttribute('title', 'Toggle dark mode');
    updateLabel(btn);
    btn.addEventListener('click', function() {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
      }
      updateLabel(btn);
    });
    document.body.appendChild(btn);
  }

  function updateLabel(btn) {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.innerHTML = isDark
      ? '<span class="icon">&#9788;</span> Light'
      : '<span class="icon">&#9790;</span> Dark';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectToggle);
  } else {
    injectToggle();
  }
})();
