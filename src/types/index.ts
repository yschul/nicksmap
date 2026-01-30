export interface MindMapNode {
  data: {
    text: string
    image?: string
    icon?: string[]
    hyperlink?: string
    note?: string
    richText?: boolean
    expand?: boolean
  }
  children?: MindMapNode[]
}

export interface MindMapTheme {
  lineColor: string
  lineWidth: number
  lineStyle: 'straight' | 'curve' | 'direct'
  backgroundColor: string
  nodeBackgroundColor: string
  nodeTextColor: string
  nodeBorderColor: string
  nodeBorderWidth: number
  nodeBorderRadius: number
}

export interface LayoutType {
  name: string
  value: string
  icon: string
}

export const LAYOUT_TYPES: LayoutType[] = [
  { name: '방사형', value: 'logicalStructure', icon: 'GitBranch' },
  { name: '오른쪽 정렬', value: 'mindMap', icon: 'AlignRight' },
  { name: '왼쪽 정렬', value: 'organizationStructure', icon: 'AlignLeft' },
  { name: '카탈로그', value: 'catalogOrganization', icon: 'List' },
  { name: '타임라인', value: 'timeline', icon: 'Clock' },
]

export const BRANCH_STYLES = [
  { name: '곡선', value: 'curve' },
  { name: '직선', value: 'straight' },
  { name: '직각', value: 'direct' },
]

export const ICON_LIST = [
  { name: '별', icon: '⭐' },
  { name: '체크', icon: '✅' },
  { name: '경고', icon: '⚠️' },
  { name: '중요', icon: '❗' },
  { name: '질문', icon: '❓' },
  { name: '하트', icon: '❤️' },
  { name: '불', icon: '🔥' },
  { name: '전구', icon: '💡' },
  { name: '플래그', icon: '🚩' },
  { name: '시계', icon: '⏰' },
  { name: '타겟', icon: '🎯' },
  { name: '로켓', icon: '🚀' },
]

export const COLOR_PALETTE = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
  '#FF7F50', '#9370DB', '#3CB371', '#FFB6C1',
]
