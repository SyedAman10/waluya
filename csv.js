
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { OpenAI } = require('openai');
const { sendClientReportEmail, sendTeamReportEmail } = require('./emailsend');

// Load environment variables
const GHL_API_KEY = process.env.GHL_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// Email configuration
const ENABLE_CLIENT_EMAILS = process.env.ENABLE_CLIENT_EMAILS === 'true';
const ENABLE_TEAM_EMAILS = process.env.ENABLE_TEAM_EMAILS === 'true';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/**
 * Fetches contact information from GHL API
 * @param {string} contactId - The GHL contact ID
 * @returns {Object} - Contact information including name, email, phone, and country
 */
async function getContactInfo(contactId) {
  try {
    console.log(`\n=== MAKING CONTACT API CALL ===`);
    console.log(`API ENDPOINT: https://services.leadconnectorhq.com/contacts/${contactId}`);
    console.log(`HEADERS: Authorization: Bearer ${GHL_API_KEY.substring(0, 5)}... (truncated for security)`);
    console.log(`=================================\n`);
    
    const response = await axios.get(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-04-15'
        }
      }
    );
    
    console.log(`\n=== CONTACT API RESPONSE ===`);
    console.log(`STATUS: ${response.status}`);
    console.log(`HEADERS: ${JSON.stringify(response.headers)}`);
    console.log(`FULL RESPONSE BODY:`);
    console.log(JSON.stringify(response.data, null, 2));
    console.log(`============================\n`);
    
    // The contact data is nested inside a 'contact' property
    const contactData = response.data.contact || response.data;
    
    // Extract relevant contact information
    const contactInfo = {
      name: contactData.firstName || contactData.fullName || 'Unknown',
      email: contactData.email,
      phone: contactData.phone,
      country: contactData.country
    };
    
    console.log(`\n=== FORMATTED CONTACT INFO ===`);
    console.log(JSON.stringify(contactInfo, null, 2));
    console.log(`==============================\n`);
    
    return contactInfo;
    
  } catch (error) {
    console.error('\n=== CONTACT API ERROR ===');
    console.error(`ERROR MESSAGE: ${error.message}`);
    console.error(`STATUS CODE: ${error.response?.status || 'N/A'}`);
    console.error(`ERROR RESPONSE DATA:`);
    console.error(error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'No response data');
    console.error(`=========================\n`);
    
    return {
      name: 'Unknown',
      email: 'Not provided',
      phone: 'Not provided',
      country: 'Unknown'
    };
  }
}

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
    let contactId = null;

    if (Array.isArray(response.data)) {
      messages = response.data;
    } else if (response.data?.messages && Array.isArray(response.data.messages)) {
      messages = response.data.messages;
      contactId = response.data.contact?.id;
    } else if (response.data?.messages?.messages && Array.isArray(response.data.messages.messages)) {
      messages = response.data.messages.messages;
      contactId = response.data.contact?.id;
      console.log(messages);
    } else {
      throw new Error(`Unsupported response format: ${JSON.stringify(response.data)}`);
    }

    // Extract contact ID if available from response.data.contact
    if (!contactId && response.data?.contact?.id) {
      contactId = response.data.contact.id;
    }
    
    // If still no contactId, try to extract it from the first message
    if (!contactId && messages.length > 0 && messages[0].contactId) {
      contactId = messages[0].contactId;
      console.log(`\n=== CONTACT ID EXTRACTED FROM MESSAGE ===`);
      console.log(`CONTACT ID: ${contactId}`);
      console.log(`=========================================\n`);
    }

    // Get contact info using the contact ID
    let contactInfo = null;
    if (contactId) {
      console.log(`\n=== EXTRACTED CONTACT ID ===`);
      console.log(`CONTACT ID: ${contactId}`);
      console.log(`============================\n`);
      contactInfo = await getContactInfo(contactId);
    } else {
      console.log(`\n=== WARNING: NO CONTACT ID FOUND ===`);
      console.log(`Using default contact information`);
      console.log(`==================================\n`);
      contactInfo = {
        name: 'Unknown',
        email: 'Not provided',
        phone: 'Not provided',
        country: 'Unknown'
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
 * Generates an internal team report with actionable insights
 * @param {Array} messages - Processed conversation messages
 * @param {Object} analysis - Results from OpenAI analysis
 * @param {Object} contactInfo - Customer contact information
 * @returns {string} - Formatted internal report
 */
async function generateTeamReport(messages, analysis, contactInfo) {
    try {
      console.log('Generating team report...');
  
      const prompt = [
        {
          role: 'system',
          content: `Generate a BRIEF internal team report (MAX 15 lines) with this structure:
  
  # Conversation Summary
  - Client: [name/country]
  - Outcome: [success/partial/failure]
  - Key topics: [3-5 topics]
  
  # Performance Assessment
  - Strengths: [1-2 bullet points]
  - Areas to Improve: [1-2 bullet points]
  
  # Recommended Actions
  - [1-2 specific actions]
  
  Keep each point under 10 words. No fluff.`
        },
        {
          role: 'user',
          content: `Contact Info: ${JSON.stringify(contactInfo)}
  Conversation messages: ${JSON.stringify(messages)}
  Analysis: ${JSON.stringify(analysis)}`
        }
      ];
  
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: prompt,
        temperature: 0.3
      });
  
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error generating team report:', error.message);
      throw error;
    }
  }
  
  /**
   * Generates a client-facing report with conversation summary
   * @param {Array} messages - Processed conversation messages
   * @param {Object} analysis - Results from OpenAI analysis
   * @param {Object} contactInfo - Customer contact information
   * @returns {string} - Formatted client report
   */
  async function generateClientReport(messages, analysis, contactInfo) {
    try {
      console.log('Generating client report...');
  
      const conversationDate = messages.length > 0
        ? new Date(messages[0].timestamp).toLocaleDateString()
        : 'Unknown date';
  
      const prompt = [
        {
          role: 'system',
          content: `Determine the lead qualification status from this conversation. ONLY respond with ONE of these statuses:
  - "Interested - Ready to proceed"
  - "Interested - Needs follow-up"
  - "Warm - Potential but not ready"
  - "Not interested - Closed"
  - "Unclear - Needs more info"
  `
        },
        {
          role: 'user',
          content: `Conversation with ${contactInfo?.name || 'Lead'} from ${contactInfo?.country || 'Unknown'} on ${conversationDate}:
  ${JSON.stringify(messages)}`
        }
      ];
  
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: prompt,
        temperature: 0.3
      });
  
      return `Lead Status: ${response.choices[0].message.content}
  Lead Name: ${contactInfo?.name || 'Unknown'}
  Lead Country: ${contactInfo?.country || 'Unknown'}
  Lead Phone: ${contactInfo?.phone || 'Not provided'}
  Lead Email: ${contactInfo?.email || 'Not provided'}`;
    } catch (error) {
      console.error('Error generating client report:', error.message);
      throw error;
    }
  }
  
/**
 * Generates a merged team report for multiple conversations
 * @param {Array} results - Array of processing results from individual conversations
 * @returns {string} - Formatted merged team report
 */
async function generateMergedTeamReport(results) {
    try {
      console.log('Generating merged team report...');
  
      // Prepare input data for the AI
      const conversationsData = results.map(result => ({
        contactInfo: result.contactInfo,
        analysis: result.analysis,
        messageCount: result.messages.length
      }));
  
      const prompt = [
        {
          role: 'system',
          content: `Generate a CONCISE merged team report for multiple conversations with this structure:
  
  # Overview
  - Total conversations: [number]
  - Success rate: [percentage]
  - Common themes: [3-5 topics]
  
  # Performance Highlights
  - Top strengths: [2-3 bullet points]
  - Common improvement areas: [2-3 bullet points]
  
  # Client Insights
  [For each client, 1 line summary:
  - [Client Name]: [status] - [key point]]
  
  # Recommended Actions
  - [2-3 priority actions]
  
  Keep each point under 10 words. No fluff.`
        },
        {
          role: 'user',
          content: `Conversations data: ${JSON.stringify(conversationsData)}`
        }
      ];
  
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: prompt,
        temperature: 0.3
      });
  
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error generating merged team report:', error.message);
      throw error;
    }
  }
  
  /**
   * Generates a merged client report for multiple conversations
   * @param {Array} results - Array of processing results from individual conversations
   * @returns {string} - Formatted merged client report
   */
  async function generateMergedClientReport(results) {
    try {
      console.log('Generating merged client report...');
  
      // Prepare input data for the AI
      const clientData = results.map(result => ({
        contactInfo: result.contactInfo,
        status: result.clientReport.split('\n')[0].replace('Lead Status: ', ''),
        keyPoints: result.analysis.keyPoints
      }));
  
      const prompt = [
        {
          role: 'system',
          content: `Generate a CLEAN merged client report with this structure:
  
  # Client Overview
  - Total clients: [number]
  - Status distribution:
    - Ready to proceed: [count]
    - Needs follow-up: [count]
    - Warm leads: [count]
    - Not interested: [count]
  
  # Client Details
  [For each client:
  - [Name] ([Country])
    - Status: [status]
    - Contact: [email/phone]]
  
  Keep it professional and concise.`
        },
        {
          role: 'user',
          content: `Client data: ${JSON.stringify(clientData)}`
        }
      ];
  
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: prompt,
        temperature: 0.3
      });
  
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error generating merged client report:', error.message);
      throw error;
    }
  }
  
  /**
   * Process multiple conversations and generate merged reports
   * @param {Array} conversationIds - Array of GHL conversation IDs
   */
  async function processMultipleConversations(conversationIds) {
    const results = [];
    const outputDir = './reports';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
    // Process each conversation individually
    for (const id of conversationIds) {
      console.log(`\n--- Processing conversation ${id} ---\n`);
      try {
        // 1. Get conversation data
        const { messages, contactInfo } = await getConversationData(id);
  
        if (messages.length === 0) {
          console.warn('No valid messages found in conversation');
          results.push({
            conversationId: id,
            success: false,
            error: 'No valid messages'
          });
          continue;
        }
  
        // 2. Analyze conversation
        const analysis = await analyzeConversation(messages);
  
        // 3. Generate individual reports
        const teamReport = await generateTeamReport(messages, analysis, contactInfo);
        const clientReport = await generateClientReport(messages, analysis, contactInfo);
  
        // Save individual results
        results.push({
          conversationId: id,
          success: true,
          messages,
          contactInfo,
          analysis,
          teamReport,
          clientReport,
          isSuccessfulDeal: analysis.successStatus?.toLowerCase().includes('yes') || false
        });
  
        console.log(`Successfully processed conversation ${id}`);
      } catch (error) {
        console.error(`Error processing conversation ${id}:`, error.message);
        results.push({
          conversationId: id,
          success: false,
          error: error.message
        });
      }
    }
  
    // Generate and save merged reports if we have successful results
    if (results.some(r => r.success)) {
      // Generate merged reports
      const mergedTeamReport = await generateMergedTeamReport(results.filter(r => r.success));
      const mergedClientReport = await generateMergedClientReport(results.filter(r => r.success));
  
      // Save merged reports
      const mergedTeamReportPath = `${outputDir}/merged_team_report_${timestamp}.md`;
      fs.writeFileSync(mergedTeamReportPath, mergedTeamReport);
  
      const mergedClientReportPath = `${outputDir}/merged_client_report_${timestamp}.md`;
      fs.writeFileSync(mergedClientReportPath, mergedClientReport);
  
      // Save processing summary
      const summary = {
        timestamp,
        totalConversations: conversationIds.length,
        successfulConversations: results.filter(r => r.success).length,
        failedConversations: results.filter(r => !r.success).length,
        mergedReportPaths: {
          team: mergedTeamReportPath,
          client: mergedClientReportPath
        }
      };
  
      fs.writeFileSync(
        `${outputDir}/processing_summary_${timestamp}.json`,
        JSON.stringify(summary, null, 2)
      );
  
      console.log('\n--- Processing complete ---');
      console.log(`Processed ${conversationIds.length} conversations`);
      console.log(`Successful: ${summary.successfulConversations}`);
      console.log(`Failed: ${summary.failedConversations}`);
      console.log(`Merged reports saved to:\n- ${mergedTeamReportPath}\n- ${mergedClientReportPath}`);
  
      // Send emails if enabled
      if (ENABLE_TEAM_EMAILS) {
        console.log('Sending merged team report email...');
        await sendTeamReportEmail(
          mergedTeamReportPath,
          'Multiple Conversations',
          summary
        );
      }
  
      if (ENABLE_CLIENT_EMAILS) {
        console.log('Sending merged client report email...');
        await sendClientReportEmail(
          mergedClientReportPath,
          { name: 'Multiple Clients' },
          'Multiple Conversations'
        );
      }
    } else {
      console.error('No conversations were successfully processed');
    }
  
    return results;
  }

/**
 * Main function to process a conversation and generate reports
 * @param {string} conversationId - The GHL conversation ID
 */
async function processConversation(conversationId) {
  try {
    console.log(`Starting to process conversation: ${conversationId}`);

    // 1. Get conversation data
    const { messages, contactInfo } = await getConversationData(conversationId);

    if (messages.length === 0) {
      console.warn('No valid messages found in conversation');
      return;
    }

    // 2. Analyze conversation
    const analysis = await analyzeConversation(messages);

    // 3. Generate reports
    const teamReport = await generateTeamReport(messages, analysis, contactInfo);
        const clientReport = await generateClientReport(messages, analysis, contactInfo);

    // 4. Save results
    const outputDir = './reports';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Save conversation data
    fs.writeFileSync(
      `${outputDir}/conversation_${conversationId}_${timestamp}.json`,
      JSON.stringify({messages, analysis, contactInfo}, null, 2)
    );

    // Save reports
    const teamReportPath = `${outputDir}/team_report_${conversationId}_${timestamp}.md`;
    fs.writeFileSync(teamReportPath, teamReport);

    const clientReportPath = `${outputDir}/client_report_${conversationId}_${timestamp}.md`;
    fs.writeFileSync(clientReportPath, clientReport);

    console.log(`Successfully processed conversation ${conversationId}`);
    console.log(`Reports saved to ${outputDir} directory`);

    // 5. Send emails if enabled
    const emailResults = {
      clientEmail: null,
      teamEmail: null
    };

    if (ENABLE_CLIENT_EMAILS) {
      console.log('Sending client report email...');
      emailResults.clientEmail = await sendClientReportEmail(
        clientReportPath, 
        contactInfo, 
        conversationId
      );
    } else {
      console.log('Client emails disabled. Skipping client email.');
    }

    if (ENABLE_TEAM_EMAILS) {
      console.log('Sending team report email...');
      emailResults.teamEmail = await sendTeamReportEmail(
        teamReportPath,
        conversationId,
        contactInfo
      );
    } else {
      console.log('Team emails disabled. Skipping team email.');
    }

    return {
      success: true,
      isSuccessfulDeal: analysis.successStatus?.toLowerCase().includes('yes') || false,
      reportPaths: {
        conversation: `${outputDir}/conversation_${conversationId}_${timestamp}.json`,
        teamReport: teamReportPath,
        clientReport: clientReportPath
      },
      emailResults
    };

  } catch (error) {
    console.error('Error processing conversation:', error);
    return {
      success: false,
      error: error.message
    };
  }
}/**
 * Process multiple conversations and generate merged reports
 * @param {Array} conversationIds - Array of GHL conversation IDs
 */
async function processMultipleConversations(conversationIds) {
    const results = [];
    const outputDir = './reports';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
    // Process each conversation individually
    for (const id of conversationIds) {
      console.log(`\n--- Processing conversation ${id} ---\n`);
      try {
        // 1. Get conversation data
        const { messages, contactInfo } = await getConversationData(id);
  
        if (messages.length === 0) {
          console.warn('No valid messages found in conversation');
          results.push({
            conversationId: id,
            success: false,
            error: 'No valid messages'
          });
          continue;
        }
  
        // 2. Analyze conversation
        const analysis = await analyzeConversation(messages);
  
        // 3. Generate individual reports
        const teamReport = await generateTeamReport(messages, analysis, contactInfo);
        const clientReport = await generateClientReport(messages, analysis, contactInfo);
  
        // Save individual results
        results.push({
          conversationId: id,
          success: true,
          messages,
          contactInfo,
          analysis,
          teamReport,
          clientReport,
          isSuccessfulDeal: analysis.successStatus?.toLowerCase().includes('yes') || false
        });
  
        console.log(`Successfully processed conversation ${id}`);
      } catch (error) {
        console.error(`Error processing conversation ${id}:`, error.message);
        results.push({
          conversationId: id,
          success: false,
          error: error.message
        });
      }
    }
  
    // Generate and save merged reports if we have successful results
    if (results.some(r => r.success)) {
      // Generate merged reports
      const mergedTeamReport = await generateMergedTeamReport(results.filter(r => r.success));
      const mergedClientReport = await generateMergedClientReport(results.filter(r => r.success));
  
      // Save merged reports
      const mergedTeamReportPath = `${outputDir}/merged_team_report_${timestamp}.md`;
      fs.writeFileSync(mergedTeamReportPath, mergedTeamReport);
  
      const mergedClientReportPath = `${outputDir}/merged_client_report_${timestamp}.md`;
      fs.writeFileSync(mergedClientReportPath, mergedClientReport);
  
      // Save processing summary
      const summary = {
        timestamp,
        totalConversations: conversationIds.length,
        successfulConversations: results.filter(r => r.success).length,
        failedConversations: results.filter(r => !r.success).length,
        mergedReportPaths: {
          team: mergedTeamReportPath,
          client: mergedClientReportPath
        }
      };
  
      fs.writeFileSync(
        `${outputDir}/processing_summary_${timestamp}.json`,
        JSON.stringify(summary, null, 2)
      );
  
      console.log('\n--- Processing complete ---');
      console.log(`Processed ${conversationIds.length} conversations`);
      console.log(`Successful: ${summary.successfulConversations}`);
      console.log(`Failed: ${summary.failedConversations}`);
      console.log(`Merged reports saved to:\n- ${mergedTeamReportPath}\n- ${mergedClientReportPath}`);
  
      // Send emails if enabled
      if (ENABLE_TEAM_EMAILS) {
        console.log('Sending merged team report email...');
        await sendTeamReportEmail(
          mergedTeamReportPath,
          'Multiple Conversations',
          summary
        );
      }
  
      if (ENABLE_CLIENT_EMAILS) {
        console.log('Sending merged client report email...');
        await sendClientReportEmail(
          mergedClientReportPath,
          { name: 'Client_name' },
          'Multiple Conversations'
        );
        // After saving merged reports
if (ENABLE_TEAM_EMAILS && mergedTeamReportPath) {
    const { processImprovements } = require('./processImprovements');
    await processImprovements(mergedTeamReportPath);
  }
      }
    } else {
      console.error('No conversations were successfully processed');
    }
  
    return results;
  }
  // Example usage remains the same
  const conversationIds = [
    'rVdnz5R3vDQlwVkDq2rZ',
    "Syv909QV0Cc23J06gsPr"
    // Add more conversation IDs as needed
  ];
  // Example usage

  processMultipleConversations(conversationIds)
    .then(results => console.log(`Processing complete. ${results.filter(r => r.success).length} successful`))
    .catch(err => console.error('Fatal error:', err));