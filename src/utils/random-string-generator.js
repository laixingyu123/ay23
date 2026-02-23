/**
 * 随机字符串生成器
 * 生成 1-6 位的随机字符串（小写字母 + 数字），通过保存已生成记录避免重复
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 字符集：小写字母 + 数字
const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

class RandomStringGenerator {
	constructor() {
		this.dataFile = path.join(__dirname, 'datasave', 'random-string-generated.json');
		this.generatedStrings = new Set();
		this.loaded = false;
	}

	/**
	 * 加载已生成的字符串
	 */
	async loadGenerated() {
		if (this.loaded) return;

		try {
			const content = await fs.readFile(this.dataFile, 'utf-8');
			const data = JSON.parse(content);
			this.generatedStrings = new Set(data.strings || []);
			this.loaded = true;
		} catch (error) {
			// 文件不存在，使用空集合
			this.generatedStrings = new Set();
			this.loaded = true;
		}
	}

	/**
	 * 保存已生成的字符串
	 */
	async saveGenerated() {
		try {
			// 确保目录存在
			const dir = path.dirname(this.dataFile);
			await fs.mkdir(dir, { recursive: true });

			// 保存数据
			const data = {
				strings: Array.from(this.generatedStrings),
				count: this.generatedStrings.size,
				lastUpdated: new Date().toISOString(),
			};
			await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2), 'utf-8');
		} catch (error) {
			console.error('[错误] 保存随机字符串记录失败:', error.message);
			throw error;
		}
	}

	/**
	 * 生成指定长度的随机字符串
	 * @param {number} length - 字符串长度
	 * @returns {string}
	 */
	generateRandomString(length) {
		let result = '';
		for (let i = 0; i < length; i++) {
			result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
		}
		return result;
	}

	/**
	 * 生成下一个唯一的随机字符串
	 * @param {number|null} length - 字符串长度（1-6），null 则随机选择，默认 null
	 * @param {number} maxRetries - 最大重试次数
	 * @returns {Promise<{string: string, length: number, isNew: boolean}>}
	 */
	async generateNext(length = null, maxRetries = 1000) {
		await this.loadGenerated();

		if (length !== null && (length < 1 || length > 6)) {
			throw new Error('字符串长度必须为 1-6 或 null（随机）');
		}

		let attempts = 0;
		while (attempts < maxRetries) {
			attempts++;

			// 如果未指定长度，随机选择 1-6 位
			const actualLength = length !== null ? length : Math.floor(Math.random() * 6) + 1;

			// 生成随机字符串
			const str = this.generateRandomString(actualLength);

			// 检查是否已存在
			if (!this.generatedStrings.has(str)) {
				this.generatedStrings.add(str);
				await this.saveGenerated();
				return {
					string: str,
					length: actualLength,
					isNew: true,
				};
			}
		}

		throw new Error(`生成随机字符串失败：尝试 ${maxRetries} 次后仍有重复`);
	}

	/**
	 * 批量生成随机字符串
	 * @param {number} count - 生成数量
	 * @param {number|null} length - 字符串长度（1-6），null 则随机选择，默认 null
	 * @returns {Promise<string[]>}
	 */
	async generateBatch(count, length = null) {
		const strings = [];
		for (let i = 0; i < count; i++) {
			const result = await this.generateNext(length);
			strings.push(result.string);
		}
		return strings;
	}

	/**
	 * 检查字符串是否已生成
	 */
	async hasGenerated(str) {
		await this.loadGenerated();
		return this.generatedStrings.has(str);
	}

	/**
	 * 获取已生成数量
	 */
	async getGeneratedCount() {
		await this.loadGenerated();
		return this.generatedStrings.size;
	}

	/**
	 * 获取理论最大数量
	 * @param {number} length - 字符串长度
	 */
	getMaxCount(length) {
		return Math.pow(CHARS.length, length);
	}

	/**
	 * 获取所有长度的理论最大总数（1-6位）
	 */
	getTotalMaxCount() {
		let total = 0;
		for (let i = 1; i <= 6; i++) {
			total += this.getMaxCount(i);
		}
		return total;
	}

	/**
	 * 获取剩余可用数量
	 */
	async getRemainingCount() {
		await this.loadGenerated();
		const max = this.getTotalMaxCount();
		return max - this.generatedStrings.size;
	}

	/**
	 * 清空已生成记录
	 */
	async clearGenerated() {
		this.generatedStrings = new Set();
		await this.saveGenerated();
		console.log('[清空] 已清空随机字符串生成记录');
	}
}

export default RandomStringGenerator;

// 测试代码
if (import.meta.url === `file://${process.argv[1]}`) {
	(async () => {
		const generator = new RandomStringGenerator();

		console.log('=== 随机字符串生成器测试 ===\n');

		// 获取已生成数量
		const generated = await generator.getGeneratedCount();
		const remaining = await generator.getRemainingCount();
		const total = generator.getTotalMaxCount();
		console.log(`已生成: ${generated.toLocaleString()} 个`);
		console.log(`剩余可用: ${remaining.toLocaleString()} 个`);
		console.log(`理论总数: ${total.toLocaleString()} 个\n`);

		// 生成10个随机长度字符串测试（观察随机性）
		console.log('生成10个随机长度字符串（观察随机性）:');
		for (let i = 0; i < 10; i++) {
			const result = await generator.generateNext();
			console.log(`  ${i + 1}. ${result.string} (${result.length}位)`);
		}

		// 生成固定长度字符串
		console.log('\n生成5个固定4位字符串:');
		for (let i = 0; i < 5; i++) {
			const result = await generator.generateNext(4);
			console.log(`  ${i + 1}. ${result.string} (${result.length}位)`);
		}

		// 批量生成
		console.log('\n批量生成5个随机长度字符串:');
		const batch = await generator.generateBatch(5);
		batch.forEach((str, i) => {
			console.log(`  ${i + 1}. ${str} (${str.length}位)`);
		});

		// 显示最终统计
		const finalGenerated = await generator.getGeneratedCount();
		console.log(`\n累计已生成: ${finalGenerated.toLocaleString()} 个随机字符串`);

		// 显示各长度的理论容量
		console.log('\n各长度理论容量:');
		for (let i = 1; i <= 6; i++) {
			console.log(`  ${i}位: ${generator.getMaxCount(i).toLocaleString()} 个`);
		}
	})();
}
