(() => {
  "use strict";

  const items = Array.isArray(window.KEREN_SUPPLEMENTS) ? window.KEREN_SUPPLEMENTS : [];
  const grid = document.getElementById("libraryGrid");
  const search = document.getElementById("supplementSearch");
  const count = document.getElementById("libraryResultCount");
  const returnLink = document.getElementById("returnToDashboard");
  const themes = [...new Set(items.map((item) => item.category))];
  const families = [
    ["אהבה ורכות", ["אהבה", "רכות", "חמלה", "לב", "עדינות"]],
    ["קול וגבולות", ["קול", "ביטוי", "גבול", "אמת", "נאמנות", "אישור"]],
    ["אמון ושקט", ["אמון", "שקט", "סבלנות", "התמסרות", "ודאות"]],
    ["יצירה ותנועה", ["אומץ", "יצירה", "תנועה", "התחלה", "פעולה", "לידה"]],
    ["גוף ונשימה", ["גוף", "נשימה", "מנוחה", "ביטחון", "בריאות"]],
    ["שחרור", ["שחרור", "להרפות", "פחות", "לשחרר", "פירוק"]],
    ["כוונה ובהירות", ["כוונה", "בהירות", "מיקוד", "דיוק", "כיוון"]],
    ["רגש והסכמה", ["רגש", "פחד", "כאב", "כעס", "הסכמה"]],
    ["זהות ונוכחות", ["נוכחות", "זהות", "עצמי", "להיות", "ערך"]],
    ["קשר ושייכות", ["קשר", "שייכות", "יחד", "קהילה", "משפחה"]]
  ];

  function normalize(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0591-\u05c7]/g, "").replace(/[^\u05d0-\u05ea\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  function score(item, query) {
    const normalized = normalize(query);
    if (!normalized) return 1;
    const haystack = normalize(`${item.category} ${item.text}`);
    const tokens = normalized.split(" ").filter((token) => token.length > 1);
    let total = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 8 : 0), 0);
    families.forEach(([category, words]) => {
      if (words.some((word) => normalized.includes(normalize(word))) && item.category === category) total += 12;
    });
    return total;
  }

  function render() {
    const query = search.value.trim();
    const ranked = items
      .map((item) => ({ item, score: score(item, query) }))
      .filter((entry) => !query || entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.id - b.item.id);
    const visible = (ranked.length ? ranked : items.map((item) => ({ item, score: 0 }))).slice(0, 60);
    grid.replaceChildren();
    visible.forEach(({ item }) => {
      const card = document.createElement("article");
      card.className = "library-card";
      const number = document.createElement("span");
      number.textContent = String(item.id);
      const copy = document.createElement("div");
      const category = document.createElement("small");
      category.textContent = item.category;
      const text = document.createElement("strong");
      text.textContent = item.text;
      copy.append(category, text);
      card.append(number, copy);
      grid.appendChild(card);
    });
    count.textContent = String(visible.length);
  }

  search.addEventListener("input", render);
  document.getElementById("randomSupplement").addEventListener("click", () => {
    const theme = themes[Math.floor(Math.random() * themes.length)] || "";
    search.value = theme;
    render();
    search.focus();
  });
  if (document.referrer && new URL(document.referrer).origin === window.location.origin) returnLink.href = document.referrer;
  render();
})();
