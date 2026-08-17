// Nazra · loading screen
// Shows the centered Nazra logo, then fades out once the app signals it's ready
// (window 'nazra-ready'), with a minimum display time and a safety timeout.
(function () {
  var splash = document.getElementById("splash");
  if (!splash) return;
  var hidden = false;
  var MIN = 1100;      // keep the logo on screen at least this long
  var MAX = 9000;      // never hang longer than this
  var start = Date.now();

  function hide() {
    if (hidden) return;
    hidden = true;
    splash.classList.add("hide");
    setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 650);
  }
  function ready() {
    var wait = Math.max(0, MIN - (Date.now() - start));
    setTimeout(hide, wait);
  }

  window.addEventListener("nazra-ready", ready);
  // fallback for static pages (no models to load): fade shortly after load
  window.addEventListener("load", function () { setTimeout(ready, 200); });
  setTimeout(hide, MAX); // safety net
})();
