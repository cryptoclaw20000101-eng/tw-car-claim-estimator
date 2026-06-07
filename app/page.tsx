'use client'

import Link from "next/link";
import { Button, Card, Typography, Space, Divider, Alert } from "antd";
import {
  CalculatorOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";

const { Title, Paragraph } = Typography;

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12 bg-zinc-50">
      <div className="w-full max-w-3xl">
        <Title level={1} className="!mb-2">
          🚗 台灣車禍理賠金額估算器
        </Title>
        <Paragraph className="text-zinc-600 !mb-8">
          依<strong>強制汽車責任保險法</strong>、<strong>民法 §184-196 侵權行為</strong>、
          及<strong> 6 個直轄市地方法院實務區間</strong>，在 5 分鐘內產出 5 區估算結果。
        </Paragraph>

        <Space direction="vertical" size="middle" className="w-full mb-8">
          <Card>
            <Space direction="vertical" size="small" className="w-full">
              <Title level={4} className="!mt-0">
                <CalculatorOutlined /> 估算輸出 5 大區塊
              </Title>
              <ul className="!mt-0">
                <li>
                  <strong>① 強制險</strong>：依 15 細項法定上限逐項試算（醫療 20 萬 cap / 看護 30 日 1,200 元/日）
                </li>
                <li>
                  <strong>② 失能初篩</strong>：關節 ROM 量測 → 失能等級對照，<em>不直接判定</em>，給補件建議
                </li>
                <li>
                  <strong>③ 第三人責任險</strong>：體傷+財損分開 cap，自動扣強制險已估金額
                </li>
                <li>
                  <strong>④ 補件清單</strong>：依空欄位自動產出需補件項目
                </li>
                <li>
                  <strong>⑤ 地區實務參考</strong>：金融評議中心案例 + 司法院判決區間
                </li>
              </ul>
            </Space>
          </Card>

          <Card>
            <Space direction="vertical" size="small" className="w-full">
              <Title level={4} className="!mt-0">
                <SafetyCertificateOutlined /> 鐵律（不踩雷）
              </Title>
              <ul className="!mt-0 text-zinc-700">
                <li>✅ 強制險採<strong>無過失主義</strong>，不乘肇責比例</li>
                <li>✅ 精神慰撫金、工作損失、車損<strong>不放入強制險</strong></li>
                <li>✅ 關節角度喪失只進<strong>失能初篩</strong>，不直判失能</li>
                <li>✅ 資料不足時<strong>不硬算</strong>，顯示需補資料</li>
              </ul>
            </Space>
          </Card>
        </Space>

        <Link href="/claims/new">
          <Button type="primary" size="large" block>
            📝 開始估算（7 步表單，約 5 分鐘）
          </Button>
        </Link>

        <Divider />

        <Space direction="vertical" size="small" className="w-full">
          <Title level={5} className="!mb-0">
            <FileTextOutlined /> 引用法源
          </Title>
          <ul className="!mt-0 text-sm text-zinc-600">
            <li>強制汽車責任保險法（§27 給付項目）</li>
            <li>強制汽車責任保險給付標準（§2-§4 + 失能等級附表）</li>
            <li>民法 §184、§193、§194、§195</li>
            <li>金融消費評議中心評議原則</li>
            <li>臺灣臺北/新北/臺中/臺南/高雄/桃園地方法院慰撫金區間</li>
          </ul>
        </Space>

        <Alert
          className="!mt-8"
          type="warning"
          showIcon
          message="免責聲明"
          description="本系統依使用者輸入資料、強制汽車責任保險給付標準、常見民事損害賠償項目、金融評議公開案例及法院實務區間進行初步估算。實際理賠金額仍須依保險公司審核、醫療資料、肇事責任、保單條款、金融評議結果、法院認定及雙方和解結果為準。本系統不保證理賠金額，亦不構成法律意見。"
        />

        <Paragraph className="!mt-6 text-xs text-zinc-400 text-center">
          📍 地區覆蓋：6 個直轄市地方法院 + 26 縣市自動對應（台/臺異體字相容）·
          v0.1 MVP
        </Paragraph>
      </div>
    </main>
  );
}
