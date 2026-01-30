declare module 'simple-mind-map/full.js' {
  interface MindMapOptions {
    el: HTMLElement
    data?: object
    viewData?: object
    readonly?: boolean
    layout?: string
    fishboneDeg?: number
    theme?: string
    themeConfig?: object
    scaleRatio?: number
    translateRatio?: number
    minZoomRatio?: number
    maxZoomRatio?: number
    enableFreeDrag?: boolean
    mousewheelAction?: string
    mouseScaleCenterUseMousePosition?: boolean
    maxTag?: number
    expandBtnSize?: number
    expandBtnIcon?: { open: string; close: string }
    enableShortcutOnlyWhenMouseInSvg?: boolean
    enableNodeTransitionMove?: boolean
    nodeTransitionMoveDuration?: number
    initRootNodePosition?: [string, string]
    exportPaddingX?: number
    exportPaddingY?: number
    nodeTextEditZIndex?: number
    nodeNoteTooltipZIndex?: number
    isUseCustomNodeContent?: boolean
    customCreateNodeContent?: null | (() => void)
    // 노드/이미지 크기 조절 관련
    enableNodeResize?: boolean
    imgAdjust?: boolean
    [key: string]: unknown
  }

  interface MindMapNode {
    setStyle: (key: string, value: string) => void
    setImage: (options: { url: string; width: number; height: number }) => void
    setData: (data: object) => void
    getData: (key?: string) => unknown
    setText: (text: string) => void
  }

  interface MindMapRenderer {
    activeNodeList: MindMapNode[]
  }

  interface MindMapView {
    scale: number
    setScale: (scale: number) => void
  }

  class MindMap {
    constructor(options: MindMapOptions)
    renderer: MindMapRenderer
    view: MindMapView
    getData: () => object
    setData: (data: object) => void
    setLayout: (layout: string) => void
    setThemeConfig: (config: object) => void
    execCommand: (command: string, ...args: unknown[]) => void
    export: (type: string, isDownload: boolean, filename: string) => void
    destroy: () => void
    on: (event: string, callback: (...args: unknown[]) => void) => void
    off: (event: string, callback?: (...args: unknown[]) => void) => void
    static usePlugin: (plugin: unknown) => typeof MindMap
    static hasPlugin: (plugin: unknown) => boolean
    static defineTheme: (name: string, config: object) => void
  }

  export default MindMap
}

declare module 'simple-mind-map' {
  interface MindMapOptions {
    el: HTMLElement
    data?: object
    viewData?: object
    readonly?: boolean
    layout?: string
    fishboneDeg?: number
    theme?: string
    themeConfig?: object
    scaleRatio?: number
    translateRatio?: number
    minZoomRatio?: number
    maxZoomRatio?: number
    enableFreeDrag?: boolean
    mousewheelAction?: string
    mouseScaleCenterUseMousePosition?: boolean
    maxTag?: number
    expandBtnSize?: number
    expandBtnIcon?: { open: string; close: string }
    enableShortcutOnlyWhenMouseInSvg?: boolean
    enableNodeTransitionMove?: boolean
    nodeTransitionMoveDuration?: number
    initRootNodePosition?: [string, string]
    exportPaddingX?: number
    exportPaddingY?: number
    nodeTextEditZIndex?: number
    nodeNoteTooltipZIndex?: number
    isUseCustomNodeContent?: boolean
    customCreateNodeContent?: null | (() => void)
    [key: string]: unknown
  }

  interface MindMapNode {
    setStyle: (key: string, value: string) => void
    setImage: (options: { url: string; width: number; height: number }) => void
    setData: (data: object) => void
    getData: (key?: string) => unknown
  }

  interface MindMapRenderer {
    activeNodeList: MindMapNode[]
  }

  interface MindMapView {
    scale: number
    setScale: (scale: number) => void
  }

  class MindMap {
    constructor(options: MindMapOptions)
    renderer: MindMapRenderer
    view: MindMapView
    getData: () => object
    setData: (data: object) => void
    setLayout: (layout: string) => void
    setThemeConfig: (config: object) => void
    execCommand: (command: string, ...args: unknown[]) => void
    export: (type: string, isDownload: boolean, filename: string) => void
    destroy: () => void
    on: (event: string, callback: (data?: unknown) => void) => void
    off: (event: string, callback?: (data?: unknown) => void) => void
    static usePlugin: (plugin: unknown) => void
    static hasPlugin: (plugin: unknown) => boolean
    static defineTheme: (name: string, config: object) => void
  }

  export default MindMap
}
