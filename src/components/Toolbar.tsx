import { useState, useRef } from 'react'
import {
  Plus,
  Trash2,
  Download,
  Save,
  GitBranch,
  AlignRight,
  AlignLeft,
  List,
  Clock,
  Palette,
  Image,
  Smile,
  Share2,
  ChevronDown,
  Type,
  Minus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  HardDrive,
  Cloud,
} from 'lucide-react'
import { LAYOUT_TYPES, BRANCH_STYLES, ICON_LIST, COLOR_PALETTE } from '../types'
import { useAppModal } from './AppModal'
import type { MindMapEditorRef } from './MindMapEditor'

interface ToolbarProps {
  mindMapRef: React.RefObject<MindMapEditorRef | null>
  onSave: () => void
  onSaveAs?: (type: 'local' | 'cloud') => void
  onShare: () => void
  currentLayout: string
  onLayoutChange: (layout: string) => void
  isDemoMode?: boolean
}

const layoutIcons: Record<string, React.ReactNode> = {
  logicalStructure: <GitBranch size={16} />,
  mindMap: <AlignRight size={16} />,
  organizationStructure: <AlignLeft size={16} />,
  catalogOrganization: <List size={16} />,
  timeline: <Clock size={16} />,
}

export default function Toolbar({
  mindMapRef,
  onSave,
  onSaveAs,
  onShare,
  currentLayout,
  onLayoutChange,
  isDemoMode = false,
}: ToolbarProps) {
  const { showAlert } = useAppModal()
  const [showLayoutMenu, setShowLayoutMenu] = useState(false)
  const [showBranchMenu, setShowBranchMenu] = useState(false)
  const [showColorMenu, setShowColorMenu] = useState(false)
  const [showIconMenu, setShowIconMenu] = useState(false)
  const [showSaveMenu, setShowSaveMenu] = useState(false)
  const [showImageSizeModal, setShowImageSizeModal] = useState(false)
  const [imageSize, setImageSize] = useState({ width: 100, height: 100 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAddNode = () => {
    mindMapRef.current?.addNode()
  }

  const handleAddChildNode = () => {
    mindMapRef.current?.addChildNode()
  }

  const handleDeleteNode = () => {
    mindMapRef.current?.deleteNode()
  }

  const handleExport = () => {
    mindMapRef.current?.exportImage()
  }

  const handleLayoutSelect = (layoutValue: string) => {
    onLayoutChange(layoutValue)
    mindMapRef.current?.setLayout(layoutValue)
    setShowLayoutMenu(false)
  }

  const handleBranchStyleSelect = (style: string) => {
    mindMapRef.current?.setLineStyle(style)
    setShowBranchMenu(false)
  }

  const handleColorSelect = (color: string) => {
    const mindMap = mindMapRef.current?.getMindMap()
    if (mindMap) {
      const activeNodes = mindMap.renderer.activeNodeList
      if (activeNodes && activeNodes.length > 0) {
        activeNodes.forEach((node: { setStyle: (arg0: string, arg1: string) => void }) => {
          node.setStyle('fillColor', color)
        })
      }
    }
    setShowColorMenu(false)
  }

  const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_IMAGE_SIZE) {
      showAlert(`이미지 크기가 너무 큽니다.\n최대 5MB까지 업로드 가능합니다.\n(현재: ${(file.size / 1024 / 1024).toFixed(1)}MB)`)
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const url = event.target?.result as string
      mindMapRef.current?.addImage(url)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleIconSelect = (icon: string) => {
    mindMapRef.current?.addIcon(icon)
    setShowIconMenu(false)
  }

  const handleZoomIn = () => {
    const mindMap = mindMapRef.current?.getMindMap()
    if (mindMap) {
      const currentScale = mindMap.view.scale
      mindMap.view.setScale(currentScale + 0.1)
    }
  }

  const handleZoomOut = () => {
    const mindMap = mindMapRef.current?.getMindMap()
    if (mindMap) {
      const currentScale = mindMap.view.scale
      mindMap.view.setScale(Math.max(0.1, currentScale - 0.1))
    }
  }

  const handleOpenImageSizeModal = () => {
    const currentSize = mindMapRef.current?.getSelectedNodeImageSize()
    if (currentSize) {
      setImageSize({ width: currentSize.width, height: currentSize.height })
      setShowImageSizeModal(true)
    } else {
      showAlert('먼저 이미지가 있는 노드를 선택하세요.')
    }
  }

  const handleApplyImageSize = () => {
    mindMapRef.current?.setSelectedNodeImageSize(imageSize.width, imageSize.height)
    setShowImageSizeModal(false)
  }

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleAddNode} title="형제 노드 추가">
          <Plus size={18} />
          <span>노드</span>
        </button>
        <button className="toolbar-btn" onClick={handleAddChildNode} title="자식 노드 추가">
          <Plus size={14} />
          <Minus size={14} style={{ marginLeft: -8 }} />
          <span>하위</span>
        </button>
        <button className="toolbar-btn danger" onClick={handleDeleteNode} title="노드 삭제">
          <Trash2 size={18} />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <div className="dropdown">
          <button
            className="toolbar-btn"
            onClick={() => setShowLayoutMenu(!showLayoutMenu)}
            title="레이아웃"
          >
            {layoutIcons[currentLayout]}
            <span>레이아웃</span>
            <ChevronDown size={14} />
          </button>
          {showLayoutMenu && (
            <div className="dropdown-menu">
              {LAYOUT_TYPES.map((layout) => (
                <button
                  key={layout.value}
                  className={`dropdown-item ${currentLayout === layout.value ? 'active' : ''}`}
                  onClick={() => handleLayoutSelect(layout.value)}
                >
                  {layoutIcons[layout.value]}
                  <span>{layout.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="dropdown">
          <button
            className="toolbar-btn"
            onClick={() => setShowBranchMenu(!showBranchMenu)}
            title="가지 스타일"
          >
            <Type size={18} />
            <span>가지</span>
            <ChevronDown size={14} />
          </button>
          {showBranchMenu && (
            <div className="dropdown-menu">
              {BRANCH_STYLES.map((style) => (
                <button
                  key={style.value}
                  className="dropdown-item"
                  onClick={() => handleBranchStyleSelect(style.value)}
                >
                  <span>{style.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <div className="dropdown">
          <button
            className="toolbar-btn"
            onClick={() => setShowColorMenu(!showColorMenu)}
            title="색상"
          >
            <Palette size={18} />
            <span>색상</span>
          </button>
          {showColorMenu && (
            <div className="dropdown-menu color-menu">
              <div className="color-grid">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    className="color-swatch"
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorSelect(color)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          className="toolbar-btn"
          onClick={() => fileInputRef.current?.click()}
          title="이미지 추가"
        >
          <Image size={18} />
          <span>이미지</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageUpload}
        />
        <button
          className="toolbar-btn"
          onClick={handleOpenImageSizeModal}
          title="이미지 크기 조절"
        >
          <Maximize2 size={18} />
          <span>크기</span>
        </button>

        <div className="dropdown">
          <button
            className="toolbar-btn"
            onClick={() => setShowIconMenu(!showIconMenu)}
            title="아이콘"
          >
            <Smile size={18} />
            <span>아이콘</span>
          </button>
          {showIconMenu && (
            <div className="dropdown-menu icon-menu">
              <div className="icon-grid">
                {ICON_LIST.map((item) => (
                  <button
                    key={item.name}
                    className="icon-btn"
                    onClick={() => handleIconSelect(item.icon)}
                    title={item.name}
                  >
                    {item.icon}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleZoomIn} title="확대">
          <ZoomIn size={18} />
        </button>
        <button className="toolbar-btn" onClick={handleZoomOut} title="축소">
          <ZoomOut size={18} />
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onShare} title="공유">
          <Share2 size={18} />
          <span>공유</span>
        </button>
        <div className="dropdown">
          <button className="toolbar-btn primary" onClick={onSave} title="저장">
            <Save size={18} />
            <span>저장</span>
          </button>
          {onSaveAs && (
            <button
              className="toolbar-btn-dropdown"
              onClick={() => setShowSaveMenu(!showSaveMenu)}
              title="다른 이름으로 저장"
            >
              <ChevronDown size={14} />
            </button>
          )}
          {showSaveMenu && onSaveAs && (
            <div className="dropdown-menu save-menu">
              <button
                className="dropdown-item"
                onClick={() => {
                  onSaveAs('local')
                  setShowSaveMenu(false)
                }}
              >
                <HardDrive size={16} />
                <span>로컬에 새로 저장</span>
              </button>
              {!isDemoMode && (
                <button
                  className="dropdown-item"
                  onClick={() => {
                    onSaveAs('cloud')
                    setShowSaveMenu(false)
                  }}
                >
                  <Cloud size={16} />
                  <span>클라우드에 새로 저장</span>
                </button>
              )}
            </div>
          )}
        </div>
        <button className="toolbar-btn" onClick={handleExport} title="내보내기">
          <Download size={18} />
          <span>내보내기</span>
        </button>
      </div>

      {/* 이미지 크기 조절 모달 */}
      {showImageSizeModal && (
        <div className="modal-overlay" onClick={() => setShowImageSizeModal(false)}>
          <div className="image-size-modal" onClick={(e) => e.stopPropagation()}>
            <h3>이미지 크기 조절</h3>
            <div className="size-inputs">
              <div className="size-input-group">
                <label>너비 (px)</label>
                <input
                  type="number"
                  value={imageSize.width}
                  onChange={(e) => setImageSize({ ...imageSize, width: Number(e.target.value) })}
                  min="10"
                  max="1000"
                />
              </div>
              <div className="size-input-group">
                <label>높이 (px)</label>
                <input
                  type="number"
                  value={imageSize.height}
                  onChange={(e) => setImageSize({ ...imageSize, height: Number(e.target.value) })}
                  min="10"
                  max="1000"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowImageSizeModal(false)}>
                취소
              </button>
              <button className="btn-primary" onClick={handleApplyImageSize}>
                적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
