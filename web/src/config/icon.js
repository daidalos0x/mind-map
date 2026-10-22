// 图标数据（约 550KB 的内联 SVG / base64）单独放在 icon-data.json 里：
// 让 webpack 走 JSON 模块而不是把它交给 Babel 转译，避免超过 500KB 触发
// "[BABEL] Note: The code generator has deoptimised the styling ..." 提示。
import iconData from './icon-data.json'

const { iconList, weekdayList, avatarList, starList, flagList, weatherList } = iconData

export default [
  {
    name: '多彩标记图标', // 分组名称
    type: 'sign2', // 分组的值
    list: iconList.map((item, index) => {
      return {
        name: String(index + 1),
        icon: item
      }
    })
  },
  {
    name: '星期', // 分组名称
    type: 'weekday', // 分组的值
    list: weekdayList.map((item, index) => {
      return {
        name: String(index + 1),
        icon: item
      }
    })
  },
  {
    name: '头像', // 分组名称
    type: 'avatar', // 分组的值
    list: avatarList.map((item, index) => {
      return {
        name: String(index + 1),
        icon: item
      }
    })
  },
  {
    name: '五角星', // 分组名称
    type: 'star', // 分组的值
    list: starList.map((item, index) => {
      return {
        name: String(index + 1),
        icon: item
      }
    })
  },
  {
    name: '旗帜', // 分组名称
    type: 'flag', // 分组的值
    list: flagList.map((item, index) => {
      return {
        name: String(index + 1),
        icon: item
      }
    })
  },
  {
    name: '天气', // 分组名称
    type: 'weather', // 分组的值
    list: weatherList.map((item, index) => {
      return {
        name: String(index + 1),
        icon: item
      }
    })
  }
]
