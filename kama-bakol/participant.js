(() => {
  "use strict";

  const roomParams = new URLSearchParams(window.location.search);
  const roomId = roomParams.get("room") || "kama-bakol-club-2026";
  const apiUrl = (path) => {
    const url = new URL(path, window.location.origin);
    url.searchParams.set("room", roomId);
    return url.href;
  };
  const WORDS_KEY = `kerenMorningClubFocusWordsV1:${roomId}`;
  const PARTICIPANT_KEY = `kerenMorningClubParticipantV1:${roomId}`;
  const participantId = localStorage.getItem(PARTICIPANT_KEY) || (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  localStorage.setItem(PARTICIPANT_KEY, participantId);
  const status = document.getElementById("participantStatus");
  const steps = {
    waiting: document.getElementById("participantWaiting"),
    notebook: document.getElementById("participantNotebook"),
    focus: document.getElementById("participantFocus"),
    closing: document.getElementById("participantExit")
  };
  let personal = { focusWord: "", entryPhrase: "", exitPhrase: "" };
  let visibleStep = "";
  let roomResetHandled = false;
  let generation = localStorage.getItem(`${PARTICIPANT_KEY}:generation`) || null;

  function clearPreviousMorningDraft() {
    if (roomResetHandled) return;
    roomResetHandled = true;
    personal = { focusWord: "", entryPhrase: "", exitPhrase: "" };
    localStorage.removeItem(`${PARTICIPANT_KEY}:state`);
    localStorage.removeItem(WORDS_KEY);
    const entry = document.getElementById("participantEntryPhrase");
    const exit = document.getElementById("participantExitPhrase");
    if (entry) entry.value = "";
    if (exit) exit.value = "";
    document.getElementById('participantWord').value = '';
    document.getElementById('personalShift').hidden = true;
    document.getElementById('personalShift').textContent = '';
    status.textContent = "החדר נפתח לבוקר חדש. כל מה שנשאר מאתמול נוקה.";
  }

  if ("BroadcastChannel" in window) {
    const resetChannel = new BroadcastChannel("kerenMorningClubFocusWall");
    resetChannel.addEventListener("message", (event) => {
      if (event.data?.type !== "room-reset" || event.data?.roomId !== roomId) return;
      roomResetHandled = false;
      clearPreviousMorningDraft();
      showStep("threshold");
    });
  }

  function showStep(sceneId) {
    if (sceneId === "threshold") clearPreviousMorningDraft();
    const notebookScenes = {
      "arrival-add": ["מה אני", "מוסיפה?", "כתבי במחברת עד שקרן תפתח את השאלה הבאה."],
      "arrival-release": ["מה אני", "מורידה?", "כתבי במחברת עד שקרן תפתח את השאלה הבאה."],
      "arrival-preserve": ["מה עבד,", "ואני משמרת?", "כתבי במחברת עד שקרן תפתח את הפעימה הבאה."],
      "focus-intention": ["מה הכוונה שלי", "להיום?", "כתבי מילה אחת או משפט קצר שיזכירו לך לאן את רוצה לכוון היום את תשומת הלב."]
    };
    const active = ["focus", "focus-intention", "focus-collective"].includes(sceneId) ? "focus"
      : sceneId === "closing" ? "closing"
        : "waiting";
    if (active !== visibleStep) {
      visibleStep = active;
      status.textContent = "";
    }
    if (notebookScenes[sceneId]) {
      const [firstLine, emphasis, lead] = notebookScenes[sceneId];
      document.getElementById("participantNotebookTitle").innerHTML = `${firstLine}<br><em>${emphasis}</em>`;
      document.getElementById("participantNotebookLead").textContent = lead;
    }
    Object.entries(steps).forEach(([key, element]) => { element.hidden = key !== active; });
  }

  async function sendParticipantState(update) {
    personal = { ...personal, ...update };
    localStorage.setItem(`${PARTICIPANT_KEY}:state`, JSON.stringify(personal));
    const response = await fetch(apiUrl("/api/participant-state"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId, generation, ...update })
    });
    if (!response.ok) throw new Error("Live room is unavailable");
  }

  try {
    const stored = JSON.parse(localStorage.getItem(`${PARTICIPANT_KEY}:state`));
    if (stored && typeof stored === "object") personal = { ...personal, ...stored };
  } catch (_) {}

  const entryPhrase = document.getElementById("participantEntryPhrase");
  const exitPhrase = document.getElementById("participantExitPhrase");
  entryPhrase.value = personal.entryPhrase || "";
  exitPhrase.value = personal.exitPhrase || "";

  function saveLocalWord(word) {
    let words = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(WORDS_KEY));
      if (Array.isArray(parsed)) words = parsed;
    } catch (_) {}
    words.push({ word, createdAt: new Date().toISOString() });
    localStorage.setItem(WORDS_KEY, JSON.stringify(words.slice(-40)));
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("kerenMorningClubFocusWall");
      channel.postMessage({ type: "new-word" });
      channel.close();
    }
  }

  const wordForm = document.getElementById("participantWordForm");
  const wordInput = document.getElementById("participantWord");
  wordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const word = wordInput.value.trim().replace(/\s+/g, " ");
    if (!word) return;
    const button = wordForm.querySelector("button");
    button.disabled = true;
    status.textContent = "שולחת...";

    try {
      await sendParticipantState({ focusWord: word });
      status.textContent = `המילה „${word}” נכנסה לחדר, ותופיע עכשיו בתוך שדה הכוונות שכולן בונות יחד.`;
    } catch (_) {
      saveLocalWord(word);
      status.textContent = `המילה „${word}” נשמרה רק אצלך ולא עלתה לחדר. נסי שוב.`;
    }

    wordInput.value = "";
    button.disabled = false;
    wordInput.focus();
  });

  document.getElementById("participantExitForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const enteredWith = entryPhrase.value.trim().replace(/\s+/g, " ");
    const leavingWith = exitPhrase.value.trim().replace(/\s+/g, " ");
    if (!enteredWith || !leavingWith) return;
    try {
      await sendParticipantState({ entryPhrase: enteredWith, exitPhrase: leavingWith });
      const personalShift = document.getElementById("personalShift");
      personalShift.hidden = false;
      personalShift.textContent = `נכנסתי עם ${enteredWith}. אני יוצאת עם ${leavingWith}.`;
      status.textContent = "שני המשפטים שלך נכנסו בעילום שם אל גל התנועה של החדר.";
    } catch (_) {
      status.textContent = "המשפטים לא נשלחו. השאירי את הקישור פתוח ונסי שוב בעוד רגע.";
    }
  });

  async function refreshSession() {
    try {
      const response = await fetch(apiUrl("/api/session-state"), { cache: "no-store" });
      if (!response.ok) throw new Error("Room unavailable");
      const room = await response.json();
      document.getElementById("roomConnection").textContent = "מחוברת לחדר החי";
      if (room.generation && generation !== room.generation) {
        roomResetHandled = false; clearPreviousMorningDraft(); generation = room.generation;
        localStorage.setItem(`${PARTICIPANT_KEY}:generation`, generation);
      }
      showStep(room.sceneId);
    } catch (_) {
      document.getElementById("roomConnection").textContent = "מחכה לחיבור לחדר";
      showStep("waiting");
    }
  }
  refreshSession();
  window.setInterval(refreshSession, 1500);
})();
