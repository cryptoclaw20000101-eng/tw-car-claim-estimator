/**
 * ContactCTA — 結果頁聯絡 CTA（v0.24.0c+）
 *
 * 功能：讓用戶填 LINE 或 Threads 帳號，業務員免費提供諮詢。
 * - 不強制登入（未登入訪客也能留）
 * - 表單簡單（聯絡類型 + handle + 選填訊息 + 同意條款）
 * - AGENTS §6 脫敏：只存公開 ID，不存姓名/身分證/車牌
 *
 * UX：
 * - 預設收起（點按鈕展開），避免估算結果頁太雜
 * - 提交成功 → toast + 收合
 */

'use client'

import { useState } from 'react'
import { Alert, Button, Checkbox, Form, Input, Radio, Space, message } from 'antd'
import { MessageOutlined, WechatOutlined } from '@ant-design/icons'

interface ContactCTAProps {
  /** 從 sessionStorage 讀的 estimateId（可選） */
  estimateId?: string | null
}

const { TextArea } = Input

export function ContactCTA({ estimateId }: ContactCTAProps) {
  const [expanded, setExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form] = Form.useForm()

  const handleSubmit = async (values: {
    contactType: 'line' | 'threads'
    contactHandle: string
    message?: string
    consent: boolean
  }) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          contactType: values.contactType,
          contactHandle: values.contactHandle,
          message: values.message || null,
          consent: values.consent,
          estimateId: estimateId ?? null,
        }),
      })
      if (res.ok) {
        message.success('感謝！我們會在 1-2 個工作天透過 LINE / Threads 聯繫您')
        setSubmitted(true)
        setExpanded(false)
        form.resetFields()
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        message.error(data?.error ?? '送出失敗，請稍後重試')
      }
    } catch {
      message.error('網路錯誤，請稍後重試')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Alert
        type="success"
        showIcon
        message="已收到您的聯絡資訊"
        description="業務員會在 1-2 個工作天透過您留下的 LINE / Threads 帳號聯繫您，提供免費諮詢。"
      />
    )
  }

  if (!expanded) {
    return (
      <div className="!my-6">
        <Button
          type="dashed"
          block
          size="large"
          icon={<MessageOutlined />}
          onClick={() => setExpanded(true)}
          data-testid="contact-cta-toggle"
        >
          想要免費諮詢？留下 LINE 或 Threads 帳號，業務員 1-2 天內回覆
        </Button>
      </div>
    )
  }

  return (
    <div className="!my-6 rounded-lg border border-accent/30 bg-accent-soft/20 p-6">
      <div className="!mb-3 flex items-center gap-2">
        <WechatOutlined className="!text-lg text-accent" />
        <strong className="!text-base text-foreground">
          留下 LINE 或 Threads 帳號，業務員提供免費諮詢
        </strong>
      </div>
      <Alert
        type="info"
        showIcon
        className="!mb-4"
        message="我們會在 1-2 個工作天聯繫您"
        description="只儲存您選擇的 LINE / Threads 公開帳號，不用於行銷推銷，可隨時要求刪除。"
      />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="contactType"
          label="聯絡方式"
          rules={[{ required: true, message: '請選擇聯絡方式' }]}
        >
          <Radio.Group buttonStyle="solid">
            <Radio.Button value="line">LINE</Radio.Button>
            <Radio.Button value="threads">Threads</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          name="contactHandle"
          label={
            <Form.Item shouldUpdate noStyle>
              {() => {
                const t = form.getFieldValue('contactType')
                if (t === 'threads') return 'Threads 用戶名（不含 @）'
                if (t === 'line') return 'LINE ID（不含 @）'
                return '帳號'
              }}
            </Form.Item>
          }
          rules={[
            { required: true, message: '請輸入帳號' },
            { min: 3, max: 100, message: '帳號長度需在 3-100 之間' },
          ]}
        >
          <Input placeholder="例：myhandle 或 abc_123" />
        </Form.Item>
        <Form.Item name="message" label="想問的問題（選填）">
          <TextArea
            rows={3}
            maxLength={1000}
            showCount
            placeholder="例如：想了解對方肇責比例如何計算？"
          />
        </Form.Item>
        <Form.Item
          name="consent"
          valuePropName="checked"
          rules={[
            {
              validator: (_: unknown, value: boolean) =>
                value ? Promise.resolve() : Promise.reject(new Error('請勾選同意條款')),
            },
          ]}
        >
          <Checkbox>
            我同意業務員透過上述 LINE / Threads 帳號聯繫我，並理解此帳號僅用於本次諮詢。
          </Checkbox>
        </Form.Item>
        <Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              data-testid="contact-cta-submit"
            >
              送出
            </Button>
            <Button onClick={() => setExpanded(false)}>取消</Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  )
}
