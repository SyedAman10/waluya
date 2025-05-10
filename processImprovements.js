require('dotenv').config();
const { OpenAI } = require('openai');
const fs = require('fs');
const crypto = require('crypto');
const { sendImprovementEmail } = require('./emailsend2');
const { pendingUpdates } = require('./pendingStore'); // You’ll create this module
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// async function extractImprovementAreas(reportContent) {
//   try {
//     console.log('Extracting improvement areas from report...');
//     const response = await openai.chat.completions.create({
//       model: 'gpt-4-turbo-preview',
//       messages: [
//         {
//           role: 'system',
//           content: `Extract ONLY the specific improvement areas and recommended actions from this team report.
//           Focus on sections titled "Areas to Improve" or "Recommended Actions".
//           Return a JSON object with a single "improvements" array containing the items.
//           Example: {"improvements": ["improve response time", "add more product details"]}

//           Rules:
//           1. Only include actionable items
//           2. Exclude any general comments or positive feedback
//           3. Keep each item concise (under 10 words)
//           4. Return empty array if no improvements found
//           `
//         },
//         {
//           role: 'user',
//           content: reportContent
//         }
//       ],
//       response_format: { type: 'json_object' },
//       temperature: 0.1
//     });

//     const result = JSON.parse(response.choices[0].message.content);
//     return Array.isArray(result.improvements) ? result.improvements : [];
//   } catch (error) {
//     console.error('Error extracting improvement areas:', error);
//     return [];
//   }
// }
async function extractImprovementAreas(reportContent) {
    try {
      console.log('Extracting improvement areas from report...');
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are an AI designed to extract specific improvement areas and recommended actions from team reports. 
            Your task is to focus only on sections titled "Areas to Improve" or "Recommended Actions". You should exclude general comments and positive feedback.
            Return the extracted improvement areas as a JSON object with a single "improvements" array containing concise, actionable items. 
            
            Example: {"improvements": ["improve response time", "add more product details"]}
  
            Rules:
            1. Only include actionable items.
            2. Keep each item concise (under 10 words).
            3. If you find the result to be satisfactory, remember to return your response in a structured and clear format for better learning.
            4. In case you think improvements are too vague or general, make sure to refine the response to match the instructions better.
  
            This process is intended to help you learn and refine your own judgment about improving systems and processes. Your responses should not just reflect what you extract, but also represent what you believe would be the best outcome for actionable improvements.`
          },
          {
            role: 'user',
            content: reportContent
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      });
  
      const result = JSON.parse(response.choices[0].message.content);
      return Array.isArray(result.improvements) ? result.improvements : [];
    } catch (error) {
      console.error('Error extracting improvement areas:', error);
      return [];
    }
  }
  
async function processImprovements(reportPath) {
  try {
    const reportContent = fs.readFileSync(reportPath, 'utf-8');
    const improvements = await extractImprovementAreas(reportContent);

    if (!improvements.length) {
      console.log('No improvements found');
      return { improvements: [], status: 'no_changes' };
    }

    const IMPROVEMENTS_FILE = path.join(__dirname, 'improvements.json');
    
    fs.writeFileSync(IMPROVEMENTS_FILE, JSON.stringify({ improvements }, null, 2));
        
    await sendImprovementEmail(process.env.MANAGER_EMAIL, {
      improvements,
      reportExcerpt: reportContent.split('\n').slice(0, 20).join('\n') + '\n...'
    });

    return { improvements, status: 'email_sent'};
  } catch (error) {
    console.error('Error processing improvements:', error);
    throw error;
  }
}

module.exports = {
  processImprovements,
  extractImprovementAreas
};
