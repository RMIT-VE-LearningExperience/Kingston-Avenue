/*
 * Minimal SCORM 1.2 runtime wrapper for the Kingston Survey Tool.
 * Loaded before main.js by the packaged index.html (see scorm/build.sh).
 *
 * Behaviour:
 *   - finds the LMS API object (window.API) by walking parent/opener frames
 *   - LMSInitialize on load, status "incomplete"
 *   - status "completed" once the learner has taken a staff reading through the
 *     scope (a click on an enabled .staff-read button), or after 3 minutes of
 *     activity in the tool
 *   - session time + LMSCommit every 30 s and on unload, LMSFinish on unload
 *
 * Runs harmlessly outside an LMS (no API found -> all calls are no-ops).
 */
(function () {
  'use strict';
  var api = null;
  var started = Date.now();
  var initialised = false;
  var finished = false;
  var completed = false;
  var COMPLETE_AFTER_MS = 3 * 60 * 1000;

  function findAPI(win) {
    var tries = 0;
    while (win && tries < 10) {
      try { if (win.API) return win.API; } catch (e) { /* cross-origin frame */ }
      if (win.parent === win) break;
      win = win.parent; tries++;
    }
    return null;
  }

  function locate() {
    api = findAPI(window);
    if (!api && window.opener) api = findAPI(window.opener);
    return api;
  }

  function sessionTime() {
    var ms = Date.now() - started;
    var h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
    var cs = Math.floor((ms % 1000) / 10);
    var pad = function (n, w) { return String(n).padStart(w, '0'); };
    return pad(h, 4) + ':' + pad(m, 2) + ':' + pad(s, 2) + '.' + pad(cs, 2);
  }

  function set(k, v) { if (initialised && !finished) { try { api.LMSSetValue(k, v); } catch (e) {} } }
  function commit() { if (initialised && !finished) { try { set('cmi.core.session_time', sessionTime()); api.LMSCommit(''); } catch (e) {} } }

  function init() {
    if (!locate()) return;
    try {
      if (api.LMSInitialize('') === 'false') return;
      initialised = true;
      var status = api.LMSGetValue('cmi.core.lesson_status');
      if (status === 'completed' || status === 'passed') completed = true;
      else set('cmi.core.lesson_status', 'incomplete');
      set('cmi.core.exit', '');
      commit();
    } catch (e) { initialised = false; }
  }

  function markCompleted() {
    if (completed) return;
    completed = true;
    set('cmi.core.lesson_status', 'completed');
    set('cmi.core.score.raw', '100');
    set('cmi.core.score.min', '0');
    set('cmi.core.score.max', '100');
    commit();
  }

  function finish() {
    if (finished || !initialised) return;
    commit();
    try { api.LMSFinish(''); } catch (e) {}
    finished = true;
  }

  init();
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.staff-read');
    if (btn && !btn.disabled) markCompleted();
  }, true);
  setTimeout(markCompleted, COMPLETE_AFTER_MS);
  setInterval(commit, 30000);
  window.addEventListener('pagehide', finish);
  window.addEventListener('beforeunload', finish);
  window.KingstonScorm = { markCompleted: markCompleted, commit: commit, finish: finish, isConnected: function () { return initialised; } };
})();
