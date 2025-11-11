// 卡牌操作相关函数

// 存储当前操作的卡牌信息
let currentCardOperation = {
    card: null,
    fromArea: '',
    cardInstanceId: ''
};

// 显示区域选择对话框
function showAreaSelectionModal(callback, title = '选择目标区域') {
    const modal = document.getElementById('areaSelectionModal');
    const titleElement = modal.querySelector('h3');
    const buttonsContainer = document.getElementById('areaSelectionButtons');
    
    titleElement.textContent = title;
    buttonsContainer.innerHTML = '';
    
    const areas = [
        { id: 'battlefield1', name: '战场 1' },
        { id: 'battlefield2', name: '战场 2' },
        { id: 'base', name: '基地' },
        { id: 'hand', name: '手牌' },
        { id: 'pendingSpells', name: '待结算区域' }
    ];
    
    areas.forEach(area => {
        const button = document.createElement('button');
        button.textContent = area.name;
        button.style.padding = '15px';
        button.style.fontSize = '16px';
        button.onclick = () => {
            modal.style.display = 'none';
            callback(area.id);
        };
        buttonsContainer.appendChild(button);
    });
    
    // 关闭按钮
    modal.querySelector('.close').onclick = () => {
        modal.style.display = 'none';
    };
    
    modal.style.display = 'block';
}

// 移动卡牌（包括打出手牌）
function moveCard(cardInstanceId, fromArea) {
    console.log('moveCard 被调用:', cardInstanceId, fromArea);
    
    currentCardOperation = {
        card: null,
        fromArea: fromArea,
        cardInstanceId: cardInstanceId
    };
    
    // 检查 showAreaSelectionModal 是否可用
    if (typeof showAreaSelectionModal === 'undefined') {
        console.error('showAreaSelectionModal 未定义');
        alert('区域选择对话框未加载，请刷新页面');
        return;
    }
    
    showAreaSelectionModal((targetArea) => {
        console.log('选择了目标区域:', targetArea);
        
        // 从手牌移动到基地：默认正面朝上，无需询问
        // 从手牌移动到战场：询问是否向对方展示
        let visible = true; // 默认对方可见
        const isMovingToBattlefield = targetArea === 'battlefield1' || targetArea === 'battlefield2';
        
        if (fromArea === 'hand' && isMovingToBattlefield) {
            // 从手牌移动到战场时询问是否向对方展示
            showYesNoModal('是否向对方展示？', (result) => {
                visible = result;
                // 统一使用 moveCard 操作
                if (typeof window.sendAction === 'function') {
                    console.log('调用 sendAction:', 'moveCard', { cardInstanceId, fromArea, toArea: targetArea, visibleToOpponent: visible });
                    window.sendAction('moveCard', {
                        cardInstanceId: cardInstanceId,
                        fromArea: fromArea,
                        toArea: targetArea,
                        visibleToOpponent: visible
                    });
                } else {
                    console.error('sendAction 函数未定义，请确保 game.js 已加载');
                    alert('操作失败：sendAction 函数未定义');
                }
                
                const modal = document.getElementById('cardModal');
                if (modal) {
                    modal.style.display = 'none';
                }
            });
            return; // 等待用户选择后再继续
        } else if (fromArea === 'hand' && targetArea === 'base') {
            // 从手牌移动到基地：默认正面朝上（visible = true），无需询问
            visible = true;
        } else if (targetArea === 'hand') {
            visible = false; // 手牌不需要可见性设置
        }
        
        // 统一使用 moveCard 操作
        if (typeof window.sendAction === 'function') {
            console.log('调用 sendAction:', 'moveCard', { cardInstanceId, fromArea, toArea: targetArea, visibleToOpponent: visible });
            window.sendAction('moveCard', {
                cardInstanceId: cardInstanceId,
                fromArea: fromArea,
                toArea: targetArea,
                visibleToOpponent: visible
            });
        } else {
            console.error('sendAction 函数未定义，请确保 game.js 已加载');
            alert('操作失败：sendAction 函数未定义');
        }
        
        const modal = document.getElementById('cardModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }, '选择目标区域');
}

// 打出手牌（已废弃，使用 moveCard 代替）
function playCard(cardInstanceId) {
    // 直接调用 moveCard，因为打出就是移动的一种
    moveCard(cardInstanceId, 'hand');
}

// 弃置卡牌（移动到废牌堆，指示物单位直接删除）
function discardCard(cardInstanceId, fromArea) {
    if (typeof window.sendAction === 'function') {
        // 使用 discardCard action，服务器端会判断是否是指示物单位
        // 如果是指示物单位，直接删除；否则移动到废牌堆
        window.sendAction('discardCard', {
            cardInstanceId: cardInstanceId,
            fromArea: fromArea
        });
    } else {
        console.error('sendAction 函数未定义');
        alert('操作失败：sendAction 函数未定义');
    }
    document.getElementById('cardModal').style.display = 'none';
    // 立即更新UI
    setTimeout(() => {
        if (typeof gameState !== 'undefined' && gameState && typeof window.updateGameUI === 'function') {
            window.updateGameUI();
        }
    }, 100);
}

// 横置卡牌
function tapCard(cardInstanceId, area) {
    if (typeof window.sendAction === 'function') {
        window.sendAction('tapCard', {
            cardInstanceId: cardInstanceId,
            area: area
        });
    } else {
        console.error('sendAction 函数未定义');
        alert('操作失败：sendAction 函数未定义');
    }
    document.getElementById('cardModal').style.display = 'none';
    // 立即更新UI以显示横置状态
    setTimeout(() => {
        if (typeof gameState !== 'undefined' && gameState && typeof window.updateGameUI === 'function') {
            window.updateGameUI();
        }
    }, 100);
}

// 竖置卡牌
function untapCard(cardInstanceId, area) {
    if (typeof window.sendAction === 'function') {
        window.sendAction('untapCard', {
            cardInstanceId: cardInstanceId,
            area: area
        });
    } else {
        console.error('sendAction 函数未定义');
        alert('操作失败：sendAction 函数未定义');
    }
    document.getElementById('cardModal').style.display = 'none';
    // 立即更新UI以显示竖置状态
    setTimeout(() => {
        if (typeof gameState !== 'undefined' && gameState && typeof window.updateGameUI === 'function') {
            window.updateGameUI();
        }
    }, 100);
}

// 将卡牌放到牌堆顶
function moveCardToDeckTop(cardInstanceId) {
    if (typeof window.sendAction === 'function') {
        window.sendAction('moveCardToDeckTop', {
            cardInstanceId: cardInstanceId,
            fromArea: 'hand'
        });
    } else {
        console.error('sendAction 函数未定义');
        alert('操作失败：sendAction 函数未定义');
    }
    document.getElementById('cardModal').style.display = 'none';
}

// 将卡牌放到牌堆底
function moveCardToDeckBottom(cardInstanceId) {
    if (typeof window.sendAction === 'function') {
        window.sendAction('moveCardToDeckBottom', {
            cardInstanceId: cardInstanceId,
            fromArea: 'hand'
        });
    } else {
        console.error('sendAction 函数未定义');
        alert('操作失败：sendAction 函数未定义');
    }
    document.getElementById('cardModal').style.display = 'none';
}

// 回收符文
function recycleRune(runeIndex) {
    if (typeof window.sendAction === 'function') {
        window.sendAction('recycleRune', {
            runeIndex: runeIndex
        });
    } else {
        console.error('sendAction 函数未定义');
        alert('操作失败：sendAction 函数未定义');
    }
    document.getElementById('cardModal').style.display = 'none';
}

// 翻开卡牌（使背面卡牌变为可见）
function revealCard(cardInstanceId, area) {
    if (typeof window.sendAction === 'function') {
        window.sendAction('revealCard', {
            cardInstanceId: cardInstanceId,
            area: area
        });
    } else {
        console.error('sendAction 函数未定义');
        alert('操作失败：sendAction 函数未定义');
    }
    document.getElementById('cardModal').style.display = 'none';
    // 立即更新UI以显示翻开状态
    setTimeout(() => {
        if (typeof gameState !== 'undefined' && gameState && typeof window.updateGameUI === 'function') {
            window.updateGameUI();
        }
    }, 100);
}

// 显示是/否对话框
function showYesNoModal(message, callback) {
    const modal = document.getElementById('yesNoModal');
    const titleElement = document.getElementById('yesNoTitle');
    const messageElement = document.getElementById('yesNoMessage');
    const yesBtn = document.getElementById('yesBtn');
    const noBtn = document.getElementById('noBtn');
    const closeBtn = modal.querySelector('.close');
    
    titleElement.textContent = '确认';
    messageElement.textContent = message;
    
    // 清除之前的事件监听器
    const newYesBtn = yesBtn.cloneNode(true);
    const newNoBtn = noBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
    noBtn.parentNode.replaceChild(newNoBtn, noBtn);
    
    // 添加新的事件监听器
    newYesBtn.onclick = () => {
        modal.style.display = 'none';
        callback(true);
    };
    
    newNoBtn.onclick = () => {
        modal.style.display = 'none';
        callback(false);
    };
    
    closeBtn.onclick = () => {
        modal.style.display = 'none';
        callback(false); // 关闭时默认返回false
    };
    
    modal.style.display = 'block';
}

// 暴露到全局作用域
window.moveCard = moveCard;
window.playCard = playCard;
window.discardCard = discardCard;
window.tapCard = tapCard;
window.untapCard = untapCard;
window.moveCardToDeckTop = moveCardToDeckTop;
window.moveCardToDeckBottom = moveCardToDeckBottom;
window.recycleRune = recycleRune;
window.revealCard = revealCard;
window.showAreaSelectionModal = showAreaSelectionModal;
window.showYesNoModal = showYesNoModal;

console.log('cardOperations.js 已加载，函数已暴露到全局作用域');

