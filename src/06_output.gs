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

function testSendChat() {
  const testMessages = [
    { target: 'sales', text: 'OUT-01 営業用送信テスト' },
    { target: 'manager', text: 'OUT-01 管理職用送信テスト' },
  ];

  testMessages.forEach((item) => {
    const result = sendChatMessage(item.target, item.text);
    console.log(item.target, result.statusCode);
  });
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
  if (!isManagerUser_()) {
    throw new Error('このページを表示する権限がありません');
  }

  const sheet = getDealRecordsSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  const indexes = getDailyReportColumnIndexes_(values[0]);
  const now = new Date();
  const startOfToday = getStartOfToday_();
  const summaryRows = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const createdAt = parseDailyReportCreatedAt_(row[indexes.createdAt]);
    if (!createdAt) {
      continue;
    }

    const createdAtTime = createdAt.getTime();
    if (createdAtTime < startOfToday.getTime() || createdAtTime > now.getTime()) {
      continue;
    }

    summaryRows.push({
      createdAt,
      userName: String(row[indexes.userName] || '').trim(),
      customerName: String(row[indexes.customerName] || '').trim(),
      summary: buildDailyReportSummary_(row[indexes.dealTheme], row[indexes.dealContent]),
      dateLabel: Utilities.formatDate(createdAt, WRITE_RECORD_TIMEZONE_, 'yyyy/MM/dd'),
      timeLabel: Utilities.formatDate(createdAt, WRITE_RECORD_TIMEZONE_, 'HH:mm'),
    });
  }

  summaryRows.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  return summaryRows.map((row) => ({
    userName: row.userName,
    customerName: row.customerName,
    summary: row.summary,
    dateLabel: row.dateLabel,
    timeLabel: row.timeLabel,
  }));
}

function createDailyPageModel_() {
  const validation = validateUser();
  const model = {
    pageTitle: '営業AIメモ｜個人日報',
    validation,
    userName: validation && validation.valid ? String(validation.userName || '').trim() : '',
    reportGroups: [],
    hasReportData: false,
    emptyMessage: '直近30日の商談記録はありません',
    noticeMessage: '',
    topPageLinkUrl: '',
  };

  try {
    model.topPageLinkUrl = String(ScriptApp.getService().getUrl() || '').trim();
  } catch (error) {
    model.topPageLinkUrl = '';
  }

  if (!validation || validation.valid !== true) {
    model.noticeMessage = String(validation && validation.errorMessage ? validation.errorMessage : '日報を表示できませんでした。');
    return model;
  }

  try {
    model.reportGroups = getDailyReportData(validation.userName);
    model.hasReportData = Array.isArray(model.reportGroups) && model.reportGroups.length > 0;
  } catch (error) {
    model.noticeMessage = String(error && error.message ? error.message : '日報を表示できませんでした。');
  }

  return model;
}

function getDailyReportData(userName) {
  const normalizedUserName = String(userName || '').trim();
  if (!normalizedUserName) {
    throw new Error('userName は必須です。');
  }

  const sheet = getDealRecordsSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  const indexes = getDailyReportColumnIndexes_(values[0]);
  const now = new Date();
  const cutoffDate = new Date(now.getTime());
  cutoffDate.setDate(cutoffDate.getDate() - 29);
  const todayKey = Utilities.formatDate(now, WRITE_RECORD_TIMEZONE_, 'yyyyMMdd');
  const cutoffKey = Utilities.formatDate(cutoffDate, WRITE_RECORD_TIMEZONE_, 'yyyyMMdd');

  const flatRecords = [];
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const rowUserName = String(row[indexes.userName] || '').trim();
    if (rowUserName !== normalizedUserName) {
      continue;
    }

    const createdAt = parseDailyReportCreatedAt_(row[indexes.createdAt]);
    if (!createdAt || createdAt.getTime() > now.getTime()) {
      continue;
    }

    const createdAtKey = Utilities.formatDate(createdAt, WRITE_RECORD_TIMEZONE_, 'yyyyMMdd');
    if (createdAtKey < cutoffKey || createdAtKey > todayKey) {
      continue;
    }

    const customerName = String(row[indexes.customerName] || '').trim();
    const dealTheme = String(row[indexes.dealTheme] || '').trim();
    const dealContent = String(row[indexes.dealContent] || '').trim();

    flatRecords.push({
      createdAt,
      dateLabel: Utilities.formatDate(createdAt, WRITE_RECORD_TIMEZONE_, 'yyyy/MM/dd'),
      timeLabel: Utilities.formatDate(createdAt, WRITE_RECORD_TIMEZONE_, 'HH:mm'),
      customerName,
      summary: buildDailyReportSummary_(dealTheme, dealContent),
    });
  }

  flatRecords.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  return groupDailyReportRecords_(flatRecords);
}

function getDealRecordsSheet_() {
  const spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
  const sheet = spreadsheet.getSheetByName('deal_records');

  if (!sheet) {
    throw new Error('deal_records シートが見つかりません');
  }

  return sheet;
}

function getDailyReportColumnIndexes_(headers) {
  const normalizedHeaders = Array.isArray(headers)
    ? headers.map((header) => String(header || '').trim())
    : [];

  const createdAtIndex = normalizedHeaders.indexOf('created_at');
  const userNameIndex = normalizedHeaders.indexOf('user_name');
  const customerNameIndex = normalizedHeaders.indexOf('customer_name');
  const dealThemeIndex = normalizedHeaders.indexOf('deal_theme');
  const dealContentIndex = normalizedHeaders.indexOf('deal_content');

  if ([createdAtIndex, userNameIndex, customerNameIndex, dealThemeIndex, dealContentIndex].some((index) => index < 0)) {
    throw new Error('deal_records の見出しが不正です。');
  }

  return {
    createdAt: createdAtIndex,
    userName: userNameIndex,
    customerName: customerNameIndex,
    dealTheme: dealThemeIndex,
    dealContent: dealContentIndex,
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

function getStartOfToday_() {
  const now = new Date();
  const todayText = Utilities.formatDate(now, WRITE_RECORD_TIMEZONE_, 'yyyy/MM/dd');
  return Utilities.parseDate(`${todayText} 00:00:00`, WRITE_RECORD_TIMEZONE_, 'yyyy/MM/dd HH:mm:ss');
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
      dateLabel,
      timeLabel: String(record.timeLabel || '').trim(),
      customerName: String(record.customerName || '').trim(),
      summary: String(record.summary || '').trim(),
    });
  });

  return groups;
}
