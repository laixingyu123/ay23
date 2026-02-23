/**
 * 姓名生成器（随机模式）
 * 随机生成中文姓名，通过保存已生成记录避免重复
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 中国常见姓氏（100个）
const SURNAMES = [
	'王',
	'李',
	'张',
	'刘',
	'陈',
	'杨',
	'黄',
	'赵',
	'吴',
	'周',
	'徐',
	'孙',
	'马',
	'朱',
	'胡',
	'郭',
	'何',
	'高',
	'林',
	'罗',
	'郑',
	'梁',
	'谢',
	'宋',
	'唐',
	'韩',
	'冯',
	'于',
	'董',
	'萧',
	'程',
	'曹',
	'袁',
	'邓',
	'许',
	'傅',
	'沈',
	'曾',
	'彭',
	'吕',
	'苏',
	'蒋',
	'蔡',
	'贾',
	'丁',
	'魏',
	'薛',
	'叶',
	'阎',
	'潘',
	'杜',
	'戴',
	'夏',
	'钟',
	'汪',
	'田',
	'任',
	'姜',
	'范',
	'方',
	'石',
	'姚',
	'谭',
	'盛',
	'邹',
	'熊',
	'金',
	'陆',
	'郝',
	'孔',
	'白',
	'崔',
	'康',
	'毛',
	'邱',
	'秦',
	'江',
	'史',
	'顾',
	'侯',
	'邵',
	'孟',
	'龙',
	'万',
	'段',
	'章',
	'钱',
	'汤',
	'尹',
	'黎',
	'易',
	'常',
	'武',
	'乔',
	'贺',
	'赖',
	'龚',
	'文',
];

// 常见名字字（单字）
const GIVEN_NAME_CHARS = [
	'伟',
	'芳',
	'娜',
	'敏',
	'静',
	'丽',
	'强',
	'磊',
	'军',
	'洋',
	'勇',
	'艳',
	'杰',
	'娟',
	'涛',
	'明',
	'超',
	'秀',
	'英',
	'华',
	'文',
	'慧',
	'玉',
	'萍',
	'红',
	'鹏',
	'辉',
	'建',
	'云',
	'平',
	'霞',
	'梅',
	'欢',
	'宇',
	'航',
	'凯',
	'林',
	'峰',
	'博',
	'浩',
	'阳',
	'瑞',
	'晨',
	'轩',
	'宏',
	'卫',
	'刚',
	'波',
	'龙',
	'飞',
	'鑫',
	'宁',
	'成',
	'亮',
	'俊',
	'鹏',
	'翔',
	'斌',
	'涛',
	'毅',
	'帆',
	'睿',
	'锋',
	'彬',
	'昊',
	'松',
	'杨',
	'晖',
	'栋',
	'骏',
	'鸿',
	'新',
	'畅',
	'乐',
	'晴',
	'婷',
	'雪',
	'琳',
	'怡',
	'悦',
	'婕',
	'琪',
	'颖',
	'倩',
	'佳',
	'欣',
	'雯',
	'思',
	'嘉',
	'妍',
	'诗',
	'梦',
	'薇',
	'蕾',
	'馨',
	'菲',
	'柔',
	'晗',
	'璐',
];

class NameGenerator {
	constructor() {
		this.dataFile = path.join(__dirname, 'datasave', 'name-generated.json');
		this.generatedNames = new Set();
		this.loaded = false;
	}

	/**
	 * 加载已生成的姓名
	 */
	async loadGenerated() {
		if (this.loaded) return;

		try {
			const content = await fs.readFile(this.dataFile, 'utf-8');
			const data = JSON.parse(content);
			this.generatedNames = new Set(data.names || []);
			this.loaded = true;
		} catch (error) {
			// 文件不存在，使用空集合
			this.generatedNames = new Set();
			this.loaded = true;
		}
	}

	/**
	 * 保存已生成的姓名
	 */
	async saveGenerated() {
		try {
			// 确保目录存在
			const dir = path.dirname(this.dataFile);
			await fs.mkdir(dir, { recursive: true });

			// 保存数据
			const data = {
				names: Array.from(this.generatedNames),
				count: this.generatedNames.size,
				lastUpdated: new Date().toISOString(),
			};
			await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2), 'utf-8');
		} catch (error) {
			console.error('[错误] 保存姓名记录失败:', error.message);
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
	 * 生成下一个姓名
	 * @param {number|null} nameLength - 名字长度（1-2），null 则随机选择，默认 null
	 * @param {number} maxRetries - 最大重试次数
	 * @returns {Promise<{name: string, nameLength: number, isNew: boolean}>}
	 */
	async generateNext(nameLength = null, maxRetries = 100) {
		await this.loadGenerated();

		if (nameLength !== null && nameLength !== 1 && nameLength !== 2) {
			throw new Error('名字长度必须为 1、2 或 null（随机）');
		}

		let attempts = 0;
		while (attempts < maxRetries) {
			attempts++;

			// 如果未指定长度，随机选择单字名或两字名（两字名概率更高，70%）
			const actualLength = nameLength !== null ? nameLength : Math.random() < 0.7 ? 2 : 1;

			// 随机生成姓名
			const surname = this.randomChoice(SURNAMES);
			const firstChar = this.randomChoice(GIVEN_NAME_CHARS);
			const secondChar = actualLength === 2 ? this.randomChoice(GIVEN_NAME_CHARS) : '';
			const name = surname + firstChar + secondChar;

			// 检查是否已存在
			if (!this.generatedNames.has(name)) {
				this.generatedNames.add(name);
				await this.saveGenerated();
				return {
					name,
					nameLength: actualLength,
					isNew: true,
				};
			}
		}

		throw new Error(`生成姓名失败：尝试 ${maxRetries} 次后仍有重复`);
	}

	/**
	 * 批量生成姓名
	 * @param {number} count - 生成数量
	 * @param {number|null} nameLength - 名字长度（1-2），null 则随机选择，默认 null
	 * @returns {Promise<string[]>}
	 */
	async generateBatch(count, nameLength = null) {
		const names = [];
		for (let i = 0; i < count; i++) {
			const result = await this.generateNext(nameLength);
			names.push(result.name);
		}
		return names;
	}

	/**
	 * 检查姓名是否已生成
	 */
	async hasGenerated(name) {
		await this.loadGenerated();
		return this.generatedNames.has(name);
	}

	/**
	 * 获取已生成数量
	 */
	async getGeneratedCount() {
		await this.loadGenerated();
		return this.generatedNames.size;
	}

	/**
	 * 获取理论最大数量
	 */
	getMaxCount(nameLength = 2) {
		if (nameLength === 1) {
			return SURNAMES.length * GIVEN_NAME_CHARS.length;
		}
		return SURNAMES.length * GIVEN_NAME_CHARS.length * GIVEN_NAME_CHARS.length;
	}

	/**
	 * 获取剩余可用数量
	 */
	async getRemainingCount(nameLength = 2) {
		await this.loadGenerated();
		const max = this.getMaxCount(nameLength);
		return max - this.generatedNames.size;
	}

	/**
	 * 清空已生成记录
	 */
	async clearGenerated() {
		this.generatedNames = new Set();
		await this.saveGenerated();
		console.log('[清空] 已清空姓名生成记录');
	}
}

export default NameGenerator;

// 测试代码
if (import.meta.url === `file://${process.argv[1]}`) {
	(async () => {
		const generator = new NameGenerator();

		console.log('=== 姓名生成器测试（随机模式） ===\n');

		// 获取已生成数量
		const generated = await generator.getGeneratedCount();
		const remaining = await generator.getRemainingCount(2);
		console.log(`已生成: ${generated.toLocaleString()} 个`);
		console.log(`剩余可用: ${remaining.toLocaleString()} 个\n`);

		// 生成15个随机长度姓名测试（观察随机性）
		console.log('生成15个随机长度姓名（观察随机性）:');
		for (let i = 0; i < 15; i++) {
			const result = await generator.generateNext();
			console.log(`  ${i + 1}. ${result.name} (${result.nameLength}字名)`);
		}

		// 显示最终统计
		const finalGenerated = await generator.getGeneratedCount();
		console.log(`\n累计已生成: ${finalGenerated.toLocaleString()} 个姓名`);
	})();
}
