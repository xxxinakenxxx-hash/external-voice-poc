function getChatWebhookUrl(target) {
  const propertyName = getChatWebhookPropertyName_(target);
  const webhookUrl = PropertiesService.getScriptProperties().getProperty(propertyName);

  if (typeof webhookUrl !== 'string' || webhookUrl.trim() === '') {
    throw new Error('Chat webhook URL is not configured for the selected target.');
  }

  return webhookUrl.trim();
}

function sendChatMessage(target, text) {
  if (text == null) {
    throw new Error('Chat message text must not be empty.');
  }

  const messageText = String(text);
  if (messageText.trim() === '') {
    throw new Error('Chat message text must not be empty.');
  }

  const webhookUrl = getChatWebhookUrl(target);
  const response = UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    payload: JSON.stringify({ text: messageText }),
    muteHttpExceptions: true,
  });

  return {
    statusCode: response.getResponseCode(),
    responseBody: response.getContentText(),
  };
}

function getChatWebhookPropertyName_(target) {
  if (target === 'sales') {
    return 'CHAT_WEBHOOK_SALES';
  }

  if (target === 'manager') {
    return 'CHAT_WEBHOOK_MANAGER';
  }

  throw new Error('Unsupported Chat webhook target.');
}

const OUTPUT_CONFIG_SHEET_NAME_ = 'output_config';
const SEARCH_RESULT_LIMIT_ = 30;
const OUTPUT_CONFIG_DEFAULTS_ = [
  { key: 'daily_report_enabled', value: true, description: '個人日報通知の有効・無効' },
  { key: 'manager_summary_enabled', value: true, description: '管理職向け日報まとめ通知の有効・無効' },
  { key: 'send_hour', value: 18, description: '配信時刻（時）' },
  { key: 'collect_from_hour', value: 0, description: '日次集計の開始時刻' },
  { key: 'collect_to_hour', value: 18, description: '日次集計の終了時刻' },
  { key: 'skip_weekend', value: true, description: '土日の配信を停止するか' },
];

var ADDITION_ID_TIMESTAMP_ = '';
var ADDITION_ID_SEQUENCE_ = 0;

function setupOutputConfig() {
  const spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
  let sheet = spreadsheet.getSheetByName(OUTPUT_CONFIG_SHEET_NAME_);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(OUTPUT_CONFIG_SHEET_NAME_);
  }

  const existingKeys = new Set();
  const lastRow = sheet.getLastRow();
  const existingRange = lastRow > 0 ? sheet.getRange(1, 1, lastRow, 3).getValues() : [];

  for (let rowIndex = 0; rowIndex < existingRange.length; rowIndex += 1) {
    const row = existingRange[rowIndex];
    const key = String(row[0] || '').trim();
    if (key && key !== 'key') {
      existingKeys.add(key);
    }
  }

  if (lastRow === 0) {
    sheet.getRange(1, 1, 1, 3).setValues([['key', 'value', 'description']]);
  }

  const rowsToAppend = OUTPUT_CONFIG_DEFAULTS_.filter((item) => !existingKeys.has(item.key)).map((item) => [
    item.key,
    item.value,
    item.description,
  ]);

  if (rowsToAppend.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rowsToAppend.length, 3).setValues(rowsToAppend);
  }
}

function getOutputConfig() {
  const defaults = {
    dailyReportEnabled: true,
    managerSummaryEnabled: true,
    sendHour: 18,
    collectFromHour: 0,
    collectToHour: 18,
    skipWeekend: true,
  };

  try {
    const spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
    const sheet = spreadsheet.getSheetByName(OUTPUT_CONFIG_SHEET_NAME_);
    if (!sheet) {
      return { ...defaults };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 1) {
      return { ...defaults };
    }

    const values = sheet.getRange(1, 1, lastRow, 3).getValues();
    const config = { ...defaults };
    const startRowIndex = isOutputConfigHeaderRow_(values[0]) ? 1 : 0;

    for (let rowIndex = startRowIndex; rowIndex < values.length; rowIndex += 1) {
      const row = values[rowIndex];
      const key = String(row[0] || '').trim();
      if (!key) {
        continue;
      }

      const rawValue = row[1];
      if (key === 'daily_report_enabled') {
        const parsedValue = parseOutputConfigBoolean_(rawValue);
        if (parsedValue !== null) {
          config.dailyReportEnabled = parsedValue;
        }
        continue;
      }

      if (key === 'manager_summary_enabled') {
        const parsedValue = parseOutputConfigBoolean_(rawValue);
        if (parsedValue !== null) {
          config.managerSummaryEnabled = parsedValue;
        }
        continue;
      }

      if (key === 'send_hour') {
        const parsedValue = parseOutputConfigNumber_(rawValue);
        if (parsedValue !== null) {
          config.sendHour = parsedValue;
        }
        continue;
      }

      if (key === 'collect_from_hour') {
        const parsedValue = parseOutputConfigNumber_(rawValue);
        if (parsedValue !== null) {
          config.collectFromHour = parsedValue;
        }
        continue;
      }

      if (key === 'collect_to_hour') {
        const parsedValue = parseOutputConfigNumber_(rawValue);
        if (parsedValue !== null) {
          config.collectToHour = parsedValue;
        }
        continue;
      }

      if (key === 'skip_weekend') {
        const parsedValue = parseOutputConfigBoolean_(rawValue);
        if (parsedValue !== null) {
          config.skipWeekend = parsedValue;
        }
      }
    }

    return { ...config };
  } catch (error) {
    return { ...defaults };
  }
}

function runDailyDelivery() {
  const config = getOutputConfig();
  const now = new Date();
  const dayOfWeek = Number(Utilities.formatDate(now, WRITE_RECORD_TIMEZONE_, 'u'));
  const currentHour = Number(Utilities.formatDate(now, WRITE_RECORD_TIMEZONE_, 'H'));

  if (config.skipWeekend && (dayOfWeek === 6 || dayOfWeek === 7)) {
    return;
  }

  if (currentHour !== Number(config.sendHour)) {
    return;
  }

  if (config.dailyReportEnabled === true) {
    try {
      notifyDailyReport();
    } catch (error) {
      logError('OUT04_DAILY_NOTIFY_ERROR', error && error.message ? error.message : String(error), {});
    }
  }

  if (config.managerSummaryEnabled === true) {
    try {
      notifyManagerSummary();
    } catch (error) {
      logError('OUT04_MANAGER_NOTIFY_ERROR', error && error.message ? error.message : String(error), {});
    }
  }
}

function getDailyReportUrl() {
  const dailyReportUrl = PropertiesService.getScriptProperties().getProperty('DAILY_REPORT_URL');

  if (typeof dailyReportUrl !== 'string' || dailyReportUrl.trim() === '') {
    throw new Error('Daily report URL is not configured.');
  }

  return dailyReportUrl.trim();
}

function notifyDailyReport() {
  const dailyReportUrl = getDailyReportUrl();
  return sendChatMessage('sales', `日報ができました。ここから確認 → ${dailyReportUrl}`);
}

function getManagerSummaryUrl() {
  const dailyReportUrl = getDailyReportUrl();
  const queryIndex = dailyReportUrl.indexOf('?');
  const fragmentIndex = dailyReportUrl.indexOf('#');
  let baseUrl = dailyReportUrl;

  if (queryIndex >= 0 || fragmentIndex >= 0) {
    const cutPoints = [queryIndex, fragmentIndex].filter((index) => index >= 0);
    const cutIndex = Math.min.apply(null, cutPoints);
    baseUrl = dailyReportUrl.slice(0, cutIndex);
  }

  return `${baseUrl}?view=summary`;
}

function notifyManagerSummary() {
  const managerSummaryUrl = getManagerSummaryUrl();
  return sendChatMessage('manager', `日報まとめができました。ここから確認 → ${managerSummaryUrl}`);
}

function getManagerSummaryData() {
  try {
    const result = getMyDealRecords('summary');
    if (!result || result.success !== true || !Array.isArray(result.records)) {
      return [];
    }

    return result.records;
  } catch (error) {
    return [];
  }
}

function getMyDealRecords(viewName, validationOverride, searchOptions) {
  const normalizedViewName = normalizeMyDealRecordsViewName_(viewName);
  if (!normalizedViewName) {
    return {
      success: false,
      records: [],
      errorMessage: '表示対象が不正です。',
    };
  }

  const validation = validationOverride && typeof validationOverride === 'object'
    ? validationOverride
    : validateUser();

  if (!validation || validation.valid !== true) {
    return {
      success: false,
      records: [],
      errorMessage: String(validation && validation.errorMessage ? validation.errorMessage : '日報を表示できませんでした。'),
    };
  }

  const role = String(validation.role || '').trim();
  if (normalizedViewName === 'daily' && !isDailyRecordEditorRole_(role)) {
    return {
      success: false,
      records: [],
      errorMessage: 'このページを表示する権限がありません',
    };
  }

  if (normalizedViewName === 'summary' && !isSummaryViewer_(role)) {
    return {
      success: false,
      records: [],
      errorMessage: 'このページを表示する権限がありません',
    };
  }

  const normalizedSearch = normalizeMyDealRecordSearchOptions_(normalizedViewName, searchOptions);
  if (!normalizedSearch.success) {
    return {
      success: false,
      records: [],
      errorMessage: normalizedSearch.errorMessage,
    };
  }

  let sheet;
  try {
    sheet = getDealRecordsSheet_();
  } catch (error) {
    return {
      success: false,
      records: [],
      errorMessage: String(error && error.message ? error.message : '日報を表示できませんでした。'),
    };
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return {
      success: true,
      records: [],
      errorMessage: '',
    };
  }

  const indexes = getDailyReportColumnIndexes_(values[0]);
  const now = new Date();
  const config = getOutputConfig();
  const candidates = [];
  const ownUserKey = String(validation.userKey || '').trim();
  const normalizedOwnUserKey = normalizeTodoUserKeyForComparison_(ownUserKey);
  const activeTodoSourceRecordIds = normalizedViewName === 'daily'
    ? getActiveTodoSourceRecordIdsForDailyView_(ownUserKey)
    : new Set();
  const sameBranchUserKeys = normalizedViewName === 'summary' && ['manager'].includes(role)
    ? new Set(getUserKeysInSameBranch_(String(validation.branchName || '').trim()))
    : null;

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const createdAt = parseDailyReportCreatedAt_(row[indexes.createdAt]);
    if (!createdAt) {
      continue;
    }

    if (!isWithinMyDealRecordSearchPeriod_(createdAt, now, config, normalizedSearch)) {
      continue;
    }

    const rowUserKey = String(row[indexes.userKey] || '').trim();

    if (normalizedViewName === 'daily') {
      if (role === 'sales' && rowUserKey !== ownUserKey) {
        continue;
      }
    } else if (['manager'].includes(role) && (!sameBranchUserKeys || !sameBranchUserKeys.has(rowUserKey))) {
      continue;
    }

    if (normalizedSearch.staffUserKey && rowUserKey !== normalizedSearch.staffUserKey) {
      continue;
    }

    if (normalizedSearch.staffName
      && String(row[indexes.userName] || '').trim() !== normalizedSearch.staffName) {
      continue;
    }

    const recordDisplay = buildDealRecordDisplay_(row, indexes, createdAt);
    recordDisplay.canAdd = canAddDealAddition_(role, ownUserKey, rowUserKey);
    recordDisplay.canCreateTodo = normalizedViewName === 'daily'
      && normalizeTodoUserKeyForComparison_(rowUserKey) === normalizedOwnUserKey;
    recordDisplay.hasActiveTodo = activeTodoSourceRecordIds.has(recordDisplay.recordId);
    candidates.push({ record: recordDisplay, row });
  }

  const additionsByCandidateRecordId = getDealAdditionsByRecordIds_(
    candidates.map((candidate) => candidate.record.recordId),
  );
  const records = candidates
    .filter((candidate) => isMyDealRecordSearchMatch_(
      candidate.row,
      indexes,
      candidate.record,
      additionsByCandidateRecordId[candidate.record.recordId],
      normalizedSearch,
      normalizedViewName,
    ))
    .map((candidate) => candidate.record);

  records.sort((left, right) => {
    const leftTime = left.createdAtSortKey ? left.createdAtSortKey.getTime() : 0;
    const rightTime = right.createdAtSortKey ? right.createdAtSortKey.getTime() : 0;
    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return String(right.recordId || '').localeCompare(String(left.recordId || ''), 'ja');
  });

  const limitedRecords = records.slice(0, SEARCH_RESULT_LIMIT_);

  const enrichedRecords = limitedRecords.map((record) => {
    const additions = Array.isArray(additionsByCandidateRecordId[record.recordId])
      ? additionsByCandidateRecordId[record.recordId]
      : [];
    return {
      recordId: record.recordId,
      createdAtLabel: record.createdAtLabel,
      dateLabel: record.dateLabel,
      timeLabel: record.timeLabel,
      branchName: record.branchName,
      userName: record.userName,
      customerName: record.customerName,
      todoItem: record.todoItem,
      deadlineNormalized: record.deadlineNormalized,
      inputMethod: record.inputMethod,
      dealTheme: record.dealTheme,
      dealContent: record.dealContent,
      dealSummary: record.dealSummary,
      canAdd: record.canAdd === true,
      canCreateTodo: record.canCreateTodo === true,
      hasActiveTodo: record.hasActiveTodo === true,
      additions,
    };
  });

  return {
    success: true,
    records: enrichedRecords,
    errorMessage: '',
  };
}

function normalizeMyDealRecordSearchOptions_(viewName, searchOptions) {
  const options = searchOptions && typeof searchOptions === 'object' ? searchOptions : {};
  const defaultPeriod = viewName === 'daily' ? 'last_30_days' : 'today';
  const period = String(options.period || defaultPeriod).trim().toLowerCase();
  const allowedPeriods = ['today', 'previous_day', 'last_7_days', 'last_30_days', 'custom'];
  if (!allowedPeriods.includes(period)) {
    return { success: false, errorMessage: 'Invalid search period.' };
  }

  const startDateText = String(options.startDate || '').trim();
  const endDateText = String(options.endDate || '').trim();
  const customStartDate = period === 'custom' ? parseMyDealRecordSearchDate_(startDateText, false) : null;
  const customEndDate = period === 'custom' ? parseMyDealRecordSearchDate_(endDateText, true) : null;
  if (period === 'custom' && (!customStartDate || !customEndDate)) {
    return { success: false, errorMessage: 'Enter a valid start date and end date.' };
  }

  if (customStartDate && customEndDate && customStartDate.getTime() > customEndDate.getTime()) {
    return { success: false, errorMessage: 'The start date must not be later than the end date.' };
  }

  return {
    success: true,
    period,
    startDate: customStartDate,
    endDate: customEndDate,
    keyword: normalizeMyDealRecordSearchText_(options.keyword),
    staffUserKey: viewName === 'summary' ? String(options.staffUserKey || '').trim() : '',
    staffName: viewName === 'summary' ? String(options.staffName || '').trim() : '',
  };
}

function parseMyDealRecordSearchDate_(value, endOfDay) {
  const normalizedValue = String(value || '').trim().replace(/-/g, '/');
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(normalizedValue)) {
    return null;
  }

  try {
    const parsedDate = Utilities.parseDate(
      `${normalizedValue} ${endOfDay ? '23:59:59' : '00:00:00'}`,
      WRITE_RECORD_TIMEZONE_,
      'yyyy/MM/dd HH:mm:ss',
    );
    const normalizedDateText = Utilities.formatDate(parsedDate, WRITE_RECORD_TIMEZONE_, 'yyyy/MM/dd');
    return normalizedDateText === normalizedValue ? parsedDate : null;
  } catch (error) {
    return null;
  }
}

function isWithinMyDealRecordSearchPeriod_(createdAt, currentDate, config, searchOptions) {
  let startDate;
  let endDate;
  const today = new Date(currentDate.getTime());
  const todayText = Utilities.formatDate(today, WRITE_RECORD_TIMEZONE_, 'yyyy/MM/dd');

  if (searchOptions.period === 'custom') {
    startDate = getCollectionWindowStart_(searchOptions.startDate, config.collectFromHour);
    endDate = getCollectionWindowEnd_(searchOptions.endDate, currentDate, config.collectToHour);
  } else if (searchOptions.period === 'previous_day') {
    const previousDay = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    startDate = getCollectionWindowStart_(previousDay, config.collectFromHour);
    endDate = getCollectionWindowEnd_(previousDay, currentDate, config.collectToHour);
  } else {
    const dayCount = searchOptions.period === 'last_7_days'
      ? 7
      : searchOptions.period === 'last_30_days'
        ? 30
        : 1;
    const firstDay = new Date(today.getTime() - (dayCount - 1) * 24 * 60 * 60 * 1000);
    startDate = getCollectionWindowStart_(firstDay, config.collectFromHour);
    endDate = getCollectionWindowEnd_(today, currentDate, config.collectToHour);
  }

  if (searchOptions.period === 'today' && todayText !== Utilities.formatDate(createdAt, WRITE_RECORD_TIMEZONE_, 'yyyy/MM/dd')) {
    return false;
  }

  return createdAt.getTime() >= startDate.getTime() && createdAt.getTime() <= endDate.getTime();
}

function isMyDealRecordSearchMatch_(row, indexes, record, additions, searchOptions, viewName) {
  if (!searchOptions.keyword) {
    return true;
  }

  const searchableValues = [
    row[indexes.customerName],
    indexes.storeName >= 0 ? row[indexes.storeName] : '',
    row[indexes.dealTheme],
    row[indexes.dealContent],
  ];
  if (viewName === 'daily') {
    searchableValues.push(row[indexes.todoItem]);
  }

  (Array.isArray(additions) ? additions : []).forEach((addition) => {
    searchableValues.push(addition.additionalRecord);
  });

  return searchableValues.some((value) => normalizeMyDealRecordSearchText_(value).includes(searchOptions.keyword));
}

function normalizeMyDealRecordSearchText_(value) {
  return String(value || '').replace(/[\s\u3000]+/g, ' ').trim().toLowerCase();
}

function normalizeTodoUserKeyForComparison_(value) {
  return String(value || '').trim().toLowerCase();
}

function getActiveTodoSourceRecordIdsForDailyView_(userKey) {
  const normalizedUserKey = normalizeTodoUserKeyForComparison_(userKey);
  if (!normalizedUserKey) {
    return new Set();
  }

  let sheet;
  try {
    sheet = getTodoTasksSheet_();
  } catch (error) {
    return new Set();
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return new Set();
  }

  const indexes = getTodoTasksColumnIndexes_(values[0]);
  const sourceRecordIds = new Set();

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const rowUserKey = normalizeTodoUserKeyForComparison_(row[indexes.userKey]);
    if (rowUserKey !== normalizedUserKey) {
      continue;
    }

    const sourceRecordId = String(row[indexes.sourceRecordId] || '').trim();
    if (!sourceRecordId) {
      continue;
    }

    sourceRecordIds.add(sourceRecordId);
  }

  return sourceRecordIds;
}

function addDealAddition(recordId, additionalRecord) {
  const activeUserEmail = String(Session.getActiveUser().getEmail() || '').trim();
  const validation = validateUser();
  const normalizedRecordId = String(recordId || '').trim();
  const normalizedAdditionalRecord = String(additionalRecord || '').trim();

  if (!validation || validation.valid !== true) {
    return {
      success: false,
      errorMessage: String(validation && validation.errorMessage ? validation.errorMessage : '追記画面を表示できませんでした。'),
    };
  }

  if (!normalizedAdditionalRecord) {
    return {
      success: false,
      errorMessage: '追記内容を入力してください',
    };
  }

  if (!normalizedRecordId) {
    return {
      success: false,
      errorMessage: '対象の商談記録が見つかりません',
    };
  }

  const role = String(validation.role || '').trim();
  const foundRecord = findDealRecordById_(normalizedRecordId);
  if (!foundRecord) {
    return {
      success: false,
      errorMessage: '対象の商談記録が見つかりません',
    };
  }

  const targetUserKey = String(foundRecord.row[foundRecord.indexes.userKey] || '').trim();
  if (!canAddDealAddition_(role, String(validation.userKey || '').trim(), targetUserKey)) {
    return {
      success: false,
      errorMessage: 'この商談記録には追記できません',
    };
  }

  let sheet;
  try {
    sheet = getDealAdditionsSheet_();
  } catch (error) {
    logError('SHEET_WRITE_ERROR', error && error.message ? error.message : String(error), {
      userKey: String(validation.userKey || '').trim(),
      inputText: normalizedAdditionalRecord,
    });
    return {
      success: false,
      errorMessage: '保存に失敗しました。しばらく経ってから、もう一度お試しください。',
    };
  }

  const additionId = generateAdditionId_();
  const addedAt = Utilities.formatDate(new Date(), WRITE_RECORD_TIMEZONE_, WRITE_RECORD_CREATED_AT_FORMAT_);
  const addedBy = activeUserEmail || String(validation.userKey || '').trim();

  try {
    sheet.appendRow([
      additionId,
      normalizedRecordId,
      normalizedAdditionalRecord,
      addedAt,
      addedBy,
    ]);
  } catch (error) {
    logError('SHEET_WRITE_ERROR', error && error.message ? error.message : String(error), {
      userKey: String(validation.userKey || '').trim(),
      inputText: normalizedAdditionalRecord,
    });
    return {
      success: false,
      errorMessage: '保存に失敗しました。しばらく経ってから、もう一度お試しください。',
    };
  }

  return {
    success: true,
    additionId,
    addedAt,
    addedByName: String(validation.userName || '').trim(),
  };
}

function getDailyReportData(userKey) {
  const normalizedUserKey = String(userKey || '').trim();
  if (!normalizedUserKey) {
    throw new Error('userKey は必須です。');
  }

  const config = getOutputConfig();
  const sheet = getDealRecordsSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  const indexes = getDailyReportColumnIndexes_(values[0]);
  const now = new Date();
  const cutoffDate = new Date(now.getTime());
  cutoffDate.setDate(cutoffDate.getDate() - 29);
  const collectionStart = getCollectionWindowStart_(cutoffDate, config.collectFromHour);
  const collectedRecords = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const rowUserKey = String(row[indexes.userKey] || '').trim();
    if (rowUserKey !== normalizedUserKey) {
      continue;
    }

    const createdAt = parseDailyReportCreatedAt_(row[indexes.createdAt]);
    if (!createdAt) {
      continue;
    }

    if (createdAt.getTime() < collectionStart.getTime()) {
      continue;
    }

    if (!isWithinCollectionWindow_(createdAt, now, config)) {
      continue;
    }

    collectedRecords.push(buildDealRecordDisplay_(row, indexes, createdAt));
  }

  collectedRecords.sort((left, right) => {
    const leftTime = left.createdAtSortKey ? left.createdAtSortKey.getTime() : 0;
    const rightTime = right.createdAtSortKey ? right.createdAtSortKey.getTime() : 0;
    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return String(right.recordId || '').localeCompare(String(left.recordId || ''), 'ja');
  });

  const additionsByRecordId = getDealAdditionsByRecordIds_(collectedRecords.map((record) => record.recordId));
  const displayRecords = collectedRecords.map((record) => ({
    recordId: record.recordId,
    createdAtLabel: record.createdAtLabel,
    dateLabel: record.dateLabel,
    timeLabel: record.timeLabel,
    branchName: record.branchName,
    userName: record.userName,
    customerName: record.customerName,
    inputMethod: record.inputMethod,
    dealTheme: record.dealTheme,
    dealContent: record.dealContent,
    dealSummary: record.dealSummary,
    additions: Array.isArray(additionsByRecordId[record.recordId]) ? additionsByRecordId[record.recordId] : [],
  }));

  return groupDailyReportRecords_(displayRecords);
}

function getDealRecordsSheet_() {
  const spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
  const sheet = spreadsheet.getSheetByName('deal_records');

  if (!sheet) {
    throw new Error('deal_records シートが見つかりません');
  }

  return sheet;
}

function getDealAdditionsSheet_() {
  const spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
  const sheet = spreadsheet.getSheetByName('deal_additions');

  if (!sheet) {
    throw new Error('deal_additions シートが見つかりません');
  }

  return sheet;
}

function findDealRecordById_(recordId) {
  const normalizedRecordId = String(recordId || '').trim();
  if (!normalizedRecordId) {
    return null;
  }

  const sheet = getDealRecordsSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return null;
  }

  const indexes = getDailyReportColumnIndexes_(values[0]);
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const currentRecordId = String(row[indexes.recordId] || '').trim();
    if (currentRecordId !== normalizedRecordId) {
      continue;
    }

    return {
      row,
      rowNumber: rowIndex + 1,
      indexes,
    };
  }

  return null;
}

function getDealAdditionsByRecordIds_(recordIds) {
  const normalizedRecordIds = Array.isArray(recordIds)
    ? [...new Set(recordIds.map((recordId) => String(recordId || '').trim()).filter((recordId) => recordId))]
    : [];

  if (normalizedRecordIds.length === 0) {
    return {};
  }

  let sheet;
  try {
    sheet = getDealAdditionsSheet_();
  } catch (error) {
    return {};
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return {};
  }

  const indexes = getDealAdditionsColumnIndexes_(values[0]);
  const userNameMap = buildUserNameMap_();
  const recordIdSet = new Set(normalizedRecordIds);
  const additionsByRecordId = {};

  for (const recordId of normalizedRecordIds) {
    additionsByRecordId[recordId] = [];
  }

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const recordId = String(row[indexes.recordId] || '').trim();
    if (!recordId || !recordIdSet.has(recordId)) {
      continue;
    }

    const addedAt = parseDailyReportCreatedAt_(row[indexes.addedAt]);
    if (!addedAt) {
      continue;
    }

    additionsByRecordId[recordId].push({
      additionId: String(row[indexes.additionId] || '').trim(),
      additionalRecord: String(row[indexes.additionalRecord] || '').trim(),
      addedAtSortKey: addedAt,
      addedAtLabel: Utilities.formatDate(addedAt, WRITE_RECORD_TIMEZONE_, WRITE_RECORD_CREATED_AT_FORMAT_),
      addedByName: userNameMap.get(String(row[indexes.addedBy] || '').trim()) || '不明',
    });
  }

  Object.keys(additionsByRecordId).forEach((recordId) => {
    additionsByRecordId[recordId].sort((left, right) => {
      const leftTime = left.addedAtSortKey ? left.addedAtSortKey.getTime() : 0;
      const rightTime = right.addedAtSortKey ? right.addedAtSortKey.getTime() : 0;
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return String(left.additionId || '').localeCompare(String(right.additionId || ''), 'ja');
    });

    additionsByRecordId[recordId] = additionsByRecordId[recordId].map((addition) => ({
      additionId: addition.additionId,
      additionalRecord: addition.additionalRecord,
      addedAtLabel: addition.addedAtLabel,
      addedByName: addition.addedByName,
    }));
  });

  return additionsByRecordId;
}

function canAddDealAddition_(role, currentUserKey, recordUserKey) {
  const normalizedRole = String(role || '').trim();
  const normalizedCurrentUserKey = String(currentUserKey || '').trim();
  const normalizedRecordUserKey = String(recordUserKey || '').trim();

  if (!normalizedCurrentUserKey || !normalizedRecordUserKey) {
    return false;
  }

  if (normalizedRole === 'sysadmin') {
    return true;
  }

  if ((normalizedRole === 'sales' || normalizedRole === 'manager') && normalizedCurrentUserKey === normalizedRecordUserKey) {
    return true;
  }

  return false;
}

function getUserKeysInSameBranch_(branchName) {
  const normalizedBranchName = String(branchName || '').trim();
  if (!normalizedBranchName) {
    return [];
  }

  try {
    const userRows = getUserMasterRows_();
    const userKeys = [];
    const seen = new Set();

    for (const row of userRows) {
      const rowBranchName = String(row.branchName || '').trim();
      const rowUserKey = String(row.userKey || '').trim();
      if (!rowUserKey || rowBranchName !== normalizedBranchName || seen.has(rowUserKey)) {
        continue;
      }

      seen.add(rowUserKey);
      userKeys.push(rowUserKey);
    }

    userKeys.sort((left, right) => String(left || '').localeCompare(String(right || ''), 'ja'));
    return userKeys;
  } catch (error) {
    return [];
  }
}

function generateAdditionId_() {
  const normalizedTimestamp = Utilities.formatDate(new Date(), WRITE_RECORD_TIMEZONE_, WRITE_RECORD_ID_FORMAT_);
  if (ADDITION_ID_TIMESTAMP_ !== normalizedTimestamp) {
    ADDITION_ID_TIMESTAMP_ = normalizedTimestamp;
    ADDITION_ID_SEQUENCE_ = 0;
  }

  ADDITION_ID_SEQUENCE_ += 1;
  return `ADD-${ADDITION_ID_TIMESTAMP_}-${String(ADDITION_ID_SEQUENCE_).padStart(3, '0')}`;
}

function buildUserNameMap_() {
  const map = new Map();

  try {
    const userRows = getUserMasterRows_();
    for (const row of userRows) {
      const userKey = String(row.userKey || '').trim();
      if (!userKey) {
        continue;
      }

      map.set(userKey, String(row.userName || '').trim());
    }
  } catch (error) {
    return map;
  }

  return map;
}

function buildDealRecordDisplay_(row, indexes, createdAt) {
  const recordId = String(row[indexes.recordId] || '').trim();
  const branchName = String(row[indexes.branchName] || '').trim();
  const userName = String(row[indexes.userName] || '').trim();
  const customerName = String(row[indexes.customerName] || '').trim();
  const todoItem = String(row[indexes.todoItem] || '').trim();
  const deadlineNormalized = normalizeTodoDueDate_(row[indexes.deadlineNormalized]);
  const inputMethod = String(row[indexes.inputMethod] || '').trim();
  const dealTheme = String(row[indexes.dealTheme] || '').trim();
  const dealContent = String(row[indexes.dealContent] || '').trim();
  const dealSummary = buildDailyReportSummary_(dealTheme, dealContent);

  return {
    recordId,
    createdAtSortKey: createdAt,
    createdAtLabel: Utilities.formatDate(createdAt, WRITE_RECORD_TIMEZONE_, WRITE_RECORD_CREATED_AT_FORMAT_),
    dateLabel: Utilities.formatDate(createdAt, WRITE_RECORD_TIMEZONE_, 'yyyy/MM/dd'),
    timeLabel: Utilities.formatDate(createdAt, WRITE_RECORD_TIMEZONE_, 'HH:mm'),
    branchName,
    userName,
    customerName,
    todoItem,
    deadlineNormalized,
    inputMethod,
    dealTheme,
    dealContent,
    dealSummary,
    canAdd: false,
    canCreateTodo: false,
    hasActiveTodo: false,
  };
}

function normalizeMyDealRecordsViewName_(viewName) {
  const normalizedViewName = String(viewName || '').trim();
  if (normalizedViewName === 'daily' || normalizedViewName === 'summary') {
    return normalizedViewName;
  }

  return '';
}

function isWithinMyDealRecordWindow_(viewName, createdAt, currentDate, config) {
  const normalizedViewName = normalizeMyDealRecordsViewName_(viewName);
  if (!normalizedViewName) {
    return false;
  }

  const windowStart = normalizedViewName === 'daily'
    ? getCollectionWindowStart_(new Date(currentDate.getTime() - 29 * 24 * 60 * 60 * 1000), config.collectFromHour)
    : getCollectionWindowStart_(currentDate, config.collectFromHour);

  if (createdAt.getTime() < windowStart.getTime()) {
    return false;
  }

  return isWithinCollectionWindow_(createdAt, currentDate, config);
}

function getDailyReportColumnIndexes_(headers) {
  const normalizedHeaders = Array.isArray(headers)
    ? headers.map((header) => String(header || '').trim())
    : [];

  const recordIdIndex = normalizedHeaders.indexOf('record_id');
  const createdAtIndex = normalizedHeaders.indexOf('created_at');
  const todoItemIndex = normalizedHeaders.indexOf('todo_item');
  const deadlineNormalizedIndex = normalizedHeaders.indexOf('deadline_normalized');
  const branchNameIndex = normalizedHeaders.indexOf('branch_name');
  const userNameIndex = normalizedHeaders.indexOf('user_name');
  const customerNameIndex = normalizedHeaders.indexOf('customer_name');
  const storeNameIndex = [
    'store_name_gps',
    'store_name',
    'store_name_normalized',
  ].map((header) => normalizedHeaders.indexOf(header)).find((index) => index >= 0);
  const dealThemeIndex = normalizedHeaders.indexOf('deal_theme');
  const dealContentIndex = normalizedHeaders.indexOf('deal_content');
  const inputMethodIndex = normalizedHeaders.indexOf('input_method');
  const userKeyIndex = normalizedHeaders.indexOf('user_key');

  if ([
    recordIdIndex,
    createdAtIndex,
    todoItemIndex,
    deadlineNormalizedIndex,
    branchNameIndex,
    userNameIndex,
    customerNameIndex,
    dealThemeIndex,
    dealContentIndex,
    inputMethodIndex,
    userKeyIndex,
  ].some((index) => index < 0)) {
    throw new Error('deal_records の見出しが不正です。');
  }

  return {
    recordId: recordIdIndex,
    createdAt: createdAtIndex,
    todoItem: todoItemIndex,
    deadlineNormalized: deadlineNormalizedIndex,
    branchName: branchNameIndex,
    userName: userNameIndex,
    customerName: customerNameIndex,
    storeName: storeNameIndex === undefined ? -1 : storeNameIndex,
    dealTheme: dealThemeIndex,
    dealContent: dealContentIndex,
    inputMethod: inputMethodIndex,
    userKey: userKeyIndex,
  };
}

function getDealAdditionsColumnIndexes_(headers) {
  const normalizedHeaders = Array.isArray(headers)
    ? headers.map((header) => String(header || '').trim())
    : [];

  const additionIdIndex = normalizedHeaders.indexOf('addition_id');
  const recordIdIndex = normalizedHeaders.indexOf('record_id');
  const additionalRecordIndex = normalizedHeaders.indexOf('additional_record');
  const addedAtIndex = normalizedHeaders.indexOf('added_at');
  const addedByIndex = normalizedHeaders.indexOf('added_by');

  if ([additionIdIndex, recordIdIndex, additionalRecordIndex, addedAtIndex, addedByIndex].some((index) => index < 0)) {
    throw new Error('deal_additions の見出しが不正です。');
  }

  return {
    additionId: additionIdIndex,
    recordId: recordIdIndex,
    additionalRecord: additionalRecordIndex,
    addedAt: addedAtIndex,
    addedBy: addedByIndex,
  };
}

function parseDailyReportCreatedAt_(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }

  const createdAtText = String(value || '').trim();
  if (!createdAtText) {
    return null;
  }

  try {
    return Utilities.parseDate(createdAtText, WRITE_RECORD_TIMEZONE_, 'yyyy/MM/dd HH:mm:ss');
  } catch (error) {
    const fallbackDate = new Date(createdAtText);
    return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
  }
}

function parseOutputConfigBoolean_(value) {
  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  const normalizedValue = String(value || '').trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  if (['true', '1', 'yes', 'y', 'on', 't'].includes(normalizedValue)) {
    return true;
  }

  if (['false', '0', 'no', 'n', 'off', 'f'].includes(normalizedValue)) {
    return false;
  }

  return null;
}

function parseOutputConfigNumber_(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.floor(numericValue);
}

function isOutputConfigHeaderRow_(row) {
  if (!Array.isArray(row)) {
    return false;
  }

  return String(row[0] || '').trim() === 'key'
    && String(row[1] || '').trim() === 'value'
    && String(row[2] || '').trim() === 'description';
}

function getCollectionWindowStart_(dateValue, collectFromHour) {
  return buildDateAtHour_(dateValue, collectFromHour);
}

function getCollectionWindowEnd_(dateValue, currentDate, collectToHour) {
  const endOfWindow = buildDateAtHour_(dateValue, collectToHour);
  const sameDay = Utilities.formatDate(dateValue, WRITE_RECORD_TIMEZONE_, 'yyyyMMdd')
    === Utilities.formatDate(currentDate, WRITE_RECORD_TIMEZONE_, 'yyyyMMdd');

  if (sameDay && currentDate.getTime() < endOfWindow.getTime()) {
    return currentDate;
  }

  return endOfWindow;
}

function isWithinCollectionWindow_(dateValue, currentDate, config) {
  const start = getCollectionWindowStart_(dateValue, config.collectFromHour);
  const end = getCollectionWindowEnd_(dateValue, currentDate, config.collectToHour);
  const targetTime = dateValue.getTime();
  return targetTime >= start.getTime() && targetTime <= end.getTime();
}

function buildDateAtHour_(dateValue, hourValue) {
  const normalizedHour = Number(hourValue);
  const safeHour = Number.isFinite(normalizedHour) ? Math.min(Math.max(Math.floor(normalizedHour), 0), 23) : 0;
  const dayText = Utilities.formatDate(dateValue, WRITE_RECORD_TIMEZONE_, 'yyyy/MM/dd');
  return Utilities.parseDate(
    `${dayText} ${String(safeHour).padStart(2, '0')}:00:00`,
    WRITE_RECORD_TIMEZONE_,
    'yyyy/MM/dd HH:mm:ss',
  );
}

function buildDailyReportSummary_(dealTheme, dealContent) {
  const normalizedParts = [
    normalizeDailyReportText_(dealTheme),
    normalizeDailyReportText_(dealContent),
  ].filter((part) => part !== '');

  const summaryText = normalizeDailyReportText_(normalizedParts.join('｜'));
  if (!summaryText) {
    return '';
  }

  return summaryText.length > 120 ? `${summaryText.slice(0, 119)}…` : summaryText;
}

function normalizeDailyReportText_(value) {
  return String(value || '')
    .replace(/[\s\u3000]+/g, ' ')
    .trim();
}

function groupDailyReportRecords_(records) {
  const groups = [];
  const groupMap = new Map();

  records.forEach((record) => {
    const dateLabel = String(record.dateLabel || '').trim();
    if (!dateLabel) {
      return;
    }

    let group = groupMap.get(dateLabel);
    if (!group) {
      group = {
        dateLabel,
        records: [],
      };
      groupMap.set(dateLabel, group);
      groups.push(group);
    }

    group.records.push({
      recordId: String(record.recordId || '').trim(),
      createdAtLabel: String(record.createdAtLabel || '').trim(),
      dateLabel,
      timeLabel: String(record.timeLabel || '').trim(),
      branchName: String(record.branchName || '').trim(),
      userName: String(record.userName || '').trim(),
      canAdd: record.canAdd === true,
      customerName: String(record.customerName || '').trim(),
      todoItem: String(record.todoItem || '').trim(),
      deadlineNormalized: String(record.deadlineNormalized || '').trim(),
      canCreateTodo: record.canCreateTodo === true,
      hasActiveTodo: record.hasActiveTodo === true,
      inputMethod: String(record.inputMethod || '').trim(),
      dealTheme: String(record.dealTheme || '').trim(),
      dealContent: String(record.dealContent || '').trim(),
      dealSummary: String(record.dealSummary || '').trim(),
      additions: Array.isArray(record.additions)
        ? record.additions.map((addition) => ({
            additionId: String(addition.additionId || '').trim(),
            additionalRecord: String(addition.additionalRecord || '').trim(),
            addedAtLabel: String(addition.addedAtLabel || '').trim(),
            addedByName: String(addition.addedByName || '').trim(),
          }))
        : [],
    });
  });

  return groups;
}

function getStartOfToday_() {
  const now = new Date();
  const todayText = Utilities.formatDate(now, WRITE_RECORD_TIMEZONE_, 'yyyy/MM/dd');
  return Utilities.parseDate(`${todayText} 00:00:00`, WRITE_RECORD_TIMEZONE_, 'yyyy/MM/dd HH:mm:ss');
}
