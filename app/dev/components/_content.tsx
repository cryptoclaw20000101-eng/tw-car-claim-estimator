'use client'

/**
 * Components Showcase — v0.15.x Phase 5
 * 顯示 12+ 個關鍵元件的 props 變化範例
 */

import { useState } from 'react'
import { Alert, Card, Divider, Space, Switch, Tabs, Tag, Typography } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import { BulbOutlined, CodeOutlined } from '@ant-design/icons'
import { FormProgress } from '@/components/FormProgress'
import { MultiFaultCompare } from '@/components/MultiFaultCompare'
import { PageBreadcrumb } from '@/components/PageBreadcrumb'
import { Skeleton, SkeletonBlock } from '@/components/Skeleton'
import { StepShell } from '@/components/StepShell'

const { Title, Paragraph, Text } = Typography

export default function ComponentsShowcase() {
  const [dark, setDark] = useState(false)

  return (
    <main
      id="main-content"
      className={`min-h-screen px-6 py-12 ${dark ? 'bg-zinc-900' : 'bg-surface-subtle'}`}
    >
      <div className="mx-auto w-full max-w-5xl">
        <Title level={1} className={dark ? '!text-white' : ''}>
          <BulbOutlined className="mr-2 text-accent" />
          元件 Showcase
        </Title>
        <Paragraph className={dark ? '!text-zinc-300' : '!text-muted'}>
          v0.15.x Phase 5 — 開發工具。實際元件的 props 變化範例。
          <br />
          robots: noindex（不應被搜尋引擎收錄）。
        </Paragraph>

        <Card title="切換 dark mode 看效果" className={dark ? '!bg-zinc-800 !border-zinc-700' : ''}>
          <Space>
            <Switch
              checked={dark}
              onChange={setDark}
              checkedChildren="dark"
              unCheckedChildren="light"
            />
            <Text className={dark ? '!text-zinc-200' : ''}>
              {dark ? '目前 dark mode' : '目前 light mode'}
            </Text>
          </Space>
        </Card>

        <Divider />

        <Title level={2} className={dark ? '!text-white' : ''}>
          <CodeOutlined className="mr-2" />
          元件清單
        </Title>

        <Tabs
          defaultActiveKey="form"
          items={[
            {
              key: 'form',
              label: '表單 / 進度條',
              children: <FormSection dark={dark} />,
            },
            {
              key: 'result',
              label: '結果頁',
              children: <ResultSection dark={dark} />,
            },
            {
              key: 'misc',
              label: '其他',
              children: <MiscSection dark={dark} />,
            },
          ]}
        />
      </div>
    </main>
  )
}

function FormSection({ dark }: { dark: boolean }) {
  return (
    <Space direction="vertical" size="large" className="!w-full">
      <Section title="FormProgress（7 步驟進度條）" dark={dark}>
        <FormProgress
          steps={[
            { title: '事故基本' },
            { title: '肇責' },
            { title: '人身' },
            { title: '診斷' },
            { title: '收據' },
            { title: '車損' },
            { title: '地區' },
          ]}
          current={3}
        />
      </Section>

      <Section title="StepShell" dark={dark}>
        <StepShell
          icon={<FileTextOutlined />}
          title="範例 Step"
          alertType="info"
          alertTitle="這是範例 alert"
        >
          <Paragraph>StepShell 包裝範例</Paragraph>
        </StepShell>
      </Section>

      <Section title="PageBreadcrumb" dark={dark}>
        <PageBreadcrumb
          back={{
            kind: 'link',
            href: '/claims/new',
            label: '回到上一步',
          }}
        />
      </Section>
    </Space>
  )
}

function ResultSection({ dark }: { dark: boolean }) {
  return (
    <Space direction="vertical" size="large" className="!w-full">
      <Section title="MultiFaultCompare（多肇責比較）" dark={dark}>
        <MultiFaultCompare bodilyInjuryAmount={50000} propertyDamageAmount={20000} />
      </Section>

      <Section title="Skeleton 單塊" dark={dark}>
        <Skeleton width="w-48" height="h-4" />
      </Section>

      <Section title="SkeletonBlock 多行" dark={dark}>
        <SkeletonBlock rows={3} widths={['w-full', 'w-3/4', 'w-1/2']} />
      </Section>
    </Space>
  )
}

function MiscSection({ dark }: { dark: boolean }) {
  return (
    <Space direction="vertical" size="large" className="!w-full">
      <Section title="AntD Tag 變體" dark={dark}>
        <Space wrap>
          <Tag color="blue">藍色</Tag>
          <Tag color="green">綠色</Tag>
          <Tag color="red">紅色</Tag>
          <Tag color="orange">橘色</Tag>
          <Tag color="purple">紫色</Tag>
          <Tag color="cyan">青色</Tag>
        </Space>
      </Section>

      <Section title="AntD Alert 變體" dark={dark}>
        <Space direction="vertical" className="!w-full">
          <Alert type="info" message="Info 訊息" />
          <Alert type="success" message="Success 訊息" />
          <Alert type="warning" message="Warning 訊息" />
          <Alert type="error" message="Error 訊息" />
        </Space>
      </Section>
    </Space>
  )
}

function Section({
  title,
  children,
  dark,
}: {
  title: string
  children: React.ReactNode
  dark: boolean
}) {
  return (
    <Card
      title={title}
      className={dark ? '!bg-zinc-800 !border-zinc-700' : ''}
      headStyle={dark ? { color: '#fafafa' } : undefined}
      bodyStyle={dark ? { backgroundColor: 'transparent' } : undefined}
    >
      <div className={dark ? 'text-zinc-100' : ''}>{children}</div>
    </Card>
  )
}
