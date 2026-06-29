import React from 'react';
import { ArrowRight, BookOpen, Cloud, PenLine } from 'lucide-react';

const TODAY_TASKS_ZH = [
  '回复必须回的消息',
  '整理仓库地址和搬家资料',
  '下午去一趟地下室',
  '晚上早点休息',
];

const TODAY_TASKS_EN = [
  'Reply to the messages that need an answer',
  'Sort the warehouse address and moving notes',
  'Stop by the basement in the afternoon',
  'Rest earlier tonight',
];

function PrivateChatJournalPanel({ contact, lang = 'zh', onOpenDiary }) {
  const isEn = lang === 'en';
  const tasks = isEn ? TODAY_TASKS_EN : TODAY_TASKS_ZH;

  return (
    <aside className="private-chat-journal" aria-label={isEn ? "Today's diary" : '今日日记'}>
      <div className="private-chat-journal__head">
        <span className="private-chat-journal__icon">
          <BookOpen size={17} />
        </span>
        <div>
          <h3>{isEn ? "Today's Diary" : '今日日记'}</h3>
          <p>{isEn ? '20:00 auto written' : '20:00 自动生成'}</p>
        </div>
        <span className="private-chat-journal__weather">
          <Cloud size={14} />
        </span>
      </div>

      <section className="private-chat-journal__section">
        <div className="private-chat-journal__section-title">
          <PenLine size={14} />
          <span>{isEn ? 'Today' : '今天准备做'}</span>
        </div>
        <ul className="private-chat-journal__tasks">
          {tasks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="private-chat-journal__note private-chat-journal__note--soft">
        <span>{isEn ? 'For you' : '想对你说'}</span>
        <p>
          {isEn
            ? 'There is a lot on the table today. Finish the urgent pieces first, then let the rest wait.'
            : '今天事情有点多，先把最急的做完就好。不用一次整理完，能往前推一点就算很好了。'}
        </p>
      </section>

      <section className="private-chat-journal__note">
        <span>{isEn ? 'Remember' : '记一下'}</span>
        <p>
          {isEn
            ? `The day is still moving. ${contact?.name || 'This chat'} can stay here when you need a slower place.`
            : '今天赚到了一百七。搬家这件事还没完全结束，但已经在往前走了。'}
        </p>
      </section>

      <button type="button" className="private-chat-journal__button" onClick={onOpenDiary}>
        <span>{isEn ? 'Open diary' : '打开日记库'}</span>
        <ArrowRight size={16} />
      </button>
    </aside>
  );
}

export default PrivateChatJournalPanel;
