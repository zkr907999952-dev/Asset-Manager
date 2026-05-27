export type DialogueTrigger =
  | 'idle'
  | 'low_pressure'
  | 'medium_pressure'
  | 'high_pressure'
  | 'critical_pressure'
  | 'explosion'
  | 'pain_low'
  | 'pain_high'
  | 'pleasure_low'
  | 'pleasure_medium'
  | 'pleasure_high'
  | 'grab'
  | 'vibrate'
  | 'needle_pierce'
  | 'enema_start'
  | 'enema_enter_small'
  | 'intestine_break'
  | 'rupture'
  | 'electric'
  | 'stirring';

export const DIALOGUES: Record<DialogueTrigger, string[]> = {
  idle: [
    '……',
    '嗯……',
    '……（深呼吸）',
  ],
  low_pressure: [
    '呜……肚子感觉满满的……',
    '嗯……里面有点胀……',
    '啊……里面被填满了……',
  ],
  medium_pressure: [
    '哈……不行了……里面好撑……',
    '呜……肚子要鼓起来了……',
    '啊……撑得受不了……',
  ],
  high_pressure: [
    '不、不行……太撑了……要爆开了……！',
    '呜啊……里面压力太大了……！',
    '啊啊……好痛……撑太满了……！',
  ],
  critical_pressure: [
    '不行了不行了……！撑爆了……！',
    '啊啊啊……！要炸开了……！',
    '撑……撑太满了……要爆了……！',
  ],
  explosion: [
    '啊啊啊……！穿孔了……！',
    '呜……肠子……穿了个洞……',
    '不行……破了……好痛……',
  ],
  pain_low: [
    '嗯……有点痛……',
    '呜……疼……',
    '啊……轻点……',
  ],
  pain_high: [
    '啊啊……好痛……！求求你……',
    '不行……！太痛了……！',
    '呜呜……疼死了……！',
  ],
  pleasure_low: [
    '嗯……奇怪的感觉……',
    '啊……怎么有点……',
    '呜……身体感觉很奇怪……',
  ],
  pleasure_medium: [
    '嗯啊……不要……感觉好奇怪……',
    '哈……怎么……感觉这么好……',
    '呜……身体在发热……',
  ],
  pleasure_high: [
    '不……不行了……！好舒服……！',
    '哈啊……！要不行了……！',
    '啊……快感……太强了……！',
  ],
  grab: [
    '啊……！肠子被抓住了……！',
    '呜……别拽……！',
    '嗯……好奇怪的感觉……',
  ],
  vibrate: [
    '嗯啊……！里面在抖……！',
    '呜……振动……太强了……！',
    '哈……什么感觉……！',
  ],
  needle_pierce: [
    '啊！被刺到了……！',
    '呜……刺进来了……好怪……',
    '嗯……肠子被刺穿了……',
  ],
  enema_start: [
    '呜……在灌什么进来……',
    '啊……里面有液体进来了……',
    '嗯……肚子开始胀了……',
  ],
  enema_enter_small: [
    '啊啊……！进……进小肠了……！太深了……！',
    '呜……不行……越来越深……！感觉穿过去了……！',
    '嗯啊……！液体……液体进到小肠里了……！好奇怪……！',
    '不……不要再进了……！已经进到小肠了……！',
  ],
  intestine_break: [
    '啊啊啊……！肠子断了……！',
    '不行了……！里面断了什么……！',
    '呜啊……！撕裂感……！',
  ],
  rupture: [
    '嗯……啊……穿孔了……',
    '不行……里面破了一个洞……',
    '啊……肠壁……破了……',
  ],
  electric: [
    '啊！！电……电到了……！',
    '呜啊……！麻麻的……！',
    '不行……！被电到了……！',
  ],
  stirring: [
    '呜……肠子……被搅动了……',
    '嗯……里面……在动……',
    '啊……不要搅了……',
  ],
};

export function getRandomDialogue(trigger: DialogueTrigger): string {
  const lines = DIALOGUES[trigger];
  return lines[Math.floor(Math.random() * lines.length)];
}
