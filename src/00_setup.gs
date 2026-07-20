const SETUP_SHEET_DEFINITIONS_ = [
  {
    name: 'deal_records',
    headers: [
      'record_id',
      'created_at',
      'branch_name',
      'user_name',
      'customer_name',
      'customer_type',
      'deal_theme',
      'deal_content',
      'todo_item',
      'todo_deadline',
      'original_text',
      'extract_status',
      'temperature',
      'deal_status',
      'next_meeting_date',
      'deadline_normalized',
      'deadline_flag',
      'quote_request_id',
      'latitude',
      'longitude',
      'store_name_gps',
    ],
  },
  {
    name: 'user_master',
    headers: [
      'user_key',
      'user_fullname',
      'master_branch_name',
      'active_flag',
    ],
  },
  {
    name: 'branch_master',
    headers: [
      'branch_id',
      'branch_name',
      'active_flag',
    ],
  },
  {
    name: 'error_log',
    headers: [
      'error_id',
      'occurred_at',
      'user_key',
      'error_type',
      'error_message',
      'input_text',
      'resolved_flag',
    ],
  },
  {
    name: 'store_master',
    headers: [
      'store_id',
      'store_name',
      'latitude',
      'longitude',
      'active_flag',
    ],
  },
];

function setupSheets_() {
  const spreadsheet = openSetupSpreadsheet_();

  SETUP_SHEET_DEFINITIONS_.forEach((definition) => {
    const sheet = getOrCreateSheet_(spreadsheet, definition.name);
    ensureHeaderRow_(sheet, definition.headers);
  });
}

function setupSheets() {
  return setupSheets_();
}

function openSetupSpreadsheet_() {
  const spreadsheetId = getSpreadsheetId_();
  return SpreadsheetApp.openById(spreadsheetId);
}

function getSpreadsheetId_() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const candidateKeys = [
    'SPREADSHEET_ID',
    'SPREADSHEETID',
    'spreadsheetId',
    'spreadsheet_id',
  ];

  for (const key of candidateKeys) {
    const value = scriptProperties.getProperty(key);
    if (value) {
      return value;
    }
  }

  throw new Error('スプレッドシートID未設定');
}

function getOrCreateSheet_(spreadsheet, sheetName) {
  const existingSheet = spreadsheet.getSheetByName(sheetName);
  if (existingSheet) {
    return existingSheet;
  }

  return spreadsheet.insertSheet(sheetName);
}

function ensureHeaderRow_(sheet, headers) {
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const firstRowValues = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const hasExistingHeader = firstRowValues.some((value) => value !== '' && value !== null);

  if (hasExistingHeader) {
    return;
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}
