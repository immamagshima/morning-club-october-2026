/* Facilitator only. No participant route, storage, network request, or scene timing is changed. */
(() => {
  "use strict";
  if (!document.body.classList.contains("minute-before") || !document.getElementById("experience")) return;
  const data = window.KAMA_FACILITATOR_HELP;
  if (!data || document.getElementById("facilitatorHelpDialog")) return;
  const dialog = document.createElement("dialog");
  dialog.id = "facilitatorHelpDialog";
  dialog.className = "facilitator-help-dialog";
  dialog.setAttribute("aria-labelledby", "facilitatorHelpTitle");
  dialog.innerHTML = '<div class="facilitator-help-shell"><div class="facilitator-help-head"><h2 id="facilitatorHelpTitle"></h2><button class="secondary-button facilitator-help-close" type="button" autofocus>סגירה וחזרה</button></div><div class="facilitator-help-scroll"><p class="facilitator-help-note"></p><div class="facilitator-help-tabs" aria-label="קטגוריות להרחבה"></div><div class="facilitator-help-content"></div></div></div>';
  document.body.append(dialog);
  const title = dialog.querySelector("h2"), note = dialog.querySelector(".facilitator-help-note");
  const tabs = dialog.querySelector(".facilitator-help-tabs"), content = dialog.querySelector(".facilitator-help-content");
  let opener = null, exampleIndex = 0;
  const ritualIndexes = {};
  function node(tag, text, className) { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; }
  function paragraph(text) { content.append(node("p", text)); }
  function close() { if (dialog.open) dialog.close(); }
  dialog.querySelector(".facilitator-help-close").addEventListener("click", close);
  dialog.addEventListener("close", () => { if (opener) opener.setAttribute("aria-expanded", "false"); content.replaceChildren(); tabs.replaceChildren(); });
  dialog.addEventListener("click", event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } });
  document.addEventListener("keydown", event => {
    if (!dialog.open) return;
    if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.stopPropagation();
  }, true);
  new MutationObserver(close).observe(document.body, { attributes: true, attributeFilter: ["data-scene"] });
  function choose(label, render) {
    const button = node("button", label, "secondary-button");
    button.type = "button"; button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      tabs.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
      content.replaceChildren(); render(); dialog.querySelector(".facilitator-help-scroll").scrollTop = 0;
    });
    tabs.append(button); return button;
  }
  function open(button, heading, hint, build) {
    close(); opener = button; title.textContent = heading; note.textContent = hint;
    tabs.replaceChildren(); content.replaceChildren(); build();
    dialog.showModal(); button.setAttribute("aria-expanded", "true");
  }
  function action(sceneId, label, handler) {
    const scene = document.querySelector('[data-scene-id="' + sceneId + '"] .scene-inner');
    if (!scene) return;
    let group = scene.querySelector(".facilitator-help-actions");
    if (!group) { group = node("div", "", "facilitator-help-actions"); scene.querySelector(".lead").insertAdjacentElement("afterend", group); }
    const button = node("button", label, "secondary-button");
    button.type = "button"; button.setAttribute("aria-haspopup", "dialog"); button.setAttribute("aria-expanded", "false"); button.setAttribute("aria-controls", dialog.id);
    button.addEventListener("click", () => handler(button)); group.append(button);
  }
  Object.entries(data.vocabulary).forEach(([sceneId, groups]) => action(sceneId, "מילים לשינה ולקימה", button => open(button, sceneId === "arrival-sleep" ? "מילים לתיאור השינה" : "מילים לתיאור הקימה", "בחרי מילה או צירוף שמתארים אותך. אפשר להרגיש כמה דברים יחד ולכתוב גם במילים שלך.", () => {
    groups.forEach(([heading, ...words]) => choose(heading, () => { content.append(node("h3", heading)); const list = node("ul", "", "facilitator-word-list"); words.forEach(word => list.append(node("li", word))); content.append(list); }));
    choose("דוגמאות לניסוח", () => { (sceneId === "arrival-sleep" ? ["ישנתי מעט אבל ברצף.", "ישנתי הרבה, והשינה הרגישה קלה."] : ["קמתי כבדה בגוף וסקרנית לקראת היום.", "אני עוד מתעוררת, ובפנים יש שקט."]).forEach(paragraph); });
    tabs.firstElementChild.click();
  })));
  Object.entries(data.ritual).forEach(([sceneId, ideas]) => action(sceneId, "דוגמאות והשראה", button => open(button, { "arrival-add": "מה אפשר להוסיף?", "arrival-release": "מה אפשר להוריד?", "arrival-preserve": "מה כדאי לשמר?" }[sceneId], "אפשרויות להשראה, בלי חובה ובלי רשימת מטלות חדשה. בחרי מה שמתאים לחיים שלך, ואפשר גם להמציא משהו אחר.", () => {
    const renderIdeas = () => {
      const i = ritualIndexes[sceneId] || 0;
      [["בערב", ideas.evening[i % ideas.evening.length]], ["בבוקר", ideas.morning[i % ideas.morning.length]], ["עוד אפשרות לבוקר", ideas.morning[(i + 2) % ideas.morning.length]]].forEach(([label, text]) => { const p = node("p"); p.append(node("strong", label, "facilitator-example-label"), document.createTextNode(text)); content.append(p); });
      const more = node("button", "עוד רעיונות לערב ולבוקר", "secondary-button"); more.type = "button";
      more.onclick = () => { ritualIndexes[sceneId] = i + 1; content.replaceChildren(); renderIdeas(); };
      content.append(more);
    };
    choose("שלוש אפשרויות להתחלה", renderIdeas);
    choose("כל הרעיונות לערב", () => { ideas.evening.forEach(paragraph); });
    choose("כל הרעיונות לבוקר", () => { ideas.morning.forEach(paragraph); });
    tabs.firstElementChild.click();
  })));
  function renderExample() {
    const e = data.examples[exampleIndex];
    content.append(node("h3", "הכוונה שלי: " + e.intention));
    [["חיבור ללמה שלי", e.why], ["דרך לפעול", e.way], ["רשות ואמון", e.permission]].forEach(([label, text]) => { const p = node("p"); p.append(node("strong", label, "facilitator-example-label"), document.createTextNode(text)); content.append(p); });
    const next = node("button", "להחליף דוגמה", "secondary-button"); next.type = "button"; next.onclick = () => { exampleIndex = (exampleIndex + 1) % data.examples.length; content.replaceChildren(); renderExample(); }; content.append(next);
  }
  function model(button) { open(button, "מה יחזק היום את הכוונה שלי?", "הכוונה שלי ← מה נחוץ לי? ← משפט שמחזק אותי.", () => {
    data.model.forEach(part => choose(part.title, () => { content.append(node("h3", part.title)); part.paragraphs.forEach(paragraph); }));
    choose("דוגמאות מתחלפות", renderExample);
    tabs.firstElementChild.click();
  }); }
  action("supplements-example", "המודל לבחירה ולכתיבה", model);
  action("supplements-example", "דוגמאות מתחלפות", button => open(button, "כוונה אחת, כמה דרכים לחזק אותה", "בחרי משפט שנותן לך את התמיכה שנחוצה לך היום.", () => {
    choose("דוגמאות מהחיים", renderExample);
    choose("הדוגמה המוכרת: הקול שלי", () => { content.append(node("h3", "הכוונה שלי: להשמיע את הקול שלי")); ["אני מביאה את הקול שלי לעולם.", "אני נותנת כבוד לקול הפנימי שלי גם כשהוא שקט.", "אני מפנה מקום לאמת שלי בכל חדר שאליו אני נכנסת."].forEach(paragraph); });
    tabs.firstElementChild.click();
  }));
  action("supplements-flow", "תזכורת לבחירה ולכתיבה", model);
  action("supplements-flow", "נושאים לזרם המדויק", button => open(button, "איזה נושא יחזק את הכוונה?", "בחירת נושא מעדכנת את הזרם הקיים. המשתתפות ממשיכות לכתוב במחברת.", () => {
    (window.KAMA_INSPIRATION_THEMES || []).forEach(theme => choose(theme.title, () => {
      content.append(node("h3", theme.title)); paragraph(theme.description);
      const apply = node("button", "לפתוח זרם בנושא הזה", "primary-button"); apply.type = "button";
      apply.onclick = () => { document.getElementById("supplementIntentInput").value = theme.title; document.getElementById("supplementIntentForm").requestSubmit(); close(); }; content.append(apply);
    }));
    if (tabs.firstElementChild) tabs.firstElementChild.click();
  }));
})();

