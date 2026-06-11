// courtToCity 函式單元測試（v0.2.9+）
// 為什麼要這個？findRelatedPracticeCases 配對用此函式判斷「同縣市 +10」，
// 修掉 v0.2.8 之前花蓮/苗栗/彰化等 8 件案例 court 欄位無法觸發同縣市配權的 bug。
import { describe, it, expect } from "vitest";
import { courtToCity } from "@/lib/insurance/region-court-map";

describe("courtToCity — 法院名 → 縣市", () => {
  it("全名解析：臺灣XX地方法院", () => {
    expect(courtToCity("臺灣臺中地方法院")).toBe("臺中市");
    expect(courtToCity("臺灣新北地方法院")).toBe("新北市");
    expect(courtToCity("臺灣花蓮地方法院")).toBe("花蓮縣");
    expect(courtToCity("臺灣苗栗地方法院")).toBe("苗栗縣");
    expect(courtToCity("臺灣彰化地方法院")).toBe("彰化縣");
    expect(courtToCity("臺灣高雄地方法院")).toBe("高雄市");
  });

  it("異體字標準化：回臺字版（非台字版）", () => {
    // 即使內部有「台北市/臺北市」雙 key，回傳要統一
    const result = courtToCity("臺灣臺北地方法院");
    expect(result).toBe("臺北市");
    expect(result?.startsWith("臺")).toBe(true);
  });

  it("簡名解析：去掉『臺灣』前綴仍能解", () => {
    // 「新北地方法院（和解）」是 v0.2.6+ 律師案例的 court 格式
    expect(courtToCity("新北地方法院（和解）")).toBe("新北市");
    expect(courtToCity("臺中地方法院")).toBe("臺中市");
  });

  it("邊界輸入：空字串/非法院字串/法院代碼", () => {
    expect(courtToCity("")).toBeNull();
    expect(courtToCity("   ")).toBeNull();
    expect(courtToCity("和解")).toBeNull();
    expect(courtToCity("完全不相干的字串")).toBeNull();
    // 法院代碼目前不支援（v0.2.9 範圍外 — 屬 scrape 那邊的資料問題）
    expect(courtToCity("TCDV")).toBeNull();
    expect(courtToCity("CHDM")).toBeNull();
    expect(courtToCity("ULDV")).toBeNull();
  });

  it("trim：前後空白不影響", () => {
    expect(courtToCity("  臺灣臺中地方法院  ")).toBe("臺中市");
    expect(courtToCity("\t臺灣新北地方法院\n")).toBe("新北市");
  });
});
