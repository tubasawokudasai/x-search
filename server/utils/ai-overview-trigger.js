import natural from 'natural';
import nodejieba from 'nodejieba';

const { WordTokenizer, BayesClassifier, NGrams } = natural;

/**
 * AIOverviewTrigger 类用于根据用户查询的意图和结构特征判断是否需要触发AI概览功能。
 */
class AIOverviewTrigger {
    constructor() {
        // 英文分词器（用于英文文本）
        this.englishTokenizer = new WordTokenizer();
        // 中文分词已通过 nodejieba 实现，无需额外初始化
        this.classifier = new BayesClassifier();
        // 2. 初始化分类器（仅使用自定义训练数据，移除 Snips 逻辑）
        this.initializeClassifier();

        // 常见疑问词（中英文）
        this.questionWords = {
            en: new Set(['what', 'how', 'why', 'when', 'where', 'which', 'who', 'whom', 'whose', 'can', 'should', 'is', 'are', 'do', 'does', 'will', 'would']),
            zh: new Set(['什么', '如何', '为什么', '何时', '哪里', '哪个', '谁', '谁的', '能否', '可以', '是', '有没有', '将', '会', '是否'])
        };

        // 导航类关键词（中英文）
        this.navigationKeywords = new Set(['官网', '登录', '下载', '安装', '注册', '地址', '网址', '官方', '访问', '前往', 'official', 'site', 'login', 'download', 'register', 'url', 'access', 'go to', 'open', 'app']);

        // 实时性关键词（中英文）
        this.realtimeKeywords = new Set(['最新', '今天', '现在', '实时', '数据', '更新', '新闻', '行情', '价格', 'current', 'today', 'latest', 'real-time', 'news', 'price', 'update', 'year', 'month', 'day']);
    }

    /**
     * 3. 初始化分类器（仅使用自定义训练数据，完全移除 Snips 数据集相关逻辑）
     */
    initializeClassifier() {
        // 核心自定义训练数据（专注于信息查询/导航/实时/商业四大意图）
        const customTrainingData = [
            // =======================================================
            // 信息性查询样本 (Information - 应触发AI Overview)
            // =======================================================
            { text: '如何用Python实现机器学习算法', label: 'information' },
            { text: '什么是量子计算', label: 'information' },
            { text: '解释一下云计算的三种服务模型', label: 'information' },
            { text: '人工智能的未来发展方向', label: 'information' },
            { text: '机器学习中随机森林的参数调优方法', label: 'information' },
            { text: 'JavaScript异步编程方法有哪些', label: 'information' },
            { text: '核聚变是什么原理', label: 'information' },
            { text: '地球为什么是圆的', label: 'information' },
            { text: '什么是黑洞', label: 'information' },
            { text: '二战爆发的原因和影响', label: 'information' },
            { text: '如何在家制作美味的披萨', label: 'information' },
            { text: '介绍一下长城', label: 'information' },
            { text: '什么是区块链技术', label: 'information' },
            { text: '深度学习和机器学习的区别', label: 'information' },
            { text: 'who is the current president of France', label: 'information' },
            { text: 'explain the process of photosynthesis', label: 'information' },
            { text: 'what is the capital of Australia', label: 'information' },
            { text: 'how does a quantum computer work', label: 'information' },

            // =======================================================
            // 导航类查询样本 (Navigation - 不触发AI Overview)
            // =======================================================
            { text: 'Python官网登录', label: 'navigation' },
            { text: 'TensorFlow官网下载', label: 'navigation' },
            { text: '打开我的邮箱', label: 'navigation' },
            { text: '访问谷歌', label: 'navigation' },
            { text: '微软官方网站', label: 'navigation' },
            { text: 'go to youtube', label: 'navigation' },
            { text: 'open facebook site', label: 'navigation' },

            // =======================================================
            // 实时性查询样本 (Realtime - 不触发AI Overview)
            // =======================================================
            { text: '2025年Python开发者薪资', label: 'realtime' },
            { text: '现在的比特币价格是多少', label: 'realtime' },
            { text: '今天的天气怎么样', label: 'realtime' },
            { text: '2023年全球GDP排名', label: 'realtime' },
            { text: '当前时间', label: 'realtime' },
            { text: 'last night\'s football scores', label: 'realtime' },
            { text: 'stock prices now', label: 'realtime' },

            // =======================================================
            // 商业性查询样本 (Commercial - 不触发AI Overview)
            // =======================================================
            { text: '购买Python编程书籍', label: 'commercial' },
            { text: '最好的个人电脑推荐', label: 'commercial' },
            { text: '哪里可以买到iPhone 15', label: 'commercial' },
            { text: '预订机票', label: 'commercial' },
            { text: 'price of new samsung phone', label: 'commercial' },
            { text: 'cheapest flights to london', label: 'commercial' },

            // =======================================================
            // 短查询补充样本（避免误判）
            // =======================================================
            { text: 'Python', label: 'information' },
            { text: '机器学习', label: 'information' },
            { text: '最新消息', label: 'realtime' },
            { text: '去淘宝', label: 'navigation' },
            { text: 'how to', label: 'information' },
            { text: 'what is', label: 'information' },
        ];

        // 检查训练数据有效性
        if (customTrainingData.length === 0) {
            console.warn('警告：无训练数据可用，AI概览触发逻辑可能失效');
            return;
        }

        // 4. 对训练文本进行分词处理（中英文分别适配），再传入分类器
        customTrainingData.forEach(item => {
            const { text, label } = item;
            // 先分词，再将分词结果拼接为字符串（符合分类器输入格式）
            const tokenizedText = this.tokenizeText(text).join(' ');
            this.classifier.addDocument(tokenizedText.toLowerCase(), label);
        });

        // 训练分类器
        this.classifier.train();

        // 统计训练信息
        const categories = new Set(customTrainingData.map(item => item.label));
        console.log(`分类器训练完成：共 ${customTrainingData.length} 条样本，覆盖 ${categories.size} 个意图类别`);
    }

    /**
     * 5. 核心分词方法：根据语言自动选择中文（nodejieba）或英文（WordTokenizer）分词
     * @param {string} text - 待分词的文本
     * @returns {string[]} 分词后的词汇数组
     */
    tokenizeText(text) {
        if (typeof text !== 'string' || text.trim() === '') {
            return [];
        }
        // 检测语言：包含中文字符则视为中文
        const isChinese = /[\u4e00-\u9fff]/.test(text);

        if (isChinese) {
            // 中文分词：使用 nodejieba 精确模式（适合意图识别场景）
            // cut 方法参数：text（待分词文本）、isNoStopWord（是否去停用词，默认false）、isNoUnknown（是否过滤未知词，默认false）
            return nodejieba.cut(text, false, false);
        } else {
            // 英文分词：使用 natural 库的 WordTokenizer
            return this.englishTokenizer.tokenize(text);
        }
    }

    /**
     * 检测查询语言（中文/英文）
     * @param {string} query - 用户查询
     * @returns {'zh' | 'en'} 检测到的语言
     */
    detectLanguage(query) {
        return /[\u4e00-\u9fff]/.test(query) ? 'zh' : 'en';
    }

    /**
     * 分析查询结构特征（基于分词结果）
     * @param {string} query - 用户查询
     * @returns {object} 结构特征对象
     */
    analyzeQueryStructure(query) {
        // 基于分词结果分析，而非原始文本
        const tokens = this.tokenizeText(query);
        const lang = this.detectLanguage(query);

        return {
            wordCount: tokens.length, // 分词后的词汇数量（更准确）
            hasQuestionWord: tokens.some(token => this.questionWords[lang]?.has(token)),
            isLongSentence: tokens.length >= 5, // 分词后超过5个词视为长句
            hasNavKeyword: tokens.some(token => this.navigationKeywords.has(token)),
            hasRealtimeKeyword: tokens.some(token =>
                this.realtimeKeywords.has(token) ||
                /^\d{4}$/.test(token) || // 匹配四位数字年份（如2025）
                /^\d{4}年$/.test(token)  // 匹配带“年”的年份（如2025年）
            )
        };
    }

    /**
     * 6. 修正 N-Gram 调用：基于分词结果生成 N-Gram（而非原始文本）
     * 判断是否为复杂信息查询（通过 2-Gram 和 3-Gram 分析）
     * @param {string} query - 用户查询
     * @returns {boolean} 是否为复杂信息查询
     */
    isComplexInformationQuery(query) {
        const tokens = this.tokenizeText(query);
        if (tokens.length < 3) return false; // 分词后少于3个词，不视为复杂查询

        // 关键修正：向 NGrams 传递分词后的数组（而非原始字符串）
        const bigrams = NGrams.bigrams(tokens); // 2-Gram（基于分词结果）
        const trigrams = NGrams.trigrams(tokens); // 3-Gram（基于分词结果）

        // 判定逻辑：长文本（≥4个词）且包含有效 N-Gram
        return tokens.length >= 4 && (bigrams.length >= 2 || trigrams.length >= 1);
    }

    /**
     * 核心决策逻辑：判断是否触发AI概览
     * @param {string} query - 用户查询
     * @returns {{trigger: boolean, reason: string}} 触发结果及原因
     */
    shouldTriggerAIOverview(query) {
        // 先对查询分词，再进行分类（确保分类器输入与训练数据格式一致）
        const tokenizedQuery = this.tokenizeText(query).join(' ');
        const intent = this.classifier.classify(tokenizedQuery.toLowerCase());
        const structureFeatures = this.analyzeQueryStructure(query);
        const isComplexInfo = this.isComplexInformationQuery(query);

        // 明确不触发的意图列表
        const nonTriggerIntents = ['navigation', 'realtime', 'commercial'];

        // 1. 非信息类意图：直接不触发
        if (nonTriggerIntents.includes(intent)) {
            const reason = `查询属于【${intent}】意图（非信息查询），不触发AI概览`;
            return { trigger: false, reason };
        }

        // 2. 信息类意图：结合结构特征判断
        if (intent === 'information') {
            // 复杂信息查询（长句+疑问词/复杂结构）：触发
            if (structureFeatures.isLongSentence && structureFeatures.hasQuestionWord && isComplexInfo) {
                const reason = `查询属于【信息】意图，且为长句+疑问词+复杂结构，触发AI概览`;
                return { trigger: true, reason };
            }
            // 简单信息查询（疑问词/基础复杂度）：触发
            else if (structureFeatures.hasQuestionWord || isComplexInfo) {
                const reason = `查询属于【信息】意图，且包含疑问词或具有基础复杂度，触发AI概览`;
                return { trigger: true, reason };
            }
            // 过短信息查询：不触发
            else {
                const reason = `查询属于【信息】意图，但结构过于简单（分词后仅${structureFeatures.wordCount}个词），不触发AI概览`;
                return { trigger: false, reason };
            }
        }

        // 3. 未知意图：默认不触发
        const reason = `查询属于未知意图【${intent}】，默认不触发AI概览`;
        return { trigger: false, reason };
    }
}

export default new AIOverviewTrigger();
