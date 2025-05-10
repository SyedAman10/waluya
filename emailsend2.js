const nodemailer = require('nodemailer');

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
async function sendImprovementEmail(managerEmail, content) {
    try {
      const improvementsListHTML = content.improvements.map(imp => `<li>${imp}</li>`).join('');
      const approveURL = `${process.env.SERVER_URL}/confirm-improvements?token=${content.token}`;
  
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: managerEmail,
        subject: 'Assistant Improvement Suggestions',
        html: `
          <h2>Assistant Improvement Suggestions</h2>
          <p>Here are the recommended improvements extracted from the latest report:</p>
          <ul>${improvementsListHTML}</ul>
  
          <h3>Report Excerpt:</h3>
          <pre>${content.reportExcerpt}</pre>
  
          <p>
            <a href="${approveURL}"
              style="display:inline-block;padding:10px 20px;background:#007bff;color:white;text-decoration:none;border-radius:5px;">
              ✅ Approve and Update Assistant
            </a>
          </p>
          <p><small>This action can only be used once.</small></p>
        `
      };
  
      const transporter = getEmailTransporter();
      await transporter.sendMail(mailOptions);
  
      console.log('Improvement email sent to manager');
      return { success: true };
    } catch (error) {
      console.error('Error sending improvement email:', error);
      return { success: false, error: error.message };
    }
  }
  
  module.exports = { sendImprovementEmail };
  