const SW_SCRIPT = `
  (function() {
    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      window.deferredPrompt = e;
      window.dispatchEvent(new CustomEvent('pwa-installable'));
    });

    if ('serviceWorker' in navigator) {
      var shouldRegister = true;
      if (typeof window !== 'undefined') {
        var hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          shouldRegister = ${process.env.NEXT_PUBLIC_ENABLE_SW_ON_LOCALHOST === 'true' ? 'true' : 'false'};
        }
      }
      if (shouldRegister) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('/pathguard-sw.js').then(function() {
          }, function() {
          });
        });
      }
    }
  })();
`;

export default function ServiceWorkerRegistration() {
  return <script dangerouslySetInnerHTML={{ __html: SW_SCRIPT }} />;
}