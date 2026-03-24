module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'No image provided' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  const prompt = `You are a professional headlight restoration specialist analyzing a vehicle headlight photo for a customer on Vancouver Island, BC.

Analyze this headlight image and respond ONLY with a valid JSON object in exactly this format, no other text:

{
  "score": <number from 1.0 to 10.0>,
  "condition": "<one of: Critical | Poor | Fair | Good>",
  "clarity_reduction": <estimated percentage of clarity lost, as a number 0-100>,
  "findings": [
    "<specific finding about this headlight>",
    "<second specific finding about this headlight>"
  ],
  "recommendation": "<one sentence professional recommendation>",
  "restorable": <true or false>
}

Scoring guide:
- 1-3: Critical UV failure, severely yellowed/cloudy, dangerous
- 4-5: Poor condition, noticeable oxidation, needs restoration soon
- 6-7: Fair condition, early UV damage, restoration recommended
- 8-10: Good condition, minimal oxidation, monitoring recommended

Be specific and honest. If the image doesn't show a headlight clearly, set score to null and add a "error" field explaining this.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType || 'image/jpeg',
                  data: imageBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 500,
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API error:', error);
      return res.status(500).json({ error: 'Gemini API error', details: error });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(500).json({ error: 'No response from Gemini' });
    }

    // Strip markdown code fences if present
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}
