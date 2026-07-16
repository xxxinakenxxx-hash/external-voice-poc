const AUTH_ERROR_MESSAGES_ = {
  emailMissing: 'ログイン中のメールアドレスを取得できませんでした。',
  userNotFound: '登録されていない担当者です。管理者に連絡してください。',
  sheetReadFailure: '担当者マスタの読み込みに失敗しました。',
};

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('top');
  template.model = createTopPageModel_();

  return template
    .evaluate()
    .setTitle('営業AIメモ')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function createTopPageModel_() {
  const validation = validateUser();

  const model = {
    pageTitle: '営業AIメモ',
    validation,
    userName: validation && validation.valid ? String(validation.userName || '').trim() : '',
    inputPageLinkUrl: '',
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

  return model;
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
    };
  }

  return null;
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
