(() => {
  "use strict";

  const roomParams = new URLSearchParams(window.location.search);
  const roomId = roomParams.get("room") || "kama-bakol-club-2026";
  const facilitatorSessionKey = `kerenMorningFacilitator:${roomId}`;
  let facilitatorToken = roomParams.get("control") || "";
  try {
    if (facilitatorToken) sessionStorage.setItem(facilitatorSessionKey, facilitatorToken);
    else facilitatorToken = sessionStorage.getItem(facilitatorSessionKey) || "";
  } catch (_) { /* The active tab can still use its original link. */ }
  if (roomParams.has("control")) {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("control");
    history.replaceState(null, "", cleanUrl.href);
  }
  const isLocalPreview = ["127.0.0.1", "localhost"].includes(window.location.hostname);
  const STORAGE_KEY = `kerenMorningClubV5:${roomId}`;
  const CLOSING_DECK_KEY = `kerenMorningClubClosingDeckV3:${roomId}`;
  const apiUrl = (path) => {
    const url = new URL(path, window.location.origin);
    url.searchParams.set("room", roomId);
    return url.href;
  };
  const scenes = [...document.querySelectorAll(".scene")];
  const nextButton = document.getElementById("nextButton");
  const backButton = document.getElementById("backButton");
  const sceneNumber = document.getElementById("sceneNumber");
  const sceneTotal = document.getElementById("sceneTotal");
  const railItems = [...document.querySelectorAll("#moduleRail li")];
  const horizonFill = document.getElementById("horizonFill");
  const toast = document.getElementById("completionToast");
  const scrollCue = document.getElementById("scrollCue");

  const defaultState = {
    version: 4,
    sceneOrder: "shower-first",
    scene: 0,
    completedModules: [],
    sleep: 5,
    entryEnergy: 5,
    arrivalReflectionStep: 0,
    arrivalReflectionReached: 0,
    arrivalReflectionComplete: false,
    focus: "",
    supplement: "",
    supplements: [],
    customSupplements: [],
    fruits: [],
    gratitudeRemaining: 360,
    gratitudeDuration: 360,
    gratitudeRunning: false,
    drainRemaining: 1200,
    drainRunning: false,
    drainSoundEnabled: true,
    protectionLayers: 0,
    oneThing: "",
    closingSongId: "",
    finishedAt: null
  };

  let state = loadState();
  let currentScene = Math.min(Math.max(Number(state.scene) || 0, 0), scenes.length - 1);
  let timerInterval = null;
  let gratitudeTimerInterval = null;
  let activeTimerStop = null;
  let soundStop = null;
  let holdTimer = null;
  let holdCompleted = false;
  let closingSongAudio = null;
  let activeGuideAudio = null;
  let gratitudeMusic = null, gratitudeMusicEnabled = false;

  if (!Array.isArray(state.supplements)) state.supplements = state.supplement ? [state.supplement] : [];
  if (!Array.isArray(state.customSupplements)) state.customSupplements = [];

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && parsed.version === 4) {
        if(Number(parsed.gratitudeDuration||300)!==360){
          const previousDuration=Number(parsed.gratitudeDuration||300);
          const elapsed=previousDuration-Number(parsed.gratitudeRemaining??previousDuration);
          parsed.gratitudeRemaining=Math.max(0,Math.min(360,360-elapsed));parsed.gratitudeDuration=360;
        }
        if (parsed.sceneOrder !== "shower-first") {
          const previousIndex = Number(parsed.scene);
          if (previousIndex === 14) parsed.scene = 15;
          else if (previousIndex === 15) parsed.scene = 14;
          parsed.completedModules = (parsed.completedModules || []).map(id => id === 6 ? 7 : id === 7 ? 6 : id);
          parsed.sceneOrder = "shower-first";
        }
        return { ...defaultState, ...parsed };
      }
    } catch (_) {}
    return { ...defaultState };
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  const fullscreenToggle = document.getElementById("fullscreenToggle");
  fullscreenToggle.setAttribute("aria-label", "מסך מלא");
  fullscreenToggle.addEventListener("click", async () => {
    if (document.body.classList.contains('presentation-fallback')) {
      document.body.classList.remove('presentation-fallback');fullscreenToggle.setAttribute('aria-pressed','false');fullscreenToggle.setAttribute('aria-label','מסך מלא');fullscreenToggle.lastElementChild.textContent='מסך מלא';return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (_) {
      document.body.classList.add('presentation-fallback');fullscreenToggle.setAttribute('aria-pressed','true');fullscreenToggle.setAttribute('aria-label','לצאת ממסך מלא');fullscreenToggle.lastElementChild.textContent='לצאת ממסך מלא';showToast('תצוגה גדולה נפתחה בתוך הדפדפן.');
    }
  });
  document.addEventListener("fullscreenchange", () => {
    const active = Boolean(document.fullscreenElement) || document.body.classList.contains('presentation-fallback');
    fullscreenToggle.setAttribute("aria-pressed", String(active));
    fullscreenToggle.setAttribute("aria-label", active ? "לצאת ממסך מלא" : "מסך מלא");
    fullscreenToggle.lastElementChild.textContent = active ? "לצאת ממסך מלא" : "מסך מלא";
  });

  const newMorningButton = document.getElementById("newMorningButton");
  if (!facilitatorToken && !isLocalPreview) newMorningButton.hidden = true;

  async function resetMorningRoom() {
    if (!window.confirm("לפתוח בוקר חדש? כל הסימונים והנתונים הזמניים של החדר הזה יימחקו.")) return;
    try {
      await sceneSyncQueue.catch(() => {});
      stopStageTimer(); stopAllTimers(); stopSound(); stopGuideAudio();
      await new Promise(resolve => setTimeout(resolve,1250));
      if (facilitatorToken || isLocalPreview) {
        const headers = facilitatorToken ? { "Authorization": `Bearer ${facilitatorToken}` } : {};
        const response = await fetch(apiUrl("/api/session-state"), {
          method: "DELETE",
          headers
        });
        if (!response.ok) throw new Error("room_reset_failed");
      }
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(`kerenMorningClubFocusWordsV1:${roomId}`);
      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel("kerenMorningClubFocusWall");
        channel.postMessage({ type: "room-reset", roomId });
        channel.close();
      }
      window.location.reload();
    } catch (_) {
      showToast("החדר לא התאפס. בדקי את החיבור ונסי שוב לפני פתיחת הלייב.");
    }
  }
  newMorningButton.addEventListener("click", resetMorningRoom);

  function setScene(index, options = {}) {
    closeExpandedFields();
    const nextIndex = Math.min(Math.max(index, 0), scenes.length - 1);
    stopStageTimer();
    stopAllTimers();
    stopSound();
    stopGuideAudio();

    const leaving = scenes[currentScene];
    const leavingModule = Number(leaving?.dataset.module || 0);
    const enteringModule = Number(scenes[nextIndex]?.dataset.module || 0);
    if (nextIndex > currentScene && leavingModule && enteringModule !== leavingModule && !state.completedModules.includes(leavingModule)) {
      state.completedModules.push(leavingModule);
    }

    currentScene = nextIndex;
    state.scene = currentScene;
    saveState();

    scenes.forEach((scene, i) => {
      const active = i === currentScene;
      scene.classList.toggle("is-active", active);
      scene.setAttribute("aria-hidden", String(!active));
      if (active) scene.scrollTop = 0;
    });

    const activeScene = scenes[currentScene];
    document.body.dataset.scene = activeScene.dataset.sceneId;
    document.documentElement.dataset.theme = activeScene.dataset.theme || "paper";
    updateLiveParticipantLink(activeScene.dataset.sceneId);
    renderStageTimer();
    updateNavigation();
    updateRail();
    syncFacilitatorScene(activeScene.dataset.sceneId);
    window.requestAnimationFrame(updateScrollCue);
    if (options.focus !== false) document.getElementById("experience").focus({ preventScroll: true });
  }

  function updateScrollCue() {
    const activeScene = scenes[currentScene];
    const overflow = activeScene.scrollHeight - activeScene.clientHeight > 18;
    const moreBelow = activeScene.scrollHeight - activeScene.clientHeight - activeScene.scrollTop > 18;
    scrollCue.hidden = !(overflow && moreBelow);
  }

  scenes.forEach((scene) => scene.addEventListener("scroll", updateScrollCue, { passive: true }));
  window.addEventListener("resize", updateScrollCue);
  scrollCue.addEventListener("click", () => {
    const activeScene = scenes[currentScene];
    activeScene.scrollBy({
      top: Math.max(180, activeScene.clientHeight * .56),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  });

  function updateNavigation() {
    sceneNumber.textContent = String(currentScene + 1);
    sceneTotal.textContent = String(scenes.length);
    backButton.disabled = currentScene === 0;
    nextButton.disabled = currentScene === scenes.length - 1;
  const activeSceneId = scenes[currentScene]?.dataset.sceneId;
  nextButton.textContent = activeSceneId === "whatsapp-share"
    ? "הבוקר הסתיים"
    : activeSceneId === "closing"
      ? "לשיר סגירה לבחירה"
      : activeSceneId === "closing-song"
        ? "לתזכורת השיתוף"
        : "המשך";
    const onDeep = scenes[currentScene].dataset.theme === "deep";
    document.querySelector(".navigation-dock").classList.toggle("after-deep", onDeep);
  }

  function updateRail() {
    const activeModule = Number(scenes[currentScene].dataset.module || 0);
    railItems.forEach((item) => {
      const module = Number(item.dataset.module);
      item.classList.toggle("is-current", module === activeModule);
      item.classList.toggle("is-complete", state.completedModules.includes(module));
    });
    const count = new Set(state.completedModules).size;
    horizonFill.style.width = `${Math.min(100, (count / 8) * 100)}%`;
  }

  function stopAllTimers() {
    if (activeTimerStop) activeTimerStop();
    activeTimerStop = null;
    if (timerInterval) window.clearInterval(timerInterval);
    timerInterval = null;
  }

  const mediaFades = new WeakMap();
  function resumeMedia(audio) {
    const pending = mediaFades.get(audio);
    if (pending) { clearInterval(pending.id); audio.volume = pending.volume; mediaFades.delete(audio); }
    return audio.play();
  }
  function fadeMedia(audio, rewind = false) {
    if (!audio || audio.paused || mediaFades.has(audio)) return;
    const volume = audio.volume;
    const started = performance.now();
    const id = setInterval(() => {
      const progress = Math.min(1, (performance.now() - started) / 1200);
      audio.volume = Math.max(0, volume * (1 - progress));
      if (progress === 1) {
        clearInterval(id); audio.pause(); if (rewind) audio.currentTime = 0;
        audio.volume = volume; mediaFades.delete(audio);
      }
    }, 30);
    mediaFades.set(audio, { id, volume });
  }
  function stopSound() {
    if(gratitudeMusic && !gratitudeMusic.paused) fadeMedia(gratitudeMusic);
    stopYoutube();
    if (soundStop) soundStop();
    soundStop = null;
    if (closingSongAudio && !closingSongAudio.paused) fadeMedia(closingSongAudio);
    document.querySelectorAll("[data-demo-sound]").forEach((button) => button.setAttribute("aria-pressed", "false"));
    const closingSongPlay = document.getElementById("closingSongPlay");
    if (closingSongPlay) {
      closingSongPlay.setAttribute("aria-pressed", "false");
      const label = closingSongPlay.querySelector(".sr-only");
      if (label) label.textContent = "להשמיע את השיר";
    }
  }

  nextButton.addEventListener("click", () => setScene(currentScene + 1));
  backButton.addEventListener("click", () => setScene(currentScene - 1));
  document.querySelectorAll("[data-next]").forEach((button) => button.addEventListener("click", () => setScene(currentScene + 1)));

  railItems.forEach((item) => {
    item.querySelector("button").addEventListener("click", () => {
      const module = Number(item.dataset.module);
      const index = scenes.findIndex((scene) => Number(scene.dataset.module) === module);
      if (index >= 0) setScene(index);
    });
  });

  const tinyScreen = window.matchMedia("(max-width: 380px)");
  function updateTinyRail() {
    railItems.forEach((item) => {
      const button = item.querySelector("button");
      if (tinyScreen.matches) {
        button.tabIndex = -1;
        button.setAttribute("aria-hidden", "true");
      } else {
        button.removeAttribute("tabindex");
        button.removeAttribute("aria-hidden");
      }
    });
  }
  tinyScreen.addEventListener?.("change", updateTinyRail);
  updateTinyRail();

  window.addEventListener("keydown", (event) => {
    if (["INPUT", "TEXTAREA", "BUTTON", "A"].includes(document.activeElement?.tagName)) return;
    if (event.key === "ArrowLeft") setScene(currentScene + 1);
    if (event.key === "ArrowRight") setScene(currentScene - 1);
  });

  function updateClock() {
    const now = new Date();
    document.getElementById("liveClock").textContent = new Intl.DateTimeFormat("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(now);
  }
  updateClock();
  window.setInterval(updateClock, 30000);

  document.querySelectorAll(".timer-field").forEach((field) => {
    const duration = Number(field.dataset.duration || 1200);
    const readout = field.querySelector(".timer-readout");
    const toggle = field.querySelector(".timer-toggle");
    const reset = field.querySelector(".timer-reset");
    const soundtrack = field.querySelector("#drainSoundtrack");
    const soundToggle = field.querySelector(".timer-sound");
    const drainWordNodes = [...field.querySelectorAll(".drain-words span")];
    const drainWordPool = [
      "לא יודעת", "בא לי", "די", "ומה אם", "אני רוצה", "עייפתי", "מותר לי", "בלי סדר", "אמת", "עוד",
      "כועסת", "אולי", "פחות", "עכשיו", "אין לי מושג", "אני מפחדת ש...", "יש בי קול", "אני לא חייבת לדעת",
      "אני לא רוצה להיות חזקה עכשיו", "אין לי כוח לזה", "אני מתגעגעת לעצמי", "מה אם אני פשוט...", "לא רוצה לענות",
      "די עם הצריך", "בא לי שקט", "אני כועסת על...", "לא סיימתי", "מי אמר שחייבים", "אני רוצה כסף", "אני רוצה לנוח בלי אשמה",
      "לא בא לי להיות נחמדה", "אולי אני בכלל רוצה משהו אחר", "אם הייתי אומרת את האמת...", "זה לא שלי", "בא לי לצעוק",
      "אני רוצה מקום", "מה אני דוחה", "אני עייפה מלשכנע", "די לשפר אותי", "אני בוחרת בי", "הלוואי שמישהו...",
      "אני לא יכולה יותר ככה", "אני יכולה אחרת", "לא עכשיו", "למה שוב אני", "יש לי תלונה", "אני רוצה שיראו אותי",
      "אולי מותר להשתנות", "אני מקנאה", "לא נעים לי להודות", "נמאס לי להצטמצם", "אני רוצה יותר", "זה מה שיש בי"
    ];
    let remaining = Math.min(duration, Math.max(0, Number(state.drainRemaining ?? duration)));
    let running = false;
    let wordInterval = null;
    let drainDeadline = 0;
    soundtrack.volume = .22;
    if (state.drainRunning) {
      state.drainRunning = false;
      saveState();
    }

    function renderTimer() {
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      readout.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      field.style.setProperty("--mist-opacity", String(Math.max(.08, remaining / duration)));
      field.classList.toggle("is-running", running);
      field.classList.toggle("has-started", running || remaining < duration);
      toggle.textContent = running ? "לעצור לרגע" : remaining === duration ? "להתחיל לכתוב" : "להמשיך";
      soundToggle.setAttribute("aria-pressed", String(state.drainSoundEnabled));
      soundToggle.setAttribute("aria-label", state.drainSoundEnabled ? "להשתיק את מוסיקת הרקע" : "להפעיל את מוסיקת הרקע");
    }

    function refreshDrainWords(all = false) {
      const nodes = all ? drainWordNodes : [...drainWordNodes].sort(() => Math.random() - .5).slice(0, 6);
      const colors = ["#fffaf0", "#ff9a7a", "#ff651b", "#ed0874", "#f5eedf"];
      nodes.forEach((node) => {
        node.textContent = drainWordPool[Math.floor(Math.random() * drainWordPool.length)];
        node.style.color = colors[Math.floor(Math.random() * colors.length)];
        node.style.fontSize = `${16 + Math.floor(Math.random() * 24)}px`;
        node.style.fontFamily = Math.random() > .5 ? 'Barlev, Polin, sans-serif' : 'Polin, sans-serif';
        node.style.fontWeight = [400, 700, 900][Math.floor(Math.random() * 3)];
        node.style.animationName = ['drain-lift', 'drain-bloom', 'drain-drift'][Math.floor(Math.random() * 3)];
        node.style.animationDuration = `${3 + Math.random() * 4}s`;
      });
    }

    async function playSoundtrack() {
      if (!state.drainSoundEnabled) return;
      try {
        await resumeMedia(soundtrack);
      } catch (_) {
        showToast("הדפדפן עצר את הצליל. לחצי על נקודת הצליל כדי להפעיל אותו.");
      }
    }

    function stop() {
      running = false;
      if (timerInterval) window.clearInterval(timerInterval);
      if (wordInterval) window.clearInterval(wordInterval);
      timerInterval = null;
      wordInterval = null;
      activeTimerStop = null;
      state.drainRemaining = remaining;
      state.drainRunning = false;
      fadeMedia(soundtrack);
      saveState();
      renderTimer();
    }

    toggle.addEventListener("click", () => {
      if (running) return stop();
      if (remaining <= 0) return showToast("הזמן הושלם. אפשר לאפס כדי להתחיל שוב.");
      running = true;
      drainDeadline = Date.now() + remaining * 1000;
      activeTimerStop = stop;
      state.drainRemaining = remaining;
      state.drainRunning = true;
      saveState();
      renderTimer();
      playSoundtrack();
      refreshDrainWords(true);
      wordInterval = window.setInterval(() => refreshDrainWords(false), 3600);
      timerInterval = window.setInterval(() => {
        remaining = Math.max(0, Math.ceil((drainDeadline - Date.now()) / 1000));
        state.drainRemaining = remaining;
        saveState();
        if (remaining <= 0) {
          remaining = 0;
          stop();
          showToast("עשרים הדקות הסתיימו, וזה הרגע להניח לעט ולתת למה שיצא לשקוע קצת לפני שממשיכות.");
        } else renderTimer();
      }, 1000);
    });

    reset.addEventListener("click", () => {
      stop();
      remaining = duration;
      state.drainRemaining = duration;
      soundtrack.currentTime = 0;
      field.classList.remove("has-started", "is-running");
      saveState();
      renderTimer();
    });

    soundToggle.addEventListener("click", () => {
      state.drainSoundEnabled = !state.drainSoundEnabled;
      if (state.drainSoundEnabled && running) playSoundtrack();
      else fadeMedia(soundtrack);
      saveState();
      renderTimer();
    });
    renderTimer();
  });

  const PARTICIPANT_WORDS_KEY = `kerenMorningClubFocusWordsV1:${roomId}`;
  const participantLink = document.getElementById("participantLink");
  const participantLinkBox = document.getElementById("participantLinkBox");
  const toggleParticipantLink = document.getElementById("toggleParticipantLink");
  const participantUrl = new URL("participant.html", window.location.href);
  participantUrl.search = "";
  participantUrl.searchParams.set("room", roomId);
  participantUrl.hash = "";
  participantLink.value = participantUrl.href;
  const liveParticipantLinkBar = document.getElementById("liveParticipantLinkBar");
  const liveParticipantLinkText = document.getElementById("liveParticipantLinkText");
  if (liveParticipantLinkText) liveParticipantLinkText.value = participantUrl.href;

  function updateLiveParticipantLink(sceneId) {
    if (!liveParticipantLinkBar) return;
    liveParticipantLinkBar.hidden = !["focus-intention", "focus-collective", "closing"].includes(sceneId);
    document.body.classList.toggle('has-live-link',!liveParticipantLinkBar.hidden);
    requestAnimationFrame(updateDockClearance);
  }

  async function copyParticipantRoomLink() {
    try {
      await navigator.clipboard.writeText(participantUrl.href);
      showToast(["127.0.0.1", "localhost"].includes(window.location.hostname)
        ? "קישור הסטייג׳ינג הועתק. עדיין לא לשלוח לקבוצה."
        : "קישור החדר הועתק. זה הקישור היחיד לכל הבוקר.");
    } catch (_) {
      participantLinkBox.hidden = false;
      toggleParticipantLink.setAttribute("aria-expanded", "true");
      participantLink.select();
      showToast("הקישור פתוח ומסומן להעתקה.");
    }
  }

  document.getElementById("closingCopyRoomLink")?.addEventListener("click", copyParticipantRoomLink);
  document.getElementById("copyLiveParticipantLink")?.addEventListener("click", copyParticipantRoomLink);

  toggleParticipantLink.addEventListener("click", () => {
    const open = participantLinkBox.hidden;
    participantLinkBox.hidden = !open;
    toggleParticipantLink.setAttribute("aria-expanded", String(open));
    toggleParticipantLink.textContent = open ? "להסתיר את הקישור" : "קישור למשתתפות";
    if (open) participantLink.select();
  });
  document.getElementById("copyParticipantLink").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(participantLink.value);
      showToast("הקישור למשתתפות הועתק.");
    } catch (_) {
      participantLink.select();
      showToast("הקישור מסומן. העתיקי אותו ידנית.");
    }
  });

  function readLocalGroupWords() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PARTICIPANT_WORDS_KEY));
      return Array.isArray(parsed) ? parsed.slice(-40) : [];
    } catch (_) {
      return [];
    }
  }

  function renderGroupWords(words) {
    const wall = document.getElementById("groupWordWall");
    const cloud = wall.querySelector(".group-word-cloud");
    cloud.replaceChildren();
    const visibleWords = words.slice(-30);
    wall.classList.remove("is-demo");
    wall.classList.toggle("is-empty", !visibleWords.length);
    if (!visibleWords.length) {
      return;
    }
    const colorFamilies = ["ink", "ink", "cobalt", "ink", "fuchsia", "cobalt", "ink", "orange"];
    visibleWords.forEach((entry, index) => {
      const word = document.createElement("span");
      word.className = "group-word";
      const value = typeof entry === "string" ? entry : entry.word;
      const lengthClass = value.length > 13 ? "phrase-long" : value.length > 7 ? "phrase-medium" : "phrase-short";
      word.classList.add(lengthClass, `word-${colorFamilies[index % colorFamilies.length]}`);
      word.textContent = value;
      word.style.setProperty("--word-index", String(index));
      word.style.setProperty("--word-tilt", `${[-2.4, 1.5, -0.8, 2.2, -1.3, 0.7][index % 6]}deg`);
      word.style.setProperty("--word-tilt-back", `${[1.1, -0.8, 0.5, -1.2, 0.8, -0.4][index % 6]}deg`);
      word.style.setProperty("--word-rise", `${[3, -4, 5, -2, 4, -3][index % 6]}px`);
      word.style.setProperty("--word-drift", `${10 + (index % 6) * 2}s`);
      word.style.animationDelay = `${Math.min(index * 45, 720)}ms, ${-(index % 7) * 1.3}s`;
      cloud.appendChild(word);
    });
  }

  async function refreshGroupWords() {
    try {
      const response = await fetch(apiUrl("/api/focus-words"), { cache: "no-store" });
      if (!response.ok) throw new Error("No live endpoint");
      const payload = await response.json();
      renderGroupWords(Array.isArray(payload.words) ? payload.words : []);
      document.getElementById("participantLinkNote").textContent = ["127.0.0.1", "localhost"].includes(window.location.hostname)
        ? "סטייג׳ינג מקומי בלבד. לפני שליחה לטלפונים צריך לפרסם חדר מאובטח."
        : "החיבור החי פעיל. כל מילה נשלחת בלי שם, נשמרת זמנית בלבד ונמחקת מן החדר לאחר יממה.";
    } catch (_) {
      renderGroupWords(readLocalGroupWords());
      document.getElementById("participantLinkNote").textContent = "מצב סטייג׳ינג: עובד בין טאבים במכשיר הזה. לשיתוף מטלפונים הפעילי את שרת החדר.";
    }
  }
  window.addEventListener("storage", (event) => {
    if (event.key === PARTICIPANT_WORDS_KEY) refreshGroupWords();
  });
  if ("BroadcastChannel" in window) {
    const focusChannel = new BroadcastChannel("kerenMorningClubFocusWall");
    focusChannel.addEventListener("message", refreshGroupWords);
  }
  refreshGroupWords();
  window.setInterval(refreshGroupWords, 3000);

  let sceneSyncQueue = Promise.resolve();
  function syncFacilitatorScene(sceneId) {
    if (!facilitatorToken && !isLocalPreview) return Promise.resolve();
    sceneSyncQueue = sceneSyncQueue.catch(() => {}).then(async () => {
      const response = await fetch(apiUrl('/api/session-state'), {
        method:'POST', headers:{'Content-Type':'application/json',...(facilitatorToken ? {Authorization:`Bearer ${facilitatorToken}`} : {})},
        body:JSON.stringify({sceneId})
      });
      if (!response.ok) throw new Error('scene_sync_failed');
    });
    sceneSyncQueue.catch(() => showToast('השלב לא הסתנכרן למשתתפות. בדקי את חיבור החדר ואת קישור המנחה.'));
    return sceneSyncQueue;
  }


  const supplementLibrary = Array.isArray(window.KEREN_SUPPLEMENTS) ? window.KEREN_SUPPLEMENTS : [];
  const supplementRiver = document.getElementById("supplementRiver");
  const supplementIntentInput = document.getElementById("supplementIntentInput");
  const supplementContextLabel = document.getElementById("supplementContextLabel");
  const supplementThemes = [...new Set(supplementLibrary.map((item) => item.category))];
  const intentionFamilies = [
    { category: "אהבה ורכות", words: ["אהבה", "רכות", "חמלה", "לב", "עדינות"] },
    { category: "קול וגבולות", words: ["קול", "ביטוי", "גבול", "אמת", "נאמנות", "אישור"] },
    { category: "אמון ושקט", words: ["אמון", "שקט", "סבלנות", "התמסרות", "ודאות"] },
    { category: "יצירה ותנועה", words: ["אומץ", "יצירה", "תנועה", "התחלה", "פעולה", "לידה"] },
    { category: "גוף ונשימה", words: ["גוף", "נשימה", "מנוחה", "ביטחון", "בריאות"] },
    { category: "שחרור", words: ["שחרור", "להרפות", "פחות", "לשחרר", "פירוק"] },
    { category: "כוונה ובהירות", words: ["כוונה", "בהירות", "מיקוד", "דיוק", "כיוון"] },
    { category: "רגש והסכמה", words: ["רגש", "פחד", "כאב", "כעס", "הסכמה"] },
    { category: "זהות ונוכחות", words: ["נוכחות", "זהות", "עצמי", "להיות", "ערך"] },
    { category: "קשר ושייכות", words: ["קשר", "שייכות", "יחד", "קהילה", "משפחה"] }
  ];

  function normalizeHebrew(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0591-\u05c7]/g, "").replace(/[^\u05d0-\u05ea\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  function supplementScore(item, query) {
    const normalized = normalizeHebrew(query);
    if (!normalized) return 1;
    const haystack = normalizeHebrew(`${item.category} ${item.text}`);
    const tokens = normalized.split(" ").filter((token) => token.length > 1);
    let score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 8 : 0), 0);
    intentionFamilies.forEach((family) => {
      if (family.words.some((word) => normalized.includes(normalizeHebrew(word))) && item.category === family.category) score += 12;
    });
    return score;
  }

  function selectSupplements(query) {
    if (!query) return supplementLibrary.slice(0, 64);
    const scored = supplementLibrary.map((item) => ({ item, score: supplementScore(item, query) })).sort((a, b) => b.score - a.score || a.item.id - b.item.id);
    const strong = scored.filter((entry) => entry.score > 0).slice(0, 64).map((entry) => entry.item);
    return strong.length >= 16 ? strong : scored.slice(0, 48).map((entry) => entry.item);
  }

  function renderSupplementRiver(query = "") {
    const selected = selectSupplements(query);
    supplementRiver.replaceChildren();
    const laneCount = 4;
    for (let laneIndex = 0; laneIndex < laneCount; laneIndex += 1) {
      const lane = document.createElement("div");
      lane.className = `supplement-lane lane-${laneIndex + 1}`;
      const track = document.createElement("div");
      track.className = "supplement-track";
      const laneItems = selected.filter((_, index) => index % laneCount === laneIndex).slice(0, 12);
      [...laneItems, ...laneItems].forEach((item, index) => {
        const phrase = document.createElement("span");
        phrase.textContent = item.text;
        if (index >= laneItems.length) phrase.setAttribute("aria-hidden", "true");
        track.appendChild(phrase);
      });
      lane.appendChild(track);
      supplementRiver.appendChild(lane);
    }
    const strongMatches = query ? selected.filter((item) => supplementScore(item, query) > 0).length : supplementLibrary.length;
    supplementContextLabel.textContent = query
      ? `זרם לפי „${query}” · ${strongMatches} תוספים קרובים מתוך ${supplementLibrary.length} במאגר. כלי המנחה בלבד.`
      : `${supplementLibrary.length} תוספי התודעה של קרן נעים עכשיו כהשראה. המשתתפות כותבות במחברת ואינן מפעילות את המסך.`;
  }

  document.getElementById("supplementIntentForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const query = supplementIntentInput.value.trim();
    state.supplement = query;
    saveState();
    renderSupplementRiver(query);
  });
  document.getElementById("drawSupplementTheme").addEventListener("click", () => {
    const theme = supplementThemes[Math.floor(Math.random() * supplementThemes.length)] || "";
    supplementIntentInput.value = theme;
    state.supplement = theme;
    saveState();
    renderSupplementRiver(theme);
  });
  supplementIntentInput.value = state.supplement || "";
  renderSupplementRiver(state.supplement || "");

  const fruitField = document.getElementById("fruitField");
  const gratitudeFruits = [
    ["🍎", "תפוח"], ["🍊", "תפוז"], ["🍋", "לימון"], ["🍐", "אגס"], ["🍑", "אפרסק"],
    ["🍓", "תות"], ["🍒", "דובדבנים"], ["🫐", "אוכמניות"]
  ];
  gratitudeFruits.forEach(([symbol, name], index) => {
    const fruitMark = document.createElement("span");
    fruitMark.className = "fruit-button timed-fruit";
    fruitMark.dataset.fruit = String(index + 1);
    fruitMark.setAttribute("aria-label", `${name}, מסמן שעברו עוד 45 שניות`);
    fruitMark.setAttribute("role", "img");
    const fruit = document.createElement("span");
    fruit.textContent = symbol;
    fruit.setAttribute("aria-hidden", "true");
    fruitMark.appendChild(fruit);
    fruitField.appendChild(fruitMark);
  });
  const gratitudeDuration = 360;
  gratitudeMusic=document.getElementById('gratitudeMusic');gratitudeMusic.volume=.22;
  const gratitudeMusicToggle=document.getElementById('gratitudeMusicToggle');
  function updateGratitudeMusicButton(){const playing=!gratitudeMusic.paused;gratitudeMusicToggle.setAttribute('aria-pressed',String(playing));gratitudeMusicToggle.textContent=playing?'להפסיק את מוזיקת החליל':'להפעיל חליל בזמן הכתיבה';}
  async function playGratitudeMusic(){
    gratitudeMusic.currentTime=gratitudeRemaining>0?gratitudeDuration-gratitudeRemaining:0;
    try{await resumeMedia(gratitudeMusic);updateGratitudeMusicButton();document.getElementById('gratitudeMusicStatus').textContent='החליל מתנגן. בסיום הוא ייעלם בפייד־אאוט.';}catch(_){gratitudeMusicEnabled=false;document.getElementById('gratitudeMusicStatus').textContent='המוזיקה לא נפתחה. אפשר להמשיך בשקט או לנסות שוב.';}
  }
  gratitudeMusicToggle.addEventListener('click',()=>{if(!gratitudeMusic.paused){gratitudeMusicEnabled=false;fadeMedia(gratitudeMusic);}else{gratitudeMusicEnabled=true;playGratitudeMusic();}});
  gratitudeMusic.addEventListener('play',updateGratitudeMusicButton);gratitudeMusic.addEventListener('pause',updateGratitudeMusicButton);
  gratitudeMusic.addEventListener('ended',()=>{gratitudeMusicEnabled=false;updateGratitudeMusicButton();document.getElementById('gratitudeMusicStatus').textContent='שש דקות החליל הושלמו.';});
  let gratitudeRemaining = Math.min(gratitudeDuration, Math.max(0, Number(state.gratitudeRemaining ?? gratitudeDuration)));
  let gratitudeRunning = false;
  let gratitudeDeadline = 0;
  if (state.gratitudeRunning) {
    state.gratitudeRunning = false;
    saveState();
  }
  function renderGratitudeTimer() {
    const elapsed = gratitudeDuration - gratitudeRemaining;
    const ripeCount = Math.min(gratitudeFruits.length, Math.floor(elapsed / 45));
    document.querySelectorAll(".timed-fruit").forEach((fruit, index) => fruit.classList.toggle("is-picked", index < ripeCount));
    document.getElementById("gratitudeTimerReadout").textContent = `${String(Math.floor(gratitudeRemaining / 60)).padStart(2, "0")}:${String(gratitudeRemaining % 60).padStart(2, "0")}`;
    document.getElementById("gratitudeTimerToggle").textContent = gratitudeRunning ? "לעצור לרגע" : gratitudeRemaining === gratitudeDuration ? "להתחיל את זמן ההודיות" : gratitudeRemaining === 0 ? "הזמן הושלם" : "להמשיך לכתוב";
    document.getElementById("gratitudeTimeNote").textContent = gratitudeRemaining === 0
      ? "שש דקות הכתיבה הושלמו. אין צורך לספור כמה יצא, רק להניח לעט ולתת לתודה להישאר בגוף."
      : ripeCount === 0
        ? `אין מספר שצריך להגיע אליו. הפרי הראשון יבשיל בעוד ${Math.max(0,45-elapsed)} שניות.`
        : `${ripeCount} פירות הבשילו כסימני זמן, והיד ממשיכה לכתוב בלי לספור הודיות.`;
  }
  function stopGratitudeTimer() {
    gratitudeRunning = false;
    if(gratitudeMusic&&!gratitudeMusic.paused)fadeMedia(gratitudeMusic);
    if (gratitudeTimerInterval) window.clearInterval(gratitudeTimerInterval);
    gratitudeTimerInterval = null;
    activeTimerStop = null;
    state.gratitudeRemaining = gratitudeRemaining;
    state.gratitudeRunning = false;
    saveState();
    renderGratitudeTimer();
  }
  document.getElementById("gratitudeTimerToggle").addEventListener("click", () => {
    if (gratitudeRunning || gratitudeRemaining === 0) return stopGratitudeTimer();
    gratitudeRunning = true;
    gratitudeDeadline = Date.now() + gratitudeRemaining * 1000;
    if(gratitudeMusicEnabled&&gratitudeMusic.paused)playGratitudeMusic();
    activeTimerStop = stopGratitudeTimer;
    state.gratitudeRunning = true;
    saveState();
    renderGratitudeTimer();
    gratitudeTimerInterval = window.setInterval(() => {
      gratitudeRemaining = Math.max(0, Math.ceil((gratitudeDeadline - Date.now()) / 1000));
      state.gratitudeRemaining = gratitudeRemaining;
      saveState();
      if (gratitudeRemaining === 0) { stopGratitudeTimer(); stopSound(); stopGuideAudio(); }
      else renderGratitudeTimer();
    }, 1000);
  });
  document.getElementById("gratitudeTimerReset").addEventListener("click", () => {
    stopGratitudeTimer();
    gratitudeRemaining = gratitudeDuration;
    state.gratitudeRemaining = gratitudeDuration;
    saveState();
    renderGratitudeTimer();
  });
  renderGratitudeTimer();

  const protectionField = document.querySelector(".protection-field");
  const protectionHold = document.getElementById("protectionHold");
  function advanceProtection() {
    if (state.protectionLayers >= 2) state.protectionLayers = 0;
    else state.protectionLayers += 1;
    saveState();
    renderProtection();
    if (state.protectionLayers > 0) {
      showToast(state.protectionLayers === 1 ? "שכבה ראשונה נפתחה." : "שתי שכבות האור נוכחות.");
    }
  }
  function renderProtection() {
    protectionField.classList.toggle("has-one", state.protectionLayers >= 1);
    protectionField.classList.toggle("has-two", state.protectionLayers >= 2);
    const status = state.protectionLayers === 0 ? "בועת האור מחכה" : state.protectionLayers === 1 ? "בועת האור נוכחת. מרכבת האור מחכה" : "שתי שכבות האור נוכחות";
    document.getElementById("protectionStatus").textContent = status;
    protectionHold.querySelector("span").textContent = state.protectionLayers === 0
      ? "להפעיל את בועת האור"
      : state.protectionLayers === 1
        ? "להפעיל את מרכבת האור"
        : "לאפס לקראת הקבוצה";
  }
  function beginHold(event) {
    event.preventDefault();
    if (holdTimer || event.repeat) return;
    holdCompleted = false;
    holdTimer = window.setTimeout(() => {
      holdCompleted = true;
      advanceProtection();
    }, 1400);
  }
  function cancelHold() { if (holdTimer) window.clearTimeout(holdTimer); holdTimer = null; }
  ["pointerdown", "keydown"].forEach((name) => protectionHold.addEventListener(name, (event) => {
    if (name === "keydown" && !["Enter", " "].includes(event.key)) return;
    beginHold(event);
  }));
  ["pointerup", "pointerleave", "pointercancel", "keyup"].forEach((name) => protectionHold.addEventListener(name, cancelHold));
  protectionHold.addEventListener("click", () => {
    if (!holdCompleted) advanceProtection();
    holdCompleted = false;
  });
  renderProtection();

  function stopGuideAudio() {
    if (!activeGuideAudio) return;
    const activePanel = activeGuideAudio.closest("[data-guide-player]");
    if (activePanel?.closest(".shower-scene")) {
      document.querySelector(".body-scan")?.classList.remove("is-scanning");
      const scanButton = document.getElementById("scanToggle");
      if (scanButton) {
        scanButton.setAttribute("aria-pressed", "false");
        scanButton.textContent = "להתחיל את המקלחת הפנימית";
      }
    }
    fadeMedia(activeGuideAudio);
    document.querySelectorAll("[data-guide-player]").forEach((panel) => {
      const button = panel.querySelector(".voice-guide-button");
      if (!button) return;
      button.setAttribute("aria-pressed", "false");
      button.querySelector("span").textContent = "▶";
    });
    activeGuideAudio = null;
  }

  document.querySelectorAll("[data-guide-player]").forEach(async (panel) => {
    const button = panel.querySelector(".voice-guide-button");
    const audio = panel.querySelector("audio");
    const status = button.querySelector("small");
    const source = panel.dataset.audioSrc;
    try {
      const response = await fetch(source, { method: "HEAD", cache: "no-store" });
      if (!response.ok) return;
      audio.src = source;
      button.disabled = false;
      status.textContent = "הקול והמוזיקה מוכנים";
    } catch (_) {}

    button.addEventListener("click", async () => {
      if (audio.paused) {
        stopGuideAudio();
        try {
          await resumeMedia(audio);
          activeGuideAudio = audio;
          button.setAttribute("aria-pressed", "true");
          button.querySelector("span").textContent = "Ⅱ";
          status.textContent = "קרן מחזיקה עכשיו את המרחב";
          if (panel.closest(".shower-scene")) {
            document.querySelector(".body-scan")?.classList.add("is-scanning");
            const scanButton = document.getElementById("scanToggle");
            if (scanButton) {
              scanButton.setAttribute("aria-pressed", "true");
              scanButton.textContent = "לעצור את תנועת המים";
            }
          }
        } catch (_) {
          status.textContent = "ההקלטה לא הצליחה להיפתח";
        }
      } else {
        stopGuideAudio();
        status.textContent = "הקול והמוזיקה מוכנים";
      }
    });
    audio.addEventListener("timeupdate", () => { if (audio.duration && audio.duration - audio.currentTime <= 1.2) fadeMedia(audio); });
    audio.addEventListener("ended", () => {
      stopGuideAudio();
      status.textContent = "אפשר להפעיל שוב";
    });
    audio.addEventListener("error", () => {
      button.disabled = true;
      status.textContent = "ההקלטה לא נטענה";
    });
  });

  const scanToggle = document.getElementById("scanToggle");
  const bodyScan = document.querySelector(".body-scan");
  scanToggle.addEventListener("click", () => {
    const isRunning = bodyScan.classList.toggle("is-scanning");
    scanToggle.setAttribute("aria-pressed", String(isRunning));
    scanToggle.textContent = isRunning ? "לעצור את תנועת המים" : "להמשיך את המקלחת הפנימית";
  });



  let lastMovementSignature = null;
  function renderMovementField(movements = []) {
    const actual = Array.isArray(movements)
      ? movements.filter((item) => item?.entryPhrase && item?.exitPhrase)
      : [];
    const visible = actual;
    const wall = document.getElementById("movementShareWall");
    if (!wall) return;
    const content = document.getElementById("movementFlowContent");
    if (!content) return;
    const signature = JSON.stringify(actual.map(item => [item.entryPhrase, item.exitPhrase]));
    if (signature === lastMovementSignature) return;
    lastMovementSignature = signature;
    wall.dataset.density = actual.length > 18 ? "many" : actual.length > 8 ? "medium" : "few";
    document.getElementById("movementShareCount").textContent = actual.length === 1 ? "שיתוף אחד בחדר" : actual.length ? `${actual.length} שיתופים בחדר` : "";
    content.replaceChildren();
    window.KEREN_MOVEMENT_WAVE?.setMovements(actual);
    if (!actual.length) {
      const waiting = document.createElement("p");
      waiting.className = "movement-field-empty";
      waiting.textContent = "השיתופים יופיעו כאן אחרי שהמשתתפות ישלחו אותם.";
      content.appendChild(waiting);
    }
    visible.forEach((item, index) => {
      const pair = document.createElement("div");
      pair.className = "movement-share";
      pair.style.setProperty("--share-index", String(index));
      const entry = document.createElement("span");
      entry.className = "movement-entry";
      entry.textContent = `נכנסתי עם ${item.entryPhrase}`;
      const exit = document.createElement("span");
      exit.className = "movement-exit";
      exit.textContent = `אני יוצאת עם ${item.exitPhrase}`;
      pair.append(entry, exit);
      content.appendChild(pair);
    });
    const note = document.getElementById("movementFieldNote");
    if (note) note.textContent = actual.length
      ? `${actual.length} תנועות אנונימיות כבר נוכחות על המסך. אותו קישור נשאר פתוח לעוד משתתפות.`
      : "השיתופים יופיעו כאן אחרי שהמשתתפות ישלחו אותם. אפשר גם להישאר עם הדברים במחברת.";
  }

  document.getElementById("toggleMovementMotion").addEventListener("click", (event) => {
    const paused = document.getElementById("movementShareWall").classList.toggle("is-motion-paused");
    window.KEREN_MOVEMENT_WAVE?.setPaused(paused);
    event.currentTarget.setAttribute("aria-pressed", String(paused));
    event.currentTarget.textContent = paused ? "להמשיך את תנועת המילים" : "לעצור את תנועת המילים";
  });

  function renderGroupSummary(summary) {
    renderMovementField(summary.movements);
  }

  async function refreshGroupSummary() {
    try {
      const response = await fetch(apiUrl("/api/group-summary"), { cache: "no-store" });
      if (!response.ok) throw new Error("No live summary");
      renderGroupSummary(await response.json());
    } catch (_) {
      renderGroupSummary({ sleepAverage: null, entryAverage: null, exitAverage: null, sleepCount: 0, entryCount: 0, exitCount: 0, movements: [] });
    }
  }
  refreshGroupSummary();
  window.setInterval(refreshGroupSummary, 3000);

  async function playDemoSound(type, button) {
    stopSound();
    if (button.dataset.audioSrc) {
      const audio = new Audio(button.dataset.audioSrc);
      audio.volume = .34;
      try {
        await resumeMedia(audio);
        button.setAttribute("aria-pressed", "true");
        soundStop = () => {
          fadeMedia(audio, true);
        };
        audio.addEventListener("ended", () => { if (soundStop) stopSound(); }, { once: true });
        return;
      } catch (_) {
        return showToast("הצליל לא נפתח. אפשר להמשיך את הפתיחה בשקט.");
      }
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return showToast("הסאונד אינו זמין כאן. אפשר להמשיך בשקט.");
    const context = new AudioContext();
    const master = context.createGain();
    master.connect(context.destination);
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(.09, context.currentTime + 1.1);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 8.2);
    const frequencies = type === "opening" ? [196, 293.66, 440] : [440, 329.63, 220];
    const oscillators = frequencies.map((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 1 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.value = .20 / (index + 1);
      oscillator.connect(gain).connect(master);
      oscillator.start(context.currentTime + index * .45);
      oscillator.stop(context.currentTime + 8.4);
      return oscillator;
    });
    button.setAttribute("aria-pressed", "true");
    soundStop = () => {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(0.0001, context.currentTime, .18);
      window.setTimeout(() => context.close(), 900);
      oscillators.forEach((oscillator) => { try { oscillator.stop(context.currentTime + .8); } catch (_) {} });
    };
    window.setTimeout(() => { if (soundStop) stopSound(); }, 8500);
  }
  document.querySelectorAll("[data-demo-sound]").forEach((button) => button.addEventListener("click", () => {
    if (button.getAttribute("aria-pressed") === "true") return stopSound();
    playDemoSound(button.dataset.demoSound, button);
  }));

  const closingDeckSource = window.KEREN_CLOSING_SONGS || { version: "empty", songs: [] };
  const closingSongCandidates = Array.isArray(closingDeckSource.songs) ? closingDeckSource.songs : [];
  const manualSongs = window.KEREN_YOUTUBE_LIBRARY?.songs || closingSongCandidates;
  const seenClosingSongIds = new Set();
  const closingSongs = closingSongCandidates.filter((song) => song.approved && (song.audio || /^[A-Za-z0-9_-]{11}$/.test(song.youtubeId || '')));
  const songDeck = document.getElementById("songDeck");
  const songDeckDots = document.getElementById("songDeckDots");
  const drawClosingSong = document.getElementById("drawClosingSong");
  const songDeckNote = document.getElementById("songDeckNote");
  const closingSongCard = document.getElementById("closingSongCard");
  const closingSongPlay = document.getElementById("closingSongPlay");
  const closingSongStatus = document.getElementById("closingSongStatus");
  const takeClosingSong = document.getElementById("takeClosingSong");
  const closingSongProgress = document.getElementById("closingSongProgress");
  closingSongAudio = document.getElementById("closingSongAudio");
  let songDrawing = false;
  let songSelection = 0;

  const songLibraryCards = document.getElementById("songLibraryCards");

  closingSongs.forEach((song, index) => {
    const dot = document.createElement("span");
    dot.style.setProperty("--dot-index", String(index));
    dot.dataset.songId = song.id;
    songDeckDots.appendChild(dot);
  });

  function loadClosingDeckBag() {
    const deckId = closingDeckSource.deckId || "kama-bakol-morning-cycle";
    try {
      const parsed = JSON.parse(localStorage.getItem(CLOSING_DECK_KEY));
      if (parsed && parsed.deckId === deckId && Array.isArray(parsed.remaining) && Array.isArray(parsed.used)) return parsed;
    } catch (_) {}
    return { deckId, cycle: 1, remaining: [], used: [], lastDrawnId: "" };
  }

  function saveClosingDeckBag(bag) {
    try { localStorage.setItem(CLOSING_DECK_KEY, JSON.stringify(bag)); } catch (_) {}
  }

  function randomIndex(length) {
    if (length <= 1) return 0;
    if (window.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return values[0] % length;
    }
    return Math.floor(Math.random() * length);
  }

  function shuffledIds(songs, excludedId = "") {
    const ids = songs.map((song) => song.id);
    for (let index = ids.length - 1; index > 0; index -= 1) {
      const swapIndex = randomIndex(index + 1);
      [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
    }
    if (ids.length > 1 && ids[0] === excludedId) [ids[0], ids[1]] = [ids[1], ids[0]];
    return ids;
  }

  function reconcileClosingDeckBag() {
    const bag = loadClosingDeckBag();
    const validIds = new Set(closingSongs.map((song) => song.id));
    bag.used = bag.used.filter((id, index, values) => validIds.has(id) && values.indexOf(id) === index);
    bag.remaining = bag.remaining.filter((id, index, values) => validIds.has(id) && !bag.used.includes(id) && values.indexOf(id) === index);
    const knownIds = new Set([...bag.used, ...bag.remaining]);
    const newSongs = closingSongs.filter((song) => !knownIds.has(song.id));
    if (newSongs.length) bag.remaining.push(...shuffledIds(newSongs));
    saveClosingDeckBag(bag);
    return bag;
  }

  async function drawSongFromBag() {
    const bag = reconcileClosingDeckBag();
    if (facilitatorToken) {
      try {
        const response = await fetch(apiUrl("/api/song-deck"), {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${facilitatorToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            deckId: bag.deckId,
            songIds: closingSongs.map((song) => song.id),
            seedUsedIds: bag.used
          })
        });
        if (response.ok) {
          const shared = await response.json();
          const selected = closingSongs.find((song) => song.id === shared.selectedId);
          if (selected) {
            bag.cycle = Number(shared.cycle) || bag.cycle;
            bag.used = Array.isArray(shared.usedIds) ? shared.usedIds : bag.used;
            bag.remaining = Array.isArray(shared.remainingIds) ? shared.remainingIds : bag.remaining;
            bag.lastDrawnId = shared.selectedId;
            saveClosingDeckBag(bag);
            renderSongLibrary();
            return selected;
          }
        }
      } catch (_) {}
    }
    if (!bag.remaining.length && closingSongs.length) {
      bag.cycle += 1;
      bag.used = [];
      bag.remaining = shuffledIds(closingSongs, bag.lastDrawnId);
    }
    const selectedId = bag.remaining.shift();
    if (!selectedId) return null;
    bag.used.push(selectedId);
    bag.lastDrawnId = selectedId;
    saveClosingDeckBag(bag);
    renderSongLibrary();
    return closingSongs.find((song) => song.id === selectedId) || null;
  }

  function renderSongLibrary() {
    if (!songLibraryCards) return;
    const bag=reconcileClosingDeckBag();const remaining=new Set(bag.remaining);songDeckDots.querySelectorAll('span').forEach(dot=>dot.classList.toggle('is-used',!remaining.has(dot.dataset.songId)));
    const normalise = text => String(text).normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase();
    const query=normalise(document.getElementById('songLibrarySearch')?.value||'').trim();
    const songs=manualSongs.filter(song=>!query||normalise(song.title).includes(query));
    songLibraryCards.replaceChildren();
    songs.forEach(song=>{
      const card=document.createElement('article');card.className='song-library-card quality-חיבור';
      const number=document.createElement('small');number.textContent=String(song.playlistIndex||manualSongs.indexOf(song)+1).padStart(2,'0');
      const title=document.createElement('strong');title.textContent=song.title;
      const source=document.createElement('span');source.textContent='ניגון מוטמע מתוך השירים שלי ביוטיוב';
      const choose=document.createElement('button');choose.type='button';choose.textContent='לבחור את השיר';choose.setAttribute('aria-label',`לבחור את השיר: ${song.title}`);
      choose.addEventListener('click',()=>{stopSound();renderClosingSong(song,true);});card.append(number,title,source,choose);songLibraryCards.appendChild(card);
    });
    document.getElementById('songLibraryCount').textContent=query?`${songs.length} תוצאות מתוך ${manualSongs.length} רשומות בפלייליסט`:`כל ${manualSongs.length} הרשומות בפלייליסט השירים שלי`;
    if(!songs.length){const empty=document.createElement('p');empty.textContent='לא נמצא שיר בשם הזה. אפשר לנסות מילה אחרת.';songLibraryCards.appendChild(empty);}
  }
  document.getElementById('songLibrarySearch').addEventListener('input',renderSongLibrary);

  let youtubePlayer = null, youtubeReady = false, youtubeVideo = '', youtubeFade = null;
  let youtubeApiPromise = null, youtubeLoadSequence = 0, youtubeMetadataId = '';
  function ensureYoutubeApi() {
    if (window.YT?.Player) return Promise.resolve();
    if (youtubeApiPromise) return youtubeApiPromise;
    youtubeApiPromise = new Promise((resolve,reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (typeof previous === 'function') previous(); resolve(); };
      const script = document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>reject(new Error('YouTube API unavailable'));document.head.appendChild(script);
    });
    return youtubeApiPromise;
  }
  function youtubeCommand(command,args=[]) {
    if (youtubeReady && typeof youtubePlayer?.[command] === 'function') youtubePlayer[command](...args);
  }
  function stopYoutube() {
    if (!youtubeVideo || !youtubeReady || youtubeFade) return;
    const initial = youtubePlayer.getVolume();const started=performance.now();
    youtubeFade=setInterval(()=>{const progress=Math.min(1,(performance.now()-started)/1200);youtubePlayer.setVolume(Math.max(0,initial*(1-progress)));if(progress===1){clearInterval(youtubeFade);youtubeFade=null;youtubePlayer.pauseVideo();youtubePlayer.setVolume(initial);}},30);
  }
  function updateYoutubeMetadata() {
    if (!youtubeReady || !youtubeVideo) return;
    const info=youtubePlayer.getVideoData?.()||{};const duration=youtubePlayer.getDuration();
    closingSongStatus.dataset.youtubeState=String(youtubePlayer.getPlayerState());
    if(info.video_id)closingSongStatus.dataset.videoId=info.video_id;
    if (duration>0 && info.video_id) {
      if (youtubeMetadataId !== info.video_id) {
        youtubeMetadataId=info.video_id;youtubeVideo=info.video_id;
        const song=manualSongs.find(s=>s.youtubeId===info.video_id);
        if(song){document.getElementById('closingSongName').textContent=song.title;state.closingSongId=song.id;takeClosingSong.href=song.listenUrl;saveState();}
        stageDurations['closing-song']=Math.ceil(duration);delete stageTimes['closing-song'];if(stageId()==='closing-song'&&!stageTick)renderStageTimer();
      }
      const current=youtubePlayer.getCurrentTime();closingSongProgress.style.setProperty('--song-progress',`${Math.min(100,current/duration*100)}%`);
      if(duration-current<=1.2 && youtubePlayer.getPlayerState()===1)stopYoutube();
    }
  }
  setInterval(updateYoutubeMetadata,300);
  async function loadYoutube(song) {
    const sequence=++youtubeLoadSequence;
    if(youtubeFade){clearInterval(youtubeFade);youtubeFade=null;}
    youtubeVideo=song.youtubeId||'';youtubeMetadataId='';
    const frame=document.getElementById('closingYoutubeFrame');frame.hidden=!youtubeVideo;
    if(!youtubeVideo){if(youtubeReady)youtubePlayer.pauseVideo();return;}
    closingSongPlay.disabled=true;closingSongStatus.textContent='טוענת את השיר מתוך רשימת השירים שלך...';
    try {
      await ensureYoutubeApi();if(sequence!==youtubeLoadSequence)return;
      const cue=()=>{
        if(sequence!==youtubeLoadSequence)return;
        youtubePlayer.setVolume(100);
        if(song.playlistIndex)youtubePlayer.cuePlaylist({listType:'playlist',list:'PLeSXjAqYXF5w',index:song.playlistIndex-1});
        else youtubePlayer.cueVideoById(song.youtubeId);
        closingSongPlay.disabled=false;closingSongStatus.textContent='השיר מוכן ביוטיוב. אפשר להפעיל כאן או בתוך הנגן.';
      };
      if(youtubePlayer){if(youtubeReady)cue();return;}
      youtubePlayer=new YT.Player('closingYoutubeFrame',{host:'https://www.youtube.com',width:'640',height:'360',videoId:song.youtubeId,
        playerVars:{enablejsapi:1,playsinline:1,rel:0,origin:location.origin,list:'PLeSXjAqYXF5w',listType:'playlist'},
        events:{onReady:()=>{youtubeReady=true;if(sequence!==youtubeLoadSequence){const latest=manualSongs.find(s=>s.id===state.closingSongId);if(latest?.youtubeId)loadYoutube(latest);else youtubePlayer.pauseVideo();return;}cue();},onStateChange:event=>{
          if(!youtubeVideo)return;
          const playing=event.data===1;closingSongPlay.setAttribute('aria-pressed',String(playing));closingSongPlay.querySelector('.sr-only').textContent=playing?'להשהות את השיר':'להשמיע את השיר';
          if(playing)closingSongStatus.textContent='השיר מתנגן.';else if(event.data===2)closingSongStatus.textContent='השיר מושהה.';else if(event.data===0)closingSongStatus.textContent='השיר הסתיים. אפשר לצאת איתו אל היום.';
          updateYoutubeMetadata();
        },onError:event=>{closingSongPlay.disabled=true;closingSongStatus.textContent=`יוטיוב לא מאפשר כרגע לנגן את הסרטון הזה כאן (${event.data}). אפשר לבחור שיר אחר או לפתוח אותו בקישור.`;}}});
    } catch(_) {closingSongPlay.disabled=true;closingSongStatus.textContent='נגן יוטיוב לא נטען. אפשר לנסות שוב או לפתוח את השיר בקישור.';}
  }

  async function renderClosingSong(song, moveFocus = false) {
    if (!song) return;
    const selection = ++songSelection;
    if(youtubeVideo && youtubeReady && youtubePlayer.getPlayerState()===1){stopYoutube();await new Promise(resolve=>setTimeout(resolve,1250));if(selection!==songSelection)return;}
    if (!closingSongAudio.paused) {
      fadeMedia(closingSongAudio);
      await new Promise(resolve=>setTimeout(resolve,1250));
      if (selection !== songSelection) return;
    }
    state.closingSongId = song.id;
    queueMicrotask(() => {
      if (selection !== songSelection) return;
      stageDurations['closing-song'] = Math.ceil(Number(song.duration) || 180);
      delete stageTimes['closing-song'];
      if(stageId()==='closing-song'){stopStageTimer();renderStageTimer();}
    });
    saveState();
    songDeck.classList.remove("is-drawing");
    songDeck.classList.add("is-revealed");
    document.getElementById("songDeckBack").hidden = true;
    closingSongCard.hidden = false;
    drawClosingSong.hidden = true;
    document.getElementById("closingSongName").textContent = song.title;
    document.getElementById("closingSongQuality").textContent = song.quality || "שיר סגירה";
    songDeckDots.querySelectorAll("span").forEach((dot) => dot.classList.toggle("is-selected", dot.dataset.songId === song.id));

    closingSongAudio.pause();
    closingSongAudio.removeAttribute("src");
    closingSongAudio.load();
    closingSongProgress.style.setProperty("--song-progress", "0%");
    closingSongPlay.setAttribute("aria-pressed", "false");
    loadYoutube({...song,youtubeId:song.audio ? '' : song.youtubeId});
    if (song.youtubeId && !song.audio) {
      closingSongPlay.disabled = !youtubeReady;
      closingSongStatus.textContent = 'טוענת נגן יוטיוב לבחירה מתוך כל השירים שלך...';
    } else if (song.audio) {
      closingSongAudio.src = song.audio;
      closingSongPlay.disabled = false;
      closingSongStatus.textContent = "השיר מוכן. לחצי כדי להשמיע.";
    } else {
      closingSongPlay.disabled = true;
      closingSongStatus.textContent = "השיר נבחר. קובץ האודיו עדיין לא נטען.";
    }
    if (song.listenUrl) {
      takeClosingSong.href = song.listenUrl;
      takeClosingSong.hidden = false;
    } else {
      takeClosingSong.hidden = true;
    }
    if (moveFocus) {
      closingSongCard.focus({ preventScroll: true });
      window.requestAnimationFrame(() => {
        const activeScene = closingSongCard.closest(".scene");
        if (activeScene && activeScene.scrollHeight - activeScene.clientHeight > 18) {
          let cardTop = 0;
          let offsetNode = closingSongCard;
          while (offsetNode && offsetNode !== activeScene) {
            cardTop += offsetNode.offsetTop;
            offsetNode = offsetNode.offsetParent;
          }
          activeScene.scrollTop = Math.max(0, cardTop - 12);
        }
        updateScrollCue();
      });
    } else {
      window.requestAnimationFrame(updateScrollCue);
    }
  }

  if (!closingSongs.length) {
    drawClosingSong.disabled = true;
    songDeckNote.textContent = "חפיסת 12 השירים מחכה לאישור שלך ולחיבור קובצי האודיו. רק שירים מאושרים ותקינים ייכנסו להגרלה.";
  } else {
    const bag = reconcileClosingDeckBag();
    songDeckNote.textContent = `זה בוקר ${Math.min(bag.used.length + 1, closingSongs.length)} בסבב. ${bag.remaining.length} שירים חדשים עדיין מחכים בחפיסה, ושיר שכבר נשמע לא ייבחר שוב.`;
    const savedSong = closingSongs.find((song) => song.id === state.closingSongId) || manualSongs.find((song) => song.id === state.closingSongId);
    if (savedSong) renderClosingSong(savedSong);
  }
  renderSongLibrary();

  drawClosingSong.addEventListener("click", () => {
    if (songDrawing || !closingSongs.length) return;
    songDrawing = true;
    drawClosingSong.disabled = true;
    drawClosingSong.textContent = "החפיסה נפתחת";
    songDeck.classList.add("is-drawing");
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 920;
    window.setTimeout(async () => {
      const selectedSong = await drawSongFromBag();
      renderClosingSong(selectedSong, true);
      songDrawing = false;
    }, delay);
  });

  closingSongPlay.addEventListener("click", async () => {
    if (youtubeVideo) {
      if (closingSongPlay.getAttribute('aria-pressed') === 'true') { stopYoutube(); closingSongPlay.setAttribute('aria-pressed','false'); }
      else { if(youtubeFade){clearInterval(youtubeFade);youtubeFade=null;} youtubeCommand('setVolume',[100]); youtubeCommand('playVideo'); closingSongStatus.textContent='פותחת את הנגן. אם ההשמעה לא מתחילה, לחצי על כפתור ההפעלה שבתוכו.'; }
      return;
    }
    if (!closingSongAudio.src || closingSongPlay.disabled) return;
    if (!closingSongAudio.paused) return stopSound();
    stopSound();
    try {
      await resumeMedia(closingSongAudio);
      closingSongPlay.setAttribute("aria-pressed", "true");
      closingSongPlay.querySelector(".sr-only").textContent = "להשהות את השיר";
      closingSongStatus.textContent = "השיר מתנגן.";
    } catch (_) {
      closingSongStatus.textContent = "הניגון לא נפתח. אפשר להמשיך את הסיום בשקט.";
    }
  });

  closingSongAudio.addEventListener('loadedmetadata', () => {
    if (!Number.isFinite(closingSongAudio.duration)) return;
    stageDurations['closing-song'] = Math.ceil(closingSongAudio.duration);
    delete stageTimes['closing-song'];
    if(stageId()==='closing-song' && !stageTick) renderStageTimer();
  });
  closingSongAudio.addEventListener("timeupdate", () => {
    const progress = closingSongAudio.duration ? (closingSongAudio.currentTime / closingSongAudio.duration) * 100 : 0;
    closingSongProgress.style.setProperty("--song-progress", `${Math.min(100, progress)}%`);
  });
  closingSongAudio.addEventListener("ended", () => {
    closingSongPlay.setAttribute("aria-pressed", "false");
    closingSongPlay.querySelector(".sr-only").textContent = "להשמיע שוב את השיר";
    closingSongStatus.textContent = "השיר הסתיים. אפשר לצאת איתו אל היום.";
  });
  closingSongAudio.addEventListener("error", () => {
    closingSongPlay.disabled = true;
    closingSongStatus.textContent = "קובץ השיר לא נטען. אפשר להמשיך את הסיום בשקט.";
  });

  function finishMorning() {
    state.finishedAt = new Date().toISOString();
    state.completedModules = [1,2,3,4,5,6,7,8];
    saveState();
    updateRail();
  setScene(scenes.length - 1);
  showToast("הבוקר הושלם. התנופה ממשיכה איתך אל היום.");
  }
  document.getElementById("finishMorning").addEventListener("click", finishMorning);
  document.getElementById("finishWithoutSong").addEventListener("click", finishMorning);

  document.getElementById("resetMorning").addEventListener("click", resetMorningRoom);

  const expandedFieldHomes = new Map();
  function closeExpandedFields() {
    for (const [panel,marker] of expandedFieldHomes) { panel.classList.remove('is-expanded-field'); marker.replaceWith(panel); }
    expandedFieldHomes.clear();document.body.classList.remove('has-expanded-field');
  }
  document.querySelectorAll('[data-field-fullscreen]').forEach((button) => {
    button.addEventListener('click', async () => {
      const target = document.getElementById(button.dataset.fieldFullscreen);
      if (!target) return;
      if(expandedFieldHomes.has(target)) return;
      closeExpandedFields();const marker=document.createComment('expanded-field-home');target.before(marker);expandedFieldHomes.set(target,marker);document.body.appendChild(target);
      target.classList.add('is-expanded-field');document.body.classList.add('has-expanded-field');
      target.querySelector('.field-fullscreen-exit')?.focus();
    });
  });
  document.querySelectorAll('#groupFocusPanel,#movementShareWall').forEach((panel) => {
    const exit = document.createElement('button'); exit.type='button';exit.className='field-fullscreen-exit';exit.textContent='לחזור לחדר';
    exit.addEventListener('click',closeExpandedFields);panel.appendChild(exit);
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeExpandedFields();document.body.classList.remove('presentation-fallback');if(!document.fullscreenElement){fullscreenToggle.setAttribute('aria-pressed','false');fullscreenToggle.setAttribute('aria-label','מסך מלא');fullscreenToggle.lastElementChild.textContent='מסך מלא';}}});
  function updateDockClearance() {
    const dock=document.querySelector('.navigation-dock');
    document.documentElement.style.setProperty('--navigation-clearance',`${Math.max(0,Math.ceil(innerHeight-dock.getBoundingClientRect().top+10))}px`);
    document.documentElement.style.setProperty('--live-link-height',`${Math.ceil(liveParticipantLinkBar.getBoundingClientRect().height)}px`);
  }
  if ('ResizeObserver' in window) {
    const dockObserver=new ResizeObserver(updateDockClearance);
    dockObserver.observe(document.querySelector('.navigation-dock'));dockObserver.observe(liveParticipantLinkBar);
  }
  window.addEventListener('resize',updateDockClearance);
  const stageDurations = { threshold:30, 'opening-song':60, 'arrival-sleep':60, 'arrival-energy':60,
    'arrival-add':90, 'arrival-release':90, 'arrival-preserve':90, drain:1200,
    'focus-intention':120, 'focus-collective':180, 'supplements-example':120, 'supplements-flow':240,
    'gratitude-technique':120, 'gratitude-practice':360, protection:180, shower:300, planning:180,
    closing:120, 'closing-song':180, 'whatsapp-share':60 };
  const stageTimes = {};
  let stageTick = null, stageDeadline = 0;
  function stageId() { return scenes[currentScene].dataset.sceneId; }
  function stopStageTimer() {
    if (stageTick) clearInterval(stageTick);
    stageTick = null;
  }
  function renderStageTimer() {
    const id = stageId();
    const custom = id === 'drain' ? document.querySelector('.timer-readout')
      : id === 'gratitude-practice' ? document.getElementById('gratitudeTimerReadout') : null;
    const seconds = stageTimes[id] ?? stageDurations[id] ?? 60;
    document.getElementById('stageTimerReadout').textContent = custom ? custom.textContent
      : `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
    const running = id === 'drain' ? Boolean(document.querySelector('.timer-field.is-running'))
      : id === 'gratitude-practice' ? gratitudeRunning : Boolean(stageTick);
    document.getElementById('stageTimerToggle').textContent = running ? 'השהיית טיימר' : 'התחלת טיימר';
    document.getElementById('stageTimerToggle').setAttribute('aria-pressed', String(running));
  }
  document.getElementById('stageTimerToggle').addEventListener('click', () => {
    const id = stageId();
    if (id === 'drain') return document.querySelector('.timer-toggle').click();
    if (id === 'gratitude-practice') return document.getElementById('gratitudeTimerToggle').click();
    if (stageTick) { stopStageTimer(); renderStageTimer(); return; }
    stageDeadline = Date.now() + (stageTimes[id] ?? stageDurations[id] ?? 60) * 1000;
    stageTick = setInterval(() => {
      stageTimes[id] = Math.max(0, Math.ceil((stageDeadline - Date.now()) / 1000));
      if (!stageTimes[id]) { stopStageTimer(); stopSound(); stopGuideAudio(); showToast('זמן השלב הושלם. אפשר להמשיך כשאתן מוכנות.'); }
      renderStageTimer();
    }, 200);
    renderStageTimer();
  });
  document.getElementById('stageTimerReset').addEventListener('click', () => {
    const id = stageId(); stopStageTimer();
    if (id === 'drain') document.querySelector('.timer-reset').click();
    else if (id === 'gratitude-practice') document.getElementById('gratitudeTimerReset').click();
    else delete stageTimes[id];
    stopSound(); stopGuideAudio(); renderStageTimer();
  });
  setInterval(renderStageTimer, 500);

  setScene(currentScene, { focus: false });
})();
