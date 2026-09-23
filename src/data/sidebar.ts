export interface MenuItem {
  id: string;
  title: string;
  icon: string;
  href?: string;
  badge?: string;
  children?: MenuItem[];
}

export const sidebarItems: MenuItem[] = [
  {
    id: 'embedded',
    title: '嵌入式入门',
    icon: 'chip',
    children: [
      {
        id: 'rank-rookie',
        title: '菜鸟',
        badge: '/ranks/rookie.png',
        children: [
          { id: 'rookie-pc-setup', title: '电脑选购与必备工具', href: '/embedded/rookie' }
        ]
      },
      {
        id: 'rank-bronze',
        title: '青铜',
        badge: '/ranks/bronze.png',
        children: [
          { id: 'bronze-c-lang', title: 'C语言基础与编译器', href: '/embedded/bronze' }
        ]
      },
      {
        id: 'rank-silver',
        title: '白银',
        badge: '/ranks/silver.png',
        children: [
          { id: 'silver-stm32-std', title: 'STM32标准库开发', href: '/embedded/silver' }
        ]
      },
      { id: 'rank-gold', title: '黄金', href: '#', badge: '/ranks/gold.png' },
      { id: 'rank-platinum', title: '白金', href: '#', badge: '/ranks/platinum.png' },
      { id: 'rank-diamond', title: '钻石', href: '#', badge: '/ranks/diamond.png' },
      { id: 'rank-master', title: '大师', href: '#', badge: '/ranks/master.png' },
      { id: 'rank-predator', title: '猎杀', href: '#', badge: '/ranks/predator.png' },
    ]
  },
  {
    id: 'mcu',
    title: '单片机模块',
    icon: 'cube',
    children: [
      { id: 'stm32', title: 'STM32系列', href: '#' },
      { id: 'esp32', title: 'ESP32 / 物联网', href: '#' },
      { id: 'sensors', title: '常用传感器模块', href: '#' }
    ]
  },
  {
    id: 'ai',
    title: 'AI',
    icon: 'sparkles',
    children: [
      { id: 'llm', title: '大模型与应用', href: '#' },
      { id: 'edge-ai', title: '端侧 AI 部署', href: '#' }
    ]
  },
  {
    id: 'projects',
    title: '项目实例',
    icon: 'folder',
    children: [
      { id: 'hardware-proj', title: '硬件开发实例', href: '#' },
      { id: 'software-proj', title: '全栈/脚本实战', href: '#' }
    ]
  },
  {
    id: 'games',
    title: '游戏分享',
    icon: 'gamepad',
    children: [
      { id: 'game-rec', title: '精选游戏推荐', href: '#' },
      { id: 'game-mod', title: 'MOD与配置指南', href: '#' }
    ]
  },
  {
    id: 'pc-knowledge',
    title: '电脑知识',
    icon: 'monitor',
    children: [
      { id: 'pc-hardware', title: '装机与硬件科普', href: '#' },
      { id: 'pc-efficiency', title: '实用生产力工具', href: '#' }
    ]
  },
  {
    id: 'sponsor',
    title: '无偿赞助',
    icon: 'heart',
    href: '/sponsor'
  }
];

