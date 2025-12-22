// ================= IMPORTS =================
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const net = require('net');
const { createClient } = require('bedrock-protocol');

// ================= CONFIG =================
const TELEGRAM_TOKEN = '8569058694:AAGnF0HwzvkE10v40Fz8TpY0F9UInsHP8D0';
const RENDER_URL = 'https://metacoresrv.onrender.com';

const SERVER = {
  host: 'kupaleros-rg1D.aternos.me',
  port: 40915
};

// ================= INIT =================
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const app = express();
const db = new sqlite3.Database('./data.db');

// ================= MINECRAFT BOT =================
const mcBot = createClient({
  host: SERVER.host,
  port: SERVER.port,
  offline: true,
  username: 'TimeGuardBot'
});

// ================= DATABASE =================
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id TEXT PRIMARY KEY,
      gamertag TEXT,
      geyser_name TEXT,
      playtime INTEGER DEFAULT 0,
      last_seen INTEGER,
      last_reward INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reward_tokens (
      token TEXT PRIMARY KEY,
      telegram_id TEXT,
      created_at INTEGER
    )
  `);
});

// ================= HELPERS =================
function formatGeyserName(name) {
  return '.' + name.trim().replace(/ /g, '_');
}

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now();
}

// ================= MENU =================
const menuKeyboard = {
  reply_markup: {
    keyboard: [
      ['🟢 Whitelist Here'],
      ['⏱ Play Time Left', '➕ Add Time'],
      ['🌐 Check IP and PORT']
    ],
    resize_keyboard: true
  }
};

const waitingForGamertag = new Set();

// ================= TELEGRAM HANDLER =================
bot.on('message', msg => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === '/start') {
    return bot.sendMessage(
      chatId,
      '👋 Welcome!\nUse the menu below.',
      menuKeyboard
    );
  }

  // ===== WHITELIST =====
  if (text === '🟢 Whitelist Here') {
    waitingForGamertag.add(chatId);
    return bot.sendMessage(
      chatId,
      '✏️ Enter your **Minecraft Bedrock username**.\n⚠️ Case-sensitive!',
      { parse_mode: 'Markdown', reply_markup: menuKeyboard }
    );
  }

  if (waitingForGamertag.has(chatId)) {
    const bedrock = text.trim();
    const geyser = formatGeyserName(bedrock);

    db.run(
      `INSERT OR REPLACE INTO users
       (telegram_id, gamertag, geyser_name, last_seen)
       VALUES (?, ?, ?, ?)`,
      [chatId, bedrock, geyser, Date.now()]
    );

    waitingForGamertag.delete(chatId);

    mcBot.queue('command_request', {
      command: `/whitelist add ${geyser}`,
      origin: { type: 0, uuid: '', request_id: '' },
      internal: false,
      version: 66
    });

    return bot.sendMessage(
      chatId,
      `✅ Whitelisted!\n\n🎮 Bedrock: **${bedrock}**\n🧩 Server: \`${geyser}\``,
      { parse_mode: 'Markdown', reply_markup: menuKeyboard }
    );
  }

  // ===== PLAY TIME LEFT =====
  if (text === '⏱ Play Time Left') {
    db.get(
      `SELECT playtime FROM users WHERE telegram_id=?`,
      [chatId],
      (e, r) => {
        const mins = Math.floor((r?.playtime || 0) / 60);
        bot.sendMessage(chatId, `⏱ Time Left: **${mins} min**`, {
          parse_mode: 'Markdown',
          reply_markup: menuKeyboard
        });
      }
    );
  }

  // ===== ADD TIME (ANTI-ABUSE) =====
  if (text === '➕ Add Time') {
    db.get(
      `SELECT last_reward FROM users WHERE telegram_id=?`,
      [chatId],
      (e, r) => {
        const now = Date.now();
        if (r?.last_reward && now - r.last_reward < 180000) {
          return bot.sendMessage(chatId, '⏳ Please wait before next ad.');
        }

        const token = generateToken();
        db.run(
          `INSERT INTO reward_tokens VALUES (?, ?, ?)`,
          [token, chatId, now]
        );

        bot.sendMessage(
          chatId,
          '🎥 Watch ad to get **+3 minutes**',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '▶ Watch Ad', url: `${RENDER_URL}/reward?token=${token}` }]
              ]
            }
          }
        );
      }
    );
  }

  // ===== CHECK SERVER =====
  if (text === '🌐 Check IP and PORT') {
    checkServerStatus(SERVER.host, SERVER.port)
      .then(() => bot.sendMessage(
        chatId,
        `🌐 IP: \`${SERVER.host}\`\nPORT: \`${SERVER.port}\`\nStatus: ✅ Online`,
        { parse_mode: 'Markdown' }
      ))
      .catch(() => bot.sendMessage(chatId, '❌ Server Offline'));
  }
});

// ================= SERVER STATUS =================
function checkServerStatus(host, port) {
  return new Promise((resolve, reject) => {
    const s = new net.Socket();
    s.setTimeout(2000);
    s.on('connect', () => { s.destroy(); resolve(); });
    s.on('error', reject);
    s.on('timeout', reject);
    s.connect(port, host);
  });
}

// ================= REALTIME PLAYTIME =================
const onlinePlayers = new Map();

function startDeduction(name) {
  if (onlinePlayers.has(name)) return;

  const int = setInterval(() => {
    db.get(
      `SELECT playtime FROM users WHERE geyser_name=?`,
      [name],
      (e, r) => {
        if (!r || r.playtime <= 0) {
          mcBot.queue('command_request', {
            command: `/kick ${name} §cAdd Time First!`,
            origin: { type: 0, uuid: '', request_id: '' },
            internal: false,
            version: 66
          });
          stopDeduction(name);
          return;
        }

        db.run(
          `UPDATE users SET playtime = playtime - 1 WHERE geyser_name=?`,
          [name]
        );
      }
    );
  }, 1000);

  onlinePlayers.set(name, int);
}

function stopDeduction(name) {
  if (onlinePlayers.has(name)) {
    clearInterval(onlinePlayers.get(name));
    onlinePlayers.delete(name);
  }
}

// ================= JOIN / LEAVE =================
mcBot.on('text', p => {
  const msg = p.message.toLowerCase();
  const name = p.message.split(' ')[0];

  if (msg.includes('joined')) {
    db.get(
      `SELECT playtime FROM users WHERE geyser_name=?`,
      [name],
      (e, r) => {
        if (!r || r.playtime <= 0) {
          mcBot.queue('command_request', {
            command: `/kick ${name} §cAdd Time First!`,
            origin: { type: 0, uuid: '', request_id: '' },
            internal: false,
            version: 66
          });
        } else {
          startDeduction(name);
        }
      }
    );
  }

  if (msg.includes('left')) {
    stopDeduction(name);
  }
});

// ================= REWARD WEB =================
app.get('/reward', (req, res) => {
  const token = req.query.token;
  if (!token) return res.send('Invalid');

  res.send(`
<!DOCTYPE html>
<html>
<head>
<script src="//libtl.com/sdk.js" data-zone="10359465" data-sdk="show_10359465"></script>
</head>
<body style="text-align:center;font-family:sans-serif">
<h2>Watch Ad</h2>
<button onclick="show_10359465().then(()=>fetch('/reward-success?token=${token}'))">
Watch
</button>
</body>
</html>
`);
});

app.get('/reward-success', (req, res) => {
  const token = req.query.token;

  db.get(
    `SELECT telegram_id FROM reward_tokens WHERE token=?`,
    [token],
    (e, r) => {
      if (!r) return res.send('Used');

      db.serialize(() => {
        db.run(`DELETE FROM reward_tokens WHERE token=?`, [token]);
        db.run(
          `UPDATE users SET playtime = playtime + 180, last_reward=? WHERE telegram_id=?`,
          [Date.now(), r.telegram_id]
        );
      });

      bot.sendMessage(r.telegram_id, '✅ +3 minutes added!');
      res.send('OK');
    }
  );
});

// ================= START WEB =================
app.listen(process.env.PORT || 3000, () =>
  console.log('🌐 Web running')
);
