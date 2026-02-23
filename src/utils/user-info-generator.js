/**
 * 用户信息生成器
 * 统一生成姓名、手机号、身份证号、随机字符串
 */

import NameGenerator from './name-generator.js';
import PhoneGenerator from './phone-generator.js';
import IdCardGenerator from './idcard-generator.js';
import RandomStringGenerator from './random-string-generator.js';

// 可用部门代码列表
const DEPARTMENT_CODES = [
	3, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
	33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 191, 192, 193, 194, 195, 196, 197, 198, 199,
	201, 202, 203, 204, 205, 206, 208, 209, 212, 213,
];

class UserInfoGenerator {
	constructor() {
		this.nameGen = new NameGenerator();
		this.phoneGen = new PhoneGenerator();
		this.idCardGen = new IdCardGenerator();
		this.randomStringGen = new RandomStringGenerator();
	}

	/**
	 * 随机选择部门代码
	 * @returns {number}
	 */
	getRandomDepartment() {
		return DEPARTMENT_CODES[Math.floor(Math.random() * DEPARTMENT_CODES.length)];
	}

	/**
	 * 生成完整的用户信息
	 * @returns {Promise<{name: string, phone: string, idCard: string, idCardInfo: object, randomString: string, department: number}>}
	 */
	async generate() {
		// 并发生成姓名、手机号、身份证号、随机字符串
		const [nameResult, phoneResult, idCardResult, randomStringResult] = await Promise.all([
			this.nameGen.generateNext(),
			this.phoneGen.generateNext(),
			this.idCardGen.generateNext(),
			this.randomStringGen.generateNext(),
		]);

		// 解析身份证信息
		const idCardInfo = this.idCardGen.parseIdCard(idCardResult.idCard);

		return {
			name: nameResult.name,
			phone: phoneResult.phone,
			idCard: idCardResult.idCard,
			idCardInfo: {
				areaCode: idCardInfo.areaCode,
				birthDate: idCardInfo.birthDate,
				year: idCardInfo.year,
				month: idCardInfo.month,
				day: idCardInfo.day,
				gender: idCardInfo.gender,
			},
			randomString: randomStringResult.string,
			department: this.getRandomDepartment(),
		};
	}

	/**
	 * 批量生成用户信息
	 * @param {number} count - 生成数量
	 * @returns {Promise<Array>}
	 */
	async generateBatch(count) {
		const users = [];
		for (let i = 0; i < count; i++) {
			const userInfo = await this.generate();
			users.push(userInfo);
		}
		return users;
	}

	/**
	 * 获取已生成统计
	 */
	async getStatistics() {
		const [nameCount, phoneCount, idCardCount, randomStringCount] = await Promise.all([
			this.nameGen.getGeneratedCount(),
			this.phoneGen.getGeneratedCount(),
			this.idCardGen.getGeneratedCount(),
			this.randomStringGen.getGeneratedCount(),
		]);

		return {
			names: nameCount,
			phones: phoneCount,
			idCards: idCardCount,
			randomStrings: randomStringCount,
		};
	}

	/**
	 * 清空所有生成记录
	 */
	async clearAll() {
		await Promise.all([
			this.nameGen.clearGenerated(),
			this.phoneGen.clearGenerated(),
			this.idCardGen.clearGenerated(),
			this.randomStringGen.clearGenerated(),
		]);
		console.log('[清空] 已清空所有生成记录');
	}
}

export default UserInfoGenerator;

// 测试代码
if (import.meta.url === `file://${process.argv[1]}`) {
	(async () => {
		const generator = new UserInfoGenerator();

		console.log('=== 用户信息生成器测试 ===\n');

		// 获取统计
		const stats = await generator.getStatistics();
		console.log('当前统计:');
		console.log(`  姓名: ${stats.names.toLocaleString()} 个`);
		console.log(`  手机号: ${stats.phones.toLocaleString()} 个`);
		console.log(`  身份证: ${stats.idCards.toLocaleString()} 个`);
		console.log(`  随机字符串: ${stats.randomStrings.toLocaleString()} 个\n`);

		// 生成单个用户信息
		console.log('生成5个用户信息（观察随机性）:\n');
		for (let i = 0; i < 5; i++) {
			const user = await generator.generate();
			console.log(`【用户 ${i + 1}】`);
			console.log(`  姓名: ${user.name}`);
			console.log(`  手机号: ${user.phone}`);
			console.log(`  身份证: ${user.idCard}`);
			console.log(`  出生日期: ${user.idCardInfo.birthDate}`);
			console.log(`  性别: ${user.idCardInfo.gender}`);
			console.log(`  地区码: ${user.idCardInfo.areaCode}`);
			console.log(`  随机字符串: ${user.randomString}`);
			console.log(`  部门: ${user.department}\n`);
		}

		// 批量生成
		console.log('批量生成3个用户信息:\n');
		const users = await generator.generateBatch(3);
		users.forEach((user, i) => {
			console.log(
				`  ${i + 1}. ${user.name} | ${user.phone} | ${user.idCard} (${user.idCardInfo.birthDate}, ${user.idCardInfo.gender}) | 随机串: ${user.randomString} | 部门: ${user.department}`
			);
		});

		// 最终统计
		const finalStats = await generator.getStatistics();
		console.log('\n最终统计:');
		console.log(`  姓名累计: ${finalStats.names.toLocaleString()} 个`);
		console.log(`  手机号累计: ${finalStats.phones.toLocaleString()} 个`);
		console.log(`  身份证累计: ${finalStats.idCards.toLocaleString()} 个`);
		console.log(`  随机字符串累计: ${finalStats.randomStrings.toLocaleString()} 个`);
	})();
}
