// api/generate.js

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, userSpeech, audioData, mimeType, step, totalSteps, chatHistory, customNotes } = req.body;
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI_API_KEY environment variable is missing.' });

  const maxSteps = totalSteps || 6;

  const teacherGuidance = customNotes ? `\n[CUSTOM TEACHER / PERSONA INSTRUCTIONS]:\n${customNotes}\n(Integrate these guidelines strictly into your conversational tone, choice of questions, or evaluation leniency.)\n` : '';

  const privacyDirective = `
[STRICT PRIVACY & PII RULE]:
NEVER ask the student for personally identifiable information (PII) under any circumstances.
Prohibited topics: Full name, student ID numbers, street address, specific school name, phone numbers, or passwords.
Keep questions focused on general topics like hobbies, daily routines, weekend plans, school subjects, sports, food, movies, or weather.
`;

  const questionStyleDirective = `
[QUESTION & FOLLOW-UP CONTINUITY RULE]:
1. ALWAYS ASK EXACTLY ONE SINGLE QUESTION per turn. Never ask multiple questions in one turn.
2. CONTINUISTY & FOLLOW-UP: Carefully analyze the student's previous answer. Ask a natural, relevant follow-up question based on what they just said whenever possible.
3. Only introduce a new general topic if the current topic has been naturally exhausted or if it is the first question.
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
${teacherGuidance}
${privacyDirective}
${questionStyleDirective}
CRITICAL RULE: You must ask EXACTLY ONE single, clear, simple question at a time. Never ask multiple questions in one turn.
For step 1 (the very first opening message), you MUST start with: "Hello, how are you?"

Respond ONLY with a valid raw JSON object (no markdown, no backticks):
{
  "nextQuestion": "Hello, how are you?"
}`;
  } else if (action === 'chat_turn') {
    const contextHistory = (chatHistory || []).map(t => `Step ${t.step} Student: "${t.userSpeech}"`).join('\n');

    prompt = `You are a supportive English chat partner conducting a casual, adaptive conversation with a Japanese high school student at CEFR A1 level.
Current Step completed: ${step} of ${maxSteps}.
${teacherGuidance}
${privacyDirective}
${questionStyleDirective}
Conversation History:
${contextHistory}

Latest Student Text: "${userSpeech}"

CRITICAL RULES:
1. Provide brief, encouraging coaching feedback in natural JAPANESE regarding their response. Validate correct usage or gently point out key vocabulary/grammar errors.
2. ASK EXACTLY ONE SINGLE QUESTION. Never ask multiple questions in one turn.
3. Randomize and vary the questions naturally at a CEFR A1 level across steps 2 to ${maxSteps} (e.g., "What is your name?", "What is your hobby?", "What do you like to eat?", "What is your favorite subject?", "What sports do you play?", etc.). Keep questions direct, clear, and under 8 words.

Respond ONLY with a valid raw JSON object matching this structure (no markdown formatting or backticks, escape any internal quotes properly):
{
  "feedback": "1-2 sentence friendly feedback in Japanese about their response",
  "nextQuestion": "Single CEFR A1 English question for the next step"
}`;
  } else if (action === 'generate_summary_report') {
    const transcriptText = (chatHistory || []).map((t, idx) => `Turn ${idx + 1}: ${t.userSpeech}`).join('\n');

    prompt = `You are an expert English language teacher evaluating a Japanese high school student's ${maxSteps}-turn general chat exercise at the CEFR A1 level.
Evaluate the student's overall performance strictly according to the official Japanese High School English Curriculum Standards (高等学校学習指導要領 観点別学習状況の評価):
${teacherGuidance}
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
2. Provide points-based scores (not percentages) for each of the 3 official Japanese high school criteria (out of 50, out of 30, and out of 20) and the overallScore out of 100, along with brief Japanese evaluation comments.
3. Summarize up to 3 genuine grammar/vocabulary corrections in Japanese.

Respond ONLY with a valid raw JSON object matching this structure (no markdown, no backticks, ensure quotes and newlines inside string values are properly escaped):
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
  const url = 'https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-lite:generateContent?key=' + cleanKey;

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

    // Robust JSON cleaning & extraction to prevent parse errors from markdown or control characters
    let cleanJson;
    try {
      let cleanedText = generatedText.trim();
      // Remove standard markdown code fences if present
      const fenceMatch = cleanedText.match(/```(?:json)?([\s\S]*?)```/);
      if (fenceMatch && fenceMatch[1]) {
        cleanedText = fenceMatch[1].trim();
      }
      cleanJson = JSON.parse(cleanedText);
    } catch (parseErr) {
      // Fallback extraction of outer brace bounds
      try {
        const firstBrace = generatedText.indexOf('{');
        const lastBrace = generatedText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonSubstr = generatedText.substring(firstBrace, lastBrace + 1);
          cleanJson = JSON.parse(jsonSubstr);
        } else {
          throw parseErr;
        }
      } catch (innerErr) {
        return res.status(500).json({ 
          error: `[JSON Parsing Error]: Failed to parse model response. Raw output was: ${generatedText.substring(0, 150)}...` 
        });
      }
    }

    if (action === 'chat_turn' || action === 'start_chat' || action === 'transcribe_audio') {
      return res.status(200).json(cleanJson);
    } else {
      return res.status(200).json({ report: cleanJson });
    }
  } catch (err) {
    return res.status(500).json({ error: `[Server Exception]: ${err.stack || err.message}` });
  }
}
```[cite: 1]

---

### 2. `admin.html`
```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CEFR A1 チャット学習 - 管理者パネル</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js"></script>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background-color: #f4f6f8; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); width: 100%; max-width: 600px; text-align: center; }
    .hidden { display: none !important; }
    h2 { margin-top: 0; color: #333; margin-bottom: 20px; }
    label { display: block; margin-bottom: 6px; color: #46178f; font-size: 14px; font-weight: bold; text-align: left; }
    
    select, textarea { width: 100%; padding: 12px; border: 2px solid #cccccc; border-radius: 8px; font-size: 14px; margin-bottom: 18px; outline: none; background: #fff; }
    select:focus, textarea:focus { border-color: #46178f; }

    button.primary { width: 100%; padding: 14px; background-color: #46178f; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; transition: background 0.2s ease; margin-bottom: 10px; }
    button.primary:hover { background-color: #331068; }

    button.test-btn { width: 100%; padding: 12px; background-color: #28a745; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: bold; cursor: pointer; transition: background 0.2s ease; margin-bottom: 10px; }
    button.test-btn:hover { background-color: #218838; }

    button.secondary { width: 100%; background-color: #e0e0e0; color: #333; margin-top: 10px; font-weight: bold; padding: 12px; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; }
    button.secondary:hover { background-color: #d0d0d0; }

    #qrcode { display: flex; justify-content: center; margin: 20px 0; }
  </style>
</head>
<body>

  <div class="card">
    <!-- Setup Screen -->
    <div id="setupScreen">
      <h2>⚙️ Session Configuration</h2>
      <p style="font-size: 13px; color: #666; text-align: left; margin-bottom: 20px;">
        Set the number of questions and optional teacher guidance for this CEFR A1 session.
      </p>

      <label for="totalSteps">Number of Questions (1 – 20):</label>
      <select id="totalSteps">
        <!-- Dynamically populated 1 to 20 -->
      </select>

      <label for="customNotes">Custom Persona / Topic Instructions (Optional):</label>
      <textarea id="customNotes" style="height: 120px;" placeholder="e.g., Talk about weekend hobbies, festival plans, favorite sports..."></textarea>

      <button id="generateQrBtn" class="primary">QRコードを生成 (Generate Session QR)</button>
      <button id="testLinkBtn" class="test-btn" onclick="openTestLink()">🧪 テスト用リンクを開く (Open Test Link)</button>
    </div>

    <!-- QR Screen -->
    <div id="qrScreen" class="hidden">
      <h2>スキャンしてチャットを開始！</h2>
      <div id="qrcode"></div>
      <button onclick="openTestLink()" style="background: #28a745; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; margin-bottom: 10px;">🧪 この設定でテストタブを開く</button>
      <button id="backBtn" class="secondary">設定に戻る</button>
    </div>
  </div>

  <script>
    const totalStepsSelect = document.getElementById('totalSteps');
    for (let i = 1; i <= 20; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${i} Question${i > 1 ? 's' : ''}`;
      if (i === 6) opt.selected = true;
      totalStepsSelect.appendChild(opt);
    }

    function getTargetUrl() {
      const customNotes = document.getElementById('customNotes').value.trim();
      const totalSteps = parseInt(document.getElementById('totalSteps').value, 10);

      const payload = JSON.stringify({ 
        customNotes: customNotes,
        totalSteps: totalSteps
      });
      
      const compressedPayload = LZString.compressToEncodedURIComponent(payload);

      let currentPath = window.location.pathname;
      let studentPath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1) + 'student.html';
      return `${window.location.origin}${studentPath}?config=${compressedPayload}`;
    }

    document.getElementById('generateQrBtn').addEventListener('click', () => {
      const targetUrl = getTargetUrl();

      document.getElementById('qrcode').innerHTML = '';
      new QRCode(document.getElementById('qrcode'), { 
        text: targetUrl, 
        width: 280, 
        height: 280,
        correctLevel: QRCode.CorrectLevel.L
      });

      document.getElementById('setupScreen').classList.add('hidden');
      document.getElementById('qrScreen').classList.remove('hidden');
    });

    function openTestLink() {
      const targetUrl = getTargetUrl();
      window.open(targetUrl, '_blank');
    }

    document.getElementById('backBtn').addEventListener('click', () => {
      document.getElementById('qrScreen').classList.add('hidden');
      document.getElementById('setupScreen').classList.remove('hidden');
    });
  </script>
</body>
</html>
```[cite: 3]

---

### 3. `student.html`
```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CEFR A1 Chat Practice</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js"></script>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background-color: #f0f2f5; margin: 0; display: flex; justify-content: center; height: 100vh; }
    
    .chat-card {
      background: #ffffff;
      width: 100%;
      max-width: 600px;
      height: 100vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .chat-header {
      background-color: #46178f;
      color: white;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .chat-header h2 { margin: 0; font-size: 1.1rem; }
    .badge { background: #6200ea; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold; }

    .chat-feed {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 15px;
      background-color: #f9f9fb;
    }

    .msg { max-width: 85%; padding: 12px 16px; border-radius: 12px; font-size: 15px; line-height: 1.4; word-break: break-word; }
    .msg-ai { background-color: #eef4fc; color: #0c4a6e; align-self: flex-start; border-bottom-left-radius: 2px; }
    .msg-user { background-color: #1368ce; color: white; align-self: flex-end; border-bottom-right-radius: 2px; }
    .msg-feedback { background-color: #fff3cd; color: #856404; align-self: flex-start; border: 1px solid #ffeeba; font-size: 14px; width: 100%; max-width: 100%; }

    .chat-footer {
      padding: 15px;
      background: #ffffff;
      border-top: 1px solid #e0e0e0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .input-row { display: flex; gap: 8px; align-items: center; }
    
    .input-box {
      flex: 1;
      padding: 12px 15px;
      border: 2px solid #cccccc;
      border-radius: 24px;
      font-size: 15px;
      outline: none;
    }
    .input-box:focus { border-color: #1368ce; }

    .icon-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      background-color: #1368ce;
      color: white;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: background 0.2s;
    }
    .icon-btn:hover { background-color: #0f50a0; }
    .icon-btn.recording { background-color: #dc3545; animation: pulse 1.5s infinite; }
    .icon-btn:disabled { background-color: #cccccc; cursor: not-allowed; }
    
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.6); }
      70% { box-shadow: 0 0 0 12px rgba(220, 53, 69, 0); }
      100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
    }

    /* Report Styles */
    .report-card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #b6d4fe; margin-top: 10px; }
    .overall-score-banner { background: #46178f; color: white; padding: 14px; border-radius: 8px; text-align: center; margin-bottom: 15px; }
    .overall-score-banner span.score-num { font-size: 22px; font-weight: bold; }
    .score-grid { display: flex; flex-direction: column; gap: 10px; margin: 15px 0; }
    .score-item { background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #e2e2e2; }
    .score-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .score-title { font-size: 13px; color: #1368ce; font-weight: bold; }
    .score-val { font-size: 15px; font-weight: bold; color: #333; }
    .score-weight { font-size: 11px; color: #666; margin-left: 4px; }
    .score-desc { font-size: 12px; color: #555; line-height: 1.3; }
    .correction-box { background: #fff; padding: 10px; border-left: 4px solid #1368ce; margin-bottom: 8px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  </style>
</head>
<body>

  <div class="chat-card">
    <div class="chat-header">
      <h2>English Chat Partner (CEFR A1)</h2>
      <span class="badge" id="stepCounter">Question 1 / 6</span>
    </div>

    <div class="chat-feed" id="chatFeed">
      <!-- Chat bubbles dynamically render here -->
    </div>

    <div class="chat-footer" id="chatFooter">
      <div class="input-row">
        <button id="micBtn" class="icon-btn" onclick="toggleRecording()">🎤</button>
        <input type="text" id="userInput" class="input-box" placeholder="Type or record your answer in English..." autocomplete="off">
        <button id="sendBtn" class="icon-btn" onclick="handleSendText()">➔</button>
      </div>
    </div>
  </div>

  <script>
    let currentStep = 1;
    let totalSteps = 6;
    let chatHistory = [];
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;
    let teacherCustomNotes = '';

    window.onload = function() {
      const urlParams = new URLSearchParams(window.location.search);
      const configParam = urlParams.get('config');

      if (configParam) {
        try {
          const decompressed = LZString.decompressFromEncodedURIComponent(configParam);
          const parsed = JSON.parse(decompressed);
          if (parsed.customNotes) teacherCustomNotes = parsed.customNotes;
          if (parsed.totalSteps) totalSteps = parseInt(parsed.totalSteps, 10);
        } catch (e) { console.error("Error parsing QR payload:", e); }
      }

      document.getElementById('stepCounter').textContent = `Question 1 / ${totalSteps}`;
      initiateConversation();
      setupAudioRecording();
    };

    async function setupAudioRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : MediaRecorder.isTypeSupported('audio/webm') 
            ? 'audio/webm' 
            : 'audio/mp4';

        mediaRecorder = new MediaRecorder(stream, { mimeType });
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: mimeType });
          audioChunks = [];
          await transcribeAudioToInput(audioBlob);
        };
      } catch (err) {
        console.warn("Microphone not available or permission denied:", err);
      }
    }

    function toggleRecording() {
      if (!mediaRecorder) {
        alert('Microphone recording is not available on this device or browser. Please use text input instead.');
        return;
      }

      if (isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        document.getElementById('micBtn').classList.remove('recording');
      } else {
        audioChunks = [];
        mediaRecorder.start(1000);
        isRecording = true;
        document.getElementById('micBtn').classList.add('recording');
      }
    }

    async function initiateConversation() {
      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'start_chat',
            totalSteps: totalSteps,
            customNotes: teacherCustomNotes
          })
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const specificErr = errData.error || `HTTP ${response.status} ${response.statusText}`;
          appendBubble(`⚠️ <strong>Connection/API Error:</strong> ${specificErr}`, 'feedback');
          document.getElementById('sendBtn').disabled = false;
          document.getElementById('micBtn').disabled = false;
          return;
        }
        const data = await response.json();
        appendBubble(data.nextQuestion || "Hello, how are you?", 'ai');
      } catch (err) {
        appendBubble("Hello, how are you?", 'ai');
      }
    }

    function appendBubble(text, sender) {
      const feed = document.getElementById('chatFeed');
      const msg = document.createElement('div');
      msg.className = `msg msg-${sender}`;
      msg.innerHTML = text.replace(/\n/g, '<br>');
      feed.appendChild(msg);
      feed.scrollTop = feed.scrollHeight;
    }

    async function handleSendText() {
      const inputEl = document.getElementById('userInput');
      const text = inputEl.value.trim();
      if (!text) return;
      inputEl.value = '';
      
      appendBubble(text, 'user');
      await processUserTurn(text);
    }

    async function transcribeAudioToInput(audioBlob) {
      const inputEl = document.getElementById('userInput');
      const originalPlaceholder = inputEl.placeholder;
      inputEl.placeholder = "🎤 Transcribing your voice into text...";
      inputEl.disabled = true;
      document.getElementById('micBtn').disabled = true;
      document.getElementById('sendBtn').disabled = true;

      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async function() {
        const base64Audio = reader.result.split(',')[1];
        try {
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'transcribe_audio',
              audioData: base64Audio,
              mimeType: audioBlob.type || 'audio/webm'
            })
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${response.status}`);
          }

          const data = await response.json();
          if (data.transcribedText) {
            inputEl.value = data.transcribedText;
          }
        } catch (err) {
          alert(`Transcription error: ${err.message}`);
        } finally {
          inputEl.placeholder = originalPlaceholder;
          inputEl.disabled = false;
          document.getElementById('micBtn').disabled = false;
          document.getElementById('sendBtn').disabled = false;
          inputEl.focus();
        }
      };
    }

    async function processUserTurn(textInput) {
      document.getElementById('sendBtn').disabled = true;
      document.getElementById('micBtn').disabled = true;

      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: currentStep >= totalSteps ? 'generate_summary_report' : 'chat_turn',
            userSpeech: textInput,
            step: currentStep,
            totalSteps: totalSteps,
            chatHistory: chatHistory,
            customNotes: teacherCustomNotes
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const specificErr = errData.error || `HTTP ${response.status} ${response.statusText}`;
          appendBubble(`⚠️ <strong>Connection/API Error:</strong> ${specificErr}`, 'feedback');
          document.getElementById('sendBtn').disabled = false;
          document.getElementById('micBtn').disabled = false;
          return;
        }

        const data = await response.json();
        document.getElementById('sendBtn').disabled = false;
        document.getElementById('micBtn').disabled = false;

        chatHistory.push({ step: currentStep, userSpeech: textInput });

        if (data.feedback) {
          appendBubble(`💡 <strong>Coach Note:</strong> ${data.feedback}`, 'feedback');
        }

        if (currentStep < totalSteps) {
          currentStep++;
          document.getElementById('stepCounter').textContent = `Question ${currentStep} / ${totalSteps}`;
          appendBubble(data.nextQuestion, 'ai');
        } else {
          document.getElementById('chatFooter').style.display = 'none';
          document.getElementById('stepCounter').textContent = 'Completed!';
          renderFinalReport(data.report);
        }

      } catch (err) {
        document.getElementById('sendBtn').disabled = false;
        document.getElementById('micBtn').disabled = false;
        appendBubble(`⚠️ <strong>Connection Error:</strong> ${err.message}`, 'feedback');
      }
    }

    document.getElementById('userInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSendText();
    });

    function renderFinalReport(report) {
      const feed = document.getElementById('chatFeed');
      const reportDiv = document.createElement('div');
      reportDiv.className = 'report-card';
      reportDiv.id = 'reportPdfArea';

      let correctionsHtml = '';
      if (report.keyCorrections && report.keyCorrections.length > 0) {
        report.keyCorrections.forEach(c => {
          correctionsHtml += `
            <div class="correction-box">
              <div style="font-size:11px; color:#dc3545;">Original: ${c.youSaid}</div>
              <div style="font-size:12px; color:#28a745; font-weight:bold;">Cleaner: ${c.cleaner}</div>
              <div style="font-size:11px; color:#555;">${c.explanation}</div>
            </div>`;
        });
      } else {
        correctionsHtml = '<p style="color:#28a745; font-weight:bold;">素晴らしい！全ての応答が適切でした。</p>';
      }

      const scores = report.scores || {};
      const overall = report.overallScore || 0;

      reportDiv.innerHTML = `
        <h3 style="margin-top:0; color:#46178f;">🎉 観点別評価レポート (高校英語科基準)</h3>
        <p style="font-size:13px; color:#555; margin-bottom:12px;">${report.subheading}</p>
        
        <div class="overall-score-banner">
          総合評価 (Overall Score): <span class="score-num">${overall} / 100 pts</span>
        </div>

        <div class="score-grid">
          <div class="score-item">
            <div class="score-header">
              <span class="score-title">① 知識・技能</span>
              <span class="score-val">${scores.knowledgeSkills || 0} / 50 pts<span class="score-weight">(50%)</span></span>
            </div>
            <div class="score-desc">${scores.knowledgeSkillsComment || ''}</div>
          </div>
          <div class="score-item">
            <div class="score-header">
              <span class="score-title">② 思考・判断・表現</span>
              <span class="score-val">${scores.thinkingJudgment || 0} / 30 pts<span class="score-weight">(30%)</span></span>
            </div>
            <div class="score-desc">${scores.thinkingJudgmentComment || ''}</div>
          </div>
          <div class="score-item">
            <div class="score-header">
              <span class="score-title">③ 表現の工夫・主体的な態度</span>
              <span class="score-val">${scores.expressionAttitude || 0} / 20 pts<span class="score-weight">(20%)</span></span>
            </div>
            <div class="score-desc">${scores.expressionAttitudeComment || ''}</div>
          </div>
        </div>
        <h4 style="margin-bottom:8px; color:#333;">主な改善ポイント</h4>
        ${correctionsHtml}
        <button onclick="downloadPdf()" style="width:100%; padding:10px; background:#1368ce; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; margin-top:10px;">📥 PDFレポートをダウンロード</button>
      `;
      feed.appendChild(reportDiv);
      feed.scrollTop = feed.scrollHeight;
    }

    function downloadPdf() {
      const element = document.getElementById('reportPdfArea');
      html2pdf().set({
        margin: 0.2,
        filename: 'HS_English_Assessment_Report.pdf',
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      }).from(element).save();
    }
  </script>
</body>
</html>
```[cite: 2]