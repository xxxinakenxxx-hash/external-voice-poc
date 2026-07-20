const SUBMIT_MEMO_TIMEZONE_ = 'Asia/Tokyo';
const SUBMIT_MEMO_CREATED_AT_FORMAT_ = 'yyyy/MM/dd HH:mm:ss';

function submitMemo(payload) {
  const normalizedPayload = normalizeSubmitMemoPayload_(payload);
  const inputText = normalizedPayload.inputText;
  const userKey = String(normalizedPayload.userKey || '').trim();
  const inputMethod = String(normalizedPayload.inputMethod || '').trim();

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

  if (inputMethod !== '訪問' && inputMethod !== '電話') {
    return {
      success: false,
      errorMessage: '訪問か電話かを選んでください。',
    };
  }

  let customerStore;
  try {
    customerStore = resolveCustomerStore(normalizedPayload);
  } catch (error) {
    const errorCode = String(error && error.message ? error.message : error).trim();
    if (errorCode === 'STORE_NOT_SPECIFIED') {
      return {
        success: false,
        errorMessage: '商談先の店舗を指定してください。「現在地から店舗を探す」を押すか、店舗名で検索してください。',
      };
    }
    if (errorCode === 'STORE_NOT_FOUND') {
      return {
        success: false,
        errorMessage: '選んだ店舗が見つかりませんでした。もう一度、店舗を選び直してください。',
      };
    }
    if (errorCode === 'STORE_INACTIVE') {
      return {
        success: false,
        errorMessage: 'この店舗は現在使用できません。管理者に連絡してください。',
      };
    }

    return {
      success: false,
      errorMessage: '現在利用できません。しばらく経ってから再度お試しください',
    };
  }

  let latitude = normalizedPayload.latitude;
  let longitude = normalizedPayload.longitude;
  if (inputMethod === '電話') {
    latitude = '';
    longitude = '';
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
    const aiErrorType = classifyAiError_(error);
    logError('AI_API_ERROR', error && error.message ? error.message : String(error), {
      userKey,
      inputText,
    });

    if (aiErrorType === 'HTTP_4XX') {
      return {
        success: false,
        errorMessage: '現在利用できません。管理者に連絡してください。入力内容は保持しています。',
      };
    }

    if (aiErrorType === 'HTTP_5XX') {
      return {
        success: false,
        errorMessage: '現在利用できません。しばらく経ってから、もう一度送信してください。',
      };
    }

    return {
      success: false,
      errorMessage: '現在利用できません。しばらく経ってから、もう一度送信してください。',
    };
  }

  const parsedResult = parseAiResponseDetailed_(aiResponseText);
  const sourceRecords = parsedResult.parseSucceeded && Array.isArray(parsedResult.records) && parsedResult.records.length > 0
    ? parsedResult.records
    : [{
        customerType: '',
        dealTheme: '',
        dealContent: inputText,
        todoItem: '',
        todoDeadline: '',
        extractStatus: '要確認',
      }];

  const records = sourceRecords.map((record) => normalizeSubmitMemoRecord_(record, {
    registeredAt,
    branchName,
    userName,
    inputText,
    customerName: customerStore.customerName,
    customerStoreId: customerStore.customerStoreId,
    customerNameRaw: customerStore.customerNameRaw,
    visitStoreId: inputMethod === '訪問' && customerStore.customerStoreId ? customerStore.customerStoreId : '',
    inputMethod,
    latitude,
    longitude,
    userKey,
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
    customerName: String(customerStore.customerName || '').trim(),
    inputMethod,
    isUnregisteredStore: Boolean(customerStore.isUnregisteredStore),
  };
}

function normalizeSubmitMemoPayload_(payload) {
  const payloadObject = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};

  return {
    userKey: String(payloadObject.userKey ?? '').trim(),
    inputText: String(payloadObject.inputText ?? ''),
    inputMethod: String(payloadObject.inputMethod ?? '').trim(),
    customerStoreId: String(payloadObject.customerStoreId ?? '').trim(),
    customerNameRaw: String(payloadObject.customerNameRaw ?? '').trim(),
    latitude: normalizeSubmitMemoOptionalValue_(payloadObject.latitude),
    longitude: normalizeSubmitMemoOptionalValue_(payloadObject.longitude),
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
  const customerType = String(sourceRecord.customerType ?? sourceRecord.customer_type ?? '').trim();
  const dealTheme = String(sourceRecord.dealTheme ?? sourceRecord.deal_theme ?? '').trim();
  const dealContent = String(sourceRecord.dealContent ?? sourceRecord.deal_content ?? '').trim();
  const todoItem = String(sourceRecord.todoItem ?? sourceRecord.todo_item ?? '').trim();
  const todoDeadline = String(sourceRecord.todoDeadline ?? sourceRecord.todo_deadline ?? '').trim();
  const customerName = String(metadata.customerName || '').trim();
  const customerStoreId = String(metadata.customerStoreId || '').trim();
  const customerNameRaw = String(metadata.customerNameRaw || '').trim();
  const visitStoreId = String(metadata.visitStoreId || '').trim();
  const inputMethod = String(metadata.inputMethod || '').trim();
  const extractStatus = String(sourceRecord.extractStatus ?? sourceRecord.extract_status ?? '').trim() || (dealTheme && dealContent ? 'OK' : '要確認');

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
    customerStoreId,
    customerNameRaw,
    visitStoreId,
    inputMethod,
    userKey: String(metadata.userKey || '').trim(),
  };
}

function resolveCustomerStore(payload) {
  const payloadObject = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const customerStoreId = String(payloadObject.customerStoreId ?? '').trim();
  const customerNameRaw = String(payloadObject.customerNameRaw ?? '').trim();

  if (customerStoreId) {
    const storeRows = getStoreMasterRows_();
    const matchedStore = storeRows.find((row) => String(row.storeId || '').trim() === customerStoreId);

    if (!matchedStore) {
      throw new Error('STORE_NOT_FOUND');
    }

    if (String(matchedStore.activeFlag || '').trim() !== '有効') {
      throw new Error('STORE_INACTIVE');
    }

    return {
      customerName: String(matchedStore.storeName || '').trim(),
      customerStoreId,
      customerNameRaw: '',
      isUnregisteredStore: false,
    };
  }

  if (customerNameRaw) {
    return {
      customerName: customerNameRaw,
      customerStoreId: '',
      customerNameRaw,
      isUnregisteredStore: true,
    };
  }

  throw new Error('STORE_NOT_SPECIFIED');
}

function classifyAiError_(error) {
  const message = String(error && error.message ? error.message : error || '').trim();
  const match = message.match(/AI_HTTP_(\d{3})/);
  if (!match) {
    return 'TIMEOUT';
  }

  const statusCode = Number(match[1]);
  if (statusCode >= 400 && statusCode <= 499) {
    return 'HTTP_4XX';
  }

  if (statusCode >= 500 && statusCode <= 599) {
    return 'HTTP_5XX';
  }

  return 'TIMEOUT';
}
