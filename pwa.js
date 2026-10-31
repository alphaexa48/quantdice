(() => {
  'use strict';

  const standaloneMedia = window.matchMedia('(display-mode: standalone)');
  const isStandalone = () => standaloneMedia.matches || window.navigator.standalone === true;
  const installButtons = Array.from(document.querySelectorAll('[data-install-app]'));
  const installHint = document.getElementById('installHint');
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isSamsung = /SamsungBrowser/i.test(ua);
  const isFirefox = /Firefox|FxiOS/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Android/i.test(ua);
  const defaultHint = installHint ? installHint.textContent : '';
  let installPrompt = null;
  let dialog = null;

  function syncInstallState() {
    const installed = isStandalone();
    installButtons.forEach((button) => { button.hidden = installed; });
    if (installHint) {
      installHint.textContent = installed
        ? 'DiceForge sudah berjalan sebagai aplikasi terpasang.'
        : defaultHint;
    }
  }

  function instructionContent() {
    if (isIOS) {
      return {
        title: 'Pasang di iPhone atau iPad',
        intro: 'Safari menyimpan web app ke Home Screen tanpa melalui App Store.',
        steps: [
          'Buka halaman DiceForge ini di Safari.',
          'Ketuk tombol Share (kotak dengan panah ke atas).',
          'Pilih “Add to Home Screen” atau “Tambah ke Layar Utama”.',
          'Ketuk “Add” untuk memasang ikon DiceForge.'
        ]
      };
    }
    if (isAndroid) {
      return isSamsung ? {
        title: 'Pasang di Samsung Internet',
        intro: 'Samsung Internet mendukung pemasangan web app langsung dari menu.',
        steps: [
          'Ketuk menu ⋮ di kanan bawah.',
          'Pilih “Add page to” lalu “Home screen”.',
          'Konfirmasi dengan mengetuk “Add”.'
        ]
      } : {
        title: 'Pasang di Android',
        intro: 'Chrome atau Edge dapat memasang DiceForge sebagai aplikasi mandiri.',
        steps: [
          'Buka halaman ini di Chrome atau Edge.',
          'Ketuk menu ⋮ di kanan atas.',
          'Pilih “Install app” atau “Add to Home screen”.',
          'Konfirmasi pemasangan pada dialog yang muncul.'
        ]
      };
    }
    if (isFirefox) {
      return {
        title: 'Pasang lewat Chrome atau Edge',
        intro: 'Firefox belum mendukung pemasangan web app di semua perangkat.',
        steps: [
          'Buka halaman DiceForge di Chrome atau Edge.',
          'Klik ikon install di address bar, atau menu ⋮.',
          'Pilih “Install DiceForge” / “Install page as app”.'
        ]
      };
    }
    if (isSafari) {
      return {
        title: 'Pasang lewat Safari',
        intro: 'Di macOS, Safari dapat menambahkan situs ke Dock.',
        steps: [
          'Buka halaman ini di Safari.',
          'Pilih menu File → “Add to Dock”.',
          'Beri nama aplikasi lalu klik “Add”.'
        ]
      };
    }
    return {
      title: 'Pasang di desktop',
      intro: 'Chrome dan Edge dapat menjalankan DiceForge di jendela aplikasinya sendiri.',
      steps: [
        'Klik ikon install di sisi kanan address bar.',
        'Atau buka menu ⋮ → “Cast, save, and share” → “Install page as app”.',
        'Konfirmasi dengan menekan “Install”.'
      ]
    };
  }

  function getDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'installDialog';
    dialog.className = 'install-dialog';
    dialog.setAttribute('aria-labelledby', 'installDialogTitle');
    dialog.innerHTML = `
      <button type="button" class="install-dialog-close" data-close aria-label="Tutup">×</button>
      <small class="install-dialog-kicker">INSTALL DICEFORGE</small>
      <h2 id="installDialogTitle"></h2>
      <p class="install-dialog-intro"></p>
      <ol class="install-dialog-steps"></ol>
      <p class="install-dialog-note">Setelah terpasang, DiceForge tampil penuh tanpa address bar. Sesi API tetap disimpan di memori server.</p>
      <button type="button" class="primary install-dialog-done" data-close>MENGERTI</button>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog || (event.target instanceof Element && event.target.closest('[data-close]'))) dialog.close();
    });
    return dialog;
  }

  function showInstructions() {
    const info = instructionContent();
    const element = getDialog();
    element.querySelector('h2').textContent = info.title;
    element.querySelector('.install-dialog-intro').textContent = info.intro;
    element.querySelector('.install-dialog-steps').innerHTML = info.steps.map((step) => `<li>${step}</li>`).join('');
    if (!element.open) element.showModal();
  }

  async function install() {
    if (isStandalone()) return;
    if (!installPrompt) {
      showInstructions();
      return;
    }
    const prompt = installPrompt;
    installPrompt = null;
    try {
      prompt.prompt();
      await prompt.userChoice;
    } catch {
      // The browser may reject a stale prompt; the manual guide still works.
      showInstructions();
    }
    syncInstallState();
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    syncInstallState();
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    syncInstallState();
    if (dialog && dialog.open) dialog.close();
  });

  standaloneMedia.addEventListener?.('change', syncInstallState);
  installButtons.forEach((button) => button.addEventListener('click', install));
  syncInstallState();

  if ('serviceWorker' in navigator) {
    const register = () => navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((error) => console.warn('[PWA] Service worker registration failed:', error));
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
})();
