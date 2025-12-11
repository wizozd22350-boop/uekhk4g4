# 塔羅日記 - 每日一抽 專案實現計劃

## 📋 專案概述

**專案名稱**：塔羅日記 - 每日一抽 (Tarot Diary - Daily Draw)

**專案描述**：一個提供使用者每日抽取塔羅牌並記錄抽牌結果的網頁應用程式。使用者可以抽取大阿爾克那牌組中的任意一張牌，獲得正位或逆位的解讀，並將結果儲存至 Firebase 進行長期記錄追蹤。

---

## 🎯 核心功能需求

### 1. 每日抽牌功能
| 功能項目 | 說明 |
|---------|------|
| 抽牌機制 | 從 22 張大阿爾克那牌中隨機抽取一張 |
| 正逆位判定 | 50% 機率決定正位或逆位 |
| 牌義顯示 | 根據正/逆位顯示對應的解讀文字 |
| 翻牌動畫 | 3D 翻轉動畫效果 (Y 軸旋轉 180 度) |

### 2. 用戶認證系統
| 功能項目 | 說明 |
|---------|------|
| 匿名登入 | 支援 Firebase 匿名認證 |
| 自訂 Token 登入 | 支援 Custom Token 認證方式 |
| 認證狀態監聽 | 即時監控用戶登入狀態變化 |

### 3. 歷史記錄系統
| 功能項目 | 說明 |
|---------|------|
| 即時同步 | 使用 Firestore onSnapshot 即時監聽資料變化 |
| 資料儲存 | 儲存抽牌時間、牌名、正逆位、牌義 |
| 降序排列 | 按時間戳降序顯示歷史記錄 |
| 持久化存儲 | 使用 Firebase Firestore 雲端資料庫 |

---

## 🏗️ 技術架構

### 前端技術棧
```
├── HTML5                    # 頁面結構
├── CSS3                     # 自訂樣式 + 動畫
├── Tailwind CSS (CDN)       # 快速樣式開發
├── JavaScript (ES6 Modules) # 應用邏輯
└── Google Fonts (Inter)     # 字體美化
```

### 後端服務 (Firebase)
```
├── Firebase App             # Firebase 應用核心
├── Firebase Auth            # 用戶認證服務
│   ├── signInAnonymously
│   └── signInWithCustomToken
└── Firebase Firestore       # 雲端資料庫
    ├── addDoc               # 新增文檔
    ├── onSnapshot           # 即時監聽
    └── collection/query     # 集合操作
```

---

## 📁 資料結構設計

### Firestore 資料路徑
```
/artifacts/{appId}/users/{userId}/tarot_diary/{documentId}
```

### 文檔結構 (Document Schema)
```javascript
{
  timestamp: Timestamp,    // Firestore 伺服器時間戳
  date: String,           // 人類可讀日期 (zh-TW 格式)
  cardIndex: Number,      // 牌的索引 (0-21)
  cardName: String,       // 牌名 (中英文)
  isReversed: Boolean,    // 是否逆位
  meaning: String         // 對應牌義
}
```

### 塔羅牌資料 (Major Arcana - 22 張大阿爾克那)
```javascript
{
  index: Number,          // 牌編號 (0-21)
  name: String,          // 牌名 (中英文)
  upright: String,       // 正位含義
  reversed: String       // 逆位含義
}
```

---

## 🎨 UI/UX 設計規範

### 色彩系統
| 變數名稱 | 色碼 | 用途 |
|---------|------|------|
| `--tarot-red` | `#8B0000` | 主色調、按鈕背景 |
| `--tarot-gold` | `#FFD700` | 強調色、邊框、動畫 |
| `--tarot-bg` | `#F5F5F5` | 頁面背景 |

### 響應式設計
- **手機版**：卡牌尺寸 `w-48 h-80`
- **桌面版**：卡牌尺寸 `w-64 h-96`
- **內距調整**：`p-4` (手機) → `p-8` (桌面)

### 動畫效果
1. **翻牌動畫**：`transform: rotateY(180deg)` + `transition: 0.6s`
2. **按鈕按壓**：`transform: scale(0.98)` + `box-shadow` 變化
3. **載入動畫**：旋轉 spinner (邊框虛線旋轉)
4. **文字漸顯**：`opacity` 過渡 + `transition-opacity`

---

## 📦 模組功能拆解

### 模組 1：Firebase 初始化模組
```
initFirebase()
├── 讀取配置 (firebaseConfig)
├── 初始化 App
├── 初始化 Firestore
├── 初始化 Auth
└── 設定認證狀態監聽器
```

### 模組 2：認證處理模組
```
認證流程
├── 優先使用 Custom Token 登入
├── 失敗時降級為匿名登入
└── 使用 withRetry() 實現指數退避重試
```

### 模組 3：抽牌核心模組
```
drawCardLogic()
├── 隨機選牌 (0-21)
├── 決定正逆位 (50%)
└── 返回牌義資料

drawCard() [主函數]
├── 檢查認證狀態
├── 禁用按鈕 + 顯示載入
├── 呼叫 drawCardLogic()
├── 更新 UI (updateCardUI)
├── 儲存至 Firestore (saveCardToDiary)
└── 恢復按鈕狀態
```

### 模組 4：UI 更新模組
```
updateCardUI(cardData)
├── 重設動畫狀態
├── 顯示抽牌中動畫
├── 延遲更新卡牌內容
├── 執行翻牌動畫
├── 更新結果區文字
└── 漸顯文字動畫
```

### 模組 5：歷史記錄模組
```
listenForHistory()
├── 取得集合參考
├── 建立即時監聽
├── 轉換資料格式
├── 降序排序
└── 呼叫 renderHistory()

renderHistory(history)
├── 清空現有列表
├── 處理空記錄狀態
└── 迴圈渲染每筆記錄
```

---

## 🔄 實作流程 (開發步驟)

### 階段 1：基礎建設 (Phase 1: Foundation)
- [x] 建立 HTML 基本結構
- [x] 引入 Tailwind CSS (CDN)
- [x] 引入 Google Fonts
- [x] 定義 CSS 變數和基礎樣式
- [x] 建立卡牌容器與翻轉動畫 CSS

### 階段 2：UI 元件開發 (Phase 2: UI Components)
- [x] Header 區塊 (標題、描述、用戶資訊)
- [x] 卡牌展示區 (雙面卡牌設計)
- [x] 結果顯示區 (牌名、正逆位、牌義)
- [x] 抽牌按鈕與載入狀態
- [x] 歷史記錄列表區塊

### 階段 3：Firebase 整合 (Phase 3: Backend Integration)
- [x] Firebase SDK 引入 (ESM Modules)
- [x] Firebase App 初始化
- [x] Firebase Auth 設定
- [x] Firestore 連接與集合建立
- [x] 實作指數退避重試機制

### 階段 4：核心功能實作 (Phase 4: Core Features)
- [x] 塔羅牌資料定義 (22 張大阿爾克那)
- [x] 抽牌隨機邏輯
- [x] 正逆位判定邏輯
- [x] 卡片翻轉動畫控制
- [x] 結果儲存至 Firestore

### 階段 5：歷史記錄功能 (Phase 5: History Feature)
- [x] Firestore 即時監聽設定
- [x] 歷史資料格式轉換
- [x] 時間排序處理
- [x] 歷史記錄渲染邏輯
- [x] 空記錄狀態處理

### 階段 6：優化與除錯 (Phase 6: Polish & Debug)
- [x] 按鈕狀態管理
- [x] 載入動畫整合
- [x] 錯誤訊息處理
- [x] 認證狀態檢查
- [x] Debug 日誌級別設定

---

## 🔒 安全性考量

### 資料隔離
- 使用用戶特定路徑：`/artifacts/{appId}/users/{userId}/...`
- 確保用戶只能存取自己的資料

### 認證安全
- 支援 Custom Token 優先認證
- 降級至匿名認證作為備用方案
- 認證狀態即時監控

### 錯誤處理
- 指數退避重試機制 (最多 5 次)
- 初始延遲 1 秒，每次翻倍 + 隨機抖動
- 所有 Firebase 操作包裹在 try-catch 中

---

## ⚙️ 設定參數

### 全域配置變數
```javascript
__app_id          // 應用程式 ID
__firebase_config // Firebase 配置 JSON
__initial_auth_token // 初始認證 Token
```

### 重試機制參數
```javascript
maxRetries = 5        // 最大重試次數
initialDelay = 1000   // 初始延遲 (毫秒)
```

---

## 📱 頁面狀態流程

```
┌─────────────────┐
│   頁面載入      │
│ (按鈕禁用)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Firebase 初始化 │
│ + 認證流程      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 認證完成        │
│ (按鈕啟用)     │
│ 歷史記錄載入   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ 等待用戶抽牌    │────▶│ 抽牌中...       │
│                │     │ (按鈕禁用)     │
└─────────────────┘     └────────┬────────┘
         ▲                       │
         │                       ▼
         │              ┌─────────────────┐
         │              │ 翻牌動畫        │
         │              │ + 結果顯示      │
         │              └────────┬────────┘
         │                       │
         │                       ▼
         │              ┌─────────────────┐
         │              │ 儲存至 Firestore│
         │              │ + 更新歷史      │
         │              └────────┬────────┘
         │                       │
         └───────────────────────┘
```

---

## 🚀 未來擴展建議

### 功能增強
1. **完整牌組**：加入小阿爾克那 (56 張)
2. **多牌陣**：支援三張牌陣、凱爾特十字等
3. **每日限制**：限制每日抽牌次數
4. **分享功能**：社群分享抽牌結果
5. **統計分析**：抽牌頻率、常見牌統計

### 技術優化
1. **PWA 支援**：離線使用、推送通知
2. **圖片資源**：實際塔羅牌圖片
3. **語音朗讀**：牌義語音播放
4. **主題切換**：深色模式支援

### 用戶體驗
1. **引導教程**：新手使用教學
2. **個人日記**：允許用戶添加個人筆記
3. **日曆視圖**：按日期查看歷史
4. **收藏功能**：標記重要抽牌結果

---

## 📝 文件更新記錄

| 版本 | 日期 | 更新內容 |
|------|------|---------|
| v1.0 | 2025-12-11 | 初始計劃文件建立 |

---

*此計劃文件基於 `doc.md` 中的現有實現代碼分析而成。*
