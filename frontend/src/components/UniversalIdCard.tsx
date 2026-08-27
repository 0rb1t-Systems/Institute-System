import React from 'react'
import IdCard from '@/components/IdCard'

/** Staff / instructor adapter around shared IdCard. */
const UniversalIdCard = ({ user, roleLabel, expirationDate, department, code, onRenew, className }: any) => (
  <IdCard
    user={user}
    roleLabel={roleLabel}
    nameLabel="Full Name"
    secondaryLabel="Department / Position"
    secondaryValue={department || 'General Faculty'}
    idLabel="Employee ID"
    code={code}
    expirationDate={expirationDate}
    indefiniteIfMissing
    onRenew={onRenew}
    className={className || 'w-full'}
    cardDomId="universal-id-card"
  />
)

export default UniversalIdCard
