/* ===== IMPORTS ===== */
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('bedrock-protocol');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const net = require('net');

/* ===== CONFIG ===== */
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MC_BOT_NAME = process.env.MC_BOT_NAME || 'Noxell';
const SERVER = {
  host: process.env.SERVER_HOST,
  port: parseInt(process.env.SERVER_PORT),
  version: process.env.SERVER_VERSION,
  offline: process.env.SERVER_OFFLINE === 'true'
};

/* ===== DATABASE ===== */
const db = new sqlite3.Database('./database.db');

db.run(`
CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  gamertag TEXT,
  playtime INTEGER DEFAULT 0,
  last_join INTEGER,
  last_seen INTEGER
)
`);

/* ===== TELEGRAM BOT ===== */
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Menu keyboard
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

// Track waiting users
const waitingForGamertag = new Set();

// Start command
bot.onText(/\/start/, msg => {
  bot.sendMessage(msg.chat.id, '👋 Welcome!\nChoose an option:', menuKeyboard);
});

// Handle messages
bot.on('message', msg => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  // ===== Whitelist Here =====
  if (text === '🟢 Whitelist Here') {
    waitingForGamertag.add(chatId);
    return bot.sendMessage(
      chatId,
      '✏️ Please type your **Minecraft Username**.\n⚠️ Make sure it is correct and **case-sensitive**, otherwise you won’t be whitelisted!',
      { parse_mode: 'Markdown', reply_markup: menuKeyboard }
    );
  }

  // Receive gamertag
  if (waitingForGamertag.has(chatId)) {
    const gamertag = text.trim();
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(gamertag))
      return bot.sendMessage(chatId, '❌ Invalid gamertag. Try again.');

    db.run(
      `INSERT OR REPLACE INTO users 
       (telegram_id, gamertag, playtime, last_join, last_seen)
       VALUES (?, ?, COALESCE((SELECT playtime FROM users WHERE telegram_id=?), 0), ?, ?)`,
      [chatId, gamertag, chatId, Date.now(), Date.now()]
    );

    waitingForGamertag.delete(chatId);

    bot.sendMessage(
      chatId,
      `✅ Gamertag **${gamertag}** saved successfully!\nYou can now click ➕ Add Time to start playing.\nMake sure to join the Minecraft server with the **exact username**.`,
      { parse_mode: 'Markdown', reply_markup: menuKeyboard }
    );
    return;
  }

  // ===== Play Time Left =====
  if (text === '⏱ Play Time Left') {
    db.get(`SELECT playtime FROM users WHERE telegram_id=?`, [chatId], (err, row) => {
      if (!row) return bot.sendMessage(chatId, '❌ You are not whitelisted yet.');
      const minutes = Math.floor(row.playtime / 60);
      bot.sendMessage(chatId, `⏱ Play time left: **${minutes} minutes**`, { parse_mode: 'Markdown' });
    });
    return;
  }

  // ===== Add Time =====
  if (text === '➕ Add Time') {
    const monetagLink = `https://MONETAG_LINK?subid=${chatId}`;
    bot.sendMessage(chatId, '🎥 Watch the rewarded ad to get **+3 minutes**:', {
      reply_markup: { inline_keyboard: [[{ text: '🎥 Watch Ad', url: monetagLink }]] },
      parse_mode: 'Markdown'
    });
    return;
  }

  // ===== Check IP and PORT =====
  if (text === '🌐 Check IP and PORT') {
    const serverIP = SERVER.host;
    const serverPort = SERVER.port;

    checkServerStatus(serverIP, serverPort).then(status => {
      bot.sendMessage(chatId,
        `🌐 **Server Info**\nIP: ${serverIP}\nPORT: ${serverPort}\nStatus: ${status}`,
        { parse_mode: 'Markdown', reply_markup: menuKeyboard }
      );
    }).catch(() => {
      bot.sendMessage(chatId,
        `🌐 **Server Info**\nIP: ${serverIP}\nPORT: ${serverPort}\nStatus: ❌ Offline`,
        { parse_mode: 'Markdown', reply_markup: menuKeyboard }
      );
    });
    return;
  }
});

/* ===== CHECK SERVER STATUS FUNCTION ===== */
function checkServerStatus(host, port) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(2000); // 2 seconds
    socket.on('connect', () => { socket.destroy(); resolve('✅ Online'); });
    socket.on('timeout', () => { socket.destroy(); reject(); });
    socket.on('error', () => reject());
    socket.connect(port, host);
  });
}

/* ===== EXPRESS SERVER FOR MONETAG POSTBACK ===== */
const app = express();
app.get('/monetag', (req, res) => {
  const telegramId = req.query.subid;
  if (!telegramId) return res.send('Missing subid');

  db.run(`UPDATE users SET playtime = playtime + 180 WHERE telegram_id=?`, [telegramId], function(err) {
    if (err) return res.status(500).send('Error');
    bot.sendMessage(telegramId, '✅ +3 minutes added! You can now join the server.');
    res.send('OK');
  });
});

app.listen(process.env.PORT || 3000, () => console.log('🟢 Express server running'));

/* ===== MINECRAFT BOT ===== */
const mcBot = createClient({
  username: MC_BOT_NAME,
  ...SERVER
});

mcBot.on('spawn', () => console.log('✅ Minecraft bot spawned & OP'));
mcBot.on('text', p => handleMCMessage(p.message));
mcBot.on('kick', () => setTimeout(() => mcBot.connect(), 5000));
mcBot.on('error', e => console.log('⚠️ Error:', e.message));

/* ===== MC LOGIC ===== */
function sendMCCommand(command) {
  mcBot.queue('command_request', {
    command,
    origin: { type: 0, uuid: '', request_id: '' },
    internal: false,
    version: 66
  });
}

function handleMCMessage(msg) {
  const joinMatch = msg.match(/(\S+) joined the game/);
  if (joinMatch) onPlayerJoin(joinMatch[1].replace('.', ''));

  const leftMatch = msg.match(/(\S+) left the game/);
  if (leftMatch) onPlayerLeave(leftMatch[1].replace('.', ''));
}

function onPlayerJoin(player) {
  db.get(`SELECT playtime FROM users WHERE gamertag=?`, [player], (err, row) => {
    if (!row || row.playtime <= 0) {
      sendMCCommand(`/kick ${player} Add Time First!`);
    } else {
      db.run(`UPDATE users SET last_seen=? WHERE gamertag=?`, [Date.now(), player]);
    }
  });
}

function onPlayerLeave(player) {
  db.run(`UPDATE users SET last_join=? WHERE gamertag=?`, [Date.now(), player]);
}

/* ===== TIME COUNTDOWN (online players only) ===== */
setInterval(() => {
  db.all(`SELECT gamertag, playtime FROM users WHERE playtime > 0`, (err, rows) => {
    rows.forEach(user => db.run(`UPDATE users SET playtime = playtime - 1 WHERE gamertag=?`, [user.gamertag]));
  });
}, 1000);

/* ===== AUTO UNWHITELIST AFTER 7 DAYS ===== */
setInterval(() => {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  db.all(`SELECT gamertag FROM users WHERE last_seen < ?`, [weekAgo], (err, rows) => {
    rows.forEach(u => {
      sendMCCommand(`/whitelist remove .${u.gamertag}`);
      db.run(`DELETE FROM users WHERE gamertag=?`, [u.gamertag]);
    });
  });
}, 24 * 60 * 60 * 1000);
