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
const OUTPUT_CONFIG_DEFAULTS_ = [
  { key: 'daily_report_enabled', value: true, description: '個人日報通知の有効・無効' },
  { key: 'manager_summary_enabled', value: true, description: '管理職向け日報まとめ通知の有効・無効' },
  { key: 'send_hour', value: 18, description: '配信時刻（時）' },
  { key: 'collect_from_hour', value: 0, description: '日次集計の開始時刻' },
  { key: 'collect_to_hour', value: 18, description: '日次集計の終了時刻' },
  { key: 'skip_weekend', value: true, description: '土日の配信を停止するか' },
];

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
  if (!isManagerUser_()) {
    throw new Error('このページを表示する権限がありません');
  }

  const config = getOutputConfig();
  const sheet = getDealRecordsSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  const indexes = getDailyReportColumnIndexes_(values[0]);
  const now = new Date();
  const startOfToday = getCollectionWindowStart_(now, config.collectFromHour);
  const summaryRows = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const createdAt = parseDailyReportCreatedAt_(row[indexes.createdAt]);
    if (!createdAt) {
      continue;
    }

    if (!isWithinCollectionWindow_(createdAt, now, config)) {
      continue;
    }

    if (createdAt.getTime() < startOfToday.getTime()) {
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

  const flatRecords = [];
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const rowUserName = String(row[indexes.userName] || '').trim();
    if (rowUserName !== normalizedUserName) {
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
