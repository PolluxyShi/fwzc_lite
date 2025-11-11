const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cardLoader = require('./utils/cardLoader');
const GameState = require('./utils/gameState');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 静态文件服务
app.use(express.static('public'));
app.use('/card_data', express.static('card_data'));

// 游戏房间
const games = new Map(); // roomId -> GameState
const players = new Map(); // ws -> { roomId, playerId }

// 加载卡牌数据
let cardDatabase = null;
cardLoader.loadCardDatabase().then(db => {
  cardDatabase = db;
  console.log('卡牌数据库加载完成，共', Object.keys(db).length, '张卡牌');
}).catch(err => {
  console.error('加载卡牌数据库失败:', err);
});

// API: 获取可用的卡组列表
app.get('/api/decks', (req, res) => {
  const decksDir = path.join(__dirname, 'decks');
  const files = fs.readdirSync(decksDir).filter(f => f.endsWith('.json'));
  const decks = files.map(file => {
    const data = JSON.parse(fs.readFileSync(path.join(decksDir, file), 'utf8'));
    return {
      id: file.replace('.json', ''),
      name: data.legend?.card_name || file.replace('.json', ''),
      deck_name: data.deck_name || file.replace('.json', ''),
      file: file
    };
  });
  res.json(decks);
});

// API: 获取卡组数据
app.get('/api/deck/:deckId', (req, res) => {
  try {
    const deckFile = path.join(__dirname, 'decks', `${req.params.deckId}.json`);
    console.log('请求卡组文件:', deckFile);
    
    if (!fs.existsSync(deckFile)) {
      console.error('卡组文件不存在:', deckFile);
      res.status(404).json({ error: `卡组不存在: ${req.params.deckId}` });
      return;
    }
    
    const deckData = JSON.parse(fs.readFileSync(deckFile, 'utf8'));
    console.log('卡组文件加载成功:', req.params.deckId);
    res.json(deckData);
  } catch (error) {
    console.error('加载卡组文件失败:', error);
    res.status(500).json({ error: `加载卡组失败: ${error.message}` });
  }
});

// API: 获取卡牌数据库
app.get('/api/cards', (req, res) => {
  if (cardDatabase) {
    res.json(cardDatabase);
  } else {
    res.status(503).json({ error: '卡牌数据库尚未加载' });
  }
});

// API: 获取指示物单位列表
app.get('/api/tokens', (req, res) => {
  if (!cardDatabase) {
    res.status(503).json({ error: '卡牌数据库尚未加载' });
    return;
  }
  
  // 从卡牌数据库中筛选出指示物单位（类型为"指示物单位"）
  const tokens = Object.values(cardDatabase).filter(card => 
    card.type === '指示物单位'
  );
  
  res.json(tokens);
});

// API: 搜索未开始的游戏对局
app.get('/api/findAvailableRoom', (req, res) => {
  // 查找未开始且未满员的游戏房间
  for (const [roomId, gameState] of games.entries()) {
    if (!gameState.gameStarted && gameState.players.length < 2) {
      res.json({ 
        found: true, 
        roomId: roomId,
        playerCount: gameState.players.length
      });
      return;
    }
  }
  res.json({ found: false });
});

// WebSocket 连接处理
wss.on('connection', (ws) => {
  console.log('新客户端连接');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      const { type, payload } = data;

      switch (type) {
        case 'createRoom':
          handleCreateRoom(ws, payload);
          break;
        case 'joinRoom':
          handleJoinRoom(ws, payload);
          break;
        case 'selectDeck':
          handleSelectDeck(ws, payload);
          break;
        case 'selectBattlefield':
          handleSelectBattlefield(ws, payload);
          break;
        case 'selectHero':
          handleSelectHero(ws, payload);
          break;
        case 'startGame':
          handleStartGame(ws, payload);
          break;
        case 'gameAction':
          handleGameAction(ws, payload);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        default:
          console.log('未知消息类型:', type);
      }
    } catch (error) {
      console.error('处理消息错误:', error);
      ws.send(JSON.stringify({ type: 'error', payload: { message: error.message } }));
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws);
  });
});

// 创建房间
function handleCreateRoom(ws, payload) {
  const roomId = uuidv4().substring(0, 8);
  const playerId = 'player1';
  
  const gameState = new GameState(roomId);
  gameState.addPlayer(playerId, payload.playerName || '玩家1');
  
  games.set(roomId, gameState);
  players.set(ws, { roomId, playerId });
  
  ws.send(JSON.stringify({
    type: 'roomCreated',
    payload: { roomId, playerId }
  }));
  
  console.log(`房间 ${roomId} 已创建，玩家 ${playerId} 加入`);
}

// 加入房间
function handleJoinRoom(ws, payload) {
  // 确保 payload 存在且是对象
  if (!payload || typeof payload !== 'object') {
    console.error('无效的payload:', payload);
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: '无效的请求数据' }
    }));
    return;
  }
  
  let roomId = payload.roomId;
  
  // 确保roomId是字符串并去除空格
  if (roomId == null) {
    console.error('roomId为空或未定义');
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: '房间ID不能为空' }
    }));
    return;
  }
  
  // 转换为字符串并清理
  const cleanRoomId = String(roomId).trim();
  
  if (!cleanRoomId) {
    console.error('清理后的roomId为空');
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: '房间ID不能为空' }
    }));
    return;
  }
  
  const gameState = games.get(cleanRoomId);
  
  if (!gameState) {
    console.log(`房间 ${cleanRoomId} 不存在`);
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: '房间不存在' }
    }));
    return;
  }
  
  if (gameState.players.length >= 2) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: '房间已满' }
    }));
    return;
  }
  
  const playerId = 'player2';
  gameState.addPlayer(playerId, payload.playerName || '玩家2');
  players.set(ws, { roomId: cleanRoomId, playerId });
  
  // 通知加入的玩家房间信息
  ws.send(JSON.stringify({
    type: 'roomJoined',
    payload: { roomId: cleanRoomId, playerId }
  }));
  
  // 通知所有玩家
  broadcastToRoom(cleanRoomId, {
    type: 'playerJoined',
    payload: { playerId, playerName: payload.playerName || '玩家2' }
  });
  
  // 发送当前游戏状态给新加入的玩家
  sendGameState(cleanRoomId);
  
  console.log(`玩家 ${playerId} 加入房间 ${cleanRoomId}`);
}

// 选择卡组
function handleSelectDeck(ws, payload) {
  const player = players.get(ws);
  if (!player) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: '玩家未加入房间' }
    }));
    return;
  }
  
  const gameState = games.get(player.roomId);
  if (!gameState) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: '游戏房间不存在' }
    }));
    return;
  }
  
  const { deckId } = payload;
  if (!deckId) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: '未指定卡组ID' }
    }));
    return;
  }
  
  const deckFile = path.join(__dirname, 'decks', `${deckId}.json`);
  
  if (!fs.existsSync(deckFile)) {
    console.error(`卡组文件不存在: ${deckFile}`);
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: `卡组文件不存在: ${deckId}` }
    }));
    return;
  }
  
  try {
    const deckData = JSON.parse(fs.readFileSync(deckFile, 'utf8'));
    
    if (!cardDatabase || Object.keys(cardDatabase).length === 0) {
      console.error('卡牌数据库未加载');
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: '卡牌数据库尚未加载，请稍后再试' }
      }));
      return;
    }
    
    gameState.setPlayerDeck(player.playerId, deckData, cardDatabase);
    
    // 通知房间内所有玩家
    broadcastToRoom(player.roomId, {
      type: 'deckSelected',
      payload: { playerId: player.playerId, deckId }
    });
    
    // 发送更新后的游戏状态（立即发送，以便显示英雄和战场选择）
    sendGameState(player.roomId);
    
    console.log(`玩家 ${player.playerId} 选择了卡组 ${deckId}`);
  } catch (error) {
    console.error('加载卡组失败:', error);
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: `加载卡组失败: ${error.message}` }
    }));
  }
}

// 选择战场
function handleSelectBattlefield(ws, payload) {
  const player = players.get(ws);
  if (!player) return;
  
  const gameState = games.get(player.roomId);
  if (!gameState) return;
  
  try {
    gameState.selectBattlefield(player.playerId, payload.battlefieldIndex, payload.cardInstanceId);
    sendGameState(player.roomId);
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: error.message }
    }));
  }
}

// 选择英雄
function handleSelectHero(ws, payload) {
  const player = players.get(ws);
  if (!player) return;
  
  const gameState = games.get(player.roomId);
  if (!gameState) return;
  
  try {
    gameState.selectHero(player.playerId, payload.cardInstanceId);
    sendGameState(player.roomId);
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: error.message }
    }));
  }
}

// 开始游戏
function handleStartGame(ws, payload) {
  const player = players.get(ws);
  if (!player) return;
  
  const gameState = games.get(player.roomId);
  if (!gameState) return;
  
  if (gameState.players.length < 2) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: '需要两名玩家才能开始游戏' }
    }));
    return;
  }
  
  // 检查两个玩家是否都选择了卡组
  if (!gameState.player1Deck || !gameState.player2Deck) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: '请等待所有玩家选择卡组' }
    }));
    return;
  }
  
  // 检查两个玩家是否都选择了英雄
  if (!gameState.player1.selectedHero || !gameState.player2.selectedHero) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: '请等待所有玩家选择英雄' }
    }));
    return;
  }
  
  // 检查两个玩家是否都选择了战场
  if (!gameState.battlefields[0].card || !gameState.battlefields[1].card) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: '请等待所有玩家选择战场' }
    }));
    return;
  }
  
  gameState.startGame();
  broadcastToRoom(player.roomId, {
    type: 'gameStarted',
    payload: {}
  });
  
  sendGameState(player.roomId);
  console.log(`房间 ${player.roomId} 游戏开始`);
}

// 处理游戏操作
function handleGameAction(ws, payload) {
  const player = players.get(ws);
  if (!player) return;
  
  const gameState = games.get(player.roomId);
  if (!gameState) return;
  
  if (!gameState.gameStarted) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: '游戏尚未开始' }
    }));
    return;
  }
  
  try {
    gameState.handleAction(player.playerId, payload.action, payload.data);
    sendGameState(player.roomId);
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: error.message }
    }));
  }
}

// 断开连接处理
function handleDisconnect(ws) {
  const player = players.get(ws);
  if (player) {
    const gameState = games.get(player.roomId);
    if (gameState) {
      gameState.removePlayer(player.playerId);
      broadcastToRoom(player.roomId, {
        type: 'playerDisconnected',
        payload: { playerId: player.playerId }
      });
      
      // 如果房间为空，删除房间
      if (gameState.players.length === 0) {
        games.delete(player.roomId);
        console.log(`房间 ${player.roomId} 已关闭`);
      }
    }
    players.delete(ws);
  }
  console.log('客户端断开连接');
}

// 向房间内所有玩家广播消息
function broadcastToRoom(roomId, message) {
  const gameState = games.get(roomId);
  if (!gameState) return;
  
  wss.clients.forEach(client => {
    const player = players.get(client);
    if (player && player.roomId === roomId && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// 发送游戏状态
function sendGameState(roomId) {
  const gameState = games.get(roomId);
  if (!gameState) return;
  
  wss.clients.forEach(client => {
    const player = players.get(client);
    if (player && player.roomId === roomId && client.readyState === WebSocket.OPEN) {
      const state = gameState.getStateForPlayer(player.playerId);
      client.send(JSON.stringify({
        type: 'gameStateUpdate',
        payload: state
      }));
    }
  });
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // 监听所有网络接口，允许局域网访问
server.listen(PORT, HOST, () => {
  console.log(`服务器运行在 http://${HOST}:${PORT}`);
  console.log(`局域网访问地址: http://${getLocalIP()}:${PORT}`);
});

// 获取本机局域网IP地址
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳过内部（即127.0.0.1）和非IPv4地址
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

