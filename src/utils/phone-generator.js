/**
 * 手机号生成器（随机模式）
 * 随机生成符合中国规则的11位手机号，通过保存已生成记录避免重复
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 中国常见手机号段前缀（前3位）
const PHONE_PREFIXES = [
	// 中国移动
	'134',
	'135',
	'136',
	'137',
	'138',
	'139',
	'147',
	'150',
	'151',
	'152',
	'157',
	'158',
	'159',
	'172',
	'178',
	'182',
	'183',
	'184',
	'187',
	'188',
	'198',
	// 中国联通
	'130',
	'131',
	'132',
	'145',
	'155',
	'156',
	'166',
	'171',
	'175',
	'176',
	'185',
	'186',
	// 中国电信
	'133',
	'149',
	'153',
	'173',
	'174',
	'177',
	'180',
	'181',
	'189',
	'191',
	'193',
	'199',
];

class PhoneGenerator {
	constructor() {
		this.dataFile = path.join(__dirname, 'datasave', 'phone-generated.json');
		this.generatedPhones = new Set();
		this.loaded = false;
	}

	/**
	 * 加载已生成的手机号
	 */
	async loadGenerated() {
		if (this.loaded) return;

		try {
			const content = await fs.readFile(this.dataFile, 'utf-8');
			const data = JSON.parse(content);
			this.generatedPhones = new Set(data.phones || []);
			this.loaded = true;
		} catch (error) {
			// 文件不存在，使用空集合
			this.generatedPhones = new Set();
			this.loaded = true;
		}
	}

	/**
	 * 保存已生成的手机号
	 */
	async saveGenerated() {
		try {
			// 确保目录存在
			const dir = path.dirname(this.dataFile);
			await fs.mkdir(dir, { recursive: true });

			// 保存数据
			const data = {
				phones: Array.from(this.generatedPhones),
				count: this.generatedPhones.size,
				lastUpdated: new Date().toISOString(),
			};
			await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2), 'utf-8');
		} catch (error) {
			console.error('[错误] 保存手机号记录失败:', error.message);
			throw error;
		}
	}

	/**
	 * 随机选择数组元素
	 */
	randomChoice(array) {
		return array[Math.floor(Math.random() * array.length)];
	}

	/**
	 * 生成随机8位数字（后8位）
	 */
	randomSuffix() {
		// 生成 10000000 到 99999999 之间的随机数
		const min = 10000000;
		const max = 99999999;
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	/**
	 * 生成下一个手机号
	 * @param {number} maxRetries - 最大重试次数
	 * @returns {Promise<{phone: string, isNew: boolean}>}
	 */
	async generateNext(maxRetries = 100) {
		await this.loadGenerated();

		let attempts = 0;
		while (attempts < maxRetries) {
			attempts++;

			// 随机生成手机号
			const prefix = this.randomChoice(PHONE_PREFIXES);
			const suffix = this.randomSuffix();
			const phone = prefix + suffix;

			// 检查是否已存在
			if (!this.generatedPhones.has(phone)) {
				this.generatedPhones.add(phone);
				await this.saveGenerated();
				return {
					phone,
					isNew: true,
				};
			}
		}

		throw new Error(`生成手机号失败：尝试 ${maxRetries} 次后仍有重复`);
	}

	/**
	 * 批量生成手机号
	 * @param {number} count - 生成数量
	 * @returns {Promise<string[]>}
	 */
	async generateBatch(count) {
		const phones = [];
		for (let i = 0; i < count; i++) {
			const result = await this.generateNext();
			phones.push(result.phone);
		}
		return phones;
	}

	/**
	 * 检查手机号是否已生成
	 */
	async hasGenerated(phone) {
		await this.loadGenerated();
		return this.generatedPhones.has(phone);
	}

	/**
	 * 获取已生成数量
	 */
	async getGeneratedCount() {
		await this.loadGenerated();
		return this.generatedPhones.size;
	}

	/**
	 * 获取理论最大数量
	 */
	getMaxCount() {
		// 每个号段 90000000 个号码（10000000-99999999）
		return PHONE_PREFIXES.length * 90000000;
	}

	/**
	 * 获取剩余可用数量
	 */
	async getRemainingCount() {
		await this.loadGenerated();
		const max = this.getMaxCount();
		return max - this.generatedPhones.size;
	}

	/**
	 * 清空已生成记录
	 */
	async clearGenerated() {
		this.generatedPhones = new Set();
		await this.saveGenerated();
		console.log('[清空] 已清空手机号生成记录');
	}
}

export default PhoneGenerator;

// 测试代码
if (import.meta.url === `file://${process.argv[1]}`) {
	(async () => {
		const generator = new PhoneGenerator();

		console.log('=== 手机号生成器测试（随机模式） ===\n');

		// 获取已生成数量
		const generated = await generator.getGeneratedCount();
		const remaining = await generator.getRemainingCount();
		console.log(`已生成: ${generated.toLocaleString()} 个`);
		console.log(`剩余可用: ${remaining.toLocaleString()} 个\n`);

		// 生成10个手机号测试（观察随机性）
		console.log('生成10个手机号（观察随机性）:');
		for (let i = 0; i < 10; i++) {
			const result = await generator.generateNext();
			console.log(`  ${i + 1}. ${result.phone}`);
		}

		console.log('\n批量生成5个手机号:');
		const batch = await generator.generateBatch(5);
		batch.forEach((phone, i) => {
			console.log(`  ${i + 1}. ${phone}`);
		});

		// 显示最终统计
		const finalGenerated = await generator.getGeneratedCount();
		console.log(`\n累计已生成: ${finalGenerated.toLocaleString()} 个手机号`);
	})();
}
