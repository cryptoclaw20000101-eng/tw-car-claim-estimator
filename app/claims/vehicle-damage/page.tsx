import type { Metadata } from 'next'
import VehicleRepairCalculator from './_calculator'

export const metadata: Metadata = {
  title: '車損維修費折舊試算 | 車禍理賠估算器',
  description: '未受傷、只有車損？直接輸入零件、工資與烤漆費，試算零件折舊後的維修金額。',
  alternates: { canonical: '/claims/vehicle-damage' },
}

export default function Page() {
  return <VehicleRepairCalculator />
}
