export interface MenuItem {
  id: string;
  title: string;
  icon: string;
  href?: string;
  children?: MenuItem[];
}

export const sidebarItems: MenuItem[] = [
  {
    id: 'embedded',
    title: '嵌入式入门',
    icon: 'chip',
    children: [
      { id: 'rank-rookie', title: '菜鸟', href: '#' },
      { id: 'rank-bronze', title: '青铜', href: '#' },
      { id: 'rank-silver', title: '白银', href: '#' },
      { id: 'rank-gold', title: '黄金', href: '#' },
      { id: 'rank-platinum', title: '白金', href: '#' },
      { id: 'rank-diamond', title: '钻石', href: '#' },
      { id: 'rank-master', title: '大师', href: '#' },
      { id: 'rank-predator', title: '猎杀', href: '#' },
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

