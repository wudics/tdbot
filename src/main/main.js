const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")

let mainWindow
let opencodeClient
let opencodeServer
let opencodeReady = false
const partTypes = {} // partID -> "text" | "reasoning"

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"))
}

app.whenReady().then(async () => {
  await createWindow()

  if (app.isPackaged) {
    process.env.PATH = `${process.resourcesPath}:${process.env.PATH}`
  }

  ipcMain.handle("start-chat", async () => {
    if (!opencodeReady) {
      return { success: false, error: "opencode 正在启动，请稍候重试" }
    }
    try {
      const events = await opencodeClient.event.subscribe()

      const session = await opencodeClient.session.create({
        title: "\u81EA\u6211\u4ECB\u7ECD",
      })

      await opencodeClient.session.promptAsync({
        sessionID: session.data.id,
        agent: "general",
        parts: [{ type: "text", text: "\u8BF7\u4ECB\u7ECD\u4F60\u81EA\u5DF1" }],
      })

      const timeout = setTimeout(() => {
        mainWindow.webContents.send("stream-error", { message: "\u54CD\u5E94\u8D85\u65F6\uFF0860s\uFF09" })
      }, 60000)

      ;(async () => {
        try {
          for await (const event of events.stream) {
            if (event.type === "message.part.updated") {
              const part = event.properties.part
              if (part && part.id) {
                partTypes[part.id] = part.type
              }
            }
            if (event.type === "message.part.delta") {
              const delta = event.properties.delta
              const partID = event.properties.partID
              const partType = partTypes[partID] || "text"
              if (delta) {
                mainWindow.webContents.send("stream-chunk", { delta, partType })
              }
            }
            if (event.type === "session.idle") {
              clearTimeout(timeout)
              mainWindow.webContents.send("stream-end")
              break
            }
            if (event.type === "session.error") {
              clearTimeout(timeout)
              mainWindow.webContents.send("stream-error", event.properties.error)
              break
            }
          }
        } catch (streamErr) {
          clearTimeout(timeout)
          mainWindow.webContents.send("stream-error", { message: streamErr.message })
        }
      })()

      return { success: true }
    } catch (err) {
      console.error("start-chat error:", err)
      return { success: false, error: err.message }
    }
  })

  const { createOpencode } = await import("@opencode-ai/sdk/v2")
  const { client, server } = await createOpencode({
    config: {
      model: "deepseek/deepseek-v4-flash",
      agent: {
        general: {
          prompt: "\u4F60\u662F\u4E00\u4E2A\u540D\u4E3A tdbot \u7684\u684C\u9762\u667A\u80FD\u4F53\u52A9\u624B\uFF0C\u8BF7\u4EE5 tdbot \u7684\u8EAB\u4EFD\u56DE\u7B54\u95EE\u9898\u3002",
        },
      },
      provider: {
        deepseek: {
          options: {
            apiKey: "sk-cd7b134f460b4fb297e16b75e9ffed3d",
          },
          models: {
            "deepseek-v4-flash": {
              id: "deepseek-v4-flash",
            },
          },
        },
      },
    },
  })
  opencodeClient = client
  opencodeServer = server
  opencodeReady = true

  app.on("before-quit", () => {
    if (opencodeServer) opencodeServer.close()
  })
})

app.on("window-all-closed", () => {
  if (opencodeServer) opencodeServer.close()
  if (process.platform !== "darwin") app.quit()
})
