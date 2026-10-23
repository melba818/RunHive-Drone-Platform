import {describe,it,expect} from 'vitest';
import {initialAgentPath} from '../src/lib/runhive-navigation';
describe('RunHive center landing',()=>{
  const setLocation=(pathname:string,search='')=>Object.defineProperty(globalThis,'location',{configurable:true,value:{pathname,search}});
  it('defaults to the draft without selecting the last session',()=>{
    setLocation('/llm-center/agent/ui/');expect(initialAgentPath()).toBe('/chat/new');
    setLocation('/llm-center/agent/ui/','?section=projects');expect(initialAgentPath()).toBe('/chat/new');
  });
  it('preserves explicit management and terminal entries',()=>{
    setLocation('/llm-center/agent/ui/','?section=models');expect(initialAgentPath()).toBe('/models');
    setLocation('/llm-center/agent/ui/terminal','?id=known');expect(initialAgentPath()).toBe('/terminal?id=known');
    setLocation('/llm-center/agent/ui/chat/known');expect(initialAgentPath()).toBe('/chat/known');
  });
});
