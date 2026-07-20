const AUTH_ERROR_MESSAGES_ = {
  emailMissing: 'ログイン中のメールアドレスを取得できませんでした。',
  userNotFound: '登録されていない担当者です。管理者に連絡してください。',
  sheetReadFailure: '担当者マスタの読み込みに失敗しました。',
  roleNotConfigured: '利用権限が設定されていません。管理者に連絡してください。',
};

const AUTH_ALLOWED_ROLES_ = ['sales', 'manager', 'sales_support', 'sysadmin'];

function doGet(e) {
  const view = String(e && e.parameter && e.parameter.view ? e.parameter.view : '').trim();
  const recordId = String(e && e.parameter && e.parameter.record_id ? e.parameter.record_id : '').trim();
  const validation = validateUser();

  if (!validation || validation.valid !== true) {
    return createPageHtmlOutput_('top', createTopPageModel_(validation));
  }

  const role = String(validation.role || '').trim();

  if (view === 'summary') {
    if (isSummaryViewer_(role)) {
      return createPageHtmlOutput_('summary', createManagerSummaryPageModel_(validation));
    }

    return createPageHtmlOutput_(
      'addition',
      createAdditionPageModel_('', validation, 'このページを表示する権限がありません'),
    );
  }

  if (view === 'daily') {
    if (recordId) {
      if (isDealInputRole_(role)) {
        return createPageHtmlOutput_('addition', createAdditionPageModel_(recordId, validation));
      }

      return createPageHtmlOutput_(
        'addition',
        createAdditionPageModel_('', validation, 'このページを表示する権限がありません'),
      );
    }

    if (isManagerOrSalesSupportRole_(role)) {
      return createPageHtmlOutput_('summary', createManagerSummaryPageModel_(validation));
    }

    if (isDailyViewerRole_(role)) {
      return createPageHtmlOutput_('daily', createDailyPageModel_(validation));
    }
  }

  return createPageHtmlOutput_('top', createTopPageModel_(validation));
}

function createTopPageModel_(validationOverride) {
  const validation = validationOverride && typeof validationOverride === 'object'
    ? validationOverride
    : validateUser();

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

  const role = String(validation.role || '').trim();
  const canOpenInputPage = isDealInputRole_(role);

  if (canOpenInputPage) {
    try {
      const inputPageUrl = getInputPageUrl_();
      const token = issueToken(validation.userKey);
      model.inputPageLinkUrl = `${inputPageUrl}#token=${token}`;
    } catch (error) {
      model.noticeMessage = String(error && error.message ? error.message : '入力画面のリンクを作成できませんでした。');
    }
  }

  try {
    model.dailyReportLinkUrl = getRoleDailyReportUrl_(role);
  } catch (error) {
    model.dailyReportLinkUrl = '';
  }

  return model;
}

function createManagerSummaryPageModel_(validationOverride) {
  const validation = validationOverride && typeof validationOverride === 'object'
    ? validationOverride
    : validateUser();

  const model = {
    pageTitle: '営業AIメモ｜日報まとめ',
    validation,
    isManager: false,
    isSummaryViewer: false,
    currentDateLabel: Utilities.formatDate(new Date(), WRITE_RECORD_TIMEZONE_, 'yyyy年M月d日'),
    summaryRows: [],
    hasSummaryData: false,
    emptyMessage: '本日の商談記録はありません',
    noticeMessage: '',
    topPageLinkUrl: '',
    dailyReportLinkUrl: '',
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

  const role = String(validation.role || '').trim();
  model.isSummaryViewer = isSummaryViewer_(role);
  model.isManager = model.isSummaryViewer;

  try {
    model.dailyReportLinkUrl = getRoleDailyReportUrl_(role);
  } catch (error) {
    model.dailyReportLinkUrl = '';
  }

  try {
    const reportResult = getMyDealRecords('summary', validation);
    if (!reportResult || reportResult.success !== true) {
      model.noticeMessage = String(reportResult && reportResult.errorMessage ? reportResult.errorMessage : '日報を表示できませんでした。');
      return model;
    }

    model.summaryRows = Array.isArray(reportResult.records) ? reportResult.records : [];
    model.hasSummaryData = model.summaryRows.length > 0;
  } catch (error) {
    model.noticeMessage = String(error && error.message ? error.message : '日報を表示できませんでした。');
  }

  return model;
}

function createDailyPageModel_(validationOverride) {
  const validation = validationOverride && typeof validationOverride === 'object'
    ? validationOverride
    : validateUser();
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
    const reportResult = getMyDealRecords('daily', validation);
    if (!reportResult || reportResult.success !== true) {
      model.noticeMessage = String(reportResult && reportResult.errorMessage ? reportResult.errorMessage : '日報を表示できませんでした。');
      return model;
    }

    model.reportGroups = groupDailyReportRecords_(Array.isArray(reportResult.records) ? reportResult.records : []);
    model.hasReportData = Array.isArray(model.reportGroups) && model.reportGroups.length > 0;
  } catch (error) {
    model.noticeMessage = String(error && error.message ? error.message : '日報を表示できませんでした。');
  }

  return model;
}

function createAdditionPageModel_(recordId, validationOverride, noticeMessageOverride) {
  const validation = validationOverride && typeof validationOverride === 'object'
    ? validationOverride
    : validateUser();
  const role = String(validation && validation.role ? validation.role : '').trim();
  const model = {
    pageTitle: '営業AIメモ｜商談記録への追記',
    validation,
    recordId: String(recordId || '').trim(),
    record: null,
    hasRecordData: false,
    additions: [],
    noticeMessage: String(noticeMessageOverride || '').trim(),
    topPageLinkUrl: '',
    dailyReportLinkUrl: '',
    userName: validation && validation.valid ? String(validation.userName || '').trim() : '',
  };

  try {
    model.topPageLinkUrl = String(ScriptApp.getService().getUrl() || '').trim();
  } catch (error) {
    model.topPageLinkUrl = '';
  }

  try {
    model.dailyReportLinkUrl = getRoleDailyReportUrl_(role);
  } catch (error) {
    model.dailyReportLinkUrl = '';
  }

  if (!validation || validation.valid !== true) {
    model.noticeMessage = String(validation && validation.errorMessage ? validation.errorMessage : '追記画面を表示できませんでした。');
    return model;
  }

  if (model.noticeMessage) {
    return model;
  }

  if (!isDealInputRole_(role)) {
    model.noticeMessage = 'このページを表示する権限がありません';
    return model;
  }

  if (!model.recordId) {
    model.noticeMessage = '対象の商談記録が見つかりません';
    return model;
  }

  try {
    const foundRecord = findDealRecordById_(model.recordId);
    if (!foundRecord) {
      model.noticeMessage = '対象の商談記録が見つかりません';
      return model;
    }

    const targetRecordUserKey = String(foundRecord.row[foundRecord.indexes.userKey] || '').trim();
    if (!canAddDealAddition_(role, validation.userKey, targetRecordUserKey)) {
      model.noticeMessage = 'この商談記録には追記できません';
      return model;
    }

    const createdAt = parseDailyReportCreatedAt_(foundRecord.row[foundRecord.indexes.createdAt]);
    if (!createdAt) {
      model.noticeMessage = '対象の商談記録が見つかりません';
      return model;
    }

    const additionsByRecordId = getDealAdditionsByRecordIds_([model.recordId]);
    model.record = buildDealRecordDisplay_(foundRecord.row, foundRecord.indexes, createdAt);
    model.additions = Array.isArray(additionsByRecordId[model.recordId])
      ? additionsByRecordId[model.recordId]
      : [];
    model.hasRecordData = true;
  } catch (error) {
    model.noticeMessage = String(error && error.message ? error.message : '追記画面を表示できませんでした。');
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
      return createValidationResult_(false, '', '', '', '', AUTH_ERROR_MESSAGES_.emailMissing);
    }

    const userMasterSheet = getUserMasterSheet_();
    const validationRow = findUserMasterRow_(userMasterSheet, userKey);

    if (!validationRow) {
      return createValidationResult_(false, userKey, '', '', '', AUTH_ERROR_MESSAGES_.userNotFound);
    }

    const userName = String(validationRow.userName || '').trim();
    const branchName = String(validationRow.branchName || '').trim();
    const role = String(validationRow.role || '').trim();

    if (validationRow.activeFlag !== '有効') {
      return createValidationResult_(false, userKey, userName, branchName, '', AUTH_ERROR_MESSAGES_.userNotFound);
    }

    if (!isAllowedRole_(role)) {
      return createValidationResult_(false, userKey, userName, branchName, '', AUTH_ERROR_MESSAGES_.roleNotConfigured);
    }

    return createValidationResult_(true, userKey, userName, branchName, role, '');
  } catch (error) {
    return createValidationResult_(
      false,
      userKey,
      '',
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

    const role = String(validationRow.role || '').trim();
    return isAllowedRole_(role) ? role : '';
  } catch (error) {
    return '';
  }
}

function isSummaryViewer_(role) {
  const normalizedRole = typeof role === 'string' ? String(role || '').trim() : getCurrentUserRole_();
  return ['manager', 'sales_support', 'sysadmin'].includes(normalizedRole);
}

function isAllowedRole_(role) {
  return AUTH_ALLOWED_ROLES_.includes(String(role || '').trim());
}

function isDealInputRole_(role) {
  return ['sales', 'manager', 'sysadmin'].includes(String(role || '').trim());
}

function isDailyViewerRole_(role) {
  return ['sales', 'sysadmin'].includes(String(role || '').trim());
}

function isManagerOrSalesSupportRole_(role) {
  return ['manager', 'sales_support'].includes(String(role || '').trim());
}

function isDailyRecordEditorRole_(role) {
  return ['sales', 'sysadmin'].includes(String(role || '').trim());
}

function getRoleDailyReportUrl_(role) {
  if (isManagerOrSalesSupportRole_(role)) {
    return getManagerSummaryUrl();
  }

  return getDailyReportUrl();
}

function createValidationResult_(valid, userKey, userName, branchName, role, errorMessage) {
  return {
    valid,
    userKey,
    userName,
    branchName,
    role,
    errorMessage,
  };
}
