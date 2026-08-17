// Nazra · guided walkthrough ("where to start")
// Dims the page, glows the Enroll button, and shows a 3-step welcome card.
// Appears on first visit; reopens from the floating "?" button.
(function () {
  var KEY = "nazra_tour_done";
  var tour = document.getElementById("tour");
  var enrollBtn = document.getElementById("tour-enroll");
  var startBtn = document.getElementById("tour-start");
  var skipBtn = document.getElementById("tour-skip");
  var fab = document.getElementById("help-fab");
  var backdrop = tour ? tour.querySelector(".tour-backdrop") : null;
  if (!tour) return;

  function show() {
    tour.hidden = false;
    document.body.classList.add("tour-active");
  }
  function hide(persist) {
    tour.hidden = true;
    document.body.classList.remove("tour-active");
    if (persist) { try { localStorage.setItem(KEY, "1"); } catch (e) {} }
  }

  if (startBtn) startBtn.addEventListener("click", function () { hide(true); }); // link still opens Enroll
  if (skipBtn) skipBtn.addEventListener("click", function () { hide(true); });
  if (backdrop) backdrop.addEventListener("click", function () { hide(true); });
  if (fab) fab.addEventListener("click", function () { show(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(true); });

  var done = false;
  try { done = localStorage.getItem(KEY) === "1"; } catch (e) {}
  if (!done) show();
})();
