const { OpenAI } = require('openai');
require('dotenv').config();
const fs = require('fs');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function fineTuneModel() {
  try {
    // Upload the file
    const file = await openai.files.create({
      file: fs.createReadStream('./improvements.jsonl'),
      purpose: 'fine-tune'
    });

    console.log('File uploaded successfully:', file.id);

    // Create a fine-tuning job
    const fineTune = await openai.fineTunes.create({
      training_file: file.id,
      model: 'gpt-4'
    });

    console.log('Fine-tuning started:', fineTune.id);
  } catch (error) {
    console.error('Error during fine-tuning process:', error);
  }
}
const fineTunedModelId = 'gpt_finetunedv1';  
const response = await openai.chat.completions.create({
  model: fineTunedModelId,
  messages: [
    { role: 'system', content: 'This is a fine-tuned assistant' },
    { role: 'user', content: 'What improvements can we make in the report?' }
  ]
});

console.log(response.choices[0].message.content);


fineTuneModel();
