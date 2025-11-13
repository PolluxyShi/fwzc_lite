const { createDeckFromData, createRuneDeckFromData, createCardFromDeck, shuffle, generateInstanceId } = require('./cardLoader');

class GameState {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [];
    this.gameStarted = false;
    this.player1Deck = null;
    this.player2Deck = null;
    
    // 玩家1状态
    this.player1 = {
      id: 'player1',
      name: '',
      score: 0,
      hand: [],
      mainDeck: [],
      runeDeck: [],
      runeArea: [],
      graveyard: [],
      base: [],
      selectedHero: null,
      legend: null
    };
    
    // 玩家2状态
    this.player2 = {
      id: 'player2',
      name: '',
      score: 0,
      hand: [],
      mainDeck: [],
      runeDeck: [],
      runeArea: [],
      graveyard: [],
      base: [],
      selectedHero: null,
      legend: null
    };
    
    // 战场（两个公共战场区域）
    // 玩家1选择 battlefield1，玩家2选择 battlefield2
    this.battlefields = [
      {
        id: 'battlefield1',
        card: null,  // 玩家1从自己的卡组中选择的战场卡
        player1Units: [],
        player2Units: []
      },
      {
        id: 'battlefield2',
        card: null,  // 玩家2从自己的卡组中选择的战场卡
        player1Units: [],
        player2Units: []
      }
    ];
    
    // 待结算区域（法术）
    this.pendingSpells = [];
    
    // 玩家可用的战场和英雄（从卡组中）
    this.player1AvailableBattlefields = [];
    this.player2AvailableBattlefields = [];
    this.player1AvailableHeroes = [];
    this.player2AvailableHeroes = [];
  }
  
  addPlayer(playerId, playerName) {
    if (this.players.find(p => p.id === playerId)) {
      return;
    }
    
    this.players.push({ id: playerId, name: playerName });
    if (playerId === 'player1') {
      this.player1.name = playerName;
    } else if (playerId === 'player2') {
      this.player2.name = playerName;
    }
  }
  
  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
  }
  
  setPlayerDeck(playerId, deckData, cardDatabase) {
    const deck = createDeckFromData(deckData, cardDatabase);
    const runeDeck = createRuneDeckFromData(deckData, cardDatabase);
    // 使用 createCardFromDeck 创建传奇卡牌，确保包含完整的卡牌数据
    const legend = deckData.legend ? {
      ...createCardFromDeck(deckData.legend, cardDatabase),
      instanceId: generateInstanceId()
    } : null;
    
    // 提取战场和英雄
    const battlefields = [];
    const heroes = [];
    
    if (deckData.battlefield) {
      deckData.battlefield.forEach(bf => {
        const card = createCardFromDeck(bf, cardDatabase);
        battlefields.push({ ...card, instanceId: generateInstanceId() });
      });
    }
    
    // 统一处理所属传奇名称
    const normalizeLegendName = (name) => {
      if (!name || typeof name !== 'string') return '';
      return name.trim().toLowerCase();
    };
    const deckLegendNameRaw = deckData.legend
      ? (deckData.legend.legend_belongto ||
         deckData.legend.legend ||
         deckData.legend['所属传奇'] ||
         (deckData.legend.card_name ? deckData.legend.card_name.split('-')[0] : ''))
      : '';
    const deckLegendName = normalizeLegendName(deckLegendNameRaw);

    // 提取英雄单位（去重，只保留唯一的英雄，且匹配所属传奇）
    if (deckData.cards) {
      const heroIds = new Set();
      deckData.cards.forEach(cardData => {
        if (cardData.card_type === '英雄单位' && !heroIds.has(cardData.card_id)) {
          const heroLegendNameRaw = cardData.legend_belongto || cardData.legend || cardData['所属传奇'] || '';
          const heroLegendName = normalizeLegendName(heroLegendNameRaw);
          
          // 如果卡组传奇有明确归属，则只接受归属一致的英雄
          if (deckLegendName && heroLegendName && deckLegendName !== heroLegendName) {
            return;
          }
          
          heroIds.add(cardData.card_id);
          const card = createCardFromDeck(cardData, cardDatabase);
          heroes.push({
            ...card,
            legend_belongto: heroLegendNameRaw || card.legend || card.legend_belongto || '',
            legendBelongTo: heroLegendNameRaw || card.legend || card.legend_belongto || '',
            instanceId: generateInstanceId()
          });
        }
      });
    }
    
    if (playerId === 'player1') {
      this.player1Deck = deckData;
      this.player1.mainDeck = shuffle(deck);
      this.player1.runeDeck = shuffle(runeDeck);
      this.player1.legend = legend;
      this.player1AvailableBattlefields = battlefields;
      this.player1AvailableHeroes = heroes;
    } else if (playerId === 'player2') {
      this.player2Deck = deckData;
      this.player2.mainDeck = shuffle(deck);
      this.player2.runeDeck = shuffle(runeDeck);
      this.player2.legend = legend;
      this.player2AvailableBattlefields = battlefields;
      this.player2AvailableHeroes = heroes;
    }
  }
  
  selectBattlefield(playerId, battlefieldIndex, cardInstanceId) {
    const availableBattlefields = playerId === 'player1' ? this.player1AvailableBattlefields : this.player2AvailableBattlefields;
    
    if (battlefieldIndex < 0 || battlefieldIndex >= this.battlefields.length) {
      throw new Error('无效的战场索引');
    }
    
    // 玩家1只能选择 battlefield1，玩家2只能选择 battlefield2
    if (playerId === 'player1' && battlefieldIndex !== 0) {
      throw new Error('玩家1只能选择战场1');
    }
    if (playerId === 'player2' && battlefieldIndex !== 1) {
      throw new Error('玩家2只能选择战场2');
    }
    
    const battlefieldCard = availableBattlefields.find(bf => bf.instanceId === cardInstanceId);
    if (!battlefieldCard) {
      throw new Error('战场卡不存在');
    }
    
    // 设置对应战场的卡牌
    this.battlefields[battlefieldIndex].card = { ...battlefieldCard };
  }
  
  selectHero(playerId, cardInstanceId) {
    const player = playerId === 'player1' ? this.player1 : this.player2;
    const availableHeroes = playerId === 'player1' ? this.player1AvailableHeroes : this.player2AvailableHeroes;
    
    const heroCard = availableHeroes.find(h => h.instanceId === cardInstanceId);
    if (!heroCard) {
      throw new Error('英雄卡不存在');
    }
    
    player.selectedHero = { ...heroCard };
  }
  
  startGame() {
    if (this.gameStarted) return;
    
    // 在游戏开始前，将双方主牌堆中选定英雄卡牌的数目-1
    // 移除玩家1主牌堆中的一张选定英雄卡牌
    if (this.player1.selectedHero && this.player1.selectedHero.cardId) {
      const heroCardId = this.player1.selectedHero.cardId;
      const heroIndex = this.player1.mainDeck.findIndex(card => card.cardId === heroCardId);
      if (heroIndex !== -1) {
        this.player1.mainDeck.splice(heroIndex, 1);
      }
    }
    
    // 移除玩家2主牌堆中的一张选定英雄卡牌
    if (this.player2.selectedHero && this.player2.selectedHero.cardId) {
      const heroCardId = this.player2.selectedHero.cardId;
      const heroIndex = this.player2.mainDeck.findIndex(card => card.cardId === heroCardId);
      if (heroIndex !== -1) {
        this.player2.mainDeck.splice(heroIndex, 1);
      }
    }
    
    // 初始抽牌（抽4张）
    for (let i = 0; i < 4; i++) {
      if (this.player1.mainDeck.length > 0) {
        this.player1.hand.push(this.player1.mainDeck.pop());
      }
      if (this.player2.mainDeck.length > 0) {
        this.player2.hand.push(this.player2.mainDeck.pop());
      }
    }
    
    this.gameStarted = true;
  }
  
  handleAction(playerId, action, data) {
    const player = playerId === 'player1' ? this.player1 : this.player2;
    const opponent = playerId === 'player1' ? this.player2 : this.player1;
    
    switch (action) {
      case 'drawCard':
        if (player.mainDeck.length > 0) {
          player.hand.push(player.mainDeck.pop());
        }
        break;
        
      case 'playCard':
        this.playCard(playerId, data);
        break;
        
      case 'moveCard':
        this.moveCard(playerId, data);
        break;
        
      case 'discardCard':
        this.discardCard(playerId, data);
        break;
        
      case 'drawRune':
        if (player.runeDeck.length > 0) {
          const rune = player.runeDeck.pop();
          // 召出符文卡牌时令其处于竖置状态
          rune.tapped = false;
          player.runeArea.push(rune);
          // TODO：重排
          this.sortRuneArea(playerId)
        }
        break;
        
      case 'recycleRune':
        this.recycleRune(playerId, data);
        break;
        
      case 'tapCard':
        this.tapCard(playerId, data);
        break;
        
      case 'untapCard':
        this.untapCard(playerId, data);
        break;
        
      case 'untapAllCards':
        this.untapAllCards(playerId);
        break;
        
      case 'revealCard':
        this.revealCard(playerId, data);
        break;
        
      case 'shuffleMainDeck':
        player.mainDeck = shuffle(player.mainDeck);
        break;
        
      case 'shuffleRuneDeck':
        player.runeDeck = shuffle(player.runeDeck);
        break;
        
      case 'moveFromGraveyardToHand':
        this.moveFromGraveyardToHand(playerId, data);
        break;
        
      case 'moveFromGraveyardToDeckBottom':
        this.moveFromGraveyardToDeckBottom(playerId, data);
        break;
        
      case 'moveCardToDeckTop':
        this.moveCardToDeckTop(playerId, data);
        break;
        
      case 'moveCardToDeckBottom':
        this.moveCardToDeckBottom(playerId, data);
        break;
        
      case 'updateScore':
        player.score = Math.max(0, player.score + (data.delta || 0));
        break;
        
      case 'addModifier':
        this.addModifier(playerId, data);
        break;
        
      case 'removeModifier':
        this.removeModifier(playerId, data);
        break;
        
      case 'createToken':
        this.createToken(playerId, data);
        break;
        
      default:
        throw new Error(`未知操作: ${action}`);
    }
  }
  
  playCard(playerId, data) {
    const player = playerId === 'player1' ? this.player1 : this.player2;
    const { cardInstanceId, targetArea, visibleToOpponent } = data;
    
    // 从手牌中移除
    const cardIndex = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (cardIndex === -1) {
      throw new Error('卡牌不在手牌中');
    }
    
    const card = player.hand.splice(cardIndex, 1)[0];
    
    // 添加到目标区域
    switch (targetArea) {
      case 'battlefield1':
      case 'battlefield2':
        const battlefieldIndex = targetArea === 'battlefield1' ? 0 : 1;
        const battlefield = this.battlefields[battlefieldIndex];
        if (playerId === 'player1') {
          battlefield.player1Units.push({
            ...card,
            tapped: false,
            modifiers: [],
            visible: visibleToOpponent !== false
          });
        } else {
          battlefield.player2Units.push({
            ...card,
            tapped: false,
            modifiers: [],
            visible: visibleToOpponent !== false
          });
        }
        break;
        
      case 'base':
        player.base.push({
          ...card,
          tapped: false,
          visible: visibleToOpponent !== false
        });
        break;
        
      case 'graveyard':
        player.graveyard.push(card);
        break;
        
      case 'pendingSpells':
        this.pendingSpells.push({
          ...card,
          playerId: playerId,
          visible: visibleToOpponent !== false
        });
        break;
        
      default:
        throw new Error(`未知目标区域: ${targetArea}`);
    }
  }
  
  moveCard(playerId, data) {
    const { cardInstanceId, fromArea, toArea, fromIndex, toIndex } = data;
    const player = playerId === 'player1' ? this.player1 : this.player2;
    
    let card = null;
    const isUnitCard = (cardObj) => {
      if (!cardObj) return false;
      const type = cardObj.cardType || cardObj.card_type || cardObj.type || '';
      return typeof type === 'string' && type.includes('单位');
    };
    
    // 从源区域移除
    switch (fromArea) {
      case 'hand':
        const handIndex = fromIndex !== undefined ? fromIndex : player.hand.findIndex(c => c.instanceId === cardInstanceId);
        if (handIndex !== -1) {
          card = player.hand.splice(handIndex, 1)[0];
        }
        break;
      case 'graveyard':
        const graveIndex = fromIndex !== undefined ? fromIndex : player.graveyard.findIndex(c => c.instanceId === cardInstanceId);
        if (graveIndex !== -1) {
          card = player.graveyard.splice(graveIndex, 1)[0];
        }
        break;
      case 'mainDeck':
        const deckIndex = fromIndex !== undefined ? fromIndex : player.mainDeck.findIndex(c => c.instanceId === cardInstanceId);
        if (deckIndex !== -1) {
          card = player.mainDeck.splice(deckIndex, 1)[0];
        }
        break;
      case 'base':
        const baseIndex = fromIndex !== undefined ? fromIndex : player.base.findIndex(c => c.instanceId === cardInstanceId);
        if (baseIndex !== -1) {
          card = player.base.splice(baseIndex, 1)[0];
        }
        break;
      case 'battlefield1':
      case 'battlefield2':
        const bfIndex = fromArea === 'battlefield1' ? 0 : 1;
        const battlefield = this.battlefields[bfIndex];
        const units = playerId === 'player1' ? battlefield.player1Units : battlefield.player2Units;
        const unitIndex = fromIndex !== undefined ? fromIndex : units.findIndex(c => c.instanceId === cardInstanceId);
        if (unitIndex !== -1) {
          card = units.splice(unitIndex, 1)[0];
        }
        break;
      case 'hero':
        if (player.selectedHero && player.selectedHero.instanceId === cardInstanceId) {
          card = player.selectedHero;
          player.selectedHero = null;
        }
        break;
      case 'pendingSpells':
        const spellIndex = this.pendingSpells.findIndex(s => s.instanceId === cardInstanceId && s.playerId === playerId);
        if (spellIndex !== -1) {
          card = this.pendingSpells.splice(spellIndex, 1)[0];
        }
        break;
    }
    
    if (!card) {
      throw new Error('卡牌未找到');
    }
    
    // 添加到目标区域
    switch (toArea) {
      case 'hand':
        card.tapped = false;
        if (toIndex !== undefined) {
          player.hand.splice(toIndex, 0, card);
        } else {
          player.hand.push(card);
        }
        break;
      case 'graveyard':
        // 如果是指示物单位，不能移动到废牌堆
        if (card.isToken) {
          throw new Error('指示物单位不能进入废牌堆');
        }
        // 弃置时先重置卡牌状态：竖置、正面朝上
        card.tapped = false;
        card.visible = true;
        if (toIndex !== undefined) {
          player.graveyard.splice(toIndex, 0, card);
        } else {
          player.graveyard.push(card);
        }
        break;
      case 'mainDeckTop':
        player.mainDeck.push(card);
        break;
      case 'mainDeckBottom':
        player.mainDeck.unshift(card);
        break;
      case 'battlefield1':
      case 'battlefield2':
        const bfIndex = toArea === 'battlefield1' ? 0 : 1;
        const battlefield = this.battlefields[bfIndex];
        const units = playerId === 'player1' ? battlefield.player1Units : battlefield.player2Units;
        
        // 检查该战场中是否已有背面朝上的卡牌（待命牌）
        // 需要检查己方和对方的背面卡牌
        const myFaceDownCard = units.some(u => u.visible === false);
        const opponentUnits = playerId === 'player1' ? battlefield.player2Units : battlefield.player1Units;
        const opponentFaceDownCard = opponentUnits.some(u => u.visible === false);
        const hasFaceDownCard = myFaceDownCard || opponentFaceDownCard;
        
        if (hasFaceDownCard && data.visibleToOpponent === false) {
          throw new Error('该战场已有待命牌');
        }
        
        // 如果移动到战场且visibleToOpponent为false，设置卡牌为不可见
        if (data.visibleToOpponent === false) {
          card.visible = false;
        } else {
          card.visible = true;
        }

        if (isUnitCard(card)) {
          const shouldRemainUpright = fromArea === 'hand' && data.visibleToOpponent === false;
          card.tapped = shouldRemainUpright ? false : true;
        } else {
          card.tapped = card.tapped || false;
        }
        
        if (toIndex !== undefined) {
          units.splice(toIndex, 0, card);
        } else {
          units.push(card);
        }
        break;
      case 'base':
        // 移动到基地时默认正面朝上（visible = true）
        card.visible = true;
        if (isUnitCard(card)) {
          card.tapped = true;
        } else {
          card.tapped = card.tapped || false;
        }
        if (toIndex !== undefined) {
          player.base.splice(toIndex, 0, card);
        } else {
          player.base.push(card);
        }
        break;
      case 'hero':
        player.selectedHero = card;
        break;
      case 'pendingSpells':
        this.pendingSpells.push({
          ...card,
          playerId: playerId,
          visible: data.visibleToOpponent !== false
        });
        break;
      default:
        throw new Error(`未知目标区域: ${toArea}`);
    }
  }
  
  discardCard(playerId, data) {
    const { cardInstanceId, fromArea } = data;
    const player = playerId === 'player1' ? this.player1 : this.player2;
    
    let card = null;
    
    switch (fromArea) {
      case 'hand':
        const handIndex = player.hand.findIndex(c => c.instanceId === cardInstanceId);
        if (handIndex !== -1) {
          card = player.hand.splice(handIndex, 1)[0];
        }
        break;
      case 'base':
        const baseIndex = player.base.findIndex(c => c.instanceId === cardInstanceId);
        if (baseIndex !== -1) {
          card = player.base.splice(baseIndex, 1)[0];
        }
        break;
      case 'hero':
        if (player.selectedHero && player.selectedHero.instanceId === cardInstanceId) {
          card = player.selectedHero;
          player.selectedHero = null;
        }
        break;
      case 'pendingSpells':
        const spellIndex = this.pendingSpells.findIndex(s => s.instanceId === cardInstanceId && s.playerId === playerId);
        if (spellIndex !== -1) {
          card = this.pendingSpells.splice(spellIndex, 1)[0];
        }
        break;
      case 'battlefield1':
      case 'battlefield2':
        const bfIndex = fromArea === 'battlefield1' ? 0 : 1;
        const battlefield = this.battlefields[bfIndex];
        const units = playerId === 'player1' ? battlefield.player1Units : battlefield.player2Units;
        const unitIndex = units.findIndex(c => c.instanceId === cardInstanceId);
        if (unitIndex !== -1) {
          card = units.splice(unitIndex, 1)[0];
        }
        break;
    }
    
    if (card) {
      // 如果是指示物单位，直接删除，不进入废牌堆
      if (card.isToken) {
        // 指示物单位直接删除，不需要做任何操作
        return;
      }
      
      // 弃置时先重置卡牌状态：竖置、正面朝上
      card.tapped = false;
      card.visible = true;
      player.graveyard.push(card);
    }
  }
  
  recycleRune(playerId, data) {
    const player = playerId === 'player1' ? this.player1 : this.player2;
    const { runeIndex } = data;
    
    if (runeIndex >= 0 && runeIndex < player.runeArea.length) {
      const rune = player.runeArea.splice(runeIndex, 1)[0];
      player.runeDeck.unshift(rune); // 放到牌堆底
    }
  }
  
  tapCard(playerId, data) {
    const { cardInstanceId, area } = data;
    const card = this.findCard(playerId, cardInstanceId, area);
    if (card) {
      card.tapped = true;
      // TODO：重排
      const card_type = card.cardType || card.card_type || card.type || '';
      if (typeof card_type === 'string' && card_type === "符文"){
        this.sortRuneArea(playerId)
      }
    } else {
      throw new Error('卡牌未找到');
    }
  }
  
  untapCard(playerId, data) {
    const { cardInstanceId, area } = data;
    const card = this.findCard(playerId, cardInstanceId, area);
    if (card) {
      card.tapped = false;
      // TODO：重排
      const card_type = card.cardType || card.card_type || card.type || '';
      if (typeof card_type === 'string' && card_type === "符文"){
        this.sortRuneArea(playerId)
      }
    } else {
      throw new Error('卡牌未找到');
    }
  }
  
  untapAllCards(playerId) {
    const player = playerId === 'player1' ? this.player1 : this.player2;
    
    // 竖置手牌中的所有横置卡牌
    player.hand.forEach(card => {
      if (card.tapped) {
        card.tapped = false;
      }
    });
    
    // 竖置基地中的所有横置卡牌
    player.base.forEach(card => {
      if (card.tapped) {
        card.tapped = false;
      }
    });
    
    // 竖置英雄
    if (player.selectedHero && player.selectedHero.tapped) {
      player.selectedHero.tapped = false;
    }
    
    // 竖置传奇
    if (player.legend && player.legend.tapped) {
      player.legend.tapped = false;
    }
    
    // 竖置符文区域中的所有横置卡牌
    player.runeArea.forEach(card => {
      if (card.tapped) {
        card.tapped = false;
      }
    });
    // TODO:重排
    this.sortRuneArea(playerId)
    
    // 竖置战场中的所有横置卡牌
    this.battlefields.forEach(battlefield => {
      const units = playerId === 'player1' ? battlefield.player1Units : battlefield.player2Units;
      units.forEach(card => {
        if (card.tapped) {
          card.tapped = false;
        }
      });
    });
    
    // 竖置待结算法术中的所有横置卡牌
    this.pendingSpells.forEach(spell => {
      if (spell.playerId === playerId && spell.tapped) {
        spell.tapped = false;
      }
    });
  }
  
  revealCard(playerId, data) {
    const { cardInstanceId, area } = data;
    const card = this.findCard(playerId, cardInstanceId, area);
    if (card) {
      // 翻开卡牌，使其对双方都可见
      card.visible = true;
    } else {
      throw new Error('卡牌未找到');
    }
  }
  
  findCard(playerId, cardInstanceId, area) {
    const player = playerId === 'player1' ? this.player1 : this.player2;
    
    switch (area) {
      case 'hand':
        return player.hand.find(c => c.instanceId === cardInstanceId);
      case 'base':
        return player.base.find(c => c.instanceId === cardInstanceId);
      case 'hero':
        return player.selectedHero && player.selectedHero.instanceId === cardInstanceId ? player.selectedHero : null;
      case 'legend':
        return player.legend && player.legend.instanceId === cardInstanceId ? player.legend : null;
      case 'battlefield1':
        const bf1 = this.battlefields[0];
        const units1 = playerId === 'player1' ? bf1.player1Units : bf1.player2Units;
        return units1.find(c => c.instanceId === cardInstanceId);
      case 'battlefield2':
        const bf2 = this.battlefields[1];
        const units2 = playerId === 'player1' ? bf2.player1Units : bf2.player2Units;
        return units2.find(c => c.instanceId === cardInstanceId);
      case 'pendingSpells':
        return this.pendingSpells.find(s => s.instanceId === cardInstanceId && s.playerId === playerId);
      case 'rune':
      case 'runeArea':
        return player.runeArea.find(c => c.instanceId === cardInstanceId);
      default:
        return null;
    }
  }
  
  moveFromGraveyardToHand(playerId, data) {
    const player = playerId === 'player1' ? this.player1 : this.player2;
    const { cardInstanceId } = data;
    const index = player.graveyard.findIndex(c => c.instanceId === cardInstanceId);
    if (index !== -1) {
      player.hand.push(player.graveyard.splice(index, 1)[0]);
    }
  }
  
  moveFromGraveyardToDeckBottom(playerId, data) {
    const player = playerId === 'player1' ? this.player1 : this.player2;
    const { cardInstanceId } = data;
    const index = player.graveyard.findIndex(c => c.instanceId === cardInstanceId);
    if (index !== -1) {
      player.mainDeck.unshift(player.graveyard.splice(index, 1)[0]);
    }
  }
  
  moveCardToDeckTop(playerId, data) {
    const player = playerId === 'player1' ? this.player1 : this.player2;
    const { cardInstanceId, fromArea } = data;
    
    let card = null;
    if (fromArea === 'hand') {
      const index = player.hand.findIndex(c => c.instanceId === cardInstanceId);
      if (index !== -1) {
        card = player.hand.splice(index, 1)[0];
      }
    }
    
    if (card) {
      player.mainDeck.push(card);
    }
  }
  
  moveCardToDeckBottom(playerId, data) {
    const player = playerId === 'player1' ? this.player1 : this.player2;
    const { cardInstanceId, fromArea } = data;
    
    let card = null;
    if (fromArea === 'hand') {
      const index = player.hand.findIndex(c => c.instanceId === cardInstanceId);
      if (index !== -1) {
        card = player.hand.splice(index, 1)[0];
      }
    }
    
    if (card) {
      player.mainDeck.unshift(card);
    }
  }
  
  addModifier(playerId, data) {
    const { cardInstanceId, area, modifier } = data;
    const card = this.findCard(playerId, cardInstanceId, area);
    if (card) {
      if (!card.modifiers) {
        card.modifiers = [];
      }
      card.modifiers.push(modifier);
    }
  }
  
  removeModifier(playerId, data) {
    const { cardInstanceId, area, modifierIndex } = data;
    const card = this.findCard(playerId, cardInstanceId, area);
    if (card && card.modifiers && modifierIndex >= 0 && modifierIndex < card.modifiers.length) {
      card.modifiers.splice(modifierIndex, 1);
    }
  }
  
  createToken(playerId, data) {
    const player = playerId === 'player1' ? this.player1 : this.player2;
    const token = {
      instanceId: generateInstanceId(),
      cardId: data.tokenCardId || '',
      name: data.name || '指示物单位',
      cardType: '单位',
      type: '指示物单位',
      power: data.power || 1,
      cost: 0,
      isToken: true,
      visible: true,
      tapped: false,
      ...data
    };
    
    // 如果指定了目标区域，直接打出到该区域
    if (data.targetArea) {
      switch (data.targetArea) {
        case 'base':
          player.base.push(token);
          break;
        case 'battlefield1':
        case 'battlefield2':
          const bfIndex = data.targetArea === 'battlefield1' ? 0 : 1;
          const battlefield = this.battlefields[bfIndex];
          const units = playerId === 'player1' ? battlefield.player1Units : battlefield.player2Units;
          units.push(token);
          break;
        default:
          player.hand.push(token);
      }
    } else {
      // 如果没有指定目标区域，添加到手牌
      player.hand.push(token);
    }
  }

  sortRuneArea(playerId) {
    const player = playerId === 'player1' ? this.player1 : this.player2;

    // 定义颜色排序顺序
    const colorOrder = {
        '红色': 1,
        '蓝色': 2,
        '绿色': 3,
        '黄色': 4,
        '橙色': 5,
        '紫色': 6,
        '无色': 7
    };
    
    // 获取卡牌的第一个颜色用于排序
    const getCardColorOrder = (card) => {
        // const cardData = cardDatabase[card.cardId] || card;
        const colors = card.color || [];
        if (colors.length === 0) return 999; // 没有颜色的排在最后
        const firstColor = colors[0];
        return colorOrder[firstColor] || 999;
    };
    
    player.runeArea.sort((a, b) => {
        // 首先按横竖状态排序：竖置的（tapped=false）排在前面，横置的（tapped=true）排在后面
        if (a.tapped !== b.tapped) {
            return a.tapped ? 1 : -1;
        }
        
        // 横竖状态一致时，按颜色排序
        const colorOrderA = getCardColorOrder(a);
        const colorOrderB = getCardColorOrder(b);
        if (colorOrderA !== colorOrderB) {
            return colorOrderA - colorOrderB;
        }
        
        // 颜色也一致时，保持原有顺序
        return 0;
    });
  }
  
  getStateForPlayer(playerId) {
    const player = playerId === 'player1' ? this.player1 : this.player2;
    const opponent = playerId === 'player1' ? this.player2 : this.player1;
    
    return {
      roomId: this.roomId,
      gameStarted: this.gameStarted,
      players: this.players,
      player1Deck: this.player1Deck ? true : false,  // 只返回是否选择了卡组，不返回具体数据
      player2Deck: this.player2Deck ? true : false,
      me: {
        id: player.id,
        name: player.name,
        score: player.score,
        hand: player.hand,
        mainDeckCount: player.mainDeck.length,
        mainDeckTop: player.mainDeck.length > 0 ? [player.mainDeck[player.mainDeck.length - 1]] : [],
        runeDeckCount: player.runeDeck.length,
        runeArea: player.runeArea,
        graveyard: player.graveyard,
        base: player.base,
        selectedHero: player.selectedHero,
        legend: player.legend
      },
      opponent: {
        id: opponent.id,
        name: opponent.name,
        score: opponent.score,
        handCount: opponent.hand.length,
        mainDeckCount: opponent.mainDeck.length,
        mainDeckTop: opponent.mainDeck.length > 0 ? [opponent.mainDeck[opponent.mainDeck.length - 1]] : [],
        runeDeckCount: opponent.runeDeck.length,
        runeArea: opponent.runeArea.filter(r => r.visible !== false),
        graveyard: opponent.graveyard,
        base: opponent.base,  // 返回所有基地卡牌，包括背面卡牌（visible === false时显示背面）
        selectedHero: opponent.selectedHero,
        legend: opponent.legend
      },
      battlefields: this.battlefields.map(bf => ({
        id: bf.id,
        card: bf.card,  // 公共战场卡
        // 战场卡牌的可见性：如果卡牌是背面朝上（visible === false），双方都看到背面
        // 如果卡牌是正面朝上（visible === true），双方都看到正面
        player1Units: bf.player1Units.map(u => ({
          ...u,
          // 保持原有的 visible 状态，不强制设置为 true
          visible: u.visible
        })),
        player2Units: bf.player2Units.map(u => ({
          ...u,
          // 保持原有的 visible 状态，不强制设置为 true
          visible: u.visible
        }))
      })),
      availableBattlefields: playerId === 'player1' ? this.player1AvailableBattlefields : this.player2AvailableBattlefields,
      availableHeroes: playerId === 'player1' ? this.player1AvailableHeroes : this.player2AvailableHeroes,
      pendingSpells: this.pendingSpells.filter(s => 
        s.playerId === playerId || s.visible !== false
      )
    };
  }
}

module.exports = GameState;

