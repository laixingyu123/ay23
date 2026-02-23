/**
 * AnyRouter 批量改账密模块
 * 支持多账号批量修改密码，从命令行参数读取数据并上传结果到服务端
 */

import { fileURLToPath } from 'url';
import AnyRouterChangePassword from './change-password.js';
import { updatePasswordChange } from '../api/index.js';

/**
 * 随机延迟（5-10秒）
 * @returns {Promise<void>}
 */
function randomDelay() {
	const delay = Math.floor(Math.random() * 5000) + 5000;
	console.log(`[延迟] 等待 ${(delay / 1000).toFixed(1)} 秒后继续...`);
	return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * 执行单个账号的密码修改
 * @param {Object} passwordChangeData - 密码修改数据
 * @param {string} passwordChangeData.record_id - 申请记录ID
 * @param {string} passwordChangeData.old_username - 旧用户名
 * @param {string} passwordChangeData.old_password - 旧密码
 * @param {string} passwordChangeData.new_username - 新用户名
 * @param {string} passwordChangeData.new_password - 新密码
 * @param {number} [passwordChangeData.error_count=0] - 错误次数
 * @returns {Promise<{success: boolean, message: string, userInfo?: object}>}
 */
async function executeSingleChangePassword(passwordChangeData) {
	const {
		record_id,
		old_username,
		old_password,
		new_username,
		new_password,
		error_count = 0,
	} = passwordChangeData;

	console.log('\n===== 开始执行账密修改 =====');
	console.log(`[记录ID] ${record_id}`);
	console.log(`[旧用户名] ${old_username}`);
	console.log(`[新用户名] ${new_username || '(不修改)'}`);
	console.log(`[新密码] ${new_password ? '******' : '(不修改)'}`);
	console.log(`[错误次数] ${error_count}`);

	const changer = new AnyRouterChangePassword();

	try {
		// 1. 初始化浏览器
		console.log('\n[步骤1] 初始化浏览器...');
		const initResult = await changer.initialize();
		if (!initResult.success) {
			console.error('[失败] 浏览器初始化失败:', initResult.message);

			// 浏览器初始化失败不是API错误，不增加错误次数
			await updatePasswordChange({
				record_id,
				status: 3,
				error_reason: `浏览器初始化失败: ${initResult.message}`,
				increment_error_count: false,
			});

			return {
				success: false,
				message: `浏览器初始化失败: ${initResult.message}`,
			};
		}

		// 2. 执行账密修改
		console.log('\n[步骤2] 执行账密修改...');
		const changeResult = await changer.changePassword(
			old_username,
			old_password,
			new_username,
			new_password
		);

		// 3. 处理修改结果
		if (changeResult.success) {
			console.log('\n[成功] 账密修改成功！');
			console.log(`[用户信息] ${JSON.stringify(changeResult.userInfo, null, 2)}`);

			// 上传成功状态到服务端
			const uploadResult = await updatePasswordChange({
				record_id,
				status: 2,
				account_info: changeResult.userInfo,
			});

			if (uploadResult.success) {
				console.log('[成功] 结果已上传到服务端');
			} else {
				console.warn('[警告] 上传结果到服务端失败:', uploadResult.error);
			}

			return {
				success: true,
				message: '账密修改成功',
				userInfo: changeResult.userInfo,
			};
		} else {
			console.log('\n[失败] 账密修改失败');
			console.log(`[错误信息] ${changeResult.message}`);
			console.log('[调试] changeResult 对象:', JSON.stringify(changeResult, null, 2));
			console.log(`[调试] is_api_error 值: ${changeResult.is_api_error}`);

			// 根据 is_api_error 标志判断是否为 API 错误
			const isApiError = changeResult.is_api_error === true;
			console.log(`[调试] isApiError (经过转换): ${isApiError}`);

			const updateParams = {
				record_id,
				status: 3,
				error_reason: changeResult.message,
				increment_error_count: isApiError,
			};
			console.log('[调试] updatePasswordChange 参数:', JSON.stringify(updateParams, null, 2));

			await updatePasswordChange(updateParams);

			return {
				success: false,
				message: changeResult.message,
			};
		}
	} catch (error) {
		console.error('\n[异常] 执行过程中发生异常:', error.message);
		console.error(error.stack);

		// 异常不是API错误，不增加错误次数
		await updatePasswordChange({
			record_id,
			status: 3,
			error_reason: `执行异常: ${error.message}`,
			increment_error_count: false,
		});

		return {
			success: false,
			message: `执行异常: ${error.message}`,
		};
	} finally {
		// 4. 清理资源
		console.log('\n[步骤3] 清理浏览器资源...');
		await changer.cleanup();
		console.log('[完成] 资源已清理');
	}
}

/**
 * 验证单个账号数据的必需字段
 * @param {Object} data - 账号数据
 * @param {number} index - 账号索引（用于错误提示）
 * @returns {{valid: boolean, error?: string}}
 */
function validateAccountData(data, index) {
	const requiredFields = ['record_id', 'old_username', 'old_password'];
	for (const field of requiredFields) {
		if (!data[field]) {
			return { valid: false, error: `账号[${index}] 缺少必需字段: ${field}` };
		}
	}

	if (!data.new_username && !data.new_password) {
		return {
			valid: false,
			error: `账号[${index}] new_username 和 new_password 至少需要提供一个`,
		};
	}

	return { valid: true };
}

/**
 * 批量执行密码修改
 * @param {Array<Object>} accountList - 账号列表
 * @returns {Promise<{total: number, success: number, failed: number, results: Array}>}
 */
async function executeBatchChangePassword(accountList) {
	const results = [];
	let successCount = 0;
	let failedCount = 0;

	console.log('\n========== 批量改账密任务开始 ==========');
	console.log(`[总数] 共 ${accountList.length} 个账号待处理\n`);

	for (let i = 0; i < accountList.length; i++) {
		const account = accountList[i];
		console.log(`\n---------- 处理第 ${i + 1}/${accountList.length} 个账号 ----------`);

		const result = await executeSingleChangePassword(account);
		results.push({
			record_id: account.record_id,
			old_username: account.old_username,
			...result,
		});

		if (result.success) {
			successCount++;
		} else {
			failedCount++;
		}

		// 如果不是最后一个账号，添加随机延迟
		if (i < accountList.length - 1) {
			await randomDelay();
		}
	}

	console.log('\n========== 批量改账密任务完成 ==========');
	console.log(`[统计] 总数: ${accountList.length}, 成功: ${successCount}, 失败: ${failedCount}`);

	return {
		total: accountList.length,
		success: successCount,
		failed: failedCount,
		results,
	};
}

export { executeSingleChangePassword, executeBatchChangePassword };
export default executeBatchChangePassword;

// 如果直接运行此文件，从命令行参数读取数据
const isMainModule = fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
	(async () => {
		try {
			// 从命令行参数读取数据（JSON 字符串）
			const inputJson = process.argv[2];

			if (!inputJson) {
				console.error('[错误] 缺少参数');
				console.error('用法: node batch-change-password.js \'[{"record_id":"xxx",...}]\'');
				console.error(
					'参数格式: JSON 数组，每个元素包含 record_id, old_username, old_password, new_username/new_password'
				);
				process.exit(1);
			}

			const inputData = JSON.parse(inputJson);

			// 统一转换为数组格式（兼容单个对象输入）
			const accountList = Array.isArray(inputData) ? inputData : [inputData];

			if (accountList.length === 0) {
				console.error('[错误] 账号列表为空');
				process.exit(1);
			}

			console.log(`[输入] 共 ${accountList.length} 个账号待处理`);
			console.log(`账号数据: ${JSON.stringify(accountList, null, 2)}`);

			// 验证所有账号数据
			for (let i = 0; i < accountList.length; i++) {
				const validation = validateAccountData(accountList[i], i);
				if (!validation.valid) {
					console.error(`[错误] ${validation.error}`);
					process.exit(1);
				}
			}

			// 执行批量修改
			const result = await executeBatchChangePassword(accountList);

			// 输出最终结果
			console.log('\n===== 执行结果汇总 =====');
			console.log(JSON.stringify(result, null, 2));

			// 如果有失败的账号，退出码为1
			if (result.failed > 0) {
				console.log(`\n[警告] 有 ${result.failed} 个账号修改失败`);
				process.exit(1);
			} else {
				console.log('\n[成功] 所有账号修改成功');
				process.exit(0);
			}
		} catch (error) {
			console.error('\n===== 执行异常 =====');
			console.error(error.message);
			console.error(error.stack);
			process.exit(1);
		}
	})();
}
