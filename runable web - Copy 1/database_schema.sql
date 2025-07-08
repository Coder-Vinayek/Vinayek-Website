-- SQLite Database Schema for Tournament Registration and Wallet System

-- Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    entry_fee REAL DEFAULT 0.00,
    max_participants INTEGER,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    registration_deadline TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK(status IN ('draft', 'open', 'closed', 'ongoing', 'completed')),
    prize_pool REAL DEFAULT 0.00,
    game_type TEXT,
    rules TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- User wallets table
CREATE TABLE IF NOT EXISTS user_wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    balance REAL DEFAULT 0.00,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Wallet transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('deposit', 'withdrawal', 'tournament_fee', 'prize_win', 'refund')),
    amount REAL NOT NULL,
    description TEXT,
    reference_id TEXT,
    status TEXT DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'failed')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tournament registrations table
CREATE TABLE IF NOT EXISTS tournament_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    registration_date TEXT DEFAULT CURRENT_TIMESTAMP,
    payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'refunded', 'free')),
    transaction_id INTEGER,
    status TEXT DEFAULT 'registered' CHECK(status IN ('registered', 'cancelled', 'disqualified')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    UNIQUE(tournament_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_start_date ON tournaments(start_date);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_tournament ON tournament_registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_user ON tournament_registrations(user_id);

-- Insert sample tournament data
INSERT OR IGNORE INTO tournaments (id, name, description, entry_fee, max_participants, start_date, end_date, registration_deadline, status, prize_pool, game_type, rules) VALUES
(1, 'CS:GO Championship', 'Weekly competitive tournament', 10.00, 32, '2024-12-20 18:00:00', '2024-12-20 22:00:00', '2024-12-20 17:00:00', 'open', 200.00, 'CS:GO', 'Standard competitive rules apply'),
(2, 'Fortnite Battle Royale', 'Solo competition', 5.00, 100, '2024-12-21 19:00:00', '2024-12-21 21:00:00', '2024-12-21 18:30:00', 'open', 150.00, 'Fortnite', 'Solo mode only'),
(3, 'FIFA Tournament', 'Football simulation tournament', 15.00, 16, '2024-12-22 15:00:00', '2024-12-22 19:00:00', '2024-12-22 14:00:00', 'open', 300.00, 'FIFA', '90 minute matches');

-- Insert sample wallet data (you'll connect this to your existing users)
INSERT OR IGNORE INTO user_wallets (user_id, balance) VALUES
(1, 50.00),
(2, 25.00),
(3, 100.00);