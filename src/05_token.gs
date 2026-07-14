const TOKEN_TIME_TO_LIVE_SECONDS_ = 12 * 60 * 60;

function getTokenSecret() {
  const secret = String(PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET') || '').trim();

  if (!secret) {
    throw new Error('TOKEN_SECRET が設定されていません。');
  }

  return secret;
}

function getInputPageUrl_() {
  const inputPageUrl = String(PropertiesService.getScriptProperties().getProperty('INPUT_PAGE_URL') || '').trim();

  if (!inputPageUrl) {
    throw new Error('INPUT_PAGE_URL が設定されていません。');
  }

  return inputPageUrl;
}

function issueToken(email) {
  const normalizedEmail = String(email || '').trim();
  if (!normalizedEmail) {
    throw new Error('メールアドレスが空です。');
  }

  const secret = getTokenSecret();
  const payload = {
    uh: computeUserHash_(normalizedEmail, secret),
    exp: Math.floor(new Date().getTime() / 1000) + TOKEN_TIME_TO_LIVE_SECONDS_,
  };

  const payloadText = JSON.stringify(payload);
  const payloadToken = encodeBase64Url_(payloadText);
  const signatureToken = computeHmacBase64Url_(payloadToken, secret);

  return `${payloadToken}.${signatureToken}`;
}

function verifyToken(token) {
  const tokenText = String(token || '').trim();
  if (!tokenText) {
    return createTokenValidationResult_(false, '', 'トークンがありません。');
  }

  const parts = tokenText.split('.');
  if (parts.length !== 2) {
    return createTokenValidationResult_(false, '', 'トークンの形式が不正です。');
  }

  const payloadToken = parts[0];
  const signatureToken = parts[1];
  const secret = getTokenSecret();

  let payloadObject;
  try {
    payloadObject = JSON.parse(decodeBase64UrlToText_(payloadToken));
  } catch (error) {
    return createTokenValidationResult_(false, '', 'トークンの内容を解析できませんでした。');
  }

  const expectedSignature = computeHmacBase64Url_(payloadToken, secret);
  if (signatureToken !== expectedSignature) {
    return createTokenValidationResult_(false, '', 'トークンの署名が一致しません。');
  }

  const expirationSeconds = Number(payloadObject && payloadObject.exp);
  if (!Number.isFinite(expirationSeconds)) {
    return createTokenValidationResult_(false, '', 'トークンの有効期限が不正です。');
  }

  const nowSeconds = Math.floor(new Date().getTime() / 1000);
  if (nowSeconds > expirationSeconds) {
    return createTokenValidationResult_(false, '', 'トークンの有効期限が切れています。');
  }

  const tokenUserHash = String(payloadObject && payloadObject.uh ? payloadObject.uh : '').trim();
  if (!tokenUserHash) {
    return createTokenValidationResult_(false, '', 'トークンに担当者情報がありません。');
  }

  const userMatch = findUserMasterRowByHash_(tokenUserHash, secret);
  if (!userMatch) {
    return createTokenValidationResult_(false, '', '担当者を特定できませんでした。');
  }

  if (userMatch.activeFlag === '無効') {
    return createTokenValidationResult_(false, '', '無効な担当者のためトークンを利用できません。');
  }

  return createTokenValidationResult_(true, userMatch.userKey, '');
}

function doPost(e) {
  const requestPayload = parseRequestPayload_(e);
  const token = String(requestPayload.token || '').trim();
  const inputText = String(requestPayload.inputText || '').trim();
  void inputText;

  let verification;
  try {
    verification = verifyToken(token);
  } catch (error) {
    verification = createTokenValidationResult_(
      false,
      '',
      String(error && error.message ? error.message : 'トークンの検証に失敗しました。'),
    );
  }

  return createJsonResponse_(verification);
}

function parseRequestPayload_(e) {
  const rawText = e && e.postData && typeof e.postData.contents === 'string'
    ? String(e.postData.contents || '').trim()
    : '';

  if (rawText) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      const formPayload = parseFormEncodedPayload_(rawText);
      if (Object.keys(formPayload).length > 0) {
        return formPayload;
      }
    }
  }

  if (e && e.parameter && typeof e.parameter === 'object') {
    return { ...e.parameter };
  }

  return {};
}

function parseFormEncodedPayload_(text) {
  const payload = {};
  const segments = String(text || '').split('&');

  for (const segment of segments) {
    if (!segment) {
      continue;
    }

    const separatorIndex = segment.indexOf('=');
    const rawKey = separatorIndex >= 0 ? segment.slice(0, separatorIndex) : segment;
    const rawValue = separatorIndex >= 0 ? segment.slice(separatorIndex + 1) : '';
    const key = safeDecodeURIComponent_(String(rawKey || '').replace(/\+/g, ' '));
    const value = safeDecodeURIComponent_(String(rawValue || '').replace(/\+/g, ' '));

    if (key) {
      payload[key] = value;
    }
  }

  return payload;
}

function createTokenValidationResult_(valid, userKey, errorMessage) {
  return {
    valid,
    userKey,
    errorMessage,
  };
}

function computeUserHash_(email, secret) {
  return computeHmacBase64Url_(String(email || '').trim(), secret);
}

function findUserMasterRowByHash_(tokenUserHash, secret) {
  const userRows = getUserMasterRows_();

  for (const row of userRows) {
    const candidateHash = computeUserHash_(row.userKey, secret);
    if (candidateHash !== tokenUserHash) {
      continue;
    }

    return row;
  }

  return null;
}

function getUserMasterRows_() {
  const userMasterSheet = getUserMasterSheet_();
  const values = userMasterSheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers = values[0].map((header) => String(header || '').trim());
  const keyIndex = headers.indexOf('user_key');
  const nameIndex = headers.indexOf('user_fullname');
  const branchIndex = headers.indexOf('master_branch_name');
  const activeIndex = headers.indexOf('active_flag');

  if ([keyIndex, nameIndex, branchIndex, activeIndex].some((index) => index < 0)) {
    throw new Error('user_master の見出しが不正です');
  }

  const rows = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const userKey = String(row[keyIndex] || '').trim();

    if (!userKey) {
      continue;
    }

    rows.push({
      userKey,
      userName: String(row[nameIndex] || '').trim(),
      branchName: String(row[branchIndex] || '').trim(),
      activeFlag: String(row[activeIndex] || '').trim(),
    });
  }

  return rows;
}

function computeHmacBase64Url_(data, secret) {
  const bytes = Utilities.computeHmacSha256Signature(String(data || ''), String(secret || ''));
  return encodeBytesToBase64Url_(bytes);
}

function encodeBase64Url_(text) {
  return encodeBytesToBase64Url_(Utilities.newBlob(String(text || ''), 'text/plain', 'token.txt').getBytes());
}

function encodeBytesToBase64Url_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function decodeBase64UrlToText_(text) {
  const normalizedText = String(text || '').replace(/-/g, '+').replace(/_/g, '/');
  const paddedText = padBase64_(normalizedText);
  const bytes = Utilities.base64DecodeWebSafe(paddedText);
  return Utilities.newBlob(bytes).getDataAsString('UTF-8');
}

function padBase64_(text) {
  const normalizedText = String(text || '');
  const remainder = normalizedText.length % 4;
  if (!remainder) {
    return normalizedText;
  }

  return `${normalizedText}${'='.repeat(4 - remainder)}`;
}

function createJsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function safeDecodeURIComponent_(text) {
  try {
    return decodeURIComponent(String(text || ''));
  } catch (error) {
    return String(text || '');
  }
}
