const ALLOWED_SCENES = new Set([
  "threshold", "opening-song", "arrival", "arrival-sleep", "arrival-energy",
  "arrival-add", "arrival-release", "arrival-preserve", "drain", "focus", "focus-intention", "focus-collective",
  "supplements", "supplements-example", "supplements-flow",
  "gratitude", "gratitude-technique", "gratitude-practice", "protection", "shower", "planning", "closing", "closing-song", "selfie", "whatsapp-share"
]);

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

const cleanRoom = (value) => {
  const room = String(value || "").trim();
  return /^[a-z0-9-]{8,80}$/i.test(room) ? room : "";
};

const cleanWord = (value) => String(value || "").replace(/\s+/g, " ").trim();

const cleanDeckId = (value) => {
  const deckId = String(value || "").trim();
  return /^[a-z0-9-]{6,100}$/i.test(deckId) ? deckId : "";
};

const cleanSongIds = (value) => Array.isArray(value)
  ? [...new Set(value.map((id) => String(id || "").trim()).filter((id) => /^[a-z0-9-]{2,100}$/i.test(id)))].slice(0, 100)
  : [];

function shuffle(values, excludedFirst = "") {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const swapIndex = random[0] % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  if (shuffled.length > 1 && shuffled[0] === excludedFirst) [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  return shuffled;
}

async function readJson(request) {
  const size = Number(request.headers.get("content-length") || 0);
  if (size > 4096) throw new Error("payload_too_large");
  return request.json();
}

function hasFacilitatorAccess(request, env) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return Boolean(env.FACILITATOR_TOKEN && token === env.FACILITATOR_TOKEN);
}

async function cleanupOldData(env) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM focus_words WHERE julianday(created_at) < julianday('now', '-1 day')"),
    env.DB.prepare("DELETE FROM movement_shares WHERE julianday(updated_at) < julianday('now', '-1 day')"),
    env.DB.prepare("DELETE FROM participants WHERE julianday(updated_at) < julianday('now', '-1 day')"),
    env.DB.prepare("DELETE FROM rooms WHERE julianday(updated_at) < julianday('now', '-1 day')")
  ]);
}

let lastCleanup = 0;
async function api(request, env, ctx, url) {
  if (Date.now() - lastCleanup > 60000) { await cleanupOldData(env); lastCleanup = Date.now(); }
  const room = cleanRoom(url.searchParams.get("room"));
  if (!room) return json({ error: "invalid_room" }, 422);
  // Every live morning is explicitly reset by the facilitator. Running a second
  // write batch in waitUntil alongside a room mutation can race D1 and make the
  // public reset fail. Keep live writes single-owner and deterministic.

  if (url.pathname === "/api/session-state") {
    if (request.method === "GET") {
      const row = await env.DB.prepare("SELECT scene_id, updated_at FROM rooms WHERE room = ?").bind(room).first();
      const generation = await env.DB.prepare('SELECT generation FROM room_generations WHERE room = ?').bind(room).first();
      return json({ sceneId: row?.scene_id || "threshold", updatedAt: row?.updated_at || null, generation: generation?.generation || 'initial' });
    }
    if (request.method === "POST") {
      if (!hasFacilitatorAccess(request, env)) return json({ error: "facilitator_access_required" }, 401);
      let payload;
      try { payload = await readJson(request); } catch { return json({ error: "invalid_request" }, 400); }
      const sceneId = String(payload.sceneId || "");
      if (!ALLOWED_SCENES.has(sceneId)) return json({ error: "invalid_scene" }, 422);
      const now = new Date().toISOString();
      await env.DB.prepare(
        "INSERT INTO rooms (room, scene_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(room) DO UPDATE SET scene_id = excluded.scene_id, updated_at = excluded.updated_at"
      ).bind(room, sceneId, now).run();
      return json({ sceneId, updatedAt: now });
    }
    if (request.method === "DELETE") {
      if (!hasFacilitatorAccess(request, env)) return json({ error: "facilitator_access_required" }, 401);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM focus_words WHERE room = ?").bind(room),
        env.DB.prepare("DELETE FROM movement_shares WHERE room = ?").bind(room),
        env.DB.prepare("DELETE FROM participants WHERE room = ?").bind(room),
        env.DB.prepare("DELETE FROM rooms WHERE room = ?").bind(room),
        env.DB.prepare("INSERT INTO room_generations(room,generation) VALUES (?,?) ON CONFLICT(room) DO UPDATE SET generation=excluded.generation").bind(room, crypto.randomUUID())
      ]);
      return json({ reset: true, sceneId: "threshold" });
    }
  }

  if (url.pathname === "/api/song-deck" && request.method === "POST") {
    if (!hasFacilitatorAccess(request, env)) return json({ error: "facilitator_access_required" }, 401);
    let payload;
    try { payload = await readJson(request); } catch { return json({ error: "invalid_request" }, 400); }
    const deckId = cleanDeckId(payload.deckId);
    const songIds = cleanSongIds(payload.songIds);
    const seedUsedIds = cleanSongIds(payload.seedUsedIds).filter((id) => songIds.includes(id));
    if (!deckId || !songIds.length) return json({ error: "invalid_song_deck" }, 422);

    const row = await env.DB.prepare("SELECT state_json FROM song_decks WHERE room = ? AND deck_id = ?").bind(room, deckId).first();
    let state;
    try { state = row?.state_json ? JSON.parse(row.state_json) : null; } catch { state = null; }
    if (!state || !Array.isArray(state.used) || !Array.isArray(state.remaining)) {
      state = { cycle: 1, used: seedUsedIds, remaining: [], lastDrawnId: "" };
    }
    const validIds = new Set(songIds);
    state.used = [...new Set(state.used)].filter((id) => validIds.has(id));
    state.remaining = [...new Set(state.remaining)].filter((id) => validIds.has(id) && !state.used.includes(id));
    const knownIds = new Set([...state.used, ...state.remaining]);
    const addedIds = songIds.filter((id) => !knownIds.has(id));
    if (addedIds.length) state.remaining.push(...shuffle(addedIds));
    if (!state.remaining.length) {
      state.cycle = (Number(state.cycle) || 1) + 1;
      state.used = [];
      state.remaining = shuffle(songIds, state.lastDrawnId);
    }
    const selectedId = state.remaining.shift();
    state.used.push(selectedId);
    state.lastDrawnId = selectedId;
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO song_decks (room, deck_id, state_json, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(room, deck_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`
    ).bind(room, deckId, JSON.stringify(state), now).run();
    return json({
      selectedId,
      cycle: state.cycle,
      usedIds: state.used,
      remainingIds: state.remaining,
      remainingCount: state.remaining.length,
      updatedAt: now
    });
  }

  if (url.pathname === "/api/participant-state" && request.method === "POST") {
    let payload;
    try { payload = await readJson(request); } catch { return json({ error: "invalid_request" }, 400); }
    const generation = String(payload.generation || '');
    const currentGeneration = await env.DB.prepare('SELECT generation FROM room_generations WHERE room = ?').bind(room).first();
    if (generation !== (currentGeneration?.generation || 'initial')) return json({error:'stale_morning'},409);
    const participantId = String(payload.participantId || "").trim();
    if (!/^[a-z0-9-]{8,80}$/i.test(participantId)) return json({ error: "invalid_participant" }, 422);
    const values = {};
    for (const [input, column] of [["sleep", "sleep"], ["entryEnergy", "entry_energy"], ["exitEnergy", "exit_energy"]]) {
      if (payload[input] == null) continue;
      const value = Number(payload[input]);
      if (!Number.isFinite(value) || value < 0 || value > 10) return json({ error: `invalid_${input}` }, 422);
      values[column] = value;
    }
    if (payload.focusWord != null) {
      const word = cleanWord(payload.focusWord);
      if (!word || word.length > 72) return json({ error: "invalid_focus_word" }, 422);
      values.focus_word = word;
    }
    const movementValues = {};
    for (const [input, column] of [["entryPhrase", "entry_phrase"], ["exitPhrase", "exit_phrase"]]) {
      if (payload[input] == null) continue;
      const phrase = cleanWord(payload[input]);
      if (!phrase || phrase.length > 72) return json({ error: `invalid_${input}` }, 422);
      movementValues[column] = phrase;
    }
    const now = new Date().toISOString();
    const prior = await env.DB.prepare("SELECT focus_word FROM participants WHERE room = ? AND participant_id = ?").bind(room, participantId).first();
    const current = await env.DB.prepare("SELECT * FROM participants WHERE room = ? AND participant_id = ?").bind(room, participantId).first() || {};
    const merged = { ...current, ...values, room, participant_id: participantId, updated_at: now };
    const guard = "COALESCE((SELECT generation FROM room_generations WHERE room = ?), 'initial') = ?";
    const writes = [env.DB.prepare(
      `INSERT INTO participants (room, participant_id, sleep, entry_energy, exit_energy, focus_word, updated_at)
       SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${guard}
       ON CONFLICT(room, participant_id) DO UPDATE SET
       sleep = excluded.sleep, entry_energy = excluded.entry_energy, exit_energy = excluded.exit_energy,
       focus_word = excluded.focus_word, updated_at = excluded.updated_at`
    ).bind(room, participantId, merged.sleep ?? null, merged.entry_energy ?? null, merged.exit_energy ?? null, merged.focus_word ?? null, now, room, generation)];
    if (values.focus_word && values.focus_word !== prior?.focus_word) {
      writes.push(env.DB.prepare(`INSERT INTO focus_words (id, room, word, created_at) SELECT ?, ?, ?, ? WHERE ${guard}`)
        .bind(crypto.randomUUID(), room, values.focus_word, now, room, generation));
    }
    if (Object.keys(movementValues).length) {
      const priorMovement = await env.DB.prepare("SELECT entry_phrase, exit_phrase FROM movement_shares WHERE room = ? AND participant_id = ?")
        .bind(room, participantId).first() || {};
      const movement = { ...priorMovement, ...movementValues };
      writes.push(env.DB.prepare(
        `INSERT INTO movement_shares (room, participant_id, entry_phrase, exit_phrase, updated_at)
         SELECT ?, ?, ?, ?, ? WHERE ${guard}
         ON CONFLICT(room, participant_id) DO UPDATE SET
         entry_phrase = excluded.entry_phrase, exit_phrase = excluded.exit_phrase, updated_at = excluded.updated_at`
      ).bind(room, participantId, movement.entry_phrase || null, movement.exit_phrase || null, now, room, generation));
    }
    const result = await env.DB.batch(writes);
    if (!result[0].meta.changes) return json({error:'stale_morning'},409);
    return json({ participant: {
      sleep: merged.sleep ?? null,
      entryEnergy: merged.entry_energy ?? null,
      exitEnergy: merged.exit_energy ?? null,
      focusWord: merged.focus_word ?? "",
      entryPhrase: movementValues.entry_phrase ?? null,
      exitPhrase: movementValues.exit_phrase ?? null,
      updatedAt: now
    }});
  }

  if (url.pathname === "/api/focus-words" && request.method === "GET") {
    const result = await env.DB.prepare("SELECT id, word, created_at AS createdAt FROM focus_words WHERE room = ? ORDER BY created_at DESC LIMIT 100").bind(room).all();
    return json({ words: [...(result.results || [])].reverse(), ephemeral: true });
  }

  if (url.pathname === "/api/group-summary" && request.method === "GET") {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS participantCount,
       COUNT(sleep) AS sleepCount, AVG(sleep) AS sleepAverage,
       COUNT(entry_energy) AS entryCount, AVG(entry_energy) AS entryAverage,
       COUNT(exit_energy) AS exitCount, AVG(exit_energy) AS exitAverage,
       SUM(CASE WHEN entry_energy IS NOT NULL AND exit_energy IS NOT NULL THEN 1 ELSE 0 END) AS pairedCount,
       AVG(CASE WHEN entry_energy IS NOT NULL AND exit_energy IS NOT NULL THEN entry_energy END) AS pairedEntryAverage,
       AVG(CASE WHEN entry_energy IS NOT NULL AND exit_energy IS NOT NULL THEN exit_energy END) AS pairedExitAverage
       FROM participants WHERE room = ?`
    ).bind(room).first();
    const movementRows = await env.DB.prepare(
      "SELECT entry_phrase AS entryPhrase, exit_phrase AS exitPhrase FROM movement_shares WHERE room = ? AND entry_phrase IS NOT NULL AND exit_phrase IS NOT NULL ORDER BY updated_at ASC"
    ).bind(room).all();
    const rounded = Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key, value == null ? null : (key.includes("Average") ? Math.round(Number(value) * 100) / 100 : Number(value))]));
    return json({ ...rounded, movements: movementRows.results || [] });
  }

  return json({ error: "not_found" }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return api(request, env, ctx, url);
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};
