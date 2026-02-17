export const CONTROL_BAR_SCRIPT = `
  <script>
  (function() {
    var detailsBtn = document.getElementById('toggle-details');
    if (detailsBtn) {
      detailsBtn.addEventListener('click', function() {
        var showing = this.classList.toggle('active');
        this.textContent = showing ? 'Hide Issue Explanations' : 'Show Issue Explanations';
        var items = document.querySelectorAll('.issue-details');
        for (var i = 0; i < items.length; i++) {
          items[i].style.display = showing ? 'block' : 'none';
        }
      });
    }
    var fixBtns = document.querySelectorAll('.control-bar .fix-btn');
    for (var i = 0; i < fixBtns.length; i++) {
      fixBtns[i].addEventListener('click', function() {
        var fw = this.getAttribute('data-fw');
        var wasActive = this.classList.contains('active');
        var allFixBtns = document.querySelectorAll('.control-bar .fix-btn');
        for (var j = 0; j < allFixBtns.length; j++) {
          allFixBtns[j].classList.remove('active');
        }
        var allFixes = document.querySelectorAll('.issue-fix');
        for (var j = 0; j < allFixes.length; j++) {
          allFixes[j].style.display = 'none';
        }
        if (wasActive) return;
        this.classList.add('active');
        var matches = document.querySelectorAll('.issue-fix-' + fw);
        for (var j = 0; j < matches.length; j++) {
          matches[j].style.display = 'block';
        }
      });
    }
    window.togglePages = function(el) {
      var card = el.closest('.issue-card');
      var pageDiv = card.querySelector('.issue-card-pages');
      var caret = el.querySelector('.caret');
      if (!pageDiv) return;
      var isOpen = pageDiv.style.display === 'block';
      pageDiv.style.display = isOpen ? 'none' : 'block';
      if (caret) caret.classList.toggle('open', !isOpen);
    };
    window.openScannedPages = function() {
      var details = document.getElementById('scanned-pages');
      if (details) {
        details.open = true;
        details.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    var printBtns = document.querySelectorAll('.print-btn');
    for (var i = 0; i < printBtns.length; i++) {
      printBtns[i].addEventListener('click', function() {
        var fw = this.getAttribute('data-fw');
        var subtitles = document.querySelectorAll('.print-subtitle');
        for (var j = 0; j < subtitles.length; j++) {
          subtitles[j].style.display = 'none';
        }
        var fixes = document.querySelectorAll('.print-item-fix');
        for (var j = 0; j < fixes.length; j++) {
          fixes[j].style.display = 'none';
        }
        var activeSubtitle = document.querySelector('.print-subtitle-' + fw);
        if (activeSubtitle) activeSubtitle.style.display = 'block';
        var activeFixes = document.querySelectorAll('.print-fix-' + fw);
        for (var j = 0; j < activeFixes.length; j++) {
          activeFixes[j].style.display = 'block';
        }
        window.print();
      });
    }
  })();
  </script>
`;

export const COPY_PROMPT_SCRIPT = `
  <script>
  function copyPrompt() {
    var text = document.getElementById('ai-prompt-text').textContent;
    var btn = document.querySelector('.ai-copy-btn');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        btn.textContent = 'Copied!';
        setTimeout(function() { btn.textContent = 'Copy to clipboard'; }, 2000);
      }, function() {
        fallbackCopy(text, btn);
      });
    } else {
      fallbackCopy(text, btn);
    }
  }
  function fallbackCopy(text, btn) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      btn.textContent = 'Copied!';
    } catch (e) {
      btn.textContent = 'Copy failed';
    }
    document.body.removeChild(ta);
    setTimeout(function() { btn.textContent = 'Copy to clipboard'; }, 2000);
  }
  </script>
`;
