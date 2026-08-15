<script setup lang="ts">
/**
 * NewSession ── 智能问答「新建会话」页面
 *
 * 输入框（.qa-input）UI 规范说明：
 * ------------------------------------------------------------------------------
 * 1. 视觉样式
 *   - 卡片容器：圆角 16px、1px 边框（--el-border-color）、背景 --el-fill-color-blank
 *   - 默认态：边框灰色；hover/focus-within：边框变主色 + 2px 主色阴影（15% 透明）
 *   - 内部布局：上方多行 textarea + 下方水平工具栏（左右两段）
 *
 * 2. 占位符文本（placeholder）
 *   - "今天帮你做些什么？@ 引用对话文件，/ 调用技能与指令"
 *   - 颜色 --el-text-color-placeholder，size 14px
 *
 * 3. 输入验证规则
 *   - 长度上限：MAX_INPUT = 2000（maxlength 限制；超出后输入框边框变红 + 字数计数变红）
 *   - 空内容：发送按钮置灰禁用
 *   - 发送中（sending=true）：整框 disabled 不可编辑
 *   - @ 引用对话文件 /  指令：仅占位提示，预留扩展
 *
 * 4. 错误提示方式
 *   - 超长：右侧字数计数显示红字；不弹 toast，避免打断输入
 *   - 空发送：发送按钮置灰禁用，无须 toast
 *   - 失败/异常：调用 ElMessage.error（由调用方决定）
 *
 * 5. 聚焦与失焦状态（@focus / @blur → inputFocused）
 *   - focus：容器边框与阴影变主色
 *   - blur：恢复默认边框；阴影消失
 *
 * 6. 辅助元素
 *   - 字数统计：右下角 "x / 2000"，>= MAX_INPUT 时变红（.over）
 *   - 清空按钮：未启用（参考图无；改用 Esc 清空，Escape 键监听）
 *   - 发送按钮：圆形主色按钮，loading 状态显示旋转图标
 *   - 工具栏左侧：头像 + 「工作台搭建师」标签
 *   - 工具栏右侧：模型下拉（Hy3 / GPT-4o / Claude / Gemini）+ 语音切换按钮 + 发送
 *   - 左下角独立圆形 + 按钮（绝对定位）展开菜单：文件、模式、专家、技能、连接器
 * ------------------------------------------------------------------------------
 */
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { useTheme } from '@mic/utils'

defineOptions({ name: 'NewSession' })

interface ChatMessage {
  id: number
  role: 'user' | 'ai'
  content: string
  /** 是否正在流式输出（AI 消息） */
  streaming?: boolean
}

const { currentTheme } = useTheme()
const editorTheme = computed(() => (currentTheme.value === 'dark' ? 'dark' : 'light'))

const MAX_INPUT = 2000
const messages = ref<ChatMessage[]>([])
const input = ref('')
const sending = ref(false)
const inputFocused = ref(false)
const micOn = ref(false)
const scrollRef = ref<HTMLElement | null>(null)
let msgId = 0

// 加号弹出菜单
const plusMenuVisible = ref(false)
const plusMenuRef = ref<HTMLElement | null>(null)

const suggestions = [
  '帮我总结一下本周的系统公告',
  '如何快速发布一篇文档？',
  '解释一下微前端架构的优缺点',
  '给我一些提升工作效率的建议',
]

const isEmpty = computed(() => messages.value.length === 0)

async function scrollToBottom() {
  await nextTick()
  const el = scrollRef.value
  if (el) el.scrollTop = el.scrollHeight
}

function appendUserMessage(text: string) {
  messages.value.push({ id: ++msgId, role: 'user', content: text })
}

function createAiMessage(): ChatMessage {
  const msg: ChatMessage = { id: ++msgId, role: 'ai', content: '', streaming: true }
  messages.value.push(msg)
  return msg
}

/** 模拟大模型流式回复 */
function fakeStreamReply(userText: string): string {
  const replies: Record<string, string> = {
    '帮我总结一下本周的系统公告':
      '本周系统公告如下：\n\n1. **系统升级**：周一凌晨进行了鉴权模块优化，登录更流畅。\n2. **新增功能**：文档管理支持一键发布。\n3. **维护提醒**：周五晚将进行数据备份，请提前保存工作。\n\n如需查看详情，可前往「首页大盘 → 系统公告」。',
    '如何快速发布一篇文档？':
      '发布文档只需三步：\n\n1. 进入「文档管理 → 新增文档」填写标题与正文。\n2. 上传或填写封面图（支持 jpeg/png，≤2MB）。\n3. 点击「发布」即可上架。\n\n> 小贴士：可在「发布管理」中随时下架或编辑已发布内容。',
    '解释一下微前端架构的优缺点':
      '**微前端（Micro-Frontends）** 将前端应用拆分为独立子应用，由基座统一调度。\n\n**优点**\n- 技术栈无关，团队可独立开发部署\n- 故障隔离，单个子应用崩溃不影响整体\n- 增量升级，便于大型系统演进\n\n**缺点**\n- 基础设施复杂（通信、样式隔离）\n- 性能开销（多应用加载）\n- 需要统一的工程规范',
    '给我一些提升工作效率的建议':
      '几条实用建议：\n\n- 🎯 用「待办事项」把任务拆小，逐个击破\n- 🔁 批量处理同类工作，减少上下文切换\n- 🤖 善用「智能问答」快速获取资料，不必四处翻文档\n- ⏰ 番茄工作法：25 分钟专注 + 5 分钟休息',
  }
  if (replies[userText]) return replies[userText]
  return `已收到你的问题：「${userText}」\n\n这是一个演示用的智能问答界面，回复由本地模拟生成。你可以通过「模型配置」接入真实的大模型 API，替换 \`fakeStreamReply\` 即可实现真实流式对话。`
}

async function streamTo(msg: ChatMessage, full: string) {
  const tokens = full.match(/./gu) ?? []
  for (const ch of tokens) {
    msg.content += ch
    await new Promise((r) => setTimeout(r, 12))
    if (msg.id % 1 === 0) await nextTick()
  }
  msg.streaming = false
}

async function send(text?: string) {
  const content = (text ?? input.value).trim()
  if (!content || sending.value) return
  appendUserMessage(content)
  input.value = ''
  sending.value = true
  await scrollToBottom()

  const ai = createAiMessage()
  await scrollToBottom()
  const reply = fakeStreamReply(content)
  await streamTo(ai, reply)
  sending.value = false
  await scrollToBottom()
}

/** Esc 清空输入（聚焦时） */
function onInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && input.value) {
    input.value = ''
    e.stopPropagation()
  }
}
onUnmounted(() => {
  /* input 保留 */
})

function useSuggestion(s: string) {
  send(s)
}

function togglePlusMenu() {
  plusMenuVisible.value = !plusMenuVisible.value
}

function closePlusMenu() {
  plusMenuVisible.value = false
}

// 右侧配置面板
const configOpen = ref(true)
const enhancePrompt = ref(
  '你是一个专业、严谨的智能问答助手。回答时请：\n1. 先给出结论，再展开说明；\n2. 涉及数据或步骤时尽量结构化呈现；\n3. 不确定时明确说明，不要编造。',
)
const modelSettings = ref({
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
  stream: true,
})

// 可选模型
const modelOptions = ['Hy3', 'GPT-4o', 'Claude', 'Gemini']
const selectedModel = ref('Hy3')

// 加号菜单项
interface PlusMenuItem {
  icon: string
  label: string
  desc?: string
}
const plusItems: PlusMenuItem[] = [
  { icon: 'Paperclip', label: '添加文件', desc: '上传文件辅助问答' },
  { icon: 'MagicStick', label: '模式', desc: '切换对话模式' },
  { icon: 'UserFilled', label: '专家', desc: '选择领域专家' },
  { icon: 'Tools', label: '技能', desc: '启用增强技能' },
  { icon: 'Link', label: '连接器', desc: '连接外部服务' },
]

function handlePlusItem(item: PlusMenuItem) {
  closePlusMenu()
  ElMessage.info(`「${item.label}」功能开发中`)
}

watch(
  () => messages.value.length,
  () => scrollToBottom(),
)

// 点击外部关闭菜单
function onBodyClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  // 如果点击的不是加号按钮或菜单本身，则关闭
  if (
    plusMenuVisible.value &&
    !plusMenuRef.value?.contains(target) &&
    !target.closest('.qa-input__plus')
  ) {
    closePlusMenu()
  }
}
</script>

<template>
  <div class="qa-chat" @click="onBodyClick">
    <!-- 主区：对话流 + 右侧配置面板 -->
    <div class="qa-chat__main">
      <!-- 对话流 -->
      <div ref="scrollRef" class="qa-chat__body">
        <!-- 空状态：欢迎 + 建议问题 -->
        <div v-if="isEmpty" class="qa-welcome">
          <div class="qa-welcome__logo">
            <el-icon :size="40"><ChatDotRound /></el-icon>
          </div>
          <h2 class="qa-welcome__title">你好，我是智能问答助手</h2>
          <p class="qa-welcome__sub">有什么可以帮你的吗？你可以直接提问，或试试下面的示例：</p>
          <div class="qa-suggest">
            <button
              v-for="s in suggestions"
              :key="s"
              class="qa-suggest__item"
              type="button"
              @click="useSuggestion(s)"
            >
              <el-icon><MagicStick /></el-icon>
              <span>{{ s }}</span>
            </button>
          </div>
        </div>

        <!-- 消息气泡 -->
        <div
          v-for="m in messages"
          :key="m.id"
          class="qa-msg"
          :class="m.role === 'user' ? 'qa-msg--user' : 'qa-msg--ai'"
        >
          <div class="qa-msg__avatar">
            <el-icon v-if="m.role === 'ai'" :size="20"><Cpu /></el-icon>
            <el-icon v-else :size="20"><UserFilled /></el-icon>
          </div>
          <div class="qa-msg__bubble">
            <MdPreview
              v-if="m.content"
              :model-value="m.content"
              :theme="editorTheme"
              :code-foldable="false"
              preview-only
            />
            <span v-else class="qa-msg__typing">
              <i></i><i></i><i></i>
            </span>
          </div>
        </div>

        <!-- 输入区：默认跟随内容流（不固定）；内容超过一页时 sticky 吸底 -->
        <div class="qa-chat__footer">
          <div class="qa-input-wrap">
            <!-- 输入框容器 -->
            <div class="qa-input">
              <textarea
                v-model="input"
                class="qa-input__area"
                :class="{ over: inputFocused && input.length >= MAX_INPUT }"
                :disabled="sending"
                :maxlength="MAX_INPUT"
                placeholder="今天帮你做些什么？@ 引用对话文件，/ 调用技能与指令"
                rows="2"
                @keydown.enter.exact.prevent="send()"
                @keydown="onInputKeydown"
                @focus="inputFocused = true"
                @blur="inputFocused = false"
              />
              <div class="qa-input__bar">
                <div class="qa-input__bar-left">
                  <!-- 加号按钮（位于输入框内左下角，工作台搭建师左侧） -->
                  <button
                    class="qa-input__plus"
                    :class="{ active: plusMenuVisible }"
                    type="button"
                    @click.stop="togglePlusMenu"
                  >
                    <el-icon :size="18"><Plus /></el-icon>
                  </button>
                  <span class="qa-model-tag">
                    <el-avatar :size="20" src="" style="background: var(--el-color-primary); font-size: 10px;">H</el-avatar>
                    工作台搭建师
                  </span>
                </div>
                <div class="qa-input__bar-right">
                  <span class="qa-input__count" :class="{ over: input.length >= MAX_INPUT }">
                    {{ input.length }} / {{ MAX_INPUT }}
                  </span>
                  <el-dropdown trigger="click" @command="(cmd: string) => { selectedModel = cmd; ElMessage.success(`已切换模型：${cmd}`) }">
                    <button class="qa-tool-btn qa-model-switch" title="切换模型">
                      <el-icon class="qa-model-switch__icon"><Brush /></el-icon>
                      {{ selectedModel }}
                      <el-icon><ArrowDown /></el-icon>
                    </button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item v-for="m in modelOptions" :key="m" :command="m">{{ m }}</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                  <button
                    class="qa-tool-btn qa-tool-btn--mic"
                    :class="{ active: micOn }"
                    title="语音输入"
                    @click="micOn = !micOn"
                  >
                    <el-icon><Microphone /></el-icon>
                  </button>
                  <button class="qa-send-btn" :disabled="sending || !input.trim()" @click="send()">
                    <el-icon v-if="!sending"><Promotion /></el-icon>
                    <el-icon v-else class="spin"><Loading /></el-icon>
                  </button>
                </div>
              </div>
            </div>

            <!-- 加号弹出菜单 -->
            <Transition name="qa-plus-fade">
              <div v-if="plusMenuVisible" ref="plusMenuRef" class="qa-plus-menu">
                <button
                  v-for="item in plusItems"
                  :key="item.label"
                  class="qa-plus-menu__item"
                  type="button"
                  @click.stop="handlePlusItem(item)"
                >
                  <el-icon :size="18"><component :is="item.icon" /></el-icon>
                  <span>{{ item.label }}</span>
                  <el-icon class="arrow"><ArrowRight /></el-icon>
                </button>
              </div>
            </Transition>
          </div>

          <p class="qa-chat__hint">内容由 AI 生成，请核实重要信息。</p>
        </div>
      </div>

      <!-- 右侧配置面板 -->
      <aside class="qa-config" :class="{ collapsed: !configOpen }">
        <div class="qa-config__head">
          <span class="qa-config__title">对话设置</span>
          <button class="qa-config__toggle" title="折叠" @click="configOpen = false">
            <el-icon><Close /></el-icon>
          </button>
        </div>

        <!-- 增强提示词 -->
        <section class="qa-config__section">
          <div class="qa-config__label">
            <el-icon><MagicStick /></el-icon> 增强提示词
          </div>
          <el-input
            v-model="enhancePrompt"
            type="textarea"
            :rows="6"
            resize="none"
            placeholder="输入系统提示词，约束 AI 的回答风格与范围"
          />
          <p class="qa-config__tip">该提示词将作为对话的系统指令前置注入。</p>
        </section>

        <!-- 选择模型设置 -->
        <section class="qa-config__section">
          <div class="qa-config__label">
            <el-icon><Cpu /></el-icon> 模型设置
          </div>
          <div class="qa-config__field">
            <span class="qa-config__field-label">模型</span>
            <el-select v-model="selectedModel" size="default" style="width: 100%">
              <el-option v-for="m in modelOptions" :key="m" :label="m" :value="m" />
            </el-select>
          </div>
          <div class="qa-config__field">
            <span class="qa-config__field-label">
              温度 {{ modelSettings.temperature.toFixed(1) }}
            </span>
            <el-slider v-model="modelSettings.temperature" :min="0" :max="1" :step="0.1" />
          </div>
          <div class="qa-config__field">
            <span class="qa-config__field-label">
              最大 Token {{ modelSettings.maxTokens }}
            </span>
            <el-slider v-model="modelSettings.maxTokens" :min="256" :max="8192" :step="256" />
          </div>
          <div class="qa-config__field">
            <span class="qa-config__field-label">
              随机性 Top-P {{ modelSettings.topP.toFixed(1) }}
            </span>
            <el-slider v-model="modelSettings.topP" :min="0" :max="1" :step="0.1" />
          </div>
          <div class="qa-config__switch">
            <span>流式输出</span>
            <el-switch v-model="modelSettings.stream" />
          </div>
        </section>
      </aside>
    </div>

    <!-- 展开配置面板按钮（折叠态显示） -->
    <Transition name="qa-fade">
      <button v-if="!configOpen" class="qa-config-reopen" title="展开对话设置" @click="configOpen = true">
        <el-icon><Setting /></el-icon>
      </button>
    </Transition>

  </div>
</template>

<style scoped>
.qa-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.qa-chat__main {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.qa-chat__body {
  flex: 1;
  overflow-y: auto;
  padding: 24px max(16px, 6%) 0;
  scroll-behavior: smooth;
}

/* 欢迎区 */
.qa-welcome {
  max-width: 720px;
  margin: 6vh auto 0;
  text-align: center;
}
.qa-welcome__logo {
  width: 72px;
  height: 72px;
  margin: 0 auto 16px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(135deg, var(--el-color-primary), color-mix(in srgb, var(--el-color-primary) 55%, #8b5cf6));
  box-shadow: 0 8px 24px color-mix(in srgb, var(--el-color-primary) 35%, transparent);
}
.qa-welcome__title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 600;
}
.qa-welcome__sub {
  margin: 0 0 24px;
  color: var(--el-text-color-secondary);
}
.qa-suggest {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.qa-suggest__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  text-align: left;
  font-size: 14px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.qa-suggest__item:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--el-color-primary) 18%, transparent);
}
.qa-suggest__item .el-icon {
  flex-shrink: 0;
}

/* 消息气泡 */
.qa-msg {
  display: flex;
  gap: 12px;
  max-width: 820px;
  margin: 0 auto 20px;
}
.qa-msg--user {
  flex-direction: row-reverse;
}
.qa-msg__avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #fff;
}
.qa-msg--ai .qa-msg__avatar {
  background: linear-gradient(135deg, var(--el-color-primary), #8b5cf6);
}
.qa-msg--user .qa-msg__avatar {
  background: var(--el-color-info);
}
.qa-msg__bubble {
  min-width: 0;
  max-width: 78%;
  padding: 4px 14px;
  border-radius: 14px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  line-height: 1.7;
}
.qa-msg--user .qa-msg__bubble {
  background: color-mix(in srgb, var(--el-color-primary) 12%, var(--el-bg-color));
  border-color: color-mix(in srgb, var(--el-color-primary) 30%, transparent);
}
.qa-msg__bubble :deep(.md-editor-preview) {
  background: transparent;
  font-size: 14px;
}
.qa-msg__bubble :deep(.md-editor-preview-wrapper) {
  padding: 0;
}

/* 打字动画 */
.qa-msg__typing {
  display: inline-flex;
  gap: 4px;
  padding: 8px 2px;
}
.qa-msg__typing i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--el-color-primary);
  animation: qa-bounce 1.2s infinite ease-in-out;
}
.qa-msg__typing i:nth-child(2) { animation-delay: 0.2s; }
.qa-msg__typing i:nth-child(3) { animation-delay: 0.4s; }
@keyframes qa-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-6px); opacity: 1; }
}

/* ====== 底部输入区 ====== */
.qa-chat__footer {
  /* 默认跟随内容流（位于最后一条消息之后）；内容超过一页时 sticky 吸底 */
  position: sticky;
  bottom: 0;
  margin-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  padding: 12px max(16px, 2%) 10px;
  background: var(--el-bg-color);
  /* 吸底时遮挡滚过的消息内容 */
  box-shadow: 0 -8px 16px -8px rgba(0, 0, 0, 0.06);
  z-index: 3;
}

/* 输入外层容器（含加号+输入框+弹出菜单） */
.qa-input-wrap {
  position: relative;
  max-width: 900px;
  margin: 0 auto;
}

/* 加号按钮（输入框内左下角，工具栏内联） */
.qa-input__plus {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  cursor: pointer;
  display: grid;
  place-items: center;
  color: var(--el-text-color-regular);
  transition: all 0.2s ease;
}
.qa-input__plus:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.qa-input__plus.active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  transform: rotate(45deg);
  background: var(--el-color-primary-light-9);
}

/* 输入框卡片 */
.qa-input {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color);
  border-radius: 16px;
  padding: 12px 14px 8px;
  background: var(--el-fill-color-blank);
  transition: border-color 0.2s ease;
}
.qa-input:focus-within {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-color-primary) 15%, transparent);
}

/* textarea */
.qa-input__area {
  width: 100%;
  min-height: 52px;
  max-height: 160px;
  line-height: 1.65;
  font-size: 14px;
  color: var(--el-text-color-primary);
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-family: inherit;
}
.qa-input__area::placeholder {
  color: var(--el-text-color-placeholder);
}

/* 底部工具栏 */
.qa-input__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
}
.qa-input__bar-left,
.qa-input__bar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 模式下拉 */
.qa-model-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  transition: all 0.15s;
}
.qa-model-btn:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}

/* 模型标签 */
.qa-model-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--el-fill-color-light);
}

/* 工具按钮 */
.qa-tool-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.15s;
}
.qa-tool-btn:not(:disabled):hover {
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
}
.qa-tool-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
/* 麦克风激活态 */
.qa-tool-btn--mic.active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.qa-input__count {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
  margin-right: 4px;
  transition: color 0.15s;
}
.qa-input__count.over {
  color: var(--el-color-danger);
  font-weight: 600;
}
/* 超长时输入框容器红边 */
.qa-input:has(.qa-input__area.over) {
  border-color: var(--el-color-danger);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-color-danger) 20%, transparent);
}
.qa-model-switch {
  width: auto;
  padding: 0 6px;
  border-radius: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.qa-model-switch:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}
.qa-model-switch__icon {
  font-size: 14px;
}

/* 发送按钮 */
.qa-send-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: var(--el-color-primary);
  color: #fff;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--el-color-primary) 45%, transparent);
}
.qa-send-btn:not(:disabled):hover {
  transform: scale(1.06);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--el-color-primary) 55%, transparent);
}
.qa-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0); }
  to { transform: rotate(360deg); }
}

/* ====== 加号弹出菜单 ====== */
.qa-plus-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  min-width: 200px;
  padding: 8px;
  border-radius: 14px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
  z-index: 10;
}
.qa-plus-menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 14px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--el-text-color-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.qa-plus-menu__item:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}
.qa-plus-menu__item .arrow {
  margin-left: auto;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

/* 弹出动画 */
.qa-plus-fade-enter-active {
  animation: qa-pop-in 0.18s ease-out;
}
.qa-plus-fade-leave-active {
  animation: qa-pop-in 0.12s ease-in reverse;
}
@keyframes qa-pop-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ====== 右侧配置面板 ====== */
.qa-config {
  width: 320px;
  flex-shrink: 0;
  border-left: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.25s ease, opacity 0.2s ease;
}
.qa-config.collapsed {
  width: 0;
  opacity: 0;
  border-left: none;
}
.qa-config__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.qa-config__title {
  font-size: 15px;
  font-weight: 600;
}
.qa-config__toggle {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.15s;
}
.qa-config__toggle:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}
.qa-config__section {
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.qa-config__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--el-text-color-primary);
}
.qa-config__tip {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
}
.qa-config__field {
  margin-bottom: 14px;
}
.qa-config__field-label {
  display: block;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}
.qa-config__field :deep(.el-slider) {
  margin: 0 6px;
}
.qa-config__switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

/* 重新展开按钮 */
.qa-config-reopen {
  position: absolute;
  top: 14px;
  right: 16px;
  z-index: 5;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  cursor: pointer;
  display: grid;
  place-items: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;
}
.qa-config-reopen:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
}
.qa-fade-enter-active,
.qa-fade-leave-active {
  transition: opacity 0.2s ease;
}
.qa-fade-enter-from,
.qa-fade-leave-to {
  opacity: 0;
}

/* 提示文字 */
.qa-chat__hint {
  max-width: 900px;
  margin: 8px auto 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}

@media (max-width: 1024px) {
  .qa-config { position: absolute; top: 0; right: 0; bottom: 0; width: 300px; z-index: 6; box-shadow: -8px 0 24px rgba(0,0,0,0.1); }
  .qa-config.collapsed { width: 0; }
}
@media (max-width: 640px) {
  .qa-suggest { grid-template-columns: 1fr; }
  .qa-msg__bubble { max-width: 85%; }
  .qa-input__plus { width: 28px; height: 28px; }
  .qa-plus-menu { left: 0; }
  .qa-model-tag { display: none; }
}
</style>

<!-- 全局样式：让容器撑满高度并禁止外层滚动，确保输入框固定底部 -->
<style>
/* qa-app root：独立运行和集成态均生效 */
html, body, #app {
  height: 100%;
  margin: 0;
}
#app {
  overflow: hidden;
}
/* 独立运行时 BasicLayout 的 main 不滚动、撑满高度 */
#app .basic-layout__main {
  overflow: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>
