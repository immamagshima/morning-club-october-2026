CREATE TABLE IF NOT EXISTS rooms (
  room TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL DEFAULT 'threshold',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
  room TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  sleep REAL,
  entry_energy REAL,
  exit_energy REAL,
  focus_word TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (room, participant_id)
);

CREATE TABLE IF NOT EXISTS focus_words (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  word TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS movement_shares (
  room TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  entry_phrase TEXT,
  exit_phrase TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (room, participant_id)
);

CREATE TABLE IF NOT EXISTS song_decks (
  room TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (room, deck_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_room ON participants(room);
CREATE INDEX IF NOT EXISTS idx_focus_words_room_created ON focus_words(room, created_at);
CREATE INDEX IF NOT EXISTS idx_movement_shares_room_updated ON movement_shares(room, updated_at);
CREATE INDEX IF NOT EXISTS idx_song_decks_room ON song_decks(room);

CREATE TABLE IF NOT EXISTS room_generations (room TEXT PRIMARY KEY, generation TEXT NOT NULL);
