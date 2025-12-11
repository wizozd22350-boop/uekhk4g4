/* ==========================================
   塔羅日記 - 每日一抽 | 主應用程式
   ========================================== */

// 導入塔羅牌資料
import { MAJOR_ARCANA, getCardByIndex, drawRandomCard } from './tarot-data.js';

// Firebase SDK 導入
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    addDoc,
    onSnapshot,
    collection,
    query,
    orderBy,
    serverTimestamp,
    limit
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* ==========================================
   全域變數與配置
   ========================================== */

// Firebase 配置 (從外部注入或使用預設值)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'tarot-diary-app';
const firebaseConfig = typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined'
    ? __initial_auth_token
    : null;

// Firebase 實例
let app = null;
let db = null;
let auth = null;
let userId = null;
let isAuthReady = false;
let isFirebaseEnabled = false;

// 重試機制參數
const MAX_RETRIES = 5;
const INITIAL_DELAY = 1000;

// UI 元素快取
const elements = {
    drawButton: null,
    tarotCard: null,
    cardFront: null,
    cardNumber: null,
    cardNameDisplay: null,
    cardIcon: null,
    cardName: null,
    cardOrientation: null,
    cardMeaning: null,
    historyList: null,
    loadingSpinner: null,
    message: null,
    userInfo: null,
    initialHistoryMsg: null
};

/* ==========================================
   初始化
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    initializeStarsBackground();
    initFirebase();
});

/**
 * 初始化 UI 元素參考
 */
function initializeElements() {
    elements.drawButton = document.getElementById('draw-button');
    elements.tarotCard = document.getElementById('tarot-card');
    elements.cardFront = document.getElementById('card-front');
    elements.cardNumber = document.getElementById('card-number');
    elements.cardNameDisplay = document.getElementById('card-name-display');
    elements.cardIcon = document.getElementById('card-icon');
    elements.cardName = document.getElementById('card-name');
    elements.cardOrientation = document.getElementById('card-orientation');
    elements.cardMeaning = document.getElementById('card-meaning');
    elements.historyList = document.getElementById('history-list');
    elements.loadingSpinner = document.getElementById('loading-spinner');
    elements.message = document.getElementById('message');
    elements.userInfo = document.getElementById('user-info');
    elements.initialHistoryMsg = document.getElementById('initial-history-msg');

    // 初始狀態：按鈕禁用
    if (elements.drawButton) {
        elements.drawButton.disabled = true;
    }
}

/**
 * 初始化動態星空背景
 */
function initializeStarsBackground() {
    const starsContainer = document.getElementById('stars-bg');
    if (!starsContainer) return;

    // 創建額外的動態星星
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'dynamic-star';
        star.style.cssText = `
            position: absolute;
            width: ${Math.random() * 3 + 1}px;
            height: ${Math.random() * 3 + 1}px;
            background: ${Math.random() > 0.7 ? '#FFD700' : '#FFFFFF'};
            border-radius: 50%;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            opacity: ${Math.random() * 0.7 + 0.3};
            animation: twinkle ${Math.random() * 4 + 2}s ease-in-out infinite;
            animation-delay: ${Math.random() * 2}s;
        `;
        starsContainer.appendChild(star);
    }
}

/* ==========================================
   Firebase 初始化與認證
   ========================================== */

/**
 * 初始化 Firebase
 */
function initFirebase() {
    try {
        // 檢查是否有 Firebase 配置
        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
            console.log("Firebase 配置未提供，使用本地模式。");
            showMessage("本地模式：抽牌記錄將不會被儲存。", "info");
            isFirebaseEnabled = false;
            isAuthReady = true;
            enableDrawButton();
            showLocalHistory();
            return;
        }

        // 初始化 Firebase App
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        isFirebaseEnabled = true;

        // 設定認證狀態監聽器
        onAuthStateChanged(auth, handleAuthStateChange);

        // 執行認證
        performAuthentication();

    } catch (error) {
        console.error("Firebase 初始化錯誤:", error);
        showMessage("Firebase 初始化失敗，使用本地模式。", "error");
        isFirebaseEnabled = false;
        isAuthReady = true;
        enableDrawButton();
        showLocalHistory();
    }
}

/**
 * 處理認證狀態變化
 */
function handleAuthStateChange(user) {
    if (user) {
        userId = user.uid;
        if (elements.userInfo) {
            elements.userInfo.textContent = `使用者 ID: ${userId.substring(0, 8)}...`;
        }
        isAuthReady = true;
        console.log("Firebase Auth 準備完成。使用者 ID:", userId);

        // 認證完成後開始監聽歷史記錄
        if (db) {
            listenForHistory();
        }
    } else {
        userId = null;
        isAuthReady = true;
    }

    enableDrawButton();
}

/**
 * 執行認證流程
 */
async function performAuthentication() {
    try {
        if (initialAuthToken) {
            // 優先使用自訂 Token
            await withRetry(() => signInWithCustomToken(auth, initialAuthToken));
        } else {
            // 使用匿名登入
            await withRetry(() => signInAnonymously(auth));
        }
    } catch (error) {
        console.error("認證失敗:", error);

        // 如果自訂 Token 失敗，嘗試匿名登入
        if (initialAuthToken) {
            try {
                console.log("嘗試匿名登入...");
                await withRetry(() => signInAnonymously(auth));
            } catch (anonError) {
                console.error("匿名登入也失敗:", anonError);
                showMessage("認證失敗，請重新整理頁面。", "error");
            }
        }
    }
}

/**
 * 啟用抽牌按鈕
 */
function enableDrawButton() {
    if (elements.drawButton) {
        elements.drawButton.disabled = false;
    }
}

/* ==========================================
   Firestore 資料操作
   ========================================== */

/**
 * 獲取日記集合參考
 */
function getDiaryCollectionRef() {
    if (!db || !userId) {
        console.error("Firestore DB 或 User ID 未準備好。");
        return null;
    }
    // 使用私人資料路徑
    return collection(db, `artifacts/${appId}/users/${userId}/tarot_diary`);
}

/**
 * 監聽歷史記錄變化
 */
function listenForHistory() {
    const collectionRef = getDiaryCollectionRef();
    if (!collectionRef) {
        showLocalHistory();
        return;
    }

    // 建立查詢
    const q = query(collectionRef);

    // 更新初始訊息
    if (elements.initialHistoryMsg) {
        elements.initialHistoryMsg.textContent = "載入中...";
    }

    // 即時監聽資料變化
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const history = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            history.push({
                ...data,
                id: doc.id,
                timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
            });
        });

        // 按時間降序排序
        history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        renderHistory(history);

    }, (error) => {
        console.error("監聽歷史記錄錯誤:", error);
        showMessage("載入歷史記錄時發生錯誤。", "error");
        showLocalHistory();
    });

    // 儲存取消訂閱函數（如需要）
    window.unsubscribeHistory = unsubscribe;
}

/**
 * 顯示本地歷史（無 Firebase 時）
 */
function showLocalHistory() {
    if (elements.historyList) {
        elements.historyList.innerHTML = `
            <div class="history-empty">
                <div class="history-empty-icon">📜</div>
                <p>本地模式：歷史記錄僅在本次瀏覽有效</p>
            </div>
        `;
    }
}

/**
 * 渲染歷史記錄列表
 */
function renderHistory(history) {
    if (!elements.historyList) return;

    elements.historyList.innerHTML = '';

    if (history.length === 0) {
        elements.historyList.innerHTML = `
            <div class="history-empty">
                <div class="history-empty-icon">🔮</div>
                <p>尚無抽牌記錄</p>
                <p style="font-size: 0.85rem; margin-top: 0.5rem;">抽一張牌來開始你的靈性旅程吧！</p>
            </div>
        `;
        return;
    }

    history.forEach(item => {
        const card = getCardByIndex(item.cardIndex);
        if (!card) return;

        const orientationText = item.isReversed ? '逆位' : '正位';
        const orientationClass = item.isReversed ? 'reversed' : 'upright';

        const dateDisplay = item.date ||
            (item.timestamp ? item.timestamp.toLocaleString('zh-TW', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : '未知日期');

        const meaning = item.isReversed ? card.reversed : card.upright;

        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div class="history-header">
                <span class="history-card-name">${card.icon} ${item.cardName}</span>
                <span class="history-date">${dateDisplay}</span>
            </div>
            <p class="history-orientation ${orientationClass}">【${orientationText}】</p>
            <p class="history-meaning">${meaning}</p>
        `;

        elements.historyList.appendChild(historyItem);
    });
}

/**
 * 儲存抽牌結果到 Firestore
 */
async function saveCardToDiary(cardData) {
    if (!isFirebaseEnabled) {
        console.log("Firebase 未啟用，跳過儲存。");
        return true;
    }

    const collectionRef = getDiaryCollectionRef();
    if (!collectionRef) {
        showMessage("無法儲存：連接或認證未準備好。", "error");
        return false;
    }

    const now = new Date();
    const document = {
        timestamp: serverTimestamp(),
        date: now.toLocaleString('zh-TW', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        }),
        cardIndex: cardData.index,
        isReversed: cardData.isReversed,
        cardName: cardData.name,
        meaning: cardData.meaning
    };

    try {
        await withRetry(() => addDoc(collectionRef, document));
        showMessage("✨ 抽牌記錄已儲存！", "success");
        return true;
    } catch (error) {
        console.error("儲存文檔錯誤:", error);
        showMessage("儲存記錄失敗，請檢查網路連接。", "error");
        return false;
    }
}

/* ==========================================
   抽牌邏輯與 UI 更新
   ========================================== */

/**
 * 主抽牌函數 - 暴露給全域
 */
window.drawCard = async function () {
    if (!isAuthReady) {
        showMessage("認證程序尚未完成，請稍候...", "info");
        return;
    }

    // 禁用按鈕並顯示載入狀態
    setLoadingState(true);

    try {
        // 執行抽牌
        const result = drawRandomCard();

        // 更新 UI
        await updateCardUI(result);

        // 儲存到 Firestore
        await saveCardToDiary(result);

    } catch (error) {
        console.error("抽牌或儲存失敗:", error);
        showMessage("抽牌失敗，請重試。", "error");
    } finally {
        // 恢復按鈕狀態
        setTimeout(() => {
            setLoadingState(false);
            updateButtonText("再抽一張");
        }, 1500);
    }
};

/**
 * 設定載入狀態
 */
function setLoadingState(isLoading) {
    if (elements.drawButton) {
        elements.drawButton.disabled = isLoading;
        if (isLoading) {
            elements.drawButton.querySelector('.button-text').textContent = "抽牌中...";
        }
    }

    if (elements.loadingSpinner) {
        elements.loadingSpinner.classList.toggle('visible', isLoading);
    }

    if (elements.message && isLoading) {
        elements.message.textContent = "";
        elements.message.className = "message";
    }
}

/**
 * 更新按鈕文字
 */
function updateButtonText(text) {
    if (elements.drawButton) {
        const buttonText = elements.drawButton.querySelector('.button-text');
        if (buttonText) {
            buttonText.textContent = text;
        }
    }
}

/**
 * 更新卡牌 UI
 */
async function updateCardUI(cardData) {
    return new Promise((resolve) => {
        // 1. 重設狀態
        resetCardState();

        // 2. 短暫延遲後更新內容
        setTimeout(() => {
            // 更新卡牌正面內容
            if (elements.cardNumber) {
                elements.cardNumber.textContent = cardData.index;
            }
            if (elements.cardNameDisplay) {
                elements.cardNameDisplay.textContent = cardData.name;
            }
            if (elements.cardIcon) {
                elements.cardIcon.textContent = cardData.icon;
            }

            // 處理逆位
            if (elements.cardFront) {
                if (cardData.isReversed) {
                    elements.cardFront.classList.add('reversed');
                } else {
                    elements.cardFront.classList.remove('reversed');
                }
            }

            // 3. 翻轉卡牌
            if (elements.tarotCard) {
                elements.tarotCard.classList.add('flipped');
            }

            // 4. 延遲顯示結果文字
            setTimeout(() => {
                showResultText(cardData);
                resolve();
            }, 700);

        }, 100);
    });
}

/**
 * 重設卡牌狀態
 */
function resetCardState() {
    // 移除翻轉狀態
    if (elements.tarotCard) {
        elements.tarotCard.classList.remove('flipped');
    }

    // 移除逆位樣式
    if (elements.cardFront) {
        elements.cardFront.classList.remove('reversed');
    }

    // 隱藏結果文字
    if (elements.cardName) {
        elements.cardName.classList.remove('visible');
    }
    if (elements.cardOrientation) {
        elements.cardOrientation.classList.remove('visible');
    }
    if (elements.cardMeaning) {
        elements.cardMeaning.classList.remove('visible');
    }
}

/**
 * 顯示結果文字
 */
function showResultText(cardData) {
    // 更新牌名
    if (elements.cardName) {
        elements.cardName.textContent = cardData.name;
        elements.cardName.classList.add('visible');
    }

    // 更新正逆位
    if (elements.cardOrientation) {
        elements.cardOrientation.textContent = cardData.isReversed ? '【逆位】' : '【正位】';
        elements.cardOrientation.className = `card-orientation visible ${cardData.isReversed ? 'reversed' : 'upright'}`;
    }

    // 更新牌義
    if (elements.cardMeaning) {
        elements.cardMeaning.textContent = cardData.meaning;
        elements.cardMeaning.classList.add('visible');
    }
}

/**
 * 顯示訊息
 */
function showMessage(text, type = "info") {
    if (elements.message) {
        elements.message.textContent = text;
        elements.message.className = `message ${type}`;
    }
}

/* ==========================================
   工具函數
   ========================================== */

/**
 * 指數退避重試機制
 */
async function withRetry(fn, maxRetries = MAX_RETRIES) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            console.error(`操作失敗 (嘗試 ${i + 1}/${maxRetries}):`, error);

            if (i === maxRetries - 1) {
                throw error;
            }

            // 計算延遲時間（指數退避 + 隨機抖動）
            const delay = INITIAL_DELAY * Math.pow(2, i) + Math.random() * 1000;
            await sleep(delay);
        }
    }
}

/**
 * 延遲函數
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 導出給測試使用
export {
    drawRandomCard as drawCardLogic,
    initFirebase,
    MAJOR_ARCANA
};
