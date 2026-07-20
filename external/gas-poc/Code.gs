const EX02_TIME_ZONE_ = 'Asia/Tokyo';
const EX02_RESPONSE_FORMAT_ = "yyyy-MM-dd'T'HH:mm:ssXXX";

function doGet(e) {
  const activeEmail = String(Session.getActiveUser().getEmail() || '');
  const effectiveEmail = String(Session.getEffectiveUser().getEmail() || '');
  const apiUrl = String(PropertiesService.getScriptProperties().getProperty('EX03_API_URL') || '');
  const html = HtmlService.createHtmlOutput([
    '<!doctype html>',
    '<html lang="ja">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>EX-03 GAS TOP認証確認</title>',
    '<style>',
    'body{font-family:sans-serif;line-height:1.6;margin:24px;}',
    '.label{font-size:14px;color:#555;margin-bottom:8px;}',
    '.value{font-size:20px;font-weight:700;word-break:break-all;}',
    '</style>',
    '</head>',
    '<body>',
    '<div class="label">Session.getActiveUser().getEmail()</div>',
    `<div class="value">${escapeHtml_(activeEmail || '取得できず')}</div>`,
    '<div class="label">Session.getEffectiveUser().getEmail()</div>',
    `<div class="value">${escapeHtml_(effectiveEmail || '取得できず')}</div>`,
    '<div class="label">EX03_API_URL</div>',
    `<div class="value">${escapeHtml_(apiUrl || '未設定')}</div>`,
    '</body>',
    '</html>',
  ].join(''));

  return html;
}

function doPost(e) {
  const request = parseEx02Request_(e);
  const receivedToken = String(request.token ?? '');
  const receivedText = String(request.text ?? '');
  const success = Boolean(receivedToken || receivedText);

  const response = {
    success,
    receivedToken,
    receivedText,
    receivedAt: Utilities.formatDate(new Date(), EX02_TIME_ZONE_, EX02_RESPONSE_FORMAT_),
  };

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseEx02Request_(e) {
  const postData = e && e.postData ? e.postData : {};
  const contents = String(postData.contents ?? '').trim();
  const parameter = e && e.parameter && typeof e.parameter === 'object' ? e.parameter : {};

  if (contents) {
    try {
      const parsed = JSON.parse(contents);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          token: parsed.token ?? '',
          text: parsed.text ?? '',
        };
      }
    } catch (error) {
      // JSON以外のPOSTでも、下のparameterから拾う。
    }
  }

  return {
    token: parameter.token ?? '',
    text: parameter.text ?? '',
  };
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
