import { select } from '../common/select.js';
import { command } from '../common/command.js';

/**
 * Cut action wrapper.
 * @param {String|HTMLElement} target
 * @return {String}
 */
const ClipboardActionCut = (target) => {
  const selectedText = select(target);
  command('cut');
  return selectedText;
};

export { ClipboardActionCut }
