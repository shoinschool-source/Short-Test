// api/generate.js

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, userSpeech, audioData, mimeType, step, chatHistory, customNotes } = req.body;
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI_API_KEY environment variable is missing.' });

  const teacherGuidance = customNotes ? `\n[CUSTOM TEACHER / PERSONA INSTRUCTIONS]:\n${customNotes}\n(Integrate these guidelines strictly into your conversational tone, choice of questions, or evaluation leniency.)\n` : '';

  // Instruction on pronunciation tolerance for audio
  const pronunciationLenience = `\n[PRONUNCIATION TOLERANCE INSTRUCTION]:\nThe student is a Japanese high school learner. Be extremely forgiving of Japanese-accented English, phonetic slips, or imperfect pronunciation in the audio. Transcribe and interpret what they meant at the CEFR A1 level, looking past minor phonetic transcription variations.\n`;

  let parts = [];

  if (audioData) {
    parts.push({
      inlineData: {
        mimeType: mimeType || 'audio/webm',
        data: audioData
      }
    });
  }

  let prompt = '';

  if (action === 'start_chat') {
    prompt = `You are a supportive, friendly English chat partner starting a casual conversation with a Japanese high school student at CEFR A1 level.
${teacherGuidance}
Generate a warm opening message and initial Question 1 in simple CEFR A1 English (under 8 words).

Respond ONLY with a valid raw JSON object:
{
  "nextQuestion": "Opening greeting and Question 1 text"
}`;
  } else if (action === 'chat_turn') {
    const contextHistory = (chatHistory || []).map(t => `Step ${t.step} Student: "${t.userSpeech}"`).join('\n');
    const inputContent = audioData ? "Listen to the attached audio recording of the student's spoken answer." : `Latest Student Text: "${userSpeech}"`;

    prompt = `You are a supportive English chat partner conducting a casual, adaptive conversation with a Japanese high school student at CEFR A1 level.
Current Step completed: ${step} of 6.
${teacherGuidance}
${pronunciationLenience}
Conversation History:
${contextHistory}

${inputContent}

INSTRUCTIONS:
1. Transcribe the student's spoken audio into English text (if audio was provided). Be highly lenient on Japanese accents and phonetic variations.
2. Provide brief, encouraging coaching feedback in natural JAPANESE regarding their response. Validate correct usage or gently point out key vocabulary/grammar errors.
3. Dynamically generate Question ${step + 1} based on what the student just said or start a fresh simple daily topic. Keep questions direct, clear, and under 8 words.

Respond ONLY with a valid raw JSON object matching this structure (no markdown formatting or backticks):
{
  "transcribedText": "The transcribed English text of what the student said",
  "feedback": "1-2 sentence friendly feedback in Japanese about their response",
  "nextQuestion": "Simple CEFR A1 English question for the next step"
}`;
  } else if (action === 'generate_summary_report') {
    const transcriptText = (chatHistory || []).map((t, idx) => `Turn ${idx + 1}: ${t.userSpeech}`).join('\n');

    prompt = `You are an expert English language teacher evaluating a Japanese high school student's 6-turn general chat exercise at the CEFR A1 level.
Evaluate the student's overall performance strictly according to the official Japanese High School English Curriculum Standards (高等学校学習指導要領 観点別学習状況の評価):
${teacherGuidance}
${pronunciationLenience}

Student Transcripts:
${transcriptText}

CRITICAL EVALUATION CRITERIA (3 CATEGORIES & WEIGHTS):
1. 知識・技能 (Knowledge & Skills - 50% Weight): Accuracy of basic vocabulary, grammar, spelling/transcription accuracy, and structural correctness at CEFR A1 level.
2. 思考・判断・表現 (Thinking, Judgment & Expression - 30% Weight): Relevancy, logical response to questions asked, and ability to express simple thoughts and opinions.
3. 表現の工夫・主体的に学習に取り組む態度 (Expression & Proactive Attitude - 20% Weight): Communicative engagement, effort to express thoughts naturally, and willingness to participate.

INSTRUCTIONS:
1. Write a supportive 2-3 sentence overall evaluation summary strictly in JAPANESE.
2. Provide percentage scores (0-100%) and brief Japanese evaluation comments for each of the 3 official Japanese high school criteria.
3. Summarize up to 3 genuine grammar/vocabulary corrections in Japanese. Do not penalize for accent or pronunciation variations.

Respond ONLY with a valid raw JSON object matching this structure (no markdown, no backticks):
{
  "subheading": "2-3 sentence overall evaluation summary in Japanese written as a supportive teacher",
  "scores": {
    "knowledgeSkills": 85,
    "knowledgeSkillsComment": "Japanese comment evaluating grammar/vocabulary accuracy (50% weight)",
    "thinkingJudgment": 80,
    "thinkingJudgmentComment": "Japanese comment evaluating relevance and logical thought (30% weight)",
    "expressionAttitude": 85,
    "expressionAttitudeComment": "Japanese comment evaluating communicative effort and proactive attitude (20% weight)"
  },
  "keyCorrections": [
    {
      "youSaid": "Student's original spoken words",
      "cleaner": "Improved, natural CEFR A1 English phrasing",
      "explanation": "Brief Japanese explanation of the grammar or word choice correction"
    }
  ]
}`;
  } else {
    return res.status(400).json({ error: 'Invalid action provided.' });
  }

  parts.push({ text: prompt });

  const cleanKey = encodeURIComponent(apiKey.trim());
  // Using gemini-2.5-flash or gemini-3.1-flash-lite supporting native audio multimodal input
  const url = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + cleanKey;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: parts }] })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Google AI API request failed.' });
    }

    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) return res.status(500).json({ error: 'AI returned an empty response.' });

    const cleanJson = JSON.parse(generatedText.replace(/```json/g, '').replace(/```/g, '').trim());

    if (action === 'chat_turn' || action === 'start_chat') {
      return res.status(200).json(cleanJson);
    } else {
      return res.status(200).json({ report: cleanJson });
    }
  } catch (err) {
    return res.status(500).json({ error: `Connection/parsing error: ${err.message}` });
  }
}
