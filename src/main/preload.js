const { contextBridge, ipcRenderer } = require("electron")

let cleanupStream = null
let cleanupEnd = null
let cleanupError = null

contextBridge.exposeInMainWorld("api", {
  startChat: () => ipcRenderer.invoke("start-chat"),
  onStream: (callback) => {
    if (cleanupStream) cleanupStream()
    const handler = (_event, data) => callback(data)
    ipcRenderer.on("stream-chunk", handler)
    cleanupStream = () => ipcRenderer.removeListener("stream-chunk", handler)
  },
  onEnd: (callback) => {
    if (cleanupEnd) cleanupEnd()
    const handler = () => callback()
    ipcRenderer.on("stream-end", handler)
    cleanupEnd = () => ipcRenderer.removeListener("stream-end", handler)
  },
  onError: (callback) => {
    if (cleanupError) cleanupError()
    const handler = (_event, error) => callback(error)
    ipcRenderer.on("stream-error", handler)
    cleanupError = () => ipcRenderer.removeListener("stream-error", handler)
  },
})
