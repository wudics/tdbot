# 打包 Windows 程序

## 推荐方式：Windows 上原生编译

在 Linux（Deepin）上通过 `--dir` 生成的 `win-unpacked/` 中的 `opencode.exe` 是 **Linux ELF 格式**，在 Windows 上无法通过 Wine 运行。**建议直接在 Windows 机器上编译打包**。

### 环境准备

| 项目 | 说明 |
|------|------|
| Node.js | 安装 v18+（推荐 v20 LTS）：[nodejs.org](https://nodejs.org/) |
| 源码 | 将整个项目文件夹（不含 `node_modules/`）复制到 Windows |

### 打包步骤

```bash
# 1. 进入项目目录
cd tdbot-3.0.0

# 2. 安装依赖（opencode-ai 自动下载 Windows 二进制）
npm install

# 3. 构建并打包
npm run dist
```

### npm install 时自动发生

| 步骤 | 说明 |
|------|------|
| npm 安装 js 依赖 | ✅ |
| `opencode-ai` postinstall | 下载 `opencode-win32-x64.zip` → Windows PE 格式的 `.exe` |
| `electron` postinstall | 下载 `electron-v33.4.11-win32-x64.zip` |

### npm run dist 时

```
electron-vite build → out/
electron-builder   → dist/梯度小助手 Setup 1.0.0.exe
```

### 输出

```
dist/
├── win-unpacked/                    ← 便携版目录
│   ├── 梯度小助手.exe               ← 主程序（~181MB）
│   └── resources/
│       ├── app.asar
│       └── opencode.exe             ← Windows PE 格式，可正常执行
└── 梯度小助手 Setup 1.0.0.exe       ← NSIS 安装包
```

## 可选：在 Linux 上生成 Windows 目录（不依赖 Wine）

### 配置

```json
"scripts": {
  "dist:win": "electron-vite build && electron-builder --win --dir"
},
"build": {
  "linux": {
    "extraResources": [{
      "from": "node_modules/opencode-ai/bin/opencode.exe",
      "to": "opencode"
    }],
    "target": ["AppImage"]
  },
    "win": {
      "extraResources": [{
        "from": "node_modules/opencode-ai/bin/opencode.exe",
        "to": "opencode.exe"
      }],
      "target": ["dir", "nsis"],
      "icon": "resources/icon.png"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
```

**`extraResources` 按平台区分**： Linux → `opencode`（无扩展名），Windows → `opencode.exe`（带扩展名，`cross-spawn` 按 `PATHEXT` 可找到）

**NSIS 配置**： `oneClick: false` 显示安装界面，`allowToChangeInstallationDirectory: true` 允许用户自定义安装路径。

### 命令

```bash
npm run dist:win
```

### 注意

`win-unpacked/` 中的 `opencode.exe` 是 **Linux ELF 格式**，无法在 Wine 中运行。此方式仅适合生成目录结构给 Windows 机器复制用（需要在 Windows 上重新 `npm install` 覆盖二进制）。

## 国内镜像源

在 Windows 上若下载依赖缓慢，可配置国内镜像源加速：

```bash
# npm 镜像
npm config set registry https://registry.npmmirror.com/

# Electron 二进制镜像
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
```

## 图标要求

`resources/icon.png` 至少 **256×256** 像素，否则 electron-builder 会报错。

## 常见问题

### wine is required

```
⨯ wine is required, please see https://electron.build/multi-platform-build#linux
```

仅在使用 `--win`（不带 `--dir`）打包时需要 Wine。`--dir` 模式下此错误可忽略，`win-unpacked/` 已正常生成。

### 图标必须至少 256x256

```bash
python3 -c "
from PIL import Image
img = Image.open('resources/icon.png')
img.resize((256, 256), Image.LANCZOS).save('resources/icon.png')
"
```

### PATH 分隔符跨平台适配

```typescript
// main/index.ts
if (app.isPackaged) {
  const sep = process.platform === 'win32' ? ';' : ':'
  process.env.PATH = `${process.resourcesPath}${sep}${process.env.PATH}`
}
```

Linux/Unix 使用 `:`，Windows 使用 `;`，否则 Windows 上 PATH 拼接错误导致找不到 opencode 二进制。

### opencode.exe 在 Wine 下无法运行

错误：`Error: open EBADF` + 保存配置卡住

**根因**：Linux 上 `npm install` 下载的 `opencode.exe` 是 ELF 格式，Wine 无法执行。`restartOpencode()` 启动 opencode 子进程时永远超时。

**解决方案**：在 Windows 上原生编译运行，或在 Windows 上重新 `npm install` 覆盖二进制。
