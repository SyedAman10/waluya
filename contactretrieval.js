require('dotenv').config(); // If you're using a .env file
const axios = require('axios');

// Your existing function
async function getGHLContact(contactId) {
    const url = `https://services.leadconnectorhq.com/contacts/${contactId}`;
    
    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${process.env.GHL_API_KEY}`,
                'Version': '2021-04-15'
            },
        });

        const contact = response.data.contact;
        console.log("Fetched contact:", contact);

        return {
            name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
            email: contact.email,
            phone: contact.phone,
        };
    } catch (err) {
        console.error("Failed to fetch contact:", err.response?.data || err.message);
        return null;
    }
}

// Test function
(async () => {
    const contactId = '2J0GIDYByyBxRMz5ci4w'; // Replace with a valid ID
    const contactInfo = await getGHLContact(contactId);
    
    if (contactInfo) {
        console.log("Formatted contact info:", contactInfo);
    } else {
        console.log("No contact info returned.");
    }
})();
