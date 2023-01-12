const sgMail = require("@sendgrid/mail");
require("dotenv").config();

const { SENDGRID_API_KEY } = process.env;

sgMail.setApiKey(SENDGRID_API_KEY);

const sendMail = async (data) => {
  const email = { ...data, from: "iventalko@gmail.com" };
  try {
    await sgMail.send(email);
  } catch (error) {
    throw new Error();
  }
};

module.exports = sendMail;
