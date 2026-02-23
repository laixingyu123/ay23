/**
 * AnyRouter 统一签到模块
 * 支持多种登录方式：账号密码、LinuxDo、GitHub
 */

import AnyRouterSignIn from './checkin-username.js';
import AnyRouterLinuxDoSignIn from './checkin-linuxdo.js';
import AnyRouterGitHubSignIn from './checkin-github.js';
import AnyRouterSessionSignIn from './checkin-session.js';
import {
	updateAccountInfo as updateAccountInfoAPI,
	getLinuxDoAccountsWithSession,
	getCheckinableAccounts,
	getAccountList,
} from '../api/index.js';
import { fileURLToPath } from 'url';

/** 平台配置映射表，key 对应 platform_type 字段值 */
const PLATFORM_CONFIG = {
	anyrouter: { url: 'https://anyrouter.top', name: 'AnyRouter' },
	agentrouter: { url: 'https://agentrouter.org', name: 'AgentRouter' },
	coderouter: { url: 'https://coderouter.top', name: 'CodeRouter' }, // TODO: 请确认 CodeRouter 的实际域名
};

class UnifiedAnyRouterChecker {
	/**
	 * @param {Array} accounts - 可选的账号数组，如果不提供则从环境变量读取
	 */
	constructor(accounts = null) {
		this.accounts = accounts || this.loadAccounts();
		this.signInModule = new AnyRouterSignIn();
		this.githubSignInModule = new AnyRouterGitHubSignIn();
		this.sessionSignInModule = new AnyRouterSessionSignIn();
		// LinuxDo 签到模块在需要时动态创建，因为需要传入不同的平台 URL
	}

	/**
	 * 从环境变量加载账号配置
	 */
	loadAccounts() {
		const accountsStr = process.env.ANYROUTER_ACCOUNTS;
		if (!accountsStr) {
			console.error('[错误] ANYROUTER_ACCOUNTS 环境变量未找到');
			return null;
		}

		try {
			const accountsData = JSON.parse(accountsStr);

			// 检查是否为数组格式
			if (!Array.isArray(accountsData)) {
				console.error('[错误] 账号配置必须使用数组格式 [{}]');
				return null;
			}

			return accountsData;
		} catch (error) {
			console.error(`[错误] 账号配置格式不正确: ${error.message}`);
			return null;
		}
	}

	/**
	 * 更新账户信息到服务端
	 * @param {string} _id - 账号ID
	 * @param {Object} updateData - 要更新的字段
	 */
	async updateAccountInfo(_id, updateData) {
		try {
			if (!_id) {
				console.log('[更新] 账号无 _id，跳过更新');
				return { success: false, message: '账号无 _id' };
			}

			// 检查是否配置了 API_BASE_URL
			if (!process.env.API_BASE_URL) {
				console.log('[更新] 未配置 API_BASE_URL，跳过服务端更新');
				return { success: false, message: '未配置 API_BASE_URL' };
			}

			console.log(`[更新] 上传账户信息到服务端: ${_id}`);

			// 调用服务端 API
			const apiResult = await updateAccountInfoAPI(_id, updateData);

			if (apiResult.success) {
				console.log('[更新] 服务端更新成功');
				return { success: true, message: '账户信息更新成功' };
			} else {
				console.error(`[更新] 服务端更新失败: ${apiResult.error}`);
				return { success: false, message: apiResult.error };
			}
		} catch (error) {
			console.error(`[错误] 更新账户信息失败: ${error.message}`);
			return { success: false, message: error.message };
		}
	}

	/**
	 * 使用用户名密码进行登录签到
	 */
	async checkInWithPassword(accountInfo) {
		const accountName = accountInfo.username || accountInfo._id || '未知账号';

		console.log(`[登录] ${accountName}: 使用用户名密码登录签到`);

		// 调用登录模块，传递账号信息用于令牌管理
		const loginResult = await this.signInModule.loginAndGetSession(
			accountInfo.username,
			accountInfo.password,
			accountInfo
		);

		if (loginResult) {
			// 只更新签到时间和余额信息
			const updateData = {
				checkin_date: Date.now(),
			};
			// 构建用户信息字符串
			let userInfoText = null;

			// 更新 session 和 account_id
			if (loginResult.session) {
				updateData.session = loginResult.session;
				// session 有效期设置为 30 天
				updateData.session_expire_time = Date.now() + 30 * 24 * 60 * 60 * 1000;
			}
			if (loginResult.apiUser) {
				updateData.account_id = loginResult.apiUser;
			}

			// 如果成功获取用户信息，添加余额、已使用额度和推广码
			if (loginResult.userInfo) {
				updateData.balance = Math.round(loginResult.userInfo.quota / 500000);
				updateData.used = Math.round((loginResult.userInfo.used_quota || 0) / 500000);
				if (loginResult.userInfo.aff_code) {
					updateData.aff_code = loginResult.userInfo.aff_code;
				}
				// 添加令牌信息
				if (loginResult.userInfo.tokens) {
					updateData.tokens = loginResult.userInfo.tokens;
				}

				const quota = (loginResult.userInfo.quota / 500000).toFixed(2);
				const usedQuota = (loginResult.userInfo.used_quota || 0) / 500000;
				userInfoText = `💰 当前余额: $${quota}, 已使用: $${usedQuota.toFixed(2)}`;
			}

			// 更新账户信息
			await this.updateAccountInfo(accountInfo._id, updateData);

			return {
				success: true,
				account: accountName,
				userInfo: userInfoText,
				method: 'password',
			};
		} else {
			return {
				success: false,
				account: accountName,
				error: '登录失败',
				method: 'password',
			};
		}
	}

	/**
	 * 使用 LinuxDo 第三方登录进行签到
	 */
	async checkInWithLinuxDo(accountInfo) {
		const accountName = accountInfo.username || accountInfo._id || '未知账号';
		const platformType = accountInfo.platform_type || 'anyrouter';
		const currentErrorCount = accountInfo.checkin_error_count || 0;
		const platform = PLATFORM_CONFIG[platformType];

		if (!platform) {
			return {
				success: false,
				account: accountName,
				error: `未知的平台类型: ${platformType}`,
				method: 'linuxdo',
			};
		}

		console.log(`[登录] ${accountName}: 使用 LinuxDo 第三方登录签到 (平台: ${platform.name})`);

		// 如果错误次数 > 2，删除持久化缓存并重置错误次数
		if (currentErrorCount > 2) {
			try {
				console.log(
					`[清理] ${accountName}: 检测到错误次数 > 2 (${currentErrorCount})，清除持久化缓存...`
				);

				// 创建临时实例用于清除缓存（baseUrl 不重要，只用于调用 clearUserCache）
				const tempModule = new AnyRouterLinuxDoSignIn('https://anyrouter.top');
				tempModule.clearUserCache(accountInfo.username, accountInfo.cache_key || '');

				// 重置错误次数
				await this.updateAccountInfo(accountInfo._id, {
					checkin_error_count: 0,
				});

				console.log(`[清理] ${accountName}: 已清除缓存并重置错误次数，将重新尝试登录`);
			} catch (e) {
				console.log(`[清理错误] ${accountName}: 清除缓存并重置错误次数错误`);
			}
		}

		const updateData = {};

		console.log(`[签到] ${accountName}: 开始签到 ${platform.name}...`);

		// 为目标平台创建独立的 LinuxDo 签到实例
		const linuxDoSignInModule = new AnyRouterLinuxDoSignIn(platform.url);

		// 调用 LinuxDo 登录模块
		const loginResult = await linuxDoSignInModule.loginAndGetSession(
			accountInfo.username,
			accountInfo.password,
			accountInfo.cache_key
		);

		if (loginResult && loginResult.userInfo) {
			if (loginResult.session) {
				updateData.session = loginResult.session;
				// session 有效期设置为 30 天
				updateData.session_expire_time = Date.now() + 30 * 24 * 60 * 60 * 1000;
			}
			if (loginResult.apiUser) {
				updateData.account_id = loginResult.apiUser;
			}

			// 账号与平台一一对应，统一使用 balance/used 字段
			updateData.balance = Math.round(loginResult.userInfo.quota / 500000);
			updateData.used = Math.round((loginResult.userInfo.used_quota || 0) / 500000);
			if (loginResult.userInfo.aff_code) {
				updateData.aff_code = loginResult.userInfo.aff_code;
			}

			updateData.checkin_date = Date.now();
			updateData.checkin_error_count = 0;

			await this.updateAccountInfo(accountInfo._id, updateData);

			const quota = (loginResult.userInfo.quota / 500000).toFixed(2);
			const usedQuota = (loginResult.userInfo.used_quota || 0) / 500000;
			const userInfoText = `💰 当前余额: $${quota}, 已使用: $${usedQuota.toFixed(2)}`;

			console.log(`[成功] ${accountName}: ${platform.name} 签到成功 - ${userInfoText}`);

			return {
				success: true,
				account: accountName,
				userInfo: userInfoText,
				method: 'linuxdo',
			};
		} else {
			console.error(`[失败] ${accountName}: ${platform.name} 签到失败`);

			updateData.checkin_error_count = currentErrorCount + 1;
			await this.updateAccountInfo(accountInfo._id, updateData);

			return {
				success: false,
				account: accountName,
				error: `${platform.name} 登录失败`,
				method: 'linuxdo',
			};
		}
	}

	/**
	 * 使用 GitHub 第三方登录进行签到
	 */
	async checkInWithGitHub(accountInfo) {
		const accountName = accountInfo.username || accountInfo._id || '未知账号';
		const platformType = accountInfo.platform_type || 'anyrouter';
		const currentErrorCount = accountInfo.checkin_error_count || 0;
		const platform = PLATFORM_CONFIG[platformType];

		if (!platform) {
			return {
				success: false,
				account: accountName,
				error: `未知的平台类型: ${platformType}`,
				method: 'github',
			};
		}

		console.log(`[登录] ${accountName}: 使用 GitHub 第三方登录签到 (平台: ${platform.name})`);

		// 如果错误次数 > 2，删除持久化缓存并重置错误次数
		if (currentErrorCount > 2) {
			try {
				console.log(
					`[清理] ${accountName}: 检测到错误次数 > 2 (${currentErrorCount})，清除持久化缓存...`
				);

				// 创建临时实例用于清除缓存（baseUrl 不重要，只用于调用 getUserDataDir）
				const tempModule = new AnyRouterGitHubSignIn('https://anyrouter.top');
				const userDataDir = tempModule.getUserDataDir(accountInfo.username);

				// 删除整个用户数据目录
				const fs = await import('fs');
				if (fs.existsSync(userDataDir)) {
					fs.rmSync(userDataDir, { recursive: true, force: true });
					console.log(`[清理] 已删除持久化缓存: ${userDataDir}`);
				}

				// 重置错误次数
				await this.updateAccountInfo(accountInfo._id, {
					checkin_error_count: 0,
				});

				console.log(`[清理] ${accountName}: 已清除缓存并重置错误次数，将重新尝试登录`);
			} catch (e) {
				console.log(`[清理错误] ${accountName}: 清除缓存并重置错误次数错误`);
			}
		}

		const updateData = {};

		console.log(`[签到] ${accountName}: 开始签到 ${platform.name}...`);

		// 为目标平台创建独立的 GitHub 签到实例
		const githubSignInModule = new AnyRouterGitHubSignIn(platform.url);

		// 调用 GitHub 登录模块，传递 TOTP 2FA 密钥
		const loginResult = await githubSignInModule.loginAndGetSession(
			accountInfo._id,
			accountInfo.username,
			accountInfo.password,
			accountInfo.notice_email,
			accountInfo.twofa_secret
		);

		if (loginResult && loginResult.userInfo) {
			if (loginResult.session) {
				updateData.session = loginResult.session;
				// session 有效期设置为 30 天
				updateData.session_expire_time = Date.now() + 30 * 24 * 60 * 60 * 1000;
			}
			if (loginResult.apiUser) {
				updateData.account_id = loginResult.apiUser;
			}

			// 账号与平台一一对应，统一使用 balance/used 字段
			updateData.balance = Math.round(loginResult.userInfo.quota / 500000);
			updateData.used = Math.round((loginResult.userInfo.used_quota || 0) / 500000);
			if (loginResult.userInfo.aff_code) {
				updateData.aff_code = loginResult.userInfo.aff_code;
			}

			updateData.checkin_date = Date.now();
			updateData.checkin_error_count = 0;

			await this.updateAccountInfo(accountInfo._id, updateData);

			const quota = (loginResult.userInfo.quota / 500000).toFixed(2);
			const usedQuota = (loginResult.userInfo.used_quota || 0) / 500000;
			const userInfoText = `💰 当前余额: $${quota}, 已使用: $${usedQuota.toFixed(2)}`;

			console.log(`[成功] ${accountName}: ${platform.name} 签到成功 - ${userInfoText}`);

			return {
				success: true,
				account: accountName,
				userInfo: userInfoText,
				method: 'github',
			};
		} else {
			console.error(`[失败] ${accountName}: ${platform.name} 签到失败`);

			updateData.checkin_error_count = currentErrorCount + 1;
			await this.updateAccountInfo(accountInfo._id, updateData);

			return {
				success: false,
				account: accountName,
				error: `${platform.name} 登录失败`,
				method: 'github',
			};
		}
	}

	/**
	 * 使用 Session 进行签到（优先级最高）
	 */
	async checkInWithSession(accountInfo) {
		const accountName = accountInfo.username || accountInfo._id || '未知账号';
		const session = accountInfo.session;
		const apiUser = accountInfo.account_id || accountInfo.api_user;

		console.log(`[登录] ${accountName}: 使用 Session 签到 (API User: ${apiUser})`);

		// 调用 Session 签到模块，传递账号信息用于令牌管理
		const signInResult = await this.sessionSignInModule.signIn(session, apiUser, accountInfo);

		if (signInResult && signInResult.success) {
			// 构建更新数据
			const updateData = {
				checkin_date: Date.now(),
			};

			let userInfoText = null;

			// 如果成功获取用户信息，添加余额、已使用额度和推广码
			if (signInResult.userInfo) {
				// 检查账号是否被封禁（status=2 表示封禁）
				if (signInResult.userInfo.status === 2) {
					updateData.is_banned = true;
					console.log(`[警告] ${accountName}: 账号已被封禁，更新封禁状态`);
				} else {
					updateData.is_banned = false;
				}

				updateData.balance = Math.round(signInResult.userInfo.quota / 500000);
				updateData.used = Math.round((signInResult.userInfo.usedQuota || 0) / 500000);
				if (signInResult.userInfo.affCode) {
					updateData.aff_code = signInResult.userInfo.affCode;
				}
				// 添加令牌信息
				if (signInResult.userInfo.tokens) {
					updateData.tokens = signInResult.userInfo.tokens;
					delete signInResult.userInfo.tokens;
				}

				updateData.userInfo = signInResult.userInfo;

				const quota = (signInResult.userInfo.quota / 500000).toFixed(2);
				const usedQuota = (signInResult.userInfo.usedQuota || 0) / 500000;
				const bannedText = signInResult.userInfo.status === 2 ? ' 🚫 检测到账号被官方封禁，不再签到' : '';
				userInfoText = `💰 当前余额: $${quota}, 已使用: $${usedQuota.toFixed(2)}${bannedText}`;
			}

			// 更新账户信息
			await this.updateAccountInfo(accountInfo._id, updateData);

			return {
				success: true,
				account: accountName,
				userInfo: userInfoText,
				method: 'session',
			};
		} else {
			console.log(`[失败] ${accountName}: Session 签到失败，将尝试其他登录方式`);
			return null; // 返回 null 表示需要尝试其他登录方式
		}
	}

	/**
	 * 为单个账号执行签到
	 */
	async checkInAccount(accountInfo, accountIndex) {
		const accountName = accountInfo.username || accountInfo._id || `账号 ${accountIndex + 1}`;
		console.log(`\n[处理中] 开始处理 ${accountName}`);

		// 优先检查是否有 session 和 api_user/account_id
		const hasSession = accountInfo.session && (accountInfo.account_id || accountInfo.api_user);

		if (hasSession) {
			console.log(`[检测] ${accountName}: 发现有效的 Session，将使用 Session 签到`);
			const sessionResult = await this.checkInWithSession(accountInfo);

			// 如果 Session 签到成功，直接返回结果
			if (sessionResult && sessionResult.success) {
				return sessionResult;
			}

			// Session 签到失败，继续尝试其他方式
			console.log(`[回退] ${accountName}: Session 签到失败，尝试其他登录方式...`);
		}

		const hasPassword = accountInfo.username && accountInfo.password;

		if (!hasPassword) {
			console.log(`[失败] ${accountName}: 缺少用户名或密码`);
			return {
				success: false,
				account: accountName,
				error: '缺少用户名或密码',
			};
		}

		// 获取登录类型（默认为账号密码登录）
		const accountType = accountInfo.account_type ?? 0;

		// 根据登录类型选择对应的登录方法
		switch (accountType) {
		case 0:
			// 账号密码登录
			console.log(`[类型] ${accountName}: 账号密码登录`);
			return await this.checkInWithPassword(accountInfo);

		case 1:
			// LinuxDo 第三方登录
			console.log(`[类型] ${accountName}: LinuxDo 第三方登录`);
			return await this.checkInWithLinuxDo(accountInfo);

		case 2:
			// GitHub 第三方登录
			console.log(`[类型] ${accountName}: GitHub 第三方登录`);
			return await this.checkInWithGitHub(accountInfo);

		default:
			console.log(`[失败] ${accountName}: 未知的登录类型 ${accountType}`);
			return {
				success: false,
				account: accountName,
				error: `未知的登录类型: ${accountType}`,
			};
		}
	}

	/**
	 * 按邮箱分组通知结果
	 */
	groupResultsByEmail(results, accounts) {
		const emailGroups = {};

		results.forEach((result, index) => {
			const account = accounts[index];
			const email = account.notice_email || process.env.EMAIL_TO || 'default';

			if (!emailGroups[email]) {
				emailGroups[email] = {
					email: email,
					results: [],
					successCount: 0,
					totalCount: 0,
				};
			}

			emailGroups[email].results.push(result);
			emailGroups[email].totalCount++;
			if (result.success) {
				emailGroups[email].successCount++;
			}
		});

		return emailGroups;
	}

	/**
	 * 执行所有账号签到
	 */
	async run() {
		console.log('[系统] AnyRouter.top 多账号自动签到脚本启动 (统一版)');
		console.log(`[时间] 执行时间: ${new Date().toLocaleString('zh-CN')}`);

		if (!this.accounts) {
			console.log('[失败] 无法加载账号配置，程序退出');
			return { success: false, results: [] };
		}

		console.log(`[信息] 找到 ${this.accounts.length} 个账号配置`);

		const results = [];

		// 读取延迟配置
		const firstDelay = process.env.CHECKIN_FIRST_DELAY === 'true';
		const maxDelay = Math.max(5, parseInt(process.env.CHECKIN_MAX_DELAY, 10) || 10);
		const minDelay = 5;

		// 为每个账号执行签到
		for (let i = 0; i < this.accounts.length; i++) {
			try {
				// 首个账号延迟处理
				// if (i === 0 && firstDelay) {
				// 	const delay = minDelay * 1000 + Math.random() * (maxDelay - minDelay) * 1000;
				// 	console.log(`[等待] 首个账号延迟 ${(delay / 1000).toFixed(1)} 秒后执行签到...`);
				// 	await new Promise((resolve) => setTimeout(resolve, delay));
				// }

				const result = await this.checkInAccount(this.accounts[i], i);
				results.push(result);

				// 账号之间添加延迟，避免频繁操作触发限制
				if (i < this.accounts.length - 1) {
					const delay = minDelay * 1000 + Math.random() * (10 - minDelay) * 1000;
					console.log(`[等待] 等待 ${(delay / 1000).toFixed(1)} 秒后处理下一个账号...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			} catch (error) {
				console.log(`[失败] 账号 ${i + 1} 处理异常: ${error.message}`);
				results.push({
					success: false,
					account: this.accounts[i].username || `账号 ${i + 1}`,
					error: error.message,
				});
			}
		}

		// 按邮箱分组
		const emailGroups = this.groupResultsByEmail(results, this.accounts);

		// 统计结果
		const successCount = results.filter((r) => r.success).length;
		const totalCount = this.accounts.length;

		console.log('\n[统计] 签到结果统计:');
		console.log(`[成功] 成功: ${successCount}/${totalCount}`);
		console.log(`[失败] 失败: ${totalCount - successCount}/${totalCount}`);

		if (successCount === totalCount) {
			console.log('[成功] 所有账号签到成功!');
		} else if (successCount > 0) {
			console.log('[警告] 部分账号签到成功');
		} else {
			console.log('[错误] 所有账号签到失败');
		}

		return {
			success: successCount > 0,
			results: results,
			emailGroups: emailGroups,
			successCount: successCount,
			totalCount: totalCount,
		};
	}
}

export default UnifiedAnyRouterChecker;

// 如果直接运行此文件，执行签到
const isMainModule = fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
	(async () => {
		try {
			console.log('[初始化] 从服务端获取账号列表...');

			// 固定用户 ID
			// const userId = '69633ecb952272c52c5abb9a'; //mymy
			const userId = '691812572d9d4df472aadeda'; //myde
			// const userId = '68f98f2a2c5de7e57262ef43'; //Oliver
			
			// 使用 getAccountList 获取指定用户的账号列表
			const apiResult = await getAccountList({ user_id: userId });

			// 注释掉原有的 getCheckinableAccounts 方式
			// const apiResult = await getCheckinableAccounts();

			if (!apiResult.success) {
				console.error(`[错误] 获取账号列表失败: ${apiResult.error}`);
				process.exit(1);
			}

			const accounts = apiResult.data;
			console.log(`[成功] 获取到 ${accounts.length} 个账号`);

			// accounts.forEach(item=>{
			// 	item.session = ""
			// })

			if (accounts.length === 0) {
				console.log('[完成] 没有需要签到的账号，程序退出');
				process.exit(0);
			}

			// 执行签到
			const checker = new UnifiedAnyRouterChecker(accounts);
			const checkResult = await checker.run();
			console.log('\n[最终结果]', JSON.stringify(checkResult, null, 2));
		} catch (error) {
			console.error(`[错误] 执行失败: ${error.message}`);
			console.error('[堆栈]', error.stack);
			process.exit(1);
		}
	})();
}
