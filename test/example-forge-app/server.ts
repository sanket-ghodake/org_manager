import express from 'express';
import { Pool } from 'pg';
import path from 'path';

const PORT = process.env.PORT || 8090;
const PORTAL_INTERNAL_URL = process.env.PORTAL_INTERNAL_URL || 'http://app:3001';
const CLIENT_ID = process.env.CLIENT_ID || 'client_example_forge_app';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'secret_example_forge_app';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://app_user:app_password@example-forge-app-db:5432/example_forge_db';

// Setup database connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Setup Express application
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple in-memory session store (Access Token -> User Info)
const activeTokens = new Map<string, { id: string; name: string; email: string; role: string }>();

// Initialize DB schema
async function initDb() {
  let retries = 5;
  while (retries > 0) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS forge_items (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          label VARCHAR(255) NOT NULL,
          description TEXT,
          amount VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Database schema initialized successfully!');
      break;
    } catch (err: any) {
      console.error(`Database initialization failed, retrying... (${retries} left)`, err.message);
      retries--;
      await new Promise(res => setTimeout(res, 3000));
    }
  }
}
initDb();

// 1. Handshake token exchange via secure backchannel
app.post('/api/auth', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Auth code is required' });
  }

  try {
    console.log(`Exchanging auth code: ${code} with Portal backend at ${PORTAL_INTERNAL_URL}...`);
    const exchangeRes = await fetch(`${PORTAL_INTERNAL_URL}/api/v1/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code.toString(),
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      })
    });

    if (!exchangeRes.ok) {
      const errText = await exchangeRes.text();
      throw new Error(`Token exchange failed (${exchangeRes.status}): ${errText}`);
    }

    const tokenData = (await exchangeRes.json()) as any;
    const { access_token, user } = tokenData;

    // Cache the active session locally mapping the access_token
    activeTokens.set(access_token, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });

    console.log(`Successfully verified token! Cached session for: ${user.email}`);
    return res.json({ success: true, token: access_token, user });
  } catch (err: any) {
    console.error('Portal authorization failed:', err.message);
    return res.status(401).json({ error: `Authorization failed: ${err.message}` });
  }
});

// 2. Token Authentication Middleware (Uses Authorization Bearer header)
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token header' });
  }
  const token = authHeader.split(' ')[1];
  const session = activeTokens.get(token);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }
  (req as any).user = session;
  next();
};

// 3. Authenticated APIs
app.get('/api/user', authenticateToken, (req, res) => {
  res.json({ user: (req as any).user });
});

// Retrieve ledger records for authorized user
app.get('/api/records', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  try {
    const result = await pool.query(
      'SELECT id, label, description, amount, created_at FROM forge_items WHERE user_id = $1 ORDER BY created_at DESC',
      [user.id]
    );
    res.json({ records: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new ledger record
app.post('/api/records', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { label, description, amount } = req.body;
  if (!label) {
    return res.status(400).json({ error: 'Label is required' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO forge_items (user_id, label, description, amount) VALUES ($1, $2, $3, $4) RETURNING *',
      [user.id, label, description || '', amount || '']
    );
    res.json({ success: true, record: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a ledger record
app.delete('/api/records/:id', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM forge_items WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Record not found or access denied' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Serve Static UI Assets & SPA Entry
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Example Forge App running on port ${PORT}`);
});
