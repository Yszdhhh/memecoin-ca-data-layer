# Dune CLI 与 API 使用说明文档

本文档为 **链上战壕 (On-chain Trench)** 项目专门编写的 Dune 数据接口及 CLI 使用指引。

## 1. 环境与安装说明

我已经为您在当前 Windows 系统中完成了以下配置：
- **Dune CLI (命令行工具)**：已下载最新版，并将其添加至系统的环境变量路径 (`C:\Users\10639\bin`)，您可以在任意命令行终端（PowerShell / CMD）中直接运行 `dune` 命令。
- **API 密钥配置**：为您指定的 API Key (`Rlns2QoUn2y6vovEtkjBQ7Vtpzp0nw3C`) 已通过全局环境变量 `DUNE_API_KEY` 进行了配置。Dune CLI 运行时会自动识别该密钥，无需再手动输入。

## 2. 如何使用 Dune CLI

打开终端并进入 `G:\链上战壕` 目录后，您可以执行以下常用操作：

### 2.1 检查配置状态
```bash
# 验证您的身份以及 API Key 是否有效
dune auth status
```

### 2.2 执行查询 (Queries)
您可以直接从命令行执行已有的 Dune SQL 查询，并获取结果。
```bash
# 运行某个 Query 并获取结果 (将 123456 替换为您的真实 Query ID)
dune query execute 123456
```

### 2.3 获取实时链上数据 (Simulation / Auth)
Dune 提供了实时的余额、Token、NFT 等状态读取。
```bash
dune sim auth
```

## 3. 为 AI Agent (如 Cursor / 各种编程助手) 配置 Dune Skills

如果您在 `链上战壕` 项目中使用了 Cursor 或其他支持 MCP/Skills 规范的 AI 编程 Agent，Dune 官方提供了专门的 Agent Skills，能让 AI 直接拥有编写复杂 Dune SQL 并拉取区块链数据的能力。

**安装 Dune Agent Skills 的命令：**
在项目根目录（`G:\链上战壕`）的终端中运行：
```bash
npx skills add duneanalytics/skills
```
*(注：需要本地已安装 Node.js 与 npm 环境)*

安装完成后，Agent 就能够自主访问 Dune 的数据库结构，甚至为您生成专业的链上数据分析看板代码。

## 4. 常见问题
- **如果提示 `dune` 不是内部或外部命令**：请重启您的终端窗口（如 VS Code 的终端或 PowerShell），让环境变量生效。
- **重新配置 API Key**：如果后续需要更换 API Key，可以直接在 Windows 的环境变量设置中修改 `DUNE_API_KEY`，或者在终端运行 `dune auth` 重新绑定。
