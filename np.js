const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');

const client = new textToSpeech.TextToSpeechClient();

const request = {
  input: { text: 'Hello! This is a natural sounding voice from Google WaveNet.' },
  voice: {
    languageCode: 'en-US',
    name: 'en-US-Wavenet-D',  // <-- WaveNet voice (high quality)
  },
  audioConfig: { audioEncoding: 'MP3' },
};

async function synthesize() {
  const [response] = await client.synthesizeSpeech(request);
  await util.promisify(fs.writeFile)('natural.mp3', response.audioContent, 'binary');
  console.log('Natural sounding audio saved as "natural.mp3"');
}

synthesize();
