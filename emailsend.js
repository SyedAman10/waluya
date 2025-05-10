require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

/**
 * Configures and returns a Nodemailer transporter
 * @returns {Object} - Configured Nodemailer transporter
 */
function getEmailTransporter() {
  // Get email configuration from environment variables
  const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const EMAIL_PORT = process.env.EMAIL_PORT || 587;
  const EMAIL_USER = process.env.EMAIL_USER;
  const EMAIL_PASS = process.env.EMAIL_PASS;
  
  // Validate required email credentials
  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new Error('EMAIL_USER and EMAIL_PASS environment variables are required');
  }

  // Create transporter
  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465, // true for 465, false for other ports
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });
}

/**
 * Sends an email with the client report as an attachment
 * @param {string} reportPath - Path to the client report file
 * @param {Object} contactInfo - Contact information for the client
 * @param {string} conversationId - The conversation ID
 * @returns {Promise} - Email sending result
 */
async function sendClientReportEmail(reportPath, contactInfo, conversationId) {
  try {
    console.log(`\n=== PREPARING EMAIL FOR CLIENT REPORT ===`);
    console.log(`REPORT PATH: ${reportPath}`);
    console.log(`RECIPIENT: ${contactInfo.email || 'No email provided'}`);
    console.log(`=======================================\n`);

    // Check if report file exists
    if (!fs.existsSync(reportPath)) {
      throw new Error(`Client report file not found at: ${reportPath}`);
    }

    // Check if recipient email is available
   
    // Get file content
    const reportContent = fs.readFileSync(reportPath, 'utf-8');
    const fileName = path.basename(reportPath);

    // Get email configuration from environment variables
    const SENDER_EMAIL = process.env.SENDER_EMAIL || process.env.EMAIL_USER;
    const SENDER_NAME = process.env.SENDER_NAME || 'Customer Support';
    const EMAIL_CC = process.env.EMAIL_CC || '';
    const EMAIL_BCC = process.env.EMAIL_BCC || '';
    const CLIENT_EMAIL = process.env.CLIENT_EMAIL || '';
    // Create transporter
    const transporter = getEmailTransporter();

    // Set up email data
    const mailOptions = {
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to: `"${CLIENT_EMAIL}`,
      subject: `Conversation Summary - ${new Date().toLocaleDateString()}`,
      text: `Dear Client,
Please find attached a summary of the discussions this week.

If you have any questions or need further assistance, please don't hesitate to contact us.

Best regards,
${SENDER_NAME}`,
      attachments: [
        {
          filename: fileName,
          content: reportContent
        }
      ]
    };

    // Add CC and BCC if provided
    if (EMAIL_CC) mailOptions.cc = EMAIL_CC;
    if (EMAIL_BCC) mailOptions.bcc = EMAIL_BCC;

    // Send email
    console.log(`Sending email to: ${contactInfo.email}`);
    const info = await transporter.sendMail(mailOptions);

    console.log(`\n=== EMAIL SENT SUCCESSFULLY ===`);
    console.log(`MESSAGE ID: ${info.messageId}`);
    console.log(`===============================\n`);

    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('\n=== EMAIL SENDING ERROR ===');
    console.error(`ERROR MESSAGE: ${error.message}`);
    console.error(`============================\n`);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sends an email with the team report as an attachment to internal team members
 * @param {string} reportPath - Path to the team report file
 * @param {string} conversationId - The conversation ID
 * @param {Object} contactInfo - Contact information for context
 * @returns {Promise} - Email sending result
 */
async function sendTeamReportEmail(reportPath, conversationId, contactInfo) {
  try {
    console.log(`\n=== PREPARING TEAM EMAIL ===`);
    console.log(`REPORT PATH: ${reportPath}`);
    console.log(`===========================\n`);

    // Check if report file exists
    if (!fs.existsSync(reportPath)) {
      throw new Error(`Team report file not found at: ${reportPath}`);
    }

    // Get file content
    const reportContent = fs.readFileSync(reportPath, 'utf-8');
    const fileName = path.basename(reportPath);

    // Get team email configuration from environment variables
    const TEAM_EMAIL = process.env.TEAM_EMAIL;
    const SENDER_EMAIL = process.env.SENDER_EMAIL || process.env.EMAIL_USER;
    const SENDER_NAME = process.env.SENDER_NAME || 'Conversation Analyzer';
    
    if (!TEAM_EMAIL) {
      console.warn('No TEAM_EMAIL environment variable set. Team email not sent.');
      return {
        success: false,
        reason: 'No team email address configured'
      };
    }

    // Create transporter
    const transporter = getEmailTransporter();

    // Set up email data
    const mailOptions = {
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to: TEAM_EMAIL,
      subject: `Team Report: Conversation with ${contactInfo.name || 'Unknown Client'} (${conversationId})`,
      text: `Team,

Attached is the analysis report for conversation ${conversationId} with ${contactInfo.name || 'Unknown Client'} from ${contactInfo.country || 'Unknown'}.

This is an automated message from the Conversation Analyzer system.`,
      attachments: [
        {
          filename: fileName,
          content: reportContent
        }
      ]
    };

    // Send email
    console.log(`Sending team email to: ${TEAM_EMAIL}`);
    const info = await transporter.sendMail(mailOptions);

    console.log(`\n=== TEAM EMAIL SENT SUCCESSFULLY ===`);
    console.log(`MESSAGE ID: ${info.messageId}`);
    console.log(`====================================\n`);

    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('\n=== TEAM EMAIL SENDING ERROR ===');
    console.error(`ERROR MESSAGE: ${error.message}`);
    console.error(`================================\n`);
    
    return {
      success: false,
      error: error.message
    };
  }
}
// async function sendImprovementEmail(managerEmail, content) {
//   try {
//     const improvementsList = content.improvements.map(imp => `• ${imp}`).join('\n');

//     const mailOptions = {
//       from: process.env.EMAIL_FROM,
//       to: managerEmail,
//       subject: 'Assistant Improvement Suggestions',
//       html: `
//         <h2>Assistant Improvement Suggestions</h2>
//         <p>Here are the recommended improvements from recent conversations:</p>
//         <ul>${content.improvements.map(imp => `<li>${imp}</li>`).join('')}</ul>
        
//         <h3>Update Status:</h3>
//         <p>${content.updateResult.success ? 
//           '✅ Improvements were added to the assistant' : 
//           '❌ Failed to update assistant'}</p>
        
//         ${content.updateResult.improvementsAdded ? `
//         <h3>Added Improvements:</h3>
//         <ul>${content.updateResult.improvementsAdded.map(imp => `<li>${imp}</li>`).join('')}</ul>
//         ` : ''}
        
//         <h3>Report Excerpt:</h3>
//         <pre>${content.reportExcerpt}</pre>
        
//         <p><a href="${process.env.ASSISTANT_DASHBOARD_URL}">Review Assistant Settings</a></p>
//       `
//     };

//     const transporter = getEmailTransporter(); // FIXED this line
//     await transporter.sendMail(mailOptions);   // ADDED this line

//     console.log('Improvement email sent to manager');
//     return { success: true };
//   } catch (error) {
//     console.error('Error sending improvement email:', error);
//     return { success: false, error: error.message };
//   }
// }


// Don't forget to export it
module.exports = {
  sendClientReportEmail,
  sendTeamReportEmail,
  // sendImprovementEmail
};
