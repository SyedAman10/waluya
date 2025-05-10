// require('dotenv').config();
// const axios = require('axios');
// const fs = require('fs');
// const { OpenAI } = require('openai');

// // Load environment variables
// const GHL_API_KEY = process.env.GHL_API_KEY;
// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// // Initialize OpenAI client
// const openai = new OpenAI({
//   apiKey: OPENAI_API_KEY,
// });

// /**
//  * Fetches conversation messages from GHL API
//  * @param {string} conversationId - The GHL conversation ID
//  * @returns {Array} - Array of processed conversation messages
//  */
// async function getConversationData(conversationId) {
//   try {
//     console.log(`Fetching conversation ${conversationId}...`);
    
//     const response = await axios.get(
//       `https://services.leadconnectorhq.com/conversations/${conversationId}/messages`,
//       {
//         headers: {
//           'Authorization': `Bearer ${GHL_API_KEY}`,
//           'Version': '2021-04-15'
//         }
//       }
//     );
    
//     // Handle different response structures
//     let messages = [];
    
//     if (Array.isArray(response.data)) {
//       messages = response.data;
//     } else if (response.data?.messages && Array.isArray(response.data.messages)) {
//       messages = response.data.messages;
//     } else if (response.data?.messages?.messages && Array.isArray(response.data.messages.messages)) {
//       messages = response.data.messages.messages;
//     } else {
//       throw new Error(`Unsupported response format: ${JSON.stringify(response.data)}`);
//     }
    
//     // Get contact info if available
//     let contactInfo = null;
//     if (response.data?.contact) {
//       contactInfo = {
//         name: response.data.contact.name || 'Unknown',
//         email: response.data.contact.email || 'Not provided',
//         phone: response.data.contact.phone || 'Not provided'
//       };
//     }
    
//     // Process messages
//     const validMessages = messages
//       .filter(msg => 
//         msg.direction &&
//         msg.body &&
//         typeof msg.body === 'string' &&
//         msg.body !== '> Voice Note <' &&
//         !msg.attachments?.length
//       )
//       .map(msg => ({
//         role: msg.direction === 'inbound' ? 'user' : 'assistant',
//         content: msg.body.trim(),
//         timestamp: msg.dateAdded
//       }));
    
//     console.log(`Processed ${validMessages.length} valid messages`);
    
//     return {
//       messages: validMessages,
//       contactInfo: contactInfo
//     };
//   } catch (error) {
//     console.error('Error fetching conversation data:', {
//       message: error.message,
//       status: error.response?.status,
//       data: error.response?.data
//     });
//     throw error;
//   }
// }

// /**
//  * Analyzes conversation using OpenAI to determine success and extract insights
//  * @param {Array} messages - Processed conversation messages
//  * @returns {Object} - Analysis results including success status and insights
//  */
// async function analyzeConversation(messages) {
//   try {
//     console.log('Analyzing conversation with OpenAI...');
    
//     const formattedMessages = [
//       {
//         role: 'system',
//         content: `You are an expert conversation analyzer. Analyze this conversation and provide concise insights in this exact JSON format:
//         {
//           "successStatus": "yes/no/partial",
//           "keyPoints": ["bullet point 1", "bullet point 2"],
//           "customerSentiment": "positive/neutral/negative",
//           "improvementAreas": ["brief area 1", "brief area 2"],
//           "nextSteps": ["brief action 1", "brief action 2"]
//         }
        
//         Keep each bullet point under 10 words. Be extremely concise.`
//       },
//       ...messages.map(msg => ({
//         role: msg.role,
//         content: msg.content
//       }))
//     ];
    
//     const response = await openai.chat.completions.create({
//       model: 'gpt-4-turbo-preview',
//       messages: formattedMessages,
//       response_format: { type: 'json_object' },
//       temperature: 0.2
//     });
    
//     const analysis = JSON.parse(response.choices[0].message.content);
//     console.log('Analysis complete');
    
//     return analysis;
//   } catch (error) {
//     console.error('Error analyzing conversation:', error.message);
//     throw error;
//   }
// }

// /**
//  * Generates an internal team report with actionable insights
//  * @param {Array} messages - Processed conversation messages
//  * @param {Object} analysis - Results from OpenAI analysis
//  * @returns {string} - Formatted internal report
//  */
// async function generateTeamReport(messages, analysis) {
//   try {
//     console.log('Generating team report...');
    
//     const prompt = [
//       {
//         role: 'system',
//         content: `Generate a BRIEF internal team report (MAX 15 lines) with this structure:
        
//         # Conversation Summary
//         - Outcome: [success/partial/failure]
//         - Key topics: [3-5 topics]
        
//         # Performance Assessment
//         - Strengths: [1-2 bullet points]
//         - Areas to Improve: [1-2 bullet points]
        
//         # Recommended Actions
//         - [1-2 specific actions]
        
//         Keep each point under 10 words. No fluff.`
//       },
//       {
//         role: 'user',
//         content: `Conversation messages: ${JSON.stringify(messages)}
//         Analysis: ${JSON.stringify(analysis)}`
//       }
//     ];
    
//     const response = await openai.chat.completions.create({
//       model: 'gpt-4-turbo-preview',
//       messages: prompt,
//       temperature: 0.3
//     });
    
//     return response.choices[0].message.content;
//   } catch (error) {
//     console.error('Error generating team report:', error.message);
//     throw error;
//   }
// }

// /**
//  * Generates a client-facing report with conversation summary
//  * @param {Array} messages - Processed conversation messages
//  * @param {Object} analysis - Results from OpenAI analysis
//  * @param {Object} contactInfo - Customer contact information
//  * @returns {string} - Formatted client report
//  */
// async function generateClientReport(messages, analysis, contactInfo) {
//   try {
//     console.log('Generating client report...');

//     const conversationDate = messages.length > 0 
//       ? new Date(messages[0].timestamp).toLocaleDateString() 
//       : 'Unknown date';
    
//     const prompt = [
//       {
//         role: 'system',
//         content: `Determine the lead qualification status from this conversation. ONLY respond with ONE of these statuses:
//         - "Interested - Ready to proceed"
//         - "Interested - Needs follow-up"
//         - "Warm - Potential but not ready"
//         - "Not interested - Closed"
//         - "Unclear - Needs more info"
        
//         Base your assessment on:
//         1. Explicit statements of interest/disinterest
//         2. Willingness to discuss next steps
//         3. Engagement level in conversation
//         4. Specific objections raised (if any)
        
//         Respond ONLY with the exact status phrase from the list above.`
//       },
//       {
//         role: 'user',
//         content: `Conversation with ${contactInfo?.name || 'Lead'} on ${conversationDate}:
//         ${JSON.stringify(messages)}`
//       }
//     ];
    
//     const response = await openai.chat.completions.create({
//       model: 'gpt-4-turbo-preview',
//       messages: prompt,
//       temperature: 0.3
//     });
    
//     return `Lead Status: ${response.choices[0].message.content}`;
//   } catch (error) {
//     console.error('Error generating client report:', error.message);
//     throw error;
//   }
// }


// /**
//  * Main function to process a conversation and generate reports
//  * @param {string} conversationId - The GHL conversation ID
//  */
// async function processConversation(conversationId) {
//   try {
//     console.log(`Starting to process conversation: ${conversationId}`);
    
//     // 1. Get conversation data
//     const { messages, contactInfo } = await getConversationData(conversationId);
    
//     if (messages.length === 0) {
//       console.warn('No valid messages found in conversation');
//       return;
//     }
    
//     // 2. Analyze conversation
//     const analysis = await analyzeConversation(messages);
    
//     // 3. Generate reports
//     const teamReport = await generateTeamReport(messages, analysis);
//     const clientReport = await generateClientReport(messages, analysis, contactInfo);
    
//     // 4. Save results
//     const outputDir = './reports';
//     if (!fs.existsSync(outputDir)) {
//       fs.mkdirSync(outputDir);
//     }
    
//     const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
//     // Save conversation data
//     fs.writeFileSync(
//       `${outputDir}/conversation_${conversationId}_${timestamp}.json`, 
//       JSON.stringify({messages, analysis, contactInfo}, null, 2)
//     );
    
//     // Save reports
//     fs.writeFileSync(
//       `${outputDir}/team_report_${conversationId}_${timestamp}.md`,
//       teamReport
//     );
    
//     fs.writeFileSync(
//       `${outputDir}/client_report_${conversationId}_${timestamp}.md`,
//       clientReport
//     );
    
//     console.log(`Successfully processed conversation ${conversationId}`);
//     console.log(`Reports saved to ${outputDir} directory`);
    
//     return {
//       success: true,
//       isSuccessfulDeal: analysis.successStatus?.toLowerCase().includes('yes') || false,
//       reportPaths: {
//         conversation: `${outputDir}/conversation_${conversationId}_${timestamp}.json`,
//         teamReport: `${outputDir}/team_report_${conversationId}_${timestamp}.md`,
//         clientReport: `${outputDir}/client_report_${conversationId}_${timestamp}.md`
//       }
//     };
    
//   } catch (error) {
//     console.error('Error processing conversation:', error);
//     return {
//       success: false,
//       error: error.message
//     };
//   }
// }

// /**
//  * Process multiple conversations
//  * @param {Array} conversationIds - Array of GHL conversation IDs
//  */
// async function processMultipleConversations(conversationIds) {
//   const results = [];
  
//   for (const id of conversationIds) {
//     console.log(`\n--- Processing conversation ${id} ---\n`);
//     const result = await processConversation(id);
//     results.push({
//       conversationId: id,
//       ...result
//     });
//   }
  
//   // Save summary of all results
//   fs.writeFileSync(
//     './reports/processing_summary.json',
//     JSON.stringify(results, null, 2)
//   );
  
//   console.log('\n--- Processing complete ---');
//   console.log(`Processed ${results.length} conversations`);
//   console.log(`Successful: ${results.filter(r => r.success).length}`);
//   console.log(`Failed: ${results.filter(r => !r.success).length}`);
// }

// // Example usage
// const conversationIds = [
//   'rVdnz5R3vDQlwVkDq2rZ',
//   "Syv909QV0Cc23J06gsPr"
//   // Add more conversation IDs as needed
// ];

// processMultipleConversations(conversationIds)
//   .catch(err => console.error('Fatal error:', err));
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { OpenAI } = require('openai');

// Load environment variables
const GHL_API_KEY = process.env.GHL_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});
/**
 * Fetches conversation messages from GHL API
 * @param {string} conversationId - The GHL conversation ID
 * @returns {Array} - Array of processed conversation messages
 */
async function getConversationData(conversationId) {
  try {
    console.log(`Fetching conversation ${conversationId}...`);
    
    const response = await axios.get(
      `https://services.leadconnectorhq.com/conversations/${conversationId}/messages`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-04-15'
        }
      }
    );
    
    // Handle different response structures
    let messages = [];
    
    if (Array.isArray(response.data)) {
      messages = response.data;
    } else if (response.data?.messages && Array.isArray(response.data.messages)) {
      messages = response.data.messages;
    } else if (response.data?.messages?.messages && Array.isArray(response.data.messages.messages)) {
      messages = response.data.messages.messages;
    } else {
      throw new Error(`Unsupported response format: ${JSON.stringify(response.data)}`);
    }
    
    // Get contact info if available
    let contactInfo = null;
    if (response.data?.contact) {
      contactInfo = {
        name: response.data.contact.name || 'Unknown',
        email: response.data.contact.email || 'Not provided',
        phone: response.data.contact.phone || 'Not provided'
      };
    }
    
    // Process messages
    const validMessages = messages
      .filter(msg => 
        msg.direction &&
        msg.body &&
        typeof msg.body === 'string' &&
        msg.body !== '> Voice Note <' &&
        !msg.attachments?.length
      )
      .map(msg => ({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.body.trim(),
        timestamp: msg.dateAdded
      }));
    
    console.log(`Processed ${validMessages.length} valid messages`);
    
    return {
      messages: validMessages,
      contactInfo: contactInfo
    };
  } catch (error) {
    console.error('Error fetching conversation data:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}

/**
 * Analyzes conversation using OpenAI to determine success and extract insights
 * @param {Array} messages - Processed conversation messages
 * @returns {Object} - Analysis results including success status and insights
 */
async function analyzeConversation(messages) {
  try {
    console.log('Analyzing conversation with OpenAI...');
    
    const formattedMessages = [
      {
        role: 'system',
        content: `You are an expert conversation analyzer. Analyze this conversation and provide concise insights in this exact JSON format:
        {
          "successStatus": "yes/no/partial",
          "keyPoints": ["bullet point 1", "bullet point 2"],
          "customerSentiment": "positive/neutral/negative",
          "improvementAreas": ["brief area 1", "brief area 2"],
          "nextSteps": ["brief action 1", "brief action 2"]
        }
        
        Keep each bullet point under 10 words. Be extremely concise.`
      },
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: formattedMessages,
      response_format: { type: 'json_object' },
      temperature: 0.2
    });
    
    const analysis = JSON.parse(response.choices[0].message.content);
    console.log('Analysis complete');
    
    return analysis;
  } catch (error) {
    console.error('Error analyzing conversation:', error.message);
    throw error;
  }
}


/**
 * Generates a client-facing report focused solely on lead qualification
 * @param {Array} messages - Processed conversation messages
 * @param {Object} contactInfo - Customer contact information
 * @returns {string} - Formatted client report with lead status
 */
async function generateClientReport(messages, contactInfo) {
  try {
    console.log('Generating client report...');

    const conversationDate = messages.length > 0 
      ? new Date(messages[0].timestamp).toLocaleDateString() 
      : 'Unknown date';
    
    const prompt = [
      {
        role: 'system',
        content: `Determine the lead qualification status from this conversation. Respond with ONLY this JSON format:
        {
          "status": "Interested - Ready to proceed" | "Interested - Needs follow-up" | 
                   "Warm - Potential but not ready" | "Not interested - Closed" | 
                   "Unclear - Needs more info",
          "keyReason": "1-sentence explanation for the status"
        }`
      },
      {
        role: 'user',
        content: `Conversation with ${contactInfo?.name || 'Lead'} on ${conversationDate}:
        ${JSON.stringify(messages)}`
      }
    ];
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: prompt,
      response_format: { type: 'json_object' },
      temperature: 0.3
    });
    
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Error generating client report:', error.message);
    throw error;
  }
}

/**
 * Generates a merged report for multiple conversations
 * @param {Array} reports - Array of report objects
 * @returns {string} - Merged report in Markdown format
 */
async function generateMergedReport(reports) {
  try {
    console.log('Generating merged report...');
    
    // Count statuses
    const statusCounts = reports.reduce((acc, report) => {
      acc[report.status] = (acc[report.status] || 0) + 1;
      return acc;
    }, {});
    
    // Create markdown report
    let markdown = `# Merged Lead Status Report\n`;
    markdown += `**Generated on**: ${new Date().toLocaleDateString()}\n\n`;
    
    // Summary section
    markdown += `## Summary\n`;
    markdown += `- Total conversations analyzed: ${reports.length}\n`;
    for (const [status, count] of Object.entries(statusCounts)) {
      markdown += `- ${status}: ${count} (${Math.round((count/reports.length)*100)}%)\n`;
    }
    markdown += '\n';
    
    // Detailed breakdown
    markdown += `## Lead Details\n`;
    markdown += `| Contact | Status | Key Reason |\n`;
    markdown += `|---------|--------|------------|\n`;
    
    reports.forEach(report => {
      markdown += `| ${report.contactInfo?.name || 'Unknown'} `;
      markdown += `| ${report.status} `;
      markdown += `| ${report.keyReason} |\n`;
    });
    
    return markdown;
  } catch (error) {
    console.error('Error generating merged report:', error.message);
    throw error;
  }
}

/**
 * Process multiple conversations and generate merged reports
 * @param {Array} conversationIds - Array of GHL conversation IDs
 */
async function processMultipleConversations(conversationIds) {
  const individualReports = [];
  
  // Process each conversation
  for (const id of conversationIds) {
    console.log(`\n--- Processing conversation ${id} ---\n`);
    
    try {
      // 1. Get conversation data
      const { messages, contactInfo } = await getConversationData(id);
      
      if (messages.length === 0) {
        console.warn('No valid messages found in conversation');
        continue;
      }
      
      // 2. Generate client report (lead status)
      const clientReport = await generateClientReport(messages, contactInfo);
      
      // 3. Save individual report data
      individualReports.push({
        conversationId: id,
        contactInfo,
        ...clientReport
      });
      
      console.log(`Processed conversation ${id}: ${clientReport.status}`);
      
    } catch (error) {
      console.error(`Error processing conversation ${id}:`, error.message);
      individualReports.push({
        conversationId: id,
        error: error.message
      });
    }
  }
  
  // 4. Generate merged reports
  const outputDir = './reports';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Save individual reports
  fs.writeFileSync(
    `${outputDir}/individual_reports_${timestamp}.json`,
    JSON.stringify(individualReports, null, 2)
  );
  
  // Generate and save merged report
  if (individualReports.length > 0) {
    const mergedReport = await generateMergedReport(individualReports.filter(r => !r.error));
    fs.writeFileSync(
      `${outputDir}/merged_lead_report_${timestamp}.md`,
      mergedReport
    );
  }
  
  console.log('\n--- Processing complete ---');
  console.log(`Total conversations processed: ${conversationIds.length}`);
  console.log(`Successfully analyzed: ${individualReports.filter(r => !r.error).length}`);
  console.log(`Failed: ${individualReports.filter(r => r.error).length}`);
  console.log(`Reports saved to ${outputDir} directory`);
}

// Example usage
const conversationIds = [
  'rVdnz5R3vDQlwVkDq2rZ',
  'Syv909QV0Cc23J06gsPr'
  // Add more conversation IDs as needed
];

processMultipleConversations(conversationIds)
  .catch(err => console.error('Fatal error:', err));