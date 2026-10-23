// Share simultaneous reads; discard replies after account/project changes.
export function projectLoader(scope,read,apply){
 const pending=new Map();let generation=0;
 const load=()=>{
  const captured=scope(),key=JSON.stringify(captured),version=generation;
  if(pending.has(key))return pending.get(key);
  const promise=Promise.resolve().then(()=>read(captured)).then(value=>{
   if(version===generation&&key===JSON.stringify(scope()))apply(value);
   return value;
  }).finally(()=>{if(pending.get(key)===promise)pending.delete(key)});
  pending.set(key,promise);return promise;
 };
 load.invalidate=()=>{generation++;pending.clear()};return load;
}
