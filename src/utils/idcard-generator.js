/**
 * 身份证号生成器（随机模式）
 * 随机生成符合规则的18位身份证号，通过保存已生成记录避免重复
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 常见地区码（前6位）
const AREA_CODES = [
	'110101', // 北京市东城区
	'110102', // 北京市西城区
	'110105', // 北京市朝阳区
	'110106', // 北京市丰台区
	'310101', // 上海市黄浦区
	'310104', // 上海市徐汇区
	'310105', // 上海市长宁区
	'310106', // 上海市静安区
	'310107', // 上海市普陀区
	'440101', // 广州市东山区
	'440103', // 广州市荔湾区
	'440104', // 广州市越秀区
	'440105', // 广州市海珠区
	'440106', // 广州市天河区
	'440111', // 广州市白云区
	'440303', // 深圳市罗湖区
	'440304', // 深圳市福田区
	'440305', // 深圳市南山区
	'440306', // 深圳市宝安区
	'330101', // 杭州市市区
	'330102', // 杭州市上城区
	'330103', // 杭州市下城区
	'330104', // 杭州市江干区
	'330105', // 杭州市拱墅区
	'320101', // 南京市市区
	'320102', // 南京市玄武区
	'320103', // 南京市白下区
	'320104', // 南京市秦淮区
	'420101', // 武汉市市区
	'420102', // 武汉市江岸区
	'420103', // 武汉市江汉区
	'420104', // 武汉市硚口区
	'510101', // 成都市市区
	'510104', // 成都市锦江区
	'510105', // 成都市青羊区
	'510106', // 成都市金牛区
	'610101', // 西安市市区
	'610102', // 西安市新城区
	'610103', // 西安市碑林区
	'610104', // 西安市莲湖区
];

// 身份证校验码权重因子
const WEIGHT_FACTORS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];

// 校验码对照表
const CHECK_CODE_MAP = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

class IdCardGenerator {
	constructor() {
		this.dataFile = path.join(__dirname, 'datasave', 'idcard-generated.json');
		this.generatedIdCards = new Set();
		this.loaded = false;
	}

	/**
	 * 加载已生成的身份证号
	 */
	async loadGenerated() {
		if (this.loaded) return;

		try {
			const content = await fs.readFile(this.dataFile, 'utf-8');
			const data = JSON.parse(content);
			this.generatedIdCards = new Set(data.idCards || []);
			this.loaded = true;
		} catch (error) {
			// 文件不存在，使用空集合
			this.generatedIdCards = new Set();
			this.loaded = true;
		}
	}

	/**
	 * 保存已生成的身份证号
	 */
	async saveGenerated() {
		try {
			// 确保目录存在
			const dir = path.dirname(this.dataFile);
			await fs.mkdir(dir, { recursive: true });

			// 保存数据
			const data = {
				idCards: Array.from(this.generatedIdCards),
				count: this.generatedIdCards.size,
				lastUpdated: new Date().toISOString(),
			};
			await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2), 'utf-8');
		} catch (error) {
			console.error('[错误] 保存身份证记录失败:', error.message);
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
	 * 计算身份证校验码
	 * @param {string} idCard17 - 身份证号前17位
	 * @returns {string} 校验码
	 */
	calculateCheckCode(idCard17) {
		let sum = 0;
		for (let i = 0; i < 17; i++) {
			sum += parseInt(idCard17[i]) * WEIGHT_FACTORS[i];
		}
		const remainder = sum % 11;
		return CHECK_CODE_MAP[remainder];
	}

	/**
	 * 判断是否为闰年
	 * @param {number} year - 年份
	 * @returns {boolean}
	 */
	isLeapYear(year) {
		return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
	}

	/**
	 * 获取某月的天数
	 * @param {number} year - 年份
	 * @param {number} month - 月份
	 * @returns {number}
	 */
	getDaysInMonth(year, month) {
		const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
		if (month === 2 && this.isLeapYear(year)) {
			return 29;
		}
		return daysInMonth[month - 1];
	}

	/**
	 * 生成随机出生日期（1980-2005）
	 * @returns {string} YYYYMMDD 格式
	 */
	randomBirthDate() {
		const year = Math.floor(Math.random() * (2005 - 1980 + 1)) + 1980;
		const month = Math.floor(Math.random() * 12) + 1;
		const maxDay = this.getDaysInMonth(year, month);
		const day = Math.floor(Math.random() * maxDay) + 1;

		return year.toString() + month.toString().padStart(2, '0') + day.toString().padStart(2, '0');
	}

	/**
	 * 生成随机顺序码（001-999）
	 * @returns {string} 3位顺序码
	 */
	randomSequenceCode() {
		const code = Math.floor(Math.random() * 999) + 1;
		return code.toString().padStart(3, '0');
	}

	/**
	 * 生成下一个身份证号
	 * @param {number} maxRetries - 最大重试次数
	 * @returns {Promise<{idCard: string, isNew: boolean}>}
	 */
	async generateNext(maxRetries = 100) {
		await this.loadGenerated();

		let attempts = 0;
		while (attempts < maxRetries) {
			attempts++;

			// 随机生成身份证号前17位
			const areaCode = this.randomChoice(AREA_CODES);
			const birthDate = this.randomBirthDate();
			const sequenceCode = this.randomSequenceCode();

			const idCard17 = areaCode + birthDate + sequenceCode;

			// 计算校验码
			const checkCode = this.calculateCheckCode(idCard17);
			const idCard = idCard17 + checkCode;

			// 检查是否已存在
			if (!this.generatedIdCards.has(idCard)) {
				this.generatedIdCards.add(idCard);
				await this.saveGenerated();
				return {
					idCard,
					isNew: true,
				};
			}
		}

		throw new Error(`生成身份证号失败：尝试 ${maxRetries} 次后仍有重复`);
	}

	/**
	 * 批量生成身份证号
	 * @param {number} count - 生成数量
	 * @returns {Promise<string[]>}
	 */
	async generateBatch(count) {
		const idCards = [];
		for (let i = 0; i < count; i++) {
			const result = await this.generateNext();
			idCards.push(result.idCard);
		}
		return idCards;
	}

	/**
	 * 检查身份证号是否已生成
	 */
	async hasGenerated(idCard) {
		await this.loadGenerated();
		return this.generatedIdCards.has(idCard);
	}

	/**
	 * 获取已生成数量
	 */
	async getGeneratedCount() {
		await this.loadGenerated();
		return this.generatedIdCards.size;
	}

	/**
	 * 验证身份证号是否合法
	 * @param {string} idCard - 18位身份证号
	 * @returns {boolean}
	 */
	validate(idCard) {
		if (!idCard || idCard.length !== 18) {
			return false;
		}

		const idCard17 = idCard.substring(0, 17);
		const checkCode = idCard[17];

		// 检查前17位是否为数字
		if (!/^\d{17}$/.test(idCard17)) {
			return false;
		}

		// 验证校验码
		const calculatedCheckCode = this.calculateCheckCode(idCard17);
		return calculatedCheckCode === checkCode.toUpperCase();
	}

	/**
	 * 解析身份证号信息
	 * @param {string} idCard - 18位身份证号
	 * @returns {object|null}
	 */
	parseIdCard(idCard) {
		if (!this.validate(idCard)) {
			return null;
		}

		const areaCode = idCard.substring(0, 6);
		const year = idCard.substring(6, 10);
		const month = idCard.substring(10, 12);
		const day = idCard.substring(12, 14);
		const sequenceCode = idCard.substring(14, 17);
		const checkCode = idCard[17];

		// 性别：顺序码的最后一位，奇数为男，偶数为女
		const genderCode = parseInt(sequenceCode[2]);
		const gender = genderCode % 2 === 1 ? '男' : '女';

		return {
			areaCode,
			birthDate: `${year}-${month}-${day}`,
			year: parseInt(year),
			month: parseInt(month),
			day: parseInt(day),
			sequenceCode,
			checkCode,
			gender,
		};
	}

	/**
	 * 清空已生成记录
	 */
	async clearGenerated() {
		this.generatedIdCards = new Set();
		await this.saveGenerated();
		console.log('[清空] 已清空身份证生成记录');
	}
}

export default IdCardGenerator;

// 测试代码
if (import.meta.url === `file://${process.argv[1]}`) {
	(async () => {
		const generator = new IdCardGenerator();

		console.log('=== 身份证号生成器测试（随机模式） ===\n');

		// 获取已生成数量
		const generated = await generator.getGeneratedCount();
		console.log(`已生成: ${generated.toLocaleString()} 个\n`);

		// 生成10个身份证号测试（观察随机性）
		console.log('生成10个身份证号（观察随机性）:');
		for (let i = 0; i < 10; i++) {
			const result = await generator.generateNext();
			const info = generator.parseIdCard(result.idCard);
			const isValid = generator.validate(result.idCard);
			console.log(
				`  ${i + 1}. ${result.idCard} (出生: ${info.birthDate}, 性别: ${info.gender}, 验证: ${isValid ? '✓' : '✗'})`
			);
		}

		console.log('\n批量生成5个身份证号:');
		const batch = await generator.generateBatch(5);
		batch.forEach((idCard, i) => {
			const info = generator.parseIdCard(idCard);
			console.log(`  ${i + 1}. ${idCard} (出生: ${info.birthDate}, 性别: ${info.gender})`);
		});

		// 显示最终统计
		const finalGenerated = await generator.getGeneratedCount();
		console.log(`\n累计已生成: ${finalGenerated.toLocaleString()} 个身份证号`);

		// 验证测试
		console.log('\n身份证验证测试:');
		const testIdCards = [
			{ idCard: '11010119900307001X', desc: '真实有效示例' },
			{ idCard: '110101199003070011', desc: '校验码错误' },
			{ idCard: '12345678901234567', desc: '长度不足' },
		];
		testIdCards.forEach((test, i) => {
			const isValid = generator.validate(test.idCard);
			console.log(`  ${i + 1}. ${test.idCard} (${test.desc}) - ${isValid ? '有效 ✓' : '无效 ✗'}`);
		});
	})();
}
