export function removeLegacyUI(doc=document){for(const node of doc.querySelectorAll('#installGameDialog,#installPromptDialog,#installPromptMenu,#pwaInstallPrompt,.asteroidFieldLabels'))node.remove()}
