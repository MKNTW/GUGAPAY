
const crypto = require('crypto');

/**
 * @param {string} initData
 * @param {string} botToken
 * @returns {{user: object, auth_date: number, hash: string}}
 */
function validateTelegramWebAppData(initData, botToken) {
  const decoded = new URLSearchParams(initData);
  const data = {};

  for (const [key, value] of decoded) {
    data[key] = value;
  }

  const { hash } = data;
  delete data.hash;

  const sortedData = Object.keys(data)
    .sort()
    .map(key => `${key}=${data[key]}`)
    .join('\n');

  const secret = crypto.createHash('sha256').update(botToken).digest();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(sortedData)
    .digest('hex');

  if (signature !== hash) {
    throw new Error('Invalid telegram init data: hash mismatch');
  }

  return {
    user: JSON.parse(data.user),
    auth_date: parseInt(data.auth_date),
    hash
  };
}

module.exports = { validateTelegramWebAppData };
