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
    
    // Debug log (optional)
    // console.log('Raw API response:', JSON.stringify(response.data, null, 2));
    
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
 * Analyzes conversation using OpenAI to determine success and extract specific insights
 * @param {Array} messages - Processed conversation messages
 * @returns {Object} - Structured analysis results
 */
async function analyzeConversation(messages) {
  try {
    console.log('Analyzing conversation with OpenAI...');
    
    // Format messages for OpenAI API
    const formattedMessages = [
      {
        role: 'system',
        content: `You are a strict, precise conversation analyzer specialized in sales and support conversations.
        Extract ONLY the following data points from the conversation in a structured format:
        
        1. successStatus: "Success" or "Failure" - Be strict about this classification
        2. clientName: Extract the client's full name from the conversation. This is critically important.
        3. clientBusiness: Extract business name if mentioned
        4. primaryNeed: One sentence about client's main need/problem (20 words max)
        5. keyOutcome: Brief outcome of conversation (10 words max)
        6. followUpNeeded: "Yes" or "No"
        7. priorityLevel: "High", "Medium", or "Low" based on conversation urgency
        8. improvementArea: Single most important area for improvement (15 words max)
        
        If any field cannot be determined with certainty, use "Unknown" - do not guess.
        Format the data in a structured JSON with these exact field names.`
      },
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];
    
    // Call OpenAI API for strict, focused analysis
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: formattedMessages,
      response_format: { type: 'json_object' },
      temperature: 0.1 // Lower temperature for more consistent results
    });
    
    const analysis = JSON.parse(response.choices[0].message.content);
    console.log('Analysis complete with specific data points extracted');
    
    return analysis;
  } catch (error) {
    console.error('Error analyzing conversation:', error.message);
    throw error;
  }
}

/**
 * Generates an internal team report in CSV format
 * @param {Array} messages - Processed conversation messages
 * @param {Object} analysis - Results from OpenAI analysis
 * @returns {string} - CSV formatted internal report
 */
async function generateTeamReport(messages, analysis) {
  try {
    console.log('Generating concise team report in CSV format...');
    
    // First, get additional specific metrics for team evaluation
    const prompt = [
      {
        role: 'system',
        content: `You are a precise conversation analyst who provides strict, data-driven feedback.
        Extract ONLY the following metrics from the conversation:
        
        1. responseTime: Average response time rating (1-5)
        2. solutionQuality: Quality of solution provided (1-5)
        3. empathyScore: Level of empathy shown (1-5)
        4. keyIssue: Single biggest issue with the conversation (10 words max)
        5. positiveHighlight: Best aspect of the conversation (10 words max)
        6. actionableImprovement: Most important specific improvement (15 words max)
        7. recommendedFollowUp: Brief next action (10 words max)
        
        Return ONLY these exact fields in JSON format. Be extremely concise.`
      },
      {
        role: 'user',
        content: `Analyze this conversation: ${JSON.stringify(messages.slice(0, 15))} 
        
        Initial analysis: ${JSON.stringify(analysis)}`
      }
    ];
    
    const evalResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: prompt,
      response_format: { type: 'json_object' },
      temperature: 0.1
    });
    
    const teamMetrics = JSON.parse(evalResponse.choices[0].message.content);
    
    // Combine with original analysis
    const combinedData = {
      ...analysis,
      ...teamMetrics,
      conversationId: messages[0]?.conversationId || 'unknown',
      messageCount: messages.length,
      date: new Date().toISOString().split('T')[0]
    };
    
    // Create CSV header and row
    const headers = Object.keys(combinedData).join(',');
    const values = Object.values(combinedData).map(value => {
      // Handle commas in values by wrapping in quotes
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
    
    return headers + '\n' + values;
  } catch (error) {
    console.error('Error generating team report:', error.message);
    throw error;
  }
}

/**
 * Generates a client-facing report in CSV format
 * @param {Array} messages - Processed conversation messages
 * @param {Object} analysis - Results from OpenAI analysis
 * @param {Object} contactInfo - Customer contact information
 * @returns {string} - CSV formatted client report
 */
async function generateClientReport(messages, analysis, contactInfo) {
  try {
    console.log('Generating concise client report in CSV format...');

    // Extract conversation date from first message
    const conversationDate = messages.length > 0 
      ? new Date(messages[0].timestamp).toLocaleDateString() 
      : 'Unknown date';
    
    // Use client name from analysis as priority, fallback to contactInfo
    const clientName = analysis.clientName || contactInfo?.name || 'Unknown';
    
    // Get additional specific client-relevant metrics
    const prompt = [
      {
        role: 'system',
        content: `You are a precise business analyst. Extract ONLY the following data points from the conversation:
        
        1. summaryOfDiscussion: Brief summary (20 words max)
        2. solutionProvided: Brief description of solution (20 words max)
        3. nextSteps: Specific next action (15 words max)
        4. clientPriority: Client's main priority (10 words max) 
        5. timelineDiscussed: Any timeline mentioned (e.g., "2 weeks", "Next quarter", "None mentioned")
        6. budgetDiscussed: Any budget discussed (e.g., "$500", "$1000-2000", "None mentioned")
        
        Return ONLY these exact fields in JSON format. Be extremely concise.`
      },
      {
        role: 'user',
        content: `Analyze this client conversation: ${JSON.stringify(messages.slice(0, 15))}`
      }
    ];
    
    const clientResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: prompt,
      response_format: { type: 'json_object' },
      temperature: 0.1
    });
    
    const clientMetrics = JSON.parse(clientResponse.choices[0].message.content);
    
    // Combine relevant client data
    const clientData = {
      clientName: clientName,
      businessName: analysis.clientBusiness || 'Not provided',
      conversationDate: conversationDate,
      successStatus: analysis.successStatus,
      primaryNeed: analysis.primaryNeed,
      summaryOfDiscussion: clientMetrics.summaryOfDiscussion,
      solutionProvided: clientMetrics.solutionProvided,
      nextSteps: clientMetrics.nextSteps,
      followUpRequired: analysis.followUpNeeded,
      clientPriority: clientMetrics.clientPriority,
      timeline: clientMetrics.timelineDiscussed,
      budget: clientMetrics.budgetDiscussed,
      conversationId: messages[0]?.conversationId || 'unknown',
      date: new Date().toISOString().split('T')[0]
    };
    
    // Create CSV header and row
    const headers = Object.keys(clientData).join(',');
    const values = Object.values(clientData).map(value => {
      // Handle commas in values by wrapping in quotes
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
    
    return headers + '\n' + values;
  } catch (error) {
    console.error('Error generating client report:', error.message);
    throw error;
  }
}

/**
 * Main function to process a conversation and generate CSV reports
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
    
    // Add conversation ID to messages for reference
    const messagesWithId = messages.map(msg => ({
      ...msg,
      conversationId: conversationId
    }));
    
    // 2. Analyze conversation with strict focus on client name extraction
    const analysis = await analyzeConversation(messagesWithId);
    
    // 3. Generate CSV reports
    const teamReportCSV = await generateTeamReport(messagesWithId, analysis);
    const clientReportCSV = await generateClientReport(messagesWithId, analysis, contactInfo);
    
    // 4. Save results
    const outputDir = process.env.OUTPUT_DIR || './reports';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Save conversation analysis data as JSON for reference
    fs.writeFileSync(
      `${outputDir}/analysis_${conversationId}_${timestamp}.json`, 
      JSON.stringify({
        conversationId,
        messageCount: messages.length,
        analysis,
        contactInfo
      }, null, 2)
    );
    
    // Save reports as CSV files
    // Check if team report CSV file exists to add headers only once
    const teamReportPath = `${outputDir}/team_reports.csv`;
    if (!fs.existsSync(teamReportPath)) {
      fs.writeFileSync(teamReportPath, teamReportCSV);
    } else {
      // Append only the data row without header
      const dataRow = teamReportCSV.split('\n')[1];
      if (dataRow) {
        fs.appendFileSync(teamReportPath, '\n' + dataRow);
      }
    }
    
    // Check if client report CSV file exists to add headers only once
    const clientReportPath = `${outputDir}/client_reports.csv`;
    if (!fs.existsSync(clientReportPath)) {
      fs.writeFileSync(clientReportPath, clientReportCSV);
    } else {
      // Append only the data row without header
      const dataRow = clientReportCSV.split('\n')[1];
      if (dataRow) {
        fs.appendFileSync(clientReportPath, '\n' + dataRow);
      }
    }
    
    console.log(`Successfully processed conversation ${conversationId}`);
    console.log(`Reports appended to CSV files in ${outputDir} directory`);
    
    // Return success status and report paths for further processing
    return {
      success: true,
      isSuccessfulDeal: analysis.successStatus === 'Success',
      clientName: analysis.clientName || 'Unknown',
      reportPaths: {
        analysis: `${outputDir}/analysis_${conversationId}_${timestamp}.json`,
        teamReport: teamReportPath,
        clientReport: clientReportPath
      }
    };
    
  } catch (error) {
    console.error('Error processing conversation:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process multiple conversations and generate consolidated CSV reports
 * @param {Array} conversationIds - Array of GHL conversation IDs
 */
async function processMultipleConversations(conversationIds) {
  const results = [];
  const outputDir = process.env.OUTPUT_DIR || './reports';
  
  // Create directories if they don't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  // Create summary CSV headers
  const summaryHeaders = 'conversationId,clientName,successStatus,messageCount,processingDate';
  fs.writeFileSync(`${outputDir}/processing_summary.csv`, summaryHeaders);
  
  for (const id of conversationIds) {
    console.log(`\n--- Processing conversation ${id} ---\n`);
    const result = await processConversation(id);
    
    if (result.success) {
      // Add to results array
      results.push({
        conversationId: id,
        clientName: result.clientName,
        isSuccessfulDeal: result.isSuccessfulDeal,
        ...result
      });
      
      // Add to summary CSV
      const summaryRow = `\n${id},${result.clientName || 'Unknown'},${result.isSuccessfulDeal ? 'Success' : 'Failure'},${result.messageCount || 'Unknown'},${new Date().toISOString().split('T')[0]}`;
      fs.appendFileSync(`${outputDir}/processing_summary.csv`, summaryRow);
    } else {
      // Log error in summary CSV
      const errorRow = `\n${id},Error,Error,Unknown,${new Date().toISOString().split('T')[0]}`;
      fs.appendFileSync(`${outputDir}/processing_summary.csv`, errorRow);
    }
  }
  
  console.log('\n--- Processing complete ---');
  console.log(`Processed ${results.length} conversations`);
  console.log(`Successful deals: ${results.filter(r => r.isSuccessfulDeal).length}`);
  console.log(`Failed deals: ${results.filter(r => r.success && !r.isSuccessfulDeal).length}`);
  console.log(`Processing errors: ${conversationIds.length - results.length}`);
  console.log(`\nAll reports saved to CSV files in ${outputDir} directory:`);
  console.log(`- ${outputDir}/team_reports.csv (Internal feedback)`);
  console.log(`- ${outputDir}/client_reports.csv (Client summaries)`);
  console.log(`- ${outputDir}/processing_summary.csv (Processing overview)`);
}

// Example usage
const conversationIds = [
  'Syv909QV0Cc23J06gsPr',
  // Add more conversation IDs as needed
];

processMultipleConversations(conversationIds)
  .catch(err => console.error('Fatal error:', err));