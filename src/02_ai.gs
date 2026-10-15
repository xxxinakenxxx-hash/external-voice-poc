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
    '入力された商談メモを読み、案件テーマごとにレコードへ分割し、JSON配列だけを出力してください。',
    '',
    '【出力形式】',
    '- 出力はJSON配列のみ。前後に説明・見出し・コードブロック記号・挨拶を一切付けない。',
    '- 各要素は指定された11キーを持つ。キー名はこの通りに一致させる。',
    '  customer_type, deal_theme, deal_content, todo_item, todo_deadline, record_type, sa_recipient, sa_subject, sa_request_type, sa_decided_info, sa_deadline',
    '- record_type は "normal"／"issue"／"sa_case" のいずれか1つ。それ以外は文字列。該当しないSA項目は空文字 ""。各キーを省略しない。',
    '- 以下の説明例では一部キーを省略しているが、実際の出力では上記11キーを必ずすべて含める。',
    '- customer_name は出力しない。',
    '',
    '【各項目】',
    '- customer_type：顧客業態（製菓／製パン／外食／カフェ 等）を文脈から推定。判断できなければ ""。',
    '- deal_theme：分類語を含めず、案件の話題そのものを抽出する。分類語は保存前にGAS側でタイトルへ付ける。',
    '- sa_caseのdeal_themeには、依頼内容が分かる具体的な案件テーマを必ず設定する。「SA案件」や「SA案件｜」だけをdeal_themeとして返さない。例：商品Bの価格表を作る依頼なら「価格表作成」。',
    '- deal_content：その案件テーマに関する商談内容を、メモから抜き出して簡潔に整理する。',
    '- todo_item：営業が対応すべき宿題・ToDo。無ければ ""。',
    '- todo_deadline：宿題の期限。メモの表現をそのまま記録する（「急ぎ」「来月」「3/25」等）。日付に変換しない。',
    '- record_type：必ず1レコードにつき1分類だけを選ぶ。通常の案件テーマはnormal、顧客・案件側の課題として独立した話題はissue、「SA案件」と明示された依頼の話題はsa_case。分類を同じレコードに重ねない。',
    '- 課題は通常商談へラベルだけを追加せず、独立した話題として別レコードにする。通常商談・課題・SA案件が別々の案件テーマなら、それぞれ別レコードを出力する。顧客×案件テーマ単位の既存分割を維持し、関係のない話題を統合しない。',
    '- 例：同じ顧客について通常の価格商談・独立した納期課題・「SA案件」と明示された見積依頼が話された場合、normal／issue／sa_caseの3レコードを出す。1レコードに複数分類をまとめない。',
    '- issueレコードは課題の話題・内容をdeal_themeとdeal_contentに記録する。課題がない通常商談にissue分類を付けない。',
    '- sa_caseレコードは発話中に「SA案件」と明示された依頼だけを対象にする。通常商談や課題のレコードと統合しない。',
    '- sa_recipient / sa_subject / sa_request_type / sa_decided_info / sa_deadline：sa_caseレコードにだけ「誰に・何を・依頼の種類・決まっていること・いつまで」を記録する。推測せず不明は ""。「特になし」はそのまま記録する。これらは不足確認用でDBへ保存しない。',
    '- 入力末尾に不足確認への短い追記がある場合、入力全文を一体として再解析し、直前までのSA案件の文脈に照らして単語・短文を該当するsa_caseの不足項目へ割り当てる。回答文の整形や「追加回答」等の見出しを必須にしない。文脈上特定できない項目だけ空文字にする。',
    '',
    '【分割ルール】',
    '1. 顧客店舗は1つに確定している。顧客ごとに分けることはしない。',
    '2. 同じ顧客店舗でも複数の案件テーマがあれば、案件テーマごとに別レコードに分ける。',
    '3. 案件テーマが1つだけなら1レコード。',
    '4. 顧客名が明示されていなくても、案件テーマの分割は行う。',
    '',
    '【案件テーマの粒度（重要）】',
    '- 案件テーマは「商談の話題単位」で分ける。個別の商品名・品種・SKU 単位では分けない。',
    '- 例：「油脂の話。マーガリンとショートニング両方で見積もり」→ 油脂という1つの話題なので1レコード（案件テーマは「油脂（マーガリン・ショートニング）」）。',
    '- 例：「油脂の話。あとジェラートマシンの件」→ 別の話題なので2レコード。',
    '',
    '【不明・失敗時】',
    '- 抽出できない項目は "" にする。値を創作しない。',
    '- どうしても分割できない（極端に短い・意味をなさない）ときは、入力全体を1レコードにし、拾える項目だけ埋め、他は "" にする。',
    '',
    '【禁止】',
    '- 指定キー（customer_type, deal_theme, deal_content, todo_item, todo_deadline, record_type, sa_recipient, sa_subject, sa_request_type, sa_decided_info, sa_deadline）だけを出力する。',
    '- customer_name を出力しない。',
    '- JSON以外の文字を出力しない。',
    '- 宿題期限を日付に変換しない。',
    '- 品種・SKU 単位で分割しすぎない。',
    '',
    '次に示す入力例と出力例に倣ってください。',
    '',
    '### 例1：同一店舗内で部門・相手が異なる',
    '入力：',
    '```',
    '今日は○○ベーカリーで製パンの方と油脂の話をした。午後は同じ○○ベーカリーのカフェ担当からジェラートマシンの件。□□ホテルからは電話でチョコの見積もりを急ぎでと',
    '```',
    '出力：',
    '```json',
    '[',
    '  {"customer_type":"製パン","deal_theme":"油脂","deal_content":"製パンの方と油脂の話をした","todo_item":"","todo_deadline":""},',
    '  {"customer_type":"カフェ","deal_theme":"ジェラートマシン","deal_content":"同じ店舗のカフェ担当からジェラートマシンの件","todo_item":"","todo_deadline":""},',
    '  {"customer_type":"外食","deal_theme":"チョコレート見積","deal_content":"電話でチョコの見積もり依頼。急ぎ","todo_item":"見積作成","todo_deadline":"急ぎ"}',
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
    '  {"customer_type":"製パン","deal_theme":"クロワッサン用油脂","deal_content":"新しいクロワッサン用油脂の話。コストが上がる。サンプル提供の話","todo_item":"サンプル送付","todo_deadline":""},',
    '  {"customer_type":"製パン","deal_theme":"ジェラートマシン","deal_content":"来月まで保留","todo_item":"フォロー","todo_deadline":"来月"},',
    '  {"customer_type":"製パン","deal_theme":"チョコレート見積","deal_content":"チョコの見積もり依頼。急ぎ","todo_item":"見積作成","todo_deadline":"急ぎ"}',
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
    '  {"customer_type":"製パン","deal_theme":"油脂（マーガリン・ショートニング・バター）","deal_content":"マーガリンとショートニングの見積もり。バターも検討","todo_item":"見積作成","todo_deadline":""}',
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

function callAiApi(inputText, mode) {
  const inputTextText = String(inputText || '');
  if (!inputTextText.trim()) {
    throw new Error('inputText が空です。');
  }

  const apiKey = getAiApiKey();
  const systemPrompt = mode === 'daily_summary'
    ? 'あなたは営業日報の要約担当です。以下の当日の商談内容を、営業担当本人が一日の振り返りに使えるよう、重複なく要点を整理して自然な日本語の文章にまとめてください。必要な情報を落とさず、簡潔にまとめてください。箇条書きではなく文章で出力してください。固定の文字数制限は設けません。'
    : mode === 'briefing'
      ? [
          'あなたは営業担当の訪問準備を支援するアシスタントです。',
          '以下の商談メモ、追記、未完了ToDoから、訪問前に確認すべき内容を、重複を避けて簡潔な自然文にまとめてください。',
          '優先して含める情報：前回の訪問・商談内容、主な案件、未完了のToDo、次回確認事項、注意事項。',
          '固定文字数制限は設けず、必要な情報を途中で切らないでください。',
          '箇条書きではなく自然な文章で、JSONを返さず、余計な前置きを付けないでください。',
        ].join('\n')
      : getSystemPrompt();
  const requestPayload = mode === 'daily_summary' || mode === 'briefing'
    ? {
        model: OPENAI_MODEL_,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: inputTextText },
        ],
      }
    : buildAiRequestPayload(systemPrompt, inputTextText);

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
    throw new Error(`AI_HTTP_${statusCode}: OpenAI API request failed.`);
  }

  return response.getContentText();
}

function getDailyReportSummary(inputText) {
  const inputTextText = String(inputText || '').trim();
  if (!inputTextText) {
    return '';
  }

  return extractAiResponseContentText_(callAiApi(inputTextText, 'daily_summary'))
    .replace(/^[\s\-・*]+/gm, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function getDigestMemoSummary(inputText) {
  const inputTextText = String(inputText || '').trim();
  if (!inputTextText) {
    throw new Error('inputText が空です。');
  }

  const systemPrompt = [
    'あなたは商談メモの要約担当です。',
    '以下の商談メモを1行30文字以内の日本語で要約してください。',
    '管理職が「何が起きたか」を一目で判断できる要約にしてください。',
    '出力はテキストのみ。JSON・見出し・記号は不要です。',
  ].join('\n');
  const response = UrlFetchApp.fetch(OPENAI_API_URL_, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${getAiApiKey()}` },
    payload: JSON.stringify({
      model: OPENAI_MODEL_,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: inputTextText },
      ],
    }),
    muteHttpExceptions: true,
  });

  const statusCode = response.getResponseCode();
  if (statusCode !== 200) {
    throw new Error(`AI_HTTP_${statusCode}: OpenAI API request failed.`);
  }

  const summary = extractAiResponseContentText_(response.getContentText())
    .replace(/[\r\n]+/g, ' ')
    .trim();
  return summary.length > 30 ? `${summary.slice(0, 29)}…` : summary;
}

function getDigestOverviewSummary(inputText) {
  const inputTextText = String(inputText || '').trim();
  if (!inputTextText) {
    return '';
  }

  const response = UrlFetchApp.fetch(OPENAI_API_URL_, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${getAiApiKey()}` },
    payload: JSON.stringify({
      model: OPENAI_MODEL_,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'あなたは管理職向け日報の確認ポイント作成担当です。入力された商談記録に書かれている事実だけを使い、管理職が確認すべき点を日本語1〜2文で短く示してください。事実の追加、重要度の創作、推測は禁止です。テキストのみ出力してください。',
        },
        { role: 'user', content: inputTextText },
      ],
    }),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Digest overview AI request failed.');
  }

  return extractAiResponseContentText_(response.getContentText())
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function extractAiResponseContentText_(aiResponseText) {
  const rawText = String(aiResponseText || '').trim();
  if (!rawText) {
    return '';
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
    return '';
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

  return String(candidateText || '').trim();
}

function parseAiResponseDetailed_(aiResponseText) {
  const extractedText = extractAiResponseContentText_(aiResponseText);
  if (!extractedText) {
    return {
      parseSucceeded: false,
      records: [],
    };
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(extractedText);
  } catch (error) {
    return {
      parseSucceeded: false,
      records: [],
    };
  }

  const sourceRecords = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
  const records = [];

  for (const sourceRecord of sourceRecords) {
    if (!sourceRecord || typeof sourceRecord !== 'object' || Array.isArray(sourceRecord)) {
      continue;
    }

    const customerType = String(sourceRecord.customer_type ?? sourceRecord.customerType ?? '').trim();
    const dealTheme = String(sourceRecord.deal_theme ?? sourceRecord.dealTheme ?? '').trim();
    const dealContent = String(sourceRecord.deal_content ?? sourceRecord.dealContent ?? '').trim();
    const todoItem = String(sourceRecord.todo_item ?? sourceRecord.todoItem ?? '').trim();
    const todoDeadline = String(sourceRecord.todo_deadline ?? sourceRecord.todoDeadline ?? '').trim();
    const requestedRecordType = String(sourceRecord.record_type ?? sourceRecord.recordType ?? 'normal').trim();
    const recordType = ['normal', 'issue', 'sa_case'].includes(requestedRecordType) ? requestedRecordType : 'normal';

    records.push({
      customerType,
      dealTheme,
      dealContent,
      todoItem,
      todoDeadline,
      recordType,
      saRecipient: String(sourceRecord.sa_recipient ?? '').trim(),
      saSubject: String(sourceRecord.sa_subject ?? '').trim(),
      saRequestType: String(sourceRecord.sa_request_type ?? '').trim(),
      saDecidedInfo: String(sourceRecord.sa_decided_info ?? '').trim(),
      saDeadline: String(sourceRecord.sa_deadline ?? '').trim(),
      extractStatus: dealTheme && dealContent ? 'OK' : '要確認',
    });
  }

  if (!records.length) {
    return {
      parseSucceeded: false,
      records: [],
    };
  }

  return {
    parseSucceeded: true,
    records,
  };
}

function parseAiResponse(aiResponseText) {
  const parsedResult = parseAiResponseDetailed_(aiResponseText);
  if (!parsedResult.parseSucceeded) {
    return [{
      customerType: '',
      dealTheme: '',
      dealContent: '',
      todoItem: '',
      todoDeadline: '',
      recordType: 'normal',
      extractStatus: '要確認',
    }];
  }

  return parsedResult.records;
}
