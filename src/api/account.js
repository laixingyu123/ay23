/**
 * 账号管理 API
 */

import apiClient, { handleApiResponse } from './client.js';

/**
 * 添加官方账号
 * @description 添加一个新的官方账号，可以用于出售。支持三种登录类型：账号密码登录、LinuxDo登录、GitHub登录
 *
 * 功能特性：
 * 1. 自动关联到官方用户（official_user_001）
 * 2. 自动随机分配官方类型的工作流地址
 * 3. 默认设置为可出售状态（can_sell=true）
 * 4. 支持可选字段：session、session_expire_time、checkin_date、balance、used、platform_type、register_email_password
 * @param {Object} accountData - 账号数据
 * @param {string} accountData.username - 账号名称，根据account_type不同含义不同：0-AnyRouter账号名，1-LinuxDo账号名，2-GitHub账号名
 * @param {string} accountData.password - 账号密码，根据account_type不同含义不同：0-AnyRouter密码，1-LinuxDo密码，2-GitHub密码
 * @param {number} [accountData.account_type=0] - 账号类型（可选，默认0）：0-账号密码登录，1-LinuxDo登录，2-GitHub登录
 * @param {string} [accountData.platform_type='anyrouter'] - 平台类型（可选，默认anyrouter）：anyrouter、agentrouter、coderouter
 * @param {string} [accountData.register_email_password] - 注册邮箱密码（可选），格式为：邮箱-密码
 * @param {string} [accountData.session=''] - Session会话标识（可选，默认为空字符串）
 * @param {number} [accountData.session_expire_time=0] - Session过期时间戳（可选，默认为0）
 * @param {number} [accountData.checkin_date=0] - 签到时间戳（可选，默认为0）
 * @param {number} [accountData.balance=0] - AnyRouter余额（可选，默认为0）
 * @param {number} [accountData.used=0] - 已使用额度（可选，默认为0）
 * @returns {Promise<{success: boolean, data?: {account_id: string, username: string, account_type: number}, error?: string}>}
 */
export async function addOfficialAccount(accountData) {
	const {
		username,
		password,
		account_type = 0,
		platform_type = 'anyrouter',
		register_email_password,
		session = '',
		session_expire_time = 0,
		checkin_date = 0,
		balance = 0,
		used = 0,
	} = accountData;

	// 验证必需字段
	if (!username || !password) {
		return {
			success: false,
			error: '用户名和密码不能为空',
		};
	}

	// 验证账号类型
	if (![0, 1, 2].includes(account_type)) {
		return {
			success: false,
			error: '账号类型必须为0（账号密码）、1（LinuxDo）或2（GitHub）',
		};
	}

	// 验证平台类型
	if (!['anyrouter', 'agentrouter', 'coderouter'].includes(platform_type)) {
		return {
			success: false,
			error: '平台类型必须为anyrouter、agentrouter或coderouter',
		};
	}

	// 验证余额必须为非负数
	if (typeof balance !== 'number' || balance < 0) {
		return {
			success: false,
			error: '余额必须为非负数',
		};
	}

	// 验证已使用额度必须为非负数
	if (typeof used !== 'number' || used < 0) {
		return {
			success: false,
			error: '已使用额度必须为非负数',
		};
	}

	// 构建请求数据
	const requestData = {
		username,
		password,
		account_type,
		platform_type,
		session,
		session_expire_time,
		checkin_date,
		balance,
		used,
	};

	// 只有在提供了 register_email_password 时才添加到请求中
	if (register_email_password) {
		requestData.register_email_password = register_email_password;
	}

	return handleApiResponse(
		apiClient.post('/lyanyrouter/addOfficialAccount', requestData)
	);
}

/**
 * 添加AnyRouter账号
 * @description 为指定用户添加新的AnyRouter账号。支持三种账号类型：
 * - 0: AnyRouter账号（账号密码登录）
 * - 1: LinuxDo账号（第三方登录）
 * - 2: GitHub账号（第三方登录）
 *
 * 功能特性：
 * 1. 自动验证用户是否存在
 * 2. 检查用户账号数量是否达到上限
 * 3. 自动设置签到模式（AnyRouter账号强制为1，其他类型可自定义）
 * 4. 支持可选字段：session、session_expire_time、aff_code、account_id、balance、used、checkin_date、notes
 * 5. 自动创建时间戳和初始化字段
 * @param {Object} accountData - 账号数据
 * @param {string} accountData.user_id - AnyRouter用户ID（关联anyrouter-users表的_id）
 * @param {string} accountData.username - 账号用户名，根据account_type不同含义不同：0-AnyRouter账号名，1-LinuxDo账号名，2-GitHub账号名
 * @param {string} accountData.password - 账号密码，根据account_type不同含义不同：0-AnyRouter密码，1-LinuxDo密码，2-GitHub密码
 * @param {number} [accountData.account_type=0] - 账号类型（可选，默认0）：0-AnyRouter账号，1-LinuxDo账号，2-GitHub账号
 * @param {number} [accountData.checkin_mode] - 签到模式（可选）：1-只签到AnyRouter，2-只签到AgentRouter，3-两者都签到。注意：AnyRouter账号（account_type=0）强制只能签到AnyRouter（忽略此参数）；其他类型账号：优先使用此参数，未传入则使用用户的allowed_checkin_mode
 * @param {string} [accountData.session=''] - 会话标识（可选，默认为空字符串）
 * @param {number} [accountData.session_expire_time=0] - Session过期时间戳（可选，默认为0）
 * @param {string} [accountData.aff_code=''] - AnyRouter邀请码（可选，默认为空字符串）
 * @param {string} [accountData.account_id=''] - AnyRouter平台账号ID（可选，默认为空字符串）
 * @param {number} [accountData.balance=0] - AnyRouter余额，单位为$（可选，默认为0）
 * @param {number} [accountData.used=0] - AnyRouter账号已使用的额度，单位为$（可选，默认为0）
 * @param {number} [accountData.checkin_date=0] - 签到时间戳（可选，默认为0）
 * @param {string} [accountData.notes=''] - 备注信息（可选，默认为空字符串）
 * @returns {Promise<{success: boolean, data?: {_id: string, user_id: string, username: string, account_type: number, checkin_mode: number, create_date: number}, error?: string}>}
 */
export async function addAccount(accountData) {
	const {
		user_id,
		username,
		password,
		account_type = 0,
		checkin_mode,
		session = '',
		session_expire_time = 0,
		aff_code = '',
		account_id = '',
		balance = 0,
		used = 0,
		checkin_date = 0,
		notes = '',
	} = accountData;

	// 验证必需字段
	if (!user_id || !username || !password) {
		return {
			success: false,
			error: '用户ID、用户名和密码不能为空',
		};
	}

	// 验证账号类型
	if (![0, 1, 2].includes(account_type)) {
		return {
			success: false,
			error: '账号类型必须为0（AnyRouter）、1（LinuxDo）或2（GitHub）',
		};
	}

	// 验证签到模式（如果提供）
	if (checkin_mode !== undefined && ![1, 2, 3].includes(checkin_mode)) {
		return {
			success: false,
			error: '签到模式必须为1、2或3',
		};
	}

	// 验证余额必须为非负数
	if (typeof balance !== 'number' || balance < 0) {
		return {
			success: false,
			error: '余额必须为非负数',
		};
	}

	// 验证已使用额度必须为非负数
	if (typeof used !== 'number' || used < 0) {
		return {
			success: false,
			error: '已使用额度必须为非负数',
		};
	}

	// 构建请求数据
	const requestData = {
		user_id,
		username,
		password,
		account_type,
		session,
		session_expire_time,
		aff_code,
		account_id,
		balance,
		used,
		checkin_date,
		notes,
	};

	// 只有在明确提供了 checkin_mode 时才添加到请求中
	if (checkin_mode !== undefined) {
		requestData.checkin_mode = checkin_mode;
	}

	return handleApiResponse(apiClient.post('/lyanyrouter/addAccount', requestData));
}

/**
 * 更新账号信息
 * @description 更新指定账号的信息，支持部分字段更新
 *
 * **特殊处理**：
 * - `event_backup` 字段会与现有数据**合并**，而非覆盖。新字段会添加，同名字段会被新值覆盖，旧的其他字段会保留
 * - `create_date` 字段不允许更新
 * - 更新时会自动设置 `update_date` 为当前时间戳
 *
 * @param {string} _id - 账号记录ID
 * @param {Object} updateData - 要更新的数据
 * @param {string} [updateData.anyrouter_user_id] - 关联的AnyRouter用户ID，拥有这个账号的人（内部）
 * @param {string} [updateData.username] - 账号名称，根据account_type不同含义不同
 * @param {string} [updateData.password] - 账号密码，根据account_type不同含义不同
 * @param {number} [updateData.account_type] - 账号类型：0-账号密码登录，1-LinuxDo登录，2-GitHub登录，3-微信登录
 * @param {string} [updateData.platform_type] - newapi平台类型：anyrouter、agentrouter、coderouter
 * @param {string} [updateData.aff_code] - newapi账号的邀请码
 * @param {string} [updateData.session] - 会话标识
 * @param {number} [updateData.session_expire_time] - Session过期时间戳
 * @param {string} [updateData.account_id] - newapi平台账号ID
 * @param {Array<{id?: number, key?: string, unlimited_quota?: boolean, used_quota?: number, remain_quota?: number, is_deleted?: boolean, supplement_quota?: number}>} [updateData.tokens] - newapi账号的所有令牌信息。每个令牌包含：id(令牌ID，无id表示新令牌)、key(访问密钥)、unlimited_quota(是否无限额度)、used_quota(已使用额度)、remain_quota(剩余额度)、is_deleted(标记删除)、supplement_quota(补充额度数量)
 * @param {number} [updateData.checkin_date] - 签到时间戳
 * @param {number} [updateData.balance] - 账号余额
 * @param {number} [updateData.used] - 账号已使用的额度
 * @param {boolean} [updateData.is_sold] - 是否已售出
 * @param {number} [updateData.sell_date] - 出售时间戳
 * @param {boolean} [updateData.can_sell] - 是否可出售
 * @param {boolean} [updateData.is_banned] - 是否被封禁，被封禁的账号将无法使用
 * @param {string} [updateData.workflow_url] - 签到工作流地址，owner@repo格式（如：laixingyu123@ay1）
 * @param {string} [updateData.notes] - 备注信息
 * @param {string} [updateData.cache_key] - 用户持久化时的辅助key
 * @param {number} [updateData.checkin_error_count] - 连续签到失败的次数统计
 * @param {number} [updateData.checkin_mode] - 签到模式（废弃，固定1）
 * @param {number} [updateData.event_flag] - 事件标记，0表示无事件或已完成，具体值由业务场景指定
 * @param {Object} [updateData.event_backup] - 事件备份数据，用于回滚或记录变更历史。**注意**：此字段会与现有数据合并，而非覆盖。新字段会被添加，同名字段会被新值覆盖，旧的其他字段会保留
 * @returns {Promise<{success: boolean, data?: {updated: number, updatedFields: string[]}, error?: string}>}
 */
export async function updateAccountInfo(_id, updateData) {
	// 验证必需字段
	if (!_id) {
		return {
			success: false,
			error: '账号ID不能为空',
		};
	}

	if (!updateData || Object.keys(updateData).length === 0) {
		return {
			success: false,
			error: '更新数据不能为空',
		};
	}

	// 移除不允许更新的字段
	const filteredData = { ...updateData };
	delete filteredData.create_date;
	delete filteredData._id;
	// 注意：account_type 字段现在允许更新，以支持账号类型转换（如从 LinuxDo 登录转为账号密码登录）

	return handleApiResponse(
		apiClient.post('/lyanyrouter/updateAccountInfo', {
			_id,
			updateData: filteredData,
		})
	);
}

/**
 * 获取账号登录信息
 * @param {Object} params - 查询参数
 * @param {string} params.login_info_id - 登录信息记录ID
 * @param {string} params.account_id - 账号记录ID（关联anyrouter-accounts表的_id）
 * @returns {Promise<{success: boolean, data?: {_id: string, account_id: string, github_device_code: string, linuxdo_login_url: string, create_date: number}|null, error?: string}>}
 */
export async function getAccountLoginInfo(params) {
	const { login_info_id, account_id } = params;

	// 验证必需字段
	if (!login_info_id || !account_id) {
		return {
			success: false,
			error: '登录信息ID和账号ID不能为空',
		};
	}

	return handleApiResponse(
		apiClient.post('/lyanyrouter/getAccountLoginInfo', {
			login_info_id,
			account_id,
		})
	);
}

/**
 * 添加账号登录信息
 * @param {Object} params - 请求参数
 * @param {string} params.account_id - 账号记录ID（关联anyrouter-accounts表的_id）
 * @returns {Promise<{success: boolean, data?: {login_info_id: string, expire_time: number}, error?: string}>}
 */
export async function addAccountLoginInfo(params) {
	const { account_id } = params;

	// 验证必需字段
	if (!account_id) {
		return {
			success: false,
			error: '账号ID不能为空',
		};
	}

	return handleApiResponse(
		apiClient.post('/lyanyrouter/addAccountLoginInfo', {
			account_id,
		})
	);
}

/**
 * 获取存在Session的LinuxDo账号列表
 * @description 查询符合以下所有条件的 LinuxDo 账号：
 * 1. LinuxDo 类型账号 (account_type = 1)
 * 2. 存在 session 且不为空
 * @returns {Promise<{success: boolean, data?: Array<{
 *   _id: string,
 *   username: string,
 *   password: string,
 *   account_type: 1,
 *   session: string,
 *   session_expire_time: number|null,
 *   account_id: string,
 *   cache_key: string,
 *   workflow_url: string
 * }>, error?: string}>}
 */
export async function getLinuxDoAccountsWithSession() {
	return handleApiResponse(apiClient.post('/lyanyrouter/getLinuxDoAccountsWithSession', {}));
}

/**
 * 自增AnyRouter账号余额
 * @description 对指定账号的AnyRouter余额进行自增或扣减操作
 * - 支持正数增加余额，负数扣减余额
 * - 扣减时会自动检查余额是否足够
 * - 使用数据库原子操作，保证并发安全
 * - 返回操作前后的余额变化详情
 * @param {Object} params - 请求参数
 * @param {string} params._id - 账号记录ID
 * @param {number} params.amount - 自增额度（必须为整数）。正数：增加余额；负数：扣减余额（会检查余额是否足够）
 * @returns {Promise<{success: boolean, data?: {_id: string, old_balance: number, amount: number, new_balance: number}, error?: string}>}
 * @example
 * // 增加余额
 * const result = await incrementBalance({ _id: '507f1f77bcf86cd799439011', amount: 100 });
 * if (result.success) {
 *   console.log(`余额从 ${result.data.old_balance} 增加到 ${result.data.new_balance}`);
 * }
 *
 * @example
 * // 扣减余额
 * const result = await incrementBalance({ _id: '507f1f77bcf86cd799439011', amount: -50 });
 * if (result.success) {
 *   console.log(`余额从 ${result.data.old_balance} 扣减到 ${result.data.new_balance}`);
 * } else {
 *   console.error('扣减失败:', result.error); // 可能是余额不足
 * }
 */
export async function incrementBalance({ _id, amount }) {
	// 验证必需字段
	if (!_id) {
		return {
			success: false,
			error: '账号ID不能为空',
		};
	}

	if (amount === undefined || amount === null) {
		return {
			success: false,
			error: '变动额度不能为空',
		};
	}

	// 验证amount必须为整数
	if (!Number.isInteger(amount)) {
		return {
			success: false,
			error: '变动额度必须为整数',
		};
	}

	return handleApiResponse(
		apiClient.post('/lyanyrouter/incrementBalance', {
			_id,
			amount,
		})
	);
}

/**
 * 获取可签到的账号列表
 * @description 查询符合以下所有条件的账号，用于批量更新Session：
 * 1. **账号条件**：
 *    - 未售出（is_sold !== true）
 *    - session 不存在或已过期（session_expire_time < 当前时间 或 session_expire_time 不存在）
 * 2. **用户条件**（关联 anyrouter-users 表）：
 *    - 用户已激活（is_active = true）
 *    - 会员未过期（member_expire_time > 当前时间）
 * 3. **签到状态**：
 *    - 今天（北京时间）未签到
 * @param {Object} [params] - 查询参数
 * @param {number} [params.limit] - 返回记录数量限制（可选，不传则返回所有符合条件的记录）
 * @returns {Promise<{success: boolean, data?: {
 *   total: number,
 *   accounts: Array<{
 *     _id: string,
 *     username: string,
 *     password: string,
 *     account_type: 0|1|2,
 *     workflow_url: string,
 *     checkin_date: number|null,
 *     cache_key: string,
 *     anyrouter_user_id: string,
 *     notice_email: string,
 *     user_username: string,
 *     member_expire_time: number,
 *     checkin_mode: 1|2|3,
 *     session: string|null,
 *     account_id: string,
 *     session_expire_time: number|null,
 *     tokens: Array<{id: number, key: string, unlimited_quota?: boolean, used_quota?: number, remain_quota?: number}>
 *   }>,
 *   query_time: number,
 *   beijing_date: string
 * }, error?: string}>}
 * @example
 * // 获取所有可签到账号
 * const result = await getCheckinableAccounts();
 * if (result.success) {
 *   console.log(`找到 ${result.data.total} 个可签到账号`);
 *   console.log(`查询日期: ${result.data.beijing_date}`);
 *   result.data.accounts.forEach(account => {
 *     console.log(`账号: ${account.username}, 类型: ${account.account_type}`);
 *   });
 * }
 *
 * @example
 * // 限制返回数量
 * const result = await getCheckinableAccounts({ limit: 10 });
 * if (result.success) {
 *   console.log(`返回 ${result.data.accounts.length} / ${result.data.total} 个账号`);
 * }
 */
export async function getCheckinableAccounts(params = {}) {
	const { limit } = params;

	// 验证limit必须为正整数
	if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
		return {
			success: false,
			error: '返回数量限制必须为正整数',
		};
	}

	return handleApiResponse(
		apiClient.post('/lyanyrouter/getCheckinableAccounts', {
			...(limit && { limit }),
		})
	);
}

/**
 * 更新账密修改申请记录信息
 * @description 更新账密修改申请记录的状态、用户名、错误信息等
 *
 * **核心逻辑**：
 * - 当状态设置为错误(3)且 increment_error_count 为 true 且提供了错误原因时，错误次数会自动递增
 * - 当状态设置为已完成(2)时，会自动记录完成时间
 * - 每次更新都会自动更新 update_date 时间戳
 * - 新用户名由调用方处理业务逻辑后传入
 *
 * @param {Object} params - 请求参数
 * @param {string} params.record_id - 申请记录ID（必需）
 * @param {string} [params.new_username] - 新用户名（可选，由调用方处理业务逻辑后传入）
 * @param {number} [params.status] - 申请状态（可选）：0-未开始，1-进行中，2-已完成（会自动记录 complete_date），3-错误
 * @param {string} [params.error_reason] - 错误原因（可选，当 status=3 且 increment_error_count=true 时会自动递增错误次数）
 * @param {boolean} [params.increment_error_count] - 是否增加错误次数（可选，默认false。仅在 status=3 且有 error_reason 时生效）
 * @param {Object} [params.account_info] - 账号信息（可选，从AnyRouter获取的完整账号信息对象）
 * @returns {Promise<{success: boolean, data?: {errCode: number, errMsg: string}, error?: string}>}
 * @example
 * // 示例1：更新为错误状态（增加错误次数）
 * const result = await updatePasswordChange({
 *   record_id: '65a1b2c3d4e5f6789012345',
 *   status: 3,
 *   error_reason: '密码修改失败：账号已被锁定',
 *   increment_error_count: true
 * });
 *
 * @example
 * // 示例2：更新为错误状态（不增加错误次数）
 * const result = await updatePasswordChange({
 *   record_id: '65a1b2c3d4e5f6789012345',
 *   status: 3,
 *   error_reason: '浏览器初始化失败'
 * });
 *
 * @example
 * // 示例3：更新为已完成状态
 * const result = await updatePasswordChange({
 *   record_id: '65a1b2c3d4e5f6789012345',
 *   status: 2,
 *   new_username: 'new_account_name',
 *   account_info: {
 *     username: 'new_account_name',
 *     password: 'encrypted_password'
 *   }
 * });
 */
export async function updatePasswordChange(params) {
	const { record_id, new_username, status, error_reason, increment_error_count, account_info } =
		params;

	// 验证必需字段
	if (!record_id) {
		return {
			success: false,
			error: '申请记录ID不能为空',
		};
	}

	// 验证状态值（如果提供）
	if (status !== undefined && ![0, 1, 2, 3].includes(status)) {
		return {
			success: false,
			error: '申请状态必须为0（未开始）、1（进行中）、2（已完成）或3（错误）',
		};
	}

	// 验证错误原因长度（如果提供）
	if (error_reason && error_reason.length > 500) {
		return {
			success: false,
			error: '错误原因不能超过500个字符',
		};
	}

	// 构建请求数据
	const requestData = { record_id };

	if (new_username !== undefined) {
		requestData.new_username = new_username;
	}

	if (status !== undefined) {
		requestData.status = status;
	}

	if (error_reason !== undefined) {
		requestData.error_reason = error_reason;
	}

	if (increment_error_count !== undefined) {
		requestData.increment_error_count = increment_error_count;
	}

	if (account_info !== undefined) {
		requestData.account_info = account_info;
	}

	console.log('[API调试] updatePasswordChange 最终请求数据:', JSON.stringify(requestData, null, 2));
	console.log(
		'[API调试] increment_error_count 值:',
		increment_error_count,
		'类型:',
		typeof increment_error_count
	);

	return handleApiResponse(apiClient.post('/lyanyrouter/updatePasswordChange', requestData));
}

/**
 * 获取用户的账号列表
 * @description 获取指定用户的所有账号列表，支持排序、用户名模糊搜索、事件标记筛选和分页限制
 *
 * **功能特性**：
 * 1. 支持按出售时间或余额排序
 * 2. 支持用户名模糊搜索（大小写不敏感）
 * 3. 对于官方用户（official_user_001），自动过滤已售出的账号
 * 4. 支持通过 scope='all_user' 获取所有用户的账号
 * 5. 支持通过 event_flag 筛选不等于指定值的记录
 * 6. 支持通过 pages 参数限制返回的数据量
 * 7. 支持通过 account_type 筛选指定登录类型的账号
 * 8. 支持通过 platform_type 筛选指定平台类型的账号
 *
 * @param {Object} params - 查询参数
 * @param {string} [params.user_id] - AnyRouter用户ID（关联anyrouter-users表的_id）。当 scope='all_user' 时可不传，当 scope 不为 'all_user' 且 user_id 为空时返回400错误
 * @param {string} [params.scope] - 查询范围（可选）：
 *   - 不传或其他值：按 user_id 筛选指定用户的账号
 *   - 'all_user'：获取所有用户的账号（此时 user_id 可不传）
 * @param {string} [params.sort_field] - 排序字段（可选）：
 *   - sell_date: 按出售时间/获得时间排序
 *   - balance: 按AnyRouter余额排序
 *   - 不传或传入无效值时，默认按创建时间降序排序
 * @param {string} [params.sort_order='desc'] - 排序方向（可选）：
 *   - asc: 升序
 *   - desc: 降序（默认）
 * @param {string} [params.username_keyword] - 用户名模糊搜索关键词（可选）
 *   - 大小写不敏感
 *   - 自动去除前后空格
 *   - 不传或为空时不进行搜索过滤
 * @param {number} [params.event_flag] - 事件标记筛选（可选）
 *   - 传入时筛选 event_flag **不等于**该值的记录
 *   - 不传则不进行事件标记筛选
 *   - 例如：传入 event_flag=1，则返回 event_flag != 1 的所有记录
 * @param {number} [params.account_type] - 登录类型筛选（可选）
 *   - 0: 账号密码登录
 *   - 1: LinuxDo登录
 *   - 2: GitHub登录
 *   - 3: 微信登录
 *   - 不传则不进行登录类型筛选
 * @param {string} [params.platform_type] - 平台类型筛选（可选）
 *   - anyrouter: AnyRouter平台
 *   - agentrouter: AgentRouter平台
 *   - coderouter: CodeRouter平台
 *   - 不传则不进行平台类型筛选
 * @param {number} [params.pages] - 获取页数（可选）
 *   - 每页固定100条记录
 *   - 传入 pages=2 则最多返回200条
 *   - 不传则获取所有符合条件的数据
 * @returns {Promise<{success: boolean, data?: Array<{
 *   _id: string,
 *   username: string,
 *   password: string,
 *   account_type: 0|1|2|3,
 *   platform_type: string,
 *   checkin_date: number|null,
 *   balance: number,
 *   tokens: Array<{id: number, key: string, unlimited_quota?: boolean, used_quota?: number, remain_quota?: number}>,
 *   checkin_mode: number,
 *   sell_date: number|null,
 * 	 notes: string,
 * 	 create_date: number
 * }>, error?: string}>}
 * @example
 * // 获取用户所有账号
 * const result = await getAccountList({ user_id: 'user_001' });
 * if (result.success) {
 *   console.log(`找到 ${result.data.length} 个账号`);
 * }
 *
 * @example
 * // 获取所有用户的账号
 * const result = await getAccountList({ scope: 'all_user' });
 * if (result.success) {
 *   console.log(`找到 ${result.data.length} 个账号`);
 * }
 *
 * @example
 * // 按余额降序排序
 * const result = await getAccountList({
 *   user_id: 'user_001',
 *   sort_field: 'balance',
 *   sort_order: 'desc'
 * });
 *
 * @example
 * // 搜索包含"test"的账号，且 event_flag != 1
 * const result = await getAccountList({
 *   user_id: 'user_001',
 *   username_keyword: 'test',
 *   event_flag: 1
 * });
 *
 * @example
 * // 筛选 LinuxDo 登录类型的账号
 * const result = await getAccountList({
 *   user_id: 'user_001',
 *   account_type: 1
 * });
 *
 * @example
 * // 筛选 AnyRouter 平台的账号
 * const result = await getAccountList({
 *   user_id: 'user_001',
 *   platform_type: 'anyrouter'
 * });
 *
 * @example
 * // 限制返回200条数据（2页）
 * const result = await getAccountList({
 *   user_id: 'user_001',
 *   pages: 2
 * });
 */
export async function getAccountList(params) {
	const {
		user_id,
		scope,
		sort_field,
		sort_order,
		username_keyword,
		event_flag,
		account_type,
		platform_type,
		pages,
	} = params;

	// 验证必需字段：当 scope 不为 'all_user' 时，user_id 必填
	if (scope !== 'all_user' && !user_id) {
		return {
			success: false,
			error: '用户ID不能为空（除非 scope 为 all_user）',
		};
	}

	// 验证 scope 值（如果提供）
	if (scope !== undefined && scope !== 'all_user') {
		return {
			success: false,
			error: 'scope 值只能为 all_user',
		};
	}

	// 验证排序字段（如果提供）
	if (sort_field !== undefined && !['sell_date', 'balance'].includes(sort_field)) {
		return {
			success: false,
			error: '排序字段必须为 sell_date 或 balance',
		};
	}

	// 验证排序方向（如果提供）
	if (sort_order !== undefined && !['asc', 'desc'].includes(sort_order)) {
		return {
			success: false,
			error: '排序方向必须为 asc 或 desc',
		};
	}

	// 验证 event_flag 必须为整数（如果提供）
	if (event_flag !== undefined && !Number.isInteger(event_flag)) {
		return {
			success: false,
			error: 'event_flag 必须为整数',
		};
	}

	// 验证 account_type 必须为有效值（如果提供）
	if (account_type !== undefined && ![0, 1, 2, 3].includes(account_type)) {
		return {
			success: false,
			error: 'account_type 必须为 0、1、2 或 3',
		};
	}

	// 验证 platform_type 必须为有效值（如果提供）
	if (
		platform_type !== undefined &&
		!['anyrouter', 'agentrouter', 'coderouter'].includes(platform_type)
	) {
		return {
			success: false,
			error: 'platform_type 必须为 anyrouter、agentrouter 或 coderouter',
		};
	}

	// 验证 pages 必须为正整数（如果提供）
	if (pages !== undefined && (!Number.isInteger(pages) || pages < 1)) {
		return {
			success: false,
			error: 'pages 必须为正整数',
		};
	}

	// 构建请求数据
	const requestData = {};

	if (user_id !== undefined) {
		requestData.user_id = user_id;
	}

	if (scope !== undefined) {
		requestData.scope = scope;
	}

	if (sort_field !== undefined) {
		requestData.sort_field = sort_field;
	}

	if (sort_order !== undefined) {
		requestData.sort_order = sort_order;
	}

	if (username_keyword !== undefined && username_keyword.trim() !== '') {
		requestData.username_keyword = username_keyword.trim();
	}

	if (event_flag !== undefined) {
		requestData.event_flag = event_flag;
	}

	if (account_type !== undefined) {
		requestData.account_type = account_type;
	}

	if (platform_type !== undefined) {
		requestData.platform_type = platform_type;
	}

	if (pages !== undefined) {
		requestData.pages = pages;
	}

	return handleApiResponse(apiClient.post('/lyanyrouter/getAccountList', requestData));
}

/**
 * 删除AnyRouter账号
 * @description 删除指定的AnyRouter账号
 *
 * **功能特性**：
 * 1. 验证账号是否存在
 * 2. 验证用户是否有权限删除该账号（账号必须属于该用户）
 * 3. 删除成功后自动更新用户的账号数量（total_accounts - 1）
 * 4. 记录操作日志到 anyrouter-operation-logs 表
 *
 * @param {Object} params - 请求参数
 * @param {string} params.account_id - 要删除的账号记录ID（anyrouter-accounts表的_id）
 * @param {string} params.user_id - AnyRouter用户ID（用于验证权限，必须是账号的所有者）
 * @returns {Promise<{success: boolean, data?: {errCode: number, errMsg: string}, error?: string}>}
 * @example
 * // 删除指定账号
 * const result = await deleteAccount({
 *   account_id: '507f1f77bcf86cd799439011',
 *   user_id: 'official_user_001'
 * });
 * if (result.success) {
 *   console.log('账号删除成功');
 * } else {
 *   console.error('删除失败:', result.error);
 * }
 */
export async function deleteAccount(params) {
	const { account_id, user_id } = params;

	// 验证必需字段
	if (!account_id) {
		return {
			success: false,
			error: '账号ID不能为空',
		};
	}

	if (!user_id) {
		return {
			success: false,
			error: '用户ID不能为空',
		};
	}

	return handleApiResponse(
		apiClient.post('/lyanyrouter/deleteAccount', {
			account_id,
			user_id,
		})
	);
}

export default {
	addOfficialAccount,
	addAccount,
	updateAccountInfo,
	getAccountLoginInfo,
	addAccountLoginInfo,
	getLinuxDoAccountsWithSession,
	incrementBalance,
	getCheckinableAccounts,
	updatePasswordChange,
	getAccountList,
	deleteAccount,
};
