const express = require('express');
const { OpenAI } = require('openai');
require('dotenv').config();
const fs = require('fs');

const app = express();
const PORT = 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const IMPROVEMENTS_FILE = './improvements.json';
app.get('/chat/confirm-improvements', async (req, res) => {
    try {
      // Get new improvements from file
      const { improvements: newImprovementsFromFile } = JSON.parse(fs.readFileSync(IMPROVEMENTS_FILE, 'utf-8'));
  
      if (!Array.isArray(newImprovementsFromFile) || newImprovementsFromFile.length === 0) {
        console.log('ℹ️ No improvements to apply.');
        return res.status(400).send('<h2>❌ No improvements to apply.</h2>');
      }
  
      // Use fine-tuned model for processing improvements
      const fineTunedModelId = 'your-finetuned-model-id';  // Replace with your model ID
      const assistant = await openai.chat.completions.create({
        model: fineTunedModelId,
        messages: [
          { role: 'system', content: 'You are a specialized assistant for processing improvement reports.' },
          { role: 'user', content: `Here are the new improvements: ${newImprovementsFromFile.join(', ')}` }
        ]
      });
  
      console.log('Fine-tuned model response:', assistant.choices[0].message.content);
  
      res.send('<h2>✅ Assistant successfully updated with approved improvements!</h2>');
    } catch (err) {
      console.error('❌ Error updating assistant:', err);
      res.status(500).send('<h2>❌ Failed to update assistant. Please try again later.</h2>');
    }
  });
  app.get('/voice/confirm-improvements', async (req, res) => {
    try {
      // Get new improvements from file
      const { improvements: newImprovementsFromFile } = JSON.parse(fs.readFileSync(IMPROVEMENTS_FILE, 'utf-8'));
  
      if (!Array.isArray(newImprovementsFromFile) || newImprovementsFromFile.length === 0) {
        console.log('ℹ️ No improvements to apply.');
        return res.status(400).send('<h2>❌ No improvements to apply.</h2>');
      }
  
      // Use fine-tuned model for processing improvements
      const fineTunedModelId = 'your-finetuned-model-id';  // Replace with your model ID
      const assistant = await openai.chat.completions.create({
        model: fineTunedModelId,
        messages: [
          { role: 'system', content: 'You are a specialized assistant for processing improvement reports.' },
          { role: 'user', content: `Here are the new improvements: ${newImprovementsFromFile.join(', ')}` }
        ]
      });
  
      console.log('Fine-tuned model response:', assistant.choices[0].message.content);
  
      res.send('<h2>✅ Assistant successfully updated with approved improvements!</h2>');
    } catch (err) {
      console.error('❌ Error updating assistant:', err);
      res.status(500).send('<h2>❌ Failed to update assistant. Please try again later.</h2>');
    }
  });
  app.get('/preview-improvements', async (req, res) => {
    if (!fs.existsSync(IMPROVEMENTS_FILE)) {
      console.warn('⛔ No improvements file found.');
      return res.status(400).send('<h2>❌ No improvements file found.</h2>');
    }
  
    const { improvements: newImprovementsFromFile } = JSON.parse(fs.readFileSync(IMPROVEMENTS_FILE, 'utf-8'));
  
    if (!Array.isArray(newImprovementsFromFile) || newImprovementsFromFile.length === 0) {
      console.log('ℹ️ No improvements to preview.');
      return res.status(400).send('<h2>❌ No improvements to preview.</h2>');
    }
  
    try {
      const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
      const currentInstructions = assistant.instructions || '';
  
      const improvementsSectionRegex = /## Recent Improvements:[\s\S]*?(?=\n## |\n*$)/g;
      const matchedSections = currentInstructions.match(improvementsSectionRegex) || [];
  
      const existingBullets = matchedSections.flatMap(section => {
        return section
          .split('\n')
          .slice(1)
          .map(line => line.trim())
          .filter(line => line.startsWith('-'));
      });
  
      const allUniqueImprovements = Array.from(new Set([
        ...existingBullets,
        ...newImprovementsFromFile.map(imp => `- ${imp}`)
      ]));
  
      // Remove old improvements for preview
      const baseInstructions = currentInstructions.replace(improvementsSectionRegex, '').trim();
      const previewInstructions = `${baseInstructions}\n\n## Recent Improvements:\n${allUniqueImprovements.join('\n')}`;
  
      console.log('📋 Preview of updated instructions:\n');
      console.log(previewInstructions);
  
      res.send(`
        <h2>🔍 Preview of Updated Assistant Instructions</h2>
        <pre style="background:#f6f8fa;padding:1em;border-radius:5px;overflow-x:auto">${previewInstructions}</pre>
      `);
    } catch (err) {
      console.error('❌ Error generating preview:', err);
      res.status(500).send('<h2>❌ Failed to preview improvements.</h2>');
    }
  });
    
 app.get('/cleanup-improvements', async (req, res) => {
    try {
      const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
      const currentInstructions = assistant.instructions || '';
  
      // Match and remove all "## Recent Improvements" blocks
      const improvementsSectionRegex = /## Recent Improvements:[\s\S]*?(?=(\n## |\n?$))/g;
      const cleanedInstructions = currentInstructions.replace(improvementsSectionRegex, '').trim();
  
      const updatedInstructions = `${cleanedInstructions}\n\n## Recent Improvements:\n`.trim();
  
      await openai.beta.assistants.update(ASSISTANT_ID, {
        instructions: updatedInstructions,
      });
  
      console.log(`🧹 Cleaned duplicate improvements section.`);
      res.send('<h2>✅ Cleaned all duplicate "Recent Improvements" sections successfully!</h2>');
    } catch (err) {
      console.error('❌ Error during cleanup:', err);
      res.status(500).send('<h2>❌ Failed to clean up improvements. Try again later.</h2>');
    }
  });
  
  
app.get('/assistant-instructions', async (req, res) => {
    try {
      const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
      const instructions = assistant.instructions || 'No instructions found.';
      
      console.log('📄 Current Assistant Instructions:\n');
      console.log(instructions);
  
      res.setHeader('Content-Type', 'text/plain');
      res.send(instructions);
    } catch (err) {
      console.error('❌ Failed to fetch assistant instructions:', err);
      res.status(500).send('Failed to fetch assistant instructions.');
    }
  });
  

app.listen(PORT, () => {
  console.log(`Approval server running on port ${PORT}`);
});
