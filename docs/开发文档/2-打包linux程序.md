# 打包 Linux 程序

## 环境要求

- Node.js >= 18
- npm >= 9

## 安装打包工具

```bash
npm install -D electron-builder
```

## package.json 配置

在 `package.json` 中新增 `build` 字段和 `dist` 脚本：

```json
{
  "scripts": {
    "start": "electron .",
    "dist": "electron-builder"
  },
  "build": {
    "appId": "com.tdbot.app",
    "productName": "tdbot",
    "directories": {
      "output": "dist"
    },
    "extraResources": [
      {
        "from": "node_modules/opencode-ai/bin/opencode.exe",
        "to": "opencode"
      }
    ],
    "linux": {
      "target": ["AppImage"],
      "category": "Utility"
    }
  }
}
```

### 配置说明

| 配置项 | 说明 |
|--------|------|
| `extraResources` | 将 opencode 二进制（~140MB）从 node_modules 复制到打包后的 `resources/opencode`，不打包进 app.asar |
| `linux.target` | 输出 AppImage 格式（单文件，免安装） |
| `linux.category` | 应用分类，AppImage 使用 |

## 主进程适配生产路径

`src/main/main.js` 中，在 `createOpencode()` 前将打包后的二进制路径加入 PATH：

```javascript
if (app.isPackaged) {
  process.env.PATH = `${process.resourcesPath}:${process.env.PATH}`
}
```

这样 `createOpencode()` 内部通过 `cross-spawn("opencode", ...)` 就能找到 `resources/opencode`。

## 打包命令

```bash
# 设置 Electron 镜像源（国内加速）
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"

# 如果 build 过程中需要从 GitHub 下载工具但访问慢，可使用 gh-proxy：
export HTTPS_PROXY="https://v4.gh-proxy.org"

npm run dist
```

## 输出产物

```
dist/
├── linux-unpacked/          # 解压后的应用目录（调试用）
│   └── resources/
│       ├── app.asar         # 我们的源码
│       ├── app.asar.unpacked/
│       └── opencode         # opencode 二进制
└── tdbot-1.0.0.AppImage     # 最终可执行文件（~199MB）
```

AppImage 是单文件可执行，下载后：

```bash
chmod +x tdbot-1.0.0.AppImage
./tdbot-1.0.0.AppImage
```

## 跨平台说明

`opencode-ai` npm 包在 `postinstall` 时自动下载当前平台的 opencode 二进制：

| 平台 | postinstall 下载的二进制 |
|------|------------------------|
| Linux x64 | `opencode-linux-x64.tar.gz` |
| Windows x64 | `opencode-windows-x64.zip` |
| macOS arm64 | `opencode-darwin-arm64.zip` |

切换平台时只需重新 `npm install`，无需手动管理二进制。

## Windows 打包方案（仅说明）

```json
"win": {
  "target": ["NSIS"]
}
```

- `extraResources` 配置完全一致，Windows 上自动下载 `.exe` 版本
- 输出：`dist/tdbot Setup x.y.z.exe`（NSIS 安装包）
- 交叉编译：Linux 上打包 Windows 需额外安装 `wine`
