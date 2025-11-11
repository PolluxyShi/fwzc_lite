// WebSocket 连接
let ws = null;
let gameState = null;
let playerId = null;
let roomId = null;
let cardDatabase = {};

// 调试模式相关
let debugModeActive = false;
let debugModeStep = 0; // 0: 等待卡组选择, 1: 等待英雄选择, 2: 等待战场选择, 3: 完成

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadCardDatabase();
    loadTokenUnits(); // 加载指示物单位列表
});

// 初始化事件监听器
function initializeEventListeners() {
    // 大厅界面
    document.getElementById('createRoomBtn').addEventListener('click', (e) => {
        e.preventDefault();
        createRoom();
    });
    document.getElementById('joinRoomBtn').addEventListener('click', (e) => {
        e.preventDefault();
        joinRoom();
    });
    document.getElementById('debugModeBtn').addEventListener('click', (e) => {
        e.preventDefault();
        debugMode();
    });
    
    // 复制房间号按钮
    const copyRoomIdBtn = document.getElementById('copyRoomIdBtn');
    if (copyRoomIdBtn) {
        copyRoomIdBtn.addEventListener('click', () => {
            const roomId = document.getElementById('roomIdDisplay').textContent;
            copyToClipboard(roomId);
        });
    }
    
    const copyRoomIdInDeckBtn = document.getElementById('copyRoomIdInDeckBtn');
    if (copyRoomIdInDeckBtn) {
        copyRoomIdInDeckBtn.addEventListener('click', () => {
            const roomId = document.getElementById('roomIdDisplayInDeck').textContent;
            copyToClipboard(roomId);
        });
    }
    
    // 卡组选择
    document.getElementById('startGameBtn').addEventListener('click', startGame);
    
    // 游戏操作
    document.getElementById('drawCardBtn').addEventListener('click', () => sendAction('drawCard', {}));
    document.getElementById('drawRuneBtn').addEventListener('click', () => sendAction('drawRune', {}));
    document.getElementById('shuffleMainDeckBtn').addEventListener('click', () => sendAction('shuffleMainDeck', {}));
    document.getElementById('shuffleRuneDeckBtn').addEventListener('click', () => sendAction('shuffleRuneDeck', {}));
    document.getElementById('increaseScoreBtn').addEventListener('click', () => sendAction('updateScore', { delta: 1 }));
    document.getElementById('decreaseScoreBtn').addEventListener('click', () => sendAction('updateScore', { delta: -1 }));
    document.getElementById('viewGraveyardBtn').addEventListener('click', viewGraveyard);
    document.getElementById('viewOpponentGraveyardBtn').addEventListener('click', viewOpponentGraveyard);
    document.getElementById('viewDeckTopBtn').addEventListener('click', viewDeckTop);
    document.getElementById('createTokenBtn').addEventListener('click', createToken);
    document.getElementById('untapAllBtn').addEventListener('click', untapAllCards);
    
    // 模态框关闭
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
    
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    // 键盘快捷键：按d键从主牌堆抽牌
    document.addEventListener('keydown', (e) => {
        // 如果正在输入框中输入，不触发快捷键
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }
        
        // 按d键抽牌
        if (e.key === 'd' || e.key === 'D') {
            // 检查游戏是否已开始
            if (gameState && gameState.gameStarted) {
                sendAction('drawCard', {});
            }
        }
        
        // Ctrl+Shift+R: 重新加载CSS（不刷新页面，不断开WebSocket）
        if ((e.key === 'r' || e.key === 'R') && e.ctrlKey && e.shiftKey) {
            e.preventDefault();
            reloadCSS();
        }
    });
}

// 显示自动关闭的提示消息
function showAutoCloseToast(message, duration = 1000) {
    // 创建提示元素
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = '#4CAF50';
    toast.style.color = 'white';
    toast.style.padding = '15px 30px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    toast.style.zIndex = '10000';
    toast.style.fontSize = '16px';
    toast.style.fontWeight = 'bold';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 1秒后自动关闭
    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, duration);
}

// 复制到剪贴板
function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showAutoCloseToast('房间号已复制到剪贴板');
        }).catch(err => {
            console.error('复制失败:', err);
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

// 备用复制方法
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showAutoCloseToast('房间号已复制到剪贴板');
    } catch (err) {
        console.error('复制失败:', err);
        showAutoCloseToast('复制失败，请手动复制房间号: ' + text, 2000);
    }
    document.body.removeChild(textArea);
}

// 加载卡牌数据库
async function loadCardDatabase() {
    try {
        const response = await fetch('/api/cards');
        if (response.ok) {
            cardDatabase = await response.json();
            console.log('卡牌数据库加载完成，共', Object.keys(cardDatabase).length, '张卡牌');
        } else {
            console.error('加载卡牌数据库失败:', response.statusText);
        }
    } catch (error) {
        console.error('加载卡牌数据库失败:', error);
    }
}

// 创建房间
async function createRoom() {
    const playerName = document.getElementById('playerName').value || '玩家1';
    
    try {
        // 确保WebSocket连接已建立
        await connectWebSocket();
        
        // 连接建立后发送创建房间消息
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'createRoom',
                payload: { playerName }
            }));
            console.log('发送创建房间请求');
        } else {
            alert('WebSocket连接未建立，请重试');
        }
    } catch (error) {
        console.error('创建房间失败:', error);
        alert('连接失败，请刷新页面重试');
    }
}

// 加入房间
async function joinRoom(roomIdInput = null, playerName = null) {
    if (!roomIdInput) {
        roomIdInput = document.getElementById('joinRoomId').value;
    }
    if (!playerName) {
        playerName = document.getElementById('joinPlayerName').value || '玩家2';
    }
    
    // 确保 roomIdInput 是字符串类型
    if (roomIdInput && typeof roomIdInput !== 'string') {
        roomIdInput = String(roomIdInput);
    }
    
    // 去除空格
    if (roomIdInput) {
        roomIdInput = roomIdInput.trim();
    }
    
    if (!roomIdInput) {
        alert('请输入房间ID');
        return;
    }
    
    try {
        // 确保WebSocket连接已建立
        await connectWebSocket();
        
        // 连接建立后发送加入房间消息
        if (ws && ws.readyState === WebSocket.OPEN) {
            const payload = { 
                roomId: String(roomIdInput).trim(), 
                playerName: String(playerName || '玩家2') 
            };
            ws.send(JSON.stringify({
                type: 'joinRoom',
                payload: payload
            }));
        } else {
            alert('WebSocket连接未建立，请重试');
        }
    } catch (error) {
        console.error('加入房间失败:', error);
        alert('连接失败，请刷新页面重试');
    }
}

// 调试模式
async function debugMode() {
    try {
        debugModeActive = true;
        debugModeStep = 0;
        console.log('调试模式：搜索未开始的游戏对局...');
        
        // 1. 搜索未开始的游戏对局
        const response = await fetch('/api/findAvailableRoom');
        const result = await response.json();
        
        if (result.found && result.roomId) {
            // 找到未开始的游戏，加入
            console.log('找到未开始的游戏对局，房间ID:', result.roomId);
            const playerName = '调试玩家' + (result.playerCount === 0 ? '1' : '2');
            joinRoom(result.roomId, playerName);
        } else {
            // 没有找到，创建新游戏
            console.log('未找到未开始的游戏对局，创建新游戏...');
            const playerName = '调试玩家1';
            document.getElementById('playerName').value = playerName;
            createRoom();
        }
        
        // 等待WebSocket连接建立
        await new Promise((resolve) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                resolve();
            } else {
                const checkConnection = setInterval(() => {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        clearInterval(checkConnection);
                        resolve();
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(checkConnection);
                    resolve();
                }, 5000);
            }
        });
        
        // 等待进入卡组选择界面
        await new Promise((resolve) => {
            const checkDeckSelection = setInterval(() => {
                if (document.getElementById('deckSelection').style.display !== 'none') {
                    clearInterval(checkDeckSelection);
                    resolve();
                }
            }, 100);
            setTimeout(() => {
                clearInterval(checkDeckSelection);
                resolve();
            }, 5000);
        });
        
        // 等待卡组列表加载
        await new Promise((resolve) => {
            const checkDecksLoaded = setInterval(() => {
                const deckList = document.getElementById('deckList');
                if (deckList && deckList.children.length > 0) {
                    clearInterval(checkDecksLoaded);
                    resolve();
                }
            }, 100);
            setTimeout(() => {
                clearInterval(checkDecksLoaded);
                resolve();
            }, 5000);
        });
        
        // 2. 自动选择"光辉女郎-拉克丝"卡组（lux）
        console.log('自动选择卡组: lux');
        debugModeStep = 1;
        await selectDeck('lux');
        
        // 等待游戏状态更新（在continueDebugMode中继续）
    } catch (error) {
        console.error('调试模式失败:', error);
        debugModeActive = false;
        alert('调试模式失败: ' + error.message);
    }
}

// 继续调试模式的自动选择
function continueDebugMode() {
    if (!debugModeActive || !gameState) return;
    
    // 步骤1：选择英雄
    if (debugModeStep === 1 && gameState.availableHeroes && gameState.availableHeroes.length > 0) {
        const targetHero = gameState.availableHeroes.find(hero => {
            const cardId = (hero.cardId || hero.card_id || '').toLowerCase();
            const name = hero.name || hero.card_name || '';
            return cardId === 'ogs-014' || name.includes('冕卫之光');
        });
        
        if (targetHero) {
            console.log('调试模式：自动选择英雄:', targetHero.name || targetHero.cardId);
            selectHero(targetHero.instanceId);
            debugModeStep = 2;
            return;
        } else {
            console.warn('调试模式：未找到英雄"拉克丝-冕卫之光"');
        }
    }
    
    // 步骤2：选择战场
    if (debugModeStep === 2 && gameState.availableBattlefields && gameState.availableBattlefields.length > 0) {
        const targetBattlefield = gameState.availableBattlefields.find(bf => {
            const cardId = (bf.cardId || bf.card_id || '').toLowerCase();
            const name = bf.name || bf.card_name || '';
            return cardId === 'ogn-288' || name.includes('星尖峰');
        });
        
        if (targetBattlefield) {
            console.log('调试模式：自动选择战场:', targetBattlefield.name || targetBattlefield.cardId);
            const myBattlefieldIndex = playerId === 'player1' ? 0 : 1;
            selectBattlefield(myBattlefieldIndex, targetBattlefield.instanceId);
            debugModeStep = 3;
            debugModeActive = false;
            console.log('调试模式：自动选择完成');
            return;
        } else {
            console.warn('调试模式：未找到战场"星尖峰"');
        }
    }
}

// 连接 WebSocket
function connectWebSocket() {
    // 如果已有连接且处于打开状态，直接返回
    if (ws && ws.readyState === WebSocket.OPEN) {
        return Promise.resolve();
    }
    
    // 如果已有连接但处于连接中，等待连接完成
    if (ws && ws.readyState === WebSocket.CONNECTING) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('WebSocket连接超时'));
            }, 5000);
            
            const originalOnOpen = ws.onopen;
            const originalOnError = ws.onerror;
            
            ws.onopen = () => {
                clearTimeout(timeout);
                if (originalOnOpen) originalOnOpen();
                resolve();
            };
            
            ws.onerror = (error) => {
                clearTimeout(timeout);
                if (originalOnError) originalOnError(error);
                reject(error);
            };
        });
    }
    
    // 创建新连接
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    return new Promise((resolve, reject) => {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('WebSocket 连接已建立');
            resolve();
        };
        
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            handleMessage(message);
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket 错误:', error);
            reject(error);
        };
        
        ws.onclose = () => {
            console.log('WebSocket 连接关闭');
            // 连接关闭后，清空房间相关状态
            roomId = null;
            playerId = null;
        };
    });
}

// 处理消息
function handleMessage(message) {
    switch (message.type) {
        case 'roomCreated':
            roomId = message.payload.roomId;
            playerId = message.payload.playerId;
            // 在大厅显示房间号
            document.getElementById('roomIdDisplay').textContent = roomId;
            document.getElementById('roomInfo').style.display = 'block';
            // 在卡组选择界面也显示房间号
            document.getElementById('roomIdDisplayInDeck').textContent = roomId;
            document.getElementById('roomInfoInDeckSelection').style.display = 'block';
            loadDecks();
            break;
            
        case 'roomJoined':
            roomId = message.payload.roomId;
            playerId = message.payload.playerId;
            // 在卡组选择界面显示房间号
            document.getElementById('roomIdDisplayInDeck').textContent = roomId;
            document.getElementById('roomInfoInDeckSelection').style.display = 'block';
            // 更新状态文本：加入房间的玩家应该看到不同的提示
            const roomStatusTextInDeck = document.getElementById('roomStatusTextInDeck');
            if (roomStatusTextInDeck) {
                roomStatusTextInDeck.textContent = '已加入房间，等待房主开始游戏...';
            }
            // 如果还没有显示卡组选择界面，显示它
            if (document.getElementById('deckSelection').style.display === 'none') {
                document.getElementById('lobby').style.display = 'none';
                document.getElementById('deckSelection').style.display = 'block';
                loadDecks();
            }
            break;
            
        case 'playerJoined':
            // 当有玩家加入时，更新房间信息显示
            if (playerId === 'player1') {
                // 玩家1看到玩家2加入
                const roomStatusText = document.getElementById('roomStatusText');
                if (roomStatusText) {
                    roomStatusText.textContent = '玩家已加入，请选择卡组';
                }
                const roomStatusTextInDeck = document.getElementById('roomStatusTextInDeck');
                if (roomStatusTextInDeck) {
                    roomStatusTextInDeck.textContent = '玩家已加入，请选择卡组';
                }
            }
            break;
            
        case 'deckSelected':
            // 等待两个玩家都选择卡组
            // 检查是否可以开始游戏
            setTimeout(() => {
                if (gameState) {
                    checkCanStartGame();
                    // 如果调试模式激活，继续自动选择
                    if (debugModeActive && debugModeStep === 1) {
                        setTimeout(() => continueDebugMode(), 500);
                    }
                }
            }, 100);
            break;
            
        case 'gameStarted':
            document.getElementById('lobby').style.display = 'none';
            document.getElementById('deckSelection').style.display = 'none';
            document.getElementById('gameScreen').style.display = 'block';
            updateGameUI();
            break;
            
        case 'gameStateUpdate':
            gameState = message.payload;
            if (gameState.gameStarted) {
                updateGameUI();
            } else {
                // 游戏未开始，显示英雄和战场选择
                updateHeroAndBattlefieldSelection();
                // 检查是否可以开始游戏
                checkCanStartGame();
                
                // 如果调试模式激活，继续自动选择
                if (debugModeActive) {
                    continueDebugMode();
                }
            }
            break;
            
        case 'error':
            alert(message.payload.message);
            break;
    }
}

// 加载卡组列表
async function loadDecks() {
    try {
        const response = await fetch('/api/decks');
        if (!response.ok) {
            throw new Error(`加载卡组列表失败: ${response.status} ${response.statusText}`);
        }
        const decks = await response.json();
        
        const customDeckSelect = document.getElementById('customDeckSelect');
        const customDeckSelectOptions = document.getElementById('customDeckSelectOptions');
        const customDeckSelectText = document.getElementById('customDeckSelectText');
        const deckSelect = document.getElementById('deckSelect');
        
        // 清空现有选项
        customDeckSelectOptions.innerHTML = '';
        deckSelect.innerHTML = '<option value="">-- 请选择卡组 --</option>';
        
        if (decks.length === 0) {
            customDeckSelectText.textContent = '没有可用的卡组';
            customDeckSelect.classList.add('disabled');
            return;
        }
        
        // 填充自定义下拉列表和原生select（用于兼容性）
        decks.forEach(deck => {
            const deckName = deck.deck_name || deck.name || deck.id;
            
            // 添加到自定义下拉列表
            const option = document.createElement('div');
            option.className = 'custom-select-option';
            option.dataset.value = deck.id;
            option.textContent = deckName;
            option.addEventListener('click', () => {
                selectCustomDeck(deck.id, deckName);
            });
            customDeckSelectOptions.appendChild(option);
            
            // 添加到原生select（保持兼容性）
            const nativeOption = document.createElement('option');
            nativeOption.value = deck.id;
            nativeOption.textContent = deckName;
            deckSelect.appendChild(nativeOption);
        });
        
        // 移除旧的事件监听器（如果存在），避免重复绑定
        const trigger = customDeckSelect.querySelector('.custom-select-trigger');
        const newTrigger = trigger.cloneNode(true);
        trigger.parentNode.replaceChild(newTrigger, trigger);
        
        // 添加点击触发器事件
        customDeckSelect.querySelector('.custom-select-trigger').addEventListener('click', (e) => {
            e.stopPropagation();
            customDeckSelect.classList.toggle('open');
        });
        
        // 点击外部关闭下拉列表（使用事件委托，只绑定一次）
        if (!window.deckSelectClickHandler) {
            window.deckSelectClickHandler = (e) => {
                const customDeckSelect = document.getElementById('customDeckSelect');
                if (customDeckSelect && !customDeckSelect.contains(e.target)) {
                    customDeckSelect.classList.remove('open');
                }
            };
            document.addEventListener('click', window.deckSelectClickHandler);
        }
        
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('deckSelection').style.display = 'block';
        
        // 如果已经有房间ID，在卡组选择界面显示
        if (roomId) {
            document.getElementById('roomIdDisplayInDeck').textContent = roomId;
            document.getElementById('roomInfoInDeckSelection').style.display = 'block';
        }
    } catch (error) {
        console.error('加载卡组列表失败:', error);
        alert('加载卡组列表失败: ' + error.message);
    }
}

// 选择自定义下拉列表中的卡组
function selectCustomDeck(deckId, deckName) {
    const customDeckSelect = document.getElementById('customDeckSelect');
    const customDeckSelectText = document.getElementById('customDeckSelectText');
    const customDeckSelectOptions = document.getElementById('customDeckSelectOptions');
    
    // 更新显示文本
    customDeckSelectText.textContent = deckName;
    
    // 更新选中状态
    customDeckSelectOptions.querySelectorAll('.custom-select-option').forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.value === deckId) {
            option.classList.add('selected');
        }
    });
    
    // 更新原生select（保持兼容性）
    const deckSelect = document.getElementById('deckSelect');
    deckSelect.value = deckId;
    
    // 关闭下拉列表
    customDeckSelect.classList.remove('open');
    
    // 调用选择卡组函数
    selectDeck(deckId);
}

// 选择卡组
async function selectDeck(deckId) {
    try {
        console.log('选择卡组:', deckId);
        
        // 更新自定义下拉列表的显示（如果已经通过selectCustomDeck调用，这里不会重复更新）
        const customDeckSelectText = document.getElementById('customDeckSelectText');
        const customDeckSelectOptions = document.getElementById('customDeckSelectOptions');
        const deckSelect = document.getElementById('deckSelect');
        
        if (deckSelect && deckSelect.value !== deckId) {
            deckSelect.value = deckId;
            
            // 如果文本还没有更新，更新它
            const selectedOption = customDeckSelectOptions.querySelector(`[data-value="${deckId}"]`);
            if (selectedOption && customDeckSelectText) {
                customDeckSelectText.textContent = selectedOption.textContent;
                
                // 更新选中状态
                customDeckSelectOptions.querySelectorAll('.custom-select-option').forEach(option => {
                    option.classList.remove('selected');
                });
                selectedOption.classList.add('selected');
            }
        }
        
        const response = await fetch(`/api/deck/${deckId}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` };
            }
            throw new Error(errorData.error || `加载卡组失败: ${response.status} ${response.statusText}`);
        }
        
        const deckData = await response.json();
        console.log('卡组数据加载成功:', deckData);
        
        // 显示卡组详情
        const detailsDiv = document.getElementById('selectedDeckDetails');
        detailsDiv.innerHTML = `
            <p><strong>传奇:</strong> ${deckData.legend?.card_name || '无'}</p>
            <p><strong>符文:</strong> ${deckData.runes?.reduce((sum, r) => sum + r.num, 0) || 0} 张</p>
            <p><strong>主牌:</strong> ${deckData.cards?.reduce((sum, c) => sum + c.num, 0) || 0} 张</p>
        `;
        document.getElementById('selectedDeckInfo').style.display = 'block';
        
        // 检查 WebSocket 连接
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            alert('WebSocket 未连接，请重新加入房间');
            return;
        }
        
        // 发送选择卡组消息
        console.log('发送选择卡组消息:', deckId);
        ws.send(JSON.stringify({
            type: 'selectDeck',
            payload: { deckId }
        }));
        
        console.log('选择卡组消息已发送');
        // 等待游戏状态更新来显示英雄和战场选择
    } catch (error) {
        console.error('选择卡组失败:', error);
        alert('加载卡组失败: ' + (error.message || error));
    }
}

// 更新英雄和战场选择界面
function updateHeroAndBattlefieldSelection() {
    if (!gameState) return;
    
    const me = gameState.me;
    const availableHeroes = gameState.availableHeroes || [];
    const availableBattlefields = gameState.availableBattlefields || [];
    
    // 显示选择界面
    const selectionDiv = document.getElementById('heroAndBattlefieldSelection');
    selectionDiv.style.display = 'block';
    
    // 更新英雄选择
    const heroSelection = document.getElementById('heroSelection');
    const selectedHeroInfo = document.getElementById('selectedHeroInfo');
    heroSelection.innerHTML = '';
    selectedHeroInfo.textContent = '';
    
    if (availableHeroes.length > 0) {
        availableHeroes.forEach(hero => {
            const heroCard = createCardElement(hero, 'heroSelection', 0);
            
            // 如果这个英雄已经被选中，添加选中状态
            if (me.selectedHero && me.selectedHero.instanceId === hero.instanceId) {
                heroCard.classList.add('selected');
                selectedHeroInfo.textContent = `已选择英雄: ${hero.name || hero.cardId}`;
            }
            
            heroCard.addEventListener('click', () => {
                // 移除所有选中状态
                heroSelection.querySelectorAll('.card').forEach(card => {
                    card.classList.remove('selected');
                });
                // 添加当前选中状态
                heroCard.classList.add('selected');
                // 选择英雄
                selectHero(hero.instanceId);
                selectedHeroInfo.textContent = `已选择英雄: ${hero.name || hero.cardId}`;
            });
            
            heroSelection.appendChild(heroCard);
        });
    } else {
        heroSelection.innerHTML = '<p>没有可用的英雄</p>';
    }
    
    // 检查是否可以开始游戏
    checkCanStartGame();
    
    // 更新战场选择
    const battlefieldSelection = document.getElementById('battlefieldSelection');
    const selectedBattlefieldInfo = document.getElementById('selectedBattlefieldInfo');
    battlefieldSelection.innerHTML = '';
    selectedBattlefieldInfo.textContent = '';
    
    if (availableBattlefields.length > 0) {
        // 玩家1选择 battlefield1，玩家2选择 battlefield2
        const myBattlefieldIndex = playerId === 'player1' ? 0 : 1;
        const myBattlefield = gameState.battlefields[myBattlefieldIndex];
        const mySelectedCard = myBattlefield.card;
        
        // 显示可选的战场卡列表
        const title = document.createElement('p');
        title.textContent = playerId === 'player1' ? '选择战场1（从你的卡组中选择）' : '选择战场2（从你的卡组中选择）';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '10px';
        battlefieldSelection.appendChild(title);
        
        // 显示所有可选的战场卡
        availableBattlefields.forEach((battlefield, index) => {
            const bfCard = createCardElement(battlefield, 'battlefieldSelection', index);
            
            // 战场卡牌显示为横置（添加tapped类，让边框和图片都横置）
            // 注意：不需要单独旋转图片，因为tapped类会让整个卡牌旋转90度
            bfCard.classList.add('tapped');
            
            // 如果这个战场卡已经被选中，添加选中状态
            if (mySelectedCard && mySelectedCard.instanceId === battlefield.instanceId) {
                bfCard.classList.add('selected');
                selectedBattlefieldInfo.textContent = `已选择: ${battlefield.name || battlefield.cardId}`;
            }
            
            bfCard.addEventListener('click', () => {
                // 移除所有选中状态
                battlefieldSelection.querySelectorAll('.card').forEach(card => {
                    card.classList.remove('selected');
                });
                // 添加当前选中状态
                bfCard.classList.add('selected');
                // 选择战场（玩家1选择战场1，玩家2选择战场2）
                selectBattlefield(myBattlefieldIndex, battlefield.instanceId);
                selectedBattlefieldInfo.textContent = `已选择: ${battlefield.name || battlefield.cardId}`;
            });
            
            battlefieldSelection.appendChild(bfCard);
        });
        
        if (!mySelectedCard) {
            selectedBattlefieldInfo.textContent = '请从上方选择一个战场卡';
        }
    } else {
        battlefieldSelection.innerHTML = '<p>没有可用的战场</p>';
    }
    
    // 检查是否可以开始游戏
    checkCanStartGame();
}

// 检查是否可以开始游戏
function checkCanStartGame() {
    if (!gameState) return;
    
    const startBtn = document.getElementById('startGameBtn');
    if (!startBtn) return;
    
    // 只有房主（player1）可以开始游戏
    if (playerId !== 'player1') {
        startBtn.style.display = 'none';
        return;
    }
    
    // 检查条件：
    // 1. 两个玩家都在
    // 2. 两个玩家都选择了卡组
    // 3. 两个玩家都选择了英雄
    // 4. 两个玩家都选择了战场
    const hasPlayer1Deck = gameState.player1Deck === true;
    const hasPlayer2Deck = gameState.player2Deck === true;
    const hasPlayer1Hero = gameState.me && gameState.me.selectedHero;
    const hasPlayer2Hero = gameState.opponent && gameState.opponent.selectedHero;
    const hasBattlefield1 = gameState.battlefields && gameState.battlefields[0] && gameState.battlefields[0].card;
    const hasBattlefield2 = gameState.battlefields && gameState.battlefields[1] && gameState.battlefields[1].card;
    
    const canStart = 
        gameState.players.length >= 2 &&
        hasPlayer1Deck && 
        hasPlayer2Deck &&
        hasPlayer1Hero &&
        hasPlayer2Hero &&
        hasBattlefield1 &&
        hasBattlefield2;
    
    console.log('检查开始游戏条件:', {
        players: gameState.players.length,
        player1Deck: hasPlayer1Deck,
        player2Deck: hasPlayer2Deck,
        player1Hero: hasPlayer1Hero,
        player2Hero: hasPlayer2Hero,
        battlefield1: hasBattlefield1,
        battlefield2: hasBattlefield2,
        canStart
    });
    
    if (canStart) {
        startBtn.style.display = 'block';
    } else {
        startBtn.style.display = 'none';
    }
}

// 选择英雄
function selectHero(cardInstanceId) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('WebSocket 未连接，请重新加入房间');
        return;
    }
    console.log('选择英雄:', cardInstanceId);
    ws.send(JSON.stringify({
        type: 'selectHero',
        payload: { cardInstanceId }
    }));
    // 等待服务器响应后检查是否可以开始游戏
    setTimeout(() => {
        if (gameState) {
            checkCanStartGame();
        }
    }, 200);
}

// 选择战场
function selectBattlefield(battlefieldIndex, cardInstanceId) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('WebSocket 未连接，请重新加入房间');
        return;
    }
    console.log('选择战场:', battlefieldIndex, cardInstanceId);
    ws.send(JSON.stringify({
        type: 'selectBattlefield',
        payload: { battlefieldIndex, cardInstanceId }
    }));
    // 等待服务器响应后检查是否可以开始游戏
    setTimeout(() => {
        if (gameState) {
            checkCanStartGame();
        }
    }, 200);
}

// 开始游戏
function startGame() {
    ws.send(JSON.stringify({
        type: 'startGame',
        payload: {}
    }));
}

// 发送游戏操作
function sendAction(action, data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('未连接到服务器');
        return;
    }
    
    console.log('发送游戏操作:', action, data);
    
    ws.send(JSON.stringify({
        type: 'gameAction',
        payload: {
            action: action,
            data: data
        }
    }));
}

// 暴露到全局作用域，供 cardOperations.js 使用
window.sendAction = sendAction;
window.updateGameUI = updateGameUI;

console.log('game.js: sendAction 和 updateGameUI 已暴露到全局作用域');

// 更新游戏界面
function updateGameUI() {
    if (!gameState) return;
    
    const me = gameState.me;
    const opponent = gameState.opponent;
    
    // 更新玩家信息
    document.getElementById('myName').textContent = me.name;
    document.getElementById('myScore').textContent = me.score;
    document.getElementById('opponentName').textContent = opponent.name;
    document.getElementById('opponentScore').textContent = opponent.score;
    
    // 更新手牌数量
    document.getElementById('myHandCount').textContent = me.hand.length;
    document.getElementById('opponentHandCount').textContent = opponent.handCount;
    
    // 更新牌堆数量
    document.getElementById('myMainDeckCount').textContent = me.mainDeckCount;
    document.getElementById('opponentMainDeckCount').textContent = opponent.mainDeckCount;
    document.getElementById('myRuneDeckCount').textContent = me.runeDeckCount;
    document.getElementById('opponentRuneDeckCount').textContent = opponent.runeDeckCount;
    document.getElementById('myGraveyardCount').textContent = me.graveyard.length;
    document.getElementById('opponentGraveyardCount').textContent = opponent.graveyard ? opponent.graveyard.length : 0;
    
    // 更新传奇
    updateCardDisplay('myLegend', me.legend ? [me.legend] : [], 'legend');
    updateCardDisplay('opponentLegend', opponent.legend ? [opponent.legend] : [], 'legend');
    
    // 更新英雄
    updateCardDisplay('myHero', me.selectedHero ? [me.selectedHero] : [], 'hero');
    updateCardDisplay('opponentHero', opponent.selectedHero ? [opponent.selectedHero] : [], 'hero');
    
    // 更新符文区域
    updateCardDisplay('myRunes', me.runeArea, 'rune');
    updateCardDisplay('opponentRunes', opponent.runeArea, 'rune');
    
    // 更新基地
    updateCardDisplay('myBase', me.base, 'base');
    updateCardDisplay('opponentBase', opponent.base, 'base');
    
    // 更新手牌
    updateHandDisplay(me.hand);
    
    // 更新战场
    updateBattlefield('battlefield1', gameState.battlefields[0]);
    updateBattlefield('battlefield2', gameState.battlefields[1]);
    
    // 显示战场卡（两个公共战场）- 只显示"战场名称：战场规则"文字
    const bf1CardDisplay = document.getElementById('battlefield1-card-display');
    const bf2CardDisplay = document.getElementById('battlefield2-card-display');
    
    if (bf1CardDisplay) {
        bf1CardDisplay.innerHTML = '';
        const bf1 = gameState.battlefields[0];
        if (bf1.card) {
            const cardData = cardDatabase[bf1.card.cardId] || bf1.card;
            const battlefieldName = cardData.name || bf1.card.name || '未知战场';
            const battlefieldRules = cardData.rules || bf1.card.rules || '';
            const displayText = battlefieldRules 
                ? `${battlefieldName}：${battlefieldRules}`
                : battlefieldName;
            
            const textElement = document.createElement('div');
            textElement.style.cssText = 'padding: 10px; cursor: pointer; color: #333; font-size: 14px; line-height: 1.5; text-align: center; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9;';
            textElement.textContent = displayText;
            textElement.onclick = () => {
                // 点击查看详情
                showCardDetails(bf1.card, 'battlefield-card', 0);
            };
            textElement.onmouseenter = () => {
                textElement.style.backgroundColor = '#f0f0f0';
            };
            textElement.onmouseleave = () => {
                textElement.style.backgroundColor = '#f9f9f9';
            };
            bf1CardDisplay.appendChild(textElement);
        } else {
            bf1CardDisplay.innerHTML = '<div style="color: #999; font-size: 12px;">' + 
                (playerId === 'player1' ? '等待你选择战场' : '等待玩家1选择战场') + '</div>';
        }
    }
    
    if (bf2CardDisplay) {
        bf2CardDisplay.innerHTML = '';
        const bf2 = gameState.battlefields[1];
        if (bf2.card) {
            const cardData = cardDatabase[bf2.card.cardId] || bf2.card;
            const battlefieldName = cardData.name || bf2.card.name || '未知战场';
            const battlefieldRules = cardData.rules || bf2.card.rules || '';
            const displayText = battlefieldRules 
                ? `${battlefieldName}：${battlefieldRules}`
                : battlefieldName;
            
            const textElement = document.createElement('div');
            textElement.style.cssText = 'padding: 10px; cursor: pointer; color: #333; font-size: 14px; line-height: 1.5; text-align: center; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9;';
            textElement.textContent = displayText;
            textElement.onclick = () => {
                // 点击查看详情
                showCardDetails(bf2.card, 'battlefield-card', 1);
            };
            textElement.onmouseenter = () => {
                textElement.style.backgroundColor = '#f0f0f0';
            };
            textElement.onmouseleave = () => {
                textElement.style.backgroundColor = '#f9f9f9';
            };
            bf2CardDisplay.appendChild(textElement);
        } else {
            bf2CardDisplay.innerHTML = '<div style="color: #999; font-size: 12px;">' + 
                (playerId === 'player2' ? '等待你选择战场' : '等待玩家2选择战场') + '</div>';
        }
    }
    
    // 更新待结算法术
    updatePendingSpells(gameState.pendingSpells);
}

// 更新卡牌显示
function updateCardDisplay(containerId, cards, areaType = '') {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (!cards || cards.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #999; font-size: 12px;">空</div>';
        return;
    }
    
    // 如果容器ID以 'opponent' 开头，则在 areaType 前加上 'opponent-' 前缀
    const finalAreaType = containerId.startsWith('opponent') ? `opponent-${areaType}` : areaType;
    
    // 如果是符文区域，对卡牌进行排序：横置的排在竖置的后面，横竖状态一致时按颜色排序
    const isRuneArea = areaType === 'rune' || areaType === 'runeArea';
    let sortedCards = cards;
    if (isRuneArea) {
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
            const cardData = cardDatabase[card.cardId] || card;
            const colors = cardData.color || card.color || [];
            if (colors.length === 0) return 999; // 没有颜色的排在最后
            const firstColor = colors[0];
            return colorOrder[firstColor] || 999;
        };
        
        sortedCards = [...cards].sort((a, b) => {
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
    
    sortedCards.forEach((card, index) => {
        const cardElement = createCardElement(card, finalAreaType, index);
        container.appendChild(cardElement);
    });
}

// 创建卡牌元素
function createCardElement(card, areaType = '', index = 0) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    if (card.tapped) {
        cardDiv.classList.add('tapped');
    }
    
    // 判断是否是符文卡牌
    const isRune = areaType === 'rune' || areaType === 'runeArea' || areaType === 'opponent-rune' || areaType === 'opponent-runeArea';
    const isOpponentRune = areaType === 'opponent-rune' || areaType === 'opponent-runeArea';
    const isMyRune = (areaType === 'rune' || areaType === 'runeArea') && !isOpponentRune;
    
    // 如果是背面（不可见），显示卡牌背面图片
    if (card.visible === false && areaType !== 'hand') {
        cardDiv.className += ' card-back';
        // 显示卡牌背面图片
        cardDiv.innerHTML = `<img src="/card_data/images/back.png" alt="卡牌背面" class="card-image" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
        const cardData = cardDatabase[card.cardId] || card;
        const cardName = cardData.name || card.name || '未知卡牌';
        const cardPower = cardData.power || card.power || 0;
        let cardId = card.cardId || card.card_id || '';
        
        // 如果是符文卡牌
        if (isRune) {
            // 获取卡牌数据（用于显示名称）
            const cardDataForDisplay = cardDatabase[cardId?.toLowerCase()] || cardDatabase[cardId?.toUpperCase()] || card;
            const displayCardName = cardDataForDisplay.name || cardDataForDisplay.card_name || cardName || card.name || card.card_name || '未知卡牌';
            
            // 尝试加载卡牌图片（尝试小写和大写）
            let imageHtml = '';
            if (cardId) {
                const lowerPath = `/card_data/images/${cardId.toLowerCase()}.png`;
                const upperPath = `/card_data/images/${cardId.toUpperCase()}.png`;
                // 先尝试小写，失败则尝试大写
                imageHtml = `<img src="${lowerPath}" alt="${displayCardName}" class="card-image" onerror="this.onerror=null; this.src='${upperPath}'; this.onerror=function(){this.style.display='none'}">`;
            }
            
            if (isMyRune) {
                // 我方符文：使用图片展示，不用标注颜色和横竖状态
                cardDiv.classList.add('my-rune-card');
                cardDiv.innerHTML = `
                    ${imageHtml}
                    <div class="card-name">${displayCardName}</div>
                `;
            } else if (isOpponentRune) {
                // 对方符文：使用图片展示（与我方大小一致）
                cardDiv.classList.add('rune-card');
                cardDiv.innerHTML = `
                    ${imageHtml}
                `;
            } else {
                // 兼容旧代码：默认使用缩小图片
                cardDiv.classList.add('rune-card');
                cardDiv.innerHTML = `
                    ${imageHtml}
                `;
            }
        } else {
            // 普通卡牌显示
            // 获取卡牌数据（用于显示名称）
            const cardDataForDisplay = cardDatabase[cardId?.toLowerCase()] || cardDatabase[cardId?.toUpperCase()] || card;
            // 优先使用数据库中的名称，然后是卡牌本身的名称
            const displayCardName = cardDataForDisplay.name || cardDataForDisplay.card_name || cardName || card.name || card.card_name || '未知卡牌';
            
            // 尝试加载卡牌图片（尝试小写和大写）
            let imageHtml = '';
            if (cardId) {
                const lowerPath = `/card_data/images/${cardId.toLowerCase()}.png`;
                const upperPath = `/card_data/images/${cardId.toUpperCase()}.png`;
                // 先尝试小写，失败则尝试大写
                imageHtml = `<img src="${lowerPath}" alt="${displayCardName}" class="card-image" onerror="this.onerror=null; this.src='${upperPath}'; this.onerror=function(){this.style.display='none'}">`;
            }
            
            cardDiv.innerHTML = `
                ${imageHtml}
                <div class="card-name">${displayCardName}</div>
                ${cardPower > 0 ? `<div class="card-power">${cardPower}</div>` : ''}
            `;
            
            // 添加修饰符显示
            if (card.modifiers && card.modifiers.length > 0) {
                const modifiersDiv = document.createElement('div');
                modifiersDiv.className = 'card-modifiers';
                card.modifiers.forEach(mod => {
                    const modDiv = document.createElement('div');
                    modDiv.className = `modifier ${mod.type || 'positive'}`;
                    modDiv.textContent = `${mod.type === 'negative' ? '-' : mod.type === 'yellow' ? '' : '+'}${mod.value}`;
                    modifiersDiv.appendChild(modDiv);
                });
                cardDiv.appendChild(modifiersDiv);
            }
        }
    }
    
    // 添加点击事件
    cardDiv.addEventListener('click', () => handleCardClick(card, areaType, index));
    cardDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleCardRightClick(card, areaType, index);
    });
    
    return cardDiv;
}

// 更新手牌显示
function updateHandDisplay(hand) {
    const handContainer = document.getElementById('myHand');
    handContainer.innerHTML = '';
    
    if (!hand || hand.length === 0) {
        return;
    }
    
    hand.forEach((card, index) => {
        const cardElement = createCardElement(card, 'hand', index);
        handContainer.appendChild(cardElement);
    });
}

// 更新战场显示
function updateBattlefield(battlefieldId, battlefield) {
    const myUnitsContainer = document.getElementById(`${battlefieldId}-my`);
    const opponentUnitsContainer = document.getElementById(`${battlefieldId}-opponent`);
    
    myUnitsContainer.innerHTML = '';
    opponentUnitsContainer.innerHTML = '';
    
    const myPlayerId = playerId === 'player1' ? 'player1' : 'player2';
    const myUnits = myPlayerId === 'player1' ? battlefield.player1Units : battlefield.player2Units;
    const opponentUnits = myPlayerId === 'player1' ? battlefield.player2Units : battlefield.player1Units;
    
    myUnits.forEach((unit, index) => {
        // 使用 battlefieldId 作为 areaType（battlefield1 或 battlefield2），而不是 battlefield-battlefield1
        const unitElement = createCardElement(unit, battlefieldId, index);
        myUnitsContainer.appendChild(unitElement);
    });
    
    opponentUnits.forEach((unit, index) => {
        // 对手的单位使用 'opponent-' 前缀标识
        const unitElement = createCardElement(unit, `opponent-${battlefieldId}`, index);
        opponentUnitsContainer.appendChild(unitElement);
    });
}

// 更新待结算法术
function updatePendingSpells(spells) {
    const container = document.getElementById('pendingSpells');
    container.innerHTML = '';
    
    if (!spells || spells.length === 0) {
        return;
    }
    
    spells.forEach((spell, index) => {
        const spellElement = createCardElement(spell, 'pendingSpells', index);
        
        // 根据玩家ID设置边框颜色：绿色为己方，红色为对方
        if (spell.playerId === playerId) {
            // 己方：绿色边框
            spellElement.style.border = '3px solid #4CAF50';
        } else {
            // 对方：红色边框
            spellElement.style.border = '3px solid #f44336';
        }
        
        container.appendChild(spellElement);
    });
}

// 删除旧的游戏操作函数，使用cardOperations.js中的新函数
// 这些函数现在在cardOperations.js中定义

// 存储当前查看的卡牌信息
let currentCardContext = { card: null, areaType: '', index: 0 };

// 处理卡牌点击
function handleCardClick(card, areaType, index) {
    // 检查是否是对方的背面卡牌
    const isOpponentCard = areaType && areaType.startsWith('opponent-');
    if (isOpponentCard && card.visible === false) {
        // 对方玩家的背面卡牌，弹出提示并阻止查看
        alert('无权查看该卡牌');
        return;
    }
    
    // 保存上下文
    currentCardContext = { card, areaType, index };
    // 显示卡牌详情
    showCardDetails(card, areaType, index);
}

// 处理卡牌右键点击
function handleCardRightClick(card, areaType, index) {
    // 检查是否是对方的卡牌
    const isOpponentCard = areaType && areaType.startsWith('opponent-');
    if (isOpponentCard) {
        // 对方的卡牌不支持操作
        showAutoCloseToast('无法横置', 1000);
        return;
    }
    
    // 检查是否是背面卡牌
    if (card.visible === false) {
        // 背面卡牌不支持横置操作
        showAutoCloseToast('无法横置', 1000);
        return;
    }
    
    // 判断卡牌是否支持横置操作
    // 支持横置的区域：base, battlefield1, battlefield2, legend, rune, runeArea
    // 注意：hero 区域不支持横置操作
    const canTap = areaType === 'base' || 
                   areaType === 'battlefield1' || 
                   areaType === 'battlefield2' || 
                   areaType === 'legend' || 
                   areaType === 'rune' || 
                   areaType === 'runeArea';
    
    if (!canTap) {
        // 不支持横置操作，显示提示
        showAutoCloseToast('无法横置', 1000);
        return;
    }
    
    // 支持横置操作，切换横置/竖置状态
    const targetArea = areaType === 'rune' ? 'runeArea' : areaType;
    if (card.tapped) {
        // 当前是横置，切换为竖置
        untapCard(card.instanceId, targetArea);
    } else {
        // 当前是竖置，切换为横置
        tapCard(card.instanceId, targetArea);
    }
}

// 显示卡牌详情
function showCardDetails(card, areaType = '', index = 0) {
    const modal = document.getElementById('cardModal');
    const content = document.getElementById('cardModalContent');
    const actions = document.getElementById('cardModalActions');
    
    // 检查是否是对方的卡牌（areaType 以 'opponent-' 开头）
    const isOpponentCard = areaType && areaType.startsWith('opponent-');
    
    // 获取卡牌数据（提前获取，用于判断类型）
    // 对于传奇卡牌，需要从 cardDatabase 中查找，或者使用 card 本身的属性
    let cardData = null;
    if (card.cardId) {
        cardData = cardDatabase[card.cardId.toLowerCase()] || cardDatabase[card.cardId.toUpperCase()] || card;
    } else if (card.card_id) {
        cardData = cardDatabase[card.card_id.toLowerCase()] || cardDatabase[card.card_id.toUpperCase()] || card;
    } else {
        cardData = card;
    }
    
    // 获取卡牌名称，优先使用数据库中的名称，然后是卡牌本身的名称
    const cardName = cardData.name || cardData.card_name || card.name || card.card_name || '未知卡牌';
    // 获取卡牌类型，优先使用数据库中的类型，然后是卡牌本身的类型
    const cardType = cardData.type || cardData.card_type || card.cardType || card.card_type || '';
    
    // 如果是背面卡牌，且是对方的卡牌，显示背面图片
    // 如果是己方的背面卡牌，显示正常卡牌图片（己方可以查看详情）
    let imageHtml = '';
    if (card.visible === false && isOpponentCard) {
        // 对方的背面卡牌，显示背面图片
        imageHtml = `
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="/card_data/images/back.png" alt="卡牌背面" style="max-width: 200px; max-height: 280px; border: 2px solid #333; border-radius: 8px;">
            </div>
        `;
    } else {
        // 己方的背面卡牌或正面卡牌，显示正常卡牌图片
        let cardId = card.cardId || card.card_id || '';
        
        // 尝试加载卡牌图片
        if (cardId) {
            const lowerPath = `/card_data/images/${cardId.toLowerCase()}.png`;
            const upperPath = `/card_data/images/${cardId.toUpperCase()}.png`;
            
            // 检查是否是战场卡牌
            const isBattlefieldCard = cardType === '战场' || areaType === 'battlefield-card';
            const rotationStyle = isBattlefieldCard ? 'transform: rotate(90deg);' : '';
            
            imageHtml = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${lowerPath}" alt="${cardName}" style="max-width: 200px; max-height: 280px; border: 2px solid #333; border-radius: 8px; ${rotationStyle}" 
                         onerror="this.onerror=null; this.src='${upperPath}'; this.onerror=function(){this.style.display='none'}">
                </div>
            `;
        }
    }
    
    // 检查是否是传奇卡牌
    const isLegendCard = areaType === 'legend' || cardType === '传奇' || cardData.card_type === '传奇';
    
    // 构建详情内容
    let detailContent = `
        ${imageHtml}
        <h2>${cardName}</h2>
        <p><strong>类型:</strong> ${cardData.type || cardData.card_type || card.cardType || ''}</p>
    `;
    
    // 传奇卡牌不显示费用
    if (!isLegendCard) {
        detailContent += `<p><strong>费用:</strong> ${cardData.cost || 0}</p>`;
    }
    
    detailContent += `
        ${cardData.power ? `<p><strong>战力:</strong> ${cardData.power}</p>` : ''}
        ${cardData.color && cardData.color.length > 0 ? `<p><strong>颜色:</strong> ${cardData.color.join(', ')}</p>` : ''}
        ${cardData.energy ? `<p><strong>符能:</strong> ${cardData.energy}</p>` : ''}
        ${cardData.legend ? `<p><strong>所属传奇:</strong> ${cardData.legend}</p>` : ''}
        ${cardData.rules ? `<p><strong>规则:</strong> ${cardData.rules}</p>` : ''}
    `;
    
    content.innerHTML = detailContent;
    
    actions.innerHTML = '';
    
    if (isOpponentCard) {
        // 如果是对手的背面卡牌，显示"无法查看详情"
        if (card.visible === false) {
            actions.innerHTML = '<p style="color: #999;">无法查看详情（卡牌背面朝上）</p>';
        } else {
            // 对方的卡牌不需要提供操作按钮
            actions.innerHTML = '<p style="color: #999;">对方的卡牌不支持操作</p>';
        }
        modal.style.display = 'block';
        return;
    }
    
    // 如果是己方的背面卡牌，只提供"翻开卡牌"和"弃置"操作
    if (card.visible === false) {
        const revealButton = `<button onclick="revealCard('${card.instanceId}', '${areaType}')">翻开卡牌</button>`;
        actions.innerHTML = `
            ${revealButton}
            <button onclick="discardCard('${card.instanceId}', '${areaType}')">弃置</button>
        `;
        modal.style.display = 'block';
        return;
    }
    
    // 检查卡牌类型（cardType已在前面定义）
    const isBattlefieldCard = cardType === '战场' || areaType === 'battlefield-card';
    
    // 根据区域添加操作按钮
    if (isBattlefieldCard) {
        // 战场卡牌不支持任何操作，但可以查看详情（详情中会显示图片和信息）
        actions.innerHTML = '<p style="color: #999;">战场卡牌不支持操作</p>';
        // 详情中正常显示图片和信息（已经在上面处理了）
    } else if (areaType === 'hand') {
        // 手牌：只显示移动卡牌（包括打出）
        actions.innerHTML = `
            <button onclick="moveCard('${card.instanceId}', 'hand')">移动卡牌</button>
            <button onclick="moveCardToDeckTop('${card.instanceId}')">放到牌堆顶</button>
            <button onclick="moveCardToDeckBottom('${card.instanceId}')">放到牌堆底</button>
            <button onclick="discardCard('${card.instanceId}', 'hand')">弃置</button>
        `;
    } else if (areaType === 'hero') {
        // 英雄区域只支持移动操作
        actions.innerHTML = `
            <button onclick="moveCard('${card.instanceId}', '${areaType}')">移动卡牌</button>
        `;
    } else if (areaType === 'base') {
        const tapButton = card.tapped 
            ? `<button onclick="untapCard('${card.instanceId}', '${areaType}')">竖置</button>`
            : `<button onclick="tapCard('${card.instanceId}', '${areaType}')">横置</button>`;
        
        // 如果是基地中的背面卡牌，添加"翻开卡牌"按钮
        const revealButton = card.visible === false 
            ? `<button onclick="revealCard('${card.instanceId}', '${areaType}')">翻开卡牌</button>`
            : '';
        
        actions.innerHTML = `
            <button onclick="moveCard('${card.instanceId}', '${areaType}')">移动卡牌</button>
            ${tapButton}
            ${revealButton}
            <button onclick="discardCard('${card.instanceId}', '${areaType}')">弃置</button>
        `;
    } else if (areaType && (areaType === 'battlefield1' || areaType === 'battlefield2')) {
        // 战场上的单位
        const tapButton = card.tapped 
            ? `<button onclick="untapCard('${card.instanceId}', '${areaType}')">竖置</button>`
            : `<button onclick="tapCard('${card.instanceId}', '${areaType}')">横置</button>`;
        
        // 如果是战场中的背面卡牌，添加"翻开卡牌"按钮
        const revealButton = card.visible === false 
            ? `<button onclick="revealCard('${card.instanceId}', '${areaType}')">翻开卡牌</button>`
            : '';
        
        actions.innerHTML = `
            <button onclick="moveCard('${card.instanceId}', '${areaType}')">移动卡牌</button>
            ${tapButton}
            ${revealButton}
            <button onclick="discardCard('${card.instanceId}', '${areaType}')">弃置</button>
        `;
    } else if (areaType === 'legend') {
        // 传奇卡牌支持横置/竖置
        const tapButton = card.tapped 
            ? `<button onclick="untapCard('${card.instanceId}', 'legend')">竖置</button>`
            : `<button onclick="tapCard('${card.instanceId}', 'legend')">横置</button>`;
        actions.innerHTML = `
            ${tapButton}
        `;
    } else if (areaType === 'pendingSpells') {
        // 检查是否是对方的卡牌
        const isOpponentSpell = card.playerId && card.playerId !== playerId;
        if (isOpponentSpell) {
            // 对方打出的待结算区域卡牌，己方无权操作
            actions.innerHTML = '<p style="color: #999;">对方的卡牌不支持操作</p>';
        } else {
            // 己方的卡牌，可以操作
            actions.innerHTML = `
                <button onclick="moveCard('${card.instanceId}', 'pendingSpells')">移动卡牌</button>
                <button onclick="discardCard('${card.instanceId}', 'pendingSpells')">弃置</button>
            `;
        }
    } else if (areaType === 'rune') {
        // 符文卡牌支持横置/竖置和回收
        const tapButton = card.tapped 
            ? `<button onclick="untapCard('${card.instanceId}', 'runeArea')">竖置</button>`
            : `<button onclick="tapCard('${card.instanceId}', 'runeArea')">横置</button>`;
        actions.innerHTML = `
            ${tapButton}
            <button onclick="recycleRune(${index})">回收符文</button>
        `;
    } else if (areaType === 'graveyard') {
        actions.innerHTML = `
            <button onclick="moveCard('${card.instanceId}', 'graveyard')">移动卡牌</button>
        `;
    }
    
    modal.style.display = 'block';
}

// 显示卡牌菜单（右键菜单）
function showCardMenu(card, areaType, index, x, y) {
    // 简单的右键菜单实现
    const menu = document.createElement('div');
    menu.style.position = 'fixed';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.background = 'white';
    menu.style.border = '1px solid #ccc';
    menu.style.padding = '10px';
    menu.style.zIndex = '10000';
    menu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    
    // 添加菜单项
    const viewBtn = document.createElement('button');
    viewBtn.textContent = '查看详情';
    viewBtn.onclick = () => {
        showCardDetails(card);
        document.body.removeChild(menu);
    };
    menu.appendChild(viewBtn);
    
    document.body.appendChild(menu);
    
    // 点击其他地方关闭菜单
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            if (document.body.contains(menu)) {
                document.body.removeChild(menu);
            }
            document.removeEventListener('click', closeMenu);
        }, { once: true });
    }, 100);
}

// 游戏操作函数
function playCard(cardInstanceId) {
    // 使用按钮选择区域
    if (typeof window.showAreaSelectionModal !== 'undefined') {
        window.showAreaSelectionModal((targetArea) => {
            if (targetArea === 'hand' || targetArea === 'mainDeckTop' || targetArea === 'mainDeckBottom') {
                alert('不能打出手牌到该区域');
                return;
            }
            const visible = targetArea !== 'graveyard' ? confirm('让对方可见？') : false;
            sendAction('playCard', {
                cardInstanceId: cardInstanceId,
                targetArea: targetArea,
                visibleToOpponent: visible
            });
            document.getElementById('cardModal').style.display = 'none';
        }, '选择目标区域');
    } else {
        // 备用方案：使用prompt
        const targetArea = prompt('选择目标区域: battlefield1, battlefield2, base, graveyard, pendingSpells');
        if (targetArea) {
            const visible = confirm('让对方可见？');
            sendAction('playCard', {
                cardInstanceId: cardInstanceId,
                targetArea: targetArea,
                visibleToOpponent: visible
            });
            document.getElementById('cardModal').style.display = 'none';
        }
    }
}

function moveCardToDeckTop(cardInstanceId) {
    sendAction('moveCardToDeckTop', {
        cardInstanceId: cardInstanceId,
        fromArea: 'hand'
    });
    document.getElementById('cardModal').style.display = 'none';
}

function moveCardToDeckBottom(cardInstanceId) {
    sendAction('moveCardToDeckBottom', {
        cardInstanceId: cardInstanceId,
        fromArea: 'hand'
    });
    document.getElementById('cardModal').style.display = 'none';
}

function discardCard(cardInstanceId, fromArea) {
    // 使用 discardCard action，服务器端会判断是否是指示物单位
    // 如果是指示物单位，直接删除；否则移动到废牌堆
    sendAction('discardCard', {
        cardInstanceId: cardInstanceId,
        fromArea: fromArea
    });
    document.getElementById('cardModal').style.display = 'none';
    // 立即更新UI
    setTimeout(() => {
        if (gameState) {
            updateGameUI();
        }
    }, 100);
}

function tapCard(cardInstanceId, area) {
    sendAction('tapCard', {
        cardInstanceId: cardInstanceId,
        area: area
    });
    document.getElementById('cardModal').style.display = 'none';
    // 立即更新UI以显示横置状态
    setTimeout(() => {
        if (gameState) {
            updateGameUI();
        }
    }, 100);
}

function untapCard(cardInstanceId, area) {
    sendAction('untapCard', {
        cardInstanceId: cardInstanceId,
        area: area
    });
    document.getElementById('cardModal').style.display = 'none';
    // 立即更新UI以显示竖置状态
    setTimeout(() => {
        if (gameState) {
            updateGameUI();
        }
    }, 100);
}

function recycleRune(runeIndex) {
    sendAction('recycleRune', {
        runeIndex: runeIndex
    });
    document.getElementById('cardModal').style.display = 'none';
}

function viewGraveyard() {
    if (!gameState || !gameState.me) return;
    
    const modal = document.getElementById('graveyardModal');
    const content = document.getElementById('graveyardContent');
    const title = modal.querySelector('h3');
    content.innerHTML = '';
    
    title.textContent = `${gameState.me.name || '我'}的废牌堆`;
    
    if (!gameState.me.graveyard || gameState.me.graveyard.length === 0) {
        content.innerHTML = '<p style="text-align: center; color: #999;">废牌堆为空</p>';
    } else {
        gameState.me.graveyard.forEach(card => {
            const cardElement = createCardElement(card, 'graveyard');
            cardElement.style.width = '120px';
            cardElement.style.height = '168px';
            content.appendChild(cardElement);
        });
    }
    
    modal.style.display = 'block';
}

// 查看对手废牌堆
function viewOpponentGraveyard() {
    if (!gameState || !gameState.opponent) return;
    
    const modal = document.getElementById('graveyardModal');
    const content = document.getElementById('graveyardContent');
    const title = modal.querySelector('h3');
    content.innerHTML = '';
    
    title.textContent = `${gameState.opponent.name || '对手'}的废牌堆`;
    
    if (!gameState.opponent.graveyard || gameState.opponent.graveyard.length === 0) {
        content.innerHTML = '<p style="text-align: center; color: #999;">废牌堆为空</p>';
    } else {
        gameState.opponent.graveyard.forEach(card => {
            // 对手的废牌堆卡牌使用 'opponent-graveyard' 标识，不显示操作按钮
            const cardElement = createCardElement(card, 'opponent-graveyard');
            cardElement.style.width = '120px';
            cardElement.style.height = '168px';
            content.appendChild(cardElement);
        });
    }
    
    modal.style.display = 'block';
}

function viewDeckTop() {
    if (!gameState || !gameState.me) return;
    
    const modal = document.getElementById('deckTopModal');
    const content = document.getElementById('deckTopContent');
    content.innerHTML = '';
    
    if (gameState.me.mainDeckTop && gameState.me.mainDeckTop.length > 0) {
        gameState.me.mainDeckTop.forEach(card => {
            const cardElement = createCardElement(card, 'deckTop');
            cardElement.style.width = '120px';
            cardElement.style.height = '168px';
            content.appendChild(cardElement);
        });
    } else {
        content.innerHTML = '<p>牌堆为空</p>';
    }
    
    modal.style.display = 'block';
}

// 加载指示物单位列表
let tokenUnits = [];

async function loadTokenUnits() {
    try {
        const response = await fetch('/api/tokens');
        if (response.ok) {
            tokenUnits = await response.json();
            console.log('指示物单位加载完成，共', tokenUnits.length, '种');
        } else {
            console.error('加载指示物单位失败');
        }
    } catch (error) {
        console.error('加载指示物单位错误:', error);
    }
}

// 显示指示物单位选择对话框
function showTokenSelectionModal() {
    const modal = document.getElementById('tokenSelectionModal');
    const grid = document.getElementById('tokenSelectionGrid');
    
    grid.innerHTML = '';
    
    if (tokenUnits.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #999;">没有可用的指示物单位</p>';
        modal.style.display = 'block';
        return;
    }
    
    tokenUnits.forEach(token => {
        const tokenCard = document.createElement('div');
        tokenCard.className = 'card';
        tokenCard.style.cursor = 'pointer';
        tokenCard.style.textAlign = 'center';
        tokenCard.style.padding = '10px';
        tokenCard.style.border = '2px solid #ddd';
        tokenCard.style.borderRadius = '8px';
        tokenCard.style.transition = 'all 0.3s';
        
        tokenCard.onmouseenter = () => {
            tokenCard.style.borderColor = '#667eea';
            tokenCard.style.transform = 'scale(1.05)';
        };
        tokenCard.onmouseleave = () => {
            tokenCard.style.borderColor = '#ddd';
            tokenCard.style.transform = 'scale(1)';
        };
        
        const cardId = token.cardId || '';
        const lowerPath = `/card_data/images/${cardId.toLowerCase()}.png`;
        const upperPath = `/card_data/images/${cardId.toUpperCase()}.png`;
        
        tokenCard.innerHTML = `
            <img src="${lowerPath}" alt="${token.name}" 
                 style="max-width: 100%; height: auto; border-radius: 4px;"
                 onerror="this.onerror=null; this.src='${upperPath}'; this.onerror=function(){this.style.display='none'}">
            <div style="margin-top: 10px; font-weight: bold;">${token.name}</div>
            ${token.power ? `<div style="margin-top: 5px; color: #666;">战力: ${token.power}</div>` : ''}
        `;
        
        tokenCard.onclick = () => {
            modal.style.display = 'none';
            // 选择指示物单位后，选择打出位置
            selectTokenPlacement(token);
        };
        
        grid.appendChild(tokenCard);
    });
    
    // 关闭按钮
    modal.querySelector('.close').onclick = () => {
        modal.style.display = 'none';
    };
    
    modal.style.display = 'block';
}

// 选择指示物单位的打出位置
function selectTokenPlacement(token) {
    if (typeof window.showAreaSelectionModal === 'function') {
        // 只允许选择基地或战场
        const placementAreas = [
            { id: 'battlefield1', name: '战场 1' },
            { id: 'battlefield2', name: '战场 2' },
            { id: 'base', name: '基地' }
        ];
        
        const modal = document.getElementById('areaSelectionModal');
        const titleElement = modal.querySelector('h3');
        const buttonsContainer = document.getElementById('areaSelectionButtons');
        
        titleElement.textContent = '选择打出位置';
        buttonsContainer.innerHTML = '';
        
        placementAreas.forEach(area => {
            const button = document.createElement('button');
            button.textContent = area.name;
            button.style.padding = '15px';
            button.style.fontSize = '16px';
            button.onclick = () => {
                modal.style.display = 'none';
                // 创建指示物单位并打出到选定位置
                sendAction('createToken', {
                    tokenCardId: token.cardId,
                    name: token.name,
                    power: token.power || 1,
                    targetArea: area.id
                });
            };
            buttonsContainer.appendChild(button);
        });
        
        modal.querySelector('.close').onclick = () => {
            modal.style.display = 'none';
        };
        
        modal.style.display = 'block';
    } else {
        alert('区域选择功能未加载');
    }
}

function createToken() {
    if (tokenUnits.length === 0) {
        alert('指示物单位数据未加载，请稍后再试');
        return;
    }
    showTokenSelectionModal();
}

// 一键竖置所有横置卡牌
function untapAllCards() {
    sendAction('untapAllCards', {});
    // 立即更新UI
    setTimeout(() => {
        if (gameState) {
            updateGameUI();
        }
    }, 100);
}

// 重新加载CSS文件（不刷新页面，不断开WebSocket连接）
function reloadCSS() {
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(link => {
        const href = link.getAttribute('href');
        // 添加时间戳参数，强制浏览器重新加载
        const newHref = href.split('?')[0] + '?v=' + Date.now();
        link.setAttribute('href', newHref);
    });
    console.log('CSS已重新加载');
}

// 将函数暴露到全局作用域
window.playCard = playCard;
window.moveCardToDeckTop = moveCardToDeckTop;
window.moveCardToDeckBottom = moveCardToDeckBottom;
window.discardCard = discardCard;
window.tapCard = tapCard;
window.untapCard = untapCard;
window.recycleRune = recycleRune;
window.reloadCSS = reloadCSS;

