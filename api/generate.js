// api/generate.js

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, userSpeech, audioData, mimeType, step, totalSteps, chatHistory, customNotes, excludedQuestions } = req.body;
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI_API_KEY environment variable is missing.' });

  const maxSteps = totalSteps || 6;

  let historyExclusionText = '';
  if (excludedQuestions && Array.isArray(excludedQuestions) && excludedQuestions.length > 0) {
    historyExclusionText = `\n[PREVIOUSLY ASKED QUESTIONS FROM PAST SESSIONS - AVOID IF POSSIBLE]:\n${JSON.stringify(excludedQuestions)}\n`;
  }

  // CRITICAL: Custom teacher/admin instructions are placed last so they explicitly override general rules
  const teacherGuidance = customNotes ? `\n[CRITICAL ADMIN / TEACHER OVERRIDE INSTRUCTIONS - PRIORITY ONE]:\n${customNotes}\n(If the teacher explicitly requested a specific topic or question above, you MUST prioritize and include it, overriding general exclusion rules if necessary.)\n` : '';
  
  const combinedCustomNotes = historyExclusionText + teacherGuidance;

  const privacyDirective = `
[STRICT PRIVACY & PII RULE]:
NEVER ask the student for personally identifiable information (PII) under any circumstances.
Prohibited topics: Full name, student ID numbers, street address, specific school name, phone numbers, or passwords.
Keep questions focused on general topics like hobbies, daily routines, weekend plans, school subjects, sports, food, movies, or weather.
`;

  const questionStyleDirective = `
[QUESTION & FOLLOW-UP CONTINUITY RULE]:
1. ALWAYS ASK EXACTLY ONE SINGLE QUESTION per turn. Never ask multiple questions in one turn.
2. NO REPETITION WITHIN SESSION: Look closely at the conversation history below. You MUST NOT repeat any question that has already been asked in this session.
3. Expcept for the first question, "How are you?", Ask exactly one follow up question for each subsequent question, before moving forward to a new question.
`;

  const pronunciationLenience = `\n[PRONUNCIATION TOLERANCE INSTRUCTION]:\nThe student is a Japanese high school learner. Be extremely forgiving of Japanese-accented English, phonetic slips, or imperfect pronunciation in the audio. Transcribe and interpret what they meant at the CEFR A1 level, looking past minor phonetic transcription variations.\n`;

  let parts = [];

  if (audioData) {
    let cleanMime = (mimeType || 'audio/webm').split(';')[0].trim();
    if (!cleanMime.startsWith('audio/')) {
      cleanMime = 'audio/webm';
    }

    parts.push({
      inline_data: {
        mime_type: cleanMime,
        data: audioData
      }
    });
  }

  let prompt = '';

  if (action === 'transcribe_audio') {
    prompt = `You are an expert English audio transcriber for Japanese high school learners at CEFR A1 level.
${pronunciationLenience}
Listen to the attached audio recording. Transcribe the spoken English accurately into text, being extremely forgiving of Japanese accents, phonetic slips, or minor variations.

Respond ONLY with a valid raw JSON object matching this structure (no markdown formatting or backticks, ensure all string quotes are properly closed):
{
  "transcribedText": "The transcribed English text"
}`;
  } else if (action === 'start_chat') {
    prompt = `You are a supportive, friendly English chat partner conducting a ${maxSteps}-step conversation with a Japanese high school student at CEFR A1 level.
${combinedCustomNotes}
${privacyDirective}
${questionStyleDirective}
CRITICAL RULE: You must ask EXACTLY ONE single, clear, simple question at a time. Never ask multiple questions in one turn.
For step 1 (the very first opening message), follow any admin instructions above if provided; otherwise start with: "Hello, how are you?"

Respond ONLY with a valid raw JSON object (no markdown, no backticks):
{
  "nextQuestion": "Hello, how are you?"
}`;
  } else if (action === 'chat_turn') {
    const contextHistory = (chatHistory || []).map(t => `Step ${t.step} Student: "${t.userSpeech}"`).join('\n');

    prompt = `You are a supportive English chat partner conducting a casual, adaptive conversation with a Japanese high school student at CEFR A1 level.
Current Step completed: ${step} of ${maxSteps}.
${combinedCustomNotes}
${privacyDirective}
${questionStyleDirective}
Conversation History:
${contextHistory}

Latest Student Text: "${userSpeech}"

CRITICAL RULES:
1. Provide brief, encouraging coaching feedback in natural JAPANESE regarding their response. Validate correct usage or gently point out key vocabulary/grammar errors.
2. ASK EXACTLY ONE SINGLE QUESTION. Never ask multiple questions in one turn.
3. Follow any specific questions or topic instructions provided in the [CRITICAL ADMIN / TEACHER OVERRIDE INSTRUCTIONS]. Otherwise, randomize and vary questions naturally at CEFR A1 level.

Respond ONLY with a valid raw JSON object matching this structure (no markdown formatting or backticks, escape any internal quotes properly):
{
  "feedback": "1-2 sentence friendly feedback in Japanese about their response",
  "nextQuestion": "Single CEFR A1 English question for the next step"
}`;
  } else if (action === 'generate_summary_report') {
    const transcriptText = (chatHistory || []).map((t, idx) => `Turn ${idx + 1}: ${t.userSpeech}`).join('\n');

    prompt = `You are an expert English language teacher evaluating a Japanese high school student's ${maxSteps}-turn general chat exercise at the CEFR A1 level.
Evaluate the student's overall performance strictly according to the official Japanese High School English Curriculum Standards (高等学校学習指導要領 観点別学習状況の評価):
${combinedCustomNotes}
${pronunciationLenience}

Student Transcripts:
${transcriptText}

CRITICAL EVALUATION CRITERIA (3 CATEGORIES & WEIGHTED POINTS):
1. 知識・技能 (Knowledge & Skills - 50 points max / 50% Weight): Accuracy of basic vocabulary, grammar, spelling/transcription accuracy, and structural correctness at CEFR A1 level.
2. 思考・判断・表現 (Thinking, Judgment & Expression - 30 points max / 30% Weight): Relevancy, logical response to questions asked, and ability to express simple thoughts and opinions.
3. 表現の工夫・主体的に学習に取り組む態度 (Expression & Proactive Attitude - 20 points max / 20% Weight): Communicative engagement, effort to express thoughts naturally, and willingness to participate.
4. overallScore: The sum of the 3 category points, resulting in an overall score out of 100 points.

INSTRUCTIONS:
1. Write a supportive 2-3 sentence overall evaluation summary strictly in JAPANESE.
2. Provide numeric points-based scores (not percentages) for each of the 3 official Japanese high school criteria:
   - "knowledgeSkills": integer out of 50
   - "knowledgeSkillsComment": string comment
   - "thinkingJudgment": integer out of 30
   - "thinkingJudgmentComment": string comment
   - "expressionAttitude": integer out of 20
   - "expressionAttitudeComment": string comment
   - "overallScore": integer out of 100 (sum of the three)
3. Summarize up to 3 genuine grammar/vocabulary corrections in Japanese.

Respond ONLY with a valid raw JSON object matching EXACTLY this structure (no markdown, no backticks, ensure all property names are double-quoted, numbers are not strings):
{
  "subheading": "2-3 sentence overall evaluation summary in Japanese written as a supportive teacher",
  "overallScore": 85,
  "scores": {
    "knowledgeSkills": 42,
    "knowledgeSkillsComment": "Japanese comment evaluating grammar/vocabulary accuracy (out of 50 pts)",
    "thinkingJudgment": 24,
    "thinkingJudgmentComment": "Japanese comment evaluating relevance and logical thought (out of 30 pts)",
    "expressionAttitude": 19,
    "expressionAttitudeComment": "Japanese comment evaluating communicative effort and proactive attitude (out of 20 pts)"
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
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=' + cleanKey;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: parts }] })
    });

    const data = await response.json();
    if (!response.ok) {
      const detailMsg = data.error?.message || JSON.stringify(data.error) || 'Google AI API request failed.';
      return res.status(response.status).json({ 
        error: `[API Error ${response.status}]: ${detailMsg}` 
      });
    }

    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) return res.status(500).json({ error: 'AI returned an empty response.' });

    let cleanJson;
    try {
      let cleanedText = generatedText.trim();
      const fenceMatch = cleanedText.match(/```(?:json)?([\s\S]*?)```/);
      if (fenceMatch && fenceMatch[1]) {
        cleanedText = fenceMatch[1].trim();
      }
      const firstBrace = cleanedText.indexOf('{');
      const lastBrace = cleanedText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
      }
      cleanJson = JSON.parse(cleanedText);
    } catch (parseErr) {
      try {
        let cleanedText = generatedText.trim();
        const fenceMatch = cleanedText.match(/```(?:json)?([\s\S]*?)```/);
        if (fenceMatch && fenceMatch[1]) {
          cleanedText = fenceMatch[1].trim();
        }
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
        }
        cleanedText = cleanedText.replace(/[\u0000-\u001F]+/g, " ");
        cleanJson = JSON.parse(cleanedText);
      } catch (innerErr) {
        return res.status(500).json({ 
          error: `[JSON Parsing Error]: Failed to parse model response. Raw output was: ${generatedText.substring(0, 150)}...` 
        });
      }
    }

    if (action === 'generate_summary_report') {
      if (!cleanJson.scores) cleanJson.scores = {};
      if (typeof cleanJson.overallScore !== 'number') {
        const ks = Number(cleanJson.scores.knowledgeSkills) || 0;
        const tj = Number(cleanJson.scores.thinkingJudgment) || 0;
        const ea = Number(cleanJson.scores.expressionAttitude) || 0;
        cleanJson.overallScore = ks + tj + ea;
      }
    }

    return res.status(200).json(cleanJson);
  } catch (err) {
    return res.status(500).json({ error: `[Server Exception]: ${err.stack || err.message}` });
  }
};
