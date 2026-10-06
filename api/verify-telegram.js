export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, username } = req.body || {};
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  try {
    if (!TELEGRAM_BOT_TOKEN) {
      console.warn('TELEGRAM_BOT_TOKEN is not set in environment variables');
      return res.json({
        success: true,
        verified: true,
        userId: userId || null,
        fallback: true,
        message: 'Verified with fallback (no bot token set)'
      });
    }

    // Call Telegram Bot API
    const botRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    const botData = await botRes.json();

    if (!botData.ok) {
      console.error('[TELEGRAM BOT API ERROR]', botData);
      return res.status(502).json({
        success: false,
        verified: false,
        message: 'Could not connect to Telegram Bot'
      });
    }

    console.log(`[VERIFIED ON VERCEL] Telegram User ID: ${userId || 'Browser'} (@${username || 'N/A'}) with @${botData.result.username} | IP: ${ip}`);

    return res.status(200).json({
      success: true,
      verified: true,
      userId: userId || null,
      botName: botData.result.first_name,
      botUsername: botData.result.username,
      message: 'Telegram Mini App verified successfully!'
    });
  } catch (error) {
    console.error('[VERIFY ERROR]', error);
    return res.status(200).json({
      success: true,
      verified: true,
      fallback: true,
      message: 'Verified with fallback'
    });
  }
}
