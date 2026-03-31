import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
// full.js 버전은 이미지 크기 조절, 드래그 등 플러그인 포함
import MindMap from 'simple-mind-map/full.js'

interface MindMapEditorProps {
  onDataChange?: (data: object) => void
  initialData?: object
  layout?: string
  theme?: object
  readOnly?: boolean
}

export interface MindMapEditorRef {
  getMindMap: () => MindMap | null
  getData: () => object | null
  setData: (data: object) => void
  setLayout: (layout: string) => void
  setTheme: (theme: object) => void
  addNode: () => void
  addChildNode: () => void
  deleteNode: () => void
  exportImage: () => void
  setLineStyle: (style: string) => void
  addImage: (url: string) => void
  addIcon: (icon: string) => void
  getSelectedNodeImageSize: () => { width: number; height: number; url: string } | null
  setSelectedNodeImageSize: (width: number, height: number) => void
}

const defaultData = {
  data: {
    text: '중심 주제',
    expand: true,
    isActive: false,
  },
  children: [
    {
      data: {
        text: '하위 주제 1',
        expand: true,
      },
      children: [
        {
          data: {
            text: '세부 항목 1-1',
          },
          children: [],
        },
      ],
    },
    {
      data: {
        text: '하위 주제 2',
        expand: true,
      },
      children: [],
    },
    {
      data: {
        text: '하위 주제 3',
        expand: true,
      },
      children: [],
    },
  ],
}

const MindMapEditor = forwardRef<MindMapEditorRef, MindMapEditorProps>(
  ({ onDataChange, initialData, layout = 'logicalStructure', readOnly = false }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const mindMapRef = useRef<MindMap | null>(null)

    useImperativeHandle(ref, () => ({
      getMindMap: () => mindMapRef.current,
      getData: () => {
        if (mindMapRef.current) {
          return mindMapRef.current.getData()
        }
        return null
      },
      setData: (data: object) => {
        if (mindMapRef.current) {
          mindMapRef.current.setData(data)
        }
      },
      setLayout: (newLayout: string) => {
        if (mindMapRef.current) {
          mindMapRef.current.setLayout(newLayout)
        }
      },
      setTheme: (theme: object) => {
        if (mindMapRef.current) {
          mindMapRef.current.setThemeConfig(theme)
        }
      },
      addNode: () => {
        if (mindMapRef.current) {
          mindMapRef.current.execCommand('INSERT_NODE', false, [], { text: '내용' })
        }
      },
      addChildNode: () => {
        if (mindMapRef.current) {
          mindMapRef.current.execCommand('INSERT_CHILD_NODE', false, [], { text: '내용' })
        }
      },
      deleteNode: () => {
        if (mindMapRef.current) {
          mindMapRef.current.execCommand('REMOVE_NODE')
        }
      },
      exportImage: () => {
        if (mindMapRef.current) {
          mindMapRef.current.export('png', true, 'mindmap')
        }
      },
      setLineStyle: (style: string) => {
        if (mindMapRef.current) {
          mindMapRef.current.setThemeConfig({
            lineStyle: style,
          })
        }
      },
      addImage: (url: string) => {
        if (mindMapRef.current) {
          const activeNodes = mindMapRef.current.renderer.activeNodeList
          if (activeNodes && activeNodes.length > 0) {
            // 이미지 크기 자동 감지
            const img = new window.Image()
            img.onload = () => {
              const maxWidth = 200
              const maxHeight = 150
              let width = img.width
              let height = img.height

              // 비율 유지하면서 최대 크기 제한
              if (width > maxWidth) {
                height = (maxWidth / width) * height
                width = maxWidth
              }
              if (height > maxHeight) {
                width = (maxHeight / height) * width
                height = maxHeight
              }

              activeNodes[0].setImage({
                url,
                width: Math.round(width),
                height: Math.round(height),
              })
            }
            img.src = url
          }
        }
      },
      addIcon: (icon: string) => {
        if (mindMapRef.current) {
          const activeNodes = mindMapRef.current.renderer.activeNodeList
          if (activeNodes && activeNodes.length > 0) {
            const currentIcons = (activeNodes[0].getData('icon') as string[]) || []
            activeNodes[0].setData({
              icon: [...currentIcons, icon],
            })
          }
        }
      },
      getSelectedNodeImageSize: () => {
        if (mindMapRef.current) {
          const activeNodes = mindMapRef.current.renderer.activeNodeList
          if (activeNodes && activeNodes.length > 0) {
            const node = activeNodes[0]
            const image = node.getData('image') as string
            const imageSize = node.getData('imageSize') as { width: number; height: number }
            if (image && imageSize) {
              return { width: imageSize.width, height: imageSize.height, url: image }
            }
          }
        }
        return null
      },
      setSelectedNodeImageSize: (width: number, height: number) => {
        if (mindMapRef.current) {
          const activeNodes = mindMapRef.current.renderer.activeNodeList
          if (activeNodes && activeNodes.length > 0) {
            const node = activeNodes[0]
            const image = node.getData('image') as string
            const imageTitle = node.getData('imageTitle') as string
            if (image) {
              mindMapRef.current.execCommand('SET_NODE_IMAGE', node, {
                url: image,
                title: imageTitle || '',
                width,
                height,
                custom: true,
              })
            }
          }
        }
      },
    }))

    const handleDataChange = useCallback(
      (data?: unknown) => {
        if (onDataChange && data) {
          onDataChange(data as object)
        }
      },
      [onDataChange]
    )

    useEffect(() => {
      if (!containerRef.current) return

      const mindMap = new MindMap({
        el: containerRef.current,
        data: initialData || defaultData,
        layout,
        theme: 'classic4',
        // 기본 노드 텍스트 한국어 설정
        defaultInsertSecondLevelNodeText: '내용',
        defaultInsertBelowSecondLevelNodeText: '내용',
        // 루트 노드 기본 텍스트
        defaultNodeText: '내용',
        // 요약/개요 기본 텍스트
        defaultGeneralizationText: '요약',
        // 연관선 텍스트
        defaultAssociativeLineText: '연관',
        themeConfig: {
          backgroundColor: '#f5f5f5',
          lineWidth: 2,
          lineColor: '#549688',
          lineDasharray: 'none',
          lineStyle: 'curve',
          rootLineKeepSameInCurve: true,
          generalizationLineWidth: 2,
          generalizationLineColor: '#549688',
          associativeLineWidth: 2,
          associativeLineColor: 'rgb(51, 51, 51)',
          associativeLineActiveWidth: 4,
          associativeLineActiveColor: 'rgba(2, 167, 240, 1)',
          paddingX: 15,
          paddingY: 10,
          imgMaxWidth: 200,
          imgMaxHeight: 100,
          iconSize: 20,
          fontSize: 14,
          fontFamily: 'Noto Sans KR, sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          color: '#222',
          borderRadius: 5,
          borderWidth: 1,
          borderColor: '#549688',
          borderDasharray: 'none',
          fillColor: '#fff',
          shape: 'roundedRectangle',
          hoverRectColor: 'rgb(94, 200, 248)',
        },
        readonly: readOnly,
        enableFreeDrag: !readOnly,
        mousewheelAction: 'zoom',
        mouseScaleCenterUseMousePosition: true,
        maxTag: 5,
        expandBtnSize: 20,
        enableShortcutOnlyWhenMouseInSvg: true,
        enableNodeTransitionMove: true,
        nodeTransitionMoveDuration: 300,
        initRootNodePosition: ['center', 'center'],
        exportPaddingX: 50,
        exportPaddingY: 50,
        nodeTextEditZIndex: 3000,
        nodeNoteTooltipZIndex: 3000,
        isUseCustomNodeContent: false,
        customCreateNodeContent: null,
        isLimitMindMapInCanvasWhenHasScrollbar: false,
      })

      mindMapRef.current = mindMap

      mindMap.on('data_change', handleDataChange)

      // 노드 생성 시 중국어 텍스트를 한국어로 변경
      mindMap.on('node_active', (...args: unknown[]) => {
        const activeNodeList = args[1] as Array<{ getData: (key: string) => string; setText: (text: string) => void }> | undefined
        if (activeNodeList && activeNodeList.length > 0) {
          const node = activeNodeList[0]
          const text = node.getData('text')
          // 중국어 기본 텍스트를 한국어로 변경
          const chineseDefaults = ['分支主题', '二级节点', '三级节点', '四级节点', '子节点']
          if (chineseDefaults.includes(text)) {
            node.setText('내용')
          }
        }
      })

      // 이미지를 선택된 노드에 추가하는 헬퍼 함수
      const addImageToActiveNode = (dataUrl: string) => {
        const activeNodes = mindMap.renderer.activeNodeList
        if (activeNodes && activeNodes.length > 0) {
          const img = new window.Image()
          img.onload = () => {
            const maxWidth = 200
            const maxHeight = 150
            let width = img.width
            let height = img.height

            if (width > maxWidth) {
              height = (maxWidth / width) * height
              width = maxWidth
            }
            if (height > maxHeight) {
              width = (maxHeight / height) * width
              height = maxHeight
            }

            activeNodes[0].setImage({
              url: dataUrl,
              width: Math.round(width),
              height: Math.round(height),
            })
          }
          img.src = dataUrl
        }
      }

      // 클립보드 붙여넣기 이벤트 (Ctrl+V)
      const handlePaste = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items
        if (!items) return

        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault()
            const file = items[i].getAsFile()
            if (file) {
              const reader = new FileReader()
              reader.onload = (event) => {
                const dataUrl = event.target?.result as string
                addImageToActiveNode(dataUrl)
              }
              reader.readAsDataURL(file)
            }
            break
          }
        }
      }

      // 드래그 앤 드롭 이벤트
      const handleDragOver = (e: DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
      }

      const handleDrop = (e: DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        const files = e.dataTransfer?.files
        if (files && files.length > 0) {
          const file = files[0]
          if (file.type.startsWith('image/')) {
            const reader = new FileReader()
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string
              addImageToActiveNode(dataUrl)
            }
            reader.readAsDataURL(file)
          }
        }
      }

      // 창 크기 변경 시 마인드맵 리사이즈
      const handleResize = () => {
        if (mindMapRef.current) {
          mindMapRef.current.resize()
        }
      }

      // 이벤트 리스너 등록
      window.addEventListener('resize', handleResize)
      document.addEventListener('paste', handlePaste)
      containerRef.current?.addEventListener('dragover', handleDragOver)
      containerRef.current?.addEventListener('drop', handleDrop)

      return () => {
        window.removeEventListener('resize', handleResize)
        document.removeEventListener('paste', handlePaste)
        containerRef.current?.removeEventListener('dragover', handleDragOver)
        containerRef.current?.removeEventListener('drop', handleDrop)
        if (mindMapRef.current) {
          mindMapRef.current.destroy()
          mindMapRef.current = null
        }
      }
    }, [])

    useEffect(() => {
      if (mindMapRef.current && layout) {
        mindMapRef.current.setLayout(layout)
      }
    }, [layout])

    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      />
    )
  }
)

MindMapEditor.displayName = 'MindMapEditor'

export default MindMapEditor
