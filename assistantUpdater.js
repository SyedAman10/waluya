// require('dotenv').config();
// const { OpenAI } = require('openai');
// const fs = require('fs');
// const { sendImprovementEmail } = require('./emailsend'); // We'll modify emailsend.js

// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// const ASSISTANT_ID = process.env.ASSISTANT_ID;
// const MANAGER_EMAIL = process.env.MANAGER_EMAIL;

// const openai = new OpenAI({
//   apiKey: OPENAI_API_KEY,
// });

// /**
//  * Extracts improvement areas from team reports
//  * @param {string} reportContent - The content of the team report
//  * @returns {Array} - Array of improvement suggestions
//  */
// async function extractImprovementAreas(reportContent) {
//     try {
//       console.log('Extracting improvement areas from report...');
      
//       const response = await openai.chat.completions.create({
//         model: 'gpt-4-turbo-preview',
//         messages: [
//           {
//             role: 'system',
//             content: `Extract ONLY the specific improvement areas and recommended actions from this team report.
//             Focus on sections titled "Areas to Improve" or "Recommended Actions".
//             Return a JSON object with a single "improvements" array containing the items.
//             Example: {"improvements": ["improve response time", "add more product details"]}
            
//             Rules:
//             1. Only include actionable items
//             2. Exclude any general comments or positive feedback
//             3. Keep each item concise (under 10 words)
//             4. Return empty array if no improvements found`
//           },
//           {
//             role: 'user',
//             content: reportContent
//           }
//         ],
//         response_format: { type: 'json_object' },
//         temperature: 0.1
//       });
  
//       // Debugging: log the raw response
//       console.log('Raw API response:', response.choices[0].message.content);
  
//       // Parse the response more safely
//       try {
//         const result = JSON.parse(response.choices[0].message.content);
//         if (result && Array.isArray(result.improvements)) {
//           return result.improvements;
//         }
//         if (result && Array.isArray(result.areas)) {
//           return result.areas;
//         }
//         return [];
//       } catch (parseError) {
//         console.error('Error parsing JSON response:', parseError);
//         return [];
//       }
//     } catch (error) {
//       console.error('Error extracting improvement areas:', error);
//       return [];
//     }
//   }

// /**
//  * Updates the assistant's instructions with new improvements
//  * @param {Array} improvements - Array of improvement suggestions
//  * @returns {Object} - Update result
//  */
// async function updateAssistantInstructions(improvements) {
//   try {
//     if (!improvements || improvements.length === 0) {
//       return { success: false, message: 'No improvements to add' };
//     }

//     console.log('Fetching current assistant...');
//     const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
    
//     const currentInstructions = assistant.instructions || '';
//     const improvementsText = improvements.map(imp => `- ${imp}`).join('\n');
    
//     // Only add improvements that aren't already in the instructions
//     const newImprovements = improvements.filter(imp => 
//       !currentInstructions.includes(imp)
//     );

//     if (newImprovements.length === 0) {
//       return { success: true, message: 'No new improvements to add' };
//     }

//     const newInstructions = `${currentInstructions}\n\n## Recent Improvements:\n${improvementsText}`;

//     console.log('Updating assistant instructions...');
//     const updatedAssistant = await openai.beta.assistants.update(ASSISTANT_ID, {
//       instructions: newInstructions
//     });

//     return { 
//       success: true,
//       assistant: updatedAssistant,
//       improvementsAdded: newImprovements
//     };
//   } catch (error) {
//     console.error('Error updating assistant:', error);
//     return { success: false, error: error.message };
//   }
// }

// async function processImprovements(reportPath) {
//     try {
//       // Read the report file
//       const reportContent = fs.readFileSync(reportPath, 'utf-8');
//       console.log('Report content length:', reportContent.length);
      
//       // Extract improvement areas
//       const improvements = await extractImprovementAreas(reportContent);
//       console.log('Extracted improvements:', improvements);
      
//       if (improvements.length === 0) {
//         console.log('No improvement areas found in report');
//         return { improvements: [], updateResult: null };
//       }
  
//       // Update assistant
//       const updateResult = await updateAssistantInstructions(improvements);
//       console.log('Update result:', updateResult);
      
//       // Prepare email content
//       const emailContent = {
//         improvements,
//         updateResult,
//         reportExcerpt: reportContent.split('\n').slice(0, 20).join('\n') + '\n...'
//       };
  
//       // Send email to manager
//       if (MANAGER_EMAIL) {
//         console.log('Sending improvement email to manager...');
//         await sendImprovementEmail(MANAGER_EMAIL, emailContent);
//       }
  
//       return {
//         improvements,
//         updateResult
//       };
//     } catch (error) {
//       console.error('Error processing improvements:', error);
//       throw error;
//     }
//   }
// module.exports = {
//   processImprovements,
//   extractImprovementAreas,
//   updateAssistantInstructions
// };