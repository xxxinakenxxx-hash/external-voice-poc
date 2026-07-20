const OPENAI_API_URL_ = 'https://api.openai.com/v1/chat/completions';
// Change this line to switch OpenAI models.
const OPENAI_MODEL_ = 'gpt-4o-mini';

function getAiApiKey() {
  const apiKey = String(PropertiesService.getScriptProperties().getProperty('AI_API_KEY') || '').trim();

  if (!apiKey) {
    throw new Error('APIキーが設定されていません。スクリプトプロパティ AI_API_KEY を設定してください。');
  }

  return apiKey;
}

function getSystemPrompt() {
  return [
    'あなたは、食品・業務用機器の卸売会社の営業担当が話した商談メモを、構造化データに整理するアシスタントです。',
    '入力された商談メモを読み、「顧客 × 案件テーマ」の単位でレコードに分割し、JSON配列だけを出力してください。',
    '',
    '【出力形式】',
    '- 出力はJSON配列のみ。前後に説明・見出し・コードブロック記号・挨拶を一切付けない。',
    '- 各要素は次の6つのキーだけを持つ。キー名はこの通りに一致させる。',
    '  customer_name, customer_type, deal_theme, deal_content, todo_item, todo_deadline',
    '- すべての値は文字列。該当しない項目は空文字 "" にする（キーは省略しない）。null・数値・真偽は使わない。',
    '',
    '【各項目】',
    '- customer_name：顧客名（商談先）。不明なら ""。創作しない。',
    '- customer_type：顧客業態（製菓／製パン／外食／カフェ 等）を文脈から推定。判断できなければ ""。',
    '- deal_theme：案件テーマ。「商談の話題単位」で抽出する。',
    '- deal_content：その案件テーマに関する商談内容を、メモから抜き出して簡潔に整理する。',
    '- todo_item：営業が対応すべき宿題・ToDo。無ければ ""。',
    '- todo_deadline：宿題の期限。メモの表現をそのまま記録する（「急ぎ」「来月」「3/25」等）。日付に変換しない。',
    '',
    '【分割ルール】',
    '1. 複数の顧客が出てきたら、顧客ごとに別レコードに分ける。',
    '2. 同じ顧客でも複数の案件テーマがあれば、案件テーマごとに別レコードに分ける。',
    '3. 案件テーマが1つだけなら1レコード。',
    '',
    '【案件テーマの粒度（重要）】',
    '- 案件テーマは「商談の話題単位」で分ける。個別の商品名・品種・SKU 単位では分けない。',
    '- 例：「油脂の話。マーガリンとショートニング両方で見積もり」→ 油脂という1つの話題なので1レコード（案件テーマは「油脂（マーガリン・ショートニング）」）。',
    '- 例：「油脂の話。あとジェラートマシンの件」→ 別の話題なので2レコード。',
    '',
    '【不明・失敗時】',
    '- 抽出できない項目は "" にする。値を創作しない。',
    '- 顧客名が分からなくても、話題ごとの分割は行う（customer_name は "" のまま）。',
    '- どうしても分割できない（極端に短い・意味をなさない）ときは、入力全体を1レコードにし、拾える項目だけ埋め、他は "" にする。',
    '',
    '【禁止】',
    '- 6つのキー以外を追加しない。キー名を変えない。',
    '- JSON以外の文字を出力しない。',
    '- 宿題期限を日付に変換しない。',
    '- 品種・SKU 単位で分割しすぎない。',
    '',
    '次に示す入力例と出力例に倣ってください。',
    '',
    '### 例1：複数顧客の混在',
    '入力：',
    '```',
    '今日は午前中に○○ベーカリーに行って油脂の話をした。午後は△△カフェでジェラートマシンの件。あと□□ホテルから電話があってチョコの見積もり急ぎでと',
    '```',
    '出力：',
    '```json',
    '[',
    '  {"customer_name":"○○ベーカリー","customer_type":"製パン","deal_theme":"油脂","deal_content":"油脂の話をした","todo_item":"","todo_deadline":""},',
    '  {"customer_name":"△△カフェ","customer_type":"カフェ","deal_theme":"ジェラートマシン","deal_content":"ジェラートマシンの件","todo_item":"","todo_deadline":""},',
    '  {"customer_name":"□□ホテル","customer_type":"外食","deal_theme":"チョコレート見積","deal_content":"チョコの見積もり依頼。急ぎ","todo_item":"見積作成","todo_deadline":"急ぎ"}',
    ']',
    '```',
    '',
    '### 例2：同一顧客で複数の案件テーマ',
    '入力：',
    '```',
    '○○ベーカリーの商談終わりました。新しいクロワッサン用の油脂の話をした。コストが上がるらしい。サンプルを出すことになった。あとジェラートマシンの件は来月まで保留。チョコの見積もりを急ぎで出してほしいと',
    '```',
    '出力：',
    '```json',
    '[',
    '  {"customer_name":"○○ベーカリー","customer_type":"製パン","deal_theme":"クロワッサン用油脂","deal_content":"新しいクロワッサン用油脂の話。コストが上がる。サンプル提供の話","todo_item":"サンプル送付","todo_deadline":""},',
    '  {"customer_name":"○○ベーカリー","customer_type":"製パン","deal_theme":"ジェラートマシン","deal_content":"来月まで保留","todo_item":"フォロー","todo_deadline":"来月"},',
    '  {"customer_name":"○○ベーカリー","customer_type":"製パン","deal_theme":"チョコレート見積","deal_content":"チョコの見積もり依頼。急ぎ","todo_item":"見積作成","todo_deadline":"急ぎ"}',
    ']',
    '```',
    '',
    '### 例3：同一話題内の複数品種 → 分割しない',
    '入力：',
    '```',
    '○○ベーカリーで油脂の話をした。マーガリンとショートニングの両方で見積もりを出すことになった。あとバターも少し検討したいと',
    '```',
    '出力：',
    '```json',
    '[',
    '  {"customer_name":"○○ベーカリー","customer_type":"製パン","deal_theme":"油脂（マーガリン・ショートニング・バター）","deal_content":"マーガリンとショートニングの見積もり。バターも検討","todo_item":"見積作成","todo_deadline":""}',
    ']',
    '```',
    '',
    '### 例4：顧客名不明でも分割する',
    '入力：',
    '```',
    'さっき行った店で油脂の話をした。あと別の店でオーブンの件',
    '```',
    '出力：',
    '```json',
    '[',
    '  {"customer_name":"","customer_type":"","deal_theme":"油脂","deal_content":"油脂の話をした","todo_item":"","todo_deadline":""},',
    '  {"customer_name":"","customer_type":"","deal_theme":"オーブン","deal_content":"オーブンの件","todo_item":"","todo_deadline":""}',
    ']',
    '```',
  ].join('\n');
}

function buildAiRequestPayload(systemPrompt, inputText) {
  const systemPromptText = String(systemPrompt || '');
  const inputTextText = String(inputText || '');

  if (!systemPromptText.trim() || !inputTextText.trim()) {
    throw new Error('systemPrompt または inputText が空です。');
  }

  const userPromptText = `${inputTextText}

入力全文を最後まで確認し、すべての顧客・すべての案件テーマを漏れなく抽出してください。出力は必ずJSON配列とし、1件の場合も配列で返してください。説明文は付けないでください。`;

  return {
    model: OPENAI_MODEL_,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: systemPromptText,
      },
      {
        role: 'user',
        content: userPromptText,
      },
    ],
  };
}

function callAiApi(inputText) {
  const inputTextText = String(inputText || '');
  if (!inputTextText.trim()) {
    throw new Error('inputText が空です。');
  }

  const apiKey = getAiApiKey();
  const systemPrompt = getSystemPrompt();
  const requestPayload = buildAiRequestPayload(systemPrompt, inputTextText);

  const response = UrlFetchApp.fetch(OPENAI_API_URL_, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    payload: JSON.stringify(requestPayload),
    muteHttpExceptions: true,
  });

  const statusCode = response.getResponseCode();
  if (statusCode !== 200) {
    throw new Error(`OpenAI API request failed with HTTP ${statusCode}.`);
  }

  return response.getContentText();
}

function parseAiResponse(aiResponseText) {
  const fallbackRecord = {
    customerName: '',
    customerType: '',
    dealTheme: '',
    dealContent: '',
    todoItem: '',
    todoDeadline: '',
    extractStatus: '要確認',
  };

  const fallbackRecords = [fallbackRecord];
  const rawText = String(aiResponseText || '').trim();
  if (!rawText) {
    return fallbackRecords;
  }

  let contentText = rawText;
  try {
    const parsedResponse = JSON.parse(rawText);
    if (parsedResponse && Array.isArray(parsedResponse.choices) && parsedResponse.choices.length > 0) {
      const firstChoice = parsedResponse.choices[0] || {};
      const messageContent = firstChoice.message && typeof firstChoice.message.content === 'string'
        ? firstChoice.message.content
        : '';
      const textContent = typeof firstChoice.text === 'string' ? firstChoice.text : '';
      const directContent = typeof parsedResponse.content === 'string' ? parsedResponse.content : '';
      contentText = messageContent || textContent || directContent || rawText;
    } else if (typeof parsedResponse === 'string') {
      contentText = parsedResponse;
    }
  } catch (error) {
    contentText = rawText;
  }

  contentText = String(contentText || '').trim();
  if (!contentText) {
    return fallbackRecords;
  }

  let candidateText = contentText;
  const codeFenceMatch = candidateText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeFenceMatch && codeFenceMatch[1]) {
    candidateText = codeFenceMatch[1].trim();
  } else {
    let startIndex = candidateText.indexOf('[');
    let openChar = '[';
    let closeChar = ']';

    if (startIndex < 0) {
      startIndex = candidateText.indexOf('{');
      openChar = '{';
      closeChar = '}';
    }

    if (startIndex >= 0) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      let endIndex = -1;

      for (let index = startIndex; index < candidateText.length; index += 1) {
        const character = candidateText.charAt(index);

        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (character === '\\') {
            escaped = true;
          } else if (character === '"') {
            inString = false;
          }
          continue;
        }

        if (character === '"') {
          inString = true;
          continue;
        }

        if (character === openChar) {
          depth += 1;
        } else if (character === closeChar) {
          depth -= 1;
          if (depth === 0) {
            endIndex = index;
            break;
          }
        }
      }

      if (endIndex >= 0) {
        candidateText = candidateText.slice(startIndex, endIndex + 1).trim();
      }
    }
  }

  if (!candidateText) {
    return fallbackRecords;
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(candidateText);
  } catch (error) {
    return fallbackRecords;
  }

  const sourceRecords = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
  const mappedRecords = [];

  for (const sourceRecord of sourceRecords) {
    if (!sourceRecord || typeof sourceRecord !== 'object' || Array.isArray(sourceRecord)) {
      continue;
    }

    const customerName = String(sourceRecord.customer_name ?? sourceRecord.customerName ?? '').trim();
    const customerType = String(sourceRecord.customer_type ?? sourceRecord.customerType ?? '').trim();
    const dealTheme = String(sourceRecord.deal_theme ?? sourceRecord.dealTheme ?? '').trim();
    const dealContent = String(sourceRecord.deal_content ?? sourceRecord.dealContent ?? '').trim();
    const todoItem = String(sourceRecord.todo_item ?? sourceRecord.todoItem ?? '').trim();
    const todoDeadline = String(sourceRecord.todo_deadline ?? sourceRecord.todoDeadline ?? '').trim();

    mappedRecords.push({
      customerName,
      customerType,
      dealTheme,
      dealContent,
      todoItem,
      todoDeadline,
      extractStatus: customerName && dealTheme && dealContent ? 'OK' : '要確認',
    });
  }

  if (!mappedRecords.length) {
    return fallbackRecords;
  }

  return mappedRecords;
}
