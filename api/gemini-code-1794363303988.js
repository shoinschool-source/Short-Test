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
              <div style="font-size:11px; color:#666; margin-bottom:2px;">Q: ${c.question || ''}</div>
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
        <h3 style="margin-top:0; color:#46178f;">🎉 観点別評価レポート (${levelDisplayName}: CEFR-J ${cefrLevel})</h3>
        <p style="font-size:14px; font-weight:bold; color:#46178f; margin-bottom:4px;">${report.headline || 'Practice Completed!'}</p>
        <p style="font-size:13px; color:#555; margin-bottom: 12px;">${report.subheading}</p>
        
        <div class="overall-score-banner">
          総合評価 (Overall Score): <span class="score-num">${overall} / 100 pts</span> 
        </div>

        <div class="score-grid" style="grid-template-columns: 1fr;">
          <div class="score-item">
            <div class="score-header">
              <span class="score-title">① 知識・技能 (Knowledge & Skills - 50%)</span>
              <span class="score-val">${scores.knowledgeSkills || 0} / 50 pts</span>
            </div>
            <div class="score-desc">${scores.knowledgeSkillsComment || ''}</div>
          </div>
          <div class="score-item">
            <div class="score-header">
              <span class="score-title">② 思考・判断・表現 (Thinking & Judgment - 30%)</span>
              <span class="score-val">${scores.thinkingJudgment || 0} / 30 pts</span>
            </div>
            <div class="score-desc">${scores.thinkingJudgmentComment || ''}</div>
          </div>
          <div class="score-item">
            <div class="score-header">
              <span class="score-title">③ 表現の工夫・主体的な態度 (Expression & Attitude - 20%)</span>
              <span class="score-val">${scores.expressionAttitude || 0} / 20 pts</span>
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