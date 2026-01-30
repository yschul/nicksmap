import { Users } from 'lucide-react'

interface Collaborator {
  id: string
  email: string
  color: string
}

interface CollaboratorsListProps {
  collaborators: Collaborator[]
  currentUserId?: string
}

export default function CollaboratorsList({ collaborators, currentUserId }: CollaboratorsListProps) {
  return (
    <div className="collaborators-list">
      <Users size={16} />
      <div className="collaborators-avatars">
        {collaborators.map((user) => (
          <div
            key={user.id}
            className={`collaborator-avatar ${user.id === currentUserId ? 'current' : ''}`}
            style={{ backgroundColor: user.color }}
            title={user.id === currentUserId ? `${user.email} (나)` : user.email}
          >
            {user.email?.charAt(0).toUpperCase() || 'U'}
          </div>
        ))}
      </div>
      <span className="collaborators-count">{collaborators.length}명 접속중</span>
    </div>
  )
}
