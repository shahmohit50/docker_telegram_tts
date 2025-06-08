const TelegramBot = require('node-telegram-bot-api');
const axios = require("axios");
const express = require('express');
// const gTTS = require('gtts');
const { Readability } = require('@mozilla/readability');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
// const ELEVEN_LABS_API_KEY = 'sk_dcd1860ca3dc405c454580c8a120578c11d3a3f471c59c2b'; // <--- Replace with your key
// const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Default (Rachel), or change to any voice ID

// Get token from environment variable
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN environment variable is not set!');
  process.exit(1);
}

// Create Express app
const app = express();
app.use(express.json());

// Create a bot that uses polling to fetch new updates
const bot = new TelegramBot(token, { polling: true });

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Listen for any message
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userMessage = msg.text;

  console.log(`Received message from ${msg.first_name}: ${userMessage}`);

  try {
    if (userMessage.includes("https://lid")) {
      for (let j = 0; j < 6; j++) {
        let number = Number(userMessage.match(/(\d+)/)[1]) + j;
        let url = userMessage.slice(0, -5) + number;

        async function extractReadableContent(url) {
          const { data: html } = await axios.get(url);
          const dom = new JSDOM(html, { url });
          const reader = new Readability(dom.window.document);
          const article = reader.parse();
          if (article.title.indexOf("Son Of The Dragon Chapter") === -1) {
            return "";
          }
          return article.textContent;
        }
        let scraped = await extractReadableContent(url);
        if (!scraped) {
          console.log(`No readable content found for ${url}`);
          continue;
        }
        // const scraped = await axios.get(url, {
        //   headers: {
        //     Accept: "application/rss+xml",
        //     "User-Agent":
        //       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36",
        //   },
        // });

        if (scraped.length > 999) {
          for (let i = 0; i < scraped.length; i += 999) {
            await new Promise(async (resolve, reject) => {
              const path = require('path');
              const filename = path.join(__dirname, `output_${Date.now()}.wav`);

              // Clean text for TTS (natural reading)
              const ttsText = scraped.substring(i, i + 999)
                // Handle all types of quotes uniformly
                .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
                // Basic punctuation normalization
                .replace(/\u2026/g, '...')
                .replace(/[\u2014\u2013]/g, '-')
                .replace(/\u203D/g, '!?')
                // Add natural pauses
                .replace(/([.!?])\s*([A-Z])/g, '$1\n$2')
                .replace(/,/g, ',\n')
                .replace(/\s+/g, ' ')
                .trim();

              // Escape the text for shell command while preserving newlines
              const escapedText = ttsText
                .replace(/\\/g, '\\\\') // Escape backslashes first
                .replace(/"/g, '\\"')   // Escape quotes
                .replace(/\$/g, '\\$')  // Escape dollar signs
                .replace(/`/g, '\\`');  // Escape backticks

              const startTime = Date.now();
              const ttsCommand = `tts --model_name tts_models/en/ljspeech/tacotron2-DDC --text "${escapedText}" --out_path "${filename}"`;
              try {
                const { stdout, stderr } = await execPromise(ttsCommand);
                console.log("TTS stdout:", stdout);
                console.error("TTS stderr:", stderr);

                // Wait for file to be written
                let attempts = 0;
                while (attempts < 10) {
                  if (fs.existsSync(filename)) {
                    const stats = fs.statSync(filename);
                    if (stats.size > 0) {
                      // File exists and has content, now safe to send
                      await bot.sendAudio(chatId, fs.createReadStream(filename), {
                        caption: `🗂 Part ${number}`,
                      });
                      const endTime = Date.now();
                      const processingTime = (endTime - startTime) / 1000;
                      const minutes = Math.floor(processingTime / 60);
                      const seconds = Math.round(processingTime % 60);
                      console.log(`Processing time: ${minutes}m ${seconds}s`);
                      fs.unlinkSync(filename);
                      resolve();
                      return;
                    }
                  }
                  await new Promise(res => setTimeout(res, 500));
                  attempts++;
                }
                bot.sendMessage(chatId, `❌ Failed to generate part ${number} - File not created properly`);
              } catch (error) {
                console.error(`TTS error (chunk ${number}):`, error.message);
                bot.sendMessage(chatId, `❌ Error generating audio: ${error.message}`);
              }
            });
          }
        } else {
          await bot.sendMessage(chatId, scraped);
        }
      }
      //      await axios.post(`${TELEGRAM_API}/sendMessage`, {
      //        chat_id: chatId,
      //        text: `Scraped content:\n\n${scraped.data.substring(0, 1000)}`, // keep it short
      //      });
    } else if (userMessage === "http://") {
      await axios.get(userMessage); // will likely fail, but mimics your original condition
    } else {
      bot.sendMessage(chatId, 'You said: ' + userMessage);
    }

  } catch (err) {
    console.error(err);

  }
  // Optional: Reply to the user

});
