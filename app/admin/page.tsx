/**
 * /admin — 後台 dashboard（v0.24.0+）
 *
 * 顯示：
 * - 註冊 user 清單（email / 驗證狀態 / 建立時間 / 最後登入）
 * - 估算清單（強制險估算金額 / 失能等級 / 法院 / 肇責比例 / 建立時間）
 *
 * Auth：需要登入（業務員或 admin 用）
 * 任何登入 user 可看（v0.24.0+ 簡化：不分 role；未來加 admin role 欄位）
 *
 * 設計紀律：ag-grid 太大（v0.13.x 換過太重）→ 用 AntD Table 即可
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, Empty, Space, Spin, Table, Tabs, Tag, Typography } from 'antd'
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  UserOutlined,
  FileTextOutlined,
  WechatOutlined,
} from '@ant-design/icons'
import { useAuth } from '@/components/AuthProvider'

const { Title, Text, Paragraph } = Typography

interface UserRow {
  id: string
  email: string
  emailVerified: boolean
  createdAt: string
  lastSignInAt: string | null
}

interface EstimateRow {
  id: string
  userId: string
  email: string
  compulsoryTotalEstimated: number | null
  disabilityLevel: number | null
  courtName: string | null
  selfFaultRatio: number | null
  createdAt: string
}

interface LeadRow {
  id: string
  contactType: 'line' | 'threads'
  contactHandle: string
  message: string | null
  consent: boolean
  userEmail: string | null
  createdAt: string
}

export default function AdminPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [estimates, setEstimates] = useState<EstimateRow[]>([])
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingEstimates, setLoadingEstimates] = useState(false)
  const [loadingLeads, setLoadingLeads] = useState(false)

  // Auth 守護：未登入導向 /login
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' })
      if (res.ok) {
        const data = (await res.json()) as { items: UserRow[] }
        setUsers(data.items)
      }
    } finally {
      setLoadingUsers(false)
    }
  }

  const fetchEstimates = async () => {
    setLoadingEstimates(true)
    try {
      const res = await fetch('/api/admin/estimates', { credentials: 'include' })
      if (res.ok) {
        const data = (await res.json()) as { items: EstimateRow[] }
        setEstimates(data.items)
      }
    } finally {
      setLoadingEstimates(false)
    }
  }

  const fetchLeads = async () => {
    setLoadingLeads(true)
    try {
      const res = await fetch('/api/admin/leads', { credentials: 'include' })
      if (res.ok) {
        const data = (await res.json()) as { items: LeadRow[] }
        setLeads(data.items)
      }
    } finally {
      setLoadingLeads(false)
    }
  }

  useEffect(() => {
    if (user) {
      // AGENTS §2.1：fetchUsers/fetchEstimates 內的 setState 在 async callback 裡跑（不是 effect body）
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchUsers()
      void fetchEstimates()
      void fetchLeads()
    }
  }, [user])

  if (authLoading) {
    return (
      <main id="main-content" className="flex flex-1 items-center justify-center">
        <Spin size="large" />
      </main>
    )
  }

  if (!user) {
    return (
      <main id="main-content" className="flex flex-1 items-center justify-center">
        <Card>
          <Paragraph>需要登入才能查看後台</Paragraph>
          <Link href="/login">
            <Button type="primary">前往登入</Button>
          </Link>
        </Card>
      </main>
    )
  }

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Title level={2} className="!mb-0">
          後台 Dashboard
        </Title>
        <Space>
          <Text type="secondary">已登入：{user.email}</Text>
          <Link href="/claims/new">
            <Button icon={<ArrowLeftOutlined />}>回估算</Button>
          </Link>
        </Space>
      </div>

      <Tabs
        defaultActiveKey="users"
        items={[
          {
            key: 'users',
            label: (
              <span>
                <UserOutlined /> 用戶（{users.length}）
              </span>
            ),
            children: (
              <Card>
                <div className="mb-3 flex justify-end">
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => void fetchUsers()}
                    loading={loadingUsers}
                    size="small"
                  >
                    重新整理
                  </Button>
                </div>
                <Table<UserRow>
                  rowKey="id"
                  dataSource={users}
                  loading={loadingUsers}
                  locale={{
                    emptyText: <Empty description="尚無註冊用戶" />,
                  }}
                  pagination={{ pageSize: 20 }}
                  columns={[
                    {
                      title: 'Email',
                      dataIndex: 'email',
                      key: 'email',
                      ellipsis: true,
                    },
                    {
                      title: '驗證狀態',
                      dataIndex: 'emailVerified',
                      key: 'emailVerified',
                      width: 100,
                      render: (v: boolean) =>
                        v ? <Tag color="green">已驗證</Tag> : <Tag color="orange">未驗證</Tag>,
                    },
                    {
                      title: '建立時間',
                      dataIndex: 'createdAt',
                      key: 'createdAt',
                      width: 180,
                      render: (v: string) => new Date(v).toLocaleString('zh-TW'),
                    },
                    {
                      title: '最後登入',
                      dataIndex: 'lastSignInAt',
                      key: 'lastSignInAt',
                      width: 180,
                      render: (v: string | null) => (v ? new Date(v).toLocaleString('zh-TW') : '—'),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'estimates',
            label: (
              <span>
                <FileTextOutlined /> 估算（{estimates.length}）
              </span>
            ),
            children: (
              <Card>
                <div className="mb-3 flex justify-end">
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => void fetchEstimates()}
                    loading={loadingEstimates}
                    size="small"
                  >
                    重新整理
                  </Button>
                </div>
                <Table<EstimateRow>
                  rowKey="id"
                  dataSource={estimates}
                  loading={loadingEstimates}
                  locale={{
                    emptyText: <Empty description="尚無估算記錄" />,
                  }}
                  pagination={{ pageSize: 20 }}
                  columns={[
                    {
                      title: 'Email',
                      dataIndex: 'email',
                      key: 'email',
                      ellipsis: true,
                    },
                    {
                      title: '強制險估算',
                      dataIndex: 'compulsoryTotalEstimated',
                      key: 'compulsoryTotalEstimated',
                      width: 140,
                      align: 'right',
                      render: (v: number | null) =>
                        v == null ? '—' : `NT$ ${v.toLocaleString('zh-TW')}`,
                    },
                    {
                      title: '失能等級',
                      dataIndex: 'disabilityLevel',
                      key: 'disabilityLevel',
                      width: 100,
                      align: 'center',
                      render: (v: number | null) => (v == null ? '—' : `第 ${v} 級`),
                    },
                    {
                      title: '法院',
                      dataIndex: 'courtName',
                      key: 'courtName',
                      ellipsis: true,
                    },
                    {
                      title: '肇責 (%)',
                      dataIndex: 'selfFaultRatio',
                      key: 'selfFaultRatio',
                      width: 90,
                      align: 'right',
                      render: (v: number | null) => (v == null ? '—' : `${v}`),
                    },
                    {
                      title: '建立時間',
                      dataIndex: 'createdAt',
                      key: 'createdAt',
                      width: 180,
                      render: (v: string) => new Date(v).toLocaleString('zh-TW'),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'leads',
            label: (
              <span>
                <WechatOutlined /> Leads（{leads.length}）
              </span>
            ),
            children: (
              <Card>
                <div className="mb-3 flex justify-end">
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => void fetchLeads()}
                    loading={loadingLeads}
                    size="small"
                  >
                    重新整理
                  </Button>
                </div>
                <Table<LeadRow>
                  rowKey="id"
                  dataSource={leads}
                  loading={loadingLeads}
                  locale={{
                    emptyText: <Empty description="尚無聯絡記錄" />,
                  }}
                  pagination={{ pageSize: 20 }}
                  columns={[
                    {
                      title: '聯絡類型',
                      dataIndex: 'contactType',
                      key: 'contactType',
                      width: 100,
                      render: (v: string) =>
                        v === 'line' ? (
                          <Tag color="green">LINE</Tag>
                        ) : (
                          <Tag color="blue">Threads</Tag>
                        ),
                    },
                    {
                      title: '帳號',
                      dataIndex: 'contactHandle',
                      key: 'contactHandle',
                      width: 200,
                      ellipsis: true,
                    },
                    {
                      title: '想問的問題',
                      dataIndex: 'message',
                      key: 'message',
                      ellipsis: true,
                      render: (v: string | null) => v ?? '—',
                    },
                    {
                      title: '來源',
                      dataIndex: 'userEmail',
                      key: 'userEmail',
                      width: 220,
                      render: (v: string | null) => v ?? '（訪客未登入）',
                      ellipsis: true,
                    },
                    {
                      title: '同意',
                      dataIndex: 'consent',
                      key: 'consent',
                      width: 80,
                      align: 'center',
                      render: (v: boolean) =>
                        v ? <Tag color="green">已同意</Tag> : <Tag color="red">否</Tag>,
                    },
                    {
                      title: '提交時間',
                      dataIndex: 'createdAt',
                      key: 'createdAt',
                      width: 180,
                      render: (v: string) => new Date(v).toLocaleString('zh-TW'),
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />
    </main>
  )
}
