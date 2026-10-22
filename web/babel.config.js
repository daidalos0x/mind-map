module.exports = {
  presets: ['@vue/cli-plugin-babel/preset'],
  plugins: [
    // element-ui 按需引入：只打包实际用到的组件及其 theme-chalk 样式
    [
      'component',
      {
        libraryName: 'element-ui',
        styleLibraryName: 'theme-chalk'
      }
    ]
  ]
}
