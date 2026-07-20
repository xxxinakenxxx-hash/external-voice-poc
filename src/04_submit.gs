const SUBMIT_MEMO_TIMEZONE_ = 'Asia/Tokyo';
const SUBMIT_MEMO_CREATED_AT_FORMAT_ = 'yyyy/MM/dd HH:mm:ss';

function submitMemo(payload) {
  const normalizedPayload = normalizeSubmitMemoPayload_(payload);
  const inputText = normalizedPayload.inputText;
  const userKey = String(normalizedPayload.userKey || '').trim();

  if (!inputText.trim()) {
    return {
      success: false,
      errorMessage: '入力テキストがありません',
    };
  }

  if (!userKey) {
    return {
      success: false,
      errorMessage: '登録されていない担当者です。管理者に連絡してください。',
    };
  }

  let userRow;
  try {
    userRow = findUserMasterRow_(getUserMasterSheet_(), userKey);
  } catch (error) {
    return {
      success: false,
      errorMessage: '現在利用できません。しばらく経ってから再度お試しください',
    };
  }

  if (!userRow) {
    return {
      success: false,
      errorMessage: '登録されていない担当者です。管理者に連絡してください。',
    };
  }

  const userName = String(userRow.userName || '').trim();
  const branchName = String(lookupBranch(userKey) || userRow.branchName || '').trim();
  const registeredAt = Utilities.formatDate(
    new Date(),
    SUBMIT_MEMO_TIMEZONE_,
    SUBMIT_MEMO_CREATED_AT_FORMAT_,
  );

  let aiResponseText;
  try {
    aiResponseText = callAiApi(inputText);
  } catch (error) {
    logError('AI_API_ERROR', error && error.message ? error.message : String(error), {
      userKey,
      inputText,
    });
    return {
      success: false,
      errorMessage: '現在利用できません。しばらく経ってから再度お試しください',
    };
  }

  const parsedRecords = parseAiResponse(aiResponseText);
  const sourceRecords = Array.isArray(parsedRecords) && parsedRecords.length > 0
    ? parsedRecords
    : [{
        customerName: '',
        customerType: '',
        dealTheme: '',
        dealContent: '',
        todoItem: '',
        todoDeadline: '',
        extractStatus: '要確認',
      }];

  const records = sourceRecords.map((record) => normalizeSubmitMemoRecord_(record, {
    registeredAt,
    branchName,
    userName,
    inputText,
    latitude: normalizedPayload.latitude,
    longitude: normalizedPayload.longitude,
    storeName: normalizedPayload.storeName,
  }));

  try {
    writeRecordsToSheet(records);
  } catch (error) {
    logError('SHEET_WRITE_ERROR', error && error.message ? error.message : String(error), {
      userKey,
      inputText,
    });
    return {
      success: false,
      errorMessage: '保存に失敗しました。しばらく経ってから再度お試しください',
    };
  }

  return {
    success: true,
    recordCount: records.length,
    records: records.map((record) => ({
      customerName: String(record.customerName || '').trim(),
      dealTheme: String(record.dealTheme || '').trim(),
      todoItem: String(record.todoItem || '').trim(),
    })),
  };
}

function normalizeSubmitMemoPayload_(payload) {
  const payloadObject = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};

  return {
    userKey: String(payloadObject.userKey ?? '').trim(),
    inputText: String(payloadObject.inputText ?? ''),
    latitude: normalizeSubmitMemoOptionalValue_(payloadObject.latitude),
    longitude: normalizeSubmitMemoOptionalValue_(payloadObject.longitude),
    storeName: String(payloadObject.storeName ?? '').trim(),
  };
}

function normalizeSubmitMemoOptionalValue_(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return value;
}

function normalizeSubmitMemoRecord_(record, metadata) {
  const sourceRecord = record && typeof record === 'object' && !Array.isArray(record) ? record : {};
  const inputText = String(metadata.inputText || '');
  const customerName = String(sourceRecord.customerName ?? sourceRecord.customer_name ?? '').trim();
  const customerType = String(sourceRecord.customerType ?? sourceRecord.customer_type ?? '').trim();
  const dealTheme = String(sourceRecord.dealTheme ?? sourceRecord.deal_theme ?? '').trim();
  const dealContent = String(sourceRecord.dealContent ?? sourceRecord.deal_content ?? '').trim();
  const todoItem = String(sourceRecord.todoItem ?? sourceRecord.todo_item ?? '').trim();
  const todoDeadline = String(sourceRecord.todoDeadline ?? sourceRecord.todo_deadline ?? '').trim();
  const extractStatus = String(sourceRecord.extractStatus ?? sourceRecord.extract_status ?? '').trim() || (customerName && dealTheme && dealContent ? 'OK' : '要確認');

  return {
    customerName,
    customerType,
    dealTheme,
    dealContent,
    todoItem,
    todoDeadline,
    extractStatus,
    createdAt: metadata.registeredAt,
    registeredAt: metadata.registeredAt,
    branchName: String(metadata.branchName || '').trim(),
    userName: String(metadata.userName || '').trim(),
    originalText: inputText,
    inputText,
    latitude: metadata.latitude,
    longitude: metadata.longitude,
    storeName: String(metadata.storeName || '').trim(),
  };
}
