/**
 * AnyRouter 账号密码修改模块
 * 通过 API 调用方式实现登录和修改密码
 * 支持浏览器复用，可多次执行修改操作
 */

import { chromium } from 'playwright';
import {
	applyStealthToContext,
	getStealthArgs,
	getIgnoreDefaultArgs,
} from '../utils/playwright-stealth.js';
import { fileURLToPath } from 'url';

class AnyRouterChangePassword {
	constructor() {
		this.baseUrl = 'https://anyrouter.top';

		// Playwright 实例
		this.browser = null;
		this.context = null;
		this.page = null;
	}

	/**
	 * 生成随机延迟时间（模拟真人操作）
	 */
	getRandomDelay(min = 500, max = 1500) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	/**
	 * 等待随机时间
	 */
	async randomDelay(min = 500, max = 1500) {
		const delay = this.getRandomDelay(min, max);
		await new Promise((resolve) => setTimeout(resolve, delay));
	}

	/**
	 * 1. 初始化浏览器
	 * @returns {Promise<{success: boolean, message: string}>}
	 */
	async initialize() {
		try {
			console.log('[浏览器] 启动 Chromium 浏览器（已启用反检测）...');

			// 判断是否在 CI 环境中（GitHub Actions）
			const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
			const headlessMode = isCI ? true : false;

			console.log(`[环境] ${isCI ? 'CI 环境' : '本地环境'}，headless: ${headlessMode}`);

			// 启动浏览器（非持久化模式）
			this.browser = await chromium.launch({
				headless: headlessMode,
				args: getStealthArgs(),
				ignoreDefaultArgs: getIgnoreDefaultArgs(),
			});

			// 创建浏览器上下文，忽略 HTTPS 证书错误
			this.context = await this.browser.newContext({
				ignoreHTTPSErrors: true,
				viewport: { width: 1920, height: 1080 },
				userAgent:
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				locale: 'zh-CN',
				timezoneId: 'Asia/Shanghai',
				deviceScaleFactor: 1,
				isMobile: false,
				hasTouch: false,
				permissions: ['geolocation', 'notifications'],
				colorScheme: 'light',
			});

			// 应用反检测脚本到上下文
			await applyStealthToContext(this.context);

			// 创建新页面
			this.page = await this.context.newPage();

			console.log('[成功] 浏览器初始化完成');

			return {
				success: true,
				message: '浏览器初始化成功',
			};
		} catch (error) {
			console.log(`[错误] 浏览器初始化失败: ${error.message}`);
			return {
				success: false,
				message: `浏览器初始化失败: ${error.message}`,
			};
		}
	}

	/**
	 * 清除浏览器缓存
	 */
	async clearBrowserData() {
		console.log('[步骤] 清理 Cookie 和缓存...');

		try {
			if (this.context) {
				await this.context.clearCookies();
			}

			if (this.page && !this.page.isClosed()) {
				await this.page.evaluate(() => {
					localStorage.clear();
					sessionStorage.clear();
				});
			}

			console.log('[成功] Cookie 和缓存已清理');
		} catch (error) {
			console.warn(`[警告] 清理浏览器数据失败: ${error.message}`);
		}
	}

	/**
	 * 2. 修改账号密码（可多次调用）
	 * @param {string} username - 原用户名
	 * @param {string} oldPassword - 原密码
	 * @param {string} newUsername - 新用户名（可选，不传则不修改用户名）
	 * @param {string} newPassword - 新密码（可选，不传则不修改密码）
	 * @returns {Promise<{success: boolean, message: string, userInfo: object}>}
	 */
	async changePassword(username, oldPassword, newUsername = null, newPassword = null) {
		console.log(`\n[修改账密] 开始处理账号: ${username}`);

		// 参数验证
		if (!newUsername && !newPassword) {
			console.log('[错误] 新用户名和新密码至少需要提供一个');
			return {
				success: false,
				message: '新用户名和新密码至少需要提供一个',
				userInfo: null,
				is_api_error: false,
			};
		}

		// 检查浏览器是否已初始化
		if (!this.browser || !this.context || !this.page) {
			console.log('[错误] 浏览器未初始化，请先调用 initialize() 方法');
			return {
				success: false,
				message: '浏览器未初始化',
				userInfo: null,
				is_api_error: false,
			};
		}

		try {
			// 步骤1: 导航到首页（刷新页面）
			console.log('[页面] 访问首页，等待页面稳定...');
			await this.page.goto(this.baseUrl, {
				waitUntil: 'networkidle',
				timeout: 600000,
			});

			// 等待页面完全稳定
			await this.randomDelay(2000, 3000);

			// 步骤2: 调用登录接口
			console.log('[API] 调用登录接口...');
			const loginResult = await this.page.evaluate(
				async ({ baseUrl, username, password }) => {
					try {
						const requestHeaders = {
							'Content-Type': 'application/json',
						};

						const response = await fetch(`${baseUrl}/api/user/login?turnstile=`, {
							method: 'POST',
							headers: requestHeaders,
							body: JSON.stringify({ username, password }),
							credentials: 'include',
						});

						// 获取响应文本用于调试
						const responseText = await response.text();
						console.log('[调试] 登录接口响应状态:', response.status);
						console.log('[调试] 登录接口响应头:', Object.fromEntries(response.headers.entries()));
						console.log('[调试] 登录接口响应体（前500字符）:', responseText.substring(0, 500));

						// 尝试解析 JSON
						let data;
						try {
							data = JSON.parse(responseText);
						} catch (parseError) {
							console.error('[错误] JSON 解析失败:', parseError.message);
							return {
								success: false,
								error: `JSON解析失败: ${parseError.message}`,
								responseText: responseText.substring(0, 1000),
								status: response.status,
							};
						}

						return {
							success: response.ok,
							status: response.status,
							data: data,
						};
					} catch (error) {
						console.error('[错误] 登录接口请求异常:', error.message);
						return {
							success: false,
							error: error.message,
						};
					}
				},
				{ baseUrl: this.baseUrl, username, password: oldPassword }
			);

			if (!loginResult.success) {
				console.log(`[错误] 登录接口调用失败: ${loginResult.error || loginResult.status}`);
				if (loginResult.responseText) {
					console.log(`[调试] 响应内容: ${loginResult.responseText}`);
				}
				return {
					success: false,
					message: `登录失败: ${loginResult.error || loginResult.status}`,
					userInfo: null,
					debugInfo: loginResult.responseText,
					is_api_error: false,
				};
			}

			if (!loginResult.data.success) {
				console.log(`[错误] 登录失败: ${loginResult.data.message || '未知原因'}`);
				return {
					success: false,
					message: loginResult.data.message || '登录失败',
					userInfo: null,
					is_api_error: true,
				};
			}

			const apiUser = loginResult.data.data?.id;
			if (!apiUser) {
				console.log('[错误] 登录响应中未找到用户 ID');
				return {
					success: false,
					message: '登录响应中未找到用户 ID',
					userInfo: null,
					is_api_error: false,
				};
			}

			console.log(`[成功] 登录成功，用户ID: ${apiUser}`);

			// 步骤3: 调用修改密码接口
			console.log('[API] 调用修改密码接口...');
			console.log(`[参数] 新用户名: ${newUsername || '(不修改)'}`);
			console.log(`[参数] 新密码: ${newPassword ? '******' : '(不修改)'}`);

			const changeResult = await this.page.evaluate(
				async ({ baseUrl, apiUser, oldPassword, newUsername, newPassword }) => {
					try {
						const requestHeaders = {
							'Content-Type': 'application/json',
							'New-Api-User': String(apiUser),
							referer: `${baseUrl}/console`,
						};

						// 构建请求体
						const requestBody = {};

						// 只添加需要修改的字段
						if (newPassword) {
							requestBody.password = newPassword;
							requestBody.original_password = oldPassword;
						}
						if (newUsername) {
							requestBody.username = newUsername;
						}

						console.log('[请求体]', JSON.stringify(requestBody, null, 2));

						const response = await fetch(`${baseUrl}/api/user/self`, {
							method: 'PUT',
							headers: requestHeaders,
							body: JSON.stringify(requestBody),
							credentials: 'include',
						});

						const data = await response.json();

						return {
							success: response.ok,
							data: data,
						};
					} catch (error) {
						return {
							success: false,
							error: error.message,
						};
					}
				},
				{ baseUrl: this.baseUrl, apiUser, oldPassword, newUsername, newPassword }
			);

			if (!changeResult.success) {
				console.log(`[错误] 修改密码接口调用失败: ${changeResult.error}`);
				return {
					success: false,
					message: `修改密码失败: ${changeResult.error}`,
					userInfo: null,
					is_api_error: false,
				};
			}

			if (!changeResult.data.success) {
				console.log(`[错误] 修改密码失败: ${changeResult.data.message || '未知原因'}`);
				return {
					success: false,
					message: changeResult.data.message || '修改密码失败',
					userInfo: null,
					is_api_error: true,
				};
			}

			console.log('[成功] 账号信息修改成功！');

			// 等待一下，确保修改生效
			await this.randomDelay(1000, 2000);

			// 步骤4: 获取更新后的用户信息
			console.log('[API] 获取更新后的用户信息...');
			const userInfoResult = await this.page.evaluate(
				async ({ baseUrl, apiUser }) => {
					try {
						const response = await fetch(`${baseUrl}/api/user/self`, {
							method: 'GET',
							headers: {
								'Content-Type': 'application/json',
								'New-Api-User': String(apiUser),
								referer: `${baseUrl}/console`,
							},
							credentials: 'include',
						});

						const data = await response.json();

						return {
							success: response.ok,
							data: data,
						};
					} catch (error) {
						return {
							success: false,
							error: error.message,
						};
					}
				},
				{ baseUrl: this.baseUrl, apiUser }
			);

			let userData = null;
			if (userInfoResult.success && userInfoResult.data.success) {
				userData = userInfoResult.data.data;
				console.log(`[信息] 用户ID: ${userData.id}`);
				console.log(`[信息] 用户名: ${userData.username}`);
				console.log(`[信息] 邮箱: ${userData.email}`);
				console.log(`[信息] 余额: $${(userData.quota / 500000).toFixed(2)}`);
				console.log(`[信息] 已使用: $${(userData.used_quota / 500000).toFixed(2)}`);
			} else {
				console.log(
					`[警告] 获取用户信息失败: ${userInfoResult.data?.message || userInfoResult.error || '未知原因'}`
				);
			}

			// 步骤5: 清除浏览器缓存
			await this.clearBrowserData();

			// 返回结果
			return {
				success: true,
				message: '账号信息修改成功',
				userInfo: userData,
			};
		} catch (error) {
			console.log(`[错误] 修改密码过程发生错误: ${error.message}`);
			return {
				success: false,
				message: `操作失败: ${error.message}`,
				userInfo: null,
				is_api_error: false,
			};
		}
	}

	/**
	 * 3. 清理资源并关闭浏览器
	 * @returns {Promise<{success: boolean, message: string}>}
	 */
	async cleanup() {
		try {
			console.log('[清理] 正在关闭浏览器...');

			if (this.page && !this.page.isClosed()) {
				await this.page.close();
			}

			if (this.context) {
				await this.context.close();
			}

			if (this.browser) {
				await this.browser.close();
			}

			// 重置实例变量
			this.browser = null;
			this.context = null;
			this.page = null;

			console.log('[成功] 浏览器已关闭');

			return {
				success: true,
				message: '资源清理成功',
			};
		} catch (error) {
			console.log(`[警告] 清理浏览器资源时出错: ${error.message}`);
			return {
				success: false,
				message: `资源清理失败: ${error.message}`,
			};
		}
	}
}

// 导出模块
export default AnyRouterChangePassword;

// 如果直接运行此文件，执行修改密码测试
const isMainModule = fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
	(async () => {
		const changer = new AnyRouterChangePassword();

		console.log('===== AnyRouter 修改账号密码测试 =====\n');

		try {
			// 1. 初始化浏览器
			const initResult = await changer.initialize();
			if (!initResult.success) {
				console.error('初始化失败:', initResult.message);
				return;
			}

			// 2. 修改账号密码（示例：修改多个账号）
			const accounts = [
				{
					username: 'ziyou123653',
					oldPassword: 'ziyou123653',
					newUsername: 'ziyou123654',
					newPassword: 'ziyou123654',
				},
			];

			for (const account of accounts) {
				const result = await changer.changePassword(
					account.username,
					account.oldPassword,
					account.newUsername,
					account.newPassword
				);

				if (result.success) {
					console.log(`\n✅ ${account.username} 修改成功`);
					if (result.userInfo) {
						console.log(`   新用户名: ${result.userInfo.username}`);
						console.log(`   邮箱: ${result.userInfo.email}`);
						console.log(`   余额: $${(result.userInfo.quota / 500000).toFixed(2)}`);
					}
				} else {
					console.log(`\n❌ ${account.username} 修改失败: ${result.message}`);
				}

				// 等待一段时间再处理下一个账号
				if (accounts.indexOf(account) < accounts.length - 1) {
					console.log('\n[等待] 5 秒后处理下一个账号...');
					await changer.randomDelay(5000, 7000);
				}
			}
		} finally {
			// 3. 清理资源
			await changer.cleanup();
		}

		console.log('\n===== 测试完成 =====');
	})();
}
