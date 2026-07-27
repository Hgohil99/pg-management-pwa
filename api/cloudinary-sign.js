const crypto = require('crypto');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = 'rent-screenshots';
  
  // Include source=uw in the signature
  const paramsToSign = `folder=${folder}&source=uw&timestamp=${timestamp}`;
  
  const signature = crypto
    .createHash('sha256')
    .update(paramsToSign + process.env.CLOUDINARY_API_SECRET)
    .digest('hex');
  
  res.json({
    signature,
    timestamp,
    folder,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: '776889833388688'
  });
};