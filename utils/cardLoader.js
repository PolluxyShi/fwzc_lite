const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// 移除 BOM 字符的工具函数
function removeBOM(str) {
  if (!str || typeof str !== 'string') return str;
  // 移除 UTF-8 BOM (0xFEFF 或 \uFEFF)
  if (str.charCodeAt(0) === 0xFEFF) {
    return str.slice(1);
  }
  // 也处理其他可能的 BOM 变体
  return str.replace(/^\uFEFF/, '');
}

// 清理对象键名中的 BOM 字符
function cleanObjectKeys(obj) {
  const cleaned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const cleanKey = removeBOM(key);
      cleaned[cleanKey] = obj[key];
    }
  }
  return cleaned;
}

// 加载卡牌数据库
function loadCardDatabase() {
  return new Promise((resolve, reject) => {
    const cardDb = {};
    const csvPath = path.join(__dirname, '..', 'card_data', 'card_data.csv');
    
    if (!fs.existsSync(csvPath)) {
      reject(new Error('卡牌数据文件不存在'));
      return;
    }
    
    // 使用 skipEmptyLines 和处理 BOM
    fs.createReadStream(csvPath, { encoding: 'utf8' })
      .pipe(csv({
        skipEmptyLines: true,
        skipLinesWithError: false
      }))
      .on('data', (row) => {
        // 清理 BOM 字符
        const cleanRow = cleanObjectKeys(row);
        
        // 获取卡牌编号
        const cardId = (cleanRow['卡牌编号'] || '').toString().trim().toLowerCase();
        
        // 跳过表头行或空行
        if (!cardId || cardId === 'card_id' || cardId === '卡牌编号' || cardId === '') {
          return;
        }
        
        // 解析其他字段
        const name = (cleanRow['名称'] || '').toString().trim();
        const series = (cleanRow['系列'] || '').toString().trim();
        const cost = parseInt(cleanRow['费用'] || '0', 10) || 0;
        const energy = (cleanRow['符能'] || '').toString().trim();
        const type = (cleanRow['种类'] || '').toString().trim();
        const power = parseInt(cleanRow['战力'] || '0', 10) || 0;
        const legend = (cleanRow['所属传奇'] || '').toString().trim();
        const rules = (cleanRow['规则'] || '').toString().trim();
        
        // 解析颜色
        const colorStr = (cleanRow['颜色'] || '').toString().trim();
        const colors = colorStr ? colorStr.split(',').map(c => c.trim()).filter(c => c) : [];
        
        // 存储卡牌数据
        cardDb[cardId] = {
          cardId: cardId,
          name: name,
          series: series,
          color: colors,
          cost: cost,
          energy: energy,
          type: type,
          power: power,
          legend: legend,
          rules: rules
        };
      })
      .on('end', () => {
        console.log(`成功加载 ${Object.keys(cardDb).length} 张卡牌`);
        resolve(cardDb);
      })
      .on('error', (error) => {
        console.error('CSV 解析错误:', error);
        reject(error);
      });
  });
}

// 从卡组JSON创建卡牌实例
function createCardFromDeck(deckCard, cardDatabase) {
  const cardId = deckCard.card_id.toLowerCase();
  const cardData = cardDatabase[cardId];
  
  if (!cardData) {
    console.warn(`卡牌 ${cardId} 不存在于数据库中`);
    return {
      cardId: cardId,
      card_id: deckCard.card_id, // 保留原始 card_id
      name: deckCard.card_name,
      card_name: deckCard.card_name, // 保留原始 card_name
      color: deckCard.color || [],
      cardType: deckCard.card_type,
      type: deckCard.card_type,
      legend: deckCard['所属传奇'] || '',
      // 使用卡组数据中的信息，如果没有则使用默认值
      cost: 0,
      energy: '',
      power: 0,
      rules: ''
    };
  }
  
  return {
    ...cardData,
    cardId: cardData.cardId || cardId, // 确保有 cardId
    card_id: deckCard.card_id, // 保留原始 card_id
    card_name: deckCard.card_name || cardData.name, // 保留原始 card_name
    cardType: deckCard.card_type || cardData.type,
    type: deckCard.card_type || cardData.type
  };
}

// 从卡组创建卡牌堆
function createDeckFromData(deckData, cardDatabase) {
  const deck = [];
  
  // 添加主牌堆卡牌
  if (deckData.cards) {
    deckData.cards.forEach(deckCard => {
      for (let i = 0; i < deckCard.num; i++) {
        const card = createCardFromDeck(deckCard, cardDatabase);
        deck.push({ ...card, instanceId: generateInstanceId() });
      }
    });
  }
  
  return deck;
}

// 从卡组创建符文堆
function createRuneDeckFromData(deckData, cardDatabase) {
  const runeDeck = [];
  
  if (deckData.runes) {
    deckData.runes.forEach(runeCard => {
      for (let i = 0; i < runeCard.num; i++) {
        const card = createCardFromDeck(runeCard, cardDatabase);
        runeDeck.push({ ...card, instanceId: generateInstanceId() });
      }
    });
  }
  
  return runeDeck;
}

// 生成卡牌实例ID
function generateInstanceId() {
  return 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 洗牌
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

module.exports = {
  loadCardDatabase,
  createCardFromDeck,
  createDeckFromData,
  createRuneDeckFromData,
  shuffle,
  generateInstanceId
};

