const TODO_TASKS_SHEET_NAME_ = 'todo_tasks';
const TODO_TASKS_ALLOWED_ROLES_ = ['sales', 'sysadmin'];
const TODO_TASKS_DATE_FORMAT_ = 'yyyy-MM-dd';
const TODO_TASKS_CREATED_AT_FORMAT_ = 'yyyy/MM/dd HH:mm:ss';
const TODO_TASKS_ID_PREFIX_ = 'TODO-';
const TODO_TASKS_HEADERS_ = [
  'todo_id',
  'user_key',
  'customer_name',
  'todo_content',
  'due_date',
  'priority',
  'source_record_id',
  'created_at',
];

function createTodoPageModel_(validationOverride, noticeMessageOverride) {
  const validation = validationOverride && typeof validationOverride === 'object'
    ? validationOverride
    : validateUser();
  const model = {
    pageTitle: '営業AIメモ｜TODO',
    validation,
    userName: validation && validation.valid ? String(validation.userName || '').trim() : '',
    todoGroupsByCustomer: [],
    todoGroupsByDate: [],
    todoGroupsByPriority: [],
    hasTodoData: false,
    emptyMessage: '現在のTODOはありません',
    noticeMessage: String(noticeMessageOverride || '').trim(),
    topPageLinkUrl: '',
  };

  try {
    model.topPageLinkUrl = String(ScriptApp.getService().getUrl() || '').trim();
  } catch (error) {
    model.topPageLinkUrl = '';
  }

  if (!validation || validation.valid !== true) {
    model.noticeMessage = String(validation && validation.errorMessage ? validation.errorMessage : 'TODOを表示できませんでした。');
    return model;
  }

  const role = String(validation.role || '').trim();
  if (!TODO_TASKS_ALLOWED_ROLES_.includes(role)) {
    model.noticeMessage = 'このページを表示する権限がありません';
    return model;
  }

  if (model.noticeMessage) {
    return model;
  }

  try {
    const result = getMyTodoTasks();
    if (!result || result.success !== true) {
      model.noticeMessage = String(result && result.errorMessage ? result.errorMessage : 'TODOを表示できませんでした。');
      return model;
    }

    const tasks = Array.isArray(result.tasks) ? result.tasks : [];
    model.todoGroupsByCustomer = groupTodoTasksByCustomer_(tasks);
    model.todoGroupsByDate = groupTodoTasksByDate_(tasks);
    model.todoGroupsByPriority = groupTodoTasksByPriority_(tasks);
    model.hasTodoData = tasks.length > 0;
  } catch (error) {
    model.noticeMessage = String(error && error.message ? error.message : 'TODOを表示できませんでした。');
  }

  return model;
}

function getMyTodoTasks() {
  return runTodoTaskOperation_(() => {
    const validation = validateTodoTaskAccess_();
    if (!validation.success) {
      return validation;
    }

    const sheet = getTodoTasksSheet_();
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      return createTodoTasksSuccessResponse_([]);
    }

    const indexes = getTodoTasksColumnIndexes_(values[0]);
    const ownUserKey = String(validation.validation.userKey || '').trim();
    const tasks = [];

    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      const row = values[rowIndex];
      const rowUserKey = String(row[indexes.userKey] || '').trim();
      if (rowUserKey !== ownUserKey) {
        continue;
      }

      tasks.push(buildTodoTaskDisplay_(row, indexes));
    }

    return createTodoTasksSuccessResponse_(tasks);
  });
}

function createTodoTask(payload) {
  return runTodoTaskOperation_(() => {
    const validation = validateTodoTaskAccess_();
    if (!validation.success) {
      return validation;
    }

    const normalizedPayload = normalizeTodoTaskPayload_(payload);
    if (!normalizedPayload.todoContent) {
      return createTodoTasksFailureResponse_('TODO内容を入力してください。');
    }

    const dueDate = normalizeTodoDueDate_(normalizedPayload.dueDate);
    if (normalizedPayload.dueDate !== undefined && normalizedPayload.dueDate !== null && String(normalizedPayload.dueDate).trim() !== '' && !dueDate) {
      return createTodoTasksFailureResponse_('期限の日付が正しくありません。');
    }

    const priority = normalizeTodoPriority_(normalizedPayload.priority);
    if (!priority) {
      return createTodoTasksFailureResponse_('重要度が正しくありません。');
    }

    const sheet = getTodoTasksSheet_();
    const todoId = generateTodoTaskId_();
    const createdAt = Utilities.formatDate(new Date(), WRITE_RECORD_TIMEZONE_, TODO_TASKS_CREATED_AT_FORMAT_);
    const userKey = String(validation.validation.userKey || '').trim();
    const rowValues = [
      todoId,
      userKey,
      normalizeTodoCustomerName_(normalizedPayload.customerName),
      normalizedPayload.todoContent,
      dueDate,
      priority,
      '',
      createdAt,
    ];

    try {
      sheet.appendRow(rowValues);
    } catch (error) {
      return createTodoTasksFailureResponse_('保存に失敗しました。しばらく経ってから、もう一度お試しください。');
    }

    const task = buildTodoTaskDisplayFromValues_(rowValues, getTodoTasksColumnIndexes_(TODO_TASKS_HEADERS_));
    return {
      success: true,
      task,
      errorMessage: '',
    };
  });
}

function createTodoFromDeal(recordId) {
  return runTodoTaskOperation_(() => {
    const validation = validateTodoTaskAccess_();
    if (!validation.success) {
      return validation;
    }

    const normalizedRecordId = String(recordId || '').trim();
    if (!normalizedRecordId) {
      return createTodoTasksFailureResponse_('対象の商談記録が見つかりません。');
    }

    const foundRecord = findTodoSourceDealRecord_(normalizedRecordId);
    if (!foundRecord) {
      return createTodoTasksFailureResponse_('対象の商談記録が見つかりません。');
    }

    const currentUserKey = String(validation.validation.userKey || '').trim();
    const recordUserKey = String(foundRecord.row[foundRecord.indexes.userKey] || '').trim();
    if (!currentUserKey || currentUserKey !== recordUserKey) {
      return createTodoTasksFailureResponse_('対象の商談記録からTODOを作成できません。');
    }

    const existingTask = findActiveTodoTaskBySourceRecordId_(currentUserKey, normalizedRecordId);
    if (existingTask) {
      return createTodoTasksFailureResponse_('この商談記録には既に有効なTODOがあります。');
    }

    const todoContent = normalizeTodoInitialContent_(foundRecord.row, foundRecord.indexes);
    if (!todoContent) {
      return createTodoTasksFailureResponse_('TODO内容を作成できませんでした。');
    }

    const customerName = String(foundRecord.row[foundRecord.indexes.customerName] || '').trim();
    const dueDate = normalizeTodoSourceDueDate_(foundRecord.row, foundRecord.indexes);
    const createdAt = Utilities.formatDate(new Date(), WRITE_RECORD_TIMEZONE_, TODO_TASKS_CREATED_AT_FORMAT_);
    const todoId = generateTodoTaskId_();
    const sheet = getTodoTasksSheet_();
    const rowValues = [
      todoId,
      currentUserKey,
      customerName,
      todoContent,
      dueDate,
      '中',
      normalizedRecordId,
      createdAt,
    ];

    try {
      sheet.appendRow(rowValues);
    } catch (error) {
      return createTodoTasksFailureResponse_('保存に失敗しました。しばらく経ってから、もう一度お試しください。');
    }

    const task = buildTodoTaskDisplayFromValues_(rowValues, getTodoTasksColumnIndexes_(TODO_TASKS_HEADERS_));
    return {
      success: true,
      task,
      errorMessage: '',
    };
  });
}

function updateTodoTask(payload) {
  return runTodoTaskOperation_(() => {
    const validation = validateTodoTaskAccess_();
    if (!validation.success) {
      return validation;
    }

    const normalizedPayload = normalizeTodoTaskPayload_(payload);
    const todoId = String(normalizedPayload.todoId || '').trim();
    if (!todoId) {
      return createTodoTasksFailureResponse_('対象のTODOが見つかりません。');
    }

    if (!normalizedPayload.todoContent) {
      return createTodoTasksFailureResponse_('TODO内容を入力してください。');
    }

    const dueDate = normalizeTodoDueDate_(normalizedPayload.dueDate);
    if (normalizedPayload.dueDate !== undefined && normalizedPayload.dueDate !== null && String(normalizedPayload.dueDate).trim() !== '' && !dueDate) {
      return createTodoTasksFailureResponse_('期限の日付が正しくありません。');
    }

    const priority = normalizeTodoPriority_(normalizedPayload.priority);
    if (!priority) {
      return createTodoTasksFailureResponse_('重要度が正しくありません。');
    }

    const foundTask = findTodoTaskRowByTodoIdAndUserKey_(todoId, String(validation.validation.userKey || '').trim());
    if (!foundTask) {
      return createTodoTasksFailureResponse_('対象のTODOが見つかりません。');
    }

    const updatedRow = foundTask.row.slice();
    updatedRow[foundTask.indexes.customerName] = normalizeTodoCustomerName_(normalizedPayload.customerName);
    updatedRow[foundTask.indexes.todoContent] = normalizedPayload.todoContent;
    updatedRow[foundTask.indexes.dueDate] = dueDate;
    updatedRow[foundTask.indexes.priority] = priority;

    try {
      foundTask.sheet.getRange(foundTask.rowNumber, 1, 1, TODO_TASKS_HEADERS_.length).setValues([updatedRow.slice(0, TODO_TASKS_HEADERS_.length)]);
    } catch (error) {
      return createTodoTasksFailureResponse_('保存に失敗しました。しばらく経ってから、もう一度お試しください。');
    }

    return {
      success: true,
      task: buildTodoTaskDisplayFromValues_(updatedRow, foundTask.indexes),
      errorMessage: '',
    };
  });
}

function completeTodoTask(todoId) {
  return runTodoTaskOperation_(() => {
    const validation = validateTodoTaskAccess_();
    if (!validation.success) {
      return validation;
    }

    const normalizedTodoId = String(todoId || '').trim();
    if (!normalizedTodoId) {
      return createTodoTasksFailureResponse_('対象のTODOが見つかりません。');
    }

    const foundTask = findTodoTaskRowByTodoIdAndUserKey_(normalizedTodoId, String(validation.validation.userKey || '').trim());
    if (!foundTask) {
      return createTodoTasksFailureResponse_('対象のTODOが見つかりません。');
    }

    try {
      foundTask.sheet.deleteRow(foundTask.rowNumber);
    } catch (error) {
      return createTodoTasksFailureResponse_('削除に失敗しました。しばらく経ってから、もう一度お試しください。');
    }

    return {
      success: true,
      todoId: normalizedTodoId,
      errorMessage: '',
    };
  });
}

function validateTodoTaskAccess_() {
  const validation = validateUser();
  if (!validation || validation.valid !== true) {
    return createTodoTasksFailureResponse_(String(validation && validation.errorMessage ? validation.errorMessage : '利用者情報を確認できませんでした。'));
  }

  const role = String(validation.role || '').trim();
  if (!TODO_TASKS_ALLOWED_ROLES_.includes(role)) {
    return createTodoTasksFailureResponse_('この機能を利用できません。');
  }

  return {
    success: true,
    validation,
  };
}

function createTodoTasksSuccessResponse_(tasks) {
  return {
    success: true,
    tasks: Array.isArray(tasks) ? tasks : [],
    errorMessage: '',
  };
}

function createTodoTasksFailureResponse_(message) {
  return {
    success: false,
    errorMessage: String(message || '処理に失敗しました。'),
  };
}

function runTodoTaskOperation_(operation) {
  try {
    const result = operation();
    if (result && typeof result === 'object' && 'success' in result) {
      return result;
    }

    return createTodoTasksFailureResponse_('処理に失敗しました。');
  } catch (error) {
    return createTodoTasksFailureResponse_('処理に失敗しました。');
  }
}

function getTodoTasksSheet_() {
  const spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
  const sheet = spreadsheet.getSheetByName(TODO_TASKS_SHEET_NAME_);

  if (!sheet) {
    throw new Error('todo_tasks シートが見つかりません');
  }

  return sheet;
}

function getTodoTasksColumnIndexes_(headers) {
  const normalizedHeaders = Array.isArray(headers)
    ? headers.map((header) => String(header || '').trim())
    : [];

  const todoIdIndex = normalizedHeaders.indexOf('todo_id');
  const userKeyIndex = normalizedHeaders.indexOf('user_key');
  const customerNameIndex = normalizedHeaders.indexOf('customer_name');
  const todoContentIndex = normalizedHeaders.indexOf('todo_content');
  const dueDateIndex = normalizedHeaders.indexOf('due_date');
  const priorityIndex = normalizedHeaders.indexOf('priority');
  const sourceRecordIdIndex = normalizedHeaders.indexOf('source_record_id');
  const createdAtIndex = normalizedHeaders.indexOf('created_at');

  if ([
    todoIdIndex,
    userKeyIndex,
    customerNameIndex,
    todoContentIndex,
    dueDateIndex,
    priorityIndex,
    sourceRecordIdIndex,
    createdAtIndex,
  ].some((index) => index < 0)) {
    throw new Error('todo_tasks の見出しが不正です。');
  }

  return {
    todoId: todoIdIndex,
    userKey: userKeyIndex,
    customerName: customerNameIndex,
    todoContent: todoContentIndex,
    dueDate: dueDateIndex,
    priority: priorityIndex,
    sourceRecordId: sourceRecordIdIndex,
    createdAt: createdAtIndex,
  };
}

function buildTodoTaskDisplay_(row, indexes) {
  const rowValues = Array.isArray(row) ? row : [];
  return buildTodoTaskDisplayFromValues_(rowValues, indexes);
}

function buildTodoTaskDisplayFromValues_(rowValues, indexes) {
  const normalizedRow = Array.isArray(rowValues) ? rowValues : [];
  const customerName = String(normalizedRow[indexes.customerName] || '').trim();
  const todoContent = String(normalizedRow[indexes.todoContent] || '').trim();
  const dueDate = normalizeTodoDueDate_(normalizedRow[indexes.dueDate]);
  const createdAt = normalizeTodoCreatedAt_(normalizedRow[indexes.createdAt]);
  const dueState = resolveTodoDueState_(dueDate);
  const sourceRecordId = String(normalizedRow[indexes.sourceRecordId] || '').trim();

  return {
    todoId: String(normalizedRow[indexes.todoId] || '').trim(),
    customerName,
    customerDisplayName: customerName || 'その他',
    todoContent,
    dueDate,
    dueDateLabel: dueDate || '期限なし',
    priority: normalizeTodoPriority_(normalizedRow[indexes.priority]) || '中',
    sourceRecordId,
    originLabel: sourceRecordId ? '元商談由来' : '直接追加',
    isFromDeal: Boolean(sourceRecordId),
    createdAt: createdAt ? Utilities.formatDate(createdAt, WRITE_RECORD_TIMEZONE_, TODO_TASKS_CREATED_AT_FORMAT_) : '',
    dueState,
  };
}

function normalizeTodoTaskPayload_(payload) {
  const payloadObject = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};

  return {
    todoId: String(payloadObject.todoId ?? payloadObject.todo_id ?? '').trim(),
    customerName: String(payloadObject.customerName ?? payloadObject.customer_name ?? '').trim(),
    todoContent: String(payloadObject.todoContent ?? payloadObject.todo_content ?? '').trim(),
    dueDate: payloadObject.dueDate ?? payloadObject.due_date ?? '',
    priority: String(payloadObject.priority ?? '').trim(),
  };
}

function normalizeTodoCustomerName_(value) {
  return String(value || '').trim();
}

function normalizeTodoPriority_(value) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return '中';
  }

  if (['高', '中', '低'].includes(normalizedValue)) {
    return normalizedValue;
  }

  return '';
}

function normalizeTodoDueDate_(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Utilities.formatDate(value, WRITE_RECORD_TIMEZONE_, TODO_TASKS_DATE_FORMAT_);
  }

  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return '';
  }

  const matched = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) {
    return '';
  }

  const parsedDate = Utilities.parseDate(normalizedValue, WRITE_RECORD_TIMEZONE_, TODO_TASKS_DATE_FORMAT_);
  const roundTrip = Utilities.formatDate(parsedDate, WRITE_RECORD_TIMEZONE_, TODO_TASKS_DATE_FORMAT_);
  if (roundTrip !== normalizedValue) {
    return '';
  }

  return normalizedValue;
}

function normalizeTodoCreatedAt_(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }

  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    return Utilities.parseDate(normalizedValue, WRITE_RECORD_TIMEZONE_, TODO_TASKS_CREATED_AT_FORMAT_);
  } catch (error) {
    const fallbackDate = new Date(normalizedValue);
    return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
  }
}

function resolveTodoDueState_(dueDate) {
  if (!dueDate) {
    return 'none';
  }

  const normalizedDateText = normalizeTodoDueDate_(dueDate);
  if (!normalizedDateText) {
    return 'none';
  }

  const todayText = Utilities.formatDate(new Date(), WRITE_RECORD_TIMEZONE_, TODO_TASKS_DATE_FORMAT_);
  if (normalizedDateText < todayText) {
    return 'overdue';
  }

  if (normalizedDateText === todayText) {
    return 'today';
  }

  return 'future';
}

function getTodoPageUrl_() {
  const serviceUrl = String(ScriptApp.getService().getUrl() || '').trim();
  return serviceUrl ? `${serviceUrl}?view=todo` : '';
}

function groupTodoTasksByCustomer_(tasks) {
  const grouped = new Map();
  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    const groupLabel = String(task && task.customerDisplayName ? task.customerDisplayName : 'その他').trim() || 'その他';
    if (!grouped.has(groupLabel)) {
      grouped.set(groupLabel, []);
    }
    grouped.get(groupLabel).push(task);
  }

  return Array.from(grouped.entries())
    .map(([groupLabel, groupTasks]) => ({
      groupKey: groupLabel,
      groupLabel,
      tasks: sortTodoTasksForDisplay_(groupTasks),
    }))
    .sort((a, b) => compareTodoCustomerGroupLabels_(a.groupLabel, b.groupLabel));
}

function groupTodoTasksByDate_(tasks) {
  const groups = {
    overdue: [],
    today: [],
    future: [],
    none: [],
  };

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    const dueState = resolveTodoDueState_(task && task.dueDate ? task.dueDate : '');
    if (!groups[dueState]) {
      groups.none.push(task);
      continue;
    }
    groups[dueState].push(task);
  }

  const orderedGroups = [
    ['overdue', '期限切れ'],
    ['today', '今日'],
    ['future', '今後'],
    ['none', '期限なし'],
  ];

  return orderedGroups
    .filter(([groupKey]) => Array.isArray(groups[groupKey]) && groups[groupKey].length > 0)
    .map(([groupKey, groupLabel]) => ({
      groupKey,
      groupLabel,
      tasks: groupKey === 'none'
        ? sortTodoTasksForCreatedAt_(groups[groupKey])
        : sortTodoTasksForDisplay_(groups[groupKey]),
    }));
}

function groupTodoTasksByPriority_(tasks) {
  const groups = {
    高: [],
    中: [],
    低: [],
  };

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    const priority = String(task && task.priority ? task.priority : '中').trim();
    if (!groups[priority]) {
      groups['中'].push(task);
      continue;
    }
    groups[priority].push(task);
  }

  return ['高', '中', '低']
    .filter((priority) => Array.isArray(groups[priority]) && groups[priority].length > 0)
    .map((priority) => ({
      groupKey: priority,
      groupLabel: priority,
      tasks: sortTodoTasksForDisplay_(groups[priority]),
    }));
}

function sortTodoTasksForDisplay_(tasks) {
  return Array.isArray(tasks)
    ? tasks.slice().sort(compareTodoTasksByDueDateThenCreatedAt_)
    : [];
}

function sortTodoTasksForCreatedAt_(tasks) {
  return Array.isArray(tasks)
    ? tasks.slice().sort(compareTodoTasksByCreatedAtDesc_)
    : [];
}

function compareTodoCustomerGroupLabels_(leftLabel, rightLabel) {
  const left = String(leftLabel || '').trim();
  const right = String(rightLabel || '').trim();

  if (left === 'その他' && right !== 'その他') {
    return 1;
  }

  if (right === 'その他' && left !== 'その他') {
    return -1;
  }

  return left.localeCompare(right, 'ja');
}

function compareTodoTasksByDueDateThenCreatedAt_(leftTask, rightTask) {
  const leftDueDate = String(leftTask && leftTask.dueDate ? leftTask.dueDate : '').trim();
  const rightDueDate = String(rightTask && rightTask.dueDate ? rightTask.dueDate : '').trim();

  if (leftDueDate && !rightDueDate) {
    return -1;
  }

  if (!leftDueDate && rightDueDate) {
    return 1;
  }

  if (leftDueDate && rightDueDate && leftDueDate !== rightDueDate) {
    return leftDueDate.localeCompare(rightDueDate, 'en');
  }

  return compareTodoTasksByCreatedAtDesc_(leftTask, rightTask);
}

function compareTodoTasksByCreatedAtDesc_(leftTask, rightTask) {
  const leftCreatedAt = String(leftTask && leftTask.createdAt ? leftTask.createdAt : '').trim();
  const rightCreatedAt = String(rightTask && rightTask.createdAt ? rightTask.createdAt : '').trim();

  if (leftCreatedAt && rightCreatedAt && leftCreatedAt !== rightCreatedAt) {
    return rightCreatedAt.localeCompare(leftCreatedAt, 'en');
  }

  const leftTodoId = String(leftTask && leftTask.todoId ? leftTask.todoId : '').trim();
  const rightTodoId = String(rightTask && rightTask.todoId ? rightTask.todoId : '').trim();
  return rightTodoId.localeCompare(leftTodoId, 'en');
}

function generateTodoTaskId_() {
  const timestamp = Utilities.formatDate(new Date(), WRITE_RECORD_TIMEZONE_, 'yyyyMMddHHmmss');
  const uuidSegment = String(Utilities.getUuid()).replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${TODO_TASKS_ID_PREFIX_}${timestamp}-${uuidSegment}`;
}

function findTodoTaskRowByTodoIdAndUserKey_(todoId, userKey) {
  const normalizedTodoId = String(todoId || '').trim();
  const normalizedUserKey = String(userKey || '').trim();
  if (!normalizedTodoId || !normalizedUserKey) {
    return null;
  }

  const sheet = getTodoTasksSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return null;
  }

  const indexes = getTodoTasksColumnIndexes_(values[0]);
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const currentTodoId = String(row[indexes.todoId] || '').trim();
    const currentUserKey = String(row[indexes.userKey] || '').trim();
    if (currentTodoId !== normalizedTodoId || currentUserKey !== normalizedUserKey) {
      continue;
    }

    return {
      sheet,
      row,
      rowNumber: rowIndex + 1,
      indexes,
    };
  }

  return null;
}

function findActiveTodoTaskBySourceRecordId_(userKey, sourceRecordId) {
  const normalizedUserKey = String(userKey || '').trim();
  const normalizedSourceRecordId = String(sourceRecordId || '').trim();
  if (!normalizedUserKey || !normalizedSourceRecordId) {
    return null;
  }

  const sheet = getTodoTasksSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return null;
  }

  const indexes = getTodoTasksColumnIndexes_(values[0]);
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const currentUserKey = String(row[indexes.userKey] || '').trim();
    const currentSourceRecordId = String(row[indexes.sourceRecordId] || '').trim();
    if (currentUserKey !== normalizedUserKey || currentSourceRecordId !== normalizedSourceRecordId) {
      continue;
    }

    return {
      sheet,
      row,
      rowNumber: rowIndex + 1,
      indexes,
    };
  }

  return null;
}

function getActiveTodoSourceRecordIdsByUserKey_(userKey) {
  const normalizedUserKey = String(userKey || '').trim();
  if (!normalizedUserKey) {
    return new Set();
  }

  let sheet;
  try {
    sheet = getTodoTasksSheet_();
  } catch (error) {
    return new Set();
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return new Set();
  }

  const indexes = getTodoTasksColumnIndexes_(values[0]);
  const sourceRecordIds = new Set();

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const rowUserKey = String(row[indexes.userKey] || '').trim();
    if (rowUserKey !== normalizedUserKey) {
      continue;
    }

    const sourceRecordId = String(row[indexes.sourceRecordId] || '').trim();
    if (!sourceRecordId) {
      continue;
    }

    sourceRecordIds.add(sourceRecordId);
  }

  return sourceRecordIds;
}

function normalizeTodoInitialContent_(row, indexes) {
  const todoItem = String(row[indexes.todoItem] || '').trim();
  if (todoItem) {
    return todoItem;
  }

  const dealTheme = String(row[indexes.dealTheme] || '').trim();
  const dealContent = String(row[indexes.dealContent] || '').trim();
  return buildDailyReportSummary_(dealTheme, dealContent);
}

function normalizeTodoSourceDueDate_(row, indexes) {
  const deadlineNormalizedIndex = indexes && Object.prototype.hasOwnProperty.call(indexes, 'deadlineNormalized')
    ? indexes.deadlineNormalized
    : -1;
  if (deadlineNormalizedIndex >= 0) {
    const normalizedDueDate = normalizeTodoDueDate_(row[deadlineNormalizedIndex]);
    if (normalizedDueDate) {
      return normalizedDueDate;
    }
  }

  return '';
}

function findTodoSourceDealRecord_(recordId) {
  const normalizedRecordId = String(recordId || '').trim();
  if (!normalizedRecordId) {
    return null;
  }

  const sheet = getDealRecordsSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return null;
  }

  const indexes = getTodoSourceDealRecordColumnIndexes_(values[0]);
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const currentRecordId = String(row[indexes.recordId] || '').trim();
    if (currentRecordId !== normalizedRecordId) {
      continue;
    }

    return {
      row,
      rowNumber: rowIndex + 1,
      indexes,
    };
  }

  return null;
}

function getTodoSourceDealRecordColumnIndexes_(headers) {
  const normalizedHeaders = Array.isArray(headers)
    ? headers.map((header) => String(header || '').trim())
    : [];

  const recordIdIndex = normalizedHeaders.indexOf('record_id');
  const userKeyIndex = normalizedHeaders.indexOf('user_key');
  const customerNameIndex = normalizedHeaders.indexOf('customer_name');
  const todoItemIndex = normalizedHeaders.indexOf('todo_item');
  const todoDeadlineIndex = normalizedHeaders.indexOf('todo_deadline');
  const deadlineNormalizedIndex = normalizedHeaders.indexOf('deadline_normalized');
  const dealThemeIndex = normalizedHeaders.indexOf('deal_theme');
  const dealContentIndex = normalizedHeaders.indexOf('deal_content');

  if ([
    recordIdIndex,
    userKeyIndex,
    customerNameIndex,
    todoItemIndex,
    todoDeadlineIndex,
    deadlineNormalizedIndex,
    dealThemeIndex,
    dealContentIndex,
  ].some((index) => index < 0)) {
    throw new Error('deal_records の見出しが不正です。');
  }

  return {
    recordId: recordIdIndex,
    userKey: userKeyIndex,
    customerName: customerNameIndex,
    todoItem: todoItemIndex,
    todoDeadline: todoDeadlineIndex,
    deadlineNormalized: deadlineNormalizedIndex,
    dealTheme: dealThemeIndex,
    dealContent: dealContentIndex,
  };
}
