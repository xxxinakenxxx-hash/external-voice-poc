var WRITE_RECORD_ID_TIMESTAMP_ = '';
var ERROR_LOG_ID_TIMESTAMP_ = '';
var ERROR_LOG_SEQUENCE_ = 0;

const WRITE_RECORD_TIMEZONE_ = 'Asia/Tokyo';
const WRITE_RECORD_ID_FORMAT_ = 'yyyyMMdd-HHmmss';
const WRITE_RECORD_CREATED_AT_FORMAT_ = 'yyyy/MM/dd HH:mm:ss';
const ERROR_LOG_DEFAULT_RESOLVED_FLAG_ = '未対応';
const ERROR_LOG_ID_PREFIX_ = 'ERR-';

function generateRecordId(index) {
  let sequence = Number(index);
  if (!Number.isFinite(sequence) || sequence <= 0) {
    sequence = 1;
  }

  const normalizedTimestamp = String(WRITE_RECORD_ID_TIMESTAMP_ || '').trim();
  const timestampText = normalizedTimestamp || Utilities.formatDate(
    new Date(),
    WRITE_RECORD_TIMEZONE_,
    WRITE_RECORD_ID_FORMAT_,
  );

  return `${timestampText}-${String(Math.floor(sequence)).padStart(3, '0')}`;
}

function writeRecordsToSheet(records) {
  if (!Array.isArray(records)) {
    throw new Error('records は配列で指定してください。');
  }

  if (records.length === 0) {
    return;
  }

  const spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
  const sheet = spreadsheet.getSheetByName('deal_records');

  if (!sheet) {
    throw new Error('deal_records シートが見つかりません');
  }

  const previousTimestamp = WRITE_RECORD_ID_TIMESTAMP_;
  WRITE_RECORD_ID_TIMESTAMP_ = Utilities.formatDate(
    new Date(),
    WRITE_RECORD_TIMEZONE_,
    WRITE_RECORD_ID_FORMAT_,
  );
  let hasLoggedWriteError = false;

  try {
    for (let index = 0; index < records.length; index += 1) {
      const sourceRecord = records[index];
      if (!sourceRecord || typeof sourceRecord !== 'object' || Array.isArray(sourceRecord)) {
        throw new Error('records の要素が不正です。');
      }

      const customerName = String(sourceRecord.customerName ?? sourceRecord.customer_name ?? '').trim();
      const customerType = String(sourceRecord.customerType ?? sourceRecord.customer_type ?? '').trim();
      const dealTheme = String(sourceRecord.dealTheme ?? sourceRecord.deal_theme ?? '').trim();
      const dealContent = String(sourceRecord.dealContent ?? sourceRecord.deal_content ?? '').trim();
      const todoItem = String(sourceRecord.todoItem ?? sourceRecord.todo_item ?? '').trim();
      const todoDeadline = String(sourceRecord.todoDeadline ?? sourceRecord.todo_deadline ?? '').trim();
      const branchName = String(sourceRecord.branchName ?? sourceRecord.branch_name ?? '').trim();
      const userName = String(sourceRecord.userName ?? sourceRecord.user_name ?? '').trim();
      const originalText = String(
        sourceRecord.originalText ??
          sourceRecord.original_text ??
          sourceRecord.inputText ??
          sourceRecord.input_text ??
          '',
      ).trim();

      let extractStatus = String(sourceRecord.extractStatus ?? sourceRecord.extract_status ?? '').trim();
      if (!extractStatus) {
        extractStatus = customerName && dealTheme && dealContent ? 'OK' : '要確認';
      }

      const recordId = generateRecordId(index + 1);
      const createdAt = Utilities.formatDate(
        new Date(),
        WRITE_RECORD_TIMEZONE_,
        WRITE_RECORD_CREATED_AT_FORMAT_,
      );

      const rowValues = [
        recordId,
        createdAt,
        branchName,
        userName,
        customerName,
        customerType,
        dealTheme,
        dealContent,
        todoItem,
        todoDeadline,
        originalText,
        extractStatus,
      ];

      try {
        sheet.appendRow(rowValues);
      } catch (error) {
        try {
          logError('SHEET_WRITE_ERROR', error && error.message ? error.message : String(error), {
            userKey: sourceRecord.userKey ?? sourceRecord.user_key ?? '',
            inputText: originalText,
          });
          hasLoggedWriteError = true;
        } catch (loggingError) {
          // logError の失敗は再帰させない。
        }
        throw error;
      }

      const rowNumber = sheet.getLastRow();
      const latitude = sourceRecord.latitude ?? '';
      const longitude = sourceRecord.longitude ?? '';
      const customerStoreId = String(sourceRecord.customerStoreId ?? sourceRecord.customer_store_id ?? '').trim();
      const customerNameRaw = String(sourceRecord.customerNameRaw ?? sourceRecord.customer_name_raw ?? '').trim();
      const visitStoreId = String(sourceRecord.visitStoreId ?? sourceRecord.visit_store_id ?? '').trim();
      const inputMethod = String(sourceRecord.inputMethod ?? sourceRecord.input_method ?? '').trim();
      const userKey = String(sourceRecord.userKey ?? sourceRecord.user_key ?? '').trim();

      const hasGpsValue = [latitude, longitude].some((value) => value !== '' && value !== null && value !== undefined);
      if (hasGpsValue) {
        sheet.getRange(rowNumber, 19, 1, 2).setValues([[latitude, longitude]]);
      }

      sheet.getRange(rowNumber, 22, 1, 5).setValues([[
        customerStoreId,
        customerNameRaw,
        visitStoreId,
        inputMethod,
        userKey,
      ]]);

      markExtractionFailure(sheet, rowNumber, {
        ...sourceRecord,
        customerName,
        customerType,
        dealTheme,
        dealContent,
        todoItem,
        todoDeadline,
        branchName,
        userName,
        originalText,
        extractStatus,
      });
    }

    SpreadsheetApp.flush();
  } catch (error) {
    if (!hasLoggedWriteError) {
      try {
        logError('SHEET_WRITE_ERROR', error && error.message ? error.message : String(error), {
          userKey: records[0] && typeof records[0] === 'object'
            ? records[0].userKey ?? records[0].user_key ?? ''
            : '',
          inputText: records[0] && typeof records[0] === 'object'
            ? String(records[0].originalText ?? records[0].original_text ?? records[0].inputText ?? records[0].input_text ?? '')
            : '',
        });
      } catch (loggingError) {
        // logError の失敗は再帰させない。
      }
    }
    throw error;
  } finally {
    WRITE_RECORD_ID_TIMESTAMP_ = previousTimestamp;
  }
}

function markExtractionFailure(sheet, rowNumber, record) {
  try {
    const extractStatus = String(
      record && typeof record === 'object'
        ? record.extractStatus ?? record.extract_status ?? ''
        : '',
    ).trim();

    if (extractStatus !== '要確認') {
      return;
    }

    const fieldSpecs = [
      { column: 7, value: record && typeof record === 'object' ? record.dealTheme ?? record.deal_theme ?? '' : '' },
      { column: 8, value: record && typeof record === 'object' ? record.dealContent ?? record.deal_content ?? '' : '' },
    ];

    for (const fieldSpec of fieldSpecs) {
      const cellValue = String(fieldSpec.value ?? '').trim();
      if (cellValue === '') {
        sheet.getRange(rowNumber, fieldSpec.column).setBackground('#FF0000');
      }
    }
  } catch (error) {
    try {
      logError('SHEET_BACKGROUND_ERROR', error && error.message ? error.message : String(error), {
        userKey: record && typeof record === 'object' ? record.userKey ?? record.user_key ?? '' : '',
        inputText: record && typeof record === 'object'
          ? String(record.originalText ?? record.original_text ?? record.inputText ?? record.input_text ?? '')
          : '',
      });
    } catch (loggingError) {
      // logError の失敗は再帰させない。
    }
  }
}

function logError(errorType, message, context) {
  try {
    const spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
    const sheet = spreadsheet.getSheetByName('error_log');

    if (!sheet) {
      return;
    }

    const occurredAt = new Date();
    const occurredAtText = Utilities.formatDate(
      occurredAt,
      WRITE_RECORD_TIMEZONE_,
      WRITE_RECORD_CREATED_AT_FORMAT_,
    );
    const currentTimestamp = Utilities.formatDate(
      occurredAt,
      WRITE_RECORD_TIMEZONE_,
      WRITE_RECORD_ID_FORMAT_,
    );

    if (ERROR_LOG_ID_TIMESTAMP_ !== currentTimestamp) {
      ERROR_LOG_ID_TIMESTAMP_ = currentTimestamp;
      ERROR_LOG_SEQUENCE_ = 0;
    }

    ERROR_LOG_SEQUENCE_ += 1;

    const contextObject = context && typeof context === 'object' ? context : {};
    const userKey = String(contextObject.userKey ?? contextObject.user_key ?? '').trim();
    const inputText = String(
      contextObject.inputText ??
        contextObject.originalText ??
        contextObject.input_text ??
        contextObject.original_text ??
        '',
    ).slice(0, 200);

    const errorId = `${ERROR_LOG_ID_PREFIX_}${ERROR_LOG_ID_TIMESTAMP_}-${String(ERROR_LOG_SEQUENCE_).padStart(3, '0')}`;
    const resolvedFlag = ERROR_LOG_DEFAULT_RESOLVED_FLAG_;

    sheet.appendRow([
      errorId,
      occurredAtText,
      userKey,
      String(errorType || 'GAS_RUNTIME_ERROR').trim() || 'GAS_RUNTIME_ERROR',
      String(message || ''),
      inputText,
      resolvedFlag,
    ]);
  } catch (error) {
    // logError 自身の失敗では再帰しない。
  }
}
