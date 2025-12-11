<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>塔羅日記 - 每日一抽</title>
    <!-- 載入 Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --tarot-red: #8B0000;
            --tarot-gold: #FFD700;
            --tarot-bg: #F5F5F5;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--tarot-bg);
        }

        .card-container {
            perspective: 1000px;
        }

        .tarot-card {
            width: 100%;
            height: 100%;
            transition: transform 0.6s;
            transform-style: preserve-3d;
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
            border-radius: 1rem;
        }

        .tarot-card.flipped {
            transform: rotateY(180deg);
        }

        .tarot-face {
            position: absolute;
            width: 100%;
            height: 100%;
            backface-visibility: hidden;
            border-radius: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            text-align: center;
            border: 4px solid var(--tarot-gold);
        }

        .tarot-back {
            background: linear-gradient(135deg, var(--tarot-red) 0%, #a0522d 100%);
            color: white;
            transform: rotateY(0deg);
        }

        .tarot-front {
            background-color: white;
            color: #333;
            transform: rotateY(180deg);
        }

        .card-reversed {
            transform: rotate(180deg);
        }

        .draw-button {
            transition: transform 0.1s, box-shadow 0.1s;
        }

        .draw-button:active {
            transform: scale(0.98);
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .spinner {
            border-top-color: var(--tarot-gold);
            border-left-color: var(--tarot-gold);
            border-bottom-color: var(--tarot-gold);
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body class="p-4 md:p-8 min-h-screen">

    <div class="max-w-4xl mx-auto">
        <header class="text-center mb-8">
            <h1 class="text-4xl font-extrabold text-gray-800 mb-2">🔮 塔羅日記：每日一抽 </h1>
            <p class="text-lg text-gray-600">紀錄今日的指引與啟示</p>
            <div id="user-info" class="text-sm text-gray-400 mt-2"></div>
        </header>

        <!-- 抽牌區 -->
        <div class="bg-white p-6 md:p-8 rounded-xl shadow-2xl mb-8">
            <div id="card-display" class="card-container w-48 h-80 md:w-64 md:h-96 mx-auto mb-6">
                <div id="tarot-card" class="tarot-card">
                    <!-- 卡牌背面 (初始狀態) -->
                    <div class="tarot-face tarot-back">
                        <span class="text-3xl font-bold">每日一抽</span>
                    </div>
                    <!-- 卡牌正面 (翻轉後顯示結果) -->
                    <div id="card-front" class="tarot-face tarot-front flex-col justify-start p-4">
                        <p class="text-2xl font-bold mb-2">抽牌結果</p>
                        <p class="text-sm text-gray-500">點擊 "開始抽牌" 來獲得指引</p>
                    </div>
                </div>
            </div>

            <div id="result-area" class="text-center mb-6 min-h-20">
                <h2 id="card-name" class="text-3xl font-extrabold text-gray-800 transition-opacity duration-300 opacity-0"></h2>
                <p id="card-orientation" class="text-lg font-semibold transition-opacity duration-300 opacity-0"></p>
                <p id="card-meaning" class="text-gray-700 mt-3 transition-opacity duration-300 opacity-0"></p>
            </div>

            <div class="text-center">
                <button id="draw-button" class="draw-button bg-red-800 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full shadow-lg text-lg focus:outline-none focus:ring-4 focus:ring-red-300 disabled:opacity-50" onclick="drawCard()">
                    開始抽牌
                </button>
                <div id="loading-spinner" class="hidden w-6 h-6 border-4 border-dashed rounded-full spinner mx-auto mt-4"></div>
                <p id="message" class="text-sm text-red-500 mt-2"></p>
            </div>
        </div>

        <!-- 抽牌歷史記錄 -->
        <div class="bg-white p-6 md:p-8 rounded-xl shadow-2xl">
            <h2 class="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">📜 抽牌歷史紀錄</h2>
            <div id="history-list" class="space-y-4">
                <p class="text-gray-500" id="initial-history-msg">正在載入歷史記錄...</p>
            </div>
        </div>
    </div>

    <!-- Firebase 腳本 -->
    <script type="module">
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, addDoc, onSnapshot, collection, query, orderBy, serverTimestamp, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // 設定 Firebase 日誌級別
        setLogLevel('Debug');

        // 全域變數初始化
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

        // UI 元素
        const drawButton = document.getElementById('draw-button');
        const tarotCard = document.getElementById('tarot-card');
        const cardFront = document.getElementById('card-front');
        const cardNameEl = document.getElementById('card-name');
        const cardOrientationEl = document.getElementById('card-orientation');
        const cardMeaningEl = document.getElementById('card-meaning');
        const historyListEl = document.getElementById('history-list');
        const loadingSpinner = document.getElementById('loading-spinner');
        const messageEl = document.getElementById('message');
        const userInfoEl = document.getElementById('user-info');
        const initialHistoryMsgEl = document.getElementById('initial-history-msg');

        // Firebase 實例
        let app = null;
        let db = null;
        let auth = null;
        let userId = null;
        let isAuthReady = false;

        // 塔羅牌資料 (大阿爾克那 Major Arcana)
        const MAJOR_ARCANA = [
            { index: 0, name: "愚者 (The Fool)", upright: "冒險、開始、天真、自由", reversed: "魯莽、分心、判斷錯誤、缺乏方向" },
            { index: 1, name: "魔術師 (The Magician)", upright: "創造力、行動、能力、實現", reversed: "操控、不安全感、未開發的潛能" },
            { index: 2, name: "女祭司 (The High Priestess)", upright: "直覺、神秘、潛意識、智慧", reversed: "隱藏的真相、壓抑的直覺、迷失" },
            { index: 3, name: "皇后 (The Empress)", upright: "豐饒、女性、美麗、自然", reversed: "缺乏、過度保護、依賴" },
            { index: 4, name: "皇帝 (The Emperor)", upright: "權威、結構、控制、父權", reversed: "暴君、僵化、權力濫用、無力" },
            { index: 5, name: "教皇 (The Hierophant)", upright: "傳統、精神指引、儀式、規範", reversed: "反叛、新方法、個人信仰" },
            { index: 6, name: "戀人 (The Lovers)", upright: "愛情、和諧、選擇、關係", reversed: "失衡、衝突、錯誤的選擇" },
            { index: 7, name: "戰車 (The Chariot)", upright: "決心、勝利、自律、方向", reversed: "缺乏控制、侵略性、失敗" },
            { index: 8, name: "力量 (Strength)", upright: "勇氣、慈悲、耐心、內在力量", reversed: "自卑、缺乏自信、脆弱" },
            { index: 9, name: "隱者 (The Hermit)", upright: "內省、孤獨、尋求真相、指引", reversed: "孤立、退縮、迷失方向" },
            { index: 10, name: "命運之輪 (Wheel of Fortune)", upright: "運氣、循環、改變、宿命", reversed: "壞運氣、中斷、抗拒改變" },
            { index: 11, name: "正義 (Justice)", upright: "公平、真相、法律、平衡", reversed: "不公、偏見、逃避責任" },
            { index: 12, name: "倒吊人 (The Hanged Man)", upright: "犧牲、新視角、暫停、放下", reversed: "停滯、不願犧牲、逃避" },
            { index: 13, name: "死神 (Death)", upright: "結束、轉變、淨化、新開始", reversed: "抗拒改變、停滯、重生困難" },
            { index: 14, name: "節制 (Temperance)", upright: "平衡、和諧、耐心、適度", reversed: "失衡、不協調、極端" },
            { index: 15, name: "惡魔 (The Devil)", upright: "誘惑、束縛、物質主義、成癮", reversed: "掙脫束縛、獨立、釋放" },
            { index: 16, name: "高塔 (The Tower)", upright: "突變、毀滅、混亂、覺醒", reversed: "恐懼改變、延遲的災難" },
            { index: 17, name: "星星 (The Star)", upright: "希望、靈感、平靜、指引", reversed: "缺乏希望、失望、迷失" },
            { index: 18, name: "月亮 (The Moon)", upright: "幻覺、直覺、焦慮、潛意識", reversed: "困惑解除、看清事實、恐懼釋放" },
            { index: 19, "name": "太陽 (The Sun)", upright: "成功、喜悅、活力、肯定", reversed: "暫時的陰影、缺乏活力、悲觀" },
            { index: 20, name: "審判 (Judgement)", upright: "覺醒、內省、審視、重生", reversed: "懷疑自我、逃避審判、停滯" },
            { index: 21, name: "世界 (The World)", upright: "完成、成就、旅行、圓滿", reversed: "未完成、缺乏成就感、停滯" },
        ];

        // --- 輔助函數：指數退避重試 ---
        const maxRetries = 5;
        const initialDelay = 1000;

        async function withRetry(fn, ...args) {
            for (let i = 0; i < maxRetries; i++) {
                try {
                    return await fn(...args);
                } catch (error) {
                    console.error(`Firebase operation failed (Attempt ${i + 1}/${maxRetries}):`, error);
                    if (i === maxRetries - 1) throw error;
                    const delay = initialDelay * Math.pow(2, i) + Math.random() * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // --- Firebase 初始化和認證 ---
        function initFirebase() {
            try {
                if (Object.keys(firebaseConfig).length === 0) {
                    messageEl.textContent = "錯誤：未提供 Firebase 配置。無法儲存日記。";
                    drawButton.disabled = true;
                    return;
                }
                app = initializeApp(firebaseConfig);
                db = getFirestore(app);
                auth = getAuth(app);

                // 認證狀態監聽
                onAuthStateChanged(auth, (user) => {
                    if (user) {
                        userId = user.uid;
                        userInfoEl.textContent = `使用者 ID: ${userId}`;
                        isAuthReady = true;
                        console.log("Firebase Auth Ready. User ID:", userId);
                        // 認證完成後，開始監聽歷史記錄
                        if (db) listenForHistory();
                    } else {
                        // 應由 signInWithCustomToken 或 signInAnonymously 處理，此處僅作備用
                        userId = null;
                        isAuthReady = true;
                    }
                    drawButton.disabled = false;
                });

                // 執行認證
                if (initialAuthToken) {
                    withRetry(signInWithCustomToken, auth, initialAuthToken)
                        .catch(err => {
                            console.error("Custom token sign-in failed, trying anonymous sign-in.", err);
                            withRetry(signInAnonymously, auth);
                        });
                } else {
                    withRetry(signInAnonymously, auth);
                }
            } catch (error) {
                console.error("Firebase Initialization Error:", error);
                messageEl.textContent = "Firebase 初始化失敗。";
                drawButton.disabled = true;
            }
        }
        
        // 初始化 Firebase
        initFirebase();

        // --- Firestore 數據操作 ---
        function getDiaryCollectionRef() {
            if (!db || !userId) {
                console.error("Firestore DB or User ID is not ready.");
                return null;
            }
            // 使用 private data path: /artifacts/{appId}/users/{userId}/{collectionName}
            return collection(db, `artifacts/${appId}/users/${userId}/tarot_diary`);
        }

        function listenForHistory() {
            const collectionRef = getDiaryCollectionRef();
            if (!collectionRef) return;

            // 建立查詢：按時間戳降序排列
            // 由於 firestore 限制，我們不在前端使用 orderBy，而是在 JavaScript 中排序
            // 但為了確保 onSnapshot 獲取數據，我們仍然調用它
            const q = query(collectionRef); 
            
            initialHistoryMsgEl.textContent = "尚無抽牌記錄。";
            
            // 實時監聽數據變化
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const history = [];
                snapshot.forEach(doc => {
                    // 將 Firestore 數據轉換為應用程序需要的格式
                    const data = doc.data();
                    history.push({ 
                        ...data, 
                        id: doc.id,
                        timestamp: data.timestamp ? data.timestamp.toDate() : new Date(), // 轉換為 Date 物件
                    });
                });

                // 由於 Firestore 的限制，我們在 JS 中進行降序排序
                history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                
                renderHistory(history);
            }, (error) => {
                console.error("Error listening to history:", error);
                historyListEl.innerHTML = `<p class="text-red-500">載入歷史記錄時發生錯誤。</p>`;
            });

            // 在應用程序銷毀時記得取消訂閱 (此處為單頁應用，保持監聽即可)
            // return unsubscribe;
        }

        function renderHistory(history) {
            historyListEl.innerHTML = ''; // 清空現有列表

            if (history.length === 0) {
                historyListEl.innerHTML = `<p class="text-gray-500">尚無抽牌記錄。請抽一張牌來開始您的日記。</p>`;
                return;
            }

            history.forEach(item => {
                const card = MAJOR_ARCANA.find(c => c.index === item.cardIndex);
                if (!card) return; // 避免資料損壞導致錯誤

                const orientationText = item.isReversed ? '逆位' : '正位';
                const orientationClass = item.isReversed ? 'text-red-600' : 'text-green-600';

                const dateDisplay = item.date || (item.timestamp ? item.timestamp.toLocaleString('zh-TW', {
                    year: 'numeric', month: 'numeric', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                }) : '未知日期');

                const meaning = item.isReversed ? card.reversed : card.upright;

                const cardHtml = `
                    <div class="bg-gray-50 p-4 rounded-lg shadow-sm border-l-4 border-red-800">
                        <div class="flex justify-between items-start mb-2">
                            <span class="text-xl font-bold text-gray-800">${item.cardName}</span>
                            <span class="text-sm text-gray-500">${dateDisplay}</span>
                        </div>
                        <p class="text-base font-semibold ${orientationClass}">${orientationText}</p>
                        <p class="text-gray-700 mt-1 text-sm">${meaning}</p>
                    </div>
                `;
                historyListEl.innerHTML += cardHtml;
            });
        }

        async function saveCardToDiary(cardData) {
            const collectionRef = getDiaryCollectionRef();
            if (!collectionRef) {
                messageEl.textContent = "無法儲存日記：Firebase 連接或用戶認證未準備好。";
                return;
            }

            const now = new Date();
            const document = {
                timestamp: serverTimestamp(),
                date: now.toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' }),
                cardIndex: cardData.index,
                isReversed: cardData.isReversed,
                cardName: cardData.name,
                meaning: cardData.meaning,
            };

            try {
                await withRetry(addDoc, collectionRef, document);
                messageEl.textContent = "抽牌記錄已成功儲存！";
            } catch (error) {
                console.error("Error writing document:", error);
                messageEl.textContent = "儲存記錄失敗，請檢查網路連接。";
            }
        }


        // --- 抽牌邏輯 ---

        function drawCardLogic() {
            // 1. 隨機選擇一張牌
            const randomIndex = Math.floor(Math.random() * MAJOR_ARCANA.length);
            const card = MAJOR_ARCANA[randomIndex];

            // 2. 決定正位 (Upright) 或逆位 (Reversed) - 50% 機率
            const isReversed = Math.random() < 0.5;

            // 3. 獲取對應的解釋
            const meaning = isReversed ? card.reversed : card.upright;

            return {
                index: card.index,
                name: card.name,
                isReversed: isReversed,
                meaning: meaning,
            };
        }

        function updateCardUI(cardData) {
            // 1. 重設 UI 狀態
            cardNameEl.classList.remove('opacity-100');
            cardOrientationEl.classList.remove('opacity-100');
            cardMeaningEl.classList.remove('opacity-100');
            tarotCard.classList.remove('flipped');
            cardFront.classList.remove('card-reversed');
            cardFront.innerHTML = `
                <p class="text-2xl font-bold mb-2">正在抽牌...</p>
                <div class="w-8 h-8 border-4 border-dashed rounded-full spinner"></div>
            `;

            // 等待動畫結束後更新內容並翻轉
            setTimeout(() => {
                // 2. 更新卡牌正面視覺
                cardFront.innerHTML = `
                    <div class="w-full h-full flex flex-col justify-center items-center p-4">
                        <span class="text-4xl mb-4 font-serif text-red-800">${cardData.index}</span>
                        <p class="text-xl font-bold">${cardData.name}</p>
                    </div>
                `;
                if (cardData.isReversed) {
                    cardFront.classList.add('card-reversed');
                }

                // 3. 翻轉卡牌
                tarotCard.classList.add('flipped');

                // 4. 更新結果區文字 (稍微延遲，讓翻轉動畫完成)
                setTimeout(() => {
                    cardNameEl.textContent = cardData.name;
                    cardOrientationEl.textContent = cardData.isReversed ? '【逆位】' : '【正位】';
                    cardOrientationEl.className = `text-lg font-semibold transition-opacity duration-300 opacity-100 ${cardData.isReversed ? 'text-red-600' : 'text-green-600'}`;
                    cardMeaningEl.textContent = cardData.meaning;
                    
                    // 讓文字漸顯
                    setTimeout(() => {
                        cardNameEl.classList.add('opacity-100');
                        cardOrientationEl.classList.add('opacity-100');
                        cardMeaningEl.classList.add('opacity-100');
                    }, 100);

                }, 800); // 略大於翻轉時間 (0.6s)
            }, 100); // 略微延遲，確保清除狀態被註冊
        }

        window.drawCard = async function() {
            if (!isAuthReady) {
                messageEl.textContent = "認證程序尚未完成，請稍候...";
                return;
            }

            // 禁用按鈕並顯示載入
            drawButton.disabled = true;
            drawButton.textContent = "正在抽牌...";
            loadingSpinner.classList.remove('hidden');
            messageEl.textContent = "";

            try {
                // 執行抽牌
                const result = drawCardLogic();

                // 更新 UI
                updateCardUI(result);

                // 儲存到日記 (Firestore)
                const cardDataForSave = {
                    index: result.index,
                    name: result.name,
                    isReversed: result.isReversed,
                    meaning: result.meaning,
                };
                await saveCardToDiary(cardDataForSave);

            } catch (error) {
                console.error("Draw or Save failed:", error);
                messageEl.textContent = "抽牌或儲存日記失敗。";
            } finally {
                // 重新啟用按鈕
                setTimeout(() => {
                    drawButton.disabled = false;
                    drawButton.textContent = "再抽一張";
                    loadingSpinner.classList.add('hidden');
                }, 1500); // 等待動畫完成後再啟用
            }
        }
        
        // 頁面載入時的初始狀態
        window.onload = function() {
            drawButton.disabled = true;
            // UI 的初始內容設定在 HTML 中
        };
    </script>
</body>
</html>