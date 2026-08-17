// Nazra · make the hero logo "look" toward the cursor (subtle 3D tilt).
// The logo is a flat image, so we tilt/lean it toward the pointer to read as the
// eye following you. Respects reduced-motion.
(function () {
  var logo = document.querySelector(".khero-logo");
  if (!logo) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var TILT = 12, SHIFT = 6;
  function move(e) {
    var r = logo.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = (e.clientX - cx) / (window.innerWidth / 2);   // ~ -1..1
    var dy = (e.clientY - cy) / (window.innerHeight / 2);
    dx = Math.max(-1, Math.min(1, dx));
    dy = Math.max(-1, Math.min(1, dy));
    logo.style.transform =
      "perspective(700px) rotateY(" + (dx * TILT) + "deg) rotateX(" + (-dy * TILT) +
      "deg) translate(" + (dx * SHIFT) + "px," + (dy * SHIFT) + "px)";
  }
  function reset() { logo.style.transform = ""; }

  window.addEventListener("mousemove", move);
  window.addEventListener("mouseleave", reset);
})();
