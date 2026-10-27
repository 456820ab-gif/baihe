import { createApp } from 'vue';
import OpeningApp from '../../界面/开局表单/App.vue';
import { hostDocument, teleportStyles } from './host';

interface OpeningOptions {
  /** 提交动作开始：此时仍在用户手势里，用来请求全屏 */
  onSubmitStart: () => void;
  /** 第一条消息已创建并触发完成 */
  onSubmitted: () => void;
}

export function mountOpening(host: HTMLElement, options: OpeningOptions) {
  const app = createApp(OpeningApp, {
    embedded: true,
    onSubmitStart: options.onSubmitStart,
    onSubmitted: options.onSubmitted,
  });
  app.mount(host);
  teleportStyles(hostDocument());
  return () => {
    app.unmount();
  };
}
