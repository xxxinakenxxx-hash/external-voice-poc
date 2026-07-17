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
