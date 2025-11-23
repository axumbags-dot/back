import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import { pool } from "../config/db.js";


dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEBIRR_ACCOUNT = process.env.TELEBIRR_ACCOUNT || '000-000-000 (set TELEBIRR_ACCOUNT in .env)';
const TELEBIRR_NAME = process.env.TELEBIRR_NAME || 'Yabets';
const CBE_BIRR_ACCOUNT = process.env.CBE_BIRR_ACCOUNT || '0000000000 (set CBE_BIRR_ACCOUNT in .env)';
const CBE_BIRR_NAME = process.env.CBE_BIRR_NAME || 'Yabets';
// in-memory map to remember which users selected a deposit channel and are awaiting screenshot
const pendingDeposits = new Map();
// in-memory map to remember which users are in withdrawal flow awaiting amount
const pendingWithdrawals = new Map();

if (!BOT_TOKEN) {
  console.warn("⚠️  BOT_TOKEN is not set. Telegram bot will not be started.");
} else {
  const bot = new Telegraf(BOT_TOKEN);

  // Reply and show the Register contact button when a user sends /start
  bot.start(async (ctx) => {
    try {
      await ctx.reply('Welcome! To get started, please share your contact by pressing the Register button below:', {
        reply_markup: {
          // show Register and a compact settings icon that acts like a small menu button
          keyboard: [
            [{ text: 'Register', request_contact: true }],
            [{ text: 'Menu/' }]
          ],
          one_time_keyboard: false,
          resize_keyboard: true,
        },
      });
      // nothing else here; the compact ⚙️ reply-keyboard button will be used to open the menu
    } catch (err) {
      console.error('Failed to send /start keyboard:', err);
    }
  });

  // /register command - sends a keyboard with a contact-requesting button labeled 'Register'
  bot.command('register', async (ctx) => {
    try {
      await ctx.reply('Please press the button below to share your phone contact for registration:', {
        reply_markup: {
          keyboard: [[{ text: 'Register', request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      });
    } catch (err) {
      console.error('Failed to send /register keyboard:', err);
    }
  });

  // Handle incoming contact messages (when user presses the Register contact button)
  bot.on('contact', async (ctx) => {
    try {
      const contact = ctx.message.contact || {};
      const phone = contact.phone_number || null;
      const username = ctx.from && ctx.from.username ? ctx.from.username : null;
      const name = `${ctx.from?.first_name || ''} ${ctx.from?.last_name || ''}`.trim() || null;

      // Log to server console
      console.log('User registration via contact button:', { phone, username, name });

      // Save user using the existing registerUser controller
      const fakeReq = { body: { telegram_id: String(ctx.from.id), username, name, phone } };
      const fakeRes = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(payload) { console.log('registerUser response:', this.statusCode || 200, payload); return payload; }
      };

      try {
        await registerUser(fakeReq, fakeRes);
      } catch (err) {
        console.error('Error calling registerUser controller:', err);
      }

      // Acknowledge to the user and keep the main keyboard (so the small '⚙️' stays visible)
      await ctx.reply('Thanks — your contact was received and saved. ✅', {
        reply_markup: {
          keyboard: [
            [{ text: 'Register', request_contact: true }],
            [{ text: '⚙️' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      });

      // Send a Web App button that opens the mini app/site
      try {
        await ctx.reply('Open this to play:', {
          reply_markup: {
            inline_keyboard: [[{ text: 'Open to play', web_app: { url: 'https://front.yabets.dev' } }]]
          }
        });
      } catch (err) {
        console.error('Failed to send Web App button:', err);
        // Fallback to a simple URL button if web_app isn't supported
        try {
          await ctx.reply('Open this to play: https://test.yabets.dev');
        } catch (e) { console.error('Failed to send fallback link:', e); }
      }
    } catch (err) {
      console.error('Error handling contact message:', err);
      try { await ctx.reply('There was an error processing your contact.'); } catch (e) {}
    }
  });

  // /menu command to show the small icon menu as well
  bot.command('menu', async (ctx) => {
    try {
      await ctx.reply('Menu:', {
        reply_markup: {
          inline_keyboard: [[{ text: '⚙️', callback_data: 'open_menu' }]]
        }
      });
    } catch (err) {
      console.error('Failed to send /menu icon:', err);
    }
  });

  // When the small icon is pressed, replace it with Deposit/Withdrawal buttons
  bot.action('open_menu', async (ctx) => {
    try {
      await ctx.editMessageReplyMarkup({
        inline_keyboard: [
          [
            { text: 'Deposit', callback_data: 'deposit' },
            { text: 'Withdrawal', callback_data: 'withdrawal' }
          ],
          [ { text: 'Close', callback_data: 'close_menu' } ]
        ]
      });
      await ctx.answerCbQuery();
    } catch (err) {
      console.error('Failed to open menu:', err);
      try { await ctx.answerCbQuery('Failed to open menu'); } catch (e) {}
    }
  });

  // Actions for Deposit and Withdrawal - send command text to the chat
  bot.action('deposit', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.reply('/deposit');
    } catch (err) {
      console.error('Failed to handle deposit action:', err);
    }
  });

  bot.action('withdrawal', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.reply('/withdrawal');
    } catch (err) {
      console.error('Failed to handle withdrawal action:', err);
    }
  });

  bot.action('close_menu', async (ctx) => {
    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      await ctx.answerCbQuery('Closed');
    } catch (err) {
      console.error('Failed to close menu:', err);
    }
  });

  // Reply 'hi' to plain text messages (not commands)
  bot.on('text', async (ctx) => {
    try {
      const text = ctx.message && ctx.message.text ? ctx.message.text.trim() : '';
      // if user pressed the compact '⚙️' reply-keyboard button, replace the reply keyboard
      // with a compact dropdown-like reply keyboard (Deposit / Withdrawal / Back)
      if (text === '⚙️') {
        try {
          await ctx.reply('Choose an action:', {
            reply_markup: {
              keyboard: [
                [{ text: 'Deposit' }, { text: 'Withdrawal' }],
                [{ text: 'Back' }]
              ],
              resize_keyboard: true,
              one_time_keyboard: false
            }
          });
        } catch (err) {
          console.error('Failed to open dropdown keyboard from icon press:', err);
        }
        return;
      }

      // If user pressed Back, restore the initial keyboard
      if (text === 'Back') {
        try {
          await ctx.reply('Menu closed.', {
            reply_markup: {
              keyboard: [
                [{ text: 'Register', request_contact: true }],
                [{ text: '⚙️' }]
              ],
              resize_keyboard: true,
              one_time_keyboard: false
            }
          });
        } catch (err) {
          console.error('Failed to restore main keyboard:', err);
        }
        return;
      }

      // Handle Deposit/Withdrawal selection from the reply keyboard
  if (text === 'Deposit') {
        try {
          // show deposit channel choices (Telebirr, CBE Birr) using a small reply keyboard dropdown
          await ctx.reply('Choose a deposit channel:', {
            reply_markup: {
              keyboard: [
                [{ text: 'Telebirr' }, { text: 'CBE Birr' }],
                [{ text: 'Back' }]
              ],
              resize_keyboard: true,
              one_time_keyboard: false
            }
          });
        } catch (err) {
          console.error('Failed to open deposit channels keyboard:', err);
        }
        return;
      }

      if (text === 'Withdrawal') {
        try {
          // start withdrawal flow: ask user to send the amount
          pendingWithdrawals.set(String(ctx.from.id), true);
          await ctx.reply('You selected Withdrawal. Please send the amount you wish to withdraw (e.g. 50 or 50.00):', {
            reply_markup: {
              keyboard: [
                [{ text: 'Back' }]
              ],
              resize_keyboard: true,
              one_time_keyboard: false
            }
          });
        } catch (err) {
          console.error('Failed to initiate Withdrawal selection:', err);
        }
        return;
      }

      // Handle deposit channel choices
      if (text === 'Telebirr') {
        try {
          const instr = `You selected Telebirr.\n\nPlease pay to the following Telebirr account:\nAccount: ${TELEBIRR_ACCOUNT}\nAccount name: ${TELEBIRR_NAME}\n\nSteps:\n1) Send the exact amount to the account above.\n2) Take a screenshot of the successful payment.\n3) Send the screenshot here and include your Telegram ID: ${ctx.from.id}\n\nAfter we verify the payment we'll credit your balance.`;
          await ctx.reply(instr, {
            reply_markup: {
              keyboard: [
                [{ text: 'Register', request_contact: true }],
                [{ text: '⚙️' }]
              ],
              resize_keyboard: true,
              one_time_keyboard: false
            }
          });
          // mark user as awaiting deposit screenshot for Telebirr
          try { pendingDeposits.set(String(ctx.from.id), 'Telebirr'); } catch(e){}
        } catch (err) {
          console.error('Failed to handle Telebirr selection:', err);
        }
        return;
      }

      if (text === 'CBE Birr') {
        try {
          const instr = `You selected CBE Birr.\n\nPlease pay to the following bank account:\nAccount: ${CBE_BIRR_ACCOUNT}\nAccount name: ${CBE_BIRR_NAME}\nBank: CBE (Commercial Bank of Ethiopia)\n\nSteps:\n1) Make a transfer to the account above (or use CBE Birr if supported).\n2) Take a screenshot or receipt of the payment.\n3) Send the screenshot here and include your Telegram ID: ${ctx.from.id}\n\nAfter verification we'll credit your balance.`;
          await ctx.reply(instr, {
            reply_markup: {
              keyboard: [
                [{ text: 'Register', request_contact: true }],
                [{ text: '⚙️' }]
              ],
              resize_keyboard: true,
              one_time_keyboard: false
            }
          });
          // mark user as awaiting deposit screenshot for CBE Birr
          try { pendingDeposits.set(String(ctx.from.id), 'CBE Birr'); } catch(e){}
        } catch (err) {
          console.error('Failed to handle CBE Birr selection:', err);
        }
        return;
      }

      // If user is in withdrawal flow and sent an amount, process it
      if (pendingWithdrawals.has(String(ctx.from.id))) {
        try {
          const raw = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
          const amount = parseFloat(raw);
          if (!raw || isNaN(amount) || amount <= 0) {
            await ctx.reply('Please send a valid numeric amount (e.g. 50 or 50.00).');
            return;
          }

          // get user by telegram_id
          const userRes = await pool.query('SELECT id, balance FROM users WHERE telegram_id=$1', [String(ctx.from.id)]);
          if (!userRes.rows.length) {
            await ctx.reply('You are not registered yet. Please press Register to share your contact first.');
            pendingWithdrawals.delete(String(ctx.from.id));
            return;
          }
          const user = userRes.rows[0];
          const balance = parseFloat(user.balance) || 0;
          if (balance < amount) {
            await ctx.reply(`Insufficient balance. Your current balance is ${balance}.`);
            pendingWithdrawals.delete(String(ctx.from.id));
            return;
          }

          // create withdrawal transaction with status pending
          await pool.query(
            "INSERT INTO transactions (user_id, amount, type, status, screenshot_url, payment_channel) VALUES ($1, $2, 'withdrawal', 'pending', NULL, NULL)",
            [user.id, amount]
          );

          pendingWithdrawals.delete(String(ctx.from.id));
          await ctx.reply('Withdrawal request submitted and is pending approval. We will notify you when it is processed.', {
            reply_markup: {
              keyboard: [
                [{ text: 'Register', request_contact: true }],
                [{ text: '⚙️' }]
              ],
              resize_keyboard: true,
              one_time_keyboard: false
            }
          });
        } catch (err) {
          console.error('Failed to process withdrawal amount:', err);
          try { await ctx.reply('There was an error processing your withdrawal. Please try again later.'); } catch(e){}
        }
        return;
      }

      // ignore commands (they start with '/') to avoid double replies for /start
      if (text && !text.startsWith('/')) {
        await ctx.reply('hi');
      }
    } catch (err) {
      console.error('Failed to send text reply:', err);
    }
  }); 

  bot.on("photo", async (ctx) => {
    try {
      const file = ctx.message.photo.pop(); // get highest resolution
      const url = await ctx.telegram.getFileLink(file.file_id);
      const caption = ctx.message.caption || '';
      // try to parse amount from caption; if missing or invalid, default to 0
      const parsedAmount = parseFloat(caption.replace(/[^0-9\.]/g, '')) || 0;

      // check if user selected a deposit channel
      const channel = pendingDeposits.get(String(ctx.from.id)) || null;
      if (channel) {
        console.log(`Processing deposit screenshot for ${ctx.from.id} via ${channel}`);
        // clear pending flag
        pendingDeposits.delete(String(ctx.from.id));
      }

      await pool.query(
        "INSERT INTO transactions (user_id, amount, type, status, screenshot_url, payment_channel) VALUES ((SELECT id FROM users WHERE telegram_id=$1), $2, 'deposit', 'pending', $3, $4)",
        [ctx.from.id, parsedAmount, url.href, channel]
      );

      await ctx.reply("Deposit submitted for verification ✅");
    } catch (err) {
      console.error('Error handling photo message:', err);
      try { await ctx.reply('There was an error processing your deposit.'); } catch (e) {}
    }
  });

  bot.launch().then(() => console.log('🤖 Telegram bot started')).catch((err) => console.error('Failed to launch Telegram bot:', err));
}
