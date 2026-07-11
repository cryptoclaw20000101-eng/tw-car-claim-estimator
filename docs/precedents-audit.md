# Precedents 抓取品質審核報告

> 自動生成於 2026-07-11 13:22:05 · 對象：`data/precedents/*.json` (777 件)

## 📋 審核摘要

- **總 precedent 數**：777
- **總抓取問題數**：158
- **檢查維度**：3

### 問題分佈

| 維度            | 問題數 | 嚴重度  | 說明                                 |
| --------------- | ------ | ------- | ------------------------------------ |
| `caseNo_format` | 8      | 🟡 注意 | 案號格式不對                         |
| `empty_gist`    | 5      | 🟡 注意 | gist 太短或空                        |
| `unknown_court` | 145    | 🟢 已知 | 法院代碼未知（pending apply-courts） |

## 🏷️ Category 分類 sanity check

正常期望：

- `minor_injury`：大宗（輕傷案件最多）
- `death`：~17 件（死亡案件相對少）
- `disability`：~6 件（失能案件中等）
- `labor_capacity_loss`：~5 件（含 Hoffmann 詳細計算）
- 特殊 category（rule/taxonomy/exception）合計應 < 10

實際分佈（前 10）：

| Category                      | 件數 | 期望     | 判斷 |
| ----------------------------- | ---- | -------- | ---- |
| `minor_injury`                | 734  | ~500-700 | ✅   |
| `death`                       | 15   | ~15-25   | ✅   |
| `disability`                  | 6    | ~5-15    | ✅   |
| `labor_capacity_loss`         | 5    | ~5-15    | ✅   |
| `practice_case`               | 4    | ~5-15    | ✅   |
| `car_damage`                  | 2    | ~5-15    | ✅   |
| `scar_revision`               | 2    | <5       | ✅   |
| `car_damage_exception`        | 1    | <5       | ✅   |
| `disability_merging_rule`     | 1    | <5       | ✅   |
| `disability_treatment_period` | 1    | <5       | ✅   |

## 🔍 詳細問題清單

### `caseNo_format` (8 件)

- `disability-merging.json` · id=`tw-disability-yellow-bg-not-paid` · ('失能保典 p.30 註記',)
- `disability-merging.json` · id=`tw-disability-12-categories` · ('失能保典 十二大失能種類',)
- `labor-loss.json` · id=`tw-labor-110-08-26-001` · ('理賠案例1（110.08.26 新北市板橋區）',)
- `other-precedents.json` · id=`tw-other-104-1041278` · ('104 年評字第 001278 號',)
- `practice-cases.json` · id=`tw-practice-110-08-26-001` · ('理賠實務案例 1（110.08.26 新北市板橋區）',)
- `practice-cases.json` · id=`tw-practice-112-12-01-002` · ('理賠實務案例 2（112.12.01 台中市大里區）',)
- `practice-cases.json` · id=`tw-practice-113-05-20-003` · ('理賠實務案例 3（113.05.20 台中市南區）',)
- `practice-cases.json` · id=`tw-practice-113-11-19-004` · ('理賠實務案例 4（113.11.19 彰化縣員林市）',)

### `empty_gist` (5 件)

- `labor-loss.json` · id=`tw-labor-110-08-26-001` · ('',)
- `practice-cases.json` · id=`tw-practice-110-08-26-001` · ('',)
- `practice-cases.json` · id=`tw-practice-112-12-01-002` · ('',)
- `practice-cases.json` · id=`tw-practice-113-05-20-003` · ('',)
- `practice-cases.json` · id=`tw-practice-113-11-19-004` · ('',)

### `unknown_court` (145 件)

- `car-damage.json` · id=`tw-car_damage-114-144146` · ('TPTA（未知代碼）',)
- `car-damage.json` · id=`tw-car_damage_v2-112-121549` · ('TPDM（未知代碼）',)
- `car-damage.json` · id=`tw-car_damage-110-110724` · ('CHDM（未知代碼）',)
- `car-damage.json` · id=`tw-car_damage-113-1137` · ('PTDV（未知代碼）',)
- `car-damage.json` · id=`tw-car_damage-115-11593` · ('KLDV（未知代碼）',)
- `car-damage.json` · id=`tw-car_damage-114-141328` · ('SCDV（未知代碼）',)
- `car-damage.json` · id=`tw-car_damage_v2-115-115441` · ('KLDV（未知代碼）',)
- `car-damage.json` · id=`tw-car_damage_v2-113-1137` · ('PTDV（未知代碼）',)
- `car-damage.json` · id=`tw-car_damage_v2-115-115467` · ('KLDV（未知代碼）',)
- `car-damage.json` · id=`tw-car_damage_v2-115-115282` · ('SCDV（未知代碼）',)
- `car-damage.json` · id=`tw-car_damage_v2-115-115133` · ('SCDV（未知代碼）',)
- `car-damage.json` · id=`tw-car_damage_v2-115-11551` · ('SCDV（未知代碼）',)
- `disability-merging.json` · id=`tw-disability-113-113538` · ('TPAA（未知代碼）',)
- `disability-merging.json` · id=`tw-disability-114-141218` · ('TPBA（未知代碼）',)
- `disability-merging.json` · id=`tw-disability-113-1132` · ('TCHM（未知代碼）',)
- `disability-merging.json` · id=`tw-disability-113-1133` · ('TCHM（未知代碼）',)
- `disability-merging.json` · id=`tw-disability-112-112522` · ('TPAA（未知代碼）',)
- `disability-merging.json` · id=`tw-disability-109-109281` · ('KSBA（未知代碼）',)
- `disability-merging.json` · id=`tw-disability_v2-113-1132` · ('TCHM（未知代碼）',)
- `disability-merging.json` · id=`tw-disability_v2-113-1133` · ('TCHM（未知代碼）',)
- ... 還有 125 件

## 🔬 抽樣驗證（10 件）

### 111 年度 重訴 字第 50 號 · 臺灣花蓮地方法院

```json
{
  "id": "tw-mental_distress-111-11150",
  "caseNo": "111 年度 重訴 字第 50 號",
  "court": "臺灣花蓮地方法院",
  "year": 2022,
  "category": "minor_injury",
  "chain": "mental_distress",
  "facts": "被告東新營造有限公司、李義祥、義祥工業社及華文好應連帶給付原告新臺幣（下同）62,457,813元，及其中27,766,471元部分，被告東新營造有限公司、李義祥及義祥工業社自民國111年12月3日起，被告華文好自民國111年12月6日起，",
  "amount": 205000,
  "totalAward": 62457813,
  "ratio": {
    "plaintiff": 0,
    "defendant": 100
  },
  "gist": "精神慰撫金 205,000 元",
  "source": "臺灣花蓮地方法院 111 年度 重訴 字第 50 號",
  "scrapedAt": "2026-06-12T06:40:37.264Z"
}
```

### 114 年度 原簡上 字第 6 號 · 臺灣桃園地方法院

```json
{
  "id": "tw-car_damage-114-1146",
  "caseNo": "114 年度 原簡上 字第 6 號",
  "court": "臺灣桃園地方法院",
  "year": 2025,
  "category": "minor_injury",
  "chain": "car_damage",
  "facts": "一、原判決關於駁回上訴人後開第二項之訴部分，暨訴訟費用之裁判（除確定部分外），均廢棄。二、上開廢棄部分，被上訴人應再連帶給付上訴人新臺幣肆萬貳仟元，及被上訴人絲瑀傑自民國一百一十三年五月十四日起、被上訴人聯鑫通運股份有限公司自民國一百一十三",
  "amount": 30000,
  "totalAward": 0,
  "ratio": {
    "plaintiff": 0,
    "defendant": 100
  },
  "gist": "車損 30,000 元",
  "source": "臺灣桃園地方法院 114 年度 原簡上 字第 6 號",
  "scrapedAt": "2026-06-22T14:33:52.688Z"
}
```

### 114 年度 審原訴 字第 24 號 · 臺灣高雄地方法院

```json
{
  "id": "tw-car_damage-114-11424",
  "caseNo": "114 年度 審原訴 字第 24 號",
  "court": "臺灣高雄地方法院",
  "year": 2025,
  "category": "minor_injury",
  "chain": "car_damage",
  "facts": "王華明犯附表「主文」欄所示之罪，各處附表「主文」欄所示之刑。未扣案犯罪所得新臺幣壹仟零伍拾元沒收，於全部或一部不能沒收或不宜執行沒收時，追徵其價額。供犯罪所用之富國投資公司收款收據單原件壹紙沒收。犯罪事實及理由壹、按於第一審辯論終結前，得就",
  "amount": 210000,
  "totalAward": 0,
  "ratio": {
    "plaintiff": 0,
    "defendant": 100
  },
  "gist": "車損 210,000 元",
  "source": "KSDM 114 年度 審原訴 字第 24 號",
  "scrapedAt": "2026-06-09T13:59:34.417Z"
}
```

### 114 年度 簡上 字第 150 號 · 臺灣新北地方法院

```json
{
  "id": "tw-transport_fee-114-114150",
  "caseNo": "114 年度 簡上 字第 150 號",
  "court": "臺灣新北地方法院",
  "year": 2025,
  "category": "minor_injury",
  "chain": "transport_fee",
  "facts": "一、原判決關於駁回上訴人後開第二項之訴部分，及該部分假執行之聲請，暨訴訟費用（除確定部分外）之裁判均廢棄。二、被上訴人應再連帶給付上訴人新臺幣（下同）15萬2,040元，及自民國113年1月2日起至清償日止，按週年利率5%計算之利息。三、其",
  "amount": 14170,
  "totalAward": 2040,
  "ratio": {
    "plaintiff": 0,
    "defendant": 100
  },
  "gist": "交通費用 14,170 元",
  "source": "臺灣新北地方法院 114 年度 簡上 字第 150 號",
  "scrapedAt": "2026-06-12T07:00:56.032Z"
}
```

### 113 年度 簡 字第 16 號 · 臺灣雲林地方法院

```json
{
  "id": "tw-labor_loss-113-11316",
  "caseNo": "113 年度 簡 字第 16 號",
  "court": "臺灣雲林地方法院",
  "year": 2024,
  "category": "minor_injury",
  "chain": "labor_loss",
  "facts": "被告應給付原告新臺幣1,286,217元，及自民國112年11月5日起至清償日止，按週年利率5%計算之利息。原告其餘之訴駁回。訴訟費用（減縮部分除外）由被告負擔67%，餘由原告負擔。本判決第一項得假執行。但被告如以新臺幣1,286,217元",
  "amount": 876180,
  "totalAward": 1286217,
  "ratio": {
    "plaintiff": 0,
    "defendant": 100
  },
  "gist": "工作損失 876,180 元",
  "source": "ULDV 113 年度 簡 字第 16 號",
  "scrapedAt": "2026-06-09T13:58:51.238Z"
}
```

### 112 年度 勞訴 字第 1 號 · 臺灣花蓮地方法院

```json
{
  "id": "tw-labor_loss_v3-112-1121",
  "caseNo": "112 年度 勞訴 字第 1 號",
  "court": "臺灣花蓮地方法院",
  "year": 2023,
  "category": "minor_injury",
  "chain": "labor_loss_v3",
  "facts": "原告之訴駁回。訴訟費用由原告負擔。事實及理由一、原告主張：原告自民國87年4月10日在被告處工作，除90年2月至94年3月15日外，其餘自87年4月10日至109年9月10日期間，原告之工作地點及內容均在被告之分裝場，期間長達17年餘。原告",
  "amount": 560252,
  "totalAward": 0,
  "ratio": {
    "plaintiff": 0,
    "defendant": 100
  },
  "gist": "失能/勞動能力減損 560,252 元",
  "source": "臺灣花蓮地方法院 112 年度 勞訴 字第 1 號",
  "scrapedAt": "2026-07-11T05:10:06.453Z"
}
```

### 115 年度 保險 字第 5 號 · ULDV（未知代碼）

```json
{
  "id": "tw-disability_v2-115-1155",
  "caseNo": "115 年度 保險 字第 5 號",
  "court": "ULDV（未知代碼）",
  "year": 2026,
  "category": "disability",
  "chain": "disability_v2",
  "facts": "原告之訴駁回。訴訟費用由原告負擔。事實及理由一、原告主張：㈠原告向被告申請人身保險金失能給付乙案，保險單號碼：HAFTZ0000000000號，承保內容項目有新臺幣（下同）1,500,000元意外傷害險（下稱系爭保險契約），每一人失能金額為",
  "amount": 1500000,
  "totalAward": 0,
  "ratio": {
    "plaintiff": 0,
    "defendant": 100
  },
  "gist": "失能(後遺症) 1,500,000 元",
  "source": "ULDV（未知代碼） 115 年度 保險 字第 5 號",
  "scrapedAt": "2026-07-11T01:01:46.927Z"
}
```

### 115 年度 苗簡 字第 343 號 · 臺灣苗栗地方法院

```json
{
  "id": "tw-car_damage_v2-115-115343",
  "caseNo": "115 年度 苗簡 字第 343 號",
  "court": "臺灣苗栗地方法院",
  "year": 2026,
  "category": "minor_injury",
  "chain": "car_damage_v2",
  "facts": "被告應給付原告新臺幣98,146元，及自民國115年4月2日起至清償日止，按週年利率5％計算之利息。原告其餘之訴駁回。訴訟費用由被告負擔81％，餘由原告負擔。本判決原告勝訴部分得假執行。事實及理由一、原告主張：被告於民國113年3月26日1",
  "amount": 98146,
  "totalAward": 98146,
  "ratio": {
    "plaintiff": 0,
    "defendant": 100
  },
  "gist": "車損(全損) 98,146 元",
  "source": "臺灣苗栗地方法院 115 年度 苗簡 字第 343 號",
  "scrapedAt": "2026-07-11T01:00:37.679Z"
}
```

### 114 年度 簡上 字第 475 號 · 臺灣新北地方法院

```json
{
  "id": "tw-transport_fee-114-114475",
  "caseNo": "114 年度 簡上 字第 475 號",
  "court": "臺灣新北地方法院",
  "year": 2025,
  "category": "minor_injury",
  "chain": "transport_fee",
  "facts": "原判決關於駁回上訴人後開第二項之訴，暨訴訟費用之裁判（除確定部分外），均廢棄。被上訴人應再給付上訴人新臺幣壹萬零壹佰伍拾元，及自民國112年11月19日起至清償日止，按週年利率5％計算之利息。其餘上訴駁回。第一、二審訴訟費用（除確定部分外）",
  "amount": 23520,
  "totalAward": 0,
  "ratio": {
    "plaintiff": 0,
    "defendant": 100
  },
  "gist": "交通費用 23,520 元",
  "source": "臺灣新北地方法院 114 年度 簡上 字第 475 號",
  "scrapedAt": "2026-06-12T07:00:22.749Z"
}
```

### 115 年度 基簡 字第 191 號 · 臺灣基隆地方法院

```json
{
  "id": "tw-car_damage_v2-115-115191",
  "caseNo": "115 年度 基簡 字第 191 號",
  "court": "臺灣基隆地方法院",
  "year": 2026,
  "category": "minor_injury",
  "chain": "car_damage_v2",
  "facts": "被告應給付原告新臺幣70,586元，及自民國115年2月13日起至清償日止，按年息5％計算之利息。原告其餘之訴駁回。訴訟費用（除減縮部分外）由被告負擔53％，餘由原告負擔。本判決原告勝訴部分得假執行。但被告如以新臺幣70,586元為原告預供",
  "amount": 70586,
  "totalAward": 70586,
  "ratio": {
    "plaintiff": 0,
    "defendant": 100
  },
  "gist": "車損(全損) 70,586 元",
  "source": "KLDV（未知代碼） 115 年度 基簡 字第 191 號",
  "scrapedAt": "2026-06-12T06:53:10.098Z"
}
```

## 🎯 行動建議

### 🔴 立即處理（嚴重）

- `negative_amount` / `non_civil_leaked`：直接從 JSON 刪除（會污染統計）

### 🟡 應該修（注意）

- `extreme_amount` > 500 萬：人工 verify 是否 multi-claim，否則加 ceiling
- `empty_gist`：回查司法院原文補 gist
- `caseNo_format`：人為 / 規則性誤判（可能 regex 過嚴）

### 🟢 已記錄（已知）

- `unknown_court`：跑 `pnpm apply-courts` 補代碼

### 結論

- 若 🔴 嚴重問題 ≤ 5 件 → 抓取品質 OK，可進入步驟 2 學習
- 若 🔴 嚴重問題 > 5 件 → 先清掉再學習
