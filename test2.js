const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mime = require('mime-types');

const API_KEY = 'AIzaSyCdhla-NJKsA5SgP2UUgUbI3BXozfZSdSs';
const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

const imagePath = path.join(__dirname, 'images', 'ww.png');

// Encode image to base64
function encodeImageToBase64(filePath) {
  const imageData = fs.readFileSync(filePath);
  return imageData.toString('base64');
}

async function generateImageContent() {
  const base64Image = encodeImageToBase64(imagePath);
  const mimeType = mime.lookup(imagePath); // returns 'image/webp' or similar

  const requestBody = {
    contents: [
      {
        parts: [
          { text: "Change the color of this car to red." },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          }
        ]
      }
    ]
  };

  try {
    const response = await axios.post(MODEL_URL, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Request failed:', error.response?.data || error.message);
  }
}

generateImageContent();
