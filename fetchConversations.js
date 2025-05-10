// fetchConversations.js
const axios = require('axios');
const { API_BASE, API_VERSION, ACCESS_TOKEN, LOCATION_ID, CONTACT_ID } = require('./config');

async function fetchConversationIds(limit = 10, page = 1) {
  try {
    const response = await axios.get(`${API_BASE}/conversations/search`, {
      headers: {
        Authorization: ACCESS_TOKEN,
        Version: API_VERSION
      },
      params: {
        limit,
        page,
        locationId: LOCATION_ID,   // Add Location ID here
        contactId: CONTACT_ID      // Add Contact ID here
      }
    });

    const conversations = response.data?.conversations || [];

    // Filter for active, unique, non-deleted conversations
    const uniqueIds = new Set();
    const selected = [];

    for (const convo of conversations) {
      if (!convo.deleted && convo.id && !uniqueIds.has(convo.id)) {
        uniqueIds.add(convo.id);
        selected.push(convo.id);
        if (selected.length >= limit) break;
      }
    }

    return selected;

  } catch (error) {
    console.error('❌ Failed to fetch conversations:', error.response?.data || error.message);
    return [];
  }
}

// Only run if executed directly
if (require.main === module) {
  fetchConversationIds(10).then((ids) => {
    console.log('✅ Fetched Conversation IDs:', ids);
  });
}

module.exports = fetchConversationIds;
