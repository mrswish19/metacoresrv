/* ======================
   IMPORTS
====================== */
const { createClient } = require('bedrock-protocol');
const http = require('http');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');

/* ======================
   CONFIG
====================== */
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8569058694:AAGnF0HwzvkE10v40Fz8TpY0F9UInsHP8D0';
const RENDER_URL = process.env.RENDER_URL || 'https://metacoresrv.onrender.com';

const SERVER = {
  host: 'metacoresrv.aternos.me',
  port: 36614,
  username: 'Noxell',
  version: '1.21.120',
  offline: true
};

/* ======================
   EXPRESS & DB
====================== */
const app = express();
app.use(express.json());
const db = new sqlite3.Database('./data.db');

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

/* ======================
   TELEGRAM BOT
====================== */
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

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

bot.on('message', msg => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === '/start') {
    return bot.sendMessage(chatId, '👋 Welcome! Use the menu below.', menuKeyboard);
  }

  if (text === '🟢 Whitelist Here') {
    waitingForGamertag.add(chatId);
    return bot.sendMessage(chatId, '✏️ Enter your **Minecraft Bedrock username**.\n⚠️ Case-sensitive!', { parse_mode: 'Markdown', reply_markup: menuKeyboard });
  }

  if (waitingForGamertag.has(chatId)) {
    const bedrock = text.trim();
    const geyser = '.' + bedrock.replace(/ /g, '_');

    // Insert into DB
    db.run(`INSERT OR REPLACE INTO users (telegram_id, gamertag, geyser_name, last_seen) VALUES (?, ?, ?, ?)`,
           [chatId, bedrock, geyser, Date.now()]);
    waitingForGamertag.delete(chatId);

    // ✅ Send whitelist command to Minecraft bot and show in chat
    if (mcBot) {
      const cmd = `/whitelist add ${geyser}`;
      mcBot.queue('command_request', { command: cmd, type: 1, version: 1 }); // runs command
      mcBot.queue('text', { message: cmd }); // appears in server chat
    }

    bot.sendMessage(chatId, `✅ Whitelisted!\n🎮 Bedrock: **${bedrock}**\n🧩 Server name: \`${geyser}\`\n✅ Added to server whitelist!`,
                    { parse_mode: 'Markdown', reply_markup: menuKeyboard });
  }

  if (text === '⏱ Play Time Left') {
    db.get(`SELECT playtime FROM users WHERE telegram_id=?`, [chatId], (e, r) => {
      const mins = Math.floor((r?.playtime || 0) / 60);
      bot.sendMessage(chatId, `⏱ Time Left: **${mins} min**`, { parse_mode: 'Markdown', reply_markup: menuKeyboard });
    });
  }

  if (text === '➕ Add Time') {
    const now = Date.now();
    db.get(`SELECT last_reward FROM users WHERE telegram_id=?`, [chatId], (e, r) => {
      if (r?.last_reward && now - r.last_reward < 180000) return bot.sendMessage(chatId, '⏳ Please wait before next ad.');

      const token = Math.random().toString(36).substring(2) + now;
      db.run(`INSERT INTO reward_tokens VALUES (?, ?, ?)`, [token, chatId, now]);
      db.run(`UPDATE users SET last_reward=? WHERE telegram_id=?`, [now, chatId]);

      bot.sendMessage(chatId, '🎥 Watch ad to get **+3 minutes**', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '▶ Watch Ad', url: `${RENDER_URL}/reward?token=${token}` }]] }
      });
    });
  }

  if (text === '🌐 Check IP and PORT') {
    bot.sendMessage(chatId, `🌐 IP: ${SERVER.host}\nPORT: ${SERVER.port}\nStatus: ✅ Online`, { parse_mode: 'Markdown' });
  }
});

/* ======================
   REWARD PAGES
====================== */
app.get('/reward', (req, res) => {
  const token = req.query.token;
  if (!token) return res.send('Invalid');

  res.send(`
<html>
<head>
<script src="//libtl.com/sdk.js" data-zone="10359465" data-sdk="show_10359465"></script>
</head>
<body style="text-align:center;font-family:sans-serif">
<h2>Watch Ad</h2>
<button onclick="show_10359465().then(()=>fetch('/reward-success?token=${token}'))">Watch</button>
</body>
</html>
`);
});

app.get('/reward-success', (req, res) => {
  const token = req.query.token;
  db.get(`SELECT telegram_id FROM reward_tokens WHERE token=?`, [token], (e, r) => {
    if (!r) return res.send('Used');

    db.serialize(() => {
      db.run(`DELETE FROM reward_tokens WHERE token=?`, [token]);
      db.run(`UPDATE users SET playtime = playtime + 180 WHERE telegram_id=?`, [r.telegram_id]);
    });

    bot.sendMessage(r.telegram_id, '✅ +3 minutes added!');
    res.send('OK');
  });
});

/* ======================
   WORKING MINECRAFT BOT
====================== */
let mcBot = null;
let reconnecting = false;

function startMcBot() {
  console.log('🚀 Starting Minecraft bot...');

  mcBot = createClient(SERVER);

  mcBot.on('spawn', () => {
    console.log('✅ Minecraft bot spawned!');
  });

  mcBot.on('text', p => console.log(`[MC] ${p.message}`));

  mcBot.on('player_join', player => {
    const geyserName = '.' + player.name.replace(/ /g, '_');

    db.get(`SELECT playtime FROM users WHERE geyser_name=?`, [geyserName], (e, r) => {
      if (!r) return;

      if (r.playtime <= 0) {
        mcBot.queue('command_request', { command: `kick ${player.name} Add Time First!`, type: 1, version: 1 });
      }
    });
  });

  mcBot.on('kick', p => reconnectMcBot());
  mcBot.on('error', e => reconnectMcBot());
}

function reconnectMcBot() {
  if (reconnecting) return;
  reconnecting = true;
  console.log('🔄 Reconnecting Minecraft bot in 15 seconds...');
  setTimeout(() => {
    reconnecting = false;
    startMcBot();
  }, 15000);
}

/* ======================
   PLAYTIME DEDUCTION
====================== */
setInterval(() => {
  db.all(`SELECT geyser_name, playtime FROM users`, [], (e, rows) => {
    if (!rows) return;
    rows.forEach(row => {
      if (row.playtime > 0) {
        db.run(`UPDATE users SET playtime = playtime - 1 WHERE geyser_name=?`, [row.geyser_name]);
      }
    });
  });
}, 1000);

/* ======================
   CLEANUP INACTIVE USERS
====================== */
setInterval(() => {
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  db.all(`SELECT telegram_id, geyser_name, last_seen FROM users`, [], (err, rows) => {
    if (!rows) return;
    rows.forEach(row => {
      if (!row.last_seen) return;
      if (now - row.last_seen > oneWeek) {
        db.run(`DELETE FROM users WHERE telegram_id=?`, [row.telegram_id]);
        bot.sendMessage(row.telegram_id, '⚠️ Removed from whitelist due to inactivity.');
        console.log(`🗑 Removed inactive player: ${row.geyser_name}`);
      }
    });
  });
}, 60 * 60 * 1000);

/* ======================
   HTTP SERVER FOR RENDER
====================== */
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Minecraft Bedrock bot + Telegram is running ✅');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 HTTP server running on port ${PORT}`);
});

/* ======================
   START EVERYTHING
====================== */
startMcBot();
