const AUTH_ERROR_MESSAGES_ = {
  emailMissing: 'ログイン中のメールアドレスを取得できませんでした。',
  userNotFound: '登録されていない担当者です。管理者に連絡してください。',
  sheetReadFailure: '担当者マスタの読み込みに失敗しました。',
};

function doGet(e) {
  const view = String(e && e.parameter && e.parameter.view ? e.parameter.view : '').trim();
  if (view === 'summary') {
    return createPageHtmlOutput_('summary', createManagerSummaryPageModel_());
  }

  if (view === 'daily') {
    return createPageHtmlOutput_('daily', createDailyPageModel_());
  }

  return createPageHtmlOutput_('top', createTopPageModel_());
}

function createTopPageModel_() {
  const validation = validateUser();

  const model = {
    pageTitle: '営業AIメモ',
    validation,
    userName: validation && validation.valid ? String(validation.userName || '').trim() : '',
    inputPageLinkUrl: '',
    dailyReportLinkUrl: '',
    noticeMessage: '',
  };

  if (!validation || validation.valid !== true) {
    model.noticeMessage = String(validation && validation.errorMessage ? validation.errorMessage : '登録されていない担当者です。管理者に連絡してください。');
    return model;
  }

  try {
    const inputPageUrl = getInputPageUrl_();
    const token = issueToken(validation.userKey);
    model.inputPageLinkUrl = `${inputPageUrl}#token=${token}`;
  } catch (error) {
    model.noticeMessage = String(error && error.message ? error.message : '入力画面のリンクを作成できませんでした。');
  }

  try {
    model.dailyReportLinkUrl = getDailyReportUrl();
  } catch (error) {
    model.dailyReportLinkUrl = '';
  }

  return model;
}

function createManagerSummaryPageModel_() {
  const hasPermission = isManagerUser_();
  const model = {
    pageTitle: '営業AIメモ｜日報まとめ',
    isManager: hasPermission,
    currentDateLabel: Utilities.formatDate(new Date(), WRITE_RECORD_TIMEZONE_, 'yyyy年M月d日'),
    summaryRows: [],
    hasSummaryData: false,
    emptyMessage: '本日の商談記録はありません',
    noticeMessage: '',
    topPageLinkUrl: '',
  };

  try {
    model.topPageLinkUrl = String(ScriptApp.getService().getUrl() || '').trim();
  } catch (error) {
    model.topPageLinkUrl = '';
  }

  if (!hasPermission) {
    model.noticeMessage = 'このページを表示する権限がありません';
    return model;
  }

  try {
    model.summaryRows = getManagerSummaryData();
    model.hasSummaryData = Array.isArray(model.summaryRows) && model.summaryRows.length > 0;
  } catch (error) {
    model.noticeMessage = String(error && error.message ? error.message : '日報まとめを表示できませんでした。');
  }

  return model;
}

function createPageHtmlOutput_(templateName, model) {
  const template = HtmlService.createTemplateFromFile(templateName);
  template.model = model;

  return template
    .evaluate()
    .setTitle(String(model && model.pageTitle ? model.pageTitle : '営業AIメモ'))
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function validateUser() {
  let userKey = '';
  try {
    userKey = Session.getActiveUser().getEmail() || '';
    if (!userKey) {
      return createValidationResult_(false, '', '', '', AUTH_ERROR_MESSAGES_.emailMissing);
    }

    const userMasterSheet = getUserMasterSheet_();
    const validationRow = findUserMasterRow_(userMasterSheet, userKey);

    if (!validationRow) {
      return createValidationResult_(false, userKey, '', '', AUTH_ERROR_MESSAGES_.userNotFound);
    }

    const userName = validationRow.userName;
    const branchName = validationRow.branchName;

    if (validationRow.activeFlag !== '有効') {
      return createValidationResult_(false, userKey, userName, branchName, AUTH_ERROR_MESSAGES_.userNotFound);
    }

    return createValidationResult_(true, userKey, userName, branchName, '');
  } catch (error) {
    return createValidationResult_(
      false,
      userKey,
      '',
      '',
      AUTH_ERROR_MESSAGES_.sheetReadFailure,
    );
  }
}

function lookupBranch(userKey) {
  if (!userKey) {
    return '';
  }

  try {
    const userMasterSheet = getUserMasterSheet_();
    const validationRow = findUserMasterRow_(userMasterSheet, userKey);
    return validationRow ? validationRow.branchName : '';
  } catch (error) {
    return '';
  }
}

function getUserMasterSheet_() {
  const spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
  const sheet = spreadsheet.getSheetByName('user_master');

  if (!sheet) {
    throw new Error('user_master シートが見つかりません');
  }

  return sheet;
}

function findUserMasterRow_(sheet, userKey) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return null;
  }

  const headers = values[0].map((header) => String(header || '').trim());
  const keyIndex = headers.indexOf('user_key');
  const nameIndex = headers.indexOf('user_fullname');
  const branchIndex = headers.indexOf('master_branch_name');
  const activeIndex = headers.indexOf('active_flag');
  const roleIndex = headers.indexOf('role');

  if ([keyIndex, nameIndex, branchIndex, activeIndex].some((index) => index < 0)) {
    throw new Error('user_master の見出しが不正です');
  }

  const targetKey = String(userKey).trim();

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const currentKey = String(row[keyIndex] || '').trim();
    if (currentKey !== targetKey) {
      continue;
    }

    return {
      userName: String(row[nameIndex] || '').trim(),
      branchName: String(row[branchIndex] || '').trim(),
      activeFlag: String(row[activeIndex] || '').trim(),
      role: roleIndex >= 0 ? String(row[roleIndex] || '').trim() : '',
    };
  }

  return null;
}

function getCurrentUserRole_() {
  try {
    const userKey = String(Session.getActiveUser().getEmail() || '').trim();
    if (!userKey) {
      return '';
    }

    const userMasterSheet = getUserMasterSheet_();
    const validationRow = findUserMasterRow_(userMasterSheet, userKey);
    if (!validationRow || validationRow.activeFlag !== '有効') {
      return '';
    }

    return String(validationRow.role || '').trim();
  } catch (error) {
    return '';
  }
}

function isManagerUser_() {
  return getCurrentUserRole_() === 'manager';
}

function createValidationResult_(valid, userKey, userName, branchName, errorMessage) {
  return {
    valid,
    userKey,
    userName,
    branchName,
    errorMessage,
  };
}
