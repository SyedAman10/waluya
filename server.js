require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const GHL_API_KEY = process.env.GHL_API_KEY;

async function getTrainingData(conversationId) {
  try {
    // 1. Fetch conversation with debug logging
    const response = await axios.get(
      `https://services.leadconnectorhq.com/conversations/${conversationId}/messages`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-04-15'
        }
      }
    );

    console.log('Raw API response:', JSON.stringify(response.data, null, 2)); // Debug log

    // 2. Handle different response structures
    let messages = [];
    
    // Structure 1: Direct array response
    if (Array.isArray(response.data)) {
      messages = response.data;
    } 
    // Structure 2: Nested messages object
    else if (response.data?.messages && Array.isArray(response.data.messages)) {
      messages = response.data.messages;
    }
    // Structure 3: Paginated response
    else if (response.data?.messages?.messages && Array.isArray(response.data.messages.messages)) {
      messages = response.data.messages.messages;
    }
    else {
      throw new Error(`Unsupported response format: ${JSON.stringify(response.data)}`);
    }

    // 3. Process messages
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
        content: msg.body.replace(/\n/g, ' ').trim(),
        timestamp: msg.dateAdded
      }));

    // 4. Create conversation pairs
    const conversationPairs = [];
    for (let i = 0; i < validMessages.length - 1; i++) {
      if (validMessages[i].role === 'user' && validMessages[i+1].role === 'assistant') {
        conversationPairs.push({
          messages: [
            validMessages[i],
            validMessages[i+1]
          ]
        });
      }
    }

    console.log(`Processed ${conversationPairs.length} conversation pairs`);
    return conversationPairs;

  } catch (error) {
    console.error('Full error context:', {
      message: error.message,
      config: error.config,
      response: {
        status: error.response?.status,
        data: error.response?.data
      },
      stack: error.stack
    });
    throw error;
  }
}

// Test with error handling
getTrainingData('Syv909QV0Cc23J06gsPr')
  .then(data => {
    if (data && data.length > 0) {
      fs.writeFileSync('training_data.jsonl', 
        data.map(JSON.stringify).join('\n')
      );
      console.log('Training file created successfully');
    } else {
      console.warn('No valid conversation pairs found');
    }
  })
  .catch(err => console.error('Final error:', err.message));