/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新功能
        'fix', // 修 bug
        'docs', // 純文件
        'style', // 格式（不影響邏輯）
        'refactor', // 重構（不新功能也不修 bug）
        'perf', // 效能優化
        'test', // 加測試
        'chore', // 雜事（build / deps / config）
        'revert', // 撤銷
        'wip', // work in progress
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'scope-enum': [
      2,
      'always',
      [
        'seo', // SEO / metadata
        'motion', // framer-motion
        'visual', // 視覺 / UI 重設計
        'tokens', // design tokens
        'content', // 文案 / FAQ
        'form', // 表單互動
        'a11y', // 無障礙
        'dx', // developer experience
        'workflow', // 業務員工作流
        'theme', // dark mode
        'pwa', // service worker / offline
        'monitor', // web vitals / sentry
        'batch', // 批次估算
        'cleanup', // dev console.log / inline color
        'security', // CSP / rate limit
      ],
    ],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [1, 'always'],
    'body-max-line-length': [2, 'always', 200],
  },
}
