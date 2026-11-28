import entry from './entry.html';
import uiEditor from './ui-editor.txt';
import editor from './editor.txt';
import modelCatalog from './model-catalog.txt';
import modelEdits from './model-edits.mjs';
import { studioRequest } from './routes.mjs';

export default {
  fetch(request, env) {
    return studioRequest(request, env, { entry, editor: modelEdits + "\n" + modelCatalog + "\n" + uiEditor + "\n" + editor });
  },
};
