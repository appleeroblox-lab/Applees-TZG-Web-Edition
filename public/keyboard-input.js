export function keyboardCode(event){if(event.code&&event.code!=='Unidentified')return event.code;const key=event.key||'';if(/^[a-z]$/i.test(key))return 'Key'+key.toUpperCase();if(/^[0-9]$/.test(key))return 'Digit'+key;return {' ':'Space',Control:'ControlLeft',Shift:'ShiftLeft',Alt:'AltLeft'}[key]||key}
export function pressKeyboardKey(keys,event,focused=true){const code=keyboardCode(event);if(!focused||!code||event.repeat&&!keys[code])return false;keys[code]=true;return true}
export function releaseKeyboardKey(keys,event){delete keys[keyboardCode(event)]}
