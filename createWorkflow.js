require('dotenv').config();
const axios = require('axios');

const VAPI_TOKEN = process.env.VAPI_TOKEN;
const SERVER_URL = process.env.SERVER_URL; // your server URL


async function createWorkflow() {
  try {
    const response = await axios.post('https://api.vapi.ai/workflow', {
      name: 'Book Appointment Workflow',
      nodes: [
        {
          type: 'start',
          name: 'start'
        },
        {
          type: 'gather',
          name: 'gather_appointment_details',
          output: {
            type: 'object',
            properties: {
              appointment_date: {
                type: 'string'
              },
              appointment_time: {
                type: 'string'
              },
              appointment_title: {
                type: 'string'
              }
            },
            required: ['appointment_date', 'appointment_time', 'appointment_title']
          },
          literalTemplate: 'Please tell me the appointment date, time, and title.'
        },
        {
          type: 'apiRequest',
          name: 'create_calendar_event',
          method: 'POST',
          mode: 'blocking',
          url: `${SERVER_URL}/book-appointment`,
          body: {
            date: '{{gather_appointment_details.appointment_date}}',
            time: '{{gather_appointment_details.appointment_time}}',
            title: '{{gather_appointment_details.appointment_title}}'
          },
          headers: {
            'Content-Type': 'application/json'
          }
        },
        {
          type: 'say',
          name: 'confirm_booking',
          prompt: 'Your appointment has been successfully booked!'
        }
      ],
      edges: [
        { from: 'start', to: 'gather_appointment_details' },
        { from: 'gather_appointment_details', to: 'create_calendar_event' },
        { from: 'create_calendar_event', to: 'confirm_booking' }
      ]
    }, {
      headers: {
        Authorization: `Bearer ${VAPI_TOKEN}`,
      }
    });

    console.log('✅ Workflow created successfully:', response.data);
  } catch (error) {
    console.error('❌ Error creating workflow:', error.response?.data || error.message);
  }
}

createWorkflow();
