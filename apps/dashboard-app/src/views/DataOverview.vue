<script setup lang="ts">
import { PageCard } from '@mic/components'

defineOptions({ name: 'DataOverview' })
</script>

<template>
  <div class="data-overview">
    <PageCard title="数据总览" subtitle="核心指标实时概览">
      <el-row :gutter="16">
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-card__label">文档总数</div>
            <div class="stat-card__value">1,286</div>
            <div class="stat-card__trend is-up">↑ 12.5%</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-card__label">今日访问</div>
            <div class="stat-card__value">8,432</div>
            <div class="stat-card__trend is-up">↑ 8.3%</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-card__label">活跃用户</div>
            <div class="stat-card__value">356</div>
            <div class="stat-card__trend is-down">↓ 3.2%</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-card__label">系统公告</div>
            <div class="stat-card__value">5</div>
            <div class="stat-card__trend">—</div>
          </div>
        </el-col>
      </el-row>
    </PageCard>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}
.stat-card__label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}
.stat-card__value {
  font-size: 28px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.stat-card__trend {
  font-size: 12px;
  margin-top: 6px;
  color: var(--el-text-color-secondary);
}
.stat-card__trend.is-up {
  color: var(--el-color-success);
}
.stat-card__trend.is-down {
  color: var(--el-color-danger);
}
</style>
